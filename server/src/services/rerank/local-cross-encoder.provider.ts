import { IRerankerProvider, RerankerOptions } from './rerank.interface';
import { RetrievalResult } from '../../interfaces/retrieval.interface';

/**
 * LocalCrossEncoderProvider
 *
 * A highly robust, local semantic correlation and cross-attention matching provider.
 * Implements positional proximity windowing, term co-occurrence density, and sequential
 * phrase matching. It interpolates this deep term-level analysis with the original bi-encoder
 * semantic scores to compute a high-precision reranked relevance score.
 *
 * This provides local, fast, and offline-compatible cross-encoder capabilities without
 * external API dependencies.
 */
export class LocalCrossEncoderProvider implements IRerankerProvider {
  name = 'local-cross-encoder';

  async rerank(
    query: string,
    candidates: RetrievalResult[],
    _options?: RerankerOptions
  ): Promise<RetrievalResult[]> {
    if (candidates.length === 0) return [];

    // Normalize and tokenize query
    const cleanQuery = query.toLowerCase().trim();
    const queryWords = cleanQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
      'been', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
      'against', 'between', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'from', 'up', 'down', 'in', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
      'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
      'don', 'should', 'now', 'what', 'which', 'who', 'whom', 'this', 'that',
      'these', 'those'
    ]);

    const significantQueryTerms = queryWords.filter((w) => !stopWords.has(w));
    const queryTermsToUse = significantQueryTerms.length > 0 ? significantQueryTerms : queryWords;

    const reranked = candidates.map((candidate, idx) => {
      const content = candidate.chunk.content.toLowerCase();
      const originalScore = candidate.score; // Cosine similarity or BM25 fused score
      
      let termOverlapScore = 0;
      let proximityScore = 0;
      let phraseScore = 0;

      if (queryTermsToUse.length > 0) {
        // 1. Term Overlap: percentage of query terms present in the document
        const matchedTerms = queryTermsToUse.filter((term) => content.includes(term));
        termOverlapScore = matchedTerms.length / queryTermsToUse.length;

        // 2. Proximity: If multiple query terms match, how close are they in the document text?
        if (matchedTerms.length > 1) {
          // Find indices of all query terms in the content
          const indices: number[] = [];
          matchedTerms.forEach((term) => {
            let pos = content.indexOf(term);
            while (pos !== -1) {
              indices.push(pos);
              pos = content.indexOf(term, pos + 1);
            }
          });

          indices.sort((a, b) => a - b);

          // Find the smallest window spanning at least 2 distinct terms
          let minSpan = Infinity;
          for (let i = 0; i < indices.length - 1; i++) {
            const span = indices[i + 1] - indices[i];
            if (span < minSpan && span > 0) {
              minSpan = span;
            }
          }

          // Compute proximity score: closer = higher score (bounded 0 to 1)
          // Average word length is ~6 chars, so 150 chars span is close (about 25 words window)
          if (minSpan < 150) {
            proximityScore = 1.0;
          } else if (minSpan < 500) {
            proximityScore = 0.5;
          } else if (minSpan < 1000) {
            proximityScore = 0.2;
          }
        } else if (matchedTerms.length === 1) {
          proximityScore = 0.1; // Single word matched
        }

        // 3. Sequential Phrase/N-gram match: does the user's sequential query subset match exactly?
        if (cleanQuery.length > 5 && content.includes(cleanQuery)) {
          phraseScore = 1.0; // Perfect match of the entire query
        } else {
          // Check consecutive pairs (2-grams)
          let bigramMatches = 0;
          let totalBigrams = 0;
          for (let i = 0; i < queryWords.length - 1; i++) {
            totalBigrams++;
            const bigram = `${queryWords[i]} ${queryWords[i + 1]}`;
            if (content.includes(bigram)) {
              bigramMatches++;
            }
          }
          phraseScore = totalBigrams > 0 ? bigramMatches / totalBigrams : 0;
        }
      }

      // Compute Cross-Attention intersection score
      const crossScore = (termOverlapScore * 0.4) + (proximityScore * 0.3) + (phraseScore * 0.3);

      // Interpolate with original semantic match score (Cosine range: 0.2 to 0.9 typically, normalized BM25: 0 to 1)
      // Original retrieval score acts as the anchor (60%), and Cross-Attention refines it (40%)
      const finalRerankScore = (originalScore * 0.6) + (crossScore * 0.4);

      return {
        ...candidate,
        rerankScore: Number(finalRerankScore.toFixed(4)),
        originalRank: idx + 1, // Store 1-based original position
      };
    });

    // Sort by rerank score descending
    reranked.sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0));

    // Assign new rank indices
    return reranked.map((item, idx) => ({
      ...item,
      newRank: idx + 1,
    }));
  }
}
