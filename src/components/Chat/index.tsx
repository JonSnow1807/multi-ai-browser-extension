import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Loader,
  Copy,
  RotateCcw,
  Download,
  Trash2,
  StopCircle,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { AIProvider, AIMessage, AIRequest, StreamChunk } from '@/types/ai';
import { Conversation } from '@/types/extension';
import { TokenCounter } from '@/utils/tokenCounter';
import { CostCalculator } from '@/utils/costCalculator';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  provider: AIProvider;
  conversation: Conversation | null;
  onNewConversation: () => void;
  onUpdateConversation: (conversation: Conversation) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  provider,
  conversation,
  onNewConversation,
  onUpdateConversation,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (conversation) {
      setMessages(conversation.messages || []);
    } else {
      setMessages([]);
    }
  }, [conversation]);

  useEffect(() => {
    // Listen for streaming events
    const handleStreamChunk = (event: CustomEvent) => {
      const { requestId, chunk } = event.detail;
      if (requestId === activeRequestId) {
        setStreamingMessage(prev => prev + chunk.delta);
      }
    };

    const handleStreamEnd = (event: CustomEvent) => {
      const { requestId } = event.detail;
      if (requestId === activeRequestId) {
        finalizeStreamingMessage();
      }
    };

    document.addEventListener('mai-stream-chunk', handleStreamChunk as EventListener);
    document.addEventListener('mai-stream-end', handleStreamEnd as EventListener);

    return () => {
      document.removeEventListener('mai-stream-chunk', handleStreamChunk as EventListener);
      document.removeEventListener('mai-stream-end', handleStreamEnd as EventListener);
    };
  }, [activeRequestId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    // Update token count when input changes
    const tokens = TokenCounter.estimate(input, provider);
    setTokenCount(prev => ({ ...prev, input: tokens }));

    // Estimate cost
    const cost = CostCalculator.estimate(input, provider);
    setEstimatedCost(cost);
  }, [input, provider]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingMessage('');
    setError(null);

    try {
      // Get page context
      const context = await getPageContext();

      // Create request
      const request: AIRequest = {
        provider,
        model: getDefaultModel(provider),
        messages: newMessages,
        temperature: 0.7,
        maxTokens: 4000,
        stream: true,
        context,
      };

      // Generate request ID
      const requestId = `req-${Date.now()}`;
      setActiveRequestId(requestId);

      // Send to background
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_TO_AI',
        payload: { request, requestId },
      });

      if (response.error) {
        throw new Error(response.error);
      }

    } catch (err) {
      setError(err.message || 'Failed to send message');
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const finalizeStreamingMessage = () => {
    if (streamingMessage) {
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: streamingMessage,
        timestamp: Date.now(),
        provider,
        model: getDefaultModel(provider),
      };

      const updatedMessages = [...messages, assistantMessage];
      setMessages(updatedMessages);
      setStreamingMessage('');

      // Update conversation
      if (conversation) {
        onUpdateConversation({
          ...conversation,
          messages: updatedMessages,
          updatedAt: Date.now(),
        });
      } else {
        // Create new conversation
        const newConversation: Conversation = {
          id: `conv-${Date.now()}`,
          title: messages[0]?.content.substring(0, 50) || 'New Conversation',
          provider,
          messages: updatedMessages,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        onUpdateConversation(newConversation);
      }

      // Update token count
      const outputTokens = TokenCounter.estimate(streamingMessage, provider);
      setTokenCount(prev => ({ input: prev.input, output: outputTokens }));
    }

    setIsLoading(false);
    setIsStreaming(false);
    setActiveRequestId(null);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    finalizeStreamingMessage();
  };

  const handleRetry = async () => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        setInput(lastUserMessage.content);
        // Remove last exchange
        const newMessages = messages.slice(0, -2);
        setMessages(newMessages);
      }
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    // Show toast notification
    showToast('Copied to clipboard');
  };

  const handleExport = () => {
    const exportData = {
      conversation: conversation || { messages },
      provider,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setMessages([]);
    setInput('');
    setError(null);
    onNewConversation();
  };

  const getPageContext = async (): Promise<any> => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CONTEXT' });
      return response;
    } catch (err) {
      console.error('Failed to get page context:', err);
      return null;
    }
  };

  const getDefaultModel = (provider: AIProvider): string => {
    const models = {
      claude: 'claude-3-sonnet-20240229',
      chatgpt: 'gpt-4-turbo-preview',
      gemini: 'gemini-pro',
      grok: 'grok-beta',
    };
    return models[provider];
  };

  const showToast = (message: string) => {
    // You can implement a toast notification system here
    console.log(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
            <p className="text-sm">
              Ask {provider} anything or select text on the page to get started
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            onCopy={handleCopy}
            provider={provider}
          />
        ))}

        {isStreaming && streamingMessage && (
          <MessageBubble
            message={{
              role: 'assistant',
              content: streamingMessage,
              timestamp: Date.now(),
              provider,
            }}
            isStreaming
            onCopy={handleCopy}
            provider={provider}
          />
        )}

        {isLoading && !streamingMessage && (
          <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        {/* Token and Cost Info */}
        {(tokenCount.input > 0 || tokenCount.output > 0) && (
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <div className="flex items-center space-x-3">
              <span>Tokens: {tokenCount.input + tokenCount.output}</span>
              {estimatedCost > 0 && (
                <span>Est. cost: {CostCalculator.format(estimatedCost)}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {messages.length > 0 && (
                <>
                  <button
                    onClick={handleExport}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Export conversation"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Clear conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Input Field */}
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${provider}...`}
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            rows={2}
            disabled={isLoading}
          />
          <div className="flex flex-col space-y-2">
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                title="Stop generation"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
            {messages.length > 0 && !isLoading && (
              <button
                onClick={handleRetry}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Retry last message"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Message Bubble Component
interface MessageBubbleProps {
  message: AIMessage;
  isStreaming?: boolean;
  onCopy: (content: string) => void;
  provider: AIProvider;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  onCopy,
  provider,
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
        }`}
      >
        {!isUser && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium opacity-70">
              {message.provider || provider}
            </span>
            <div className="flex items-center space-x-1">
              {!isStreaming && (
                <button
                  onClick={() => onCopy(message.content)}
                  className="p-1 hover:bg-white/10 rounded"
                  title="Copy"
                >
                  <Copy className="w-3 h-3" />
                </button>
              )}
              {isStreaming && (
                <Loader className="w-3 h-3 animate-spin" />
              )}
            </div>
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {message.timestamp && (
          <div className="text-xs opacity-70 mt-2">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};