import React, { useState } from 'react';
import { ChevronDown, Check, Sparkles, Zap, Globe, MessageCircle } from 'lucide-react';
import { AIProvider } from '@/types/ai';

interface ProviderSelectorProps {
  selected: AIProvider;
  onChange: (provider: AIProvider) => void;
  disabled?: boolean;
}

interface ProviderInfo {
  id: AIProvider;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const providers: ProviderInfo[] = [
  {
    id: 'claude',
    name: 'Claude',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'from-amber-500 to-orange-600',
    description: 'Best for creative writing & analysis',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: <MessageCircle className="w-4 h-4" />,
    color: 'from-green-500 to-emerald-600',
    description: 'Excellent for code & technical tasks',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: <Globe className="w-4 h-4" />,
    color: 'from-blue-500 to-indigo-600',
    description: 'Great for research & real-time info',
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: <Zap className="w-4 h-4" />,
    color: 'from-cyan-500 to-blue-600',
    description: 'Fast responses & social media',
  },
];

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selected,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedProvider = providers.find(p => p.id === selected) || providers[0];

  const handleSelect = (provider: AIProvider) => {
    onChange(provider);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between space-x-3 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 bg-gradient-to-r ${selectedProvider.color} rounded-lg text-white`}>
            {selectedProvider.icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedProvider.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {selectedProvider.description}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {providers.map(provider => (
            <button
              key={provider.id}
              onClick={() => handleSelect(provider.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 bg-gradient-to-r ${provider.color} rounded-lg text-white`}>
                  {provider.icon}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {provider.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {provider.description}
                  </div>
                </div>
              </div>
              {provider.id === selected && (
                <Check className="w-5 h-5 text-blue-500" />
              )}
            </button>
          ))}

          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setIsOpen(false);
                chrome.runtime.sendMessage({ type: 'OPEN_COMPARISON_MODE' });
              }}
              className="w-full px-4 py-3 text-left text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🔀 Compare All AIs
            </button>
          </div>
        </div>
      )}
    </div>
  );
};