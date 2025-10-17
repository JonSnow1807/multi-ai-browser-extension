import axios, { AxiosInstance, AxiosError } from 'axios';
import { AIRequest, AIResponse, StreamChunk, AIMessage } from '@/types/ai';

export class GrokAPI {
  private client: AxiosInstance;
  private apiKey: string = '';
  private config: any = {};

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.x.ai/v1',
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
      const grokRequest = this.transformRequest(request);

      const response = await this.client.post('/chat/completions', grokRequest, {
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
    const grokRequest = this.transformRequest(request);
    grokRequest.stream = true;

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(grokRequest),
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
                provider: 'grok',
                model: request.model || 'grok-beta',
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
                  provider: 'grok',
                  model: request.model || 'grok-beta',
                });
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }

      return {
        provider: 'grok',
        model: request.model || 'grok-beta',
        content: fullContent,
        streaming: true,
      };
    } catch (error) {
      return this.handleError(error as Error, request);
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'grok-beta',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // Grok currently has limited models
    return [
      'grok-beta',
      'grok-1',
      'grok-2',
    ];
  }

  estimateTokens(text: string): number {
    // Rough estimation for Grok (similar to GPT tokenization)
    return Math.ceil(text.length / 4);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs: Record<string, { input: number; output: number }> = {
      'grok-beta': { input: 0.0003, output: 0.0009 },
      'grok-1': { input: 0.0005, output: 0.0015 },
      'grok-2': { input: 0.001, output: 0.003 },
    };

    const modelCost = costs[model] || costs['grok-beta'];
    return (inputTokens * modelCost.input + outputTokens * modelCost.output) / 1000;
  }

  private transformRequest(request: AIRequest): any {
    const messages = this.transformMessages(request.messages, request.systemPrompt);

    const grokRequest: any = {
      model: request.model || 'grok-beta',
      messages,
      max_tokens: request.maxTokens || 4000,
    };

    // Add optional parameters
    if (request.temperature !== undefined) {
      grokRequest.temperature = request.temperature;
    }

    if (request.topP !== undefined) {
      grokRequest.top_p = request.topP;
    }

    // Grok-specific: Add real-time search capability
    if (this.config.enableRealTime !== false) {
      grokRequest.tools = [
        {
          type: 'search',
          enabled: true,
        },
      ];
    }

    // Add context if available
    if (request.context) {
      const contextMessage = this.buildContextMessage(request.context);
      if (contextMessage) {
        grokRequest.messages.push(contextMessage);
      }
    }

    return grokRequest;
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

      // Special handling for X/Twitter URLs
      if (context.url.includes('twitter.com') || context.url.includes('x.com')) {
        parts.push('Note: This is from X (Twitter), you may have real-time information about this.');
      }
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

    // Check if real-time search was used
    const usedSearch = choice?.message?.tool_calls?.some(
      (tool: any) => tool.type === 'search'
    );

    return {
      provider: 'grok',
      model: response.model || request.model || 'grok-beta',
      content,
      usage: response.usage ? {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      cost: response.usage ?
        this.calculateCost(
          response.model || request.model || 'grok-beta',
          response.usage.prompt_tokens,
          response.usage.completion_tokens
        ) : undefined,
      metadata: usedSearch ? { realTimeSearch: true } : undefined,
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
        case 403:
          errorMessage = 'Access denied. Check your API key permissions.';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Grok has fast responses but limited rate.';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Grok API is temporarily unavailable';
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
      provider: 'grok',
      model: request.model || 'grok-beta',
      content: '',
      error: errorMessage,
    };
  }

  // Grok-specific features

  async searchRealTime(query: string): Promise<any> {
    try {
      const response = await this.client.post('/search', {
        query,
        max_results: 10,
      });

      return response.data;
    } catch (error) {
      console.error('Real-time search failed:', error);
      return null;
    }
  }

  async getTrending(): Promise<string[]> {
    try {
      const response = await this.client.get('/trending');
      return response.data.topics || [];
    } catch (error) {
      console.error('Failed to get trending topics:', error);
      return [];
    }
  }

  async analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
  }> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'Analyze the sentiment of the following text and respond with only: {"sentiment": "positive|negative|neutral", "score": 0.0-1.0}',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 50,
        temperature: 0,
      });

      const content = response.data.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return {
        sentiment: 'neutral',
        score: 0.5,
      };
    }
  }
}