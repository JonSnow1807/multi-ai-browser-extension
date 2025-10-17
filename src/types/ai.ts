export type AIProvider = 'claude' | 'chatgpt' | 'gemini' | 'grok';

export interface AIModel {
  provider: AIProvider;
  id: string;
  name: string;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: string[];
  streaming: boolean;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  provider?: AIProvider;
  model?: string;
  tokens?: {
    input: number;
    output: number;
  };
  cost?: number;
}

export interface AIRequest {
  provider: AIProvider;
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  systemPrompt?: string;
  context?: PageContext;
}

export interface AIResponse {
  provider: AIProvider;
  model: string;
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost?: number;
  error?: string;
  streaming?: boolean;
}

export interface PageContext {
  url: string;
  title: string;
  selection?: string;
  visibleText?: string;
  fullHtml?: string;
  metadata?: Record<string, any>;
}

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  models: AIModel[];
  defaultModel: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  maxRetries?: number;
  timeout?: number;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIRoutingRule {
  id: string;
  name: string;
  pattern: RegExp | string;
  provider: AIProvider;
  model?: string;
  priority: number;
  taskTypes: TaskType[];
}

export type TaskType =
  | 'creative_writing'
  | 'analysis'
  | 'reasoning'
  | 'code_generation'
  | 'debugging'
  | 'technical_docs'
  | 'research'
  | 'real_time_info'
  | 'translation'
  | 'summarization'
  | 'casual_chat'
  | 'data_extraction';

export interface RoutingScore {
  provider: AIProvider;
  score: number;
  factors: {
    capabilityMatch: number;
    userPreference: number;
    costEfficiency: number;
    responseSpeed: number;
  };
}

export interface StreamChunk {
  delta: string;
  finished: boolean;
  provider: AIProvider;
  model: string;
}