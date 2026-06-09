export interface ILLMProvider {
  /**
   * Generates a grounded completion response from the given prompt.
   * @param prompt The prompt structured by the ContextBuilderService.
   * @returns A promise that resolves to the generated text completion.
   */
  generateCompletion(prompt: string): Promise<string>;

  /**
   * Checks if local Ollama LLM is reachable and has the target model.
   */
  checkHealth(): Promise<boolean>;
}
