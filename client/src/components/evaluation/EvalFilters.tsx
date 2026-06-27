/**
 * EvalFilters.tsx — Phase 4: AI Evaluation Dashboard
 *
 * PURPOSE:
 *   A filter bar component that allows the user to scope the dashboard to:
 *     - A specific date range (from / to)
 *     - A specific document
 *     - A specific conversation
 *
 *   Filters are applied via the parent EvaluationDashboardPage and passed
 *   down to all hooks (useEvalDashboard, useEvalDaily, etc.)
 *
 * DESIGN DECISION:
 *   Filters are local state in the parent page. This component only fires
 *   onFilterChange when the user explicitly clicks "Apply Filters".
 *   This prevents excessive API calls during typing.
 */

import React, { useState } from 'react';
import { Filter, X, Calendar, FileText, MessageSquare } from 'lucide-react';
import { Document } from '@docmind/shared';

interface EvalFiltersProps {
  /** Current active filter values */
  filters: {
    from: string;
    to: string;
    documentId: string;
    conversationId: string;
  };

  /** Called when user applies or resets filters */
  onFilterChange: (filters: { from: string; to: string; documentId: string; conversationId: string }) => void;

  /** List of user documents to populate the document selector */
  documents?: Document[];

  /** List of conversations to populate the conversation selector */
  conversations?: Array<{ id: string; title: string }>;

  /** Whether data is loading (disables Apply button) */
  isLoading?: boolean;
}

export const EvalFilters: React.FC<EvalFiltersProps> = ({
  filters,
  onFilterChange,
  documents = [],
  conversations = [],
  isLoading = false,
}) => {
  // Local draft state — only committed when user clicks Apply
  const [draft, setDraft] = useState(filters);

  const hasActiveFilters =
    !!filters.from || !!filters.to || !!filters.documentId || !!filters.conversationId;

  const handleApply = () => {
    onFilterChange(draft);
  };

  const handleReset = () => {
    const cleared = { from: '', to: '', documentId: '', conversationId: '' };
    setDraft(cleared);
    onFilterChange(cleared);
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-slate-200">Filters</span>
        {hasActiveFilters && (
          <span className="ml-auto text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
            Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* From Date */}
        <div>
          <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            <Calendar className="w-3 h-3" />
            From Date
          </label>
          <input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            <Calendar className="w-3 h-3" />
            To Date
          </label>
          <input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Document filter */}
        <div>
          <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            <FileText className="w-3 h-3" />
            Document
          </label>
          <select
            value={draft.documentId}
            onChange={(e) => setDraft((d) => ({ ...d, documentId: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">All Documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.originalName || doc.filename}
              </option>
            ))}
          </select>
        </div>

        {/* Conversation filter */}
        <div>
          <label className="flex items-center gap-1 text-xs text-slate-400 mb-1">
            <MessageSquare className="w-3 h-3" />
            Conversation
          </label>
          <select
            value={draft.conversationId}
            onChange={(e) => setDraft((d) => ({ ...d, conversationId: e.target.value }))}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">All Conversations</option>
            {conversations.map((conv) => (
              <option key={conv.id} value={conv.id}>
                {conv.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleApply}
          disabled={isLoading}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Apply Filters
        </button>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
