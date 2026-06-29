import { RetrievalResult } from '../../interfaces/retrieval.interface';

export interface RerankerOptions {
  model?: string;
  timeout?: number;
}

export interface IRerankerProvider {
  name: string;
  rerank(
    query: string,
    candidates: RetrievalResult[],
    options?: RerankerOptions
  ): Promise<RetrievalResult[]>;
}
