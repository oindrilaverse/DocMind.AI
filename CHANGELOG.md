# Changelog

All notable changes to **DocMind.AI** will be documented in this file.

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
