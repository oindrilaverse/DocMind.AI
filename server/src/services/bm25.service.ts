/**
 * BM25RankingService — Phase 5: Hybrid Search
 *
 * WHAT IT DOES:
 *   Implements the classic Okapi BM25 text ranking algorithm in Node.js.
 *   Given a query string and a set of candidate document chunks, this service:
 *     1. Tokenizes and processes the query and chunk content (lowercasing, stopword filtering, length normalization).
 *     2. Computes Term Frequency (TF) for each token within each chunk.
 *     3. Computes Document Frequency (DF) and Inverse Document Frequency (IDF) for all query tokens.
 *     4. Calculates Okapi BM25 scores for each chunk.
 *     5. Normalizes the final score using Max-Score scaling so that the scores map to [0, 1].
 *
 * WHY IT EXISTS:
 *   Vector/semantic search excels at capturing high-level conceptual similarity, but
 *   often struggles with exact keyword matching (such as specific serial numbers,
 *   exact names, technical jargon, or alphanumeric codes). Integrating BM25
 *   keyword matching directly addresses this retrieval gap, forming a robust hybrid engine.
 *
 * HOW IT CONNECTS TO THE RAG PIPELINE:
 *   The RetrievalProvider delegates to BM25RankingService.rankChunks() to compute keyword
 *   relevance scores when executing search/retrieval in "keyword" or "hybrid" modes.
 */

export interface TokenizedChunk {
  id: string;
  tokens: string[];
  length: number;
}

export class BM25RankingService {
  // BM25 Tuning Parameters:
  // k1: Controls term frequency saturation. Typically between 1.2 and 2.0. Higher = TF has higher weight.
  private static readonly k1 = 1.5;
  // b: Controls document length normalization (typically 0.75). Higher = longer documents are penalized more.
  private static readonly b = 0.75;

  // List of common English stopwords to exclude during tokenization to enhance query precision
  private static readonly stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
    'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'himself', 'his', 'how',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
    'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  /**
   * Tokenizes text into lowercase words, filtering out punctuation and stop words.
   * Handles edge cases such as empty values.
   */
  static tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .map(t => t.trim())
      .filter(t => t.length > 1 && !this.stopWords.has(t));
  }

  /**
   * Scores and ranks a set of text chunks against a keyword query using the Okapi BM25 formula.
   *
   * Formula:
   *   IDF(q) = ln( (N - n(q) + 0.5) / (n(q) + 0.5) + 1 )
   *   Score(D, Q) = Sum( IDF(q) * (f(q, D) * (k1 + 1)) / (f(q, D) + k1 * (1 - b + b * (|D| / avgdl))) )
   *
   * @param query - The user search query string
   * @param chunks - Array of chunk records containing `id` and `content`
   * @returns List of chunks with raw and max-normalized relevance scores [0, 1]
   */
  static rankChunks<T extends { id: string; content: string }>(
    query: string,
    chunks: T[]
  ): Array<{ item: T; rawScore: number; normalizedScore: number }> {
    const queryTerms = this.tokenize(query);
    
    // Return zero scores if query or chunk array is empty
    if (queryTerms.length === 0 || chunks.length === 0) {
      return chunks.map(chunk => ({ item: chunk, rawScore: 0, normalizedScore: 0 }));
    }

    const totalDocs = chunks.length;

    // 1. Tokenize chunks, compute lengths, and count document frequencies (DF)
    const tokenizedChunks: TokenizedChunk[] = [];
    let totalLength = 0;
    const docFrequency: Record<string, Set<string>> = {};

    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.content);
      tokenizedChunks.push({
        id: chunk.id,
        tokens,
        length: tokens.length,
      });
      totalLength += tokens.length;

      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        if (!docFrequency[term]) {
          docFrequency[term] = new Set();
        }
        docFrequency[term].add(chunk.id);
      }
    }

    const avgdl = totalLength / totalDocs;

    // 2. Compute Inverse Document Frequency (IDF) for all query terms
    const idf: Record<string, number> = {};
    for (const term of queryTerms) {
      const df = docFrequency[term]?.size || 0;
      // Standard BM25 IDF formulation with a floor to prevent negative IDFs for ultra-frequent terms
      idf[term] = Math.log(((totalDocs - df + 0.5) / (df + 0.5)) + 1);
    }

    // 3. Compute raw scores for each chunk
    const scoredChunks = tokenizedChunks.map((tc, index) => {
      let score = 0;

      // Compute local term frequencies for this chunk
      const termFreqs: Record<string, number> = {};
      for (const token of tc.tokens) {
        termFreqs[token] = (termFreqs[token] || 0) + 1;
      }

      for (const term of queryTerms) {
        const tf = termFreqs[term] || 0;
        if (tf === 0) continue;

        const termIdf = idf[term];
        const docLen = tc.length;

        // BM25 term weighting equation
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / (avgdl || 1)));

        score += termIdf * (numerator / denominator);
      }

      return {
        item: chunks[index],
        rawScore: score,
      };
    });

    // 4. Sort results descending by score
    scoredChunks.sort((a, b) => b.rawScore - a.rawScore);

    // 5. Max-score scaling to map scores to the range [0, 1]
    const maxScore = scoredChunks[0]?.rawScore || 0;

    return scoredChunks.map(sc => ({
      item: sc.item,
      rawScore: sc.rawScore,
      normalizedScore: maxScore > 0 ? sc.rawScore / maxScore : 0,
    }));
  }
}
