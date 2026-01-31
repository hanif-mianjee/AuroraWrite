import type { TransformationType } from '../../shared/types/messages';

export interface TransformCallbacks {
  onTransform: (type: TransformationType, customPrompt?: string) => void;
  onAccept: (transformedText: string) => void;
  onCancel: () => void;
}

type TabType = Exclude<TransformationType, 'custom'>;

const TABS: { type: TabType; label: string }[] = [
  { type: 'improve', label: 'Improve' },
  { type: 'rephrase', label: 'Rephrase' },
  { type: 'translate', label: 'Translate' },
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

  setCallbacks(callbacks: TransformCallbacks): void {
    this.callbacks = callbacks;
  }

  show(originalText: string, rects: DOMRect[]): void {
    this.hide();
    this.originalText = originalText;
    this.transformedText = '';
    this.currentTab = 'improve';
    this.isLoading = false;

    if (rects.length === 0) return;

    const lastRect = rects[rects.length - 1];
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

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
    this.positionPopover(lastRect, scrollX, scrollY);

    document.body.appendChild(this.container);

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

  private positionPopover(rect: DOMRect, scrollX: number, scrollY: number): void {
    if (!this.container) return;

    const popoverWidth = 360;
    const popoverHeight = 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left + scrollX;
    let top = rect.bottom + scrollY + 8;

    // Adjust if would go off right edge
    if (left + popoverWidth > viewportWidth + scrollX - 20) {
      left = viewportWidth + scrollX - popoverWidth - 20;
    }

    // Adjust if would go off bottom edge
    if (rect.bottom + popoverHeight > viewportHeight) {
      top = rect.top + scrollY - popoverHeight - 8;
    }

    this.container.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${Math.max(scrollX + 10, left)}px;
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
        width: 360px;
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
        min-height: 80px;
        max-height: 150px;
        overflow-y: auto;
        border-bottom: 1px solid #f3f4f6;
      }
      .preview-text {
        font-size: 13px;
        line-height: 1.5;
        color: #374151;
        white-space: pre-wrap;
        word-break: break-word;
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
      }
      .custom-input {
        width: 100%;
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

    // Custom prompt input
    const customInput = content.querySelector('.custom-input') as HTMLInputElement;
    if (customInput) {
      customInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const prompt = customInput.value.trim();
          if (prompt) {
            this.requestTransform('custom', prompt);
            customInput.value = '';
          }
        }
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
      previewContent.innerHTML = `<div class="preview-text">${this.escapeHtml(this.transformedText)}</div>`;
    } else {
      previewContent.innerHTML = `<div class="preview-placeholder">Select a transformation type</div>`;
    }

    const acceptBtn = this.shadowRoot.querySelector('.btn-accept') as HTMLButtonElement;
    if (acceptBtn) {
      acceptBtn.disabled = !this.transformedText || this.isLoading;
    }
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
