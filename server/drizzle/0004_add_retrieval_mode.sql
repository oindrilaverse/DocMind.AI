-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 0004_add_retrieval_mode
-- Phase 5: Hybrid Search integration
-- Adds columns to track, log, and evaluate query retrieval modes
-- and weights in both search_logs and ai_evaluations tables.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "search_logs" ADD COLUMN "avg_score" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "search_logs" ADD COLUMN "retrieval_mode" varchar(50) DEFAULT 'semantic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "search_logs" ADD COLUMN "semantic_weight" real;
--> statement-breakpoint
ALTER TABLE "search_logs" ADD COLUMN "keyword_weight" real;
--> statement-breakpoint

ALTER TABLE "ai_evaluations" ADD COLUMN "retrieval_mode" varchar(50) DEFAULT 'semantic' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD COLUMN "semantic_weight" real;
--> statement-breakpoint
ALTER TABLE "ai_evaluations" ADD COLUMN "keyword_weight" real;
