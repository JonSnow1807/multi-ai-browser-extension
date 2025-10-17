import { ExtensionMessage, PageContext } from '@/types/extension';
import { injectSidebar, toggleSidebar, openSidebarWithRequest } from './sidebar';
import { setupCommandPalette } from './commandPalette';
import { setupHighlighter } from './highlighter';
import { setupCustomPromptDialog } from './customPrompt';

// Initialize content script
(function initContentScript() {
  // Check if content script is already injected
  if (window.__multiAIExtensionInjected) {
    return;
  }
  window.__multiAIExtensionInjected = true;

  // Initialize components
  injectSidebar();
  setupCommandPalette();
  setupHighlighter();
  setupCustomPromptDialog();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(handleMessage);

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Setup page context extraction
  setupContextExtraction();
})();

// Message handler
function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): boolean {
  switch (message.type) {
    case 'TOGGLE_SIDEBAR':
      toggleSidebar();
      break;

    case 'OPEN_COMMAND_PALETTE':
      openCommandPalette();
      break;

    case 'QUICK_ASK':
      handleQuickAsk();
      break;

    case 'GET_PAGE_CONTEXT':
      sendResponse(extractPageContext());
      break;

    case 'OPEN_SIDEBAR_WITH_REQUEST':
      openSidebarWithRequest(message.payload);
      break;

    case 'OPEN_COMPARISON_MODE':
      openComparisonMode(message.payload);
      break;

    case 'OPEN_CUSTOM_PROMPT':
      openCustomPromptDialog(message.payload);
      break;

    case 'STREAM_CHUNK':
      handleStreamChunk(message.payload);
      break;

    case 'STREAM_END':
      handleStreamEnd(message.payload);
      break;

    default:
      console.log('Unknown message type:', message.type);
  }

  return true;
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + Shift + A: Toggle sidebar
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      toggleSidebar();
    }

    // Cmd/Ctrl + Shift + K: Open command palette
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      openCommandPalette();
    }

    // Cmd/Ctrl + Shift + Space: Quick ask
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === ' ') {
      e.preventDefault();
      handleQuickAsk();
    }

    // Escape: Close sidebar/palette if open
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('multi-ai-sidebar');
      const palette = document.getElementById('multi-ai-command-palette');

      if (palette && palette.style.display !== 'none') {
        closeCommandPalette();
      } else if (sidebar && sidebar.classList.contains('mai-sidebar-open')) {
        toggleSidebar();
      }
    }
  });
}

// Extract page context
function extractPageContext(): PageContext {
  const selection = window.getSelection()?.toString() || '';

  // Extract visible text
  const visibleText = extractVisibleText();

  // Get page metadata
  const metadata = {
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
    author: document.querySelector('meta[name="author"]')?.getAttribute('content') || '',
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
  };

  return {
    url: window.location.href,
    title: document.title,
    selection,
    visibleText: visibleText.substring(0, 10000), // Limit to 10k chars
    fullHtml: '', // Only extract if specifically requested
    metadata,
  };
}

// Extract visible text from page
function extractVisibleText(): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip script, style, and other non-content tags
        const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED'];
        if (skipTags.includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const textNodes: string[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text) {
      textNodes.push(text);
    }
  }

  return textNodes.join(' ');
}

// Setup context extraction for background script
function setupContextExtraction() {
  // Monitor text selection
  document.addEventListener('mouseup', () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 0) {
      // Store selection for quick access
      sessionStorage.setItem('mai-last-selection', selection);
    }
  });

  // Monitor page changes
  const observer = new MutationObserver(() => {
    // Notify background script of significant page changes
    if (document.readyState === 'complete') {
      chrome.runtime.sendMessage({
        type: 'PAGE_CONTEXT_CHANGED',
        payload: {
          url: window.location.href,
          title: document.title,
        },
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Handle quick ask
function handleQuickAsk() {
  const selection = window.getSelection()?.toString() || sessionStorage.getItem('mai-last-selection') || '';

  if (!selection) {
    // Show notification that no text is selected
    showNotification('Please select some text first');
    return;
  }

  openSidebarWithRequest({
    message: `Please help me with: "${selection}"`,
    context: extractPageContext(),
  });
}

// Open command palette
function openCommandPalette() {
  const paletteEvent = new CustomEvent('mai-open-command-palette');
  document.dispatchEvent(paletteEvent);
}

// Close command palette
function closeCommandPalette() {
  const paletteEvent = new CustomEvent('mai-close-command-palette');
  document.dispatchEvent(paletteEvent);
}

// Open comparison mode
function openComparisonMode(payload: any) {
  const event = new CustomEvent('mai-open-comparison-mode', { detail: payload });
  document.dispatchEvent(event);
}

// Open custom prompt dialog
function openCustomPromptDialog(payload: any) {
  const event = new CustomEvent('mai-open-custom-prompt', { detail: payload });
  document.dispatchEvent(event);
}

// Handle stream chunk from background
function handleStreamChunk(payload: any) {
  const event = new CustomEvent('mai-stream-chunk', { detail: payload });
  document.dispatchEvent(event);
}

// Handle stream end from background
function handleStreamEnd(payload: any) {
  const event = new CustomEvent('mai-stream-end', { detail: payload });
  document.dispatchEvent(event);
}

// Show notification
function showNotification(message: string) {
  const notification = document.createElement('div');
  notification.className = 'mai-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: mai-slide-in 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'mai-slide-out 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes mai-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes mai-slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Declare global to prevent re-injection
declare global {
  interface Window {
    __multiAIExtensionInjected: boolean;
  }
}