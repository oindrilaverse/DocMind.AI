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
}

export interface SearchResponse {
  results: SearchResultItem[];
  metrics: {
    retrievalTimeMs: number;
    chunksSearched: number;
    topScore: number;
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
    limit?: number
  ): Promise<SearchResponse> => {
    const response = await api.post('/search/query', {
      query,
      documentId: documentId || undefined,
      limit,
    });
    return response.data;
  };

  return {
    useStats: useStatsQuery,
    useOllamaStatus: useOllamaStatusQuery,
    executeSearch,
  };
}
