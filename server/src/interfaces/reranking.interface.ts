import { RetrievalResult } from './retrieval.interface';

export interface IRerankingProvider {
  /**
   * Re-ranks retrieval results to filter out noise and improve context relevance.
   * @param query The user's original query.
   * @param results The list of retrieval results from the initial semantic search.
   * @param limit The maximum number of results to return after re-ranking.
   * @returns A promise resolving to the re-ranked retrieval results.
   */
  rerank(query: string, results: RetrievalResult[], limit: number): Promise<RetrievalResult[]>;
}

export class PlaceholderRerankingProvider implements IRerankingProvider {
  async rerank(_query: string, _results: RetrievalResult[], _limit: number): Promise<RetrievalResult[]> {
    throw new Error('Method not implemented. IRerankingProvider is a Phase 1 placeholder.');
  }
}
