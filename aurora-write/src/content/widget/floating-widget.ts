import type { IssueCounts, IssueCategory, TextIssue } from '../../shared/types/analysis';
import { CATEGORY_CONFIG, ISSUE_CATEGORIES } from '../../shared/constants/categories';

type WidgetState = 'loading' | 'issues' | 'clean' | 'error' | 'hidden';

export class FloatingWidget {
  private widget: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isExpanded = false;
  private currentFieldElement: HTMLElement | null = null;
  private state: WidgetState = 'hidden';
  private onCategoryClick: ((category: IssueCategory) => void) | null = null;

  setOnCategoryClick(callback: (category: IssueCategory) => void): void {
    this.onCategoryClick = callback;
  }

  show(fieldElement: HTMLElement, issues: TextIssue[]): void {
    console.log('[AuroraWrite] Widget.show called, issues:', issues.length);
    this.currentFieldElement = fieldElement;
    const counts = this.calculateCounts(issues);

    if (counts.total === 0) {
      console.log('[AuroraWrite] Showing clean state');
      this.showClean(fieldElement);
    } else {
      console.log('[AuroraWrite] Showing issues state:', counts);
      this.showIssues(fieldElement, counts);
    }
  }

  showLoading(fieldElement: HTMLElement): void {
    console.log('[AuroraWrite] Widget.showLoading called');
    this.currentFieldElement = fieldElement;
    this.state = 'loading';
    this.hide();
    this.createWidget(fieldElement, 'loading');
  }

  showError(fieldElement: HTMLElement, error: string): void {
    this.currentFieldElement = fieldElement;
    this.state = 'error';
    this.hide();
    this.createWidget(fieldElement, 'error', undefined, error);
  }

  private showClean(fieldElement: HTMLElement): void {
    this.state = 'clean';
    this.hide();
    this.createWidget(fieldElement, 'clean');
  }

  private showIssues(fieldElement: HTMLElement, counts: IssueCounts): void {
    this.state = 'issues';
    this.hide();
    this.createWidget(fieldElement, 'issues', counts);
  }

  private createWidget(fieldElement: HTMLElement, state: WidgetState, counts?: IssueCounts, error?: string): void {
    this.widget = document.createElement('div');
    this.widget.className = 'aurora-widget-container';
    this.shadowRoot = this.widget.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    const content = document.createElement('div');
    content.className = 'aurora-widget';
    content.innerHTML = this.getWidgetHTML(state, counts, error);
    this.shadowRoot.appendChild(content);

    this.positionWidget(fieldElement);
    document.body.appendChild(this.widget);

    if (state === 'issues' && counts) {
      this.setupWidgetEvents(content);
    }
  }

  private positionWidget(fieldElement: HTMLElement): void {
    if (!this.widget) return;

    const rect = fieldElement.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position at bottom-right corner of the field
    const top = rect.bottom + scrollY - 48;
    const left = rect.right + scrollX - 140;

    this.widget.style.cssText = `
      position: absolute;
      top: ${Math.max(rect.top + scrollY + 8, top)}px;
      left: ${Math.max(rect.left + scrollX + 8, left)}px;
      z-index: 2147483647;
    `;
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
      }
      .aurora-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        background: #1a1a2e;
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
        min-width: 48px;
        cursor: pointer;
        user-select: none;
        overflow: hidden;
      }
      .aurora-widget-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
      }
      .aurora-logo {
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
      }
      .aurora-title {
        font-weight: 600;
        font-size: 13px;
        flex: 1;
      }
      .aurora-total {
        background: rgba(255,255,255,0.15);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .aurora-expand-icon {
        font-size: 10px;
        opacity: 0.6;
        transition: transform 0.2s;
      }
      .aurora-widget.expanded .aurora-expand-icon {
        transform: rotate(180deg);
      }
      .aurora-categories {
        display: none;
        padding: 0 8px 8px;
      }
      .aurora-widget.expanded .aurora-categories {
        display: block;
      }
      .aurora-category-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .aurora-category-row:hover {
        background: rgba(255,255,255,0.1);
      }
      .aurora-category-bar {
        width: 4px;
        height: 18px;
        border-radius: 2px;
      }
      .aurora-category-name {
        flex: 1;
        font-size: 13px;
        opacity: 0.9;
      }
      .aurora-category-count {
        font-weight: 600;
        font-size: 13px;
      }
      .aurora-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
      }
      .aurora-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #8b5cf6;
        border-radius: 50%;
        animation: aurora-spin 0.8s linear infinite;
      }
      @keyframes aurora-spin {
        to { transform: rotate(360deg); }
      }
      .aurora-clean {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        color: #4ade80;
      }
      .aurora-check {
        font-size: 16px;
      }
      .aurora-error {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        color: #f87171;
        max-width: 220px;
      }
      .aurora-error-icon {
        font-size: 16px;
      }
      .aurora-error-text {
        font-size: 12px;
        line-height: 1.3;
      }
    `;
  }

  private getWidgetHTML(state: WidgetState, counts?: IssueCounts, error?: string): string {
    if (state === 'loading') {
      return `
        <div class="aurora-loading">
          <div class="aurora-spinner"></div>
          <span>Checking...</span>
        </div>
      `;
    }

    if (state === 'error') {
      return `
        <div class="aurora-error">
          <span class="aurora-error-icon">⚠</span>
          <span class="aurora-error-text">${error || 'Error'}</span>
        </div>
      `;
    }

    if (state === 'clean') {
      return `
        <div class="aurora-clean">
          <span class="aurora-check">✓</span>
          <span>Looking good!</span>
        </div>
      `;
    }

    if (!counts) return '';

    const categoryRows = ISSUE_CATEGORIES
      .filter((cat) => counts[cat] > 0)
      .map((cat) => `
        <div class="aurora-category-row" data-category="${cat}">
          <div class="aurora-category-bar" style="background: ${CATEGORY_CONFIG[cat].color}"></div>
          <span class="aurora-category-name">${CATEGORY_CONFIG[cat].name}</span>
          <span class="aurora-category-count" style="color: ${CATEGORY_CONFIG[cat].color}">${counts[cat]}</span>
        </div>
      `)
      .join('');

    return `
      <div class="aurora-widget-header">
        <div class="aurora-logo">A</div>
        <span class="aurora-title">Aurora</span>
        <span class="aurora-total">${counts.total}</span>
        <span class="aurora-expand-icon">▼</span>
      </div>
      <div class="aurora-categories">
        ${categoryRows}
      </div>
    `;
  }

  private setupWidgetEvents(content: HTMLElement): void {
    const header = content.querySelector('.aurora-widget-header');
    if (header) {
      header.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        content.classList.toggle('expanded', this.isExpanded);
      });
    }

    content.querySelectorAll('.aurora-category-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const category = (row as HTMLElement).getAttribute('data-category') as IssueCategory;
        if (category && this.onCategoryClick) {
          this.onCategoryClick(category);
        }
      });
    });
  }

  private calculateCounts(issues: TextIssue[]): IssueCounts {
    const counts: IssueCounts = {
      spelling: 0,
      grammar: 0,
      style: 0,
      clarity: 0,
      tone: 0,
      total: 0,
    };

    for (const issue of issues) {
      if (!issue.ignored) {
        counts[issue.category]++;
        counts.total++;
      }
    }

    return counts;
  }

  update(issues: TextIssue[]): void {
    if (!this.currentFieldElement) return;

    const counts = this.calculateCounts(issues);
    if (counts.total === 0) {
      this.showClean(this.currentFieldElement);
    } else {
      this.showIssues(this.currentFieldElement, counts);
    }
  }

  hide(): void {
    if (this.widget) {
      this.widget.remove();
      this.widget = null;
      this.shadowRoot = null;
    }
    this.isExpanded = false;
  }

  destroy(): void {
    this.hide();
    this.currentFieldElement = null;
  }
}
