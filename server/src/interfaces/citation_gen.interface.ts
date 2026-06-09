import { RetrievalResult } from './retrieval.interface';

export interface CitationInfo {
  sourceChunkId: string;
  sourceDocumentId: string;
  pageNumber: number | null;
  textSnippet: string;
}

export interface ICitationGeneratorProvider {
  /**
   * Automatically generates references mapping sentences in a response to matching source chunks.
   */
  generateCitations(answer: string, context: RetrievalResult[]): Promise<CitationInfo[]>;
}

export class PlaceholderCitationGeneratorProvider implements ICitationGeneratorProvider {
  async generateCitations(_answer: string, _context: RetrievalResult[]): Promise<CitationInfo[]> {
    throw new Error('Method not implemented. ICitationGeneratorProvider is a Phase 2 placeholder.');
  }
}
