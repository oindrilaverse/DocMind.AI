import { RetrievalResult } from '../interfaces/retrieval.interface';

export class ContextBuilderService {
  private static MAX_TOTAL_CHARACTERS = 8000; // Enforce safe context bounds

  /**
   * Constructs an optimized RAG prompt with retrieved context, source references, and strict system rules
   */
  static buildPrompt(query: string, retrievalResults: RetrievalResult[], chatHistory: { role: string; content: string }[] = []): string {
    // 1. Sort chunks by score descending (confirming similarity ranking)
    const sortedResults = [...retrievalResults].sort((a, b) => b.score - a.score);

    // 2. Build context blocks text while enforcing character limits to prevent token overflow
    let contextText = '';
    let currentLength = 0;

    for (let i = 0; i < sortedResults.length; i++) {
      const res = sortedResults[i];
      const docName = (res.chunk as any).documentName || 'Unknown Document';
      const pageStr = res.chunk.pageNumber ? `Page: ${res.chunk.pageNumber}` : 'Page: N/A';
      
      const block = `Context #${i + 1} (Doc: ${docName}, ${pageStr})\n` +
                    `Reference ID: ${res.chunk.id}\n` +
                    `Content: "${res.chunk.content.trim()}"\n` +
                    `---------------------------------------\n`;

      if (currentLength + block.length > this.MAX_TOTAL_CHARACTERS) {
        break; // Stop appending to avoid overflowing token window
      }

      contextText += block;
      currentLength += block.length;
    }

    // 3. Format chat history string (if present)
    let historyText = '';
    if (chatHistory.length > 0) {
      historyText = '\nRecent Chat History:\n';
      chatHistory.forEach((msg) => {
        historyText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      historyText += '\n';
    }

    // 4. Combine into final prompt with instructions
    return `You are DocMind AI, a highly accurate and trustworthy document intelligence assistant.
Your task is to answer the user's question using ONLY the retrieved document contexts provided below.

Strict instructions you MUST follow:
1. Your answer must be fully grounded in the provided contexts. Do not use any external knowledge.
2. When referencing facts from a context block, you MUST append a reference tag in this format: [Ref: <Reference ID>].
   Example: "The database uses locking mechanisms to preserve transaction integrity [Ref: 4e2f90a1-b847-49ef-ba33-dfbb112a416b]."
3. Always place the [Ref: <Reference ID>] tag immediately after the sentence or clause containing the cited fact.
4. If the provided contexts do not contain the information required to answer, reply exactly:
   "I could not find that information in the uploaded documents."
5. Never invent or fabricate reference tags, documents, or page numbers. Only cite from the provided list.

Retrieved Context Blocks:
---------------------------------------
${contextText || 'No context blocks retrieved.\n'}
${historyText}
User Question: ${query}
Grounded Answer:`;
  }
}
