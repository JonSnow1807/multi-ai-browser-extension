import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Settings,
  History,
  BookOpen,
  TrendingUp,
  DollarSign,
  Zap,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { AIProvider } from '@/types/ai';
import { ProviderSelector } from '@/components/ProviderSelector';
import { useExtensionStore } from '@/stores/extensionStore';
import { CostCalculator } from '@/utils/costCalculator';

export const Popup: React.FC = () => {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [quickPrompt, setQuickPrompt] = useState('');
  const [usageStats, setUsageStats] = useState<any>(null);

  const { settings, loadSettings, loadUsageStats } = useExtensionStore();

  useEffect(() => {
    loadSettings();
    loadUsageStats().then(setUsageStats);

    // Set default provider from settings
    if (settings?.general?.defaultProvider) {
      setSelectedProvider(settings.general.defaultProvider);
    }
  }, []);

  const handleOpenSidebar = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
      window.close();
    }
  };

  const handleQuickAsk = async () => {
    if (!quickPrompt.trim()) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'OPEN_SIDEBAR_WITH_REQUEST',
        payload: {
          provider: selectedProvider,
          message: quickPrompt,
        },
      });
      window.close();
    }
  };

  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleOpenHistory = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_SIDEBAR',
      });
      // Send message to open history tab
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id!, {
          type: 'OPEN_HISTORY_TAB',
        });
      }, 300);
      window.close();
    }
  };

  const formatCost = (cost: number) => {
    return CostCalculator.format(cost || 0);
  };

  return (
    <div className="w-96 bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <img
              src={chrome.runtime.getURL('icons/icon48.png')}
              alt="Multi-AI"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-white font-semibold text-lg">Multi-AI Assistant</h1>
              <p className="text-blue-100 text-xs">Your unified AI companion</p>
            </div>
          </div>
          <button
            onClick={handleOpenSettings}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Usage Stats */}
        {usageStats && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/20 rounded-lg p-2">
              <div className="flex items-center space-x-1 text-blue-100 text-xs mb-1">
                <MessageSquare className="w-3 h-3" />
                <span>Requests</span>
              </div>
              <div className="text-white font-semibold">{usageStats.totalRequests || 0}</div>
            </div>
            <div className="bg-white/20 rounded-lg p-2">
              <div className="flex items-center space-x-1 text-blue-100 text-xs mb-1">
                <DollarSign className="w-3 h-3" />
                <span>Cost Today</span>
              </div>
              <div className="text-white font-semibold">{formatCost(usageStats.todayCost)}</div>
            </div>
            <div className="bg-white/20 rounded-lg p-2">
              <div className="flex items-center space-x-1 text-blue-100 text-xs mb-1">
                <Zap className="w-3 h-3" />
                <span>Tokens</span>
              </div>
              <div className="text-white font-semibold">
                {((usageStats.totalTokens?.input + usageStats.totalTokens?.output) / 1000).toFixed(1)}k
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <ProviderSelector selected={selectedProvider} onChange={setSelectedProvider} />
      </div>

      {/* Quick Ask */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          <textarea
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Type your question here..."
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            rows={3}
          />
          <div className="flex space-x-2">
            <button
              onClick={handleQuickAsk}
              disabled={!quickPrompt.trim()}
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Ask {selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}
            </button>
            <button
              onClick={handleOpenSidebar}
              className="py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Open full chat"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
          Quick Actions
        </h3>

        <button
          onClick={handleOpenSidebar}
          className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <MessageSquare className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium">Open Chat</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Start a new conversation
            </div>
          </div>
        </button>

        <button
          onClick={handleOpenHistory}
          className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium">Conversation History</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              View past conversations
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html#prompts') });
          }}
          className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <BookOpen className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium">Prompt Library</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Browse saved prompts
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html#usage') });
          }}
          className="w-full flex items-center space-x-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div>
            <div className="text-sm font-medium">Usage Analytics</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Track costs and usage
            </div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                chrome.tabs.create({
                  url: 'https://github.com/JonSnow1807/multi-ai-browser-extension',
                });
              }}
              className="hover:text-gray-700 dark:hover:text-gray-300"
            >
              GitHub
            </button>
            <button
              onClick={() => {
                chrome.tabs.create({
                  url: 'https://github.com/JonSnow1807/multi-ai-browser-extension/issues',
                });
              }}
              className="hover:text-gray-700 dark:hover:text-gray-300"
            >
              Report Issue
            </button>
          </div>
          <button
            onClick={() => {
              chrome.tabs.create({ url: chrome.runtime.getURL('options.html#help') });
            }}
            className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <HelpCircle className="w-3 h-3" />
            <span>Help</span>
          </button>
        </div>
      </div>
    </div>
  );
};