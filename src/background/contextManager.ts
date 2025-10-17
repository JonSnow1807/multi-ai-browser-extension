import { PageContext } from '@/types/ai';
import { ContextMenuItem } from '@/types/extension';
import storageService from '@/services/storage';

export class ContextManager {
  private tabContexts: Map<number, PageContext> = new Map();

  /**
   * Get context for a specific tab
   */
  async getContext(tabId: number): Promise<PageContext | null> {
    // Check cache first
    let context = this.tabContexts.get(tabId);

    if (!context) {
      // Request context from content script
      context = await this.requestContextFromTab(tabId);
      if (context) {
        this.tabContexts.set(tabId, context);
      }
    }

    return context;
  }

  /**
   * Update stored context for a tab
   */
  updateTabContext(tabId: number, tab: chrome.tabs.Tab): void {
    const existingContext = this.tabContexts.get(tabId) || {};

    this.tabContexts.set(tabId, {
      ...existingContext,
      url: tab.url || '',
      title: tab.title || '',
    });
  }

  /**
   * Request context from content script
   */
  private async requestContextFromTab(tabId: number): Promise<PageContext | null> {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' });
      return response as PageContext;
    } catch (error) {
      console.error(`Failed to get context from tab ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Clear context for a tab
   */
  clearTabContext(tabId: number): void {
    this.tabContexts.delete(tabId);
  }

  /**
   * Clear all stored contexts
   */
  clearAllContexts(): void {
    this.tabContexts.clear();
  }

  /**
   * Extract context from selection
   */
  async extractSelectionContext(tabId: number): Promise<string | null> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection()?.toString() || '',
      });

      return result.result as string;
    } catch (error) {
      console.error(`Failed to extract selection from tab ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Extract visible text from page
   */
  async extractVisibleText(tabId: number): Promise<string | null> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                  return NodeFilter.FILTER_REJECT;
                }

                if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT') {
                  return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
              },
            }
          );

          const textNodes = [];
          let node;
          while ((node = walker.nextNode())) {
            const text = node.textContent?.trim();
            if (text) {
              textNodes.push(text);
            }
          }

          return textNodes.join(' ').substring(0, 10000); // Limit to 10k chars
        },
      });

      return result.result as string;
    } catch (error) {
      console.error(`Failed to extract visible text from tab ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Extract full HTML from page
   */
  async extractFullHTML(tabId: number): Promise<string | null> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.documentElement.outerHTML.substring(0, 50000), // Limit to 50k chars
      });

      return result.result as string;
    } catch (error) {
      console.error(`Failed to extract HTML from tab ${tabId}:`, error);
      return null;
    }
  }

  /**
   * Get context based on privacy settings
   */
  async getContextWithPrivacy(tabId: number): Promise<PageContext | null> {
    const settings = await storageService.getSettings();
    const tab = await chrome.tabs.get(tabId);

    // Check if domain is excluded
    const isExcluded = settings.privacy.excludedDomains.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(tab.url || '');
    });

    if (isExcluded || settings.privacy.sensitiveMode) {
      return {
        url: tab.url || '',
        title: tab.title || '',
        selection: '',
        visibleText: '',
        fullHtml: '',
        metadata: { excluded: true },
      };
    }

    const context: PageContext = {
      url: tab.url || '',
      title: tab.title || '',
    };

    // Get context based on sharing level
    switch (settings.privacy.contextSharing) {
      case 'none':
        break;
      case 'selection':
        context.selection = await this.extractSelectionContext(tabId) || '';
        break;
      case 'visible':
        context.selection = await this.extractSelectionContext(tabId) || '';
        context.visibleText = await this.extractVisibleText(tabId) || '';
        break;
      case 'full':
        context.selection = await this.extractSelectionContext(tabId) || '';
        context.visibleText = await this.extractVisibleText(tabId) || '';
        context.fullHtml = await this.extractFullHTML(tabId) || '';
        break;
    }

    return context;
  }
}

/**
 * Create context menus
 */
export function createContextMenus(): void {
  // Remove existing menus
  chrome.contextMenus.removeAll();

  const menuItems: ContextMenuItem[] = [
    {
      id: 'ai-menu',
      title: 'Ask AI',
      contexts: ['selection', 'page'],
    },
    {
      id: 'ask-claude',
      title: 'Ask Claude',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleAIMenuClick('claude', info, tab),
    },
    {
      id: 'ask-chatgpt',
      title: 'Ask ChatGPT',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleAIMenuClick('chatgpt', info, tab),
    },
    {
      id: 'ask-gemini',
      title: 'Ask Gemini',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleAIMenuClick('gemini', info, tab),
    },
    {
      id: 'ask-grok',
      title: 'Ask Grok',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleAIMenuClick('grok', info, tab),
    },
    {
      id: 'separator-1',
      title: '---',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: () => {},
    },
    {
      id: 'ask-all',
      title: 'Ask All AIs (Compare)',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleAskAll(info, tab),
    },
    {
      id: 'custom-prompt',
      title: 'Custom Prompt...',
      contexts: ['selection', 'page'],
      parentId: 'ai-menu',
      onclick: (info, tab) => handleCustomPrompt(info, tab),
    },
  ];

  // Create menu items
  menuItems.forEach(item => {
    chrome.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: item.contexts,
      parentId: item.parentId,
    });
  });
}

/**
 * Handle context menu clicks
 */
export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  const handlers: Record<string, Function> = {
    'ask-claude': () => handleAIMenuClick('claude', info, tab),
    'ask-chatgpt': () => handleAIMenuClick('chatgpt', info, tab),
    'ask-gemini': () => handleAIMenuClick('gemini', info, tab),
    'ask-grok': () => handleAIMenuClick('grok', info, tab),
    'ask-all': () => handleAskAll(info, tab),
    'custom-prompt': () => handleCustomPrompt(info, tab),
  };

  const handler = handlers[info.menuItemId as string];
  if (handler) {
    handler();
  }
}

/**
 * Handle AI menu click
 */
async function handleAIMenuClick(
  provider: string,
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id) return;

  const selection = info.selectionText || '';

  // Send message to content script to open sidebar with the request
  chrome.tabs.sendMessage(tab.id, {
    type: 'OPEN_SIDEBAR_WITH_REQUEST',
    payload: {
      provider,
      message: selection ? `Please help me with: "${selection}"` : 'Please help me with this page',
      context: {
        selection,
        url: tab.url,
        title: tab.title,
      },
    },
  });
}

/**
 * Handle "Ask All" menu click
 */
async function handleAskAll(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id) return;

  const selection = info.selectionText || '';

  // Send message to content script to open comparison mode
  chrome.tabs.sendMessage(tab.id, {
    type: 'OPEN_COMPARISON_MODE',
    payload: {
      message: selection ? `Please help me with: "${selection}"` : 'Please help me with this page',
      context: {
        selection,
        url: tab.url,
        title: tab.title,
      },
    },
  });
}

/**
 * Handle custom prompt menu click
 */
async function handleCustomPrompt(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id) return;

  const selection = info.selectionText || '';

  // Send message to content script to open prompt dialog
  chrome.tabs.sendMessage(tab.id, {
    type: 'OPEN_CUSTOM_PROMPT',
    payload: {
      context: {
        selection,
        url: tab.url,
        title: tab.title,
      },
    },
  });
}