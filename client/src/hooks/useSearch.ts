import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface SearchResultItem {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  score: number;
  semanticScore?: number; // Added in Phase 5
  keywordScore?: number;  // Added in Phase 5
  retrievalMode?: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5
  originalRank?: number;  // Added in Phase 6: original rank in candidate pool (1-20)
  newRank?: number;       // Added in Phase 6: new rank after reranking (1-5)
  rerankScore?: number;   // Added in Phase 6: cross-encoder relevance score
}

export interface SearchResponse {
  results: SearchResultItem[];
  metrics: {
    retrievalTimeMs: number;
    chunksSearched: number;
    topScore: number;
    avgScore: number;      // Added in Phase 5
    retrievalMode: 'semantic' | 'keyword' | 'hybrid'; // Added in Phase 5
    isReranked?: boolean;   // Added in Phase 6
    rerankLatencyMs?: number; // Added in Phase 6
  };
}

export interface SearchStats {
  documentsProcessed: number;
  chunksGenerated: number;
  embeddingsGenerated: number;
  searchesPerformed: number;
}

export interface OllamaStatus {
  online: boolean;
  model: string;
}

export function useSearch() {
  // Query: Get search statistics
  const useStatsQuery = () => {
    return useQuery({
      queryKey: ['search', 'stats'],
      queryFn: async (): Promise<SearchStats> => {
        const response = await api.get('/search/stats');
        return response.data;
      },
      refetchInterval: 5000, // Refresh stats every 5 seconds dynamically
    });
  };

  // Query: Check Ollama status
  const useOllamaStatusQuery = () => {
    return useQuery({
      queryKey: ['system', 'ollama-status'],
      queryFn: async (): Promise<OllamaStatus> => {
        const response = await api.get('/system/ollama-status');
        return response.data;
      },
      refetchInterval: 10000, // Check health every 10 seconds
    });
  };

  // Custom fetch function for queries (called imperatively or conditionally)
  const executeSearch = async (
    query: string,
    documentId?: string,
    limit?: number,
    mode?: 'semantic' | 'keyword' | 'hybrid',
    rerank?: boolean // Added in Phase 6
  ): Promise<SearchResponse> => {
    const response = await api.post('/search/query', {
      query,
      documentId: documentId || undefined,
      limit,
      mode,
      rerank,
    });
    return response.data;
  };

  return {
    useStats: useStatsQuery,
    useOllamaStatus: useOllamaStatusQuery,
    executeSearch,
  };
}
