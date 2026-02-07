import type { IssueCounts, IssueCategory, TextIssue } from '../../shared/types/analysis';
import { CATEGORY_CONFIG, ISSUE_CATEGORIES } from '../../shared/constants/categories';

type WidgetState = 'loading' | 'issues' | 'clean' | 'error' | 'hidden';

export class FloatingWidget {
  private widget: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private isExpanded = false;
  private isHoverExpanded = false;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentFieldElement: HTMLElement | null = null;
  private state: WidgetState = 'hidden';
  private onCategoryClick: ((category: IssueCategory) => void) | null = null;
  private onAcceptAllSpelling: (() => void) | null = null;
  private onReanalyze: (() => void) | null = null;
  private onToggleDomain: (() => void) | null = null;
  private isInteracting = false;

  setOnCategoryClick(callback: (category: IssueCategory) => void): void {
    this.onCategoryClick = callback;
  }

  setOnAcceptAllSpelling(callback: () => void): void {
    this.onAcceptAllSpelling = callback;
  }

  setOnReanalyze(callback: () => void): void {
    this.onReanalyze = callback;
  }

  setOnToggleDomain(callback: () => void): void {
    this.onToggleDomain = callback;
  }

  isUserInteracting(): boolean {
    return this.isInteracting;
  }

  show(fieldElement: HTMLElement, issues: TextIssue[]): void {
    this.currentFieldElement = fieldElement;
    const counts = this.calculateCounts(issues);

    if (counts.total === 0) {
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

    // Track mouse interactions to prevent blur from hiding widget
    this.widget.addEventListener('mouseenter', () => {
      this.isInteracting = true;
      // Start hover expansion timer
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
      }
      this.hoverTimeout = setTimeout(() => {
        this.isHoverExpanded = true;
        content.classList.add('hover-expanded');
      }, 300);
    });
    this.widget.addEventListener('mouseleave', () => {
      this.isInteracting = false;
      // Clear hover expansion
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout);
        this.hoverTimeout = null;
      }
      this.isHoverExpanded = false;
      content.classList.remove('hover-expanded');
    });
    this.widget.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isInteracting = true;
    });

    if (state === 'issues' && counts) {
      this.setupWidgetEvents(content);
    }

    // Set up reanalyze event for clean state
    if (state === 'clean') {
      this.setupCleanStateEvents(content);
    }

    // Set up power button event for all states
    this.setupPowerButtonEvent(content);
  }

  private positionWidget(fieldElement: HTMLElement): void {
    if (!this.widget) return;

    const rect = fieldElement.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Position at bottom-right corner of the field, inside the bounds
    const padding = 8;
    const top = rect.bottom + scrollY - padding;
    const left = rect.right + scrollX - padding;

    this.widget.style.cssText = `
      position: fixed;
      top: ${top - scrollY}px;
      left: ${left - scrollX}px;
      transform: translate(-100%, -100%);
      z-index: 2147483647;
      isolation: isolate;
    `;
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .aurora-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        background: #ffffff;
        color: #374151;
        border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08);
        border: 1px solid rgba(0,0,0,0.08);
        // min-width: 180px;
        user-select: none;
        overflow: hidden;
      }
      .aurora-widget-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .aurora-widget-header:hover {
        background: #f9fafb;
      }
      .aurora-logo {
        width: 22px;
        height: 22px;
        flex-shrink: 0;
      }
      .aurora-logo svg {
        width: 100%;
        height: 100%;
      }
      .aurora-title {
        font-weight: 600;
        font-size: 13px;
        color: #111827;
      }
      .aurora-total {
        background: #fee2e2;
        color: #dc2626;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }
      .aurora-total.clean {
        background: #d1fae5;
        color: #059669;
      }
      .aurora-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }
      .aurora-expand-icon {
        font-size: 10px;
        color: #9ca3af;
        transition: transform 0.2s;
      }
      .aurora-widget.expanded .aurora-expand-icon {
        transform: rotate(180deg);
      }
      .aurora-categories {
        display: none;
        border-top: 1px solid #f3f4f6;
      }
      .aurora-widget.expanded .aurora-categories {
        display: block;
      }
      .aurora-category-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .aurora-category-row:hover {
        background: #f9fafb;
      }
      .aurora-category-bar {
        width: 3px;
        height: 16px;
        border-radius: 2px;
      }
      .aurora-category-name {
        flex: 1;
        font-size: 13px;
        color: #4b5563;
      }
      .aurora-category-count {
        font-weight: 600;
        font-size: 12px;
        padding: 1px 6px;
        border-radius: 8px;
        background: #f3f4f6;
      }
      .aurora-loading {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        color: #6b7280;
      }
      .aurora-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e5e7eb;
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: aurora-spin 0.8s linear infinite;
      }
      @keyframes aurora-spin {
        to { transform: rotate(360deg); }
      }
      .aurora-clean {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        color: #059669;
        cursor: pointer;
        transition: background 0.15s;
      }
      .aurora-clean:hover {
        background: #f9fafb;
      }
      .aurora-clean-wrapper {
        position: relative;
        width: 20px;
        height: 20px;
      }
      .aurora-clean-icon {
        width: 20px;
        height: 20px;
        transition: opacity 0.15s;
      }
      .aurora-clean-icon svg {
        width: 100%;
        height: 100%;
      }
      .aurora-refresh-icon {
        width: 28px;
        height: 28px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.15s, background 0.15s;
        color: #6366f1;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
      }
      .aurora-refresh-icon svg {
        width: 18px;
        height: 18px;
      }
      .aurora-refresh-icon:hover {
        background: rgba(99, 102, 241, 0.1);
      }
      .aurora-clean:hover .aurora-clean-icon {
        opacity: 0;
      }
      .aurora-clean:hover .aurora-refresh-icon {
        opacity: 1;
      }
      .aurora-error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        color: #dc2626;
        max-width: 220px;
      }
      .aurora-error-icon {
        font-size: 14px;
      }
      .aurora-error-text {
        font-size: 12px;
        line-height: 1.3;
      }
      .aurora-accept-all {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 12px;
        margin: 8px;
        margin-top: 0;
        background: #e53935;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }
      .aurora-accept-all:hover {
        background: #c62828;
      }
      .aurora-power-btn-container {
        display: flex;
        align-items: center;
        overflow: hidden;
        max-width: 0;
        opacity: 0;
        transition: max-width 0.2s ease, opacity 0.2s ease;
      }
      .aurora-widget.hover-expanded .aurora-power-btn-container {
        max-width: 40px;
        opacity: 1;
      }
      .aurora-power-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        margin-left: 8px;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        color: #9ca3af;
        transition: background 0.15s, color 0.15s;
      }
      .aurora-power-btn:hover {
        background: #fee2e2;
        color: #dc2626;
      }
      .aurora-power-btn svg {
        width: 16px;
        height: 16px;
      }
    `;
  }

  private getWidgetHTML(state: WidgetState, counts?: IssueCounts, error?: string): string {
    if (state === 'loading') {
      return `
        <div class="aurora-loading">
          <div class="aurora-spinner"></div>
          <div class="aurora-power-btn-container">
            <button class="aurora-power-btn" data-action="toggle-domain" title="Disable for this website">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </button>
          </div>
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
        <div class="aurora-clean" data-action="reanalyze" title="Click to re-analyze">
          <div class="aurora-clean-wrapper">
            <span class="aurora-clean-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </span>
            <span class="aurora-refresh-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
              </svg>
            </span>
          </div>
          <div class="aurora-power-btn-container">
            <button class="aurora-power-btn" data-action="toggle-domain" title="Disable for this website">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </button>
          </div>
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

    // Add "Accept All Spelling" button if there are spelling issues
    const acceptAllButton = counts.spelling > 0
      ? `<button class="aurora-accept-all" data-action="accept-all-spelling">✓ Fix All Spelling (${counts.spelling})</button>`
      : '';

    return `
      <div class="aurora-widget-header">
        <div class="aurora-logo">
          <svg viewBox="0 0 128 128">
            <defs>
              <linearGradient id="auroraLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1976d2"/>
                <stop offset="100%" style="stop-color:#7c4dff"/>
              </linearGradient>
            </defs>
            <circle cx="64" cy="64" r="60" fill="url(#auroraLogoGrad)"/>
            <text x="64" y="82" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle">A</text>
            <path d="M30 100 Q64 85 98 100" stroke="#4caf50" stroke-width="6" fill="none" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="aurora-title">Aurora</span>
        <div class="aurora-header-right">
          <span class="aurora-total">${counts.total} issue${counts.total > 1 ? 's' : ''}</span>
          <span class="aurora-expand-icon">▼</span>
          <div class="aurora-power-btn-container">
            <button class="aurora-power-btn" data-action="toggle-domain" title="Disable for this website">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="aurora-categories">
        ${categoryRows}
        ${acceptAllButton}
      </div>
    `;
  }

  private setupWidgetEvents(content: HTMLElement): void {
    const header = content.querySelector('.aurora-widget-header');
    if (header) {
      header.addEventListener('click', (e) => {
        e.stopPropagation();
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

    // Handle Accept All Spelling button
    const acceptAllBtn = content.querySelector('.aurora-accept-all');
    if (acceptAllBtn) {
      acceptAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onAcceptAllSpelling) {
          this.onAcceptAllSpelling();
        }
      });
    }
  }

  private setupCleanStateEvents(content: HTMLElement): void {
    const cleanDiv = content.querySelector('.aurora-clean[data-action="reanalyze"]');
    if (cleanDiv) {
      cleanDiv.addEventListener('click', (e) => {
        // Don't trigger reanalyze if clicking on power button
        if ((e.target as HTMLElement).closest('.aurora-power-btn')) {
          return;
        }
        e.stopPropagation();
        if (this.onReanalyze) {
          this.onReanalyze();
        }
      });
    }
  }

  private setupPowerButtonEvent(content: HTMLElement): void {
    const powerBtn = content.querySelector('.aurora-power-btn');
    if (powerBtn) {
      powerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onToggleDomain) {
          this.onToggleDomain();
        }
      });
    }
  }

  private calculateCounts(issues: TextIssue[]): IssueCounts {
    const counts: IssueCounts = {
      spelling: 0,
      grammar: 0,
      style: 0,
      clarity: 0,
      tone: 0,
      rephrase: 0,
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
