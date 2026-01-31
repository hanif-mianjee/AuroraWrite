import type { TransformationType } from '../../shared/types/messages';

export interface TransformCallbacks {
  onTransform: (type: TransformationType, customPrompt?: string) => void;
  onAccept: (transformedText: string) => void;
  onCancel: () => void;
}

type TabType = Exclude<TransformationType, 'custom' | 'translate'>;

const TABS: { type: TabType; label: string }[] = [
  { type: 'improve', label: 'Improve' },
  { type: 'rephrase', label: 'Rephrase' },
  { type: 'shorten', label: 'Shorten' },
  { type: 'friendly', label: 'Friendly' },
  { type: 'formal', label: 'Formal' },
];

export class TransformPopover {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private callbacks: TransformCallbacks | null = null;
  private currentTab: TabType = 'improve';
  private originalText = '';
  private transformedText = '';
  private isLoading = false;
  private lastCustomPrompt = '';

  setCallbacks(callbacks: TransformCallbacks): void {
    this.callbacks = callbacks;
  }

  show(originalText: string, rects: DOMRect[]): void {
    this.hide();
    this.originalText = originalText;
    this.transformedText = '';
    this.currentTab = 'improve';
    this.isLoading = false;
    this.lastCustomPrompt = '';

    if (rects.length === 0) return;

    const lastRect = rects[rects.length - 1];

    this.container = document.createElement('div');
    this.container.className = 'aurora-transform-popover';
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    const content = document.createElement('div');
    content.className = 'popover';
    content.innerHTML = this.getPopoverHTML();
    this.shadowRoot.appendChild(content);

    this.setupEvents(content);
    document.body.appendChild(this.container);

    // Position after adding to DOM so we can measure
    this.positionPopover(lastRect);

    // Trigger initial transformation
    this.requestTransform(this.currentTab);

    // Setup escape key handler
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.callbacks?.onCancel();
    }
  };

  private positionPopover(rect: DOMRect): void {
    if (!this.container || !this.shadowRoot) return;

    const popover = this.shadowRoot.querySelector('.popover') as HTMLElement;
    if (!popover) return;

    const popoverWidth = 380;
    const popoverHeight = popover.offsetHeight || 350;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const padding = 16;

    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 8;

    // Adjust if would go off right edge
    if (left + popoverWidth > viewportWidth + scrollX - padding) {
      left = viewportWidth + scrollX - popoverWidth - padding;
    }

    // Adjust if would go off left edge
    if (left < scrollX + padding) {
      left = scrollX + padding;
    }

    // Adjust if would go off bottom edge - show above selection instead
    if (rect.bottom + popoverHeight + padding > viewportHeight) {
      top = rect.top + scrollY - popoverHeight - 8;
      // If still off top, just position at top of viewport
      if (top < scrollY + padding) {
        top = scrollY + padding;
      }
    }

    this.container.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      z-index: 2147483647;
    `;
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .popover {
        width: 380px;
        max-width: calc(100vw - 32px);
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
        border: 1px solid rgba(0,0,0,0.08);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      }
      .popover-header {
        background: linear-gradient(135deg, #7c3aed, #8b5cf6);
        color: white;
        padding: 12px 16px;
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .popover-header svg {
        flex-shrink: 0;
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 12px;
        border-bottom: 1px solid #f3f4f6;
      }
      .tab {
        padding: 6px 12px;
        background: #f3f4f6;
        border: none;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        color: #4b5563;
        cursor: pointer;
        transition: all 0.15s;
      }
      .tab:hover {
        background: #e5e7eb;
      }
      .tab.active {
        background: linear-gradient(135deg, #7c3aed, #8b5cf6);
        color: white;
      }
      .preview-area {
        padding: 12px 16px;
        min-height: 100px;
        max-height: 200px;
        overflow-y: auto;
        border-bottom: 1px solid #f3f4f6;
      }
      .diff-container {
        font-size: 13px;
        line-height: 1.6;
      }
      .diff-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
        color: #6b7280;
      }
      .diff-original {
        background: #fef2f2;
        border-left: 3px solid #ef4444;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 0 6px 6px 0;
        color: #991b1b;
      }
      .diff-transformed {
        background: #f0fdf4;
        border-left: 3px solid #22c55e;
        padding: 8px 12px;
        border-radius: 0 6px 6px 0;
        color: #166534;
      }
      .diff-text {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .word-removed {
        background: #fecaca;
        text-decoration: line-through;
        padding: 1px 2px;
        border-radius: 2px;
      }
      .word-added {
        background: #bbf7d0;
        padding: 1px 2px;
        border-radius: 2px;
      }
      .preview-placeholder {
        color: #9ca3af;
        font-style: italic;
        font-size: 13px;
      }
      .loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #6b7280;
        font-size: 13px;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #7c3aed;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .error-message {
        color: #dc2626;
        font-size: 13px;
      }
      .custom-prompt {
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
        display: flex;
        gap: 8px;
      }
      .custom-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
      }
      .custom-input:focus {
        border-color: #7c3aed;
      }
      .custom-input::placeholder {
        color: #9ca3af;
      }
      .btn-send {
        padding: 8px 12px;
        background: linear-gradient(135deg, #7c3aed, #8b5cf6);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
        white-space: nowrap;
      }
      .btn-send:hover {
        opacity: 0.9;
      }
      .btn-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
      }
      .btn {
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
        border: none;
      }
      .btn-cancel {
        background: #f3f4f6;
        color: #4b5563;
      }
      .btn-cancel:hover {
        background: #e5e7eb;
      }
      .btn-accept {
        background: linear-gradient(135deg, #7c3aed, #8b5cf6);
        color: white;
      }
      .btn-accept:hover {
        opacity: 0.9;
      }
      .btn-accept:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
  }

  private getPopoverHTML(): string {
    const tabsHTML = TABS.map(
      (tab) => `<button class="tab${tab.type === this.currentTab ? ' active' : ''}" data-tab="${tab.type}">${tab.label}</button>`
    ).join('');

    return `
      <div class="popover-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        Transform Text
      </div>
      <div class="tabs">${tabsHTML}</div>
      <div class="preview-area">
        <div class="preview-content">
          <div class="loading">
            <div class="spinner"></div>
            <span>Transforming...</span>
          </div>
        </div>
      </div>
      <div class="custom-prompt">
        <input type="text" class="custom-input" placeholder="Ask for a change..." />
        <button class="btn-send">Send</button>
      </div>
      <div class="actions">
        <button class="btn btn-cancel">Cancel</button>
        <button class="btn btn-accept" disabled>Accept</button>
      </div>
    `;
  }

  private setupEvents(content: HTMLElement): void {
    // Tab clicks
    content.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const tabType = (e.target as HTMLElement).dataset.tab as TabType;
        if (tabType && tabType !== this.currentTab) {
          this.currentTab = tabType;
          this.updateTabStyles(content);
          this.requestTransform(tabType);
        }
      });
    });

    // Custom prompt input and button
    const customInput = content.querySelector('.custom-input') as HTMLInputElement;
    const sendBtn = content.querySelector('.btn-send') as HTMLButtonElement;

    const handleCustomPrompt = () => {
      const prompt = customInput.value.trim();
      if (prompt) {
        this.lastCustomPrompt = prompt;
        // Clear all active tabs since this is a custom request
        content.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.requestTransform('custom', prompt);
        // Don't clear the input - keep it visible so user knows what they asked for
      }
    };

    if (customInput) {
      customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCustomPrompt();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        handleCustomPrompt();
      });
    }

    // Cancel button
    const cancelBtn = content.querySelector('.btn-cancel');
    cancelBtn?.addEventListener('click', () => {
      this.callbacks?.onCancel();
    });

    // Accept button
    const acceptBtn = content.querySelector('.btn-accept');
    acceptBtn?.addEventListener('click', () => {
      if (this.transformedText) {
        this.callbacks?.onAccept(this.transformedText);
      }
    });

    // Prevent clicks from propagating
    content.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  }

  private updateTabStyles(content: HTMLElement): void {
    content.querySelectorAll('.tab').forEach((tab) => {
      const tabType = (tab as HTMLElement).dataset.tab;
      tab.classList.toggle('active', tabType === this.currentTab);
    });
  }

  private requestTransform(type: TransformationType, customPrompt?: string): void {
    this.isLoading = true;
    this.transformedText = '';
    this.updatePreview();
    this.callbacks?.onTransform(type, customPrompt);
  }

  updateWithResult(transformedText: string): void {
    this.isLoading = false;
    this.transformedText = transformedText;
    this.updatePreview();
  }

  updateWithError(error: string): void {
    this.isLoading = false;
    this.transformedText = '';
    if (!this.shadowRoot) return;

    const previewContent = this.shadowRoot.querySelector('.preview-content');
    if (previewContent) {
      previewContent.innerHTML = `<div class="error-message">${this.escapeHtml(error)}</div>`;
    }

    const acceptBtn = this.shadowRoot.querySelector('.btn-accept') as HTMLButtonElement;
    if (acceptBtn) {
      acceptBtn.disabled = true;
    }
  }

  private updatePreview(): void {
    if (!this.shadowRoot) return;

    const previewContent = this.shadowRoot.querySelector('.preview-content');
    if (!previewContent) return;

    if (this.isLoading) {
      previewContent.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <span>Transforming...</span>
        </div>
      `;
    } else if (this.transformedText) {
      // Show word-by-word diff
      previewContent.innerHTML = this.renderDiff();
    } else {
      previewContent.innerHTML = `<div class="preview-placeholder">Select a transformation type</div>`;
    }

    const acceptBtn = this.shadowRoot.querySelector('.btn-accept') as HTMLButtonElement;
    if (acceptBtn) {
      acceptBtn.disabled = !this.transformedText || this.isLoading;
    }
  }

  private renderDiff(): string {
    const originalWords = this.originalText.split(/(\s+)/);
    const transformedWords = this.transformedText.split(/(\s+)/);

    // Simple word-by-word diff
    const { originalHtml, transformedHtml } = this.computeWordDiff(originalWords, transformedWords);

    return `
      <div class="diff-container">
        <div class="diff-original">
          <div class="diff-label">Original</div>
          <div class="diff-text">${originalHtml}</div>
        </div>
        <div class="diff-transformed">
          <div class="diff-label">Suggested</div>
          <div class="diff-text">${transformedHtml}</div>
        </div>
      </div>
    `;
  }

  private computeWordDiff(original: string[], transformed: string[]): { originalHtml: string; transformedHtml: string } {
    // Create a simple LCS-based diff
    const originalSet = new Set(original.map(w => w.toLowerCase().trim()).filter(w => w));
    const transformedSet = new Set(transformed.map(w => w.toLowerCase().trim()).filter(w => w));

    let originalHtml = '';
    let transformedHtml = '';

    // Mark words in original that don't appear in transformed
    for (const word of original) {
      const trimmed = word.toLowerCase().trim();
      if (!trimmed) {
        originalHtml += this.escapeHtml(word);
      } else if (!transformedSet.has(trimmed)) {
        originalHtml += `<span class="word-removed">${this.escapeHtml(word)}</span>`;
      } else {
        originalHtml += this.escapeHtml(word);
      }
    }

    // Mark words in transformed that don't appear in original
    for (const word of transformed) {
      const trimmed = word.toLowerCase().trim();
      if (!trimmed) {
        transformedHtml += this.escapeHtml(word);
      } else if (!originalSet.has(trimmed)) {
        transformedHtml += `<span class="word-added">${this.escapeHtml(word)}</span>`;
      } else {
        transformedHtml += this.escapeHtml(word);
      }
    }

    return { originalHtml, transformedHtml };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  hide(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
    this.transformedText = '';
    this.isLoading = false;
  }

  isVisible(): boolean {
    return this.container !== null;
  }

  destroy(): void {
    this.hide();
  }
}
