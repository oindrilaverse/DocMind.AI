CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"retrieved_chunk_ids" jsonb NOT NULL,
	"relevance_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "search_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"query" text NOT NULL,
	"retrieval_time_ms" integer NOT NULL,
	"chunks_searched" integer NOT NULL,
	"top_score" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "word_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "embedding" "vector(768)" NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embeddings_embedding_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
