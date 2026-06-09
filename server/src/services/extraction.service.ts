import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { SUPPORTED_MIME_TYPES } from '@docmind/shared';

export interface ExtractionResult {
  text: string;
  pageCount: number | null;
}

export class ExtractionService {
  /**
   * Main entry point to extract text and page count from a file based on its MIME type
   */
  static async extractText(filePath: string, mimeType: string): Promise<ExtractionResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    switch (mimeType) {
      case SUPPORTED_MIME_TYPES.PDF:
        return await this.extractFromPDF(filePath);
      case SUPPORTED_MIME_TYPES.DOCX:
        return await this.extractFromDOCX(filePath);
      case SUPPORTED_MIME_TYPES.PPTX:
        return await this.extractFromPPTX(filePath);
      default:
        throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
    }
  }

  /**
   * PDF text extraction using pdf-parse
   */
  private static async extractFromPDF(filePath: string): Promise<ExtractionResult> {
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    // Clean up excessive empty lines
    const cleanedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text: cleanedText,
      pageCount: data.numpages || 1,
    };
  }

  /**
   * DOCX text extraction using mammoth
   */
  private static async extractFromDOCX(filePath: string): Promise<ExtractionResult> {
    const result = await mammoth.extractRawText({ path: filePath });
    const cleanedText = result.value
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text: cleanedText,
      pageCount: null, // DOCX has no physical pages in its structure
    };
  }

  /**
   * PPTX text extraction by reading and unzipping XML slide contents
   */
  private static async extractFromPPTX(filePath: string): Promise<ExtractionResult> {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    // Slide entries are named like 'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', etc.
    const slideEntries = zipEntries.filter(entry => 
      entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')
    );

    // Sort slides numerically to maintain reading order
    slideEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.replace(/[^\d]/g, ''), 10);
      const numB = parseInt(b.entryName.replace(/[^\d]/g, ''), 10);
      return numA - numB;
    });

    let fullText = '';
    const textNodeRegex = /<a:t(?:\s[^>]*)?>(.*?)<\/a:t>/g;

    for (let i = 0; i < slideEntries.length; i++) {
      const entry = slideEntries[i];
      const content = entry.getData().toString('utf8');
      
      let match;
      let slideText = '';
      
      while ((match = textNodeRegex.exec(content)) !== null) {
        let textVal = match[1];
        // Decode common XML entities
        textVal = textVal
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        
        slideText += textVal + ' ';
      }

      if (slideText.trim()) {
        fullText += `--- Slide ${i + 1} ---\n${slideText.trim()}\n\n`;
      }
    }

    return {
      text: fullText.trim(),
      pageCount: slideEntries.length || 1,
    };
  }
}
