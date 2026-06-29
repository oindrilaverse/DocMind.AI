# DocMind AI — Developer Documentation & Future Extension Guide

Welcome to the **DocMind AI** developer guide. This document details the system architecture and data pipelines for semantic search, hybrid retrieval, cross-encoder reranking, citation mapping, and quality benchmarking.

---

## 1. System Architecture

DocMind AI uses a decoupled monorepo structure containing three packages:
1. **`shared`**: Canonical TypeScript interfaces, type definitions, and schema constants.
2. **`server`**: An Express API v1 server communicating with PostgreSQL + pgvector, a local BM25 keyword indexer, and local/cloud models.
3. **`client`**: A React + TypeScript single-page application bundled with Vite and styled with Tailwind CSS and Recharts.

### Complete Data Lifecycle Flow

#### A. Document Ingestion Pipeline
```
[User UI] ──(Upload)──> [Multer Middleware] ──> [StorageService] (Original File)
                                                      │
                                                      ▼
                                              [ExtractionService] (PDF/DOCX/PPTX Text)
                                                      │
                                                      ▼
                                              [StorageService] (Extracted Plain Text)
                                                      │
                                                      ▼
                                              [ChunkingService] (500 words, 100 overlap)
                                                      ├────────────────────────────────┐
                                                      ▼                                ▼
                                              [BM25 Indexer] (In-Memory)      [Ollama Embedding]
                                                                                       │
                                                                                       ▼
                                                                              [pgvector Store]
```

#### B. Hybrid Retrieval & Reranking RAG Pipeline
```
                    User Query
                        │
         ┌──────────────┴──────────────┐
         ▼ (Semantic)                  ▼ (Keyword)
[pgvector Cosine Search]      [Okapi BM25 Index Search]
         │                             │
         ▼                             ▼
   [Score Normalization & Configurable Fusion]
                        │
                        ▼ (Top 20 Candidates)
            [Cross-Encoder Reranker]
           (Local Proximity or Cohere)
                        │
                        ▼ (Top 5 Final Chunks)
                 [Ollama LLM]
             (llama3.2 Grounded QA)
                        │
                        ▼
            [Citation Engine & Audit]
                        │
                        ▼
       [Answer & Position Shift Badges]
```

---

## 2. Decoupled Pipeline Layers

The retrieval and RAG pipeline is strictly isolated into provider-based interfaces:

```
[ChatRoutes / ChatController]
         │
         ▼
[ChatService] (Orchestrates QA flow, metrics logging, and citation mapping)
         │
         ├─> [SearchService] (Coordinates Semantic / Keyword / Hybrid retrieval modes)
         │         ├─> [VectorStore] (PostgreSQL pgvector)
         │         └─> [BM25Service] (Okapi BM25 indexer)
         │
         ├─> [RerankerService] (Delegates to IRerankerProvider: LocalProximity or CohereAPI)
         ├─> [ContextBuilderService] (Assembles prompt context and structures system constraints)
         ├─> [OllamaLLMProvider] (Interfaces with local Ollama daemon for generation)
         └─> [CitationService] (Validates sources, resolves shifts, maps badges, saves citations)
```

---

## 3. Database Schema Layout

The Drizzle ORM schema (`server/src/db/schema.ts`) tracks RAG execution telemetry:

* **`users`**: User registration and login credentials.
* **`refresh_tokens`**: Access token rotation and cookies.
* **`documents`**: File size, type, page counts, and estimated read times.
* **`document_chunks`**: Document body segments with page offsets and word counts.
* **`embeddings`**: The 768-dimension vector embeddings using the PostgreSQL `vector(768)` datatype.
* **`search_logs`**: Tracks query metadata (latency, top score, retrieval mode, rerank status).
* **`ai_evaluations`**: Evaluation metrics (retrieval latency, generation latency, citation coverage, hallucination score, answer completeness, token counts).
* **`conversations`**: Chat sessions.
* **`messages`**: Thread messages with latency stats.
* **`citations`**: Links answers to source document chunks, preserving initial retriever ranks, new reranked ranks, and scores.

---

## 4. Key Services & Extension Points

### A. BM25Service (`server/src/services/bm25.service.ts`)
Implements the Okapi BM25 keyword relevance algorithm. Automatically tokenizes, stems, and filters stop words to build a document term-frequency index. Operates entirely in memory for high-performance sub-millisecond keyword lookup.

### B. RerankerService (`server/src/services/rerank/`)
Coordinates top candidate scoring through an `IRerankerProvider` abstraction.
* **`LocalCrossEncoderProvider`**: Computes sequential N-gram overlaps, term proximity, and phrase distance metrics locally without internet dependencies.
* **`CohereRerankProvider`**: Connects to Cohere's cloud API for state-of-the-art transformer reranking with timeout fallbacks.

### C. EvaluationService (`server/src/services/evaluation.service.ts`)
Performs post-response telemetry logging. Measures token consumption, semantic relevance distributions, and generates exportable CSV/JSON analytics summaries.

---

## 5. Running the Pipeline Benchmarks
Developers can navigate to `/benchmark` to run performance comparisons. This utility executes parallel queries against the three retrieval tracks:
1. **Semantic Only**: Uses pgvector cosine similarity.
2. **Hybrid Only**: Combines semantic and BM25 scores with configurable weights.
3. **Hybrid + Reranker**: Performs score fusion and runs local/cloud cross-encoders.

Metrics are output side-by-side using interactive latency and score distribution charts.
