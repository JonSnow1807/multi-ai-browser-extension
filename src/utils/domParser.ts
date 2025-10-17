/**
 * DOM parsing utilities for extracting and processing page content
 */

export class DOMParser {
  /**
   * Extract visible text from the page
   */
  static extractVisibleText(element: Element = document.body): string {
    const walker = document.createTreeWalker(
      element,
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
          const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'AUDIO', 'VIDEO'];
          if (skipTags.includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip elements with aria-hidden
          if (parent.getAttribute('aria-hidden') === 'true') {
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

  /**
   * Extract main content from the page using heuristics
   */
  static extractMainContent(): string {
    // Try to find main content areas
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '#main',
      '.content',
      '.main',
      '.post',
      '.article',
      '.entry-content',
      '.post-content',
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return this.extractVisibleText(element);
      }
    }

    // Fallback to body
    return this.extractVisibleText();
  }

  /**
   * Extract structured data from the page
   */
  static extractStructuredData(): Record<string, any> {
    const data: Record<string, any> = {};

    // Extract meta tags
    data.meta = this.extractMetaTags();

    // Extract headings
    data.headings = this.extractHeadings();

    // Extract links
    data.links = this.extractLinks();

    // Extract images
    data.images = this.extractImages();

    // Extract structured data (JSON-LD)
    data.jsonLd = this.extractJsonLd();

    // Extract OpenGraph data
    data.openGraph = this.extractOpenGraph();

    return data;
  }

  /**
   * Extract meta tags
   */
  static extractMetaTags(): Record<string, string> {
    const meta: Record<string, string> = {};
    const metaTags = document.querySelectorAll('meta');

    metaTags.forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });

    return meta;
  }

  /**
   * Extract headings hierarchy
   */
  static extractHeadings(): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headingElements.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      const text = heading.textContent?.trim();
      if (text) {
        headings.push({ level, text });
      }
    });

    return headings;
  }

  /**
   * Extract links
   */
  static extractLinks(limit: number = 50): Array<{ text: string; href: string }> {
    const links: Array<{ text: string; href: string }> = [];
    const linkElements = document.querySelectorAll('a[href]');

    linkElements.forEach((link, index) => {
      if (index >= limit) return;

      const text = link.textContent?.trim() || '';
      const href = (link as HTMLAnchorElement).href;

      if (text && href && !href.startsWith('javascript:')) {
        links.push({ text, href });
      }
    });

    return links;
  }

  /**
   * Extract images
   */
  static extractImages(limit: number = 20): Array<{ alt: string; src: string }> {
    const images: Array<{ alt: string; src: string }> = [];
    const imageElements = document.querySelectorAll('img[src]');

    imageElements.forEach((img, index) => {
      if (index >= limit) return;

      const alt = (img as HTMLImageElement).alt || '';
      const src = (img as HTMLImageElement).src;

      if (src && !src.startsWith('data:')) {
        images.push({ alt, src });
      }
    });

    return images;
  }

  /**
   * Extract JSON-LD structured data
   */
  static extractJsonLd(): any[] {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const data: any[] = [];

    scripts.forEach(script => {
      try {
        const json = JSON.parse(script.textContent || '');
        data.push(json);
      } catch (e) {
        // Ignore parsing errors
      }
    });

    return data;
  }

  /**
   * Extract OpenGraph data
   */
  static extractOpenGraph(): Record<string, string> {
    const og: Record<string, string> = {};
    const metaTags = document.querySelectorAll('meta[property^="og:"]');

    metaTags.forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (property && content) {
        const key = property.replace('og:', '');
        og[key] = content;
      }
    });

    return og;
  }

  /**
   * Clean HTML content
   */
  static cleanHTML(html: string): string {
    // Create a temporary element
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script and style elements
    const scripts = temp.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());

    // Get text content
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Extract tables as structured data
   */
  static extractTables(limit: number = 10): Array<{ headers: string[]; rows: string[][] }> {
    const tables: Array<{ headers: string[]; rows: string[][] }> = [];
    const tableElements = document.querySelectorAll('table');

    tableElements.forEach((table, index) => {
      if (index >= limit) return;

      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers
      const headerCells = table.querySelectorAll('thead th, thead td');
      headerCells.forEach(cell => {
        headers.push(cell.textContent?.trim() || '');
      });

      // If no thead, try first row
      if (headers.length === 0) {
        const firstRow = table.querySelector('tr');
        firstRow?.querySelectorAll('th, td').forEach(cell => {
          headers.push(cell.textContent?.trim() || '');
        });
      }

      // Extract rows
      const rowElements = table.querySelectorAll('tbody tr, tr');
      rowElements.forEach((row, rowIndex) => {
        if (rowIndex === 0 && headers.length > 0) return; // Skip header row

        const rowData: string[] = [];
        row.querySelectorAll('td, th').forEach(cell => {
          rowData.push(cell.textContent?.trim() || '');
        });

        if (rowData.length > 0) {
          rows.push(rowData);
        }
      });

      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows });
      }
    });

    return tables;
  }

  /**
   * Calculate reading time for text
   */
  static calculateReadingTime(text: string, wordsPerMinute: number = 200): number {
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  /**
   * Extract code blocks from the page
   */
  static extractCodeBlocks(): Array<{ language: string; code: string }> {
    const blocks: Array<{ language: string; code: string }> = [];

    // Try <pre><code> blocks
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
      const code = block.textContent || '';
      const language = block.className.match(/language-(\w+)/)?.[1] || 'unknown';
      if (code.trim()) {
        blocks.push({ language, code: code.trim() });
      }
    });

    // Try standalone <code> blocks
    const inlineCode = document.querySelectorAll('code:not(pre code)');
    inlineCode.forEach(block => {
      const code = block.textContent || '';
      if (code.trim() && code.length > 50) { // Only include substantial code blocks
        blocks.push({ language: 'unknown', code: code.trim() });
      }
    });

    return blocks;
  }

  /**
   * Detect page type based on content and structure
   */
  static detectPageType(): string {
    const url = window.location.href;
    const path = window.location.pathname;

    // Check for specific page types
    if (document.querySelector('article') || path.includes('/article/') || path.includes('/post/')) {
      return 'article';
    }

    if (path.includes('/product/') || document.querySelector('[itemtype*="Product"]')) {
      return 'product';
    }

    if (path === '/' || path === '/index' || path === '/home') {
      return 'homepage';
    }

    if (path.includes('/search') || url.includes('q=') || url.includes('query=')) {
      return 'search';
    }

    if (document.querySelector('video, .video-player')) {
      return 'video';
    }

    if (document.querySelector('.gallery, .images') || path.includes('/gallery')) {
      return 'gallery';
    }

    if (document.querySelector('form[action*="login"], form[action*="signin"]')) {
      return 'login';
    }

    return 'general';
  }

  /**
   * Check if page is likely paywalled
   */
  static isPaywalled(): boolean {
    const paywallIndicators = [
      'paywall',
      'subscribe',
      'subscription',
      'premium',
      'member-only',
      'locked-content',
      'blur',
    ];

    const bodyClasses = document.body.className.toLowerCase();
    const hasPaywallClass = paywallIndicators.some(indicator => bodyClasses.includes(indicator));

    const hasPaywallElement = paywallIndicators.some(indicator =>
      document.querySelector(`[class*="${indicator}"], [id*="${indicator}"]`) !== null
    );

    return hasPaywallClass || hasPaywallElement;
  }
}