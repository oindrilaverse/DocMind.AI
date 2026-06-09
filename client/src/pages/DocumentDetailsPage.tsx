import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDocuments } from '../hooks/useDocuments';
import { 
  ArrowLeft, FileText, Calendar, Info, 
  Trash2, Clipboard, Check, Hash, BookOpen, AlertCircle, Brain
} from 'lucide-react';

export const DocumentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { useDocument, useDocumentText, useDocumentChunk, deleteDoc } = useDocuments();
  
  const { data: doc, isLoading: isDocLoading, error: docError } = useDocument(id || '');
  const { data: text, isLoading: isTextLoading } = useDocumentText(id || '', doc?.status === 'ready');
  
  const highlightChunkId = searchParams.get('highlightChunkId') || '';
  const { data: highlightChunk } = useDocumentChunk(highlightChunkId);
  
  const [copied, setCopied] = useState(false);
  const [textSearch, setTextSearch] = useState('');

  const chunkContent = highlightChunk?.content || '';
  let highlightStart = -1;
  if (text && chunkContent) {
    highlightStart = text.indexOf(chunkContent);
  }

  // Scroll to cited chunk when content loads
  React.useEffect(() => {
    if (highlightChunk && text) {
      const timer = setTimeout(() => {
        const element = document.getElementById('highlighted-citation');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return;
  }, [highlightChunk, text]);

  const handleCopy = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (id && confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDoc(id);
        navigate('/dashboard');
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

  if (isDocLoading) {
    return (
      <div className="min-h-screen bg-darkbg flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-textmuted text-sm font-medium">Loading document details...</p>
      </div>
    );
  }

  if (docError || !doc) {
    return (
      <div className="min-h-screen bg-darkbg flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-bold text-textmain">Document Not Found</h2>
        <p className="text-textmuted text-sm mt-1 max-w-sm">The document you are looking for does not exist or you do not have permission to view it.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const stats = doc.processingMetadata || {};

  return (
    <div className="min-h-screen bg-darkbg flex flex-col">
      {/* Top Action Bar */}
      <header className="border-b border-darkborder bg-darksurface/30 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-darkborder rounded-xl text-textmuted hover:text-textmain hover:bg-darksurface transition duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <h1 className="text-md font-bold text-textmain truncate max-w-md hidden md:block" title={doc.originalName}>
            {doc.originalName}
          </h1>

          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-red-800/40 rounded-xl text-red-400 hover:bg-red-950/20 transition duration-150"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stats & Metadata (1/3) */}
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 space-y-6">
            
            {/* Title & Type Icon */}
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20 text-primary shrink-0">
                <FileText className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-textmain break-words" title={doc.originalName}>
                  {doc.originalName}
                </h2>
                <p className="text-xs text-textmuted mt-1 uppercase font-semibold">
                  {stats.fileType || 'UNKNOWN'} DOCUMENT
                </p>
              </div>
            </div>

            <hr className="border-darkborder" />

            {/* Document Statistics Panel */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                <Info className="w-4 h-4 text-primary" />
                Document Statistics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-darkbg/40 border border-darkborder/50 p-3.5 rounded-2xl">
                  <div className="text-textmuted text-[10px] font-bold uppercase tracking-wider mb-1">Words</div>
                  <div className="text-lg font-bold text-textmain flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-primary" />
                    {stats.wordCount?.toLocaleString() || '—'}
                  </div>
                </div>

                <div className="bg-darkbg/40 border border-darkborder/50 p-3.5 rounded-2xl">
                  <div className="text-textmuted text-[10px] font-bold uppercase tracking-wider mb-1">Characters</div>
                  <div className="text-lg font-bold text-textmain flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-primary" />
                    {stats.characterCount?.toLocaleString() || '—'}
                  </div>
                </div>

                <div className="bg-darkbg/40 border border-darkborder/50 p-3.5 rounded-2xl">
                  <div className="text-textmuted text-[10px] font-bold uppercase tracking-wider mb-1">Read Time</div>
                  <div className="text-lg font-bold text-textmain flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-primary" />
                    {stats.estimatedReadingTime ? `${stats.estimatedReadingTime} min` : '—'}
                  </div>
                </div>

                <div className="bg-darkbg/40 border border-darkborder/50 p-3.5 rounded-2xl">
                  <div className="text-textmuted text-[10px] font-bold uppercase tracking-wider mb-1">Pages / Slides</div>
                  <div className="text-lg font-bold text-textmain flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    {doc.pageCount || '—'}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-darkborder" />

            {/* General Metadata */}
            <div className="space-y-3.5 text-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted">File Information</h3>
              
              <div className="flex justify-between">
                <span className="text-textmuted font-medium">File Size</span>
                <span className="text-textmain font-semibold">{formatBytes(doc.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textmuted font-medium">Upload Date</span>
                <span className="text-textmain font-semibold flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-textmuted" />
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-textmuted font-medium">MIME Type</span>
                <span className="text-textmain font-semibold text-xs truncate max-w-[160px]" title={doc.mimeType}>
                  {doc.mimeType}
                </span>
              </div>
            </div>

            {/* Document summary / tags */}
            {doc.summary && (
              <>
                <hr className="border-darkborder" />
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted">Extracted Summary</h3>
                  <p className="text-xs text-textmuted bg-darkbg/20 border border-darkborder/40 p-3.5 rounded-2xl leading-relaxed italic">
                    "{doc.summary}"
                  </p>
                </div>
              </>
            )}

            {doc.tags && doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {doc.tags.map((tag) => (
                  <span key={tag} className="bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-2.5 py-1 rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Text Content Viewer (2/3) */}
        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-140px)] min-h-[450px]">
          <div className="glass-panel rounded-3xl p-6 flex flex-col h-full">
            
            {/* Viewer Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
              <h3 className="font-bold text-textmain text-lg self-start sm:self-center">Extracted Text Content</h3>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filter lines..."
                  value={textSearch}
                  onChange={(e) => setTextSearch(e.target.value)}
                  className="flex-1 sm:w-48 bg-darkbg border border-darkborder rounded-xl px-3.5 py-1.5 text-xs text-textmain placeholder-textmuted focus:outline-none focus:border-primary"
                />

                <button
                  onClick={handleCopy}
                  disabled={!text}
                  className="flex items-center gap-2 bg-darksurface hover:bg-darkborder border border-darkborder px-3.5 py-1.5 rounded-xl text-xs font-medium text-textmain transition disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Text Box */}
            <div className="flex-1 bg-darkbg border border-darkborder rounded-2xl p-5 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap select-text relative">
              {isTextLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-darkbg/80">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-textmuted mt-2">Loading text content...</p>
                </div>
              ) : !text ? (
                <div className="text-center py-12 text-textmuted">
                  No text content extracted or empty document.
                </div>
              ) : (
                (() => {
                  if (highlightChunk && highlightStart !== -1) {
                    return (
                      <>
                        <span>{text.substring(0, highlightStart)}</span>
                        <span 
                          id="highlighted-citation" 
                          className="bg-yellow-950/40 text-yellow-100 border border-yellow-500/85 px-3 py-2 rounded-2xl font-bold relative inline-block my-3 shadow-lg shadow-yellow-500/10"
                        >
                          <span className="absolute -top-3.5 left-3 bg-yellow-500 text-black text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow-md flex items-center gap-1 z-10 select-none">
                            <Brain className="w-3 h-3 shrink-0" /> Cited Chunk #{highlightChunk.chunkIndex}
                          </span>
                          {text.substring(highlightStart, highlightStart + chunkContent.length)}
                        </span>
                        <span>{text.substring(highlightStart + chunkContent.length)}</span>
                      </>
                    );
                  }

                  if (!textSearch) return text;
                  const lines = text.split('\n');
                  const filtered = lines.filter(line => 
                    line.toLowerCase().includes(textSearch.toLowerCase())
                  );
                  return filtered.length > 0 
                    ? filtered.join('\n') 
                    : `--- No matching lines found for "${textSearch}" ---`;
                })()
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
export default DocumentDetailsPage;
