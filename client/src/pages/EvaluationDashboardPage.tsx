/**
 * EvaluationDashboardPage.tsx — Phase 4: AI Evaluation Dashboard
 *
 * PURPOSE:
 *   The main AI Evaluation Dashboard page at route /evaluation.
 *   Visualizes every quality and performance metric captured after each RAG answer.
 *
 * WHAT IT DISPLAYS:
 *   1. Architecture pipeline diagram (Question → Retrieval → LLM → Evaluation → Dashboard)
 *   2. Filter bar (date range, document, conversation)
 *   3. KPI Overview cards (8 benchmark metrics)
 *   4. Benchmarking section (current period vs overall average)
 *   5. Charts:
 *      - Questions per day (BarChart)
 *      - Retrieval latency over time (AreaChart)
 *      - LLM latency over time (AreaChart)
 *      - Citation count distribution (BarChart)
 *      - Most queried documents (horizontal BarChart)
 *      - Similarity score distribution (BarChart)
 *   6. Recent evaluations raw data table
 *   7. Export buttons (CSV / JSON)
 *
 * HOW IT CONNECTS TO THE PIPELINE:
 *   Every question asked in /chat triggers:
 *     ChatService.askQuestion() → EvaluationService.recordEvaluation()
 *   This page reads those records via the evaluation API hooks.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts';
import {
  Brain, ArrowLeft, Download, RefreshCw, Clock, Zap, Target,
  Shield, CheckCircle, MessageSquare, FileText, Activity,
  BarChart2, Database, TrendingUp, Cpu, AlertTriangle, GitBranch
} from 'lucide-react';

import { MetricCard } from '../components/evaluation/MetricCard';
import { EvalFilters } from '../components/evaluation/EvalFilters';
import {
  useEvalDashboard, useEvalDaily, useEvalDocuments,
  useEvalSimilarity, useEvalCitations, useEvalRecent,
  EvalFilters as EvalFiltersType,
} from '../hooks/useEvaluation';
import { useDocuments } from '../hooks/useDocuments';
import { useChat } from '../hooks/useChat';
import { api } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Architecture Diagram — static SVG-based visual
// Shows the flow: Question → Retrieval → LLM → Evaluation → Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const PipelineDiagram: React.FC = () => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 mb-6">
    <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
      <Activity className="w-4 h-4 text-violet-400" />
      Evaluation Pipeline Architecture
    </h3>
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-mono">
      {[
        { label: 'User Question', color: 'bg-violet-600/30 border-violet-500/50 text-violet-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: 'Query Embedding\n(nomic-embed-text)', color: 'bg-blue-600/30 border-blue-500/50 text-blue-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: 'pgvector Retrieval\n(cosine search)', color: 'bg-cyan-600/30 border-cyan-500/50 text-cyan-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: 'Context Builder\n(top-5 chunks)', color: 'bg-teal-600/30 border-teal-500/50 text-teal-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: 'Ollama LLM\n(llama3.2)', color: 'bg-green-600/30 border-green-500/50 text-green-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: 'Citation Engine\n(validation)', color: 'bg-yellow-600/30 border-yellow-500/50 text-yellow-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: '📊 EvaluationService\n(metrics recorded)', color: 'bg-orange-600/30 border-orange-500/50 text-orange-300' },
        { label: '↓', color: 'text-slate-500', isArrow: true },
        { label: '🎛️ This Dashboard', color: 'bg-rose-600/30 border-rose-500/50 text-rose-300' },
      ].map((step, i) =>
        step.isArrow ? (
          <span key={i} className={`text-lg ${step.color}`}>{step.label}</span>
        ) : (
          <div
            key={i}
            className={`border rounded-lg px-3 py-2 text-center leading-tight whitespace-pre-line ${step.color}`}
          >
            {step.label}
          </div>
        )
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Custom Recharts tooltip style
// ─────────────────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart wrapper with consistent title, subtitle, and loading state
// ─────────────────────────────────────────────────────────────────────────────
const ChartCard: React.FC<{ title: string; subtitle?: string; isLoading?: boolean; children: React.ReactNode }> = ({
  title, subtitle, isLoading, children,
}) => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mb-4">{subtitle}</p>}
    {isLoading ? (
      <div className="h-48 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
      </div>
    ) : (
      children
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Empty state shown when no evaluations have been recorded yet
// ─────────────────────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ onNavigateToChat: () => void }> = ({ onNavigateToChat }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4">
      <BarChart2 className="w-8 h-8 text-violet-400" />
    </div>
    <h2 className="text-xl font-bold text-white mb-2">No Evaluation Data Yet</h2>
    <p className="text-slate-400 max-w-sm mb-6 text-sm">
      Evaluation metrics are recorded automatically every time you ask a question in the AI Chat.
      Ask your first question to populate this dashboard.
    </p>
    <button
      onClick={onNavigateToChat}
      className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl text-sm transition-colors"
    >
      Go to AI Chat →
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────
export const EvaluationDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Active filters state — shared across all hooks
  const [filters, setFilters] = useState<{ from: string; to: string; documentId: string; conversationId: string; retrievalMode: string }>({
    from: '', to: '', documentId: '', conversationId: '', retrievalMode: '',
  });

  // Days range for time-series charts (7, 14, 30, 90)
  const [chartDays, setChartDays] = useState(30);

  // Pagination state for recent table
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 15;

  // Build EvalFilters object (strip empty strings)
  const activeFilters: EvalFiltersType = {
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(filters.documentId && { documentId: filters.documentId }),
    ...(filters.conversationId && { conversationId: filters.conversationId }),
    ...(filters.retrievalMode && { retrievalMode: filters.retrievalMode as any }),
  };

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useEvalDashboard(activeFilters);
  const { data: daily, isLoading: dailyLoading } = useEvalDaily(chartDays, activeFilters);
  const { data: topDocs, isLoading: docsLoading } = useEvalDocuments(10, activeFilters);
  const { data: simDist, isLoading: simLoading } = useEvalSimilarity(activeFilters);
  const { data: citDist, isLoading: citLoading } = useEvalCitations(activeFilters);
  const { data: recent, isLoading: recentLoading } = useEvalRecent(PAGE_SIZE, page * PAGE_SIZE, activeFilters);

  // For filter dropdowns
  const { documents } = useDocuments();
  const { useHistory } = useChat();
  const { data: historyData } = useHistory();
  const conversations = historyData?.map((c) => ({ id: c.id, title: c.title })) ?? [];

  const hasData = (stats?.totalQuestions ?? 0) > 0;

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const qs = new URLSearchParams({ format, ...Object.fromEntries(Object.entries(activeFilters).filter(([, v]) => v)) });
      const response = await api.get(`/evaluation/export?${qs.toString()}`, { responseType: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `docmind-evaluations-${timestamp}.${format}`;
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Export] Failed:', err);
    }
  }, [activeFilters]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmt = (n: number) => n.toLocaleString();
  const fmtMs = (n: number) => `${n.toLocaleString()}`;
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const benchmarkStats = stats?.benchmark?.overall;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
            <span className="text-slate-600">›</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-violet-400" />
              </div>
              <span className="font-semibold text-sm">AI Evaluation Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/benchmark')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs rounded-lg transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Benchmark Playground
            </button>
            {/* Export buttons */}
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-slate-300 text-xs rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-slate-300 text-xs rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={() => refetchStats()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ── Pipeline Diagram ─────────────────────────────────────────────── */}
        <PipelineDiagram />

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <EvalFilters
          filters={filters}
          onFilterChange={setFilters}
          documents={documents}
          conversations={conversations}
          isLoading={statsLoading}
        />

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!statsLoading && !hasData ? (
          <EmptyState onNavigateToChat={() => navigate('/chat')} />
        ) : (
          <>
            {/* ── KPI Overview Cards ────────────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                Overview Metrics
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <MetricCard
                  label="Total Questions"
                  value={statsLoading ? '—' : fmt(stats?.totalQuestions ?? 0)}
                  icon={MessageSquare}
                  iconColor="bg-violet-500"
                  tooltip="Total number of AI questions asked through the chat interface during the selected period."
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Avg Retrieval Latency"
                  value={statsLoading ? '—' : fmtMs(stats?.avgRetrievalLatencyMs ?? 0)}
                  unit="ms"
                  icon={Database}
                  iconColor="bg-blue-500"
                  tooltip="Average time (milliseconds) to embed the query and retrieve matching chunks from pgvector. Lower is better."
                  benchmark={benchmarkStats?.avgRetrievalLatencyMs}
                  lowerIsBetter
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Avg LLM Latency"
                  value={statsLoading ? '—' : fmtMs(stats?.avgLlmLatencyMs ?? 0)}
                  unit="ms"
                  icon={Cpu}
                  iconColor="bg-cyan-500"
                  tooltip="Average time (milliseconds) Ollama takes to generate the answer once the prompt is sent. Depends on hardware and model size."
                  benchmark={benchmarkStats?.avgLlmLatencyMs}
                  lowerIsBetter
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Avg Total Response"
                  value={statsLoading ? '—' : fmtMs(stats?.avgTotalLatencyMs ?? 0)}
                  unit="ms"
                  icon={Clock}
                  iconColor="bg-teal-500"
                  tooltip="Average end-to-end time from user question to receiving the complete answer. Sum of retrieval + LLM latency."
                  benchmark={benchmarkStats?.avgTotalLatencyMs}
                  lowerIsBetter
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Citation Coverage"
                  value={statsLoading ? '—' : fmtPct(stats?.avgCitationCoverage ?? 0)}
                  icon={CheckCircle}
                  iconColor="bg-green-500"
                  tooltip="citations ÷ chunks_retrieved. How much of the retrieved context the LLM actually cited. Higher = better context utilization."
                  benchmark={benchmarkStats?.avgCitationCoverage}
                  isScore
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Avg Similarity Score"
                  value={statsLoading ? '—' : fmtPct(stats?.avgSimilarityScore ?? 0)}
                  icon={Target}
                  iconColor="bg-yellow-500"
                  tooltip="Average cosine similarity between the query embedding and retrieved chunk embeddings. Higher = more relevant context."
                  benchmark={benchmarkStats?.avgSimilarityScore}
                  isScore
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Hallucination Score"
                  value={statsLoading ? '—' : fmtPct(stats?.avgHallucinationScore ?? 0)}
                  icon={AlertTriangle}
                  iconColor="bg-orange-500"
                  tooltip="1 - citation_coverage (rule-based proxy). 0% = fully grounded, 100% = no citations used. Lower is better."
                  benchmark={benchmarkStats?.avgHallucinationScore}
                  lowerIsBetter
                  isScore
                  isLoading={statsLoading}
                />
                <MetricCard
                  label="Answer Completeness"
                  value={statsLoading ? '—' : fmtPct(stats?.avgAnswerCompleteness ?? 0)}
                  icon={Shield}
                  iconColor="bg-rose-500"
                  tooltip="min(1, word_count ÷ 50) heuristic. Answers under 50 words score lower. 100% = answer is at least 50 words long."
                  benchmark={benchmarkStats?.avgAnswerCompleteness}
                  isScore
                  isLoading={statsLoading}
                />
              </div>
            </div>

            {/* ── Secondary Metrics ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Docs Queried"
                value={statsLoading ? '—' : fmt(stats?.documentsQueried ?? 0)}
                icon={FileText}
                iconColor="bg-indigo-500"
                tooltip="Number of unique documents that were queried in the selected period."
                isLoading={statsLoading}
              />
              <MetricCard
                label="Avg Citations / Answer"
                value={statsLoading ? '—' : (stats?.avgCitationsPerAnswer ?? 0).toFixed(1)}
                icon={TrendingUp}
                iconColor="bg-violet-500"
                tooltip="Average number of validated citations per AI answer. Higher = more grounded and verifiable responses."
                isLoading={statsLoading}
              />
              <MetricCard
                label="Total Tokens Estimated"
                value={statsLoading ? '—' : fmt(stats?.totalTokensEstimated ?? 0)}
                unit="tokens"
                icon={Zap}
                iconColor="bg-amber-500"
                tooltip="Estimated total tokens generated across all answers (word_count × 1.3 approximation). Useful for capacity planning."
                isLoading={statsLoading}
              />
              <MetricCard
                label="Ollama Uptime"
                value={statsLoading ? '—' : `${stats?.ollamaUptimePercent ?? 100}`}
                unit="%"
                icon={Activity}
                iconColor="bg-green-500"
                tooltip="Percentage of requests where Ollama was online and returned a real answer. 100% = always available."
                isLoading={statsLoading}
              />
            </div>

            {/* ── Benchmark Comparison: Current Period vs Overall ───────────── */}
            {benchmarkStats && !statsLoading && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Benchmark: Current Filter vs All-Time Average
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Retrieval Latency',
                      current: stats?.avgRetrievalLatencyMs ?? 0,
                      overall: benchmarkStats.avgRetrievalLatencyMs,
                      unit: 'ms',
                      lowerIsBetter: true,
                    },
                    {
                      label: 'LLM Latency',
                      current: stats?.avgLlmLatencyMs ?? 0,
                      overall: benchmarkStats.avgLlmLatencyMs,
                      unit: 'ms',
                      lowerIsBetter: true,
                    },
                    {
                      label: 'Citation Coverage',
                      current: (stats?.avgCitationCoverage ?? 0) * 100,
                      overall: benchmarkStats.avgCitationCoverage * 100,
                      unit: '%',
                      lowerIsBetter: false,
                    },
                  ].map((bm) => {
                    const delta = bm.current - bm.overall;
                    const pct = bm.overall !== 0 ? (delta / Math.abs(bm.overall)) * 100 : 0;
                    const better = bm.lowerIsBetter ? delta < 0 : delta > 0;
                    return (
                      <div
                        key={bm.label}
                        className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4"
                      >
                        <p className="text-xs text-slate-400 mb-3">{bm.label}</p>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-bold text-white">
                              {bm.current.toFixed(0)}{bm.unit}
                            </p>
                            <p className="text-xs text-slate-500">Current period</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-400">
                              {bm.overall.toFixed(0)}{bm.unit}
                            </p>
                            <p className="text-xs text-slate-500">All-time avg</p>
                          </div>
                        </div>
                        <div className={`mt-2 text-xs font-medium ${better ? 'text-green-400' : 'text-red-400'}`}>
                          {delta === 0 ? '= No change' : `${better ? '▲ Better' : '▼ Worse'} by ${Math.abs(pct).toFixed(1)}%`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Chart Day Range Selector ──────────────────────────────────── */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Chart range:</span>
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    chartDays === d
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* ── Charts Grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Questions Per Day */}
              <ChartCard
                title="Questions per Day"
                subtitle="Number of AI queries asked each day"
                isLoading={dailyLoading}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={daily ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="questions" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Questions" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Retrieval Latency Over Time */}
              <ChartCard
                title="Retrieval Latency Over Time"
                subtitle="Average milliseconds to retrieve context chunks from pgvector"
                isLoading={dailyLoading}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={daily ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRetrieval" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="ms" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="avgRetrievalLatency" stroke="#3b82f6" fill="url(#gradRetrieval)" name="Retrieval (ms)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* LLM Latency Over Time */}
              <ChartCard
                title="Answer Latency Over Time"
                subtitle="Average milliseconds for Ollama to generate the completion"
                isLoading={dailyLoading}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={daily ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLlm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="ms" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="avgLlmLatency" stroke="#22d3ee" fill="url(#gradLlm)" name="LLM (ms)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Citation Count Distribution */}
              <ChartCard
                title="Citation Count Distribution"
                subtitle="How many citations were included per answer (0 = no grounding, 5+ = fully cited)"
                isLoading={citLoading}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={citDist ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="citations" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Citations', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Answers" radius={[3, 3, 0, 0]}>
                      {(citDist ?? []).map((_, i) => (
                        <rect key={i} fill={i === 0 ? '#ef4444' : i <= 2 ? '#f59e0b' : '#22c55e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* ── Second Row Charts ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Most Queried Documents */}
              <ChartCard
                title="Most Queried Documents"
                subtitle="Documents ranked by number of RAG questions asked"
                isLoading={docsLoading}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    layout="vertical"
                    data={(topDocs ?? []).slice(0, 8)}
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="documentName"
                      tick={{ fill: '#94a3b8', fontSize: 9 }}
                      width={110}
                      tickFormatter={(v) => (v.length > 15 ? v.slice(0, 15) + '…' : v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="queryCount" fill="#8b5cf6" radius={[0, 3, 3, 0]} name="Queries" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Similarity Score Distribution */}
              <ChartCard
                title="Similarity Score Distribution"
                subtitle="How often retrieved chunks fall into each cosine similarity range (higher = more relevant)"
                isLoading={simLoading}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={simDist ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="range" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Answers" radius={[3, 3, 0, 0]}>
                      {(simDist ?? []).map((bucket, i) => {
                        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981'];
                        return <rect key={i} fill={colors[i] ?? '#8b5cf6'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* ── Recent Evaluations Table ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Recent Evaluations
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-slate-500">Page {page + 1}</span>
                  <button
                    disabled={(recent?.length ?? 0) < PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                {recentLoading ? (
                  <div className="h-32 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-slate-600 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-900/30">
                          {['Query', 'Mode', 'Retr. (ms)', 'LLM (ms)', 'Total (ms)', 'Chunks', 'Citations', 'Similarity', 'Coverage', 'Hallucination', 'Ollama', 'Time'].map((h) => (
                            <th key={h} className="text-left text-slate-500 font-medium px-3 py-2.5 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(recent ?? []).map((r, i) => (
                          <tr
                            key={r.id}
                            className={`border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/10'}`}
                          >
                            <td className="px-3 py-2 max-w-[180px]">
                              <span className="truncate block text-slate-300" title={r.query}>
                                {r.query.length > 35 ? r.query.slice(0, 35) + '…' : r.query}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border capitalize ${
                                r.retrievalMode === 'hybrid' 
                                  ? 'bg-violet-950/40 text-violet-400 border-violet-800/30' 
                                  : r.retrievalMode === 'keyword'
                                    ? 'bg-orange-950/40 text-orange-400 border-orange-800/30'
                                    : 'bg-blue-950/40 text-blue-400 border-blue-800/30'
                              }`}>
                                {r.retrievalMode || 'semantic'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-blue-400 tabular-nums">{r.retrievalLatencyMs}</td>
                            <td className="px-3 py-2 text-cyan-400 tabular-nums">{r.llmLatencyMs}</td>
                            <td className="px-3 py-2 text-teal-400 tabular-nums">{r.totalLatencyMs}</td>
                            <td className="px-3 py-2 text-slate-400 tabular-nums">{r.chunksRetrieved}</td>
                            <td className="px-3 py-2 text-violet-400 tabular-nums">{r.citationsCount}</td>
                            <td className="px-3 py-2 text-yellow-400 tabular-nums">{(r.avgSimilarityScore * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 tabular-nums">
                               <span className={r.citationCoverage >= 0.6 ? 'text-green-400' : r.citationCoverage >= 0.3 ? 'text-yellow-400' : 'text-red-400'}>
                                 {(r.citationCoverage * 100).toFixed(1)}%
                               </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums">
                               <span className={r.hallucinationScore <= 0.3 ? 'text-green-400' : r.hallucinationScore <= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
                                 {(r.hallucinationScore * 100).toFixed(1)}%
                               </span>
                            </td>
                            <td className="px-3 py-2">
                               <span className={r.ollamaOnline ? 'text-green-400' : 'text-red-400'}>
                                 {r.ollamaOnline ? '✓' : '✗'}
                               </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                               {new Date(r.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {(recent ?? []).length === 0 && (
                          <tr>
                            <td colSpan={12} className="text-center py-8 text-slate-500">
                              No records found for the selected filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
