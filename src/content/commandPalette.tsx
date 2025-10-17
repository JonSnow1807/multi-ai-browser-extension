import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Search, Command, ArrowRight, X } from 'lucide-react';
import { CommandPaletteItem } from '@/types/extension';

let commandPaletteRoot: ReactDOM.Root | null = null;
let commandPaletteContainer: HTMLElement | null = null;

const defaultCommands: CommandPaletteItem[] = [
  {
    id: 'summarize',
    label: 'Summarize this page',
    description: 'Create a concise summary of the current page',
    category: 'Actions',
    icon: '📝',
    action: () => {
      chrome.runtime.sendMessage({
        type: 'SEND_TO_AI',
        payload: {
          message: 'Please summarize this page',
          useContext: true,
        },
      });
    },
  },
  {
    id: 'explain',
    label: 'Explain selected text',
    description: 'Get a detailed explanation of the selected text',
    category: 'Actions',
    icon: '💡',
    action: () => {
      const selection = window.getSelection()?.toString();
      if (selection) {
        chrome.runtime.sendMessage({
          type: 'SEND_TO_AI',
          payload: {
            message: `Please explain: "${selection}"`,
          },
        });
      }
    },
  },
  {
    id: 'translate',
    label: 'Translate selection',
    description: 'Translate selected text to another language',
    category: 'Actions',
    icon: '🌐',
    action: () => {
      const selection = window.getSelection()?.toString();
      if (selection) {
        chrome.runtime.sendMessage({
          type: 'SEND_TO_AI',
          payload: {
            message: `Please translate to English: "${selection}"`,
          },
        });
      }
    },
  },
  {
    id: 'compare-ais',
    label: 'Compare all AIs',
    description: 'Send the same prompt to all AI providers',
    category: 'AI',
    icon: '🔀',
    action: () => {
      chrome.runtime.sendMessage({ type: 'OPEN_COMPARISON_MODE' });
    },
  },
  {
    id: 'settings',
    label: 'Open settings',
    description: 'Configure extension settings',
    category: 'Settings',
    icon: '⚙️',
    action: () => {
      chrome.runtime.openOptionsPage();
    },
    shortcut: 'Cmd+,',
  },
  {
    id: 'history',
    label: 'View conversation history',
    description: 'Browse past conversations',
    category: 'Navigation',
    icon: '📜',
    action: () => {
      const event = new CustomEvent('mai-open-history');
      document.dispatchEvent(event);
    },
  },
  {
    id: 'prompts',
    label: 'Browse prompt library',
    description: 'Explore saved prompts',
    category: 'Navigation',
    icon: '📚',
    action: () => {
      const event = new CustomEvent('mai-open-prompts');
      document.dispatchEvent(event);
    },
  },
];

export function setupCommandPalette() {
  // Create container
  commandPaletteContainer = document.createElement('div');
  commandPaletteContainer.id = 'multi-ai-command-palette';
  commandPaletteContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    display: none;
    pointer-events: none;
  `;

  document.body.appendChild(commandPaletteContainer);

  // Create React root
  commandPaletteRoot = ReactDOM.createRoot(commandPaletteContainer);
  commandPaletteRoot.render(
    <React.StrictMode>
      <CommandPalette />
    </React.StrictMode>
  );

  // Listen for open/close events
  document.addEventListener('mai-open-command-palette', () => {
    if (commandPaletteContainer) {
      commandPaletteContainer.style.display = 'block';
    }
  });

  document.addEventListener('mai-close-command-palette', () => {
    if (commandPaletteContainer) {
      commandPaletteContainer.style.display = 'none';
    }
  });
}

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands, setCommands] = useState<CommandPaletteItem[]>(defaultCommands);
  const [filteredCommands, setFilteredCommands] = useState<CommandPaletteItem[]>(defaultCommands);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleClose = () => {
      setIsOpen(false);
    };

    document.addEventListener('mai-open-command-palette', handleOpen);
    document.addEventListener('mai-close-command-palette', handleClose);

    // Load custom commands from storage
    loadCustomCommands();

    return () => {
      document.removeEventListener('mai-open-command-palette', handleOpen);
      document.removeEventListener('mai-close-command-palette', handleClose);
    };
  }, []);

  useEffect(() => {
    // Filter commands based on search
    if (!search) {
      setFilteredCommands(commands);
    } else {
      const filtered = commands.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(searchLower)) ||
          cmd.category?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredCommands(filtered);
    }
    setSelectedIndex(0);
  }, [search, commands]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands]);

  const loadCustomCommands = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CUSTOM_COMMANDS' });
      if (response && response.commands) {
        setCommands([...defaultCommands, ...response.commands]);
      }
    } catch (error) {
      console.error('Failed to load custom commands:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
    }
  };

  const executeCommand = async (command: CommandPaletteItem) => {
    try {
      await command.action();
      close();
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  };

  const close = () => {
    setIsOpen(false);
    const event = new CustomEvent('mai-close-command-palette');
    document.dispatchEvent(event);
  };

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, CommandPaletteItem[]>);

  let currentIndex = 0;

  return (
    <div
      className="command-palette-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        pointerEvents: 'auto',
        backdropFilter: 'blur(4px)',
      }}
      onClick={close}
    >
      <div
        className="command-palette"
        style={{
          width: '600px',
          maxHeight: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Search style={{ width: '20px', height: '20px', color: '#9ca3af' }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              backgroundColor: 'transparent',
            }}
          />
          <button
            onClick={close}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: '#9ca3af',
              }}
            >
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category}>
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                  }}
                >
                  {category}
                </div>
                {categoryCommands.map((cmd) => {
                  const isSelected = currentIndex === selectedIndex;
                  const index = currentIndex++;

                  return (
                    <div
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      style={{
                        padding: '12px',
                        margin: '2px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'background-color 0.1s',
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      {cmd.icon && (
                        <span style={{ fontSize: '20px' }}>{cmd.icon}</span>
                      )}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: '500',
                            color: '#111827',
                            marginBottom: '2px',
                          }}
                        >
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#6b7280',
                            }}
                          >
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd
                          style={{
                            padding: '2px 6px',
                            fontSize: '11px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '4px',
                            border: '1px solid #e5e7eb',
                            color: '#6b7280',
                          }}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <ArrowRight style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Command style={{ width: '12px', height: '12px' }} />
            <span>+K</span>
          </div>
          <div>to open</div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ marginRight: '8px' }}>↑↓ Navigate</span>
            <span style={{ marginRight: '8px' }}>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};