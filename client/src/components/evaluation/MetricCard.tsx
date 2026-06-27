/**
 * MetricCard.tsx — Phase 4: AI Evaluation Dashboard
 *
 * PURPOSE:
 *   A reusable stat card component that displays a single evaluation KPI.
 *   Used in the top "Overview" section and the "Benchmark Comparison" section.
 *
 * FEATURES:
 *   - Colour-coded status indicator (green/yellow/red based on threshold)
 *   - Optional comparison delta (current vs benchmark)
 *   - Tooltip explaining what the metric means (beginner-friendly)
 *   - Loading skeleton state
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  /** Short display label (e.g. "Avg Retrieval Latency") */
  label: string;

  /** The primary value to display */
  value: string | number;

  /** Optional unit suffix (e.g. "ms", "%", "tokens") */
  unit?: string;

  /** Lucide icon to display */
  icon: LucideIcon;

  /** Icon background colour class (Tailwind) */
  iconColor: string;

  /** Beginner-friendly tooltip explaining what this metric measures */
  tooltip: string;

  /** Optional: comparison value (overall average for benchmarking) */
  benchmark?: number;

  /** True = lower value is better (e.g. latency). False = higher is better (e.g. precision). */
  lowerIsBetter?: boolean;

  /** Optional: treat this card as a score (0–1) and show a mini progress bar */
  isScore?: boolean;

  /** Loading state — shows skeleton when true */
  isLoading?: boolean;

  /** Optional extra subtext below the value */
  subtext?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  iconColor,
  tooltip,
  benchmark,
  lowerIsBetter = false,
  isScore = false,
  isLoading = false,
  subtext,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determine delta between current value and benchmark for comparison cards
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));
  const hasBenchmark = benchmark !== undefined && !isNaN(numericValue) && !isNaN(benchmark);

  let deltaPercent: number | null = null;
  let deltaDir: 'better' | 'worse' | 'neutral' = 'neutral';

  if (hasBenchmark && benchmark !== 0) {
    deltaPercent = ((numericValue - benchmark) / Math.abs(benchmark)) * 100;

    // For "lower is better" metrics (latency): negative delta = improvement
    // For "higher is better" metrics (precision): positive delta = improvement
    if (lowerIsBetter) {
      deltaDir = deltaPercent < -2 ? 'better' : deltaPercent > 2 ? 'worse' : 'neutral';
    } else {
      deltaDir = deltaPercent > 2 ? 'better' : deltaPercent < -2 ? 'worse' : 'neutral';
    }
  }

  // Score progress bar colour (for quality metrics 0–1)
  const scoreNum = isScore ? Math.min(1, Math.max(0, numericValue)) : 0;
  const scoreColor =
    scoreNum >= 0.7 ? 'bg-green-500' : scoreNum >= 0.4 ? 'bg-yellow-500' : 'bg-red-500';

  const deltaColor =
    deltaDir === 'better'
      ? 'text-green-400'
      : deltaDir === 'worse'
      ? 'text-red-400'
      : 'text-slate-400';

  return (
    <div className="relative bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-violet-500/40 transition-all duration-200 group">
      {/* Header: icon + label + info tooltip trigger */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${iconColor} bg-opacity-20`}>
            <Icon className={`w-4 h-4 ${iconColor.replace('bg-', 'text-')}`} />
          </div>
          <span className="text-xs font-medium text-slate-400 leading-tight">{label}</span>
        </div>

        {/* Info tooltip trigger */}
        <div className="relative">
          <button
            className="text-slate-600 hover:text-slate-300 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label={`Info about ${label}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {showTooltip && (
            <div className="absolute right-0 top-6 z-50 w-56 bg-slate-900 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
              {tooltip}
            </div>
          )}
        </div>
      </div>

      {/* Main value */}
      {isLoading ? (
        <div className="h-8 w-20 bg-slate-700 rounded animate-pulse mb-1" />
      ) : (
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
          {unit && <span className="text-sm text-slate-400">{unit}</span>}
        </div>
      )}

      {/* Score progress bar (for quality metrics) */}
      {isScore && !isLoading && (
        <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
          <div
            className={`${scoreColor} h-1.5 rounded-full transition-all duration-500`}
            style={{ width: `${scoreNum * 100}%` }}
          />
        </div>
      )}

      {/* Benchmark delta comparison */}
      {hasBenchmark && !isLoading && deltaPercent !== null && (
        <div className={`text-xs ${deltaColor} flex items-center gap-1`}>
          <span>{deltaPercent > 0 ? '▲' : '▼'}</span>
          <span>{Math.abs(deltaPercent).toFixed(1)}% vs overall avg</span>
        </div>
      )}

      {/* Optional subtext */}
      {subtext && !isLoading && (
        <div className="text-xs text-slate-500 mt-1">{subtext}</div>
      )}
    </div>
  );
};
