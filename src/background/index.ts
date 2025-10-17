import { ExtensionMessage, MessageType, Conversation } from '@/types/extension';
import { AIProvider, AIRequest, AIResponse } from '@/types/ai';
import storageService from '@/services/storage';
import { createContextMenus, handleContextMenuClick } from './contextManager';
import { AIRouter } from './aiRouter';
import { APIManager } from './apiManager';
import { ContextManager } from './contextManager';

// Initialize services
const aiRouter = new AIRouter();
const apiManager = new APIManager();
const contextManager = new ContextManager();

// Initialize context menus when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  initializeDefaultSettings();
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Indicate we will respond asynchronously
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  handleCommand(command);
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextMenuClick(info, tab);
});

// Handle tab updates for context extraction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    contextManager.updateTabContext(tabId, tab);
  }
});

// Message handler
async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    switch (message.type) {
      case 'SEND_TO_AI': {
        const { request } = message.payload;
        const response = await sendToAI(request);
        sendResponse(response);
        break;
      }

      case 'GET_CONTEXT': {
        const tabId = sender.tab?.id;
        if (tabId) {
          const context = await contextManager.getContext(tabId);
          sendResponse(context);
        }
        break;
      }

      case 'GET_SETTINGS': {
        const settings = await storageService.getSettings();
        sendResponse(settings);
        break;
      }

      case 'UPDATE_SETTINGS': {
        const { updates } = message.payload;
        await storageService.updateSettings(updates);
        sendResponse({ success: true });
        break;
      }

      case 'SAVE_CONVERSATION': {
        const { conversation } = message.payload;
        await storageService.saveConversation(conversation);
        sendResponse({ success: true });
        break;
      }

      case 'GET_CONVERSATION_HISTORY': {
        const conversations = await storageService.getConversations();
        sendResponse(conversations);
        break;
      }

      case 'CLEAR_HISTORY': {
        await storageService.set('conversations', [], 'local');
        sendResponse({ success: true });
        break;
      }

      case 'API_KEY_UPDATED': {
        const { provider, apiKey, masterPassword } = message.payload;
        await storageService.saveAPIKey(provider, apiKey, masterPassword);
        sendResponse({ success: true });
        break;
      }

      case 'TOGGLE_SIDEBAR': {
        const tabId = sender.tab?.id;
        if (tabId) {
          chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR' });
          sendResponse({ success: true });
        }
        break;
      }

      case 'OPEN_COMMAND_PALETTE': {
        const tabId = sender.tab?.id;
        if (tabId) {
          chrome.tabs.sendMessage(tabId, { type: 'OPEN_COMMAND_PALETTE' });
          sendResponse({ success: true });
        }
        break;
      }

      default:
        sendResponse({ error: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
}

// Handle keyboard shortcuts
async function handleCommand(command: string) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!activeTab?.id) return;

  switch (command) {
    case 'toggle-sidebar':
      chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_SIDEBAR' });
      break;
    case 'open-command-palette':
      chrome.tabs.sendMessage(activeTab.id, { type: 'OPEN_COMMAND_PALETTE' });
      break;
    case 'quick-ask':
      chrome.tabs.sendMessage(activeTab.id, { type: 'QUICK_ASK' });
      break;
  }
}

// Send request to AI provider
async function sendToAI(request: AIRequest): Promise<AIResponse> {
  try {
    const settings = await storageService.getSettings();

    // Determine which provider to use
    let provider = request.provider;

    if (!provider && settings.general.autoRouting) {
      // Use AI router to determine best provider
      provider = await aiRouter.route(request);
    } else if (!provider) {
      provider = settings.general.defaultProvider;
    }

    // Get API key for the provider
    const masterPassword = await getMasterPassword(); // You'll need to implement this
    const apiKey = await storageService.getAPIKey(provider, masterPassword);

    if (!apiKey) {
      throw new Error(`API key not found for ${provider}`);
    }

    // Check cache if enabled
    if (settings.advanced.cacheResponses) {
      const cacheKey = generateCacheKey(request);
      const cached = await storageService.getCachedResponse(cacheKey);
      if (cached) {
        return cached.response;
      }
    }

    // Send request to API
    const response = await apiManager.sendRequest({
      ...request,
      provider,
      apiKey,
      settings: settings.providers[provider],
    });

    // Cache response if enabled
    if (settings.advanced.cacheResponses && response && !response.error) {
      const cacheKey = generateCacheKey(request);
      await storageService.setCachedResponse(cacheKey, response, provider);
    }

    // Track usage
    await trackUsage(provider, response);

    return response;
  } catch (error) {
    console.error('Error sending to AI:', error);
    return {
      provider: request.provider || 'claude',
      model: request.model || '',
      content: '',
      error: error.message,
    };
  }
}

// Initialize default settings on first install
async function initializeDefaultSettings() {
  const settings = await storageService.get('settings', 'sync');
  if (!settings) {
    await storageService.set('settings', storageService.getDefaultSettings(), 'sync');
  }
}

// Generate cache key for request
function generateCacheKey(request: AIRequest): string {
  const key = JSON.stringify({
    provider: request.provider,
    model: request.model,
    messages: request.messages,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
  });
  return btoa(key);
}

// Track API usage for cost monitoring
async function trackUsage(provider: AIProvider, response: AIResponse) {
  const usage = await storageService.get('usage', 'local') || {
    totalRequests: 0,
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    byProvider: {},
    dailyUsage: [],
    alerts: [],
  };

  // Update total stats
  usage.totalRequests++;
  if (response.usage) {
    usage.totalTokens.input += response.usage.inputTokens || 0;
    usage.totalTokens.output += response.usage.outputTokens || 0;
  }
  if (response.cost) {
    usage.totalCost += response.cost;
  }

  // Update provider stats
  if (!usage.byProvider[provider]) {
    usage.byProvider[provider] = {
      requests: 0,
      tokens: { input: 0, output: 0 },
      cost: 0,
      errors: 0,
      averageResponseTime: 0,
    };
  }

  usage.byProvider[provider].requests++;
  if (response.usage) {
    usage.byProvider[provider].tokens.input += response.usage.inputTokens || 0;
    usage.byProvider[provider].tokens.output += response.usage.outputTokens || 0;
  }
  if (response.cost) {
    usage.byProvider[provider].cost += response.cost;
  }
  if (response.error) {
    usage.byProvider[provider].errors++;
  }

  // Update daily usage
  const today = new Date().toISOString().split('T')[0];
  const todayUsage = usage.dailyUsage.find(d => d.date === today);

  if (todayUsage) {
    todayUsage.requests++;
    todayUsage.cost += response.cost || 0;
    todayUsage.providers[provider] = (todayUsage.providers[provider] || 0) + 1;
  } else {
    usage.dailyUsage.push({
      date: today,
      requests: 1,
      tokens: response.usage?.totalTokens || 0,
      cost: response.cost || 0,
      providers: { [provider]: 1 },
    });
  }

  // Keep only last 30 days
  usage.dailyUsage = usage.dailyUsage.slice(-30);

  // Check for budget alerts
  if (usage.monthlyBudget) {
    const monthlyTotal = usage.dailyUsage
      .filter(d => {
        const date = new Date(d.date);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      })
      .reduce((sum, d) => sum + d.cost, 0);

    if (monthlyTotal > usage.monthlyBudget * 0.8) {
      usage.alerts.push({
        id: `budget-${Date.now()}`,
        type: 'budget',
        message: `You've used ${Math.round((monthlyTotal / usage.monthlyBudget) * 100)}% of your monthly budget`,
        timestamp: Date.now(),
        dismissed: false,
      });
    }
  }

  await storageService.set('usage', usage, 'local');
}

// Get master password (you'll need to implement a secure way to get this)
async function getMasterPassword(): Promise<string> {
  // This is a placeholder - in production, you'd want to:
  // 1. Prompt user for master password on first use
  // 2. Store it securely in memory during session
  // 3. Require re-entry after certain period or on browser restart
  return 'temporary-master-password'; // TODO: Implement secure master password handling
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
  }
});

// Clean up old data periodically
setInterval(async () => {
  // Clear old cache entries
  const cache = await storageService.get('cache', 'local');
  if (cache) {
    const now = Date.now();
    const entries = cache.entries instanceof Map ? cache.entries : new Map(Object.entries(cache.entries || {}));

    for (const [key, entry] of entries) {
      if (now - entry.timestamp > cache.ttl) {
        await storageService.removeCachedResponse(key);
      }
    }
  }

  // Clear old conversations if configured
  const settings = await storageService.getSettings();
  if (settings.privacy.clearHistoryOnClose) {
    // This would be triggered on browser close in production
  }
}, 3600000); // Run every hour