import { RetrievalResult } from './retrieval.interface';

export interface IMultiDocumentRetrievalProvider {
  /**
   * Retrieves relevant chunks across a set of multiple documents.
   */
  retrieveAcrossDocuments(query: string, documentIds: string[], limit: number): Promise<RetrievalResult[]>;
}

export class PlaceholderMultiDocumentRetrievalProvider implements IMultiDocumentRetrievalProvider {
  async retrieveAcrossDocuments(_query: string, _documentIds: string[], _limit: number): Promise<RetrievalResult[]> {
    throw new Error('Method not implemented. IMultiDocumentRetrievalProvider is a Phase 2 placeholder.');
  }
}
