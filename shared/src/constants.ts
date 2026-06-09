export const SUPPORTED_MIME_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export const ACCEPTED_FILE_EXTENSIONS = ['.pdf', '.docx', '.pptx'] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DOCUMENT_STATUSES = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
} as const;
