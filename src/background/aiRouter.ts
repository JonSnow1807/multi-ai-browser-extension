import { AIProvider, AIRequest, TaskType, RoutingScore, AIRoutingRule } from '@/types/ai';
import storageService from '@/services/storage';

export class AIRouter {
  private routingRules: AIRoutingRule[] = [
    // Claude rules
    {
      id: 'claude-creative',
      name: 'Claude for Creative Writing',
      pattern: /write|story|creative|poem|narrative|essay|article/i,
      provider: 'claude',
      model: 'claude-3-opus-20240229',
      priority: 10,
      taskTypes: ['creative_writing'],
    },
    {
      id: 'claude-analysis',
      name: 'Claude for Analysis',
      pattern: /analyze|analysis|reasoning|explain|understand|complex/i,
      provider: 'claude',
      priority: 10,
      taskTypes: ['analysis', 'reasoning'],
    },

    // ChatGPT rules
    {
      id: 'chatgpt-code',
      name: 'ChatGPT for Code',
      pattern: /code|program|function|debug|implement|javascript|python|typescript/i,
      provider: 'chatgpt',
      model: 'gpt-4-turbo-preview',
      priority: 10,
      taskTypes: ['code_generation', 'debugging'],
    },
    {
      id: 'chatgpt-technical',
      name: 'ChatGPT for Technical Documentation',
      pattern: /technical|documentation|api|specification/i,
      provider: 'chatgpt',
      priority: 9,
      taskTypes: ['technical_docs'],
    },

    // Gemini rules
    {
      id: 'gemini-research',
      name: 'Gemini for Research',
      pattern: /research|search|find|latest|news|current|google/i,
      provider: 'gemini',
      priority: 10,
      taskTypes: ['research', 'real_time_info'],
    },
    {
      id: 'gemini-data',
      name: 'Gemini for Data Extraction',
      pattern: /extract|data|table|csv|json|parse/i,
      provider: 'gemini',
      priority: 9,
      taskTypes: ['data_extraction'],
    },

    // Grok rules
    {
      id: 'grok-casual',
      name: 'Grok for Casual Chat',
      pattern: /chat|casual|quick|simple|hey|hi/i,
      provider: 'grok',
      priority: 8,
      taskTypes: ['casual_chat'],
    },
    {
      id: 'grok-social',
      name: 'Grok for Social Media',
      pattern: /tweet|post|social|twitter|x\.com/i,
      provider: 'grok',
      priority: 10,
      taskTypes: ['casual_chat'],
    },
  ];

  private userPreferences: Map<string, AIProvider> = new Map();
  private performanceMetrics: Map<AIProvider, { avgResponseTime: number; successRate: number }> = new Map();

  constructor() {
    this.initializeMetrics();
    this.loadUserPreferences();
  }

  private async initializeMetrics() {
    // Initialize with default metrics
    this.performanceMetrics.set('claude', { avgResponseTime: 2000, successRate: 0.98 });
    this.performanceMetrics.set('chatgpt', { avgResponseTime: 1800, successRate: 0.97 });
    this.performanceMetrics.set('gemini', { avgResponseTime: 1500, successRate: 0.96 });
    this.performanceMetrics.set('grok', { avgResponseTime: 1000, successRate: 0.95 });
  }

  private async loadUserPreferences() {
    // Load from storage if available
    const usage = await storageService.get('usage', 'local');
    if (usage?.byProvider) {
      // Analyze past usage to determine preferences
      Object.entries(usage.byProvider).forEach(([provider, stats]) => {
        // Update performance metrics based on actual usage
        const metrics = this.performanceMetrics.get(provider as AIProvider);
        if (metrics && stats.requests > 10) {
          metrics.successRate = 1 - (stats.errors / stats.requests);
          metrics.avgResponseTime = stats.averageResponseTime || metrics.avgResponseTime;
        }
      });
    }
  }

  /**
   * Route a request to the best AI provider
   */
  async route(request: AIRequest): Promise<AIProvider> {
    const scores = await this.calculateScores(request);

    // Sort by score and return the best provider
    const sorted = scores.sort((a, b) => b.score - a.score);
    return sorted[0].provider;
  }

  /**
   * Calculate routing scores for all providers
   */
  private async calculateScores(request: AIRequest): Promise<RoutingScore[]> {
    const settings = await storageService.getSettings();
    const taskType = this.detectTaskType(request);
    const scores: RoutingScore[] = [];

    for (const provider of ['claude', 'chatgpt', 'gemini', 'grok'] as AIProvider[]) {
      // Skip disabled providers
      if (!settings.providers[provider].enabled) {
        continue;
      }

      const score = await this.calculateProviderScore(provider, request, taskType);
      scores.push(score);
    }

    return scores;
  }

  /**
   * Calculate score for a specific provider
   */
  private async calculateProviderScore(
    provider: AIProvider,
    request: AIRequest,
    taskType: TaskType
  ): Promise<RoutingScore> {
    const factors = {
      capabilityMatch: this.calculateCapabilityMatch(provider, taskType, request),
      userPreference: this.calculateUserPreference(provider, taskType),
      costEfficiency: this.calculateCostEfficiency(provider, request),
      responseSpeed: this.calculateResponseSpeed(provider),
    };

    // Weighted average of factors
    const score =
      factors.capabilityMatch * 0.4 +
      factors.userPreference * 0.3 +
      factors.costEfficiency * 0.2 +
      factors.responseSpeed * 0.1;

    return { provider, score, factors };
  }

  /**
   * Detect the task type from the request
   */
  private detectTaskType(request: AIRequest): TaskType {
    const content = this.getRequestContent(request);

    // Check against routing rules
    for (const rule of this.routingRules) {
      if (rule.pattern instanceof RegExp && rule.pattern.test(content)) {
        return rule.taskTypes[0];
      }
    }

    // Fallback detection based on keywords
    const taskKeywords: Record<TaskType, RegExp> = {
      creative_writing: /write|story|creative|poem|narrative/i,
      analysis: /analyze|analysis|explain|understand/i,
      reasoning: /reason|logic|deduce|conclude/i,
      code_generation: /code|program|function|implement/i,
      debugging: /debug|fix|error|bug/i,
      technical_docs: /document|api|technical|specification/i,
      research: /research|find|search|information/i,
      real_time_info: /latest|current|today|news/i,
      translation: /translate|translation|language/i,
      summarization: /summarize|summary|brief|tldr/i,
      casual_chat: /chat|talk|hey|hi|hello/i,
      data_extraction: /extract|parse|data|table/i,
    };

    for (const [type, pattern] of Object.entries(taskKeywords)) {
      if (pattern.test(content)) {
        return type as TaskType;
      }
    }

    return 'casual_chat'; // Default
  }

  /**
   * Get the content from the request for analysis
   */
  private getRequestContent(request: AIRequest): string {
    const messages = request.messages || [];
    const lastMessage = messages[messages.length - 1];
    const context = request.context?.selection || request.context?.visibleText || '';

    return `${lastMessage?.content || ''} ${context}`.toLowerCase();
  }

  /**
   * Calculate how well a provider matches the task
   */
  private calculateCapabilityMatch(provider: AIProvider, taskType: TaskType, request: AIRequest): number {
    const capabilities: Record<AIProvider, Record<TaskType, number>> = {
      claude: {
        creative_writing: 1.0,
        analysis: 1.0,
        reasoning: 1.0,
        code_generation: 0.8,
        debugging: 0.7,
        technical_docs: 0.8,
        research: 0.6,
        real_time_info: 0.3,
        translation: 0.8,
        summarization: 0.9,
        casual_chat: 0.8,
        data_extraction: 0.7,
      },
      chatgpt: {
        creative_writing: 0.8,
        analysis: 0.8,
        reasoning: 0.8,
        code_generation: 1.0,
        debugging: 1.0,
        technical_docs: 1.0,
        research: 0.7,
        real_time_info: 0.4,
        translation: 0.9,
        summarization: 0.8,
        casual_chat: 0.8,
        data_extraction: 0.8,
      },
      gemini: {
        creative_writing: 0.7,
        analysis: 0.8,
        reasoning: 0.8,
        code_generation: 0.8,
        debugging: 0.7,
        technical_docs: 0.8,
        research: 1.0,
        real_time_info: 1.0,
        translation: 0.9,
        summarization: 0.8,
        casual_chat: 0.7,
        data_extraction: 0.9,
      },
      grok: {
        creative_writing: 0.6,
        analysis: 0.6,
        reasoning: 0.6,
        code_generation: 0.6,
        debugging: 0.5,
        technical_docs: 0.6,
        research: 0.7,
        real_time_info: 0.9,
        translation: 0.6,
        summarization: 0.7,
        casual_chat: 1.0,
        data_extraction: 0.6,
      },
    };

    // Check if there's a specific rule match
    const content = this.getRequestContent(request);
    const matchingRule = this.routingRules.find(
      rule => rule.provider === provider && rule.pattern instanceof RegExp && rule.pattern.test(content)
    );

    if (matchingRule) {
      return 1.0; // Perfect match based on rule
    }

    return capabilities[provider][taskType] || 0.5;
  }

  /**
   * Calculate user preference score
   */
  private calculateUserPreference(provider: AIProvider, taskType: TaskType): number {
    // Check if user has a preference for this task type
    const preferenceKey = `${taskType}-preference`;
    const preferredProvider = this.userPreferences.get(preferenceKey);

    if (preferredProvider === provider) {
      return 1.0;
    } else if (preferredProvider) {
      return 0.3; // Lower score for non-preferred providers
    }

    // No specific preference, use general success rate
    const metrics = this.performanceMetrics.get(provider);
    return metrics?.successRate || 0.5;
  }

  /**
   * Calculate cost efficiency
   */
  private calculateCostEfficiency(provider: AIProvider, request: AIRequest): number {
    // Estimated cost per 1k tokens (in cents)
    const costs: Record<AIProvider, { input: number; output: number }> = {
      claude: { input: 0.8, output: 2.4 },
      chatgpt: { input: 1.0, output: 3.0 },
      gemini: { input: 0.5, output: 1.5 },
      grok: { input: 0.3, output: 0.9 },
    };

    // Estimate token count
    const estimatedTokens = this.estimateTokens(request);
    const cost = costs[provider];
    const estimatedCost = (estimatedTokens.input * cost.input + estimatedTokens.output * cost.output) / 1000;

    // Convert to efficiency score (lower cost = higher score)
    const maxCost = 5; // Maximum expected cost in cents
    return Math.max(0, 1 - estimatedCost / maxCost);
  }

  /**
   * Calculate response speed score
   */
  private calculateResponseSpeed(provider: AIProvider): number {
    const metrics = this.performanceMetrics.get(provider);
    if (!metrics) return 0.5;

    // Convert response time to score (faster = higher score)
    const maxTime = 5000; // 5 seconds max
    return Math.max(0, 1 - metrics.avgResponseTime / maxTime);
  }

  /**
   * Estimate token count for a request
   */
  private estimateTokens(request: AIRequest): { input: number; output: number } {
    // Simple estimation: ~4 characters per token
    const content = this.getRequestContent(request);
    const inputTokens = Math.ceil(content.length / 4);
    const outputTokens = request.maxTokens || 1000;

    return { input: inputTokens, output: outputTokens };
  }

  /**
   * Update user preferences based on actual usage
   */
  async updatePreference(taskType: TaskType, provider: AIProvider): Promise<void> {
    const key = `${taskType}-preference`;
    this.userPreferences.set(key, provider);

    // Persist preferences
    // You might want to store this in extension storage
  }

  /**
   * Get routing explanation for debugging
   */
  async explainRouting(request: AIRequest): Promise<{
    recommended: AIProvider;
    scores: RoutingScore[];
    taskType: TaskType;
    explanation: string;
  }> {
    const scores = await this.calculateScores(request);
    const taskType = this.detectTaskType(request);
    const sorted = scores.sort((a, b) => b.score - a.score);

    const explanation = `Task detected as "${taskType}".
      Best provider: ${sorted[0].provider} (score: ${sorted[0].score.toFixed(2)})
      - Capability match: ${sorted[0].factors.capabilityMatch.toFixed(2)}
      - User preference: ${sorted[0].factors.userPreference.toFixed(2)}
      - Cost efficiency: ${sorted[0].factors.costEfficiency.toFixed(2)}
      - Response speed: ${sorted[0].factors.responseSpeed.toFixed(2)}`;

    return {
      recommended: sorted[0].provider,
      scores: sorted,
      taskType,
      explanation,
    };
  }
}