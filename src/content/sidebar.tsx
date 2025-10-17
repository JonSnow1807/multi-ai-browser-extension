import React from 'react';
import ReactDOM from 'react-dom/client';
import { Sidebar } from '@/components/Sidebar';

let sidebarRoot: ReactDOM.Root | null = null;
let sidebarContainer: HTMLElement | null = null;

export function injectSidebar() {
  // Check if sidebar already exists
  if (document.getElementById('multi-ai-sidebar-container')) {
    return;
  }

  // Create container with shadow DOM for style isolation
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'multi-ai-sidebar-container';
  sidebarContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 0;
    height: 100vh;
    z-index: 2147483646;
    transition: width 0.3s ease-in-out;
  `;

  // Create shadow root
  const shadowRoot = sidebarContainer.attachShadow({ mode: 'open' });

  // Create styles for shadow DOM
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    :host {
      all: initial;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    #sidebar-root {
      width: 100%;
      height: 100%;
      position: relative;
    }

    .sidebar-open {
      width: 420px !important;
    }

    /* Import Tailwind styles */
    @import url('${chrome.runtime.getURL('styles/sidebar.css')}');
  `;

  shadowRoot.appendChild(styleSheet);

  // Create root element for React
  const rootDiv = document.createElement('div');
  rootDiv.id = 'sidebar-root';
  shadowRoot.appendChild(rootDiv);

  // Append container to body
  document.body.appendChild(sidebarContainer);

  // Initialize React root
  sidebarRoot = ReactDOM.createRoot(rootDiv);
  sidebarRoot.render(
    <React.StrictMode>
      <Sidebar />
    </React.StrictMode>
  );
}

export function toggleSidebar() {
  if (!sidebarContainer) {
    injectSidebar();
  }

  const isOpen = sidebarContainer!.style.width === '420px';

  if (isOpen) {
    sidebarContainer!.style.width = '0';
    sidebarContainer!.classList.remove('sidebar-open');

    // Dispatch close event
    const event = new CustomEvent('mai-sidebar-toggle', { detail: { open: false } });
    document.dispatchEvent(event);
  } else {
    sidebarContainer!.style.width = '420px';
    sidebarContainer!.classList.add('sidebar-open');

    // Dispatch open event
    const event = new CustomEvent('mai-sidebar-toggle', { detail: { open: true } });
    document.dispatchEvent(event);
  }
}

export function openSidebarWithRequest(payload: any) {
  if (!sidebarContainer || sidebarContainer.style.width === '0') {
    toggleSidebar();
  }

  // Dispatch event with request
  setTimeout(() => {
    const event = new CustomEvent('mai-sidebar-request', { detail: payload });
    document.dispatchEvent(event);
  }, 300);
}

export function closeSidebar() {
  if (sidebarContainer && sidebarContainer.style.width === '420px') {
    toggleSidebar();
  }
}