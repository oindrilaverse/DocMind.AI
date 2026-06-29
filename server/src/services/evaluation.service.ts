/**
 * EvaluationService — Phase 4: AI Evaluation Dashboard
 *
 * PURPOSE:
 *   This service is the single source of truth for AI evaluation metrics.
 *   It is responsible for:
 *     1. Recording evaluation data after every RAG answer (called by ChatService).
 *     2. Querying and aggregating that data for the Evaluation Dashboard.
 *     3. Exporting evaluation records as CSV or JSON.
 *
 * ARCHITECTURE POSITION:
 *   ChatService → EvaluationService.recordEvaluation() → ai_evaluations table
 *   EvaluationDashboardPage → /api/v1/evaluation/* → EvaluationService.get*()
 *
 * INDEPENDENCE:
 *   This service only imports from db/schema. It has zero knowledge of:
 *   - Authentication logic
 *   - Retrieval / embedding providers
 *   - Chunking / extraction pipelines
 *   - Citation parsing
 *   This isolation ensures that evaluation failures never impact the RAG pipeline.
 */

import { db } from '../db';
import { aiEvaluations, documents, conversations } from '../db/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { OllamaEmbeddingProvider } from './ollama.embedding';
import { RetrievalProvider } from './retrieval.provider';
import { VectorStoreProvider } from './vectorstore.provider';
import { RerankerService } from './rerank/reranker.service';

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parameters passed into recordEvaluation().
 * Populated by ChatService after the RAG pipeline completes.
 */
export interface EvaluationInput {
  messageId: string;
  conversationId: string;
  userId: string;
  documentId?: string | null;
  query: string;

  // Latency readings (all in milliseconds)
  retrievalLatencyMs: number;
  llmLatencyMs: number;
  totalLatencyMs: number;

  // Retrieval context data
  chunksRetrieved: number;
  citationsCount: number;
  avgSimilarityScore: number;
  topSimilarityScore: number;

  // Answer text (used for completeness + token estimation)
  answerText: string;

  // Was Ollama online during this request?
  ollamaOnline: boolean;

  // Phase 5: Retrieval Mode attributes
  retrievalMode: 'semantic' | 'keyword' | 'hybrid';
  semanticWeight?: number | null;
  keywordWeight?: number | null;

  // Phase 6: Reranking metrics
  isReranked?: boolean;
  rerankLatencyMs?: number;
  rerankedChunks?: number;
}

/**
 * Filters accepted by dashboard query methods.
 * All fields are optional — omitting them returns unfiltered results.
 */
export interface EvaluationFilters {
  from?: string;           // ISO date string (e.g. "2024-01-01")
  to?: string;             // ISO date string (e.g. "2024-12-31")
  documentId?: string;     // Filter to a specific document
  conversationId?: string; // Filter to a specific conversation
  retrievalMode?: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5: compare retrieval modes
  isReranked?: boolean;    // Added in Phase 6: filter by reranked vs non-reranked queries
}

/**
 * Shape of a single evaluation record returned in the "Recent" table.
 */
export interface EvaluationRecord {
  id: string;
  query: string;
  documentId: string | null;
  retrievalLatencyMs: number;
  llmLatencyMs: number;
  totalLatencyMs: number;
  chunksRetrieved: number;
  citationsCount: number;
  avgSimilarityScore: number;
  citationCoverage: number;
  hallucinationScore: number;
  answerCompleteness: number;
  retrievalPrecision: number;
  tokensEstimated: number;
  ollamaOnline: boolean;
  retrievalMode: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5: actual search algorithm
  semanticWeight: number | null;                     // Added in Phase 5
  keywordWeight: number | null;                      // Added in Phase 5
  isReranked: boolean;                               // Added in Phase 6
  rerankLatencyMs: number;                           // Added in Phase 6
  rerankedChunks: number;                            // Added in Phase 6
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimates token count from a text string.
 * Uses a simple word-count × 1.3 approximation (GPT-style tokenization proxy).
 * More accurate than character count for budgeting Ollama context windows.
 */
function estimateTokens(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(wordCount * 1.3);
}

/**
 * Computes the answer completeness heuristic.
 * Short answers (<50 words) receive a proportionally lower score.
 * Answers ≥50 words receive a score of 1.0 (considered complete).
 * This will be replaced by a semantic completeness model in a future phase.
 */
function computeCompleteness(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(1.0, wordCount / 50);
}

/**
 * Builds WHERE clause conditions based on optional filters.
 * Used by all query methods to apply consistent date/document/conversation scoping.
 */
function buildConditions(userId: string, filters: EvaluationFilters = {}) {
  const conditions = [eq(aiEvaluations.userId, userId)];

  if (filters.from) {
    conditions.push(gte(aiEvaluations.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    // Add 1 day to "to" so that "to = 2024-01-15" includes all records on that day
    const toDate = new Date(filters.to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(aiEvaluations.createdAt, toDate));
  }
  if (filters.documentId) {
    conditions.push(eq(aiEvaluations.documentId, filters.documentId));
  }
  if (filters.conversationId) {
    conditions.push(eq(aiEvaluations.conversationId, filters.conversationId));
  }
  if (filters.retrievalMode) {
    conditions.push(eq(aiEvaluations.retrievalMode, filters.retrievalMode));
  }
  if (filters.isReranked !== undefined) {
    conditions.push(eq(aiEvaluations.isReranked, filters.isReranked));
  }

  return conditions;
}

// ─────────────────────────────────────────────────────────────────────────────
// EvaluationService Class
// ─────────────────────────────────────────────────────────────────────────────

export class EvaluationService {

  /**
   * recordEvaluation()
   *
   * Called by ChatService at the END of askQuestion() after all RAG logic completes.
   * Computes derived quality metrics and writes one row to ai_evaluations.
   *
   * IMPORTANT: Wrapped in try/catch — if evaluation recording fails, it logs the
   * error but does NOT throw. This prevents evaluation bugs from breaking the
   * chat experience.
   *
   * Metrics computed here (not passed in):
   *   - citationCoverage  = citationsCount / chunksRetrieved
   *   - retrievalPrecision = avgSimilarityScore (proxy)
   *   - hallucinationScore = 1 - citationCoverage
   *   - answerCompleteness = min(1, wordCount / 50)
   *   - tokensEstimated    = wordCount × 1.3
   */
  static async recordEvaluation(input: EvaluationInput): Promise<void> {
    try {
      // Derived quality metrics (computed from raw inputs)
      const citationCoverage =
        input.chunksRetrieved > 0
          ? Math.min(1, input.citationsCount / input.chunksRetrieved)
          : 0;

      const retrievalPrecision = input.avgSimilarityScore; // proxy until ground truth exists

      // Hallucination score: uncited content is potential hallucination.
      // 0 = fully grounded, 1 = no citations used, maximum hallucination risk.
      const hallucinationScore = 1 - citationCoverage;

      const answerCompleteness = computeCompleteness(input.answerText);
      const tokensEstimated = estimateTokens(input.answerText);

      await db.insert(aiEvaluations).values({
        messageId: input.messageId,
        conversationId: input.conversationId,
        userId: input.userId,
        documentId: input.documentId || null,
        query: input.query,
        retrievalLatencyMs: input.retrievalLatencyMs,
        llmLatencyMs: input.llmLatencyMs,
        totalLatencyMs: input.totalLatencyMs,
        chunksRetrieved: input.chunksRetrieved,
        citationsCount: input.citationsCount,
        avgSimilarityScore: input.avgSimilarityScore,
        topSimilarityScore: input.topSimilarityScore,
        tokensEstimated,
        citationCoverage,
        retrievalPrecision,
        retrievalRecall: null, // placeholder until ground-truth dataset exists
        hallucinationScore,
        answerCompleteness,
        ollamaOnline: input.ollamaOnline,
        retrievalMode: input.retrievalMode,
        semanticWeight: input.semanticWeight || null,
        keywordWeight: input.keywordWeight || null,
        isReranked: input.isReranked || false,
        rerankLatencyMs: input.rerankLatencyMs || 0,
        rerankedChunks: input.rerankedChunks || 0,
      });
    } catch (err) {
      // Non-blocking: log and continue. Never let evaluation failures affect chat.
      console.error('[EvaluationService] Failed to record evaluation:', err);
    }
  }

  /**
   * getDashboardStats()
   *
   * Returns aggregated KPI metrics for the evaluation dashboard top section.
   * Also computes "current period" vs "overall average" for the benchmarking section.
   *
   * @param userId - scoped to the authenticated user only
   * @param filters - optional date range, document, conversation filters
   */
  static async getDashboardStats(userId: string, filters: EvaluationFilters = {}) {
    const conditions = buildConditions(userId, filters);

    // Aggregate all key metrics in one query using SQL aggregate functions
    const [stats] = await db
      .select({
        totalQuestions: sql<number>`count(*)`,
        avgRetrievalLatency: sql<number>`avg(${aiEvaluations.retrievalLatencyMs})`,
        avgLlmLatency: sql<number>`avg(${aiEvaluations.llmLatencyMs})`,
        avgTotalLatency: sql<number>`avg(${aiEvaluations.totalLatencyMs})`,
        avgCitationCoverage: sql<number>`avg(${aiEvaluations.citationCoverage})`,
        avgSimilarityScore: sql<number>`avg(${aiEvaluations.avgSimilarityScore})`,
        avgHallucinationScore: sql<number>`avg(${aiEvaluations.hallucinationScore})`,
        avgAnswerCompleteness: sql<number>`avg(${aiEvaluations.answerCompleteness})`,
        avgRetrievalPrecision: sql<number>`avg(${aiEvaluations.retrievalPrecision})`,
        avgCitationsCount: sql<number>`avg(${aiEvaluations.citationsCount})`,
        totalTokensEstimated: sql<number>`sum(${aiEvaluations.tokensEstimated})`,
        ollamaOnlineCount: sql<number>`sum(case when ${aiEvaluations.ollamaOnline} then 1 else 0 end)`,
      })
      .from(aiEvaluations)
      .where(and(...conditions));

    // Count of unique documents queried (only when not filtering by document)
    const [{ documentsQueried }] = await db
      .select({ documentsQueried: sql<number>`count(distinct ${aiEvaluations.documentId})` })
      .from(aiEvaluations)
      .where(and(...conditions));

    // ── Overall averages (no date filter) for benchmarking comparison ──
    const [overall] = await db
      .select({
        avgRetrievalLatency: sql<number>`avg(${aiEvaluations.retrievalLatencyMs})`,
        avgLlmLatency: sql<number>`avg(${aiEvaluations.llmLatencyMs})`,
        avgTotalLatency: sql<number>`avg(${aiEvaluations.totalLatencyMs})`,
        avgCitationCoverage: sql<number>`avg(${aiEvaluations.citationCoverage})`,
        avgSimilarityScore: sql<number>`avg(${aiEvaluations.avgSimilarityScore})`,
        avgHallucinationScore: sql<number>`avg(${aiEvaluations.hallucinationScore})`,
        avgAnswerCompleteness: sql<number>`avg(${aiEvaluations.answerCompleteness})`,
      })
      .from(aiEvaluations)
      .where(eq(aiEvaluations.userId, userId));

    const n = Number(stats.totalQuestions) || 0;
    const ollamaUptime = n > 0 ? (Number(stats.ollamaOnlineCount) / n) * 100 : 100;

    return {
      // KPI cards
      totalQuestions: n,
      avgRetrievalLatencyMs: Math.round(Number(stats.avgRetrievalLatency) || 0),
      avgLlmLatencyMs: Math.round(Number(stats.avgLlmLatency) || 0),
      avgTotalLatencyMs: Math.round(Number(stats.avgTotalLatency) || 0),
      avgCitationCoverage: Number((Number(stats.avgCitationCoverage) || 0).toFixed(3)),
      avgSimilarityScore: Number((Number(stats.avgSimilarityScore) || 0).toFixed(3)),
      avgHallucinationScore: Number((Number(stats.avgHallucinationScore) || 0).toFixed(3)),
      avgAnswerCompleteness: Number((Number(stats.avgAnswerCompleteness) || 0).toFixed(3)),
      avgRetrievalPrecision: Number((Number(stats.avgRetrievalPrecision) || 0).toFixed(3)),
      avgCitationsPerAnswer: Number((Number(stats.avgCitationsCount) || 0).toFixed(1)),
      totalTokensEstimated: Number(stats.totalTokensEstimated) || 0,
      documentsQueried: Number(documentsQueried) || 0,
      ollamaUptimePercent: Number(ollamaUptime.toFixed(1)),

      // Benchmarking: current-period vs overall for comparison cards
      benchmark: {
        overall: {
          avgRetrievalLatencyMs: Math.round(Number(overall.avgRetrievalLatency) || 0),
          avgLlmLatencyMs: Math.round(Number(overall.avgLlmLatency) || 0),
          avgTotalLatencyMs: Math.round(Number(overall.avgTotalLatency) || 0),
          avgCitationCoverage: Number((Number(overall.avgCitationCoverage) || 0).toFixed(3)),
          avgSimilarityScore: Number((Number(overall.avgSimilarityScore) || 0).toFixed(3)),
          avgHallucinationScore: Number((Number(overall.avgHallucinationScore) || 0).toFixed(3)),
          avgAnswerCompleteness: Number((Number(overall.avgAnswerCompleteness) || 0).toFixed(3)),
        },
      },
    };
  }

  /**
   * getDailyUsage()
   *
   * Returns per-day aggregated metrics for time-series charts.
   * Used for: "Questions per day", "Latency over time", "Citations over time".
   *
   * @param userId - scoped to the authenticated user
   * @param days - number of past days to include (default: 30)
   * @param filters - additional filters (document/conversation scope)
   */
  static async getDailyUsage(userId: string, days = 30, filters: EvaluationFilters = {}) {
    // Compute the start date (days ago from now)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conditions = [
      eq(aiEvaluations.userId, userId),
      gte(aiEvaluations.createdAt, startDate),
    ];

    if (filters.documentId) {
      conditions.push(eq(aiEvaluations.documentId, filters.documentId));
    }
    if (filters.conversationId) {
      conditions.push(eq(aiEvaluations.conversationId, filters.conversationId));
    }

    // Group by calendar day using PostgreSQL date_trunc
    const rows = await db
      .select({
        date: sql<string>`date_trunc('day', ${aiEvaluations.createdAt})::date`,
        questions: sql<number>`count(*)`,
        avgRetrievalLatency: sql<number>`round(avg(${aiEvaluations.retrievalLatencyMs}))`,
        avgLlmLatency: sql<number>`round(avg(${aiEvaluations.llmLatencyMs}))`,
        avgTotalLatency: sql<number>`round(avg(${aiEvaluations.totalLatencyMs}))`,
        avgCitationCoverage: sql<number>`round(avg(${aiEvaluations.citationCoverage})::numeric, 3)`,
        avgSimilarity: sql<number>`round(avg(${aiEvaluations.avgSimilarityScore})::numeric, 3)`,
        totalCitations: sql<number>`sum(${aiEvaluations.citationsCount})`,
      })
      .from(aiEvaluations)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('day', ${aiEvaluations.createdAt})::date`)
      .orderBy(sql`date_trunc('day', ${aiEvaluations.createdAt})::date`);

    return rows.map((r) => ({
      date: r.date,
      questions: Number(r.questions),
      avgRetrievalLatency: Number(r.avgRetrievalLatency) || 0,
      avgLlmLatency: Number(r.avgLlmLatency) || 0,
      avgTotalLatency: Number(r.avgTotalLatency) || 0,
      avgCitationCoverage: Number(r.avgCitationCoverage) || 0,
      avgSimilarity: Number(r.avgSimilarity) || 0,
      totalCitations: Number(r.totalCitations) || 0,
    }));
  }

  /**
   * getMostSearchedDocuments()
   *
   * Returns the most queried documents ranked by question count.
   * Joins to the documents table to resolve readable names.
   * Used for the "Most Queried Documents" chart.
   *
   * @param userId - scoped to the authenticated user
   * @param limit  - max number of documents to return (default: 10)
   * @param filters - date range filter
   */
  static async getMostSearchedDocuments(userId: string, limit = 10, filters: EvaluationFilters = {}) {
    const conditions = buildConditions(userId, filters);

    const rows = await db
      .select({
        documentId: aiEvaluations.documentId,
        documentName: documents.originalName,
        queryCount: sql<number>`count(*)`,
        avgSimilarity: sql<number>`round(avg(${aiEvaluations.avgSimilarityScore})::numeric, 3)`,
        avgLatency: sql<number>`round(avg(${aiEvaluations.totalLatencyMs}))`,
      })
      .from(aiEvaluations)
      .leftJoin(documents, eq(aiEvaluations.documentId, documents.id))
      .where(and(...conditions))
      .groupBy(aiEvaluations.documentId, documents.originalName)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((r) => ({
      documentId: r.documentId,
      documentName: r.documentName || 'All Documents',
      queryCount: Number(r.queryCount),
      avgSimilarity: Number(r.avgSimilarity) || 0,
      avgLatency: Number(r.avgLatency) || 0,
    }));
  }

  /**
   * getSimilarityDistribution()
   *
   * Buckets similarity scores into ranges for histogram visualization.
   * Used for the "Similarity Score Distribution" chart.
   *
   * Buckets: [0-0.5), [0.5-0.6), [0.6-0.7), [0.7-0.8), [0.8-0.9), [0.9-1.0]
   */
  static async getSimilarityDistribution(userId: string, filters: EvaluationFilters = {}) {
    const conditions = buildConditions(userId, filters);

    const [result] = await db
      .select({
        bucket0_50: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} < 0.5)`,
        bucket50_60: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} >= 0.5 and ${aiEvaluations.avgSimilarityScore} < 0.6)`,
        bucket60_70: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} >= 0.6 and ${aiEvaluations.avgSimilarityScore} < 0.7)`,
        bucket70_80: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} >= 0.7 and ${aiEvaluations.avgSimilarityScore} < 0.8)`,
        bucket80_90: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} >= 0.8 and ${aiEvaluations.avgSimilarityScore} < 0.9)`,
        bucket90_100: sql<number>`count(*) filter (where ${aiEvaluations.avgSimilarityScore} >= 0.9)`,
      })
      .from(aiEvaluations)
      .where(and(...conditions));

    return [
      { range: '< 0.50', count: Number(result.bucket0_50) },
      { range: '0.50–0.60', count: Number(result.bucket50_60) },
      { range: '0.60–0.70', count: Number(result.bucket60_70) },
      { range: '0.70–0.80', count: Number(result.bucket70_80) },
      { range: '0.80–0.90', count: Number(result.bucket80_90) },
      { range: '≥ 0.90', count: Number(result.bucket90_100) },
    ];
  }

  /**
   * getCitationDistribution()
   *
   * Counts how many answers had 0, 1, 2, 3, 4, 5+ citations.
   * Used for the "Citation Count Distribution" chart.
   */
  static async getCitationDistribution(userId: string, filters: EvaluationFilters = {}) {
    const conditions = buildConditions(userId, filters);

    const rows = await db
      .select({
        citationBucket: sql<number>`least(${aiEvaluations.citationsCount}, 5)`,
        count: sql<number>`count(*)`,
      })
      .from(aiEvaluations)
      .where(and(...conditions))
      .groupBy(sql`least(${aiEvaluations.citationsCount}, 5)`)
      .orderBy(sql`least(${aiEvaluations.citationsCount}, 5)`);

    // Normalize to labeled buckets 0–5+
    const labelMap: Record<number, string> = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5+' };
    return rows.map((r) => ({
      citations: labelMap[Number(r.citationBucket)] ?? '5+',
      count: Number(r.count),
    }));
  }

  /**
   * getRecentEvaluations()
   *
   * Returns the most recent evaluation records (paginated) for the raw data table.
   * Allows filtering by date, document, and conversation.
   *
   * @param userId  - scoped to the authenticated user
   * @param limit   - max records per page (default: 20)
   * @param offset  - pagination offset (default: 0)
   * @param filters - optional filters
   */
  static async getRecentEvaluations(
    userId: string,
    limit = 20,
    offset = 0,
    filters: EvaluationFilters = {}
  ): Promise<EvaluationRecord[]> {
    const conditions = buildConditions(userId, filters);

    const rows = await db
      .select({
        id: aiEvaluations.id,
        query: aiEvaluations.query,
        documentId: aiEvaluations.documentId,
        retrievalLatencyMs: aiEvaluations.retrievalLatencyMs,
        llmLatencyMs: aiEvaluations.llmLatencyMs,
        totalLatencyMs: aiEvaluations.totalLatencyMs,
        chunksRetrieved: aiEvaluations.chunksRetrieved,
        citationsCount: aiEvaluations.citationsCount,
        avgSimilarityScore: aiEvaluations.avgSimilarityScore,
        citationCoverage: aiEvaluations.citationCoverage,
        hallucinationScore: aiEvaluations.hallucinationScore,
        answerCompleteness: aiEvaluations.answerCompleteness,
        retrievalPrecision: aiEvaluations.retrievalPrecision,
        tokensEstimated: aiEvaluations.tokensEstimated,
        ollamaOnline: aiEvaluations.ollamaOnline,
        retrievalMode: aiEvaluations.retrievalMode,
        semanticWeight: aiEvaluations.semanticWeight,
        keywordWeight: aiEvaluations.keywordWeight,
        isReranked: aiEvaluations.isReranked,
        rerankLatencyMs: aiEvaluations.rerankLatencyMs,
        rerankedChunks: aiEvaluations.rerankedChunks,
        createdAt: aiEvaluations.createdAt,
      })
      .from(aiEvaluations)
      .where(and(...conditions))
      .orderBy(desc(aiEvaluations.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      query: r.query,
      documentId: r.documentId ?? null,
      retrievalLatencyMs: r.retrievalLatencyMs,
      llmLatencyMs: r.llmLatencyMs,
      totalLatencyMs: r.totalLatencyMs,
      chunksRetrieved: r.chunksRetrieved,
      citationsCount: r.citationsCount,
      avgSimilarityScore: r.avgSimilarityScore,
      citationCoverage: r.citationCoverage,
      hallucinationScore: r.hallucinationScore,
      answerCompleteness: r.answerCompleteness,
      retrievalPrecision: r.retrievalPrecision,
      tokensEstimated: r.tokensEstimated,
      ollamaOnline: r.ollamaOnline,
      retrievalMode: r.retrievalMode as 'semantic' | 'keyword' | 'hybrid',
      semanticWeight: r.semanticWeight,
      keywordWeight: r.keywordWeight,
      isReranked: r.isReranked,
      rerankLatencyMs: r.rerankLatencyMs,
      rerankedChunks: r.rerankedChunks,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * exportEvaluations()
   *
   * Fetches all evaluation records for the user (up to 5000) and formats
   * them as either JSON or CSV for download.
   *
   * @param userId  - scoped to the authenticated user
   * @param format  - 'json' | 'csv'
   * @param filters - optional filters to scope the export
   */
  static async exportEvaluations(
    userId: string,
    format: 'json' | 'csv' = 'json',
    filters: EvaluationFilters = {}
  ): Promise<string> {
    const records = await this.getRecentEvaluations(userId, 5000, 0, filters);

    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }

    // ── CSV Export ──────────────────────────────────────────────────────────
    if (records.length === 0) return 'No data available';

    // Build header row from the keys of the first record
    const headers = Object.keys(records[0]) as (keyof EvaluationRecord)[];
    const csvHeader = headers.join(',');

    // Build data rows — escape commas and quotes in query text
    const csvRows = records.map((r) =>
      headers
        .map((h) => {
          const val = r[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(',')
    );

    return [csvHeader, ...csvRows].join('\n');
  }

  /**
   * getBenchmarkHistory()
   *
   * Queries and aggregates latency and citation coverage statistics comparing
   * runs with reranking enabled against runs without reranking.
   */
  static async getBenchmarkHistory(userId: string) {
    // 1. Averages for reranked runs
    const [rerankStats] = await db
      .select({
        avgTotalLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.totalLatencyMs}), 0)`,
        avgRetrievalLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.retrievalLatencyMs}), 0)`,
        avgRerankLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.rerankLatencyMs}), 0)`,
        avgLlmLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.llmLatencyMs}), 0)`,
        avgCitationCoverage: sql<number>`COALESCE(avg(${aiEvaluations.citationCoverage}), 0)`,
        avgSimilarityScore: sql<number>`COALESCE(avg(${aiEvaluations.avgSimilarityScore}), 0)`,
        totalQuestions: sql<number>`count(*)`,
      })
      .from(aiEvaluations)
      .where(and(eq(aiEvaluations.userId, userId), eq(aiEvaluations.isReranked, true)));

    // 2. Averages for non-reranked runs
    const [noRerankStats] = await db
      .select({
        avgTotalLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.totalLatencyMs}), 0)`,
        avgRetrievalLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.retrievalLatencyMs}), 0)`,
        avgRerankLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.rerankLatencyMs}), 0)`,
        avgLlmLatencyMs: sql<number>`COALESCE(avg(${aiEvaluations.llmLatencyMs}), 0)`,
        avgCitationCoverage: sql<number>`COALESCE(avg(${aiEvaluations.citationCoverage}), 0)`,
        avgSimilarityScore: sql<number>`COALESCE(avg(${aiEvaluations.avgSimilarityScore}), 0)`,
        totalQuestions: sql<number>`count(*)`,
      })
      .from(aiEvaluations)
      .where(and(eq(aiEvaluations.userId, userId), eq(aiEvaluations.isReranked, false)));

    return {
      withRerank: {
        avgTotalLatencyMs: Math.round(Number(rerankStats?.avgTotalLatencyMs || 0)),
        avgRetrievalLatencyMs: Math.round(Number(rerankStats?.avgRetrievalLatencyMs || 0)),
        avgRerankLatencyMs: Math.round(Number(rerankStats?.avgRerankLatencyMs || 0)),
        avgLlmLatencyMs: Math.round(Number(rerankStats?.avgLlmLatencyMs || 0)),
        avgCitationCoverage: Number(rerankStats?.avgCitationCoverage || 0),
        avgSimilarityScore: Number(rerankStats?.avgSimilarityScore || 0),
        totalQuestions: Number(rerankStats?.totalQuestions || 0),
      },
      withoutRerank: {
        avgTotalLatencyMs: Math.round(Number(noRerankStats?.avgTotalLatencyMs || 0)),
        avgRetrievalLatencyMs: Math.round(Number(noRerankStats?.avgRetrievalLatencyMs || 0)),
        avgRerankLatencyMs: Math.round(Number(noRerankStats?.avgRerankLatencyMs || 0)),
        avgLlmLatencyMs: Math.round(Number(noRerankStats?.avgLlmLatencyMs || 0)),
        avgCitationCoverage: Number(noRerankStats?.avgCitationCoverage || 0),
        avgSimilarityScore: Number(noRerankStats?.avgSimilarityScore || 0),
        totalQuestions: Number(noRerankStats?.totalQuestions || 0),
      },
    };
  }

  /**
   * runQueryBenchmark()
   *
   * Runs the exact same query through Semantic-only, Hybrid, and Hybrid + Reranker pipeline stages,
   * measuring latencies and score qualities side-by-side.
   */
  static async runQueryBenchmark(userId: string, query: string, documentId?: string) {
    const scopeDocIds = documentId ? [documentId] : [];
    
    // 1. Run Semantic Only
    const semStart = Date.now();
    const semVector = await new OllamaEmbeddingProvider().generateEmbedding(query);
    const semResults = await new RetrievalProvider(new VectorStoreProvider()).retrieveChunks(
      semVector,
      scopeDocIds,
      5,
      { mode: 'semantic', userId }
    );
    const semLatency = Date.now() - semStart;

    // 2. Run Hybrid Only (Weights: 0.5 semantic, 0.5 keyword)
    const hybStart = Date.now();
    const hybVector = await new OllamaEmbeddingProvider().generateEmbedding(query);
    const hybResults = await new RetrievalProvider(new VectorStoreProvider()).retrieveChunks(
      hybVector,
      scopeDocIds,
      5,
      {
        mode: 'hybrid',
        queryText: query,
        userId,
        semanticWeight: Number(process.env.HYBRID_SEMANTIC_WEIGHT || 0.5),
        keywordWeight: Number(process.env.HYBRID_KEYWORD_WEIGHT || 0.5),
      }
    );
    const hybLatency = Date.now() - hybStart;

    // 3. Run Hybrid + Reranker
    const rerankStart = Date.now();
    const rerankVector = await new OllamaEmbeddingProvider().generateEmbedding(query);
    let rerankResults = await new RetrievalProvider(new VectorStoreProvider()).retrieveChunks(
      rerankVector,
      scopeDocIds,
      20, // Retrieve top 20 candidates
      {
        mode: 'hybrid',
        queryText: query,
        userId,
        semanticWeight: Number(process.env.HYBRID_SEMANTIC_WEIGHT || 0.5),
        keywordWeight: Number(process.env.HYBRID_KEYWORD_WEIGHT || 0.5),
      }
    );
    const preRerankLatency = Date.now() - rerankStart;
    
    const crossStart = Date.now();
    rerankResults = await RerankerService.rerank(query, rerankResults);
    rerankResults = rerankResults.slice(0, 5); // Keep top 5
    const crossLatency = Date.now() - crossStart;
    
    const totalRerankLatency = preRerankLatency + crossLatency;

    return {
      query,
      semantic: {
        latencyMs: semLatency,
        topScore: semResults.length > 0 ? semResults[0].score : 0,
        avgScore: semResults.length > 0 ? semResults.reduce((sum, r) => sum + r.score, 0) / semResults.length : 0,
        results: semResults.map((r, i) => ({
          content: r.chunk.content,
          score: r.score,
          documentName: (r.chunk as any).documentName || 'Document',
          pageNumber: r.chunk.pageNumber,
          rank: i + 1,
        })),
      },
      hybrid: {
        latencyMs: hybLatency,
        topScore: hybResults.length > 0 ? hybResults[0].score : 0,
        avgScore: hybResults.length > 0 ? hybResults.reduce((sum, r) => sum + r.score, 0) / hybResults.length : 0,
        results: hybResults.map((r, i) => ({
          content: r.chunk.content,
          score: r.score,
          documentName: (r.chunk as any).documentName || 'Document',
          pageNumber: r.chunk.pageNumber,
          rank: i + 1,
        })),
      },
      hybridRerank: {
        latencyMs: totalRerankLatency,
        retrievalLatencyMs: preRerankLatency,
        rerankLatencyMs: crossLatency,
        topScore: rerankResults.length > 0 ? rerankResults[0].score : 0,
        avgScore: rerankResults.length > 0 ? rerankResults.reduce((sum, r) => sum + r.score, 0) / rerankResults.length : 0,
        topRerankScore: rerankResults.length > 0 ? rerankResults[0].rerankScore || 0 : 0,
        avgRerankScore: rerankResults.length > 0 ? rerankResults.reduce((sum, r) => sum + (r.rerankScore || 0), 0) / rerankResults.length : 0,
        results: rerankResults.map((r, i) => ({
          content: r.chunk.content,
          score: r.score,
          documentName: (r.chunk as any).documentName || 'Document',
          pageNumber: r.chunk.pageNumber,
          originalRank: r.originalRank,
          newRank: r.newRank,
          rerankScore: r.rerankScore,
          rank: i + 1,
        })),
      },
    };
  }
}
