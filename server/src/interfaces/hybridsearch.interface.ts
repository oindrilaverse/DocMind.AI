import { RetrievalResult } from './retrieval.interface';

export interface IHybridSearchProvider {
  /**
   * Performs hybrid search combining BM25 keyword matching and vector similarity.
   */
  search(query: string, documentIds: string[], limit: number): Promise<RetrievalResult[]>;
}

export class PlaceholderHybridSearchProvider implements IHybridSearchProvider {
  async search(_query: string, _documentIds: string[], _limit: number): Promise<RetrievalResult[]> {
    throw new Error('Method not implemented. IHybridSearchProvider is a Phase 2 placeholder.');
  }
}
