import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDocuments } from '../hooks/useDocuments';
import { useSearch, SearchResponse } from '../hooks/useSearch';
import { 
  ArrowLeft, Search, Database, Clock, Percent, 
  FileText, Sliders, AlertTriangle, AlertCircle, RefreshCw 
} from 'lucide-react';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { documents } = useDocuments();
  const { useOllamaStatus, executeSearch } = useSearch();
  
  const { data: ollama } = useOllamaStatus();
  
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [limit, setLimit] = useState(5);
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid'); // Default to hybrid for rich results
  const [rerank, setRerank] = useState(true); // Added in Phase 6: Cross-Encoder Reranking
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError('');
    try {
      const data = await executeSearch(query, selectedDocId, limit, retrievalMode, rerank);
      setSearchData(data);
    } catch (err: any) {
      console.error(err);
      setSearchError(err.response?.data?.message || 'Failed to complete search. Verify service connectivity.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-darkbg flex flex-col">
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

          <h1 className="text-lg font-bold text-textmain">Semantic Search Engine</h1>

          {/* Ollama Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-textmuted hidden sm:inline">Ollama Status:</span>
            {ollama?.online ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-950/60 text-green-400 border border-green-800/40">
                Online ({ollama.model})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/40" title="Make sure local Ollama is started with model nomic-embed-text">
                <AlertTriangle className="w-3.5 h-3.5" />
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Search Input Card */}
        <div className="glass-panel rounded-3xl p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            
            {/* Search inputs block */}
            <div className="flex flex-col md:flex-row gap-4">
              
              {/* Scope filter */}
              <div className="w-full md:w-48">
                <label className="block text-xs font-semibold uppercase tracking-wider text-textmuted mb-2">
                  Search Scope
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="block w-full py-2.5 px-3 bg-darkbg border border-darkborder rounded-xl text-textmain focus:outline-none focus:border-primary text-sm"
                >
                  <option value="">All Documents</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.originalName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Retrieval Mode filter */}
              <div className="w-full md:w-48">
                <label className="block text-xs font-semibold uppercase tracking-wider text-textmuted mb-2">
                  Retrieval Mode
                </label>
                <select
                  value={retrievalMode}
                  onChange={(e) => setRetrievalMode(e.target.value as any)}
                  className="block w-full py-2.5 px-3 bg-darkbg border border-darkborder rounded-xl text-textmain focus:outline-none focus:border-primary text-sm"
                >
                  <option value="semantic">Semantic (Vector)</option>
                  <option value="keyword">Keyword (BM25)</option>
                  <option value="hybrid">Hybrid (Combined)</option>
                </select>
              </div>

              {/* Text input */}
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-textmuted mb-2">
                  Search Query
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <Search className="h-5 h-5 text-textmuted" />
                  </span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your concept, keyword or question..."
                    disabled={isSearching}
                    className="block w-full pl-11 pr-4 py-2.5 bg-darkbg border border-darkborder rounded-xl text-textmain placeholder-textmuted focus:outline-none focus:border-primary transition duration-150 disabled:opacity-50 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Slider and Buttons block */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              
              {/* Limit slider and Rerank checkbox */}
              <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-textmuted shrink-0" />
                  <span className="text-xs text-textmuted font-semibold">Results (K): {limit}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                    className="accent-primary h-1 bg-darkborder rounded-lg appearance-none cursor-pointer w-32"
                  />
                </div>

                <div className="flex items-center gap-2 border-l border-darkborder pl-6">
                  <input
                    type="checkbox"
                    id="rerankToggle"
                    checked={rerank}
                    onChange={(e) => setRerank(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-darkborder bg-darkbg cursor-pointer"
                  />
                  <label htmlFor="rerankToggle" className="text-xs font-semibold text-textmain cursor-pointer select-none">
                    Cross-Encoder Reranking
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white py-2.5 px-6 rounded-xl font-medium tracking-wide shadow-lg shadow-primary/20 transition duration-150 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:transform-none text-sm"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Semantic Search</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {searchError && (
            <div className="mt-5 flex items-center gap-3 bg-red-950/40 border border-red-800/50 p-4 rounded-xl text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p>{searchError}</p>
            </div>
          )}
        </div>

        {/* Analytics & Metrics Cards (Only show if we have searchData) */}
        {searchData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-xl border border-primary/20 text-primary">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted">Latency</p>
                <h3 className="text-xl font-bold text-textmain">{searchData.metrics.retrievalTimeMs} ms</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
              <div className="bg-accent/10 p-3 rounded-xl border border-accent/20 text-accent">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted">Chunks Searched</p>
                <h3 className="text-xl font-bold text-textmain">{searchData.metrics.chunksSearched}</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
              <div className="bg-green-950/20 p-3 rounded-xl border border-green-800/20 text-green-400">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted">Top Similarity</p>
                <h3 className="text-xl font-bold text-green-400">
                  {searchData.metrics.topScore > 0 
                    ? `${(searchData.metrics.topScore * 100).toFixed(1)}%` 
                    : '0%'
                  }
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchData && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-textmain">Search Results</h2>
            
            {searchData.results.length === 0 ? (
              <div className="text-center py-12 border border-darkborder/50 border-dashed rounded-3xl text-textmuted">
                <FileText className="w-12 h-12 mx-auto text-darkborder mb-3" />
                <p className="font-medium">No results found</p>
                <p className="text-xs mt-1">Try uploading documents or adjusting your query.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchData.results.map((res, i) => (
                  <div 
                    key={res.id} 
                    className="glass-panel rounded-2xl p-5 border-l-4 border-l-primary hover:border-primary/40 transition duration-150 flex flex-col gap-3"
                  >
                    
                    {/* Header: Score and doc metadata */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="bg-primary/10 border border-primary/20 text-primary font-semibold px-2 py-0.5 rounded-lg">
                          #{i + 1} Match
                        </span>
                        
                        <span className="text-textmuted font-semibold flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {res.documentName}
                        </span>

                        {res.pageNumber && (
                          <>
                            <span className="text-textmuted">•</span>
                            <span className="text-textmuted">Page/Slide {res.pageNumber}</span>
                          </>
                        )}
                      </div>

                      <div className="text-right flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {res.semanticScore !== undefined && res.semanticScore > 0 && (
                          <span className="text-[10px] bg-blue-950/40 text-blue-400 border border-blue-800/30 px-2 py-0.5 rounded font-semibold">
                            Semantic: {(res.semanticScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {res.keywordScore !== undefined && res.keywordScore > 0 && (
                          <span className="text-[10px] bg-orange-950/40 text-orange-400 border border-orange-800/30 px-2 py-0.5 rounded font-semibold">
                            Keyword: {(res.keywordScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {res.originalRank !== undefined && res.newRank !== undefined && (
                          <span className="text-[10px] bg-pink-950/40 text-pink-400 border border-pink-800/30 px-2 py-0.5 rounded font-semibold" title={`Reranked from initial pool position #${res.originalRank}`}>
                            Rank: #{res.originalRank} → #{res.newRank}
                          </span>
                        )}
                        {res.rerankScore !== undefined && res.rerankScore > 0 && (
                          <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-2 py-0.5 rounded font-semibold">
                            Rerank: {(res.rerankScore * 100).toFixed(0)}%
                          </span>
                        )}
                        {res.retrievalMode && (
                          <span className="text-[10px] bg-violet-950/40 text-violet-400 border border-violet-800/30 px-2 py-0.5 rounded font-semibold capitalize">
                            {res.retrievalMode}
                          </span>
                        )}
                        <span className="text-textmuted">Score: </span>
                        <span className="font-bold text-textmain">{(res.score * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Chunk content */}
                    <p className="text-sm text-textmain/90 leading-relaxed font-mono whitespace-pre-wrap bg-darkbg/40 border border-darkborder/40 p-4 rounded-xl">
                      {res.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
export default SearchPage;
