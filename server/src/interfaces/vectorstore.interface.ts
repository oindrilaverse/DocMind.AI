export interface VectorRecord {
  chunkId: string;
  embedding: number[];
  embeddingModel: string;
  vectorDimension: number;
}

export interface VectorSearchResult {
  chunkId: string;
  score: number;
}

export interface IVectorStoreProvider {
  /**
   * Stores vector embeddings in the database linked to document chunks.
   */
  storeEmbeddings(records: VectorRecord[]): Promise<void>;

  /**
   * Deletes all embeddings associated with a document.
   */
  deleteEmbeddings(documentId: string): Promise<void>;

  /**
   * Performs vector similarity search (cosine distance/similarity).
   * @param queryVector The search query vector.
   * @param limit The maximum number of results (K).
   * @param documentId Optional. Scopes search to a single document.
   */
  similaritySearch(queryVector: number[], limit: number, documentId?: string): Promise<VectorSearchResult[]>;
}
