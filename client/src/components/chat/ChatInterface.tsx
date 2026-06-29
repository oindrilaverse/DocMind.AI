import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat, ChatMessage, Conversation } from '../../hooks/useChat';
import { useDocuments } from '../../hooks/useDocuments';
import { 
  Brain, Send, MessageSquare, Plus, Clock, Cpu, 
  ExternalLink, ChevronDown, ChevronUp, FileText, 
  Sparkles, ShieldAlert, ArrowLeft, Info, HelpCircle
} from 'lucide-react';

export const ChatInterface: React.FC = () => {
  const navigate = useNavigate();
  const { useHistory, askQuestion, isAsking } = useChat();
  const { documents } = useDocuments();
  const { data: historyList, isLoading: isHistoryLoading, refetch: refetchHistory } = useHistory();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>(''); // Scoping filter
  const [query, setQuery] = useState('');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [retrievalMode, setRetrievalMode] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid'); // Default to hybrid for robust answers
  const [rerank, setRerank] = useState(true); // Added in Phase 6: Cross-Encoder Reranking

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set active conversation details when history list changes or active ID changes
  useEffect(() => {
    if (historyList) {
      if (activeConvId) {
        const found = historyList.find(c => c.id === activeConvId);
        if (found) {
          setActiveConversation(found);
        }
      } else {
        setActiveConversation(null);
      }
    }
  }, [historyList, activeConvId]);

  // Scroll to bottom of message thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isAsking]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isAsking) return;

    const currentQuery = query;
    setQuery('');

    // Pre-emptively add user message to local state for fast UI feedback
    const tempUserMsg: ChatMessage = {
      id: 'temp-user-id-' + Date.now(),
      role: 'user',
      content: currentQuery,
      createdAt: new Date().toISOString()
    };

    if (activeConversation) {
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tempUserMsg]
      } : null);
    } else {
      // Create a temporary conversation structure
      setActiveConversation({
        id: 'temp-conv-id',
        title: 'New Session',
        createdAt: new Date().toISOString(),
        messages: [tempUserMsg]
      });
    }

    try {
      const response = await askQuestion({
        query: currentQuery,
        conversationId: activeConvId || undefined,
        documentId: selectedDocId || undefined,
        mode: retrievalMode,
        rerank
      });

      // Update active conversation ID and refetch list
      setActiveConvId(response.conversationId);
      await refetchHistory();
    } catch (err) {
      console.error('[Chat] Failed to ask question:', err);
      // Remove temp message or show error in conversation
      const tempErrorMsg: ChatMessage = {
        id: 'temp-error-id-' + Date.now(),
        role: 'assistant',
        content: 'Error: Failed to generate a response. Please check Ollama model availability.',
        createdAt: new Date().toISOString()
      };
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tempErrorMsg]
      } : null);
    }
  };

  const toggleCitationGroup = (messageId: string) => {
    setExpandedCitations(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleStartNewChat = () => {
    setActiveConvId(null);
    setActiveConversation(null);
  };

  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-darkbg">
      {/* Sidebar: Chat History and Controls (300px) */}
      <aside className="w-80 border-r border-darkborder bg-darksurface/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-darkborder space-y-3">
          <button
            onClick={handleStartNewChat}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-2.5 px-4 rounded-xl font-semibold text-sm transition duration-150 shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" />
            New Chat Session
          </button>

          {/* Document Scope Selection */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-textmuted flex items-center gap-1">
              <Brain className="w-3 h-3 text-accent" />
              Search Scope Context
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-xs text-textmain focus:outline-none focus:border-primary"
            >
              <option value="">All Uploaded Documents</option>
              {documents.filter(d => d.status === 'ready').map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.originalName}
                </option>
              ))}
            </select>
          </div>

          {/* Retrieval Mode Selection */}
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-textmuted flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                Retrieval Mode
              </label>
              <select
                value={retrievalMode}
                onChange={(e) => setRetrievalMode(e.target.value as any)}
                className="w-full bg-darkbg border border-darkborder rounded-xl px-3 py-2 text-xs text-textmain focus:outline-none focus:border-primary"
              >
                <option value="semantic">Semantic (Vector)</option>
                <option value="keyword">Keyword (BM25)</option>
                <option value="hybrid">Hybrid (Combined)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="sidebarRerankToggle"
                checked={rerank}
                onChange={(e) => setRerank(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-darkborder bg-darkbg cursor-pointer"
              />
              <label htmlFor="sidebarRerankToggle" className="text-[10px] font-semibold text-textmain cursor-pointer select-none">
                Cross-Encoder Reranking
              </label>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <h3 className="px-2 text-[10px] uppercase font-bold tracking-wider text-textmuted mb-2">
            Recent Sessions
          </h3>

          {isHistoryLoading ? (
            <div className="p-4 text-center text-xs text-textmuted animate-pulse">
              Loading chat history...
            </div>
          ) : !historyList || historyList.length === 0 ? (
            <div className="p-4 text-center text-xs text-textmuted italic">
              No recent conversations
            </div>
          ) : (
            historyList.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left flex items-start gap-2.5 px-3 py-3 rounded-xl transition duration-150 border ${
                    isActive 
                      ? 'bg-primary/10 border-primary/20 text-primary' 
                      : 'border-transparent text-textmuted hover:text-textmain hover:bg-darksurface/30'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight">
                      {conv.title}
                    </p>
                    <p className="text-[9px] text-textmuted/80 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Content Panel */}
      <section className="flex-1 flex flex-col bg-darkbg relative">
        {/* Welcome / Context Status Bar */}
        <div className="px-6 py-3 border-b border-darkborder bg-darksurface/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-textmuted">Active Scope:</span>
            {selectedDocId ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                <FileText className="w-3.5 h-3.5" />
                {documents.find(d => d.id === selectedDocId)?.originalName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Global RAG Knowledge Base
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider">Ollama llama3.2 Online</span>
          </div>
        </div>

        {/* Message Thread Viewer */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto p-6 space-y-6">
              <div className="bg-primary/10 p-5 rounded-3xl border border-primary/20 text-primary animate-pulse">
                <Brain className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-textmain">Grounded AI Chat Assistant</h2>
                <p className="text-sm text-textmuted leading-relaxed">
                  Ask questions about your uploaded documents. DocMind AI uses semantic retrieval and an local LLM to generate trustworthy answers backed by exact source citations.
                </p>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <button
                  onClick={() => setQuery("What are the main findings in my documents?")}
                  className="p-3.5 rounded-2xl bg-darksurface/40 border border-darkborder/60 text-xs text-textmuted hover:text-textmain hover:border-primary/40 transition text-left"
                >
                  <p className="font-bold text-textmain mb-1">Summarize documents</p>
                  "What are the main findings in my documents?"
                </button>
                <button
                  onClick={() => setQuery("Can you explain the key concepts mentioned?")}
                  className="p-3.5 rounded-2xl bg-darksurface/40 border border-darkborder/60 text-xs text-textmuted hover:text-textmain hover:border-primary/40 transition text-left"
                >
                  <p className="font-bold text-textmain mb-1">Explain key terms</p>
                  "Can you explain the key concepts mentioned?"
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {activeConversation.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-3xl p-5 ${
                      isUser 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : 'glass-panel text-textmain rounded-tl-none border border-darkborder/80'
                    }`}>
                      {/* Message Content */}
                      <div className="text-sm leading-relaxed whitespace-pre-wrap select-text font-medium">
                        {msg.content}
                      </div>

                      {/* Assistant RAG Details / Citations */}
                      {!isUser && (
                        <div className="mt-4 pt-4 border-t border-darkborder/50 space-y-3">
                          {/* Metrics Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-textmuted font-semibold">
                            <div className="flex items-center gap-3">
                              {msg.retrievalLatencyMs && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-accent" />
                                  Retrieval: {msg.retrievalLatencyMs}ms
                                </span>
                              )}
                              {msg.answerLatencyMs && (
                                <span className="flex items-center gap-1">
                                  <Cpu className="w-3.5 h-3.5 text-green-400" />
                                  LLM Generation: {(msg.answerLatencyMs / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>

                            {msg.citations && msg.citations.length > 0 && (
                              <button
                                onClick={() => toggleCitationGroup(msg.id)}
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                {msg.citations.length} Source Citation{msg.citations.length > 1 ? 's' : ''}
                                {expandedCitations[msg.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>

                          {/* Citation Cards List */}
                          {msg.citations && msg.citations.length > 0 && expandedCitations[msg.id] && (
                            <div className="space-y-2.5 pt-2 animate-fadeIn">
                              {msg.citations.map((cite, index) => (
                                <div
                                  key={cite.id || index}
                                  onClick={() => navigate(`/document/${cite.documentId}?highlightChunkId=${cite.chunkId}`)}
                                  className="border border-darkborder/50 bg-darkbg/40 hover:border-primary/40 p-3.5 rounded-2xl cursor-pointer hover:bg-darkbg/80 transition duration-150 group"
                                >
                                  {/* Card Header */}
                                  <div className="flex items-center justify-between gap-4 mb-2 text-xs">
                                    <div className="flex items-center gap-2 text-textmain font-bold truncate">
                                      <span className="bg-primary/20 border border-primary/30 text-primary text-[10px] px-1.5 py-0.5 rounded">
                                        [{index + 1}]
                                      </span>
                                      <FileText className="w-4 h-4 text-primary shrink-0" />
                                      <span className="truncate max-w-[200px]">{cite.documentName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 font-semibold text-textmuted group-hover:text-primary shrink-0 flex-wrap justify-end">
                                      {cite.originalRank !== undefined && cite.originalRank !== null && cite.newRank !== undefined && cite.newRank !== null && (
                                        <span className="text-[10px] bg-pink-950/40 text-pink-400 border border-pink-800/30 px-1.5 py-0.5 rounded font-semibold" title={`Reranked from initial candidate position #${cite.originalRank}`}>
                                          Rank: #{cite.originalRank} → #{cite.newRank}
                                        </span>
                                      )}
                                      {cite.rerankScore !== undefined && cite.rerankScore !== null && (
                                        <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 px-1.5 py-0.5 rounded font-semibold">
                                          Rerank: {formatScore(cite.rerankScore)}
                                        </span>
                                      )}
                                      <span>Page {cite.pageNumber || 'N/A'}</span>
                                      <span>•</span>
                                      <span className="text-green-400">{formatScore(cite.similarityScore)} Match</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                  {/* Snippet Preview */}
                                  <p className="text-[11px] leading-relaxed text-textmuted/80 bg-darkbg/20 p-2.5 rounded-xl italic line-clamp-3 group-hover:text-textmain transition">
                                    "{cite.snippet}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isAsking && (
                <div className="flex justify-start">
                  <div className="glass-panel text-textmain rounded-3xl rounded-tl-none border border-darkborder/80 p-5 max-w-[85%] flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-textmuted font-medium">DocMind AI is searching context and generating grounded answer...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-darkborder bg-darksurface/10">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selectedDocId ? "Ask a question about this document..." : "Ask a question about your entire knowledge base..."}
              className="flex-1 bg-darkbg border border-darkborder rounded-2xl px-5 py-3.5 text-sm text-textmain placeholder-textmuted focus:outline-none focus:border-primary"
              disabled={isAsking}
            />
            <button
              type="submit"
              disabled={!query.trim() || isAsking}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white p-3.5 rounded-2xl transition duration-150 shadow-lg shadow-primary/20 shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
