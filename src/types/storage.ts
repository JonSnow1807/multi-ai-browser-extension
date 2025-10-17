import { ExtensionSettings, Conversation, PromptTemplate, SidebarState } from './extension';
import { AIProvider } from './ai';

export interface StorageData {
  settings: ExtensionSettings;
  conversations: Conversation[];
  promptTemplates: PromptTemplate[];
  sidebarState: SidebarState;
  apiKeys: EncryptedAPIKeys;
  usage: UsageStats;
  cache: ResponseCache;
}

export interface EncryptedAPIKeys {
  [key: string]: {
    encrypted: string;
    iv: string;
    salt: string;
  };
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: {
    input: number;
    output: number;
  };
  totalCost: number;
  byProvider: Record<AIProvider, ProviderUsage>;
  dailyUsage: DailyUsage[];
  monthlyBudget?: number;
  alerts: UsageAlert[];
}

export interface ProviderUsage {
  requests: number;
  tokens: {
    input: number;
    output: number;
  };
  cost: number;
  errors: number;
  averageResponseTime: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  providers: Partial<Record<AIProvider, number>>;
}

export interface UsageAlert {
  id: string;
  type: 'budget' | 'rate_limit' | 'error';
  message: string;
  timestamp: number;
  dismissed: boolean;
}

export interface ResponseCache {
  entries: Map<string, CachedResponse>;
  maxSize: number;
  ttl: number;
}

export interface CachedResponse {
  key: string;
  response: any;
  timestamp: number;
  hits: number;
  provider: AIProvider;
}

export type StorageArea = 'sync' | 'local';

export interface StorageService {
  get<K extends keyof StorageData>(key: K, area?: StorageArea): Promise<StorageData[K] | null>;
  set<K extends keyof StorageData>(key: K, value: StorageData[K], area?: StorageArea): Promise<void>;
  remove(key: keyof StorageData, area?: StorageArea): Promise<void>;
  clear(area?: StorageArea): Promise<void>;
  addListener(callback: (changes: chrome.storage.StorageChange) => void): void;
  removeListener(callback: (changes: chrome.storage.StorageChange) => void): void;
}

export interface EncryptionService {
  encrypt(text: string, password: string): Promise<EncryptedData>;
  decrypt(data: EncryptedData, password: string): Promise<string>;
  generateKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
  hash(text: string): Promise<string>;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
}