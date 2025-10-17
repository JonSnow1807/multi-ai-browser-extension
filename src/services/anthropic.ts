import axios, { AxiosInstance, AxiosError } from 'axios';
import { AIRequest, AIResponse, StreamChunk, AIMessage } from '@/types/ai';

export class ClaudeAPI {
  private client: AxiosInstance;
  private apiKey: string = '';
  private config: any = {};

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.anthropic.com',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
    });
  }

  configure(config: { apiKey: string; [key: string]: any }): void {
    this.apiKey = config.apiKey;
    this.config = config;

    // Update axios headers
    this.client.defaults.headers.common['x-api-key'] = this.apiKey;
  }

  async sendRequest(request: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    try {
      const claudeRequest = this.transformRequest(request);

      const response = await this.client.post('/v1/messages', claudeRequest, {
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
    const claudeRequest = this.transformRequest(request);
    claudeRequest.stream = true;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(claudeRequest),
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
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                onChunk({
                  delta: parsed.delta.text,
                  finished: false,
                  provider: 'claude',
                  model: request.model || 'claude-3-sonnet-20240229',
                });
              } else if (parsed.type === 'message_stop') {
                onChunk({
                  delta: '',
                  finished: true,
                  provider: 'claude',
                  model: request.model || 'claude-3-sonnet-20240229',
                });
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      return {
        provider: 'claude',
        model: request.model || 'claude-3-sonnet-20240229',
        content: fullContent,
        streaming: true,
      };
    } catch (error) {
      return this.handleError(error as Error, request);
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await this.client.post('/v1/messages', {
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // Claude doesn't have a models endpoint, so we return known models
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2',
    ];
  }

  estimateTokens(text: string): number {
    // Rough estimation for Claude (similar to GPT tokenization)
    return Math.ceil(text.length / 4);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { input: number; output: number }> = {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
      'claude-2.0': { input: 0.008, output: 0.024 },
      'claude-instant-1.2': { input: 0.0008, output: 0.0024 },
    };

    const modelCost = costs[model] || costs['claude-3-sonnet-20240229'];
    return (inputTokens * modelCost.input + outputTokens * modelCost.output) / 1000;
  }

  private transformRequest(request: AIRequest): any {
    const messages = this.transformMessages(request.messages);

    const claudeRequest: any = {
      model: request.model || 'claude-3-sonnet-20240229',
      messages,
      max_tokens: request.maxTokens || 4000,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      claudeRequest.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      claudeRequest.top_p = request.topP;
    }

    if (request.systemPrompt) {
      claudeRequest.system = request.systemPrompt;
    }

    // Add context if available
    if (request.context) {
      const contextMessage = this.buildContextMessage(request.context);
      if (contextMessage) {
        claudeRequest.messages.unshift(contextMessage);
      }
    }

    return claudeRequest;
  }

  private transformMessages(messages: AIMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'system' ? 'assistant' : msg.role,
      content: msg.content,
    }));
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
    const content = response.content?.[0]?.text || '';

    return {
      provider: 'claude',
      model: response.model || request.model || 'claude-3-sonnet-20240229',
      content,
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      } : undefined,
      cost: response.usage ?
        this.calculateCost(
          response.model || request.model || 'claude-3-sonnet-20240229',
          response.usage.input_tokens,
          response.usage.output_tokens
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
          errorMessage = 'Rate limit exceeded';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Claude API is temporarily unavailable';
          break;
        default:
          errorMessage = data?.error?.message || `HTTP ${status} error`;
      }
    } else {
      errorMessage = error.message;
    }

    return {
      provider: 'claude',
      model: request.model || 'claude-3-sonnet-20240229',
      content: '',
      error: errorMessage,
    };
  }
}