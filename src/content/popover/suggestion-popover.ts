import type { TextIssue } from '../../shared/types/analysis';
import { CATEGORY_CONFIG } from '../../shared/constants/categories';

export interface PopoverActions {
  onAccept: (issue: TextIssue) => void;
  onIgnore: (issue: TextIssue) => void;
  onIgnoreAll: (issue: TextIssue) => void;
}

export class SuggestionPopover {
  private popover: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private currentIssue: TextIssue | null = null;
  private actions: PopoverActions | null = null;

  setActions(actions: PopoverActions): void {
    this.actions = actions;
  }

  show(issue: TextIssue, anchorRect: DOMRect): void {
    this.hide();

    this.currentIssue = issue;

    this.popover = document.createElement('div');
    this.popover.className = 'aurora-popover-container';
    this.shadowRoot = this.popover.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    const content = document.createElement('div');
    content.className = 'aurora-popover';
    content.innerHTML = this.getPopoverHTML(issue);
    this.shadowRoot.appendChild(content);

    document.body.appendChild(this.popover);
    this.positionPopover(anchorRect);
    this.setupEvents(content);
  }

  private positionPopover(anchorRect: DOMRect): void {
    if (!this.popover) return;

    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;

    const popoverRect = this.popover.getBoundingClientRect();

    if (left + popoverRect.width > window.innerWidth) {
      left = window.innerWidth - popoverRect.width - 16;
    }

    if (top + popoverRect.height > window.innerHeight) {
      top = anchorRect.top - popoverRect.height - 8;
    }

    this.popover.style.cssText = `
      position: fixed;
      top: ${top}px;
      left: ${Math.max(8, left)}px;
      z-index: 2147483647;
      isolation: isolate;
    `;
  }

  private getStyles(): string {
    return `
      .aurora-popover {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        max-width: 320px;
        overflow: hidden;
        animation: aurora-popover-in 0.15s ease-out;
      }
      @keyframes aurora-popover-in {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .aurora-popover-header {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .aurora-category-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .aurora-category-label {
        font-weight: 600;
        color: #333;
      }
      .aurora-popover-body {
        padding: 16px;
      }
      .aurora-suggestion {
        margin-bottom: 12px;
      }
      .aurora-original {
        color: #666;
        text-decoration: line-through;
        margin-right: 8px;
      }
      .aurora-arrow {
        color: #999;
        margin-right: 8px;
      }
      .aurora-suggested {
        color: #2e7d32;
        font-weight: 500;
      }
      .aurora-explanation {
        color: #666;
        font-size: 13px;
        line-height: 1.4;
        margin-top: 8px;
      }
      .aurora-popover-actions {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #eee;
        background: #fafafa;
      }
      .aurora-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s ease;
      }
      .aurora-btn-primary {
        background: #2196f3;
        color: white;
      }
      .aurora-btn-primary:hover {
        background: #1976d2;
      }
      .aurora-btn-secondary {
        background: #e0e0e0;
        color: #333;
      }
      .aurora-btn-secondary:hover {
        background: #d0d0d0;
      }
      .aurora-btn-text {
        background: transparent;
        color: #666;
      }
      .aurora-btn-text:hover {
        background: #eee;
      }
    `;
  }

  private getPopoverHTML(issue: TextIssue): string {
    const config = CATEGORY_CONFIG[issue.category];

    return `
      <div class="aurora-popover-header">
        <span class="aurora-category-dot" style="background: ${config.color}"></span>
        <span class="aurora-category-label">${config.name}</span>
      </div>
      <div class="aurora-popover-body">
        <div class="aurora-suggestion">
          <span class="aurora-original">${this.escapeHTML(issue.originalText)}</span>
          <span class="aurora-arrow">→</span>
          <span class="aurora-suggested">${this.escapeHTML(issue.suggestedText)}</span>
        </div>
        <div class="aurora-explanation">${this.escapeHTML(issue.explanation)}</div>
      </div>
      <div class="aurora-popover-actions">
        <button class="aurora-btn aurora-btn-primary" data-action="accept">Accept</button>
        <button class="aurora-btn aurora-btn-secondary" data-action="ignore">Ignore</button>
        <button class="aurora-btn aurora-btn-text" data-action="ignore-all">Always Ignore</button>
      </div>
    `;
  }

  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private setupEvents(content: HTMLElement): void {
    content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');

      if (!action || !this.currentIssue || !this.actions) return;

      switch (action) {
        case 'accept':
          this.actions.onAccept(this.currentIssue);
          break;
        case 'ignore':
          this.actions.onIgnore(this.currentIssue);
          break;
        case 'ignore-all':
          this.actions.onIgnoreAll(this.currentIssue);
          break;
      }

      this.hide();
    });

    document.addEventListener('click', this.handleOutsideClick);
    document.addEventListener('keydown', this.handleKeydown);
  }

  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.popover && !this.popover.contains(e.target as Node)) {
      this.hide();
    }
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.hide();
    }
  };

  hide(): void {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeydown);

    if (this.popover) {
      this.popover.remove();
      this.popover = null;
      this.shadowRoot = null;
    }
    this.currentIssue = null;
  }

  isVisible(): boolean {
    return this.popover !== null;
  }

  destroy(): void {
    this.hide();
  }
}
