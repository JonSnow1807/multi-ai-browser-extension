/**
 * Custom prompt dialog for content script
 */

export function setupCustomPromptDialog(): void {
  let dialogContainer: HTMLElement | null = null;

  // Create dialog container
  function createDialog(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'mai-custom-prompt-dialog';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      backdrop-filter: blur(4px);
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    dialog.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600; color: #111827;">
          Custom Prompt
        </h2>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          Enter your custom prompt for the selected text
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151;">
          AI Provider
        </label>
        <select id="mai-provider-select" style="
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          color: #111827;
        ">
          <option value="claude">Claude</option>
          <option value="chatgpt">ChatGPT</option>
          <option value="gemini">Gemini</option>
          <option value="grok">Grok</option>
          <option value="auto">Auto-select</option>
        </select>
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #374151;">
          Your Prompt
        </label>
        <textarea id="mai-prompt-input" style="
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          color: #111827;
        " placeholder="E.g., Explain this concept in simple terms..."></textarea>
      </div>

      <div id="mai-context-preview" style="
        margin-bottom: 16px;
        padding: 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        display: none;
      ">
        <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">
          Context:
        </div>
        <div id="mai-context-text" style="
          font-size: 13px;
          color: #374151;
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        "></div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px;">
          <button id="mai-template-btn" style="
            padding: 8px 16px;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            color: #374151;
            transition: all 0.2s;
          ">
            📚 Templates
          </button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="mai-cancel-btn" style="
            padding: 8px 16px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            color: #6b7280;
            transition: all 0.2s;
          ">
            Cancel
          </button>
          <button id="mai-send-btn" style="
            padding: 8px 24px;
            background: #3b82f6;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            color: white;
            transition: all 0.2s;
          ">
            Send to AI
          </button>
        </div>
      </div>
    `;

    container.appendChild(dialog);
    return container;
  }

  // Show dialog
  function showDialog(context?: any): void {
    if (!dialogContainer) {
      dialogContainer = createDialog();
      document.body.appendChild(dialogContainer);
      setupEventHandlers();
    }

    dialogContainer.style.display = 'flex';

    // Show context if available
    if (context?.selection) {
      const contextPreview = document.getElementById('mai-context-preview');
      const contextText = document.getElementById('mai-context-text');
      if (contextPreview && contextText) {
        contextPreview.style.display = 'block';
        contextText.textContent = context.selection.substring(0, 200) +
          (context.selection.length > 200 ? '...' : '');
      }
    }

    // Focus on input
    setTimeout(() => {
      const input = document.getElementById('mai-prompt-input') as HTMLTextAreaElement;
      input?.focus();
    }, 100);
  }

  // Hide dialog
  function hideDialog(): void {
    if (dialogContainer) {
      dialogContainer.style.display = 'none';
      // Clear inputs
      const input = document.getElementById('mai-prompt-input') as HTMLTextAreaElement;
      if (input) input.value = '';
    }
  }

  // Setup event handlers
  function setupEventHandlers(): void {
    // Cancel button
    document.getElementById('mai-cancel-btn')?.addEventListener('click', hideDialog);

    // Click outside to close
    dialogContainer?.addEventListener('click', (e) => {
      if (e.target === dialogContainer) {
        hideDialog();
      }
    });

    // Send button
    document.getElementById('mai-send-btn')?.addEventListener('click', () => {
      const promptInput = document.getElementById('mai-prompt-input') as HTMLTextAreaElement;
      const providerSelect = document.getElementById('mai-provider-select') as HTMLSelectElement;

      const prompt = promptInput?.value.trim();
      const provider = providerSelect?.value;

      if (prompt) {
        sendPrompt(prompt, provider);
        hideDialog();
      }
    });

    // Template button
    document.getElementById('mai-template-btn')?.addEventListener('click', () => {
      showTemplates();
    });

    // Enter to send (Ctrl/Cmd + Enter)
    document.getElementById('mai-prompt-input')?.addEventListener('keydown', (e) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' && (keyEvent.ctrlKey || keyEvent.metaKey)) {
        keyEvent.preventDefault();
        document.getElementById('mai-send-btn')?.click();
      }
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialogContainer?.style.display === 'flex') {
        hideDialog();
      }
    });
  }

  // Send prompt to AI
  function sendPrompt(prompt: string, provider: string): void {
    const context = {
      selection: window.getSelection()?.toString() || '',
      url: window.location.href,
      title: document.title,
    };

    // Open sidebar first
    const openEvent = new CustomEvent('mai-open-sidebar');
    document.dispatchEvent(openEvent);

    // Send prompt after a short delay
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'SEND_TO_AI',
        payload: {
          provider: provider === 'auto' ? undefined : provider,
          message: prompt,
          context,
        },
      });
    }, 300);
  }

  // Show template selector
  function showTemplates(): void {
    const templates = [
      { label: 'Explain', prompt: 'Please explain this in simple terms:' },
      { label: 'Summarize', prompt: 'Provide a concise summary of:' },
      { label: 'Translate', prompt: 'Translate this to English:' },
      { label: 'Improve', prompt: 'Improve this text for clarity and style:' },
      { label: 'Find Issues', prompt: 'Identify any issues or errors in:' },
      { label: 'Generate Ideas', prompt: 'Generate creative ideas based on:' },
      { label: 'Create Examples', prompt: 'Provide practical examples for:' },
      { label: 'Compare', prompt: 'Compare and contrast with alternatives:' },
    ];

    const menu = document.createElement('div');
    menu.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      padding: 8px;
      z-index: 2147483648;
      min-width: 200px;
    `;

    templates.forEach(template => {
      const item = document.createElement('button');
      item.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 12px;
        text-align: left;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
        border-radius: 4px;
        transition: background 0.2s;
      `;
      item.textContent = template.label;
      item.onmouseover = () => { item.style.background = '#f3f4f6'; };
      item.onmouseout = () => { item.style.background = 'none'; };
      item.onclick = () => {
        const input = document.getElementById('mai-prompt-input') as HTMLTextAreaElement;
        if (input) {
          input.value = template.prompt + ' ';
          input.focus();
        }
        menu.remove();
      };
      menu.appendChild(item);
    });

    const templateBtn = document.getElementById('mai-template-btn');
    if (templateBtn) {
      const rect = templateBtn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 5}px`;
      menu.style.left = `${rect.left}px`;
      document.body.appendChild(menu);

      // Remove menu when clicking outside
      setTimeout(() => {
        document.addEventListener('click', () => menu.remove(), { once: true });
      }, 10);
    }
  }

  // Listen for open events
  document.addEventListener('mai-open-custom-prompt', (event: CustomEvent) => {
    showDialog(event.detail?.context);
  });
}