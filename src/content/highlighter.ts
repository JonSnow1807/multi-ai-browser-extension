/**
 * Text highlighter and selection manager for content script
 */

interface SelectionInfo {
  text: string;
  range: Range;
  rect: DOMRect;
}

class TextHighlighter {
  private currentSelection: SelectionInfo | null = null;
  private highlightOverlay: HTMLElement | null = null;
  private actionButtons: HTMLElement | null = null;

  constructor() {
    this.setupEventListeners();
    this.createHighlightOverlay();
  }

  private setupEventListeners(): void {
    // Listen for text selection
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));

    // Listen for keyboard shortcuts on selected text
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleMouseUp(event: MouseEvent): void {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        this.handleTextSelection(selection);
      }
    }, 10);
  }

  private handleMouseDown(event: MouseEvent): void {
    // Hide action buttons if clicking elsewhere
    if (this.actionButtons && !this.actionButtons.contains(event.target as Node)) {
      this.hideActionButtons();
    }
  }

  private handleSelectionChange(): void {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      this.clearHighlight();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.currentSelection) {
      // Ctrl/Cmd + Shift + A: Ask AI about selection
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'a') {
        event.preventDefault();
        this.askAIAboutSelection();
      }

      // Escape: Clear selection
      if (event.key === 'Escape') {
        this.clearHighlight();
        window.getSelection()?.removeAllRanges();
      }
    }
  }

  private handleTextSelection(selection: Selection): void {
    const text = selection.toString().trim();
    if (text.length < 3 || text.length > 5000) {
      return; // Ignore very short or very long selections
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    this.currentSelection = {
      text,
      range,
      rect,
    };

    this.showActionButtons(rect);
  }

  private createHighlightOverlay(): void {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'mai-highlight-overlay';
    this.highlightOverlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      background: rgba(59, 130, 246, 0.2);
      border: 2px solid rgba(59, 130, 246, 0.5);
      border-radius: 4px;
      z-index: 2147483645;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
  }

  private showActionButtons(rect: DOMRect): void {
    if (!this.actionButtons) {
      this.createActionButtons();
    }

    if (this.actionButtons) {
      // Position buttons above or below selection
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceAbove > 60) {
        // Show above selection
        this.actionButtons.style.top = `${top - 50}px`;
      } else if (spaceBelow > 60) {
        // Show below selection
        this.actionButtons.style.top = `${top + rect.height + 10}px`;
      } else {
        // Show at the side
        this.actionButtons.style.top = `${top}px`;
        this.actionButtons.style.left = `${left + rect.width + 10}px`;
      }

      this.actionButtons.style.left = `${left}px`;
      this.actionButtons.style.display = 'flex';

      // Fade in animation
      this.actionButtons.style.opacity = '0';
      setTimeout(() => {
        if (this.actionButtons) {
          this.actionButtons.style.opacity = '1';
        }
      }, 10);
    }
  }

  private createActionButtons(): void {
    this.actionButtons = document.createElement('div');
    this.actionButtons.id = 'mai-action-buttons';
    this.actionButtons.style.cssText = `
      position: absolute;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 2147483646;
      transition: opacity 0.2s;
    `;

    const actions = [
      {
        icon: '💡',
        title: 'Explain',
        action: () => this.askAI('explain'),
      },
      {
        icon: '📝',
        title: 'Summarize',
        action: () => this.askAI('summarize'),
      },
      {
        icon: '🌐',
        title: 'Translate',
        action: () => this.askAI('translate'),
      },
      {
        icon: '🔍',
        title: 'Search',
        action: () => this.askAI('search'),
      },
      {
        icon: '💬',
        title: 'Ask AI',
        action: () => this.askAIAboutSelection(),
      },
    ];

    actions.forEach(({ icon, title, action }) => {
      const button = document.createElement('button');
      button.innerHTML = icon;
      button.title = title;
      button.style.cssText = `
        width: 32px;
        height: 32px;
        border: none;
        background: #f3f4f6;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.background = '#e5e7eb';
        button.style.transform = 'scale(1.1)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = '#f3f4f6';
        button.style.transform = 'scale(1)';
      });

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        action();
        this.hideActionButtons();
      });

      this.actionButtons.appendChild(button);
    });

    document.body.appendChild(this.actionButtons);
  }

  private hideActionButtons(): void {
    if (this.actionButtons) {
      this.actionButtons.style.display = 'none';
    }
  }

  private clearHighlight(): void {
    this.currentSelection = null;
    this.hideActionButtons();

    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }
  }

  private askAI(action: string): void {
    if (!this.currentSelection) return;

    const message = this.getPromptForAction(action, this.currentSelection.text);

    chrome.runtime.sendMessage({
      type: 'SEND_TO_AI',
      payload: {
        message,
        context: {
          selection: this.currentSelection.text,
          url: window.location.href,
          title: document.title,
        },
      },
    });

    // Open sidebar to show response
    this.openSidebar();
  }

  private askAIAboutSelection(): void {
    if (!this.currentSelection) return;

    chrome.runtime.sendMessage({
      type: 'OPEN_SIDEBAR_WITH_REQUEST',
      payload: {
        message: `Please help me with: "${this.currentSelection.text}"`,
        context: {
          selection: this.currentSelection.text,
          url: window.location.href,
          title: document.title,
        },
      },
    });

    this.openSidebar();
  }

  private getPromptForAction(action: string, text: string): string {
    const prompts: Record<string, string> = {
      explain: `Please explain the following text in simple terms:\n\n"${text}"`,
      summarize: `Please provide a concise summary of:\n\n"${text}"`,
      translate: `Please translate the following text to English (or to Spanish if it's already in English):\n\n"${text}"`,
      search: `Please provide more information about:\n\n"${text}"`,
    };

    return prompts[action] || `Please help me understand: "${text}"`;
  }

  private openSidebar(): void {
    const event = new CustomEvent('mai-open-sidebar');
    document.dispatchEvent(event);
  }

  // Public methods
  public getSelectedText(): string | null {
    return this.currentSelection?.text || null;
  }

  public clearSelection(): void {
    this.clearHighlight();
    window.getSelection()?.removeAllRanges();
  }
}

// Export setup function
export function setupHighlighter(): TextHighlighter {
  return new TextHighlighter();
}