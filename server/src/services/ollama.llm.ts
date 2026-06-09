import axios from 'axios';
import { ILLMProvider } from '../interfaces/llm.interface';

export class OllamaLLMProvider implements ILLMProvider {
  private ollamaUrl: string;
  private modelName: string;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.modelName = process.env.OLLAMA_LLM_MODEL || 'llama3.2';
  }

  /**
   * Checks if local Ollama is responsive
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
   * Generates grounded text completions using llama3.2
   */
  async generateCompletion(prompt: string): Promise<string> {
    return this.retryWithBackoff(async () => {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.modelName,
          prompt: prompt,
          stream: false, // Return fully compiled response in one payload
          options: {
            temperature: 0.1, // Keep temperature low to enforce strict context adherence
            num_ctx: 4096, // Set context window to 4K tokens
          },
        },
        {
          timeout: 60000, // 60 seconds timeout (generations can be slow)
        }
      );

      if (!response.data || typeof response.data.response !== 'string') {
        throw new Error('Ollama returned invalid LLM generation response structure');
      }

      return response.data.response.trim();
    });
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
      console.warn(`[Ollama LLM] Request failed, retrying in ${delay}ms... Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }
}
