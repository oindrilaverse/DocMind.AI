import { db } from '../db';
import { documentChunks, documents } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { IRetrievalProvider, RetrievalResult } from '../interfaces/retrieval.interface';
import { IVectorStoreProvider } from '../interfaces/vectorstore.interface';
import { DocumentChunk } from '@docmind/shared';

export class RetrievalProvider implements IRetrievalProvider {
  private vectorStore: IVectorStoreProvider;

  constructor(vectorStore: IVectorStoreProvider) {
    this.vectorStore = vectorStore;
  }

  /**
   * Performs semantic query execution and resolves matching text chunk records
   */
  async retrieveChunks(
    queryVector: any, // in Phase 2 this is the query embedding vector (number[])
    documentIds: string[],
    limit: number
  ): Promise<RetrievalResult[]> {
    // Scoping check: Phase 2 supports single document or all documents scope
    const scopedDocId = documentIds.length === 1 ? documentIds[0] : undefined;

    // 1. Get similar chunk IDs from vector store
    const similarityResults = await this.vectorStore.similaritySearch(
      queryVector as number[],
      limit,
      scopedDocId
    );

    if (similarityResults.length === 0) {
      return [];
    }

    const chunkIds = similarityResults.map((res) => res.chunkId);

    // 2. Fetch chunk and document details from database
    const chunkRecords = await db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        wordCount: documentChunks.wordCount,
        createdAt: documentChunks.createdAt,
        documentName: documents.originalName,
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(inArray(documentChunks.id, chunkIds));

    // Map DB records to shared DocumentChunk interfaces and return with scores
    const enrichedResults: RetrievalResult[] = similarityResults.map((simRes) => {
      const match = chunkRecords.find((rec) => rec.id === simRes.chunkId);
      if (!match) {
        throw new Error(`Integrity error: chunk ${simRes.chunkId} in vector store not found in database`);
      }

      const chunk: DocumentChunk & { documentName?: string } = {
        id: match.id,
        documentId: match.documentId,
        chunkIndex: match.chunkIndex,
        content: match.content,
        pageNumber: match.pageNumber,
        createdAt: match.createdAt.toISOString(),
      };
      
      // Attach extra detail for UI display
      chunk.documentName = match.documentName;

      return {
        chunk,
        score: simRes.score,
      };
    });

    return enrichedResults;
  }
}
