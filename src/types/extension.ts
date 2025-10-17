import { AIProvider, AIMessage, PageContext } from './ai';

export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
  id?: string;
  timestamp?: number;
}

export type MessageType =
  | 'TOGGLE_SIDEBAR'
  | 'OPEN_COMMAND_PALETTE'
  | 'SEND_TO_AI'
  | 'GET_CONTEXT'
  | 'UPDATE_SETTINGS'
  | 'GET_SETTINGS'
  | 'SAVE_CONVERSATION'
  | 'GET_CONVERSATION_HISTORY'
  | 'CLEAR_HISTORY'
  | 'API_KEY_UPDATED'
  | 'PROVIDER_CHANGED'
  | 'STREAM_CHUNK'
  | 'STREAM_END'
  | 'ERROR';

export interface Conversation {
  id: string;
  title: string;
  provider: AIProvider;
  messages: AIMessage[];
  context?: PageContext;
  createdAt: number;
  updatedAt: number;
  totalCost?: number;
  totalTokens?: {
    input: number;
    output: number;
  };
  tags?: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  template: string;
  variables: PromptVariable[];
  provider?: AIProvider;
  isBuiltIn: boolean;
  createdAt?: number;
  updatedAt?: number;
  usageCount?: number;
}

export type PromptCategory =
  | 'coding'
  | 'writing'
  | 'research'
  | 'analysis'
  | 'creative'
  | 'translation'
  | 'summarization'
  | 'general';

export interface PromptVariable {
  name: string;
  description: string;
  type: 'text' | 'selection' | 'url' | 'title' | 'date' | 'custom';
  defaultValue?: string;
  required?: boolean;
}

export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  action: () => void | Promise<void>;
  category?: string;
  keywords?: string[];
  shortcut?: string;
}

export interface SidebarState {
  isOpen: boolean;
  width: number;
  position: 'left' | 'right';
  activeTab: 'chat' | 'history' | 'prompts' | 'settings';
  pinnedPrompts: string[];
}

export interface ExtensionSettings {
  general: GeneralSettings;
  providers: Record<AIProvider, ProviderSettings>;
  privacy: PrivacySettings;
  advanced: AdvancedSettings;
  appearance: AppearanceSettings;
}

export interface GeneralSettings {
  defaultProvider: AIProvider;
  autoRouting: boolean;
  keyboardShortcuts: Record<string, string>;
  language: string;
  notifications: boolean;
}

export interface ProviderSettings {
  enabled: boolean;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface PrivacySettings {
  excludedDomains: string[];
  sensitiveMode: boolean;
  clearHistoryOnClose: boolean;
  anonymousAnalytics: boolean;
  contextSharing: 'none' | 'selection' | 'visible' | 'full';
}

export interface AdvancedSettings {
  developerMode: boolean;
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  concurrentRequests: number;
  cacheResponses: boolean;
  cacheTTL: number;
  debugLogging: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  fontFamily: string;
  accentColor: string;
  compactMode: boolean;
}

export interface ContextMenuItem {
  id: string;
  title: string;
  contexts: chrome.contextMenus.ContextType[];
  parentId?: string;
  onclick: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
}