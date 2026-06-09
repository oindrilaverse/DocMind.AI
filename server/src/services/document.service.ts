import { db } from '../db';
import { documents, documentChunks } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { StorageService } from './storage.service';
import { ExtractionService } from './extraction.service';
import { ChunkingService } from './chunking.service';
import { OllamaEmbeddingProvider } from './ollama.embedding';
import { VectorStoreProvider } from './vectorstore.provider';
import { Document, DocumentStatus, DocumentProcessingMetadata } from '@docmind/shared';

export class DocumentService {
  /**
   * Creates a new document record and initiates asynchronous text extraction
   */
  static async createDocument(params: {
    userId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  }): Promise<Document> {
    const [docRecord] = await db.insert(documents).values({
      userId: params.userId,
      filename: params.filename,
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: params.size,
      status: 'uploading',
    }).returning();

    // Start background processing
    this.processDocumentBackground(docRecord.id, params.filename, params.mimeType);

    return this.mapDbToSharedDocument(docRecord);
  }

  /**
   * Retrieves all documents owned by a user
   */
  static async getDocumentsByUser(userId: string): Promise<Document[]> {
    const docs = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
      orderBy: [desc(documents.createdAt)],
    });

    return docs.map(this.mapDbToSharedDocument);
  }

  /**
   * Retrieves a single document by ID and verifies owner
   */
  static async getDocumentById(id: string, userId: string): Promise<Document | null> {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) return null;
    return this.mapDbToSharedDocument(doc);
  }

  /**
   * Retrieves a single document chunk by ID and verifies owner
   */
  static async getChunkById(chunkId: string, userId: string) {
    const chunk = await db.query.documentChunks.findFirst({
      where: eq(documentChunks.id, chunkId),
      with: {
        document: true,
      },
    });

    if (!chunk || chunk.document.userId !== userId) {
      return null;
    }

    return {
      id: chunk.id,
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      wordCount: chunk.wordCount,
      createdAt: chunk.createdAt.toISOString(),
    };
  }

  /**
   * Deletes a document from the database and removes files from storage
   */
  static async deleteDocument(id: string, userId: string): Promise<boolean> {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) {
      return false;
    }

    // Delete DB record first (cascade constraints will clean up related records if any exist)
    await db.delete(documents).where(eq(documents.id, id));

    // Delete actual files asynchronously
    StorageService.deleteDocumentFiles(doc.filename, doc.id);

    return true;
  }

  /**
   * Reads the extracted plain text of a document
   */
  static async getDocumentText(id: string, userId: string): Promise<string> {
    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) {
      throw new Error('Document not found or unauthorized');
    }

    if (doc.status !== 'ready') {
      throw new Error(`Document text is not available. Current status: ${doc.status}`);
    }

    return await StorageService.readExtractedText(doc.id);
  }

  /**
   * Background task to process text extraction, update DB statuses, and generate statistics
   */
  private static async processDocumentBackground(id: string, filename: string, mimeType: string) {
    try {
      // 1. Update status to 'processing'
      await db.update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, id));

      const originalFilePath = StorageService.getOriginalFilePath(filename);

      // 2. Perform text extraction
      const { text, pageCount } = await ExtractionService.extractText(originalFilePath, mimeType);

      // 3. Save extracted plain text to files folder
      await StorageService.saveExtractedText(id, text);

      // --- Phase 2: Document Chunking ---
      const chunks = ChunkingService.splitText(text, pageCount);
      const chunksGeneratedCount = chunks.length;
      let embeddingsGeneratedCount = 0;
      let ollamaOffline = false;

      if (chunks.length > 0) {
        // Bulk insert chunks
        const chunkValues = chunks.map((c) => ({
          documentId: id,
          chunkIndex: c.chunkIndex,
          content: c.content,
          pageNumber: c.pageNumber,
          wordCount: c.wordCount,
        }));
        
        const insertedChunks = await db.insert(documentChunks).values(chunkValues).returning();

        // --- Phase 2: Ollama Embedding Pipeline ---
        const embeddingProvider = new OllamaEmbeddingProvider();
        const vectorStore = new VectorStoreProvider();

        const isOllamaOnline = await embeddingProvider.checkHealth();
        if (isOllamaOnline) {
          try {
            console.log(`[Ollama] Generating embeddings for ${insertedChunks.length} chunks...`);
            const embeddingRecords = [];
            for (const chunk of insertedChunks) {
              const vector = await embeddingProvider.generateEmbedding(chunk.content);
              embeddingRecords.push({
                chunkId: chunk.id,
                embedding: vector,
                embeddingModel: 'nomic-embed-text',
                vectorDimension: 768,
              });
            }
            // Store vector embeddings using pgvector
            await vectorStore.storeEmbeddings(embeddingRecords);
            embeddingsGeneratedCount = embeddingRecords.length;
          } catch (embedError) {
            console.error('[Ollama] Failed to generate/store embeddings:', embedError);
            ollamaOffline = true;
          }
        } else {
          console.warn('[Ollama] Offline. Skipping embedding generation. Proceeding with plain text.');
          ollamaOffline = true;
        }
      }

      // 4. Calculate stats for processing_metadata
      const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
      const characterCount = text.length;
      // Standard reading speed is roughly 200 words per minute
      const estimatedReadingTime = Math.max(1, Math.round(wordCount / 200));

      const fileExtension = filename.split('.').pop()?.toUpperCase() || 'UNKNOWN';

      const processingMetadata: DocumentProcessingMetadata = {
        wordCount,
        characterCount,
        estimatedReadingTime,
        fileType: fileExtension,
        chunksGenerated: chunksGeneratedCount,
        embeddingsGenerated: embeddingsGeneratedCount,
        ollamaOffline,
      };

      // Generate tags based on file type / pages / chunk counts
      const tags = [fileExtension];
      if (pageCount) {
        tags.push(`${pageCount} Page${pageCount > 1 ? 's' : ''}`);
      } else {
        tags.push('Document');
      }
      tags.push(`${chunksGeneratedCount} Chunk${chunksGeneratedCount !== 1 ? 's' : ''}`);

      // Generate a small mock summary (e.g. first 150 chars followed by '...')
      const cleanSummary = text.length > 150 
        ? text.substring(0, 150).replace(/\n/g, ' ').trim() + '...' 
        : text.replace(/\n/g, ' ').trim() || 'No text extracted.';

      // 5. Update DB record to 'ready'
      await db.update(documents)
        .set({
          status: 'ready',
          pageCount,
          summary: cleanSummary,
          tags,
          processingMetadata,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      console.log(`Successfully processed document: ${id} (${filename}). Chunks: ${chunksGeneratedCount}, Vectors: ${embeddingsGeneratedCount}`);
    } catch (error: any) {
      console.error(`Failed to process document: ${id}`, error);

      const errorMetadata: DocumentProcessingMetadata = {
        error: error.message || 'Unknown extraction error',
      };

      await db.update(documents)
        .set({
          status: 'failed',
          processingMetadata: errorMetadata,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));
    }
  }

  /**
   * Map Drizzle database model to Shared Document Interface
   */
  private static mapDbToSharedDocument(doc: any): Document {
    return {
      id: doc.id,
      userId: doc.userId,
      filename: doc.filename,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      size: Number(doc.size),
      status: doc.status as DocumentStatus,
      pageCount: doc.pageCount,
      summary: doc.summary,
      tags: doc.tags as string[] | null,
      processingMetadata: doc.processingMetadata as DocumentProcessingMetadata | null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
