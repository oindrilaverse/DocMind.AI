import { IRerankerProvider, RerankerOptions } from './rerank.interface';
import { LocalCrossEncoderProvider } from './local-cross-encoder.provider';
import { CohereRerankProvider } from './cohere-rerank.provider';
import { RetrievalResult } from '../../interfaces/retrieval.interface';

/**
 * RerankerService
 *
 * Orchestrator and Registry for Cross-Encoder reranking providers.
 * Supports hot-swappable providers, customizable models, and timeouts via env configs.
 */
export class RerankerService {
  private static providers: Record<string, IRerankerProvider> = {
    'local-cross-encoder': new LocalCrossEncoderProvider(),
    'cohere': new CohereRerankProvider(),
  };

  /**
   * Returns the configured provider instance.
   */
  static getProvider(name?: string): IRerankerProvider {
    const activeName = name || process.env.RERANKER_PROVIDER || 'local-cross-encoder';
    const provider = this.providers[activeName];
    if (!provider) {
      console.warn(`[Reranker] Provider "${activeName}" not registered. Falling back to local-cross-encoder.`);
      return this.providers['local-cross-encoder'];
    }
    return provider;
  }

  /**
   * Main entrypoint to rerank candidates using the resolved provider.
   */
  static async rerank(
    query: string,
    candidates: RetrievalResult[],
    options?: RerankerOptions
  ): Promise<RetrievalResult[]> {
    const isEnabled = process.env.RERANKER_ENABLED !== 'false'; // Default to enabled unless explicitly 'false'
    if (!isEnabled || candidates.length === 0) {
      // Return candidates with base positions mapped to keep API backwards-compatibility
      return candidates.map((c, idx) => ({
        ...c,
        originalRank: idx + 1,
        newRank: idx + 1,
        rerankScore: c.score,
      }));
    }

    const provider = this.getProvider();
    
    // Resolve timeout parameters from environment variables
    const timeout = Number(process.env.RERANKER_TIMEOUT || 5000);
    const model = process.env.RERANKER_MODEL;

    return provider.rerank(query, candidates, {
      model,
      timeout,
      ...options,
    });
  }
}
