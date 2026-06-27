import { pgTable, uuid, varchar, timestamp, bigint, integer, text, jsonb, real, boolean, customType } from 'drizzle-orm/pg-core';
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

// ─────────────────────────────────────────────────────────
// --- AI Evaluations Table (Added in Phase 4) ---
// Stores granular quality + performance metrics for every RAG answer.
// This is the foundation of the AI Evaluation Dashboard.
// It is written to by EvaluationService AFTER the RAG pipeline completes —
// it never blocks or modifies the answer generation process.
// ─────────────────────────────────────────────────────────
export const aiEvaluations = pgTable('ai_evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Foreign keys: link evaluation record to the exact assistant message, session, user, and optional document
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }), // nullable — not all queries target a specific doc

  // The original user question (stored for analytics/filtering)
  query: text('query').notNull(),

  // ── Latency Metrics ──────────────────────────────────────
  // retrievalLatencyMs: time from embedding the query to getting back chunks from pgvector
  retrievalLatencyMs: integer('retrieval_latency_ms').notNull(),
  // llmLatencyMs: time from sending the prompt to Ollama to receiving the completion
  llmLatencyMs: integer('llm_latency_ms').notNull(),
  // totalLatencyMs: end-to-end wall clock time (retrieval + LLM + overhead)
  totalLatencyMs: integer('total_latency_ms').notNull(),

  // ── Retrieval Metrics ─────────────────────────────────────
  // chunksRetrieved: how many context chunks were passed to the LLM (typically 5)
  chunksRetrieved: integer('chunks_retrieved').notNull(),
  // citationsCount: how many of those chunks were actually cited and validated in the answer
  citationsCount: integer('citations_count').notNull().default(0),
  // avgSimilarityScore: mean cosine similarity of all retrieved chunks (0–1). Higher = more relevant context.
  avgSimilarityScore: real('avg_similarity_score').notNull().default(0),
  // topSimilarityScore: cosine similarity of the single best-matching chunk
  topSimilarityScore: real('top_similarity_score').notNull().default(0),

  // ── Token Usage (Estimated) ───────────────────────────────
  // tokensEstimated: rough token count of the answer text (word_count × 1.3 approximation)
  tokensEstimated: integer('tokens_estimated').notNull().default(0),

  // ── Quality Metrics ───────────────────────────────────────
  // citationCoverage: citationsCount / chunksRetrieved (0–1).
  //   Measures how well the LLM uses the provided context.
  //   Low score → LLM is generating answers not grounded in the retrieved chunks.
  citationCoverage: real('citation_coverage').notNull().default(0),

  // retrievalPrecision: proxy metric using avgSimilarityScore (0–1).
  //   High precision = the retriever found highly relevant chunks.
  //   Will be replaced by proper precision@k when ground-truth labels exist.
  retrievalPrecision: real('retrieval_precision').notNull().default(0),

  // retrievalRecall: placeholder (null) until a labeled evaluation dataset is built.
  //   Recall requires knowing ALL relevant chunks for a query, which needs human annotation.
  retrievalRecall: real('retrieval_recall'), // null = not yet implemented

  // hallucinationScore: 1 - citationCoverage (0–1, rule-based proxy).
  //   0 = perfectly grounded answer. 1 = no citations, high hallucination risk.
  //   This is a heuristic — a proper hallucination detector would use NLI models.
  hallucinationScore: real('hallucination_score').notNull().default(0),

  // answerCompleteness: min(1, answer_word_count / 50).
  //   Short answers score lower. Heuristic until semantic completeness scoring is added.
  answerCompleteness: real('answer_completeness').notNull().default(0),

  // ollamaOnline: was the local Ollama LLM available during this request?
  //   If false, the answer was a fallback message, not a real RAG response.
  ollamaOnline: boolean('ollama_online').notNull().default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for aiEvaluations table
export const aiEvaluationsRelations = relations(aiEvaluations, ({ one }) => ({
  message: one(messages, { fields: [aiEvaluations.messageId], references: [messages.id] }),
  conversation: one(conversations, { fields: [aiEvaluations.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [aiEvaluations.userId], references: [users.id] }),
  document: one(documents, { fields: [aiEvaluations.documentId], references: [documents.id] }),
}));

