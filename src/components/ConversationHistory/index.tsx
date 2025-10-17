import React, { useState, useEffect } from 'react';
import {
  Search,
  Calendar,
  MessageSquare,
  Trash2,
  Download,
  Filter,
  ChevronRight,
  Clock,
  User,
  Bot,
} from 'lucide-react';
import { Conversation } from '@/types/extension';
import { AIProvider } from '@/types/ai';
import { CostCalculator } from '@/utils/costCalculator';

interface ConversationHistoryProps {
  conversations: Conversation[];
  onSelect: (conversation: Conversation) => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversations,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<AIProvider | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'longest'>('recent');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    filterAndSortConversations();
  }, [conversations, searchQuery, filterProvider, sortBy]);

  const filterAndSortConversations = () => {
    let filtered = [...conversations];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        const titleMatch = conv.title.toLowerCase().includes(query);
        const messageMatch = conv.messages.some(msg =>
          msg.content.toLowerCase().includes(query)
        );
        return titleMatch || messageMatch;
      });
    }

    // Apply provider filter
    if (filterProvider !== 'all') {
      filtered = filtered.filter(conv => conv.provider === filterProvider);
    }

    // Apply sorting
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'oldest':
        filtered.sort((a, b) => a.updatedAt - b.updatedAt);
        break;
      case 'longest':
        filtered.sort((a, b) => b.messages.length - a.messages.length);
        break;
    }

    setFilteredConversations(filtered);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      await chrome.runtime.sendMessage({
        type: 'DELETE_CONVERSATION',
        payload: { id },
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (confirm(`Delete ${selectedIds.size} selected conversation(s)?`)) {
      for (const id of selectedIds) {
        await chrome.runtime.sendMessage({
          type: 'DELETE_CONVERSATION',
          payload: { id },
        });
      }
      setSelectedIds(new Set());
    }
  };

  const handleExport = (conversation: Conversation) => {
    const data = JSON.stringify(conversation, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkExport = () => {
    const selected = filteredConversations.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return;

    const data = JSON.stringify(selected, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversations-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map(c => c.id)));
    }
  };

  const getProviderColor = (provider: AIProvider): string => {
    const colors = {
      claude: 'bg-amber-500',
      chatgpt: 'bg-green-500',
      gemini: 'bg-blue-500',
      grok: 'bg-cyan-500',
    };
    return colors[provider] || 'bg-gray-500';
  };

  const calculateConversationStats = (conversation: Conversation) => {
    const messageCount = conversation.messages.length;
    const tokenCount = conversation.totalTokens?.input + conversation.totalTokens?.output || 0;
    const cost = conversation.totalCost || 0;
    return { messageCount, tokenCount, cost };
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value as AIProvider | 'all')}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="all">All Providers</option>
            <option value="claude">Claude</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="gemini">Gemini</option>
            <option value="grok">Grok</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest' | 'longest')}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="longest">Most Messages</option>
          </select>

          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {selectedIds.size === filteredConversations.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBulkExport}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Export
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No conversations found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Start a new conversation to see it here'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredConversations.map(conversation => {
              const stats = calculateConversationStats(conversation);
              const isSelected = selectedIds.has(conversation.id);

              return (
                <div
                  key={conversation.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(conversation.id)}
                      className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />

                    <div
                      className={`w-2 h-2 mt-2 rounded-full ${getProviderColor(
                        conversation.provider
                      )}`}
                    />

                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onSelect(conversation)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {conversation.title}
                          </h4>
                          <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {conversation.messages[0] && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            {conversation.messages[0].content}
                          </p>
                        )}

                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(conversation.updatedAt)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{stats.messageCount} messages</span>
                          </span>
                          {stats.cost > 0 && (
                            <span>{CostCalculator.format(stats.cost)}</span>
                          )}
                        </div>
                      </button>

                      <div className="mt-2 flex items-center space-x-2">
                        <button
                          onClick={() => handleExport(conversation)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Export conversation"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(conversation.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {filteredConversations.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Total</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {filteredConversations.length} conversations
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Messages</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {filteredConversations.reduce(
                  (sum, c) => sum + c.messages.length,
                  0
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-gray-400">Total Cost</div>
              <div className="font-medium text-gray-900 dark:text-white">
                {CostCalculator.format(
                  filteredConversations.reduce(
                    (sum, c) => sum + (c.totalCost || 0),
                    0
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};