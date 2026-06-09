# DocMind AI — Developer Documentation & Future Extension Guide

Welcome to the **DocMind AI** developer guide. This document details the **Phase 3: RAG Answer Generation and Citation Engine** architecture.

---

## 1. System Architecture

DocMind AI uses a monorepo structure containing three distinct packages:
1. **`shared`**: Holds canonical TypeScript types and constants.
2. **`server`**: An Express API v1 server communicating with PostgreSQL + pgvector and local Ollama.
3. **`client`**: A React + TypeScript single-page application bundled with Vite and styled with Tailwind CSS.

### Complete Data Lifecycle Flow (Phase 3: Active)

#### A. Document ingestion Pipeline (Phases 1 & 2)
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
                                                      │
                                                      ▼ (Bulk Chunks Saved to DB)
                                              [OllamaEmbeddingProvider] (nomic-embed-text)
                                                      │
                                                      ▼ (768-Dim Vectors Generated)
                                              [VectorStoreProvider] ──> Saves to [pgvector]
```

#### B. RAG Answer Generation & Citation Pipeline (Phase 3: Active)
```
[User Question]
       │
       ▼
[Generate Query Embedding] (nomic-embed-text)
       │
       ▼
[Semantic Retrieval] (Top-5 chunks from pgvector)
       │
       ▼
[Context Builder] (Preserves metadata, ranks chunks, builds prompt)
       │
       ▼
[Ollama LLM] (llama3.2 Local Generation with low temperature)
       │
       ▼
[Grounded Answer]
       │
       ▼
[Citation Engine] (Validates sources, writes to DB, replaces tags in UI)
       │
       ▼
[UI View] (Renders answer, expandable citation cards, highlights source text)
```

---

## 2. Retrieval & RAG Architecture Layers

The semantic retrieval and RAG pipeline is strictly structured to isolate business logic from database operations:

```
[ChatRoutes / ChatController]
         │ (Handles POST /ask, GET /history, GET /analytics, GET /citations/:answerId)
         ▼
[ChatService]
         │ (Orchestrates RAG QA flow: calls embedding, retrieval, prompts, LLM, citations, and logs latency)
         ▼
[ContextBuilderService]
         │ (Collects chunks, preserves metadata, ranks, enforces character limit, structures system prompt)
         ▼
[OllamaLLMProvider] (IMPLEMENTS ILLMProvider)
         │ (Checks local Ollama service health, makes API generation calls to llama3.2 with backoff retries)
         ▼
[CitationService]
         │ (Tracks chunk references, extracts valid cited UUIDs, saves citations in DB, returns clean response tags)
         ▼
[PostgreSQL Database] (Stores messages, conversations, and citations tables)
```

---

## 3. Database Schema Layout

The Drizzle ORM schema (`server/src/db/schema.ts`) has been configured for pgvector and Phase 3 analytics.

### Active Tables
- **`users`**: Manages user credentials and session validation.
- **`refresh_tokens`**: Implements secure cookie-based token rotation.
- **`documents`**: Tracks filenames, processing statuses, and includes computed metrics (word counts, page counts, estimated read times).
- **`document_chunks`**: Stores text chunks (500 words size, 100 words overlap) with their corresponding word count and page reference.
- **`embeddings`**: Stores the 768-dimension nomic-embed-text vector embedding for each chunk utilizing the `vector(768)` type.
- **`search_logs`**: Tracks query metadata (latency, chunks searched, top similarity score) for search analytics.
- **`search_evaluations`**: Prepared placeholder schema to track evaluation scores (relevance ratings) in future phases.
- **`conversations`**: Manages chat sessions owned by users.
- **`messages`**: Stores conversation thread messages. Extended in Phase 3 to track `retrievalLatencyMs` and `answerLatencyMs` for RAG performance tracking.
- **`citations`**: Links assistant messages (answers) to retrieved chunks. Stores `answerId`, `chunkId`, `documentId`, `pageNumber`, `similarityScore`, and timestamp.

---

## 4. Key Phase 3 Services

### A. ContextBuilderService (`server/src/services/context.builder.ts`)
Ranks context chunks by similarity score, formats them with document title, page number, and chunk UUID, and truncates text at 8,000 characters to prevent context window overflow. Formulates a strict system prompt instructing the LLM to only answer from context or reply *"I could not find that information in the uploaded documents."*

### B. OllamaLLMProvider (`server/src/services/ollama.llm.ts`)
Wrapper around local Ollama `/api/generate` using model `llama3.2` with low temperature (`0.1`) to prevent hallucinations. Includes connection health checking and exponential backoff retry wrappers (3 attempts).

### C. CitationService (`server/src/services/citation.service.ts`)
Extracts cited UUIDs (`[Ref: <UUID>]`) from the raw LLM response. Validates that the cited chunks were actually retrieved (preventing hallucinated citations). Stores citation rows in PostgreSQL, and maps UUID tags to clean index tags (e.g. `[1]`, `[2]`) in the returned response.

### D. ChatService (`server/src/services/chat.service.ts`)
Main orchestrator that ties the user question, embedding generation, context builder, Ollama LLM, and citation service together, logging latency metrics to database records and aggregating them for dashboard analytics.

---

## 5. Extensibility & Future Compatibility Placeholders

The codebase defines decoupled interfaces under `server/src/interfaces/` to prepare for enterprise scaling:

- **`IRerankingProvider`** (`reranking.interface.ts`): Hook to re-rank retrieved chunks (e.g., using Cohere Rerank) to minimize LLM context noise.
- **`IMultiDocumentReasoningProvider`** (`multidoc.interface.ts`): Hook to perform multi-document semantic queries and synthesis.
- **`IOCRRetrievalProvider`** (`ocr.interface.ts`): Hook to resolve OCR citation regions on original documents.
- **`IAnswerEvaluationProvider`** (`rag.interface.ts`): Hook to evaluate RAG answer faithfulness, relevance, and grounding.
- **`IAgentWorkflowProvider`** (`agent_workflow.interface.ts`): Hook to coordinate multi-step autonomous RAG agent workflows.
