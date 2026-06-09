export interface ChunkInput {
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  wordCount: number;
}

export class ChunkingService {
  private static CHUNK_SIZE = 500;
  private static OVERLAP_SIZE = 100;

  /**
   * Split a document's extracted text into overlapping, paragraph-boundary-aware chunks
   */
  static splitText(text: string, pageCount: number | null): ChunkInput[] {
    if (!text || !text.trim()) return [];

    // Check if PPTX structure is present (demarcated by slides)
    const pptxSlides = text.split(/--- Slide \d+ ---\r?\n/g);
    if (pptxSlides.length > 1) {
      // First split is empty because slide 1 separator is at the start
      const slides = pptxSlides.filter(slide => slide.trim().length > 0);
      return this.chunkSlides(slides);
    }

    // Standard word-based paragraph-aware splitting for PDF/DOCX
    const paragraphs = text.split(/\r?\n\r?\n/);
    const chunks: ChunkInput[] = [];
    
    let currentWords: string[] = [];
    let currentWordCount = 0;
    let chunkIndex = 0;
    
    // Track page assignment estimation
    const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
    let accumulatedWords = 0;

    for (const paragraph of paragraphs) {
      const paragraphClean = paragraph.trim();
      if (!paragraphClean) continue;

      const paragraphWords = paragraphClean.split(/\s+/).filter(w => w.length > 0);
      if (paragraphWords.length === 0) continue;

      // If the paragraph itself is larger than chunk size, split it directly
      if (paragraphWords.length > this.CHUNK_SIZE) {
        // If we have words in current chunk, save it first
        if (currentWords.length > 0) {
          chunks.push(this.createChunk(currentWords, chunkIndex++, accumulatedWords, totalWords, pageCount));
          
          // Sliding window overlap
          currentWords = currentWords.slice(-this.OVERLAP_SIZE);
          currentWordCount = currentWords.length;
        }

        let pOffset = 0;
        while (pOffset < paragraphWords.length) {
          const slice = paragraphWords.slice(pOffset, pOffset + this.CHUNK_SIZE);
          accumulatedWords += slice.length;
          
          chunks.push(this.createChunk(slice, chunkIndex++, accumulatedWords, totalWords, pageCount));
          
          pOffset += (this.CHUNK_SIZE - this.OVERLAP_SIZE);
        }
        
        // Setup state for next items
        currentWords = paragraphWords.slice(-this.OVERLAP_SIZE);
        currentWordCount = currentWords.length;
        continue;
      }

      // Normal path: append paragraph to current chunk candidate
      if (currentWordCount + paragraphWords.length > this.CHUNK_SIZE) {
        // Current chunk is full, save it
        chunks.push(this.createChunk(currentWords, chunkIndex++, accumulatedWords, totalWords, pageCount));
        
        // Sliding window overlap
        currentWords = currentWords.slice(-this.OVERLAP_SIZE);
        currentWordCount = currentWords.length;
      }

      currentWords.push(...paragraphWords);
      currentWordCount += paragraphWords.length;
      accumulatedWords += paragraphWords.length;
    }

    // Push final chunk if not empty
    if (currentWords.length > 0) {
      chunks.push(this.createChunk(currentWords, chunkIndex++, accumulatedWords, totalWords, pageCount));
    }

    return chunks;
  }

  /**
   * Special chunking path for PPTX slides (maintains slide boundaries)
   */
  private static chunkSlides(slides: string[]): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    let chunkIndex = 0;

    slides.forEach((slideContent, index) => {
      const words = slideContent.trim().split(/\s+/).filter(w => w.length > 0);
      const pageNumber = index + 1;

      if (words.length <= this.CHUNK_SIZE) {
        chunks.push({
          content: slideContent.trim(),
          chunkIndex: chunkIndex++,
          pageNumber,
          wordCount: words.length,
        });
      } else {
        // Slide is very large, split into sub-chunks maintaining slide page number
        let offset = 0;
        while (offset < words.length) {
          const slice = words.slice(offset, offset + this.CHUNK_SIZE);
          chunks.push({
            content: slice.join(' '),
            chunkIndex: chunkIndex++,
            pageNumber,
            wordCount: slice.length,
          });
          offset += (this.CHUNK_SIZE - this.OVERLAP_SIZE);
        }
      }
    });

    return chunks;
  }

  /**
   * Helper to compile a text chunk and estimate its source page
   */
  private static createChunk(
    words: string[],
    chunkIndex: number,
    accumulatedWordsCount: number,
    totalWords: number,
    pageCount: number | null
  ): ChunkInput {
    // Estimate page number based on word distribution
    let pageNumber: number | null = null;
    if (pageCount && totalWords > 0) {
      const fraction = accumulatedWordsCount / totalWords;
      pageNumber = Math.min(pageCount, Math.max(1, Math.ceil(fraction * pageCount)));
    }

    return {
      content: words.join(' '),
      chunkIndex,
      pageNumber,
      wordCount: words.length,
    };
  }
}
