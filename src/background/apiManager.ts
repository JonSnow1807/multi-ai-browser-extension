import { AIProvider, AIRequest, AIResponse, StreamChunk } from '@/types/ai';
import { ClaudeAPI } from '@/services/anthropic';
import { ChatGPTAPI } from '@/services/openai';
import { GeminiAPI } from '@/services/google';
import { GrokAPI } from '@/services/xai';

interface APIRequestWithConfig extends AIRequest {
  apiKey: string;
  settings: any;
}

export class APIManager {
  private providers: Map<AIProvider, any>;
  private activeRequests: Map<string, AbortController> = new Map();

  constructor() {
    this.providers = new Map([
      ['claude', new ClaudeAPI()],
      ['chatgpt', new ChatGPTAPI()],
      ['gemini', new GeminiAPI()],
      ['grok', new GrokAPI()],
    ]);
  }

  /**
   * Send a request to the specified AI provider
   */
  async sendRequest(request: APIRequestWithConfig): Promise<AIResponse> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      throw new Error(`Unknown provider: ${request.provider}`);
    }

    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      const startTime = Date.now();

      // Configure the provider with API key and settings
      provider.configure({
        apiKey: request.apiKey,
        ...request.settings,
      });

      let response: AIResponse;

      if (request.stream) {
        response = await this.handleStreamingRequest(provider, request, abortController.signal, requestId);
      } else {
        response = await provider.sendRequest(request, abortController.signal);
      }

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Add metadata to response
      response = {
        ...response,
        responseTime,
      };

      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Handle streaming responses
   */
  private async handleStreamingRequest(
    provider: any,
    request: APIRequestWithConfig,
    signal: AbortSignal,
    requestId: string
  ): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };

      provider.streamRequest(
        request,
        (chunk: StreamChunk) => {
          if (signal.aborted) {
            reject(new Error('Request was cancelled'));
            return;
          }

          fullContent += chunk.delta;

          // Send chunk to content script
          this.sendStreamChunk(requestId, chunk);
        },
        signal
      ).then((finalResponse: AIResponse) => {
        // Send stream end signal
        this.sendStreamEnd(requestId);

        resolve({
          ...finalResponse,
          content: fullContent,
          streaming: true,
        });
      }).catch(reject);
    });
  }

  /**
   * Cancel an active request
   */
  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Cancel all active requests
   */
  cancelAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  /**
   * Send a stream chunk to content script
   */
  private async sendStreamChunk(requestId: string, chunk: StreamChunk): Promise<void> {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'STREAM_CHUNK',
        payload: { requestId, chunk },
      });
    }
  }

  /**
   * Send stream end signal to content script
   */
  private async sendStreamEnd(requestId: string): Promise<void> {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, {
        type: 'STREAM_END',
        payload: { requestId },
      });
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate API key for a provider
   */
  async validateAPIKey(provider: AIProvider, apiKey: string): Promise<boolean> {
    const api = this.providers.get(provider);
    if (!api) {
      return false;
    }

    try {
      api.configure({ apiKey });
      return await api.validateKey();
    } catch (error) {
      console.error(`API key validation failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get available models for a provider
   */
  async getAvailableModels(provider: AIProvider, apiKey: string): Promise<string[]> {
    const api = this.providers.get(provider);
    if (!api) {
      return [];
    }

    try {
      api.configure({ apiKey });
      return await api.getModels();
    } catch (error) {
      console.error(`Failed to get models for ${provider}:`, error);
      return [];
    }
  }

  /**
   * Estimate token count for a request
   */
  estimateTokens(provider: AIProvider, text: string): number {
    const api = this.providers.get(provider);
    if (api && api.estimateTokens) {
      return api.estimateTokens(text);
    }

    // Fallback estimation
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for a request
   */
  calculateCost(
    provider: AIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const api = this.providers.get(provider);
    if (api && api.calculateCost) {
      return api.calculateCost(model, inputTokens, outputTokens);
    }

    // Fallback cost calculation
    const costs: Record<string, { input: number; output: number }> = {
      'claude-default': { input: 0.008, output: 0.024 },
      'chatgpt-default': { input: 0.01, output: 0.03 },
      'gemini-default': { input: 0.005, output: 0.015 },
      'grok-default': { input: 0.003, output: 0.009 },
    };

    const cost = costs[`${provider}-default`] || { input: 0.01, output: 0.03 };
    return (inputTokens * cost.input + outputTokens * cost.output) / 1000;
  }

  /**
   * Get rate limit status for a provider
   */
  async getRateLimitStatus(provider: AIProvider): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }> {
    const api = this.providers.get(provider);
    if (api && api.getRateLimitStatus) {
      return await api.getRateLimitStatus();
    }

    // Default values if not implemented
    return {
      remaining: 100,
      reset: new Date(Date.now() + 3600000),
      limit: 100,
    };
  }
}