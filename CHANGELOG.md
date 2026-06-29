# Changelog

All notable changes to **DocMind.AI** will be documented in this file.

---

## [1.2.0] - 2026-06-29
### Added
- **Phase 6: Cross-Encoder Reranking & Benchmarking**:
  - Integrated provider-based Reranking architecture (`IRerankerProvider`) supporting local N-gram proximity cross-encoder and Cohere `/v1/rerank` API.
  - Hot-swappable environment-driven configuration variables (`RERANKER_ENABLED`, `RERANKER_PROVIDER`, `RERANKER_CANDIDATE_COUNT`, `RERANKER_FINAL_LIMIT`).
  - Added pipeline rank-shift indicators (`#12 → #2`) and cross-encoder relevance scores inside Search results and Chat citations.
  - Created the **RAG Pipeline Benchmarking Console** (`/benchmark`) displaying latency comparison bar charts (Semantic vs Hybrid vs Reranker) via Recharts.
  - Supported real-time side-by-side RAG pipeline query playground and historical comparison runs.

## [1.1.0] - 2026-06-25
### Added
- **Phase 4 & 5: AI Evaluation Dashboard & Hybrid Search**:
  - Aggregated performance telemetry dashboard visualizing response times, daily usage, citation densities, and similarity score distributions.
  - Configurable Max-Score normalized weighted score fusion combining PostgreSQL vector search and local Okapi BM25 keyword matching.
  - Exposed environment configurations (`HYBRID_SEMANTIC_WEIGHT` and `HYBRID_KEYWORD_WEIGHT`) to easily tune retrieval modes.
  - Interactive pipeline filters (date range, documents, retrieval modes) scoped to the authenticated user.
  - Telemetry exports in structured CSV and JSON formats.

---

## [1.0.0] - 2026-06-09
### Added
- **Phase 3: Grounded RAG & Citations Engine**:
  - Local **Ollama** LLM provider integration with model `llama3.2`.
  - Structured prompt context builder with strict grounding rules to prevent LLM hallucinations.
  - Verification citation parser and PostgreSQL storage for grounding tracing.
  - Interactive multi-session Chat UI with document context selectors.
  - Collapsible Citation Cards detailing chunk snippet previews, page indices, and match scores.
  - Highlight-aware source text viewer scrolling and centering cited content.
  - Dashboard analytics displaying avg retrieval/generation latencies and citation densities.

---

## [0.2.0] - 2026-06-05
### Added
- **Phase 2: Chunking & Retrieval Foundation**:
  - Automatic sliding-window, paragraph-aware text chunking.
  - PostgreSQL `pgvector` database storage with HNSW index configuration.
  - Local Ollama connection wrapper for generating dense vector embeddings (`nomic-embed-text`).
  - Search query router, metrics logging, and semantic retrieval panels in the client.

---

## [0.1.0] - 2026-05-28
### Added
- **Phase 1: Ingestion & Auth Core**:
  - Secure JWT authentication flow (access & refresh tokens with cookie rotation).
  - Multi-format file upload support (PDF, DOCX, PPTX).
  - Background text extraction service with file statistics metadata (read times, word counts).
  - Document dashboard list, search-by-title, and details viewer.
