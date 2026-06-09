import fs from 'fs';
import path from 'path';

export class StorageService {
  private static uploadDirOriginals = process.env.UPLOAD_DIR_ORIGINALS || 'uploads/originals';
  private static uploadDirExtracted = process.env.UPLOAD_DIR_EXTRACTED || 'uploads/extracted';

  static init() {
    // Ensure both directories exist
    if (!fs.existsSync(this.uploadDirOriginals)) {
      fs.mkdirSync(this.uploadDirOriginals, { recursive: true });
    }
    if (!fs.existsSync(this.uploadDirExtracted)) {
      fs.mkdirSync(this.uploadDirExtracted, { recursive: true });
    }
  }

  /**
   * Returns the absolute path of the original file
   */
  static getOriginalFilePath(filename: string): string {
    return path.resolve(this.uploadDirOriginals, filename);
  }

  /**
   * Returns the absolute path of the extracted text file
   */
  static getExtractedFilePath(documentId: string): string {
    return path.resolve(this.uploadDirExtracted, `${documentId}.txt`);
  }

  /**
   * Saves extracted plain text to the file system
   */
  static async saveExtractedText(documentId: string, text: string): Promise<void> {
    const filePath = this.getExtractedFilePath(documentId);
    await fs.promises.writeFile(filePath, text, 'utf-8');
  }

  /**
   * Reads extracted text from the file system
   */
  static async readExtractedText(documentId: string): Promise<string> {
    const filePath = this.getExtractedFilePath(documentId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Extracted text file not found for document ${documentId}`);
    }
    return await fs.promises.readFile(filePath, 'utf-8');
  }

  /**
   * Deletes both original and extracted files
   */
  static async deleteDocumentFiles(filename: string, documentId: string): Promise<void> {
    const originalPath = this.getOriginalFilePath(filename);
    const extractedPath = this.getExtractedFilePath(documentId);

    try {
      if (fs.existsSync(originalPath)) {
        await fs.promises.unlink(originalPath);
      }
    } catch (error) {
      console.error(`Failed to delete original file: ${originalPath}`, error);
    }

    try {
      if (fs.existsSync(extractedPath)) {
        await fs.promises.unlink(extractedPath);
      }
    } catch (error) {
      console.error(`Failed to delete extracted text file: ${extractedPath}`, error);
    }
  }
}

// Automatically initialize directories
StorageService.init();
