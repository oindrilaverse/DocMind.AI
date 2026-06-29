-- Migration: 0005_add_rerank_fields
-- Adds metrics and tracking columns for Cross-Encoder Reranking

ALTER TABLE "search_logs" ADD COLUMN "is_reranked" boolean DEFAULT false NOT NULL;
ALTER TABLE "search_logs" ADD COLUMN "rerank_latency_ms" integer DEFAULT 0 NOT NULL;

ALTER TABLE "citations" ADD COLUMN "original_rank" integer;
ALTER TABLE "citations" ADD COLUMN "new_rank" integer;
ALTER TABLE "citations" ADD COLUMN "rerank_score" real;

ALTER TABLE "ai_evaluations" ADD COLUMN "is_reranked" boolean DEFAULT false NOT NULL;
ALTER TABLE "ai_evaluations" ADD COLUMN "rerank_latency_ms" integer DEFAULT 0 NOT NULL;
ALTER TABLE "ai_evaluations" ADD COLUMN "reranked_chunks" integer DEFAULT 0 NOT NULL;
