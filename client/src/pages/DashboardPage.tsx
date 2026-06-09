import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDocuments } from '../hooks/useDocuments';
import { useSearch } from '../hooks/useSearch';
import { useChat } from '../hooks/useChat';
import { 
  Brain, LogOut, FileText, Search, Plus, Trash2, 
  RefreshCw, AlertCircle, HardDrive, Clock, HelpCircle,
  Database, Activity, Cpu, MessageSquare, Percent
} from 'lucide-react';
import { Document } from '@docmind/shared';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { documents, isLoading, error, refetch, upload, isUploading, uploadError, deleteDoc } = useDocuments();
  const { useStats } = useSearch();
  const { data: stats } = useStats();
  const { useAnalytics } = useChat();
  const { data: ragStats } = useAnalytics();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Polling for processing status of documents
  useEffect(() => {
    const hasProcessing = documents.some(
      (doc) => doc.status === 'uploading' || doc.status === 'processing'
    );

    if (hasProcessing) {
      const interval = setInterval(() => {
        refetch();
      }, 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [documents, refetch]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!['.pdf', '.docx', '.pptx'].includes(ext)) {
      alert("Invalid file type. Only PDF, DOCX, and PPTX files are supported.");
      return;
    }
    
    try {
      await upload(file);
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid navigating to document details
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDoc(id);
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/60 text-blue-400 border border-blue-800/40">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Uploading
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Processing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-950/60 text-green-400 border border-green-800/40">
            Ready
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/40">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-darkbg flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-darkborder bg-darksurface/30 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight text-textmain">DocMind AI</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-sm font-semibold text-textmain">{user?.name}</span>
              <span className="text-xs text-textmuted">{user?.email}</span>
            </div>
            <button
              onClick={() => navigate('/search')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-primary/20 bg-primary/10 hover:bg-primary/20 rounded-xl text-primary hover:text-white transition duration-150"
            >
              <Search className="w-4 h-4" />
              <span>Semantic Search</span>
            </button>
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-purple-800/20 bg-purple-950/20 hover:bg-purple-900/30 rounded-xl text-purple-400 hover:text-purple-200 transition duration-150"
            >
              <Brain className="w-4 h-4" />
              <span>AI Chat</span>
            </button>
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-darkborder rounded-xl text-textmuted hover:text-textmain hover:bg-darksurface transition duration-150"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        
        {/* Analytics Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20 text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Processed Docs</p>
              <h3 className="text-lg font-bold text-textmain mt-0.5">{stats?.documentsProcessed ?? 0}</h3>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
            <div className="bg-accent/10 p-2.5 rounded-xl border border-accent/20 text-accent shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Chunks Generated</p>
              <h3 className="text-lg font-bold text-textmain mt-0.5">{stats?.chunksGenerated ?? 0}</h3>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
            <div className="bg-green-950/20 p-2.5 rounded-xl border border-green-800/20 text-green-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Vectors Embedded</p>
              <h3 className="text-lg font-bold text-textmain mt-0.5">{stats?.embeddingsGenerated ?? 0}</h3>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
            <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/20 text-amber-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Searches Run</p>
              <h3 className="text-lg font-bold text-textmain mt-0.5">{stats?.searchesPerformed ?? 0}</h3>
            </div>
          </div>
        </div>

        {/* RAG Analytics Panel */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-purple-400" />
            RAG Performance & Grounding Analytics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
              <div className="bg-purple-950/20 p-2.5 rounded-xl border border-purple-800/20 text-purple-400 shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Questions Asked</p>
                <h3 className="text-lg font-bold text-textmain mt-0.5">{ragStats?.questionsAsked ?? 0}</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
              <div className="bg-blue-950/20 p-2.5 rounded-xl border border-blue-800/20 text-blue-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Avg Retrieval Latency</p>
                <h3 className="text-lg font-bold text-textmain mt-0.5">
                  {ragStats?.avgRetrievalLatencyMs ? `${ragStats.avgRetrievalLatencyMs} ms` : '—'}
                </h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
              <div className="bg-green-950/20 p-2.5 rounded-xl border border-green-800/20 text-green-400 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Avg Answer Latency</p>
                <h3 className="text-lg font-bold text-textmain mt-0.5">
                  {ragStats?.avgAnswerLatencyMs ? `${(ragStats.avgAnswerLatencyMs / 1000).toFixed(1)} s` : '—'}
                </h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5">
              <div className="bg-pink-950/20 p-2.5 rounded-xl border border-pink-800/20 text-pink-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Citations per Answer</p>
                <h3 className="text-lg font-bold text-textmain mt-0.5">
                  {ragStats?.citationsPerAnswer ? ragStats.citationsPerAnswer.toFixed(1) : '—'}
                </h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4 flex items-center gap-3.5 col-span-2 md:col-span-1">
              <div className="bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/20 text-amber-400 shrink-0">
                <Percent className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold tracking-wider text-textmuted truncate">Retrieval Accuracy</p>
                <h3 className="text-lg font-bold text-textmain mt-0.5">
                  {ragStats?.retrievalAccuracy ? `${Math.round(ragStats.retrievalAccuracy * 100)}%` : '—'}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Upload Side (1 column on large screens) */}
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              <h2 className="text-lg font-bold text-textmain mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                Upload Document
              </h2>
              
              {/* Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-200 min-h-[200px] ${
                  dragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-darkborder hover:border-primary/50 hover:bg-darksurface/40"
                } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.pptx"
                  className="hidden"
                  disabled={isUploading}
                />
                
                <div className="bg-primary/10 p-3 rounded-full border border-primary/20 mb-4 animate-bounce">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                
                {isUploading ? (
                  <div className="space-y-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm font-medium text-textmain">Uploading file...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-textmain">Click to upload or drag & drop</p>
                    <p className="text-xs text-textmuted mt-1.5">PDF, DOCX, or PPTX (up to 50MB)</p>
                  </>
                )}
              </div>

              {uploadError && (
                <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-950/20 border border-red-800/30 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{(uploadError as any).response?.data?.message || "File upload failed"}</p>
                </div>
              )}
            </div>

            {/* Future Roadmap placeholder info */}
            <div className="glass-panel rounded-3xl p-6 border border-darkborder/50 text-textmuted text-xs space-y-3">
              <h3 className="font-bold text-textmain uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                Roadmap Information
              </h3>
              <p>In Phase 1, you can manage and view extracted text. Under the hood, placeholders for embedding and RAG are prepared.</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-darkbg p-2 rounded-lg border border-darkborder/50 text-center font-medium">Phase 2: Chunks</div>
                <div className="bg-darkbg p-2 rounded-lg border border-darkborder/50 text-center font-medium">Phase 3: Vectors</div>
                <div className="bg-darkbg p-2 rounded-lg border border-darkborder/50 text-center font-medium col-span-2">Phase 5: RAG Chat</div>
              </div>
            </div>
          </div>

          {/* Document List Side (2 columns on large screens) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-between mb-6">
                <h2 className="text-lg font-bold text-textmain self-start sm:self-center">Your Documents</h2>
                
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-textmuted" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="block w-full pl-9 pr-4 py-2 bg-darkbg border border-darkborder rounded-xl text-textmain placeholder-textmuted focus:outline-none focus:border-primary transition duration-150 text-sm"
                  />
                </div>
              </div>

              {/* Document List */}
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="border border-darkborder/60 bg-darkbg/40 p-4 rounded-2xl flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="bg-darkborder w-10 h-10 rounded-xl"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-darkborder w-40 rounded"></div>
                          <div className="h-3 bg-darkborder w-20 rounded"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-darkborder w-16 rounded-full"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8 text-textmuted flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <p className="font-medium">Failed to load documents</p>
                  <button onClick={() => refetch()} className="text-primary hover:underline text-xs mt-2 font-semibold">Try Again</button>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12 border border-darkborder/50 border-dashed rounded-2xl text-textmuted">
                  <FileText className="w-12 h-12 mx-auto text-darkborder mb-3" />
                  <p className="font-medium text-textmain">No documents found</p>
                  <p className="text-xs mt-1">Upload a PDF, DOCX, or PPTX file to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => doc.status === 'ready' && navigate(`/document/${doc.id}`)}
                      className={`border border-darkborder bg-darkbg/20 p-4 rounded-2xl flex items-center justify-between hover:border-primary/40 hover:bg-darkbg/60 transition duration-150 group ${
                        doc.status === 'ready' ? 'cursor-pointer' : 'pointer-events-none opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="bg-primary/5 border border-primary/10 group-hover:border-primary/20 group-hover:bg-primary/10 p-2.5 rounded-xl text-primary shrink-0 transition duration-150">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-textmain truncate group-hover:text-primary transition duration-150" title={doc.originalName}>
                            {doc.originalName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-textmuted font-medium">{formatBytes(doc.size)}</span>
                            <span className="text-textmuted text-[10px]">•</span>
                            <span className="text-xs text-textmuted flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            
                            {/* Tags display */}
                            {doc.tags?.map((tag, i) => (
                              <React.Fragment key={tag}>
                                <span className="text-textmuted text-[10px]">•</span>
                                <span className="bg-darksurface border border-darkborder px-1.5 py-0.5 rounded text-[10px] font-semibold text-textmuted">
                                  {tag}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {getStatusBadge(doc.status)}
                        
                        <button
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="p-2 border border-darkborder rounded-xl text-textmuted hover:text-red-400 hover:border-red-800/40 hover:bg-red-950/20 transition duration-150 pointer-events-auto"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
export default DashboardPage;
