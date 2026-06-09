CREATE TABLE IF NOT EXISTS "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer_id" uuid NOT NULL,
	"chunk_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer,
	"similarity_score" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retrieval_latency_ms" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "answer_latency_ms" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "citations" ADD CONSTRAINT "citations_answer_id_messages_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "citations" ADD CONSTRAINT "citations_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "citations" ADD CONSTRAINT "citations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
