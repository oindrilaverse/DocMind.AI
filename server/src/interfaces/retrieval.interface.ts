import { DocumentChunk } from '@docmind/shared';

export interface RetrievalResult {
  chunk: DocumentChunk & { documentName?: string };
  score: number;
  semanticScore?: number; // Added in Phase 5: raw or normalized semantic similarity score
  keywordScore?: number;  // Added in Phase 5: raw or normalized keyword relevance score (BM25)
  retrievalMode?: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5: the mode that matched this chunk
  originalRank?: number;  // Added in Phase 6: original rank in candidate pool (1-20)
  newRank?: number;       // Added in Phase 6: new rank after reranking (1-5)
  rerankScore?: number;   // Added in Phase 6: cross-encoder relevance score
}

export interface RetrievalOptions {
  queryText?: string;     // Raw query text, required for BM25 keyword searches
  mode?: 'semantic' | 'keyword' | 'hybrid'; // Search algorithm to execute (default: 'semantic')
  userId?: string;        // Scopes candidate chunks to documents owned by the active user
  semanticWeight?: number; // Weight for semantic score in hybrid search (default: process.env.HYBRID_SEMANTIC_WEIGHT)
  keywordWeight?: number;  // Weight for keyword score in hybrid search (default: process.env.HYBRID_KEYWORD_WEIGHT)
}

export interface IRetrievalProvider {
  /**
   * Retrieves relevant document chunks based on a query vector and/or keyword query text.
   *
   * @param queryVector The embedding representation of the query (can be null in pure Keyword mode).
   * @param documentIds The list of document UUIDs to search within.
   * @param limit The maximum number of chunks to retrieve.
   * @param options Additional search configurations (mode, queryText, weights, etc.)
   * @returns A promise that resolves to retrieval results containing chunk details, scores, and matching modes.
   */
  retrieveChunks(
    queryVector: number[] | null,
    documentIds: string[],
    limit: number,
    options?: RetrievalOptions
  ): Promise<RetrievalResult[]>;
}

export class PlaceholderRetrievalProvider implements IRetrievalProvider {
  async retrieveChunks(
    _queryVector: number[] | null,
    _documentIds: string[],
    _limit: number,
    _options?: RetrievalOptions
  ): Promise<RetrievalResult[]> {
    throw new Error('Method not implemented. IRetrievalProvider is a Phase 1 placeholder.');
  }
}

