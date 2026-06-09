import { pgTable, uuid, varchar, timestamp, bigint, integer, text, jsonb, real, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Custom vector type for pgvector ---
export const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)'; // nomic-embed-text uses 768 dimensions
  },
  toDriver(value: number[]): string {
    if (!Array.isArray(value)) return '[]';
    return `[${value.join(',')}]`;
  },
  fromDriver(value: any): number[] {
    if (!value) return [];
    if (typeof value === 'string') {
      return value.replace(/[\[\]]/g, '').split(',').map(Number);
    }
    return value;
  }
});

// --- Users Table ---
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Refresh Tokens Table ---
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Documents Table ---
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 50 }).default('uploading').notNull(), // 'uploading' | 'processing' | 'ready' | 'failed'
  pageCount: integer('page_count'),
  summary: text('summary'),
  tags: jsonb('tags'), // string[]
  processingMetadata: jsonb('processing_metadata'), // wordCount, characterCount, estimatedReadingTime, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Document Chunks Table ---
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  pageNumber: integer('page_number'),
  wordCount: integer('word_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Embeddings Table ---
export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  chunkId: uuid('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }).notNull(),
  embeddingModel: varchar('embedding_model', { length: 255 }).notNull(),
  vectorDimension: integer('vector_dimension').notNull(),
  embedding: vector('embedding').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Search Logs Table for Analytics ---
export const searchLogs = pgTable('search_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  query: text('query').notNull(),
  retrievalTimeMs: integer('retrieval_time_ms').notNull(),
  chunksSearched: integer('chunks_searched').notNull(),
  topScore: real('top_score').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Search Evaluations Table ---
export const searchEvaluations = pgTable('search_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  query: text('query').notNull(),
  retrievedChunkIds: jsonb('retrieved_chunk_ids').notNull(), // string[]
  relevanceScore: integer('relevance_score').notNull(), // rating from 1 to 5
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Conversations Table ---
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Messages Table (Modified in Phase 3) ---
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  retrievalLatencyMs: integer('retrieval_latency_ms'), // Added in Phase 3
  answerLatencyMs: integer('answer_latency_ms'), // Added in Phase 3
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Citations Table (Added in Phase 3) ---
export const citations = pgTable('citations', {
  id: uuid('id').primaryKey().defaultRandom(),
  answerId: uuid('answer_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  chunkId: uuid('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }).notNull(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  pageNumber: integer('page_number'),
  similarityScore: real('similarity_score').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  documents: many(documents),
  conversations: many(conversations),
  searchLogs: many(searchLogs),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, { fields: [documents.userId], references: [users.id] }),
  chunks: many(documentChunks),
  conversations: many(conversations),
  citations: many(citations),
}));

export const documentChunksRelations = relations(documentChunks, ({ one, many }) => ({
  document: one(documents, { fields: [documentChunks.documentId], references: [documents.id] }),
  embeddings: many(embeddings),
  citations: many(citations),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  chunk: one(documentChunks, { fields: [embeddings.chunkId], references: [documentChunks.id] }),
}));

export const searchLogsRelations = relations(searchLogs, ({ one }) => ({
  user: one(users, { fields: [searchLogs.userId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  document: one(documents, { fields: [conversations.documentId], references: [documents.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  citations: many(citations),
}));

export const citationsRelations = relations(citations, ({ one }) => ({
  message: one(messages, { fields: [citations.answerId], references: [messages.id] }),
  chunk: one(documentChunks, { fields: [citations.chunkId], references: [documentChunks.id] }),
  document: one(documents, { fields: [citations.documentId], references: [documents.id] }),
}));
