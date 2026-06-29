import { db } from '../db';
import { citations, documentChunks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { RetrievalResult } from '../interfaces/retrieval.interface';

export interface CitationItem {
  id?: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  similarityScore: number;
  snippet: string;
  originalRank?: number | null; // Added in Phase 6
  newRank?: number | null;      // Added in Phase 6
  rerankScore?: number | null;  // Added in Phase 6
}

export class CitationService {
  /**
   * Parses citation tags from LLM response text, saves valid references to the DB, and replaces them with clean index references
   */
  static async extractAndSaveCitations(params: {
    answerId: string;
    rawText: string;
    retrievedContext: RetrievalResult[];
  }): Promise<{ cleanText: string; citationItems: CitationItem[] }> {
    const refRegex = /\[Ref:\s*([a-f0-9\-]{36})\]/gi;
    let match;
    const matchedChunkIds: string[] = [];

    // Find all cited UUIDs in the text
    while ((match = refRegex.exec(params.rawText)) !== null) {
      const chunkId = match[1].toLowerCase();
      if (!matchedChunkIds.includes(chunkId)) {
        matchedChunkIds.push(chunkId);
      }
    }

    // 1. Filter out cited IDs that were NOT in the retrieved context (prevent LLM hallucinations)
    const validCitedContexts = params.retrievedContext.filter((res) =>
      matchedChunkIds.includes(res.chunk.id.toLowerCase())
    );

    const citationInserts = [];
    const citationItems: CitationItem[] = [];
    const uuidToIndexMap: Record<string, number> = {};

    // 2. Map UUIDs to clean index tags [1, 2, ...]
    for (let i = 0; i < validCitedContexts.length; i++) {
      const contextItem = validCitedContexts[i];
      const chunk = contextItem.chunk;
      const score = contextItem.score;
      const index = i + 1;
      
      uuidToIndexMap[chunk.id.toLowerCase()] = index;

      citationInserts.push({
        answerId: params.answerId,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        similarityScore: score,
        originalRank: contextItem.originalRank || null,
        newRank: contextItem.newRank || null,
        rerankScore: contextItem.rerankScore || null,
      });

      citationItems.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentName: (chunk as any).documentName || 'Unknown Document',
        pageNumber: chunk.pageNumber,
        similarityScore: score,
        snippet: chunk.content,
        originalRank: contextItem.originalRank || null,
        newRank: contextItem.newRank || null,
        rerankScore: contextItem.rerankScore || null,
      });
    }

    // 3. Save citations to database
    if (citationInserts.length > 0) {
      await db.insert(citations).values(citationInserts);
    }

    // 4. Replace [Ref: UUID] in rawText with [index]
    let cleanText = params.rawText;
    
    // Custom replace function
    cleanText = cleanText.replace(refRegex, (fullMatch, uuidGroup) => {
      const lowerUuid = uuidGroup.toLowerCase();
      if (lowerUuid in uuidToIndexMap) {
        return `[${uuidToIndexMap[lowerUuid]}]`;
      }
      return ''; // Strip out invalid/hallucinated reference tags
    });

    return {
      cleanText,
      citationItems,
    };
  }

  /**
   * Retrieves saved citations for a specific assistant message
   */
  static async getCitationsForMessage(answerId: string): Promise<CitationItem[]> {
    const records = await db
      .select({
        id: citations.id,
        chunkId: citations.chunkId,
        documentId: citations.documentId,
        pageNumber: citations.pageNumber,
        similarityScore: citations.similarityScore,
        documentName: citations.documentId, // temporary placeholder, will resolve joined name
        originalRank: citations.originalRank,
        newRank: citations.newRank,
        rerankScore: citations.rerankScore,
      })
      .from(citations)
      .where(eq(citations.answerId, answerId));

    if (records.length === 0) return [];

    // Load actual content snippets and document names in join
    const chunkIds = records.map((r) => r.chunkId);
    
    const chunkDetails = await db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        documentName: documentChunks.documentId, // placeholder joined below
      })
      .from(documentChunks)
      .where(eq(documentChunks.id, chunkIds[0])); // Fetch content (normally standard join is cleaner)

    // Resolve details
    const resolvedCitations = await Promise.all(
      records.map(async (rec) => {
        const chunk = await db.query.documentChunks.findFirst({
          where: eq(documentChunks.id, rec.chunkId),
          with: {
            document: true,
          },
        });

        return {
          id: rec.id,
          chunkId: rec.chunkId,
          documentId: rec.documentId,
          documentName: chunk?.document?.originalName || 'Unknown Document',
          pageNumber: rec.pageNumber,
          similarityScore: rec.similarityScore,
          snippet: chunk?.content || '',
          originalRank: rec.originalRank,
          newRank: rec.newRank,
          rerankScore: rec.rerankScore,
        };
      })
    );

    return resolvedCitations;
  }
}
