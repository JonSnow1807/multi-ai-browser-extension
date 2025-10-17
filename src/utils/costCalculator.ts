import { AIProvider } from '@/types/ai';

interface ModelPricing {
  input: number;  // Cost per 1K input tokens in USD
  output: number; // Cost per 1K output tokens in USD
}

/**
 * Cost calculation utilities for AI providers
 */
export class CostCalculator {
  private static readonly pricing: Record<string, ModelPricing> = {
    // Claude models (Anthropic)
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-2.1': { input: 0.008, output: 0.024 },
    'claude-2.0': { input: 0.008, output: 0.024 },
    'claude-instant-1.2': { input: 0.0008, output: 0.0024 },

    // OpenAI GPT models
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-32k': { input: 0.06, output: 0.12 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
    'gpt-3.5-turbo-instruct': { input: 0.0015, output: 0.002 },

    // Google Gemini models
    'gemini-pro': { input: 0.0005, output: 0.0015 },
    'gemini-pro-vision': { input: 0.0005, output: 0.0015 },
    'gemini-ultra': { input: 0.001, output: 0.003 },

    // xAI Grok models
    'grok-beta': { input: 0.0003, output: 0.0009 },
    'grok-1': { input: 0.0005, output: 0.0015 },
    'grok-2': { input: 0.001, output: 0.003 },
  };

  /**
   * Calculate cost for a specific request
   */
  static calculate(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = this.getPricing(model);

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(6));
  }

  /**
   * Get pricing for a specific model
   */
  static getPricing(model: string): ModelPricing {
    // Try exact match first
    if (this.pricing[model]) {
      return this.pricing[model];
    }

    // Try partial match
    for (const [key, value] of Object.entries(this.pricing)) {
      if (model.toLowerCase().includes(key.toLowerCase().split('-')[0])) {
        return value;
      }
    }

    // Default pricing (GPT-3.5 level)
    return { input: 0.0005, output: 0.0015 };
  }

  /**
   * Format cost for display
   */
  static format(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(3)}¢`;
    } else if (cost < 1) {
      return `$${cost.toFixed(3)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  }

  /**
   * Calculate monthly projection based on daily usage
   */
  static projectMonthly(dailyCost: number): number {
    return dailyCost * 30;
  }

  /**
   * Calculate cost savings between models
   */
  static compareCosts(
    model1: string,
    model2: string,
    inputTokens: number,
    outputTokens: number
  ): {
    model1Cost: number;
    model2Cost: number;
    savings: number;
    percentageSaved: number;
    recommendation: string;
  } {
    const cost1 = this.calculate(model1, inputTokens, outputTokens);
    const cost2 = this.calculate(model2, inputTokens, outputTokens);

    const savings = Math.abs(cost1 - cost2);
    const cheaper = cost1 < cost2 ? model1 : model2;
    const moreExpensive = cost1 >= cost2 ? model1 : model2;
    const percentageSaved = (savings / Math.max(cost1, cost2)) * 100;

    return {
      model1Cost: cost1,
      model2Cost: cost2,
      savings,
      percentageSaved,
      recommendation: `Using ${cheaper} instead of ${moreExpensive} saves ${this.format(savings)} (${percentageSaved.toFixed(1)}%)`,
    };
  }

  /**
   * Get cost breakdown by provider
   */
  static getProviderBreakdown(usage: {
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }[]): Record<AIProvider, {
    totalCost: number;
    percentage: number;
    tokenCount: number;
  }> {
    const breakdown: Record<string, any> = {};
    let totalCost = 0;

    // Calculate costs per provider
    for (const item of usage) {
      const cost = this.calculate(item.model, item.inputTokens, item.outputTokens);
      const tokens = item.inputTokens + item.outputTokens;

      if (!breakdown[item.provider]) {
        breakdown[item.provider] = {
          totalCost: 0,
          tokenCount: 0,
        };
      }

      breakdown[item.provider].totalCost += cost;
      breakdown[item.provider].tokenCount += tokens;
      totalCost += cost;
    }

    // Calculate percentages
    for (const provider in breakdown) {
      breakdown[provider].percentage = totalCost > 0
        ? (breakdown[provider].totalCost / totalCost) * 100
        : 0;
    }

    return breakdown;
  }

  /**
   * Check if usage is within budget
   */
  static isWithinBudget(
    currentCost: number,
    budget: number,
    alertThreshold: number = 0.8
  ): {
    withinBudget: boolean;
    percentageUsed: number;
    remaining: number;
    shouldAlert: boolean;
  } {
    const percentageUsed = (currentCost / budget) * 100;
    const remaining = Math.max(0, budget - currentCost);
    const shouldAlert = percentageUsed >= alertThreshold * 100;

    return {
      withinBudget: currentCost <= budget,
      percentageUsed,
      remaining,
      shouldAlert,
    };
  }

  /**
   * Estimate cost for a message
   */
  static estimate(
    message: string,
    model: string,
    estimatedResponseLength: number = 500
  ): number {
    // Rough estimation: 4 characters = 1 token
    const inputTokens = Math.ceil(message.length / 4);
    const outputTokens = Math.ceil(estimatedResponseLength / 4);

    return this.calculate(model, inputTokens, outputTokens);
  }

  /**
   * Get the most cost-effective model for a token count
   */
  static recommendModel(
    inputTokens: number,
    outputTokens: number,
    minQuality: 'low' | 'medium' | 'high' = 'medium'
  ): {
    model: string;
    provider: AIProvider;
    estimatedCost: number;
    reason: string;
  } {
    const qualityTiers = {
      low: ['gpt-3.5-turbo', 'claude-instant-1.2', 'gemini-pro', 'grok-beta'],
      medium: ['gpt-4-turbo-preview', 'claude-3-sonnet-20240229', 'gemini-pro', 'grok-1'],
      high: ['gpt-4', 'claude-3-opus-20240229', 'gemini-ultra', 'grok-2'],
    };

    const models = qualityTiers[minQuality];
    let bestModel = models[0];
    let bestCost = Infinity;
    let bestProvider: AIProvider = 'claude';

    for (const model of models) {
      const cost = this.calculate(model, inputTokens, outputTokens);
      if (cost < bestCost) {
        bestCost = cost;
        bestModel = model;

        // Determine provider
        if (model.includes('gpt')) bestProvider = 'chatgpt';
        else if (model.includes('claude')) bestProvider = 'claude';
        else if (model.includes('gemini')) bestProvider = 'gemini';
        else if (model.includes('grok')) bestProvider = 'grok';
      }
    }

    return {
      model: bestModel,
      provider: bestProvider,
      estimatedCost: bestCost,
      reason: `Best ${minQuality}-quality model for ${inputTokens + outputTokens} tokens`,
    };
  }

  /**
   * Generate cost report
   */
  static generateReport(usage: {
    date: string;
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }[]): {
    totalCost: number;
    totalTokens: number;
    averageCostPerRequest: number;
    mostExpensiveModel: string;
    cheapestModel: string;
    dailyBreakdown: Record<string, number>;
    providerBreakdown: Record<AIProvider, number>;
  } {
    let totalCost = 0;
    let totalTokens = 0;
    const modelCosts: Record<string, number> = {};
    const dailyBreakdown: Record<string, number> = {};
    const providerBreakdown: Record<string, number> = {};

    for (const item of usage) {
      const cost = this.calculate(item.model, item.inputTokens, item.outputTokens);
      const tokens = item.inputTokens + item.outputTokens;

      totalCost += cost;
      totalTokens += tokens;

      // Track model costs
      modelCosts[item.model] = (modelCosts[item.model] || 0) + cost;

      // Track daily costs
      dailyBreakdown[item.date] = (dailyBreakdown[item.date] || 0) + cost;

      // Track provider costs
      providerBreakdown[item.provider] = (providerBreakdown[item.provider] || 0) + cost;
    }

    const sortedModels = Object.entries(modelCosts).sort((a, b) => b[1] - a[1]);

    return {
      totalCost,
      totalTokens,
      averageCostPerRequest: usage.length > 0 ? totalCost / usage.length : 0,
      mostExpensiveModel: sortedModels[0]?.[0] || 'N/A',
      cheapestModel: sortedModels[sortedModels.length - 1]?.[0] || 'N/A',
      dailyBreakdown,
      providerBreakdown: providerBreakdown as Record<AIProvider, number>,
    };
  }
}