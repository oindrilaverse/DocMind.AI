import { IRerankerProvider, RerankerOptions } from './rerank.interface';
import { RetrievalResult } from '../../interfaces/retrieval.interface';

/**
 * CohereRerankProvider
 *
 * Connects to Cohere's production /v1/rerank API to perform enterprise-grade
 * cross-encoder relevance scoring. Falls back gracefully with timeout protection.
 */
export class CohereRerankProvider implements IRerankerProvider {
  name = 'cohere';

  async rerank(
    query: string,
    candidates: RetrievalResult[],
    options?: RerankerOptions
  ): Promise<RetrievalResult[]> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      console.warn('[Cohere Rerank] Missing COHERE_API_KEY. Falling back to default candidates.');
      return candidates.map((c, idx) => ({
        ...c,
        rerankScore: c.score,
        originalRank: idx + 1,
        newRank: idx + 1,
      }));
    }

    if (candidates.length === 0) return [];

    const model = options?.model || process.env.RERANKER_MODEL || 'rerank-english-v3.0';
    const timeout = options?.timeout || 5000;

    const documents = candidates.map((c) => c.chunk.content);

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://api.cohere.com/v1/rerank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          query,
          documents,
          top_n: candidates.length,
        }),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`Cohere API returned status ${response.status}`);
      }

      const data = await response.json();
      const resultsList = data.results as Array<{ index: number; relevance_score: number }>;

      // Map back
      const mapped = resultsList.map((res, newIdx) => {
        const candidate = candidates[res.index];
        return {
          ...candidate,
          rerankScore: res.relevance_score,
          originalRank: res.index + 1,
          newRank: newIdx + 1,
        };
      });

      // Sort by rerankScore descending
      return mapped.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));
    } catch (error) {
      console.error('[Cohere Rerank] Error occurred, falling back:', error);
      return candidates.map((c, idx) => ({
        ...c,
        rerankScore: c.score,
        originalRank: idx + 1,
        newRank: idx + 1,
      }));
    }
  }
}
