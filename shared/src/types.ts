export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface DocumentProcessingMetadata {
  wordCount?: number;
  characterCount?: number;
  estimatedReadingTime?: number;
  fileType?: string;
  error?: string;
  [key: string]: any;
}

export interface Document {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  pageCount: number | null;
  summary: string | null;
  tags: string[] | null;
  processingMetadata: DocumentProcessingMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  createdAt: string;
}

export interface Embedding {
  id: string;
  chunkId: string;
  embeddingModel: string;
  vectorDimension: number;
  createdAt: string;
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
}
