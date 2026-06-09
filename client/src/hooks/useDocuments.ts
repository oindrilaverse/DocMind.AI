import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Document } from '@docmind/shared';

export function useDocuments() {
  const queryClient = useQueryClient();

  // Query: Get all documents
  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: async (): Promise<Document[]> => {
      const response = await api.get('/documents');
      return response.data;
    },
  });

  // Query: Get a single document
  const useDocumentQuery = (id: string) => {
    return useQuery({
      queryKey: ['documents', id],
      queryFn: async (): Promise<Document> => {
        const response = await api.get(`/documents/${id}`);
        return response.data;
      },
      enabled: !!id,
      refetchInterval: (query) => {
        // Automatically poll if status is 'uploading' or 'processing'
        const doc = query.state.data as Document | undefined;
        if (doc && (doc.status === 'uploading' || doc.status === 'processing')) {
          return 2000; // Poll every 2 seconds
        }
        return false;
      },
    });
  };

  // Query: Get document extracted text
  const useDocumentTextQuery = (id: string, enabled: boolean = true) => {
    return useQuery({
      queryKey: ['documents', id, 'text'],
      queryFn: async (): Promise<string> => {
        const response = await api.get(`/documents/${id}/text`);
        return response.data.text;
      },
      enabled: enabled && !!id,
    });
  };

  // Query: Get single chunk details
  const useDocumentChunkQuery = (chunkId: string) => {
    return useQuery({
      queryKey: ['chunks', chunkId],
      queryFn: async (): Promise<any> => {
        const response = await api.get(`/documents/chunks/${chunkId}`);
        return response.data;
      },
      enabled: !!chunkId,
    });
  };

  // Mutation: Upload document
  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<Document> => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Mutation: Delete document
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return {
    documents: documentsQuery.data || [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    refetch: documentsQuery.refetch,
    
    useDocument: useDocumentQuery,
    useDocumentText: useDocumentTextQuery,
    useDocumentChunk: useDocumentChunkQuery,
    
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    
    deleteDoc: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
