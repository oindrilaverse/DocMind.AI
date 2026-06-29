import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Zap,
  Activity,
  FileText,
  Bookmark,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  BarChart2,
  GitBranch
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import { useEvalBenchmarkHistory, useRunBenchmarkMutation, BenchmarkRunResult } from '../hooks/useEvaluation';

export const BenchmarkPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkRunResult | null>(null);

  // Hook for historical stats
  const { data: historyStats, isLoading: isHistoryLoading, refetch: refetchHistory } = useEvalBenchmarkHistory();

  // Mutation to run playground benchmark
  const runBenchmark = useRunBenchmarkMutation();

  const handleRunPlayground = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    runBenchmark.mutate(
      { query },
      {
        onSuccess: (data) => {
          setBenchmarkResult(data);
          refetchHistory(); // Refresh comparison averages
        },
      }
    );
  };

  const handleReset = () => {
    setQuery('');
    setBenchmarkResult(null);
  };

  // Build data for Recharts latency comparison (Playground)
  const playgroundLatencyData = benchmarkResult
    ? [
        {
          name: 'Semantic Only',
          'Latency (ms)': benchmarkResult.semantic.latencyMs,
          color: '#3b82f6', // Blue
        },
        {
          name: 'Hybrid Search',
          'Latency (ms)': benchmarkResult.hybrid.latencyMs,
          color: '#f97316', // Orange
        },
        {
          name: 'Hybrid + Rerank',
          'Latency (ms)': benchmarkResult.hybridRerank.latencyMs,
          color: '#10b981', // Emerald
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-darkbg text-textmain flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-darkborder bg-darksurface/30 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-darkborder rounded-xl text-textmuted hover:text-textmain hover:bg-darksurface transition duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 p-1.5 rounded-xl">
              <GitBranch className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">DocMind AI</h1>
              <p className="text-[10px] text-textmuted uppercase tracking-wider font-semibold">RAG Pipeline Benchmark</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Grounding & Reranker Benchmarking</h2>
            <p className="text-sm text-textmuted mt-1">
              Analyze latency overhead, retrieval accuracy shifts, and citation density across matching engines.
            </p>
          </div>
        </div>

        {/* ── SECTION 1: HISTORICAL RAG COMPARATIVE STATS ── */}
        <div className="glass-panel rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-bold text-textmuted mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Historical Production Performance (Reranked vs Base)
            </h3>
            <p className="text-xs text-textmuted">
              Aggregate averages based on all user search and evaluation query interactions logged in the PostgreSQL backend.
            </p>
          </div>

          {isHistoryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-darksurface/50 rounded-2xl border border-darkborder/40" />
              ))}
            </div>
          ) : historyStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Avg Total Latency */}
              <div className="bg-darksurface/30 border border-darkborder/50 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-textmuted tracking-wider">Avg End-to-End Latency</span>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">
                    {historyStats.withRerank.avgTotalLatencyMs}ms
                  </span>
                  <span className="text-xs text-textmuted">vs {historyStats.withoutRerank.avgTotalLatencyMs}ms</span>
                </div>
                <div className="text-[10px] text-textmuted">
                  Reranked queries include candidate scoring overhead.
                </div>
              </div>

              {/* Avg Retrieval Latency */}
              <div className="bg-darksurface/30 border border-darkborder/50 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-textmuted tracking-wider">Avg Retrieval Latency</span>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-blue-400">
                    {historyStats.withRerank.avgRetrievalLatencyMs}ms
                  </span>
                  <span className="text-xs text-textmuted">vs {historyStats.withoutRerank.avgRetrievalLatencyMs}ms</span>
                </div>
                <div className="text-[10px] text-textmuted">
                  Includes candidate fetch + cross-encoder rerank scoring.
                </div>
              </div>

              {/* Avg Similarity Score */}
              <div className="bg-darksurface/30 border border-darkborder/50 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-textmuted tracking-wider">Avg Similarity Match</span>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-pink-400">
                    {(historyStats.withRerank.avgSimilarityScore * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-textmuted">vs {(historyStats.withoutRerank.avgSimilarityScore * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[10px] text-textmuted">
                  Relevance quality score after retrieval matching filters.
                </div>
              </div>

              {/* Citation Coverage */}
              <div className="bg-darksurface/30 border border-darkborder/50 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-textmuted tracking-wider">Citation Grounding</span>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-orange-400">
                    {(historyStats.withRerank.avgCitationCoverage * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-textmuted">vs {(historyStats.withoutRerank.avgCitationCoverage * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[10px] text-textmuted">
                  Grounding density (ratio of cited chunks vs retrieved).
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-darkborder/50 rounded-2xl text-textmuted text-xs">
              No historical evaluation logs available yet.
            </div>
          )}
        </div>

        {/* ── SECTION 2: INTERACTIVE PLAYGROUND COMPARATOR ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Query Console Form */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between h-fit">
            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wider font-bold text-textmuted flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Playground Console
              </h3>
              <p className="text-xs text-textmuted">
                Submit any query to execute it side-by-side across three separate stages of the RAG retrieval pipeline synchronously.
              </p>
              
              <form onSubmit={handleRunPlayground} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider text-textmuted font-bold">
                    Test Query Text
                  </label>
                  <textarea
                    rows={4}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. What is the cancellation policy and refund window?"
                    disabled={runBenchmark.isPending}
                    className="block w-full p-3.5 bg-darkbg border border-darkborder rounded-xl text-textmain placeholder-textmuted focus:outline-none focus:border-primary transition disabled:opacity-50 text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={runBenchmark.isPending || !query.trim()}
                    className="flex-1 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl font-medium tracking-wide shadow-lg shadow-primary/20 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {runBenchmark.isPending ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin" />
                        <span>Running pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Run Benchmark</span>
                      </>
                    )}
                  </button>
                  {benchmarkResult && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 border border-darkborder rounded-xl text-textmuted hover:text-textmain hover:bg-darksurface transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Latency Comparison Chart */}
            {benchmarkResult && (
              <div className="mt-8 pt-6 border-t border-darkborder/50 space-y-4">
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-textmuted flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Query Latency Overhead
                </h4>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={playgroundLatencyData} layout="vertical" margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis type="number" stroke="#737373" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#737373" fontSize={10} width={90} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '12px' }}
                        itemStyle={{ color: '#f5f5f5' }}
                        labelStyle={{ color: '#737373', fontSize: 10 }}
                      />
                      <Bar dataKey="Latency (ms)" radius={[0, 4, 4, 0]}>
                        {playgroundLatencyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-textmuted leading-relaxed">
                  Reranking adds a bi-encoder scoring step (approx <strong className="text-emerald-400">{benchmarkResult.hybridRerank.rerankLatencyMs}ms</strong>) to check actual semantic context overlap.
                </div>
              </div>
            )}
          </div>

          {/* Side-by-Side Matching Panel */}
          <div className="lg:col-span-2 space-y-6">
            {!benchmarkResult ? (
              <div className="glass-panel rounded-3xl p-12 text-center text-textmuted flex flex-col items-center justify-center h-full border-dashed border border-darkborder">
                <Sparkles className="w-12 h-12 text-darkborder mb-3 animate-pulse" />
                <h4 className="font-semibold text-textmain text-sm">Interactive Reranker Comparison</h4>
                <p className="text-xs max-w-sm mt-1 mx-auto leading-relaxed">
                  Type a query in the playground console and click "Run Benchmark" to trace how Vector searches, Hybrid Fusions, and Cross-Encoder rankers prioritize text candidates.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Column 1: Semantic Only */}
                <div className="bg-darksurface/20 border border-darkborder/50 rounded-2xl p-4 space-y-4">
                  <div className="border-b border-darkborder/50 pb-2 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-textmain">1. Semantic Only</h4>
                      <p className="text-[9px] text-textmuted uppercase tracking-wider font-semibold">Dense Vector Scan</p>
                    </div>
                    <span className="text-[10px] bg-blue-950/50 text-blue-400 border border-blue-800/30 px-1.5 py-0.5 rounded font-bold">
                      {benchmarkResult.semantic.latencyMs}ms
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {benchmarkResult.semantic.results.map((r, i) => (
                      <div key={i} className="bg-darkbg/40 p-3 rounded-xl border border-darkborder/40 space-y-2 text-xs relative group hover:border-blue-500/20 transition">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-textmuted font-semibold">Match #{r.rank}</span>
                          <span className="text-blue-400 font-bold">{(r.score * 100).toFixed(0)}% Match</span>
                        </div>
                        <p className="text-[10px] text-textmuted/80 leading-relaxed italic line-clamp-3">
                          "{r.content}"
                        </p>
                        <div className="text-[9px] text-textmuted flex justify-between">
                          <span>{r.documentName}</span>
                          {r.pageNumber && <span>Page {r.pageNumber}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Hybrid Search */}
                <div className="bg-darksurface/20 border border-darkborder/50 rounded-2xl p-4 space-y-4">
                  <div className="border-b border-darkborder/50 pb-2 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-textmain">2. Hybrid Search</h4>
                      <p className="text-[9px] text-textmuted uppercase tracking-wider font-semibold">Normalized fusion</p>
                    </div>
                    <span className="text-[10px] bg-orange-950/50 text-orange-400 border border-orange-800/30 px-1.5 py-0.5 rounded font-bold">
                      {benchmarkResult.hybrid.latencyMs}ms
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {benchmarkResult.hybrid.results.map((r, i) => (
                      <div key={i} className="bg-darkbg/40 p-3 rounded-xl border border-darkborder/40 space-y-2 text-xs relative group hover:border-orange-500/20 transition">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-textmuted font-semibold">Match #{r.rank}</span>
                          <span className="text-orange-400 font-bold">{(r.score * 100).toFixed(0)}% Score</span>
                        </div>
                        <p className="text-[10px] text-textmuted/80 leading-relaxed italic line-clamp-3">
                          "{r.content}"
                        </p>
                        <div className="text-[9px] text-textmuted flex justify-between">
                          <span>{r.documentName}</span>
                          {r.pageNumber && <span>Page {r.pageNumber}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 3: Hybrid + Reranker */}
                <div className="bg-darksurface/20 border border-darkborder/50 rounded-2xl p-4 space-y-4">
                  <div className="border-b border-darkborder/50 pb-2 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-textmain">3. Hybrid + Reranker</h4>
                      <p className="text-[9px] text-textmuted uppercase tracking-wider font-semibold">Cross-Encoder</p>
                    </div>
                    <span className="text-[10px] bg-emerald-950/50 text-emerald-400 border border-emerald-800/30 px-1.5 py-0.5 rounded font-bold">
                      {benchmarkResult.hybridRerank.latencyMs}ms
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {benchmarkResult.hybridRerank.results.map((r, i) => {
                      const rankShift = r.originalRank - r.newRank;
                      return (
                        <div key={i} className="bg-darkbg/40 p-3 rounded-xl border border-darkborder/40 space-y-2 text-xs relative group hover:border-emerald-500/20 transition">
                          <div className="flex justify-between items-center text-[10px] flex-wrap gap-1">
                            <span className="text-textmuted font-semibold">Match #{r.rank}</span>
                            
                            {/* Rank Shift Indicator */}
                            {rankShift > 0 ? (
                              <span className="text-emerald-400 bg-emerald-950/30 px-1 rounded text-[8px] font-bold">
                                ▲ +{rankShift} Shift (Pos #{r.originalRank})
                              </span>
                            ) : rankShift < 0 ? (
                              <span className="text-red-400 bg-red-950/30 px-1 rounded text-[8px] font-bold">
                                ▼ {rankShift} Shift (Pos #{r.originalRank})
                              </span>
                            ) : (
                              <span className="text-textmuted bg-darksurface px-1 rounded text-[8px] font-semibold">
                                Stable (Pos #{r.originalRank})
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-textmuted/80 leading-relaxed italic line-clamp-3">
                            "{r.content}"
                          </p>
                          <div className="flex justify-between items-center text-[9px] pt-1">
                            <span className="text-textmuted truncate max-w-[70px]">{r.documentName}</span>
                            <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1 py-0.5 rounded-md">
                              {(r.rerankScore * 100).toFixed(0)}% Rerank
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};
