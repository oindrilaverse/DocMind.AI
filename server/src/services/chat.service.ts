import { db } from '../db';
import { conversations, messages, citations, documentChunks, documents } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { OllamaEmbeddingProvider } from './ollama.embedding';
import { VectorStoreProvider } from './vectorstore.provider';
import { RetrievalProvider } from './retrieval.provider';
import { ContextBuilderService } from './context.builder';
import { OllamaLLMProvider } from './ollama.llm';
import { CitationService, CitationItem } from './citation.service';
// Phase 4: Import EvaluationService to record metrics after each RAG answer.
// This import is the ONLY addition to chat.service.ts.
import { EvaluationService } from './evaluation.service';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrievalLatencyMs?: number | null;
  answerLatencyMs?: number | null;
  createdAt: string;
}

export interface ChatAskResponse {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  citations: CitationItem[];
}

export class ChatService {
  private static embeddingProvider = new OllamaEmbeddingProvider();
  private static vectorStore = new VectorStoreProvider();
  private static retrievalProvider = new RetrievalProvider(this.vectorStore);
  private static llmProvider = new OllamaLLMProvider();

  /**
   * Orchestrates the complete RAG answer generation and citation recording pipeline
   */
  static async askQuestion(params: {
    userId: string;
    query: string;
    conversationId?: string;
    documentId?: string; // Optional filter scope
  }): Promise<ChatAskResponse> {
    let convId = params.conversationId;

    // 1. Create conversation if none provided
    if (!convId) {
      // Find document title for naming if documentId is provided
      let docTitle = 'General Session';
      if (params.documentId) {
        const doc = await db.query.documents.findFirst({
          where: eq(documents.id, params.documentId),
        });
        if (doc) {
          docTitle = `Chat: ${doc.originalName}`;
        }
      }
      
      const [newConv] = await db.insert(conversations).values({
        userId: params.userId,
        documentId: params.documentId || null,
        title: docTitle,
      }).returning();
      convId = newConv.id;
    }

    // 2. Insert User message into DB
    const [userMsgRecord] = await db.insert(messages).values({
      conversationId: convId,
      role: 'user',
      content: params.query,
    }).returning();

    const retrievalStart = Date.now();

    // 3. Generate query vector using Nomics embedding
    const queryVector = await this.embeddingProvider.generateEmbedding(params.query);

    // 4. Retrieve matching context chunks from vector DB (Limit to Top-5)
    const scopeDocIds = params.documentId ? [params.documentId] : [];
    const context = await this.retrievalProvider.retrieveChunks(queryVector, scopeDocIds, 5);

    const retrievalLatencyMs = Date.now() - retrievalStart;

    // Load past message history for context reasoning
    const pastRecords = await db
      .select({
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt))
      .limit(6); // Get last 6 messages

    const chatHistory = pastRecords.reverse().map(r => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
    }));

    // 5. Structure prompt using ContextBuilder
    const prompt = ContextBuilderService.buildPrompt(params.query, context, chatHistory);

    const answerStart = Date.now();

    // 6. Generate answer using Ollama local llama3.2 LLM
    let rawAnswer = '';
    const isLlmOnline = await this.llmProvider.checkHealth();
    if (isOllamaOnlineOrAvailable(isLlmOnline)) {
      try {
        rawAnswer = await this.llmProvider.generateCompletion(prompt);
      } catch (err: any) {
        console.error('[Ollama LLM] Answer generation failed:', err);
        rawAnswer = 'I encountered an error trying to generate an answer. Please verify Ollama service status.';
      }
    } else {
      rawAnswer = 'I could not generate an answer because the local Ollama LLM provider is offline.';
    }

    const answerLatencyMs = Date.now() - answerStart;

    // 7. Insert temp assistant message to DB to get ID
    const [tempAssistantMsg] = await db.insert(messages).values({
      conversationId: convId,
      role: 'assistant',
      content: rawAnswer, // Will update with cleanText
    }).returning();

    // 8. Extract citations, save mappings, and clean reference tags from response text
    const { cleanText, citationItems } = await CitationService.extractAndSaveCitations({
      answerId: tempAssistantMsg.id,
      rawText: rawAnswer,
      retrievedContext: context,
    });

    // 9. Update assistant message with metrics and cleaned text
    await db.update(messages)
      .set({
        content: cleanText,
        retrievalLatencyMs,
        answerLatencyMs,
      })
      .where(eq(messages.id, tempAssistantMsg.id));

    // ── Phase 4: Record evaluation metrics (non-blocking) ──────────────────
    // EvaluationService.recordEvaluation() runs AFTER all RAG logic is complete.
    // It writes one row to ai_evaluations for the Evaluation Dashboard.
    // It is wrapped in try/catch inside the service, so failures here will
    // never affect the response returned to the user.
    const avgSimilarity =
      context.length > 0
        ? context.reduce((sum, c) => sum + c.score, 0) / context.length
        : 0;
    const topSimilarity = context.length > 0 ? context[0].score : 0;
    const totalLatencyMs = retrievalLatencyMs + answerLatencyMs;

    EvaluationService.recordEvaluation({
      messageId: tempAssistantMsg.id,
      conversationId: convId,
      userId: params.userId,
      documentId: params.documentId ?? null,
      query: params.query,
      retrievalLatencyMs,
      llmLatencyMs: answerLatencyMs,
      totalLatencyMs,
      chunksRetrieved: context.length,
      citationsCount: citationItems.length,
      avgSimilarityScore: avgSimilarity,
      topSimilarityScore: topSimilarity,
      answerText: cleanText,
      ollamaOnline: isLlmOnline,
    }); // intentionally not awaited — fire-and-forget to keep latency low
    // ──────────────────────────────────────────────────────────────────────

    return {
      conversationId: convId,
      userMessage: {
        id: userMsgRecord.id,
        role: 'user',
        content: userMsgRecord.content,
        createdAt: userMsgRecord.createdAt.toISOString(),
      },
      assistantMessage: {
        id: tempAssistantMsg.id,
        role: 'assistant',
        content: cleanText,
        retrievalLatencyMs,
        answerLatencyMs,
        createdAt: tempAssistantMsg.createdAt.toISOString(),
      },
      citations: citationItems,
    };
  }

  /**
   * Retrieves past conversations and messages history lists
   */
  static async getConversationsHistory(userId: string) {
    const sessions = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));

    const enrichedHistory = await Promise.all(
      sessions.map(async (sess) => {
        const msgList = await db
          .select({
            id: messages.id,
            role: messages.role,
            content: messages.content,
            retrievalLatencyMs: messages.retrievalLatencyMs,
            answerLatencyMs: messages.answerLatencyMs,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.conversationId, sess.id))
          .orderBy(messages.createdAt);

        // Map messages to include citations
        const resolvedMessages = await Promise.all(
          msgList.map(async (msg) => {
            let messageCitations: CitationItem[] = [];
            if (msg.role === 'assistant') {
              messageCitations = await CitationService.getCitationsForMessage(msg.id);
            }

            return {
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              retrievalLatencyMs: msg.retrievalLatencyMs,
              answerLatencyMs: msg.answerLatencyMs,
              createdAt: msg.createdAt.toISOString(),
              citations: messageCitations,
            };
          })
        );

        return {
          id: sess.id,
          title: sess.title,
          createdAt: sess.createdAt.toISOString(),
          messages: resolvedMessages,
        };
      })
    );

    return enrichedHistory;
  }

  /**
   * Aggregates RAG analytics data for the dashboard panel
   */
  static async getRagAnalytics(userId: string) {
    // 1. Questions asked
    const [{ questionCount }] = await db
      .select({ questionCount: sql<number>`count(*)` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.userId, userId), eq(messages.role, 'user')));

    // 2. Average retrieval latency
    const [{ avgRetrieval }] = await db
      .select({ avgRetrieval: sql<number>`avg(${messages.retrievalLatencyMs})` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.userId, userId), eq(messages.role, 'assistant')));

    // 3. Average answer latency
    const [{ avgAnswer }] = await db
      .select({ avgAnswer: sql<number>`avg(${messages.answerLatencyMs})` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.userId, userId), eq(messages.role, 'assistant')));

    // 4. Citations per answer average
    const [{ citationsCount }] = await db
      .select({ citationsCount: sql<number>`count(${citations.id})` })
      .from(citations)
      .innerJoin(messages, eq(citations.answerId, messages.id))
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId));

    const [{ answerCount }] = await db
      .select({ answerCount: sql<number>`count(*)` })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(eq(conversations.userId, userId), eq(messages.role, 'assistant')));

    const avgCitationsPerAnswer = Number(answerCount) > 0 
      ? Number(citationsCount) / Number(answerCount) 
      : 0;

    // 5. Accuracy estimation (average similarity score of top matching cited chunks)
    const [{ avgScore }] = await db
      .select({ avgScore: sql<number>`avg(${citations.similarityScore})` })
      .from(citations)
      .innerJoin(messages, eq(citations.answerId, messages.id))
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId));

    return {
      questionsAsked: Number(questionCount),
      avgRetrievalLatencyMs: Math.round(Number(avgRetrieval) || 0),
      avgAnswerLatencyMs: Math.round(Number(avgAnswer) || 0),
      citationsPerAnswer: Number(avgCitationsPerAnswer.toFixed(1)),
      retrievalAccuracy: Number(avgScore) || 0,
    };
  }
}

// Simple health check helper
function isOllamaOnlineOrAvailable(health: boolean): boolean {
  return health;
}
