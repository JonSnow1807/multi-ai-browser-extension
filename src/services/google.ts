import axios, { AxiosInstance, AxiosError } from 'axios';
import { AIRequest, AIResponse, StreamChunk, AIMessage } from '@/types/ai';

export class GeminiAPI {
  private client: AxiosInstance;
  private apiKey: string = '';
  private config: any = {};

  constructor() {
    this.client = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  configure(config: { apiKey: string; [key: string]: any }): void {
    this.apiKey = config.apiKey;
    this.config = config;
  }

  async sendRequest(request: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const geminiRequest = this.transformRequest(request);
      const model = request.model || 'gemini-pro';

      const response = await this.client.post(
        `/models/${model}:generateContent?key=${this.apiKey}`,
        geminiRequest,
        { signal }
      );

      return this.transformResponse(response.data, request);
    } catch (error) {
      return this.handleError(error as AxiosError, request);
    }
  }

  async streamRequest(
    request: AIRequest,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<AIResponse> {
    const geminiRequest = this.transformRequest(request);
    const model = request.model || 'gemini-pro';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiRequest),
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);

        // Gemini streams JSON objects separated by newlines
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              fullContent += text;
              onChunk({
                delta: text,
                finished: false,
                provider: 'gemini',
                model: model,
              });
            }

            if (parsed.candidates?.[0]?.finishReason) {
              onChunk({
                delta: '',
                finished: true,
                provider: 'gemini',
                model: model,
              });
            }
          } catch (e) {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }

      return {
        provider: 'gemini',
        model: model,
        content: fullContent,
        streaming: true,
      };
    } catch (error) {
      return this.handleError(error as Error, request);
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await this.client.get(
        `/models?key=${this.apiKey}`
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.client.get(
        `/models?key=${this.apiKey}`
      );

      const models = response.data.models
        .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: any) => model.name.replace('models/', ''));

      return models;
    } catch (error) {
      // Return default models if API call fails
      return [
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-ultra',
      ];
    }
  }

  estimateTokens(text: string): number {
    // Rough estimation for Gemini (similar to other models)
    return Math.ceil(text.length / 4);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { input: number; output: number }> = {
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-pro-vision': { input: 0.0005, output: 0.0015 },
      'gemini-ultra': { input: 0.001, output: 0.003 },
    };

    const modelCost = costs[model] || costs['gemini-pro'];
    return (inputTokens * modelCost.input + outputTokens * modelCost.output) / 1000;
  }

  private transformRequest(request: AIRequest): any {
    const contents = this.transformMessages(request.messages, request.systemPrompt);

    const geminiRequest: any = {
      contents,
      generationConfig: {
        temperature: request.temperature || 0.7,
        topP: request.topP || 0.95,
        maxOutputTokens: request.maxTokens || 4000,
      },
    };

    // Add safety settings
    geminiRequest.safetySettings = this.getSafetySettings();

    // Add context if available
    if (request.context) {
      const contextContent = this.buildContextContent(request.context);
      if (contextContent) {
        geminiRequest.contents.unshift(contextContent);
      }
    }

    return geminiRequest;
  }

  private transformMessages(messages: AIMessage[], systemPrompt?: string): any[] {
    const contents: any[] = [];

    // Add system prompt as first user message if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System: ${systemPrompt}` }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions.' }],
      });
    }

    // Transform messages
    messages.forEach(msg => {
      // Gemini uses 'model' instead of 'assistant'
      const role = msg.role === 'assistant' ? 'model' : msg.role === 'system' ? 'user' : msg.role;

      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    });

    return contents;
  }

  private buildContextContent(context: any): any | null {
    const parts: string[] = [];

    if (context.selection) {
      parts.push(`Selected text: "${context.selection}"`);
    }

    if (context.visibleText && !context.selection) {
      parts.push(`Page content: ${context.visibleText.substring(0, 1000)}...`);
    }

    if (context.url) {
      parts.push(`URL: ${context.url}`);
    }

    if (context.title) {
      parts.push(`Page title: ${context.title}`);
    }

    if (parts.length === 0) return null;

    return {
      role: 'user',
      parts: [{ text: `Context:\n${parts.join('\n')}` }],
    };
  }

  private getSafetySettings(): any[] {
    // Configure safety settings based on config or defaults
    const threshold = this.config.safetyThreshold || 'BLOCK_MEDIUM_AND_ABOVE';

    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold,
      },
    ];
  }

  private transformResponse(response: any, request: AIRequest): AIResponse {
    const candidate = response.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';

    // Extract token count if available
    const metadata = response.usageMetadata;
    const usage = metadata ? {
      inputTokens: metadata.promptTokenCount || 0,
      outputTokens: metadata.candidatesTokenCount || 0,
      totalTokens: metadata.totalTokenCount || 0,
    } : undefined;

    return {
      provider: 'gemini',
      model: request.model || 'gemini-pro',
      content,
      usage,
      cost: usage ?
        this.calculateCost(
          request.model || 'gemini-pro',
          usage.inputTokens,
          usage.outputTokens
        ) : undefined,
    };
  }

  private handleError(error: AxiosError | Error, request: AIRequest): AIResponse {
    let errorMessage = 'Unknown error occurred';

    if ('response' in error && error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      switch (status) {
        case 400:
          errorMessage = data?.error?.message || 'Invalid request';
          break;
        case 401:
        case 403:
          errorMessage = 'Invalid or missing API key';
          break;
        case 404:
          errorMessage = 'Model not found';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Please try again later.';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Gemini API is temporarily unavailable';
          break;
        default:
          errorMessage = data?.error?.message || `HTTP ${status} error`;
      }
    } else {
      errorMessage = error.message;
    }

    return {
      provider: 'gemini',
      model: request.model || 'gemini-pro',
      content: '',
      error: errorMessage,
    };
  }

  // Additional Gemini-specific features

  async generateWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<AIResponse> {
    try {
      const response = await this.client.post(
        `/models/gemini-pro-vision:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4000,
          },
        }
      );

      return this.transformResponse(response.data, {
        provider: 'gemini',
        model: 'gemini-pro-vision',
        messages: [],
      });
    } catch (error) {
      return this.handleError(error as AxiosError, {
        provider: 'gemini',
        model: 'gemini-pro-vision',
        messages: [],
      });
    }
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.client.post(
        `/models/embedding-001:embedContent?key=${this.apiKey}`,
        {
          model: 'models/embedding-001',
          content: {
            parts: [{ text }],
          },
        }
      );

      return response.data.embedding.values;
    } catch (error) {
      console.error('Failed to create embedding:', error);
      return [];
    }
  }
}