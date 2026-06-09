import { sql, eq } from 'drizzle-orm';
import { db } from '../db';
import { embeddings, documentChunks } from '../db/schema';
import { IVectorStoreProvider, VectorRecord, VectorSearchResult } from '../interfaces/vectorstore.interface';

export class VectorStoreProvider implements IVectorStoreProvider {
  /**
   * Bulk inserts generated embeddings into the database
   */
  async storeEmbeddings(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((rec) => ({
      chunkId: rec.chunkId,
      embeddingModel: rec.embeddingModel,
      vectorDimension: rec.vectorDimension,
      embedding: rec.embedding,
    }));

    await db.insert(embeddings).values(values);
  }

  /**
   * Deletes all embeddings associated with a document (via cascade delete in DB)
   */
  async deleteEmbeddings(documentId: string): Promise<void> {
    // Rely on cascade deletes from document -> documentChunks -> embeddings
    // But we can execute direct delete if required
  }

  /**
   * Queries pgvector for top-K matching document chunks using cosine distance
   */
  async similaritySearch(
    queryVector: number[],
    limit: number,
    documentId?: string
  ): Promise<VectorSearchResult[]> {
    const vectorStr = `[${queryVector.join(',')}]`;
    
    // Cosine similarity = 1 - cosine distance
    const similarityExpression = sql<number>`1 - (${embeddings.embedding} <=> ${vectorStr}::vector)`;

    const query = db
      .select({
        chunkId: embeddings.chunkId,
        score: similarityExpression,
      })
      .from(embeddings)
      .innerJoin(documentChunks, eq(embeddings.chunkId, documentChunks.id));

    // Apply document filter if scoped
    const conditions = documentId ? eq(documentChunks.documentId, documentId) : undefined;

    const results = await query
      .where(conditions)
      .orderBy(sql`${embeddings.embedding} <=> ${vectorStr}::vector`) // cos distance asc
      .limit(limit);

    return results.map((res) => ({
      chunkId: res.chunkId,
      score: Number(res.score),
    }));
  }
}
