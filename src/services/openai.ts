import axios, { AxiosInstance, AxiosError } from 'axios';
import { AIRequest, AIResponse, StreamChunk, AIMessage } from '@/types/ai';

export class ChatGPTAPI {
  private client: AxiosInstance;
  private apiKey: string = '';
  private config: any = {};

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  configure(config: { apiKey: string; [key: string]: any }): void {
    this.apiKey = config.apiKey;
    this.config = config;

    // Update axios headers
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
  }

  async sendRequest(request: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const openaiRequest = this.transformRequest(request);

      const response = await this.client.post('/chat/completions', openaiRequest, {
        signal,
      });

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
    const openaiRequest = this.transformRequest(request);
    openaiRequest.stream = true;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(openaiRequest),
        signal,
      });

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
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk({
                delta: '',
                finished: true,
                provider: 'chatgpt',
                model: request.model || 'gpt-4-turbo-preview',
              });
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;

              if (delta) {
                fullContent += delta;
                onChunk({
                  delta,
                  finished: false,
                  provider: 'chatgpt',
                  model: request.model || 'gpt-4-turbo-preview',
                });
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      return {
        provider: 'chatgpt',
        model: request.model || 'gpt-4-turbo-preview',
        content: fullContent,
        streaming: true,
      };
    } catch (error) {
      return this.handleError(error as Error, request);
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');
      const models = response.data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id);
      return models;
    } catch (error) {
      // Return default models if API call fails
      return [
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
      ];
    }
  }

  estimateTokens(text: string): number {
    // More accurate estimation for GPT models
    // Average is about 1 token per 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-32k': { input: 0.06, output: 0.12 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
    };

    const modelCost = costs[model] || costs['gpt-3.5-turbo'];
    return (inputTokens * modelCost.input + outputTokens * modelCost.output) / 1000;
  }

  private transformRequest(request: AIRequest): any {
    const messages = this.transformMessages(request.messages, request.systemPrompt);

    const openaiRequest: any = {
      model: request.model || 'gpt-4-turbo-preview',
      messages,
      max_tokens: request.maxTokens || 4000,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      openaiRequest.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      openaiRequest.top_p = request.topP;
    }

    // Add frequency and presence penalties if configured
    if (this.config.frequencyPenalty !== undefined) {
      openaiRequest.frequency_penalty = this.config.frequencyPenalty;
    }

    if (this.config.presencePenalty !== undefined) {
      openaiRequest.presence_penalty = this.config.presencePenalty;
    }

    // Add context if available
    if (request.context) {
      const contextMessage = this.buildContextMessage(request.context);
      if (contextMessage) {
        openaiRequest.messages.push(contextMessage);
      }
    }

    return openaiRequest;
  }

  private transformMessages(messages: AIMessage[], systemPrompt?: string): any[] {
    const transformed: any[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      transformed.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Transform messages
    messages.forEach(msg => {
      transformed.push({
        role: msg.role,
        content: msg.content,
      });
    });

    return transformed;
  }

  private buildContextMessage(context: any): any | null {
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
      content: `Context:\n${parts.join('\n')}`,
    };
  }

  private transformResponse(response: any, request: AIRequest): AIResponse {
    const choice = response.choices?.[0];
    const content = choice?.message?.content || '';

    return {
      provider: 'chatgpt',
      model: response.model || request.model || 'gpt-4-turbo-preview',
      content,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      cost: response.usage ?
        this.calculateCost(
          response.model || request.model || 'gpt-4-turbo-preview',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        ) : undefined,
    };
  }

  private handleError(error: AxiosError | Error, request: AIRequest): AIResponse {
    let errorMessage = 'Unknown error occurred';

    if ('response' in error && error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      switch (status) {
        case 401:
          errorMessage = 'Invalid API key';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Please try again later.';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'OpenAI API is temporarily unavailable';
          break;
        case 400:
          errorMessage = data?.error?.message || 'Bad request';
          break;
        default:
          errorMessage = data?.error?.message || `HTTP ${status} error`;
      }
    } else {
      errorMessage = error.message;
    }

    return {
      provider: 'chatgpt',
      model: request.model || 'gpt-4-turbo-preview',
      content: '',
      error: errorMessage,
    };
  }

  // Additional OpenAI-specific features

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.post('/embeddings', {
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Failed to create embedding:', error);
      return [];
    }
  }

  async moderateContent(text: string): Promise<{
    flagged: boolean;
    categories: Record<string, boolean>;
  }> {
    try {
      const response = await this.client.post('/moderations', {
        input: text,
      });

      const result = response.data.results[0];
      return {
        flagged: result.flagged,
        categories: result.categories,
      };
    } catch (error) {
      console.error('Failed to moderate content:', error);
      return {
        flagged: false,
        categories: {},
      };
    }
  }
}