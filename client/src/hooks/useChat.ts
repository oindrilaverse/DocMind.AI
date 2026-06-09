import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CitationItem {
  id?: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  similarityScore: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrievalLatencyMs?: number | null;
  answerLatencyMs?: number | null;
  createdAt: string;
  citations?: CitationItem[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface ChatAskResponse {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  citations: CitationItem[];
}

export interface RagAnalytics {
  questionsAsked: number;
  avgRetrievalLatencyMs: number;
  avgAnswerLatencyMs: number;
  citationsPerAnswer: number;
  retrievalAccuracy: number;
}

export function useChat() {
  const queryClient = useQueryClient();

  // Query: Get full conversation histories
  const useHistoryQuery = () => {
    return useQuery<Conversation[]>({
      queryKey: ['chat', 'history'],
      queryFn: async () => {
        const response = await api.get('/chat/history');
        return response.data;
      },
    });
  };

  // Query: Get citations for a specific answer
  const useCitationsQuery = (answerId: string) => {
    return useQuery<CitationItem[]>({
      queryKey: ['chat', 'citations', answerId],
      queryFn: async () => {
        const response = await api.get(`/chat/citations/${answerId}`);
        return response.data;
      },
      enabled: !!answerId,
    });
  };

  // Query: Get RAG performance/accuracy analytics
  const useAnalyticsQuery = () => {
    return useQuery<RagAnalytics>({
      queryKey: ['chat', 'analytics'],
      queryFn: async () => {
        const response = await api.get('/chat/analytics');
        return response.data;
      },
    });
  };

  // Mutation: Submit user question and generate grounded RAG answer
  const askMutation = useMutation<
    ChatAskResponse,
    Error,
    { query: string; conversationId?: string; documentId?: string }
  >({
    mutationFn: async ({ query, conversationId, documentId }) => {
      const response = await api.post('/chat/ask', {
        query,
        conversationId: conversationId || undefined,
        documentId: documentId || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate both chat history and analytics so components fetch latest state
      queryClient.invalidateQueries({ queryKey: ['chat', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'analytics'] });
    },
  });

  return {
    useHistory: useHistoryQuery,
    useCitations: useCitationsQuery,
    useAnalytics: useAnalyticsQuery,
    askQuestion: askMutation.mutateAsync,
    isAsking: askMutation.isPending,
    askError: askMutation.error,
  };
}
