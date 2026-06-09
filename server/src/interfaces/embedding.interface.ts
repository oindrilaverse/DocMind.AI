export interface IEmbeddingProvider {
  /**
   * Generates a numerical vector embedding for the given input text.
   * @param text The input text string to generate embeddings for.
   * @returns A promise that resolves to an array of floating point numbers (vector).
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates numerical vector embeddings for a batch of text inputs.
   * @param texts An array of input text strings.
   * @returns A promise that resolves to an array of embedding vectors.
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export class PlaceholderEmbeddingProvider implements IEmbeddingProvider {
  async generateEmbedding(_text: string): Promise<number[]> {
    throw new Error('Method not implemented. IEmbeddingProvider is a Phase 1 placeholder.');
  }

  async generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new Error('Method not implemented. IEmbeddingProvider is a Phase 1 placeholder.');
  }
}
