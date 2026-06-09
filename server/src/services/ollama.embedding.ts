import axios from 'axios';
import { IEmbeddingProvider } from '../interfaces/embedding.interface';

export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  private ollamaUrl: string;
  private modelName: string;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.modelName = process.env.OLLAMA_MODEL || 'nomic-embed-text';
  }

  /**
   * Checks if local Ollama is online and responsive
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(this.ollamaUrl, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generates a single embedding vector using nomic-embed-text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return this.retryWithBackoff(async () => {
      const response = await axios.post(
        `${this.ollamaUrl}/api/embeddings`,
        {
          model: this.modelName,
          prompt: text,
        },
        {
          timeout: 15000, // 15 seconds timeout
        }
      );

      if (!response.data || !Array.isArray(response.data.embedding)) {
        throw new Error('Ollama returned invalid embedding response structure');
      }

      return response.data.embedding;
    });
  }

  /**
   * Generates embeddings for a list of text chunks sequentially
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const vector = await this.generateEmbedding(text);
      embeddings.push(vector);
    }
    return embeddings;
  }

  /**
   * Retries an async operation up to 3 times with exponential backoff
   */
  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries <= 1) {
        throw error;
      }
      console.warn(`[Ollama] Request failed, retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }
}
