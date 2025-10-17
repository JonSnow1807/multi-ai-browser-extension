import { StorageData, StorageArea, StorageService as IStorageService, ResponseCache, CachedResponse } from '@/types/storage';
import { ExtensionSettings, Conversation, PromptTemplate, SidebarState } from '@/types/extension';
import { AIProvider } from '@/types/ai';
import encryptionService from './encryption';

class StorageService implements IStorageService {
  private static instance: StorageService;
  private listeners: Set<(changes: chrome.storage.StorageChange) => void> = new Set();
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private cacheTimeout = 5000; // 5 seconds cache

  private constructor() {
    this.initializeListener();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  private initializeListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      // Clear cache for changed keys
      Object.keys(changes).forEach(key => {
        this.cache.delete(key);
      });

      // Notify all listeners
      this.listeners.forEach(listener => {
        listener(changes);
      });
    });
  }

  async get<K extends keyof StorageData>(key: K, area: StorageArea = 'local'): Promise<StorageData[K] | null> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      const result = await storage.get(key);
      const value = result[key] || null;

      // Update cache
      if (value !== null) {
        this.cache.set(key, { value, timestamp: Date.now() });
      }

      return value;
    } catch (error) {
      console.error(`Failed to get ${key} from ${area} storage:`, error);
      return null;
    }
  }

  async set<K extends keyof StorageData>(key: K, value: StorageData[K], area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.set({ [key]: value });

      // Update cache
      this.cache.set(key, { value, timestamp: Date.now() });
    } catch (error) {
      console.error(`Failed to set ${key} in ${area} storage:`, error);
      throw error;
    }
  }

  async remove(key: keyof StorageData, area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.remove(key);
      this.cache.delete(key);
    } catch (error) {
      console.error(`Failed to remove ${key} from ${area} storage:`, error);
      throw error;
    }
  }

  async clear(area: StorageArea = 'local'): Promise<void> {
    try {
      const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storage.clear();
      this.cache.clear();
    } catch (error) {
      console.error(`Failed to clear ${area} storage:`, error);
      throw error;
    }
  }

  addListener(callback: (changes: chrome.storage.StorageChange) => void): void {
    this.listeners.add(callback);
  }

  removeListener(callback: (changes: chrome.storage.StorageChange) => void): void {
    this.listeners.delete(callback);
  }

  // Default settings
  getDefaultSettings(): ExtensionSettings {
    return {
      general: {
        defaultProvider: 'claude',
        autoRouting: true,
        keyboardShortcuts: {
          toggleSidebar: 'Cmd+Shift+A',
          openCommandPalette: 'Cmd+Shift+K',
          quickAsk: 'Cmd+Shift+Space',
        },
        language: 'en',
        notifications: true,
      },
      providers: {
        claude: {
          enabled: true,
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7,
          maxTokens: 4000,
        },
        chatgpt: {
          enabled: true,
          model: 'gpt-4-turbo-preview',
          temperature: 0.7,
          maxTokens: 4000,
        },
        gemini: {
          enabled: true,
          model: 'gemini-pro',
          temperature: 0.7,
          maxTokens: 4000,
        },
        grok: {
          enabled: true,
          model: 'grok-beta',
          temperature: 0.7,
          maxTokens: 4000,
        },
      },
      privacy: {
        excludedDomains: [
          'bank*',
          '*banking*',
          '*paypal.com',
          '*stripe.com',
          '*.gov',
          '*healthcare*',
          '*medical*',
        ],
        sensitiveMode: false,
        clearHistoryOnClose: false,
        anonymousAnalytics: false,
        contextSharing: 'selection',
      },
      advanced: {
        developerMode: false,
        rateLimiting: {
          enabled: true,
          requestsPerMinute: 20,
        },
        concurrentRequests: 3,
        cacheResponses: true,
        cacheTTL: 3600000, // 1 hour
        debugLogging: false,
      },
      appearance: {
        theme: 'auto',
        fontSize: 'medium',
        fontFamily: 'system-ui',
        accentColor: '#6366f1',
        compactMode: false,
      },
    };
  }

  // Settings management
  async getSettings(): Promise<ExtensionSettings> {
    const settings = await this.get('settings', 'sync');
    return settings || this.getDefaultSettings();
  }

  async updateSettings(updates: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    const merged = this.deepMerge(current, updates);
    await this.set('settings', merged, 'sync');
  }

  // Conversation management
  async getConversations(): Promise<Conversation[]> {
    const conversations = await this.get('conversations', 'local');
    return conversations || [];
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const conversations = await this.getConversations();
    const index = conversations.findIndex(c => c.id === conversation.id);

    if (index >= 0) {
      conversations[index] = conversation;
    } else {
      conversations.unshift(conversation);
    }

    // Keep only last 100 conversations
    const trimmed = conversations.slice(0, 100);
    await this.set('conversations', trimmed, 'local');
  }

  async deleteConversation(id: string): Promise<void> {
    const conversations = await this.getConversations();
    const filtered = conversations.filter(c => c.id !== id);
    await this.set('conversations', filtered, 'local');
  }

  // Prompt template management
  async getPromptTemplates(): Promise<PromptTemplate[]> {
    const templates = await this.get('promptTemplates', 'sync');
    return templates || this.getBuiltInPromptTemplates();
  }

  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    const templates = await this.getPromptTemplates();
    const index = templates.findIndex(t => t.id === template.id);

    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.push(template);
    }

    await this.set('promptTemplates', templates, 'sync');
  }

  async deletePromptTemplate(id: string): Promise<void> {
    const templates = await this.getPromptTemplates();
    const filtered = templates.filter(t => t.id !== id && !t.isBuiltIn);
    await this.set('promptTemplates', filtered, 'sync');
  }

  // API key management with encryption
  async saveAPIKey(provider: AIProvider, apiKey: string, masterPassword: string): Promise<void> {
    const encrypted = await encryptionService.encryptAPIKey(apiKey, masterPassword);
    const keys = await this.get('apiKeys', 'local') || {};
    keys[provider] = encrypted;
    await this.set('apiKeys', keys, 'local');
  }

  async getAPIKey(provider: AIProvider, masterPassword: string): Promise<string | null> {
    const keys = await this.get('apiKeys', 'local');
    if (!keys || !keys[provider]) {
      return null;
    }

    try {
      return await encryptionService.decryptAPIKey(keys[provider], masterPassword);
    } catch (error) {
      console.error(`Failed to decrypt API key for ${provider}:`, error);
      return null;
    }
  }

  async removeAPIKey(provider: AIProvider): Promise<void> {
    const keys = await this.get('apiKeys', 'local') || {};
    delete keys[provider];
    await this.set('apiKeys', keys, 'local');
  }

  // Cache management
  async getCachedResponse(key: string): Promise<CachedResponse | null> {
    const cache = await this.get('cache', 'local');
    if (!cache || !cache.entries) {
      return null;
    }

    const entry = cache.entries.get(key);
    if (!entry) {
      return null;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - entry.timestamp > cache.ttl) {
      // Cache expired
      await this.removeCachedResponse(key);
      return null;
    }

    // Update hit count
    entry.hits++;
    await this.set('cache', cache, 'local');

    return entry;
  }

  async setCachedResponse(key: string, response: any, provider: AIProvider): Promise<void> {
    let cache = await this.get('cache', 'local');
    if (!cache) {
      cache = {
        entries: new Map(),
        maxSize: 100,
        ttl: 3600000, // 1 hour
      };
    }

    const entry: CachedResponse = {
      key,
      response,
      timestamp: Date.now(),
      hits: 0,
      provider,
    };

    // Ensure Map is properly initialized
    if (!(cache.entries instanceof Map)) {
      cache.entries = new Map(Object.entries(cache.entries || {}));
    }

    cache.entries.set(key, entry);

    // Enforce max size
    if (cache.entries.size > cache.maxSize) {
      const sortedEntries = Array.from(cache.entries.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest entries
      const toRemove = sortedEntries.slice(0, cache.entries.size - cache.maxSize);
      toRemove.forEach(([key]) => cache.entries.delete(key));
    }

    await this.set('cache', cache, 'local');
  }

  async removeCachedResponse(key: string): Promise<void> {
    const cache = await this.get('cache', 'local');
    if (!cache || !cache.entries) {
      return;
    }

    if (!(cache.entries instanceof Map)) {
      cache.entries = new Map(Object.entries(cache.entries));
    }

    cache.entries.delete(key);
    await this.set('cache', cache, 'local');
  }

  async clearCache(): Promise<void> {
    await this.remove('cache', 'local');
  }

  // Utility methods
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  private getBuiltInPromptTemplates(): PromptTemplate[] {
    return [
      {
        id: 'summarize-page',
        name: 'Summarize Page',
        description: 'Create a concise summary of the current page',
        category: 'summarization',
        template: 'Please summarize the following content in 3-5 bullet points:\n\n{selection}',
        variables: [
          { name: 'selection', description: 'Selected text or page content', type: 'selection', required: true }
        ],
        isBuiltIn: true,
      },
      {
        id: 'explain-code',
        name: 'Explain Code',
        description: 'Get a detailed explanation of selected code',
        category: 'coding',
        template: 'Please explain what this code does:\n\n```\n{selection}\n```',
        variables: [
          { name: 'selection', description: 'Selected code', type: 'selection', required: true }
        ],
        isBuiltIn: true,
      },
      {
        id: 'improve-writing',
        name: 'Improve Writing',
        description: 'Enhance clarity and style of selected text',
        category: 'writing',
        template: 'Please improve the following text for clarity and style while maintaining its original meaning:\n\n{selection}',
        variables: [
          { name: 'selection', description: 'Selected text', type: 'selection', required: true }
        ],
        isBuiltIn: true,
      },
      // Add more built-in templates as needed
    ];
  }

  // Export/import functionality
  async exportData(): Promise<string> {
    const settings = await this.getSettings();
    const conversations = await this.getConversations();
    const promptTemplates = await this.getPromptTemplates();

    const exportData = {
      version: '1.0.0',
      timestamp: Date.now(),
      settings,
      conversations,
      promptTemplates: promptTemplates.filter(t => !t.isBuiltIn),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);

      if (data.settings) {
        await this.set('settings', data.settings, 'sync');
      }

      if (data.conversations) {
        await this.set('conversations', data.conversations, 'local');
      }

      if (data.promptTemplates) {
        const current = await this.getPromptTemplates();
        const builtIn = current.filter(t => t.isBuiltIn);
        const merged = [...builtIn, ...data.promptTemplates];
        await this.set('promptTemplates', merged, 'sync');
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Invalid import data format');
    }
  }
}

export default StorageService.getInstance();