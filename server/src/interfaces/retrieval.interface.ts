import { DocumentChunk } from '@docmind/shared';

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
}

export interface IRetrievalProvider {
  /**
   * Retrieves relevant document chunks based on a query vector.
   * @param queryVector The embedding representation of the query.
   * @param documentIds The list of document UUIDs to search within.
   * @param limit The maximum number of chunks to retrieve.
   * @returns A promise that resolves to retrieval results containing chunk details and similarity scores.
   */
  retrieveChunks(queryVector: number[] | any, documentIds: string[], limit: number): Promise<RetrievalResult[]>;
}

export class PlaceholderRetrievalProvider implements IRetrievalProvider {
  async retrieveChunks(_query: string, _documentIds: string[], _limit: number): Promise<RetrievalResult[]> {
    throw new Error('Method not implemented. IRetrievalProvider is a Phase 1 placeholder.');
  }
}
