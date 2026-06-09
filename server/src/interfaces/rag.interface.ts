import { RetrievalResult } from './retrieval.interface';

export interface ChatMessageParam {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface IRAGProvider {
  /**
   * Generates a context-aware answer based on query, context chunks, and conversation history.
   * @param query The user's prompt.
   * @param context The relevant chunks retrieved for this query.
   * @param history The conversation history list.
   * @returns A promise resolving to a string response or a ReadableStream for token-by-token streaming.
   */
  generateResponse(
    query: string,
    context: RetrievalResult[],
    history: ChatMessageParam[]
  ): Promise<{ text: string; rawStream?: any }>;
}

export class PlaceholderRAGProvider implements IRAGProvider {
  async generateResponse(
    _query: string,
    _context: RetrievalResult[],
    _history: ChatMessageParam[]
  ): Promise<{ text: string; rawStream?: any }> {
    throw new Error('Method not implemented. IRAGProvider is a Phase 1 placeholder.');
  }
}
