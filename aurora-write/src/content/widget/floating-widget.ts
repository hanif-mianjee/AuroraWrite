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
    this.currentFieldElement = fieldElement;
    const counts = this.calculateCounts(issues);

    if (counts.total === 0) {
      // Show "all good" state
      this.showClean(fieldElement);
    } else {
      this.showIssues(fieldElement, counts);
    }
  }

  showLoading(fieldElement: HTMLElement): void {
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

    this.widget.style.cssText = `
      position: absolute;
      top: ${rect.bottom + scrollY - 40}px;
      left: ${rect.right + scrollX - 50}px;
      z-index: 2147483647;
    `;
  }

  private getStyles(): string {
    return `
      .aurora-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        padding: 8px 12px;
        min-width: 40px;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      }
      .aurora-widget:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .aurora-widget-collapsed {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .aurora-widget-expanded {
        display: none;
      }
      .aurora-widget.expanded .aurora-widget-collapsed {
        display: none;
      }
      .aurora-widget.expanded .aurora-widget-expanded {
        display: block;
      }
      .aurora-count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        font-size: 11px;
        padding: 0 6px;
      }
      .aurora-category-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 4px;
        border-radius: 4px;
        cursor: pointer;
      }
      .aurora-category-row:hover {
        background: #f5f5f5;
      }
      .aurora-category-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .aurora-category-name {
        flex: 1;
        color: #333;
      }
      .aurora-category-count {
        color: #666;
        font-weight: 500;
      }
      .aurora-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
      }
      .aurora-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #e0e0e0;
        border-top-color: #1976d2;
        border-radius: 50%;
        animation: aurora-spin 0.8s linear infinite;
      }
      @keyframes aurora-spin {
        to { transform: rotate(360deg); }
      }
      .aurora-clean {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #4caf50;
        font-weight: 500;
      }
      .aurora-check {
        font-size: 16px;
      }
      .aurora-error {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #e53935;
        font-weight: 500;
        max-width: 200px;
      }
      .aurora-error-icon {
        font-size: 16px;
      }
      .aurora-error-text {
        font-size: 11px;
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
          <span>All good</span>
        </div>
      `;
    }

    if (!counts) return '';

    const categoryBadges = ISSUE_CATEGORIES
      .filter((cat) => counts[cat] > 0)
      .map((cat) => `
        <span class="aurora-count-badge" style="background: ${CATEGORY_CONFIG[cat].color}">
          ${counts[cat]}
        </span>
      `)
      .join('');

    const categoryRows = ISSUE_CATEGORIES
      .filter((cat) => counts[cat] > 0)
      .map((cat) => `
        <div class="aurora-category-row" data-category="${cat}">
          <span class="aurora-category-dot" style="background: ${CATEGORY_CONFIG[cat].color}"></span>
          <span class="aurora-category-name">${CATEGORY_CONFIG[cat].name}</span>
          <span class="aurora-category-count">${counts[cat]}</span>
        </div>
      `)
      .join('');

    return `
      <div class="aurora-widget-collapsed">
        ${categoryBadges}
      </div>
      <div class="aurora-widget-expanded">
        ${categoryRows}
      </div>
    `;
  }

  private setupWidgetEvents(content: HTMLElement): void {
    content.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const categoryRow = target.closest('.aurora-category-row');

      if (categoryRow) {
        const category = categoryRow.getAttribute('data-category') as IssueCategory;
        if (category && this.onCategoryClick) {
          this.onCategoryClick(category);
        }
        return;
      }

      this.isExpanded = !this.isExpanded;
      content.classList.toggle('expanded', this.isExpanded);
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
