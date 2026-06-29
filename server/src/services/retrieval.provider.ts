import { db } from '../db';
import { documentChunks, documents, embeddings } from '../db/schema';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { IRetrievalProvider, RetrievalResult, RetrievalOptions } from '../interfaces/retrieval.interface';
import { IVectorStoreProvider } from '../interfaces/vectorstore.interface';
import { DocumentChunk } from '@docmind/shared';
import { BM25RankingService } from './bm25.service';

export class RetrievalProvider implements IRetrievalProvider {
  private vectorStore: IVectorStoreProvider;

  constructor(vectorStore: IVectorStoreProvider) {
    this.vectorStore = vectorStore;
  }

  /**
   * Performs semantic, keyword, or hybrid query execution and resolves matching text chunk records.
   */
  async retrieveChunks(
    queryVector: number[] | null,
    documentIds: string[],
    limit: number,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]> {
    const mode = options?.mode || 'semantic';
    const queryText = options?.queryText || '';
    const userId = options?.userId;
    const scopedDocId = documentIds.length === 1 ? documentIds[0] : undefined;

    // Resolve configuration weights for hybrid fusion (with production env defaults)
    const semWeight = options?.semanticWeight ?? Number(process.env.HYBRID_SEMANTIC_WEIGHT || 0.5);
    const keyWeight = options?.keywordWeight ?? Number(process.env.HYBRID_KEYWORD_WEIGHT || 0.5);

    // ─────────────────────────────────────────────────────────────────────────
    // MODE 1: Pure Semantic ( pgvector Similarity Search )
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'semantic') {
      if (!queryVector || queryVector.length === 0) {
        throw new Error('Semantic search requires a non-empty queryVector');
      }

      const similarityResults = await this.vectorStore.similaritySearch(
        queryVector,
        limit,
        scopedDocId
      );

      if (similarityResults.length === 0) return [];

      const chunkIds = similarityResults.map((res) => res.chunkId);
      const chunkRecords = await this.fetchChunkDetails(chunkIds);

      return similarityResults.map((simRes) => {
        const rec = chunkRecords.find((r) => r.id === simRes.chunkId);
        if (!rec) {
          throw new Error(`Integrity error: chunk ${simRes.chunkId} not found in database`);
        }

        return {
          chunk: this.mapRecordToChunk(rec),
          score: simRes.score,
          semanticScore: simRes.score,
          keywordScore: 0,
          retrievalMode: 'semantic' as const,
        };
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODE 2: Pure Keyword ( BM25 Relevance Ranking )
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'keyword') {
      if (!queryText || !queryText.trim()) {
        throw new Error('Keyword search requires non-empty queryText');
      }

      // 1. Fetch all candidate chunks within scope
      const candidateChunks = await this.fetchScopeChunks(documentIds, userId);
      if (candidateChunks.length === 0) return [];

      // 2. Compute BM25 relevance scores
      const rankedItems = BM25RankingService.rankChunks(queryText, candidateChunks);

      // 3. Take the top matches up to the requested limit
      const topMatches = rankedItems.slice(0, limit);

      return topMatches.map((match) => ({
        chunk: this.mapRecordToChunk(match.item),
        score: match.normalizedScore,
        semanticScore: 0,
        keywordScore: match.normalizedScore,
        retrievalMode: 'keyword' as const,
      }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODE 3: Hybrid ( Weighted Score Fusion of Semantic & BM25 )
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'hybrid') {
      if (!queryVector || queryVector.length === 0) {
        throw new Error('Hybrid search requires a queryVector for the semantic component');
      }
      if (!queryText || !queryText.trim()) {
        throw new Error('Hybrid search requires queryText for the keyword component');
      }

      // To build a robust fused candidate pool, we retrieve more candidates than the limit (limit * 4)
      const candidatePoolLimit = limit * 4;

      // 1. Run Semantic Search to get top vector candidates
      const semanticCandidates = await this.vectorStore.similaritySearch(
        queryVector,
        candidatePoolLimit,
        scopedDocId
      );

      // 2. Fetch all scoped chunks and rank them with BM25 to get top keyword candidates
      const allScopedChunks = await this.fetchScopeChunks(documentIds, userId);
      const rankedKeywordCandidates = BM25RankingService.rankChunks(queryText, allScopedChunks)
        .slice(0, candidatePoolLimit);

      // 3. Extract the union of unique chunk IDs from both retrieval methods
      const semanticMap = new Map<string, number>(semanticCandidates.map(c => [c.chunkId, c.score]));
      const keywordMap = new Map<string, number>(rankedKeywordCandidates.map(c => [c.item.id, c.rawScore]));

      const unionChunkIds = Array.from(new Set([
        ...semanticMap.keys(),
        ...keywordMap.keys()
      ]));

      if (unionChunkIds.length === 0) return [];

      // 4. Resolve exact semantic similarity scores for all chunks in the union
      // This is query-efficient: it executes a single database lookup for the exact cosine similarities of all union items.
      const vectorStr = `[${queryVector.join(',')}]`;
      const similarityExpression = sql<number>`1 - (${embeddings.embedding} <=> ${vectorStr}::vector)`;
      const exactSemanticScores = await db
        .select({
          chunkId: embeddings.chunkId,
          score: similarityExpression,
        })
        .from(embeddings)
        .where(inArray(embeddings.chunkId, unionChunkIds));

      const finalSemanticMap = new Map<string, number>();
      for (const row of exactSemanticScores) {
        finalSemanticMap.set(row.chunkId, Number(row.score));
      }

      // 5. Apply Max-Score normalization to the BM25 scores within the union candidate pool
      const maxRawKeywordScore = Array.from(keywordMap.values()).reduce((max, val) => Math.max(max, val), 0);

      // 6. Perform Weighted Score Fusion on the candidate union
      const fusedCandidates = await Promise.all(
        unionChunkIds.map(async (chunkId) => {
          const rawSem = finalSemanticMap.get(chunkId) || 0;
          const rawKey = keywordMap.get(chunkId) || 0;

          // Normalized score components [0, 1]
          const semScore = rawSem;
          const keyScore = maxRawKeywordScore > 0 ? rawKey / maxRawKeywordScore : 0;

          // Expose configurable weighted score fusion
          const fusedScore = semWeight * semScore + keyWeight * keyScore;

          return {
            chunkId,
            score: fusedScore,
            semanticScore: semScore,
            keywordScore: keyScore,
          };
        })
      );

      // 7. Sort the fused candidates and take the top matching items
      fusedCandidates.sort((a, b) => b.score - a.score);
      const topFused = fusedCandidates.slice(0, limit);

      const topFusedIds = topFused.map(tc => tc.chunkId);
      const chunkRecords = await this.fetchChunkDetails(topFusedIds);

      return topFused.map((fusedItem) => {
        const rec = chunkRecords.find(r => r.id === fusedItem.chunkId);
        if (!rec) {
          throw new Error(`Integrity error: chunk ${fusedItem.chunkId} not found in database`);
        }

        return {
          chunk: this.mapRecordToChunk(rec),
          score: fusedItem.score,
          semanticScore: fusedItem.semanticScore,
          keywordScore: fusedItem.keywordScore,
          retrievalMode: 'hybrid' as const,
        };
      });
    }

    return [];
  }

  /**
   * Helper to fetch detailed database records for specified chunk IDs.
   */
  private async fetchChunkDetails(chunkIds: string[]) {
    return db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        wordCount: documentChunks.wordCount,
        createdAt: documentChunks.createdAt,
        documentName: documents.originalName,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(inArray(documentChunks.id, chunkIds));
  }

  /**
   * Helper to fetch all chunks within the search scope (document range or user scope).
   */
  private async fetchScopeChunks(documentIds: string[], userId?: string) {
    const query = db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        wordCount: documentChunks.wordCount,
        createdAt: documentChunks.createdAt,
        documentName: documents.originalName,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id));

    if (documentIds.length > 0) {
      return query.where(inArray(documentChunks.documentId, documentIds));
    } else if (userId) {
      return query.where(eq(documents.userId, userId));
    }

    return [];
  }

  /**
   * Maps a database row back to the type-safe DocumentChunk structure.
   */
  private mapRecordToChunk(rec: any): DocumentChunk & { documentName?: string } {
    return {
      id: rec.id,
      documentId: rec.documentId,
      chunkIndex: rec.chunkIndex,
      content: rec.content,
      pageNumber: rec.pageNumber,
      createdAt: rec.createdAt.toISOString(),
      documentName: rec.documentName,
    };
  }
}

