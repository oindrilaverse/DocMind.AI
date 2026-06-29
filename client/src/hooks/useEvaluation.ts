/**
 * useEvaluation.ts — Phase 4: AI Evaluation Dashboard
 *
 * PURPOSE:
 *   React Query hooks that fetch evaluation data from the backend.
 *   All hooks are scoped to the authenticated user and support optional filtering.
 *
 * HOW IT CONNECTS TO THE RAG PIPELINE:
 *   User asks a question in ChatInterface
 *     → ChatService records evaluation metrics (backend)
 *       → EvaluationService writes to ai_evaluations table
 *         → These hooks read and present that data on EvaluationDashboardPage
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared filter type — passed to all hooks that support filtering
// ─────────────────────────────────────────────────────────────────────────────
export interface EvalFilters {
  from?: string;            // ISO date string (e.g. "2024-01-01")
  to?: string;              // ISO date string (e.g. "2024-12-31")
  documentId?: string;      // UUID of a specific document
  conversationId?: string;  // UUID of a specific conversation
  retrievalMode?: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5
  isReranked?: boolean;     // Added in Phase 6
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Types (mirror the backend EvaluationService return shapes)
// ─────────────────────────────────────────────────────────────────────────────

/** Overall benchmarks for comparison (current period vs all-time) */
export interface BenchmarkOverall {
  avgRetrievalLatencyMs: number;
  avgLlmLatencyMs: number;
  avgTotalLatencyMs: number;
  avgCitationCoverage: number;
  avgSimilarityScore: number;
  avgHallucinationScore: number;
  avgAnswerCompleteness: number;
}

/** Aggregated KPI stats returned by /evaluation/dashboard */
export interface EvalDashboardStats {
  totalQuestions: number;
  avgRetrievalLatencyMs: number;
  avgLlmLatencyMs: number;
  avgTotalLatencyMs: number;
  avgCitationCoverage: number;
  avgSimilarityScore: number;
  avgHallucinationScore: number;
  avgAnswerCompleteness: number;
  avgRetrievalPrecision: number;
  avgCitationsPerAnswer: number;
  totalTokensEstimated: number;
  documentsQueried: number;
  ollamaUptimePercent: number;
  benchmark: { overall: BenchmarkOverall };
}

/** Per-day aggregated data point for time-series charts */
export interface EvalDailyPoint {
  date: string;
  questions: number;
  avgRetrievalLatency: number;
  avgLlmLatency: number;
  avgTotalLatency: number;
  avgCitationCoverage: number;
  avgSimilarity: number;
  totalCitations: number;
}

/** Most-queried document entry */
export interface EvalDocument {
  documentId: string | null;
  documentName: string;
  queryCount: number;
  avgSimilarity: number;
  avgLatency: number;
}

/** Similarity histogram bucket */
export interface SimilarityBucket {
  range: string;
  count: number;
}

/** Citation distribution bucket */
export interface CitationBucket {
  citations: string;
  count: number;
}

/** Single raw evaluation record (shown in the recent table) */
export interface EvalRecord {
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
  retrievalMode: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5
  semanticWeight: number | null;                     // Added in Phase 5
  keywordWeight: number | null;                      // Added in Phase 5
  isReranked: boolean;                               // Added in Phase 6
  rerankLatencyMs: number;                           // Added in Phase 6
  rerankedChunks: number;                            // Added in Phase 6
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert a filters object to URLSearchParams string
// ─────────────────────────────────────────────────────────────────────────────
function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== '') p.set(key, String(val));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useEvalDashboard()
 * Fetches aggregated KPI stats and benchmarking data.
 * Re-fetches automatically when filters change.
 */
export function useEvalDashboard(filters: EvalFilters = {}) {
  const qs = toQueryString(filters as Record<string, any>);
  return useQuery<EvalDashboardStats>({
    queryKey: ['evaluation', 'dashboard', filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/dashboard${qs}`);
      return res.data;
    },
    // Refresh dashboard stats every 60 seconds while the page is open
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/**
 * useEvalDaily()
 * Fetches per-day time-series data for charts.
 * @param days  number of past days to include (7, 14, 30, 90)
 * @param filters  document/conversation scope filters
 */
export function useEvalDaily(days = 30, filters: EvalFilters = {}) {
  const qs = toQueryString({ days, ...filters } as Record<string, any>);
  return useQuery<EvalDailyPoint[]>({
    queryKey: ['evaluation', 'daily', days, filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/daily${qs}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * useEvalDocuments()
 * Fetches the most-queried documents ranking.
 */
export function useEvalDocuments(limit = 10, filters: EvalFilters = {}) {
  const qs = toQueryString({ limit, ...filters } as Record<string, any>);
  return useQuery<EvalDocument[]>({
    queryKey: ['evaluation', 'documents', limit, filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/documents${qs}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * useEvalSimilarity()
 * Fetches similarity score histogram data.
 */
export function useEvalSimilarity(filters: EvalFilters = {}) {
  const qs = toQueryString(filters as Record<string, any>);
  return useQuery<SimilarityBucket[]>({
    queryKey: ['evaluation', 'similarity', filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/similarity${qs}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * useEvalCitations()
 * Fetches citation count distribution data.
 */
export function useEvalCitations(filters: EvalFilters = {}) {
  const qs = toQueryString(filters as Record<string, any>);
  return useQuery<CitationBucket[]>({
    queryKey: ['evaluation', 'citations', filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/citations${qs}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * useEvalRecent()
 * Fetches recent evaluation records for the raw data table.
 */
export function useEvalRecent(limit = 20, offset = 0, filters: EvalFilters = {}) {
  const qs = toQueryString({ limit, offset, ...filters } as Record<string, any>);
  return useQuery<EvalRecord[]>({
    queryKey: ['evaluation', 'recent', limit, offset, filters],
    queryFn: async () => {
      const res = await api.get(`/evaluation/recent${qs}`);
      return res.data;
    },
    staleTime: 15_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: Benchmark Types & Hooks
// ─────────────────────────────────────────────────────────────────────────────

export interface BenchmarkHistoryData {
  withRerank: {
    avgTotalLatencyMs: number;
    avgRetrievalLatencyMs: number;
    avgRerankLatencyMs: number;
    avgLlmLatencyMs: number;
    avgCitationCoverage: number;
    avgSimilarityScore: number;
    totalQuestions: number;
  };
  withoutRerank: {
    avgTotalLatencyMs: number;
    avgRetrievalLatencyMs: number;
    avgRerankLatencyMs: number;
    avgLlmLatencyMs: number;
    avgCitationCoverage: number;
    avgSimilarityScore: number;
    totalQuestions: number;
  };
}

export interface BenchmarkRunResult {
  query: string;
  semantic: {
    latencyMs: number;
    topScore: number;
    avgScore: number;
    results: Array<{ content: string; score: number; documentName: string; pageNumber: number | null; rank: number }>;
  };
  hybrid: {
    latencyMs: number;
    topScore: number;
    avgScore: number;
    results: Array<{ content: string; score: number; documentName: string; pageNumber: number | null; rank: number }>;
  };
  hybridRerank: {
    latencyMs: number;
    retrievalLatencyMs: number;
    rerankLatencyMs: number;
    topScore: number;
    avgScore: number;
    topRerankScore: number;
    avgRerankScore: number;
    results: Array<{
      content: string;
      score: number;
      documentName: string;
      pageNumber: number | null;
      originalRank: number;
      newRank: number;
      rerankScore: number;
      rank: number;
    }>;
  };
}

/**
 * useEvalBenchmarkHistory()
 * Fetches aggregated metrics comparing Reranked vs Non-Reranked queries.
 */
export function useEvalBenchmarkHistory() {
  return useQuery<BenchmarkHistoryData>({
    queryKey: ['evaluation', 'benchmark', 'history'],
    queryFn: async () => {
      const res = await api.get('/evaluation/benchmark/history');
      return res.data;
    },
    staleTime: 30_000,
  });
}

/**
 * useRunBenchmarkMutation()
 * Triggers a side-by-side RAG benchmark run for a specific query text.
 */
export function useRunBenchmarkMutation() {
  return useMutation<BenchmarkRunResult, Error, { query: string; documentId?: string }>({
    mutationFn: async ({ query, documentId }) => {
      const res = await api.post('/evaluation/benchmark/run', { query, documentId });
      return res.data;
    },
  });
}
