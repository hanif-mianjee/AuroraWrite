import type { TextIssue, IssueCategory } from '../../shared/types/analysis';
import { CATEGORY_CONFIG } from '../../shared/constants/categories';

export interface UnderlineElement {
  element: HTMLElement;
  issue: TextIssue;
}

export class UnderlineRenderer {
  private container: HTMLElement;
  private underlines: Map<string, UnderlineElement> = new Map();
  private onSegmentClick: ((issue: TextIssue) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnSegmentClick(callback: (issue: TextIssue) => void): void {
    this.onSegmentClick = callback;
  }

  render(issues: TextIssue[], getRects: (issue: TextIssue) => DOMRect[]): void {
    // ALWAYS clear all existing underlines and recreate from scratch
    // This prevents any stale state accumulation from element reuse
    this.clear();

    for (const issue of issues) {
      if (issue.ignored) continue;

      const rects = getRects(issue);
      if (rects.length === 0) continue;

      const element = this.createUnderlineElement(issue);
      this.container.appendChild(element);
      this.underlines.set(issue.id, { element, issue });

      this.positionUnderline(element, rects, issue.category, issue);
    }
  }

  private createUnderlineElement(issue: TextIssue): HTMLElement {
    const element = document.createElement('div');
    element.className = 'aurora-underline';
    element.setAttribute('data-issue-id', issue.id);
    element.setAttribute('data-category', issue.category);
    return element;
  }

  private positionUnderline(element: HTMLElement, rects: DOMRect[], category: IssueCategory, issue: TextIssue): void {
    const config = CATEGORY_CONFIG[category];
    const containerRect = this.container.getBoundingClientRect();
    const thickness = config.thickness || 3;
    const hoverBg = this.hexToRgba(config.color, 0.15);

    element.innerHTML = '';

    for (const rect of rects) {
      const left = rect.left - containerRect.left;
      const segmentTop = rect.top - containerRect.top + rect.height - thickness + 1;

      // Cap width to not extend beyond container
      const availableWidth = containerRect.width - left - 5;
      const width = Math.max(10, Math.min(rect.width, availableWidth));

      // Skip if position is outside container
      if (left < 0 || left > containerRect.width || segmentTop < 0) {
        continue;
      }

      // Hit area — covers full text height, handles all mouse events
      const hitArea = document.createElement('div');
      hitArea.className = 'aurora-underline-hitarea';
      const hitTop = rect.top - containerRect.top;
      hitArea.style.cssText = `
        position: absolute;
        left: ${Math.max(0, left)}px;
        top: ${hitTop}px;
        width: ${width}px;
        height: ${rect.height}px;
        pointer-events: auto;
        cursor: pointer;
        background: transparent;
        border-radius: 3px;
        transition: background 150ms ease;
      `;

      // Underline visual — thin strip, no pointer events
      const segment = document.createElement('div');
      segment.className = 'aurora-underline-segment';

      const underlineStyle = this.getUnderlineStyle(config.underlineStyle, config.color);
      segment.style.cssText = `
        position: absolute;
        left: ${Math.max(0, left)}px;
        top: ${segmentTop + 1}px;
        width: ${width}px;
        height: ${thickness}px;
        pointer-events: none;
        ${underlineStyle}
        border-radius: 1px;
        opacity: 0.65;
        transition: opacity 150ms ease;
      `;

      // Click handler on hit area
      hitArea.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.onSegmentClick) {
          this.onSegmentClick(issue);
        }
      });

      // Hover handlers on hit area
      let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

      hitArea.addEventListener('mouseenter', () => {
        // Highlight ALL hit areas and segments for this issue (multi-line support)
        const allHitAreas = element.querySelectorAll('.aurora-underline-hitarea') as NodeListOf<HTMLElement>;
        allHitAreas.forEach(h => h.style.background = hoverBg);
        const allSegments = element.querySelectorAll('.aurora-underline-segment') as NodeListOf<HTMLElement>;
        allSegments.forEach(s => s.style.opacity = '1.0');

        // Trigger popover after 300ms
        hoverTimeout = setTimeout(() => {
          if (this.onSegmentClick) {
            this.onSegmentClick(issue);
          }
        }, 300);
      });

      hitArea.addEventListener('mouseleave', () => {
        // Remove highlight from ALL hit areas and segments for this issue
        const allHitAreas = element.querySelectorAll('.aurora-underline-hitarea') as NodeListOf<HTMLElement>;
        allHitAreas.forEach(h => h.style.background = 'transparent');
        const allSegments = element.querySelectorAll('.aurora-underline-segment') as NodeListOf<HTMLElement>;
        allSegments.forEach(s => s.style.opacity = '0.65');

        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
      });

      element.appendChild(hitArea);
      element.appendChild(segment);
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private getUnderlineStyle(style: string, color: string): string {
    switch (style) {
      case 'squiggly':
        return `
          background: linear-gradient(135deg, ${color} 25%, transparent 25%),
                      linear-gradient(225deg, ${color} 25%, transparent 25%),
                      linear-gradient(315deg, ${color} 25%, transparent 25%),
                      linear-gradient(45deg, ${color} 25%, transparent 25%);
          background-size: 4px 4px;
          background-position: 0 0, 2px 0, 2px -2px, 0 2px;
        `;
      case 'dashed':
        return `
          background: repeating-linear-gradient(
            90deg,
            ${color} 0px,
            ${color} 4px,
            transparent 4px,
            transparent 8px
          );
        `;
      case 'dotted':
        return `
          background: repeating-linear-gradient(
            90deg,
            ${color} 0px,
            ${color} 2px,
            transparent 2px,
            transparent 6px
          );
        `;
      case 'wavy':
        return `
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='3'%3E%3Cpath d='M0 2 Q2 0 4 2 T8 2' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='1'/%3E%3C/svg%3E") repeat-x;
        `;
      case 'double':
        return `
          background: ${color};
          box-shadow: 0 2px 0 ${color};
          height: 1px !important;
        `;
      default:
        return `background: ${color};`;
    }
  }

  getUnderlineAt(x: number, y: number): TextIssue | null {
    for (const [_, underline] of this.underlines) {
      const hitAreas = underline.element.querySelectorAll('.aurora-underline-hitarea');
      for (const hitArea of hitAreas) {
        const rect = hitArea.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return underline.issue;
        }
      }
    }
    return null;
  }

  removeUnderline(issueId: string): void {
    const underline = this.underlines.get(issueId);
    if (underline) {
      underline.element.remove();
      this.underlines.delete(issueId);
    }
  }

  clear(): void {
    for (const [_, underline] of this.underlines) {
      underline.element.remove();
    }
    this.underlines.clear();
  }

  destroy(): void {
    this.clear();
  }
}
