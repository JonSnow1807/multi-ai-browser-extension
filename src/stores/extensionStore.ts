import { create } from 'zustand';
import { ExtensionSettings, Conversation, PromptTemplate } from '@/types/extension';
import { AIProvider } from '@/types/ai';
import storageService from '@/services/storage';

interface ExtensionState {
  // Settings
  settings: ExtensionSettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;

  // Conversations
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loadConversations: () => Promise<void>;
  addConversation: (conversation: Conversation) => Promise<void>;
  updateConversation: (conversation: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;

  // Prompt Templates
  promptTemplates: PromptTemplate[];
  loadPromptTemplates: () => Promise<void>;
  addPromptTemplate: (template: PromptTemplate) => Promise<void>;
  updatePromptTemplate: (template: PromptTemplate) => Promise<void>;
  deletePromptTemplate: (id: string) => Promise<void>;

  // Usage Stats
  loadUsageStats: () => Promise<any>;

  // API Keys
  apiKeys: Record<AIProvider, boolean>;
  checkAPIKeys: () => Promise<void>;

  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  activeProvider: AIProvider;
  setActiveProvider: (provider: AIProvider) => void;
}

export const useExtensionStore = create<ExtensionState>((set, get) => ({
  // Settings
  settings: null,
  loadSettings: async () => {
    try {
      const settings = await storageService.getSettings();
      set({ settings });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },
  updateSettings: async (updates) => {
    try {
      await storageService.updateSettings(updates);
      const settings = await storageService.getSettings();
      set({ settings });
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  },

  // Conversations
  conversations: [],
  currentConversation: null,
  loadConversations: async () => {
    try {
      const conversations = await storageService.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },
  addConversation: async (conversation) => {
    try {
      await storageService.saveConversation(conversation);
      const conversations = await storageService.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to add conversation:', error);
    }
  },
  updateConversation: async (conversation) => {
    try {
      await storageService.saveConversation(conversation);
      const conversations = await storageService.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  },
  deleteConversation: async (id) => {
    try {
      await storageService.deleteConversation(id);
      const conversations = await storageService.getConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  },
  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
  },

  // Prompt Templates
  promptTemplates: [],
  loadPromptTemplates: async () => {
    try {
      const promptTemplates = await storageService.getPromptTemplates();
      set({ promptTemplates });
    } catch (error) {
      console.error('Failed to load prompt templates:', error);
    }
  },
  addPromptTemplate: async (template) => {
    try {
      await storageService.savePromptTemplate(template);
      const promptTemplates = await storageService.getPromptTemplates();
      set({ promptTemplates });
    } catch (error) {
      console.error('Failed to add prompt template:', error);
    }
  },
  updatePromptTemplate: async (template) => {
    try {
      await storageService.savePromptTemplate(template);
      const promptTemplates = await storageService.getPromptTemplates();
      set({ promptTemplates });
    } catch (error) {
      console.error('Failed to update prompt template:', error);
    }
  },
  deletePromptTemplate: async (id) => {
    try {
      await storageService.deletePromptTemplate(id);
      const promptTemplates = await storageService.getPromptTemplates();
      set({ promptTemplates });
    } catch (error) {
      console.error('Failed to delete prompt template:', error);
    }
  },

  // Usage Stats
  loadUsageStats: async () => {
    try {
      const usage = await storageService.get('usage', 'local');
      return usage || {
        totalRequests: 0,
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        todayCost: 0,
      };
    } catch (error) {
      console.error('Failed to load usage stats:', error);
      return null;
    }
  },

  // API Keys
  apiKeys: {
    claude: false,
    chatgpt: false,
    gemini: false,
    grok: false,
  },
  checkAPIKeys: async () => {
    try {
      const keys = await storageService.get('apiKeys', 'local');
      const apiKeys = {
        claude: !!keys?.claude,
        chatgpt: !!keys?.chatgpt,
        gemini: !!keys?.gemini,
        grok: !!keys?.grok,
      };
      set({ apiKeys });
    } catch (error) {
      console.error('Failed to check API keys:', error);
    }
  },

  // UI State
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  activeProvider: 'claude',
  setActiveProvider: (provider) => set({ activeProvider: provider }),
}));