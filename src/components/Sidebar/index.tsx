import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, History, BookOpen, MessageSquare, Minimize2, Maximize2 } from 'lucide-react';
import { ProviderSelector } from '../ProviderSelector';
import { ChatInterface } from '../Chat';
import { ConversationHistory } from '../ConversationHistory';
import { PromptLibrary } from '../PromptLibrary';
import { AIProvider, AIMessage } from '@/types/ai';
import { Conversation } from '@/types/extension';
import { useExtensionStore } from '@/stores/extensionStore';

type TabType = 'chat' | 'history' | 'prompts' | 'settings';

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);

  const {
    conversations,
    settings,
    addConversation,
    updateConversation,
    loadSettings,
    loadConversations,
  } = useExtensionStore();

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initial data
    loadSettings();
    loadConversations();

    // Listen for sidebar events
    const handleSidebarToggle = (event: CustomEvent) => {
      if (!event.detail.open) {
        setIsMinimized(true);
      }
    };

    const handleSidebarRequest = (event: CustomEvent) => {
      const { provider, message, context } = event.detail;
      if (provider) {
        setSelectedProvider(provider);
      }
      // Handle the incoming request
      handleNewMessage(message, context);
      setActiveTab('chat');
    };

    document.addEventListener('mai-sidebar-toggle', handleSidebarToggle as EventListener);
    document.addEventListener('mai-sidebar-request', handleSidebarRequest as EventListener);

    return () => {
      document.removeEventListener('mai-sidebar-toggle', handleSidebarToggle as EventListener);
      document.removeEventListener('mai-sidebar-request', handleSidebarRequest as EventListener);
    };
  }, []);

  const handleNewMessage = (message: string, context?: any) => {
    // Create or update current conversation
    if (!currentConversation) {
      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        title: message.substring(0, 50),
        provider: selectedProvider,
        messages: [],
        context,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setCurrentConversation(newConversation);
      addConversation(newConversation);
    }
  };

  const handleClose = () => {
    const event = new CustomEvent('mai-close-sidebar');
    document.dispatchEvent(event);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setSelectedProvider(conversation.provider);
    setActiveTab('chat');
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setActiveTab('chat');
  };

  const handleOpenSettings = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  };

  return (
    <div
      ref={sidebarRef}
      className={`flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-300 ${
        isMinimized ? 'w-12' : 'w-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!isMinimized && (
          <>
            <div className="flex items-center space-x-3">
              <img
                src={chrome.runtime.getURL('icons/icon48.png')}
                alt="Multi-AI"
                className="w-8 h-8"
              />
              <h2 className="text-lg font-semibold">Multi-AI Assistant</h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleMinimize}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
        {isMinimized && (
          <button
            onClick={handleMinimize}
            className="mx-auto p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {!isMinimized && (
        <>
          {/* Provider Selector */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <ProviderSelector
              selected={selectedProvider}
              onChange={setSelectedProvider}
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-sm font-medium">Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">History</span>
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 border-b-2 transition-colors ${
                activeTab === 'prompts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Prompts</span>
            </button>
            <button
              onClick={handleOpenSettings}
              className="flex items-center justify-center px-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' && (
              <ChatInterface
                provider={selectedProvider}
                conversation={currentConversation}
                onNewConversation={handleNewConversation}
                onUpdateConversation={(conv) => {
                  setCurrentConversation(conv);
                  updateConversation(conv);
                }}
              />
            )}
            {activeTab === 'history' && (
              <ConversationHistory
                conversations={conversations}
                onSelect={handleSelectConversation}
              />
            )}
            {activeTab === 'prompts' && (
              <PromptLibrary
                onSelectPrompt={(prompt) => {
                  // Handle prompt selection
                  setActiveTab('chat');
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};