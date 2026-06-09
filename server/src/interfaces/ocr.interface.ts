export interface IOCRProvider {
  /**
   * Performs optical character recognition on a file buffer or local file path.
   * @param filePath The local absolute path to the document file.
   * @returns A promise resolving to the OCR-extracted plain text content.
   */
  performOCR(filePath: string): Promise<string>;
}

export class PlaceholderOCRProvider implements IOCRProvider {
  async performOCR(_filePath: string): Promise<string> {
    throw new Error('Method not implemented. IOCRProvider is a Phase 1 placeholder.');
  }
}
