import { db } from '../db';
import { searchLogs, documents, documentChunks, embeddings } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { OllamaEmbeddingProvider } from './ollama.embedding';
import { RetrievalProvider } from './retrieval.provider';
import { VectorStoreProvider } from './vectorstore.provider';

export interface SearchResultItem {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  score: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  metrics: {
    retrievalTimeMs: number;
    chunksSearched: number;
    topScore: number;
  };
}

export class SearchService {
  private static embeddingProvider = new OllamaEmbeddingProvider();
  private static vectorStore = new VectorStoreProvider();
  private static retrievalProvider = new RetrievalProvider(this.vectorStore);

  /**
   * Orchestrates the semantic search flow: embeds query, runs similarity search, logs metrics
   */
  static async search(params: {
    userId: string;
    query: string;
    documentId?: string;
    limit?: number;
  }): Promise<SearchResponse> {
    const limit = params.limit || 5;
    const startTime = Date.now();

    // 1. Generate query embedding vector using Ollama nomination model
    const queryVector = await this.embeddingProvider.generateEmbedding(params.query);

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

    // 3. Retrieve matching top chunks from pgvector
    const scopeDocIds = params.documentId ? [params.documentId] : [];
    const retrievalResults = await this.retrievalProvider.retrieveChunks(
      queryVector,
      scopeDocIds,
      limit
    );

    const retrievalTimeMs = Date.now() - startTime;
    const topScore = retrievalResults.length > 0 ? retrievalResults[0].score : 0;

    // 4. Log search performance metrics to database for analytics
    await db.insert(searchLogs).values({
      userId: params.userId,
      query: params.query,
      retrievalTimeMs,
      chunksSearched: chunksSearchedCount,
      topScore,
    });

    // 5. Map results for output
    const results: SearchResultItem[] = retrievalResults.map((item) => ({
      id: item.chunk.id,
      documentId: item.chunk.documentId,
      documentName: (item.chunk as any).documentName || 'Unknown Document',
      chunkIndex: item.chunk.chunkIndex,
      content: item.chunk.content,
      pageNumber: item.chunk.pageNumber,
      score: item.score,
    }));

    return {
      results,
      metrics: {
        retrievalTimeMs,
        chunksSearched: chunksSearchedCount,
        topScore,
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
