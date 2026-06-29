import { db } from '../db';
import { searchLogs, documents, documentChunks, embeddings } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { OllamaEmbeddingProvider } from './ollama.embedding';
import { RetrievalProvider } from './retrieval.provider';
import { VectorStoreProvider } from './vectorstore.provider';
import { RerankerService } from './rerank/reranker.service';

export interface SearchResultItem {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  score: number;
  semanticScore?: number; // Added in Phase 5: raw or normalized semantic similarity score
  keywordScore?: number;  // Added in Phase 5: raw or normalized keyword relevance score
  retrievalMode?: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5: actual match mode
  originalRank?: number; // Added in Phase 6: original rank in candidate pool (1-20)
  newRank?: number;      // Added in Phase 6: new rank after reranking (1-5)
  rerankScore?: number;  // Added in Phase 6: cross-encoder relevance score
}

export interface SearchResponse {
  results: SearchResultItem[];
  metrics: {
    retrievalTimeMs: number;
    chunksSearched: number;
    topScore: number;
    avgScore: number;      // Added in Phase 5: average retrieval score across returned set
    retrievalMode: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5: retrieval mode
    isReranked?: boolean;   // Added in Phase 6
    rerankLatencyMs?: number; // Added in Phase 6
  };
}

export class SearchService {
  private static embeddingProvider = new OllamaEmbeddingProvider();
  private static vectorStore = new VectorStoreProvider();
  private static retrievalProvider = new RetrievalProvider(this.vectorStore);

  /**
   * Orchestrates the search flow: conditionally embeds query, runs retrieval search, and logs metrics
   */
  static async search(params: {
    userId: string;
    query: string;
    documentId?: string;
    limit?: number;
    mode?: 'semantic' | 'keyword' | 'hybrid';
    rerank?: boolean; // Added in Phase 6
  }): Promise<SearchResponse> {
    const mode = params.mode || 'semantic';
    const startTime = Date.now();

    // Rerank check: explicitly requested OR enabled globally via environment configuration
    const rerankEnabled = params.rerank !== undefined
      ? params.rerank
      : process.env.RERANKER_ENABLED !== 'false';

    const finalLimit = params.limit || 5;
    const candidateLimit = rerankEnabled
      ? Number(process.env.RERANKER_CANDIDATE_COUNT || 20)
      : finalLimit;

    // 1. Performance optimization: Generate query embedding vector ONLY if semantic calculations are required.
    let queryVector: number[] | null = null;
    if (mode === 'semantic' || mode === 'hybrid') {
      queryVector = await this.embeddingProvider.generateEmbedding(params.query);
    }

    // 2. Compute count of chunks searched in this scope
    let chunksSearchedCount = 0;
    if (params.documentId) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentChunks)
        .where(eq(documentChunks.documentId, params.documentId));
      chunksSearchedCount = Number(count);
    } else {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(eq(documents.userId, params.userId));
      chunksSearchedCount = Number(count);
    }

    // Resolve configuration weights for hybrid fusion
    const semWeight = Number(process.env.HYBRID_SEMANTIC_WEIGHT || 0.5);
    const keyWeight = Number(process.env.HYBRID_KEYWORD_WEIGHT || 0.5);

    // 3. Retrieve matching candidate chunks from vector/keyword matching provider
    const scopeDocIds = params.documentId ? [params.documentId] : [];
    let retrievalResults = await this.retrievalProvider.retrieveChunks(
      queryVector,
      scopeDocIds,
      candidateLimit,
      {
        mode,
        queryText: params.query,
        userId: params.userId,
        semanticWeight: semWeight,
        keywordWeight: keyWeight,
      }
    );

    const retrievalTimeMs = Date.now() - startTime;

    // 4. Cross-Encoder Rerank Stage
    let rerankLatencyMs = 0;
    if (rerankEnabled && retrievalResults.length > 0) {
      const rerankStart = Date.now();
      retrievalResults = await RerankerService.rerank(params.query, retrievalResults);
      retrievalResults = retrievalResults.slice(0, finalLimit);
      rerankLatencyMs = Date.now() - rerankStart;
    }

    const topScore = retrievalResults.length > 0 ? retrievalResults[0].score : 0;
    
    // Compute average score of retrieved candidates
    const avgScore = retrievalResults.length > 0
      ? retrievalResults.reduce((sum, item) => sum + item.score, 0) / retrievalResults.length
      : 0;

    // 5. Log search performance metrics to database for analytics
    await db.insert(searchLogs).values({
      userId: params.userId,
      query: params.query,
      retrievalTimeMs,
      chunksSearched: chunksSearchedCount,
      topScore,
      avgScore,
      retrievalMode: mode,
      semanticWeight: mode === 'hybrid' ? semWeight : null,
      keywordWeight: mode === 'hybrid' ? keyWeight : null,
      isReranked: rerankEnabled,
      rerankLatencyMs,
    });

    // 6. Map results for output
    const results: SearchResultItem[] = retrievalResults.map((item) => ({
      id: item.chunk.id,
      documentId: item.chunk.documentId,
      documentName: (item.chunk as any).documentName || 'Unknown Document',
      chunkIndex: item.chunk.chunkIndex,
      content: item.chunk.content,
      pageNumber: item.chunk.pageNumber,
      score: item.score,
      semanticScore: item.semanticScore,
      keywordScore: item.keywordScore,
      retrievalMode: item.retrievalMode,
      originalRank: item.originalRank,
      newRank: item.newRank,
      rerankScore: item.rerankScore,
    }));

    return {
      results,
      metrics: {
        retrievalTimeMs,
        chunksSearched: chunksSearchedCount,
        topScore,
        avgScore,
        retrievalMode: mode,
        isReranked: rerankEnabled,
        rerankLatencyMs,
      },
    };
  }

  /**
   * Retrieves aggregate counts for the dashboard analytics panel
   */
  static async getSearchStats(userId: string) {
    // 1. Count processed documents
    const [{ docCount }] = await db
      .select({ docCount: sql<number>`count(*)` })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.status, 'ready')));

    // 2. Count chunks generated across user documents
    const [{ chunkCount }] = await db
      .select({ chunkCount: sql<number>`count(*)` })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.userId, userId));

    // 3. Count embeddings generated across user document chunks
    const [{ embeddingCount }] = await db
      .select({ embeddingCount: sql<number>`count(*)` })
      .from(embeddings)
      .innerJoin(documentChunks, eq(embeddings.chunkId, documentChunks.id))
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(eq(documents.userId, userId));

    // 4. Count searches performed
    const [{ searchCount }] = await db
      .select({ searchCount: sql<number>`count(*)` })
      .from(searchLogs)
      .where(eq(searchLogs.userId, userId));

    return {
      documentsProcessed: Number(docCount),
      chunksGenerated: Number(chunkCount),
      embeddingsGenerated: Number(embeddingCount),
      searchesPerformed: Number(searchCount),
    };
  }
}
