/**
 * Token counting utilities for different AI models
 */

// Simplified token counting - in production you'd want to use tiktoken or similar
export class TokenCounter {
  /**
   * Estimate token count for text
   * This is a simplified estimation - actual token counts may vary by model
   */
  static estimate(text: string, model?: string): number {
    // Remove extra whitespace
    const normalized = text.replace(/\s+/g, ' ').trim();

    // Different models have different tokenization
    if (model?.includes('claude')) {
      return this.estimateClaude(normalized);
    } else if (model?.includes('gpt')) {
      return this.estimateGPT(normalized);
    } else if (model?.includes('gemini')) {
      return this.estimateGemini(normalized);
    } else if (model?.includes('grok')) {
      return this.estimateGrok(normalized);
    }

    // Default estimation: ~4 characters per token
    return Math.ceil(normalized.length / 4);
  }

  private static estimateClaude(text: string): number {
    // Claude uses a similar tokenization to GPT models
    // Rough estimation: 1 token ≈ 4 characters for English text
    const baseEstimate = Math.ceil(text.length / 4);

    // Adjust for common patterns
    const adjustments = this.getCommonPatternAdjustments(text);

    return Math.ceil(baseEstimate * adjustments);
  }

  private static estimateGPT(text: string): number {
    // GPT models use BPE tokenization
    // More accurate estimation based on common patterns
    let tokens = 0;

    // Split by whitespace and punctuation
    const words = text.split(/[\s\-_]+/);

    for (const word of words) {
      if (word.length === 0) continue;

      // Short words are usually 1 token
      if (word.length <= 3) {
        tokens += 1;
      }
      // Medium words might be 1-2 tokens
      else if (word.length <= 6) {
        tokens += Math.ceil(word.length / 4);
      }
      // Longer words are split into multiple tokens
      else {
        tokens += Math.ceil(word.length / 3.5);
      }
    }

    // Add tokens for punctuation
    const punctuation = text.match(/[.,!?;:'"()\[\]{}<>@#$%^&*+=|\\\/~`]/g);
    if (punctuation) {
      tokens += punctuation.length * 0.3;
    }

    return Math.ceil(tokens);
  }

  private static estimateGemini(text: string): number {
    // Gemini uses SentencePiece tokenization
    // Similar to Claude/GPT but slightly different
    return Math.ceil(text.length / 4.2);
  }

  private static estimateGrok(text: string): number {
    // Grok uses a similar tokenization to GPT
    return this.estimateGPT(text);
  }

  private static getCommonPatternAdjustments(text: string): number {
    let multiplier = 1;

    // URLs typically use more tokens
    const urls = text.match(/https?:\/\/[^\s]+/g);
    if (urls) {
      multiplier += urls.length * 0.02;
    }

    // Code blocks use more tokens
    const codeBlocks = text.match(/```[\s\S]*?```/g);
    if (codeBlocks) {
      multiplier += 0.1;
    }

    // Numbers and special characters
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > text.length * 0.1) {
      multiplier += 0.05;
    }

    // Non-ASCII characters (emojis, special symbols)
    const nonAscii = text.match(/[^\x00-\x7F]/g);
    if (nonAscii) {
      multiplier += nonAscii.length * 0.01;
    }

    return multiplier;
  }

  /**
   * Check if text exceeds token limit
   */
  static exceedsLimit(text: string, limit: number, model?: string): boolean {
    return this.estimate(text, model) > limit;
  }

  /**
   * Truncate text to fit within token limit
   */
  static truncate(text: string, maxTokens: number, model?: string): string {
    const estimated = this.estimate(text, model);

    if (estimated <= maxTokens) {
      return text;
    }

    // Binary search for the right length
    let low = 0;
    let high = text.length;
    let result = '';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const substring = text.substring(0, mid);
      const tokens = this.estimate(substring, model);

      if (tokens <= maxTokens) {
        result = substring;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Add ellipsis if truncated
    if (result.length < text.length) {
      result += '...';
    }

    return result;
  }

  /**
   * Split text into chunks that fit within token limit
   */
  static chunk(text: string, maxTokensPerChunk: number, model?: string): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimate(sentence, model);

      if (currentTokens + sentenceTokens > maxTokensPerChunk) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
          currentTokens = sentenceTokens;
        } else {
          // Single sentence exceeds limit, need to split it
          const words = sentence.split(' ');
          let wordChunk = '';
          let wordTokens = 0;

          for (const word of words) {
            const wordTokenCount = this.estimate(word, model);
            if (wordTokens + wordTokenCount > maxTokensPerChunk) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = word;
                wordTokens = wordTokenCount;
              }
            } else {
              wordChunk += ' ' + word;
              wordTokens += wordTokenCount;
            }
          }

          if (wordChunk) {
            currentChunk = wordChunk;
            currentTokens = wordTokens;
          }
        }
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be improved with better NLP
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim());
  }

  /**
   * Get token limit for a specific model
   */
  static getModelLimit(model: string): number {
    const limits: Record<string, number> = {
      // Claude models
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'claude-2.1': 100000,
      'claude-2': 100000,
      'claude-instant': 100000,

      // GPT models
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-16k': 16385,

      // Gemini models
      'gemini-pro': 32768,
      'gemini-pro-vision': 16384,
      'gemini-ultra': 32768,

      // Grok models
      'grok-beta': 8192,
      'grok-1': 8192,
      'grok-2': 32768,
    };

    // Check for partial matches
    for (const [key, limit] of Object.entries(limits)) {
      if (model.toLowerCase().includes(key)) {
        return limit;
      }
    }

    // Default limit
    return 4096;
  }

  /**
   * Calculate percentage of token limit used
   */
  static getUsagePercentage(text: string, model: string): number {
    const tokens = this.estimate(text, model);
    const limit = this.getModelLimit(model);
    return Math.min(100, (tokens / limit) * 100);
  }
}