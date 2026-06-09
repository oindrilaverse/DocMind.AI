# DocMind AI

### Enterprise Knowledge Assistant with Semantic Search, Retrieval-Augmented Generation (RAG), and Citation-Based Answers powered by Ollama.

**DocMind AI** is a production-ready, enterprise-grade AI Knowledge Assistant that transforms unstructured files (PDF, DOCX, PPTX) into a secure, searchable, and highly privacy-focused local knowledge repository. By combining dense semantic search (via PostgreSQL + pgvector) and Retrieval-Augmented Generation (RAG), the platform delivers grounded responses with verifiable inline citations, ensuring zero hallucinations and complete data sovereignty.

---

## 💼 Resume & Portfolio Summary

### **DocMind AI — Enterprise Knowledge Assistant with RAG and Citation-Based Retrieval**
> *Built a full-stack AI knowledge assistant supporting PDF, DOCX, and PPTX ingestion, semantic retrieval, Retrieval-Augmented Generation (RAG), and citation-based answering using Ollama, PostgreSQL, and pgvector.*
>
> *Implemented document chunking, embedding pipelines, vector search, source attribution, and scalable retrieval architecture for enterprise knowledge management.*

---

## 🚀 Key Features

- **Multi-Format Ingestion**: Direct text extraction pipelines for PDF, DOCX, and PPTX files.
- **Paragraph-Aware Sliding Chunking**: Splitting text into 500-word blocks with 100-word overlap, respecting structural boundaries.
- **pgvector Database Storage**: Vector-native semantic lookup utilizing PostgreSQL's `pgvector` datatype and HNSW indexing for rapid cosine similarity calculations.
- **Grounded Prompt Context Assembly**: Merges user queries with the top 5 retrieved context chunks into an optimized grounding context.
- **Local Privacy-First LLM**: Completion outputs generated locally using **Ollama** running `llama3.2` with low temperature (`0.1`) for strict data compliance.
- **Hallucination-Resistant Citation Engine**: Cross-checks and validates LLM references against the retrieved database context, generating visual citation badges.
- **Highlight-Aware Source Navigation**: Clicking a citation badge instantly opens the source document view, scrolls directly to the cited chunk, and highlights it.
- **RAG Analytics & Monitoring**: Embedded dashboard monitors showing questions asked, retrieval latency, generation latency, citation density, and average retrieval accuracy.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph "Ingestion Pipeline"
        A[File Upload: PDF/DOCX/PPTX] --> B[StorageService]
        B --> C[ExtractionService]
        C --> D[StorageService: Extracted Text]
        D --> E[ChunkingService]
        E --> F[OllamaEmbeddingProvider: nomic-embed-text]
        F --> G[(PostgreSQL + pgvector)]
    end

    subgraph "RAG Conversation Pipeline"
        H[User Question] --> I[Generate Query Embedding]
        I --> J[Semantic Retrieval: Top-5 Chunks]
        J --> K[Context Builder: Rank Chunks]
        K --> L[OllamaLLMProvider: llama3.2]
        L --> M[Citation Engine: Map & Validate Citations]
        M --> N[Grounded Answer & Interactive Citations]
        N --> O[UI Render & Highlight Navigation]
    end
```

---

## 🛠️ Tech Stack

- **Frontend**: React (TypeScript), Vite, Tailwind CSS, React Query, React Router DOM, Zustand.
- **Backend**: Node.js, Express (TypeScript), Drizzle ORM.
- **Database**: PostgreSQL with `pgvector` extension.
- **AI/LLM**: Local Ollama (`nomic-embed-text` for embeddings, `llama3.2` for completions).
- **CI/CD**: GitHub Actions (Linting, TypeScript checking, automated build verification).

---

## 📦 Installation Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) (v15+ with pgvector extension)
- [Ollama](https://ollama.com/) (installed and running locally)

### 1. Clone and Configure
Clone this repository and create your local environment file:
```bash
git clone https://github.com/oindrilaverse/DocMind.AI.git
cd DocMind.AI
cp .env.example .env
```

### 2. Configure Environment Variables
Open the `.env` file and configure the values:
```env
PORT=5000
DATABASE_URL=postgres://your_user:your_password@localhost:5432/docmind_ai
JWT_ACCESS_SECRET=your_jwt_access_secret_should_be_long_and_secure
JWT_REFRESH_SECRET=your_jwt_refresh_secret_should_be_long_and_secure
CLIENT_URL=http://localhost:5173
```

### 3. Initialize Ollama
Ensure Ollama is running and pull the required models:
```bash
# Pull model for embedding chunks
ollama pull nomic-embed-text

# Pull model for grounded QA answer generation
ollama pull llama3.2
```

### 4. Database Setup
DocMind AI uses Drizzle ORM for database migrations. To apply migrations to your database:
```bash
# Install root dependencies
npm install

# Run Drizzle migrations
npm run db:migrate --workspace=server
```

---

## 💻 Local Development Setup

To run both the Express backend and Vite frontend simultaneously:
```bash
npm run dev
```
- Frontend will open at: `http://localhost:5173`
- Backend will run at: `http://localhost:5000`

---

## 🔌 API Endpoints

### Authentication
- `POST /api/v1/auth/register` — Register a new user
- `POST /api/v1/auth/login` — Login user and issue cookies
- `POST /api/v1/auth/refresh` — Issue new access token using refresh cookie
- `POST /api/v1/auth/logout` — Revoke refresh token and clear cookies

### Documents
- `POST /api/v1/documents/upload` — Ingest document (PDF, DOCX, PPTX)
- `GET /api/v1/documents` — List user's documents
- `GET /api/v1/documents/:id` — Get document metadata
- `GET /api/v1/documents/:id/text` — Get document plain text
- `DELETE /api/v1/documents/:id` — Delete document

### Semantic Search & RAG Chat
- `POST /api/v1/search/query` — Semantic search retrieval (vector distance)
- `POST /api/v1/chat/ask` — Ask RAG query (grounded completion)
- `GET /api/v1/chat/history` — Get conversation history with inline citations
- `GET /api/v1/citations/:answerId` — Get citation metadata for a message
- `GET /api/v1/chat/analytics` — Fetch RAG latency and accuracy analytics

---

## 🎨 Screenshots Section

*(Insert screenshots of your running dashboard, semantic search panel, and AI chat with citation cards here)*

---

## 🔮 Future Roadmap

- **Hybrid Search**: Combine dense vector embeddings with sparse keyword search (BM25) for enhanced retrieval accuracy.
- **Document Re-ranking**: Integrate cross-encoder models (e.g. Cohere Rerank) to filter out retrieved noise prior to prompt completion.
- **Multi-Document Reasoning**: Enable synthesization and logic reasoning across non-contiguous documents.
- **OCR Enhancements**: Implement tesseract or cloud OCR engines to transcribe text from scanned images and PDFs.

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).
