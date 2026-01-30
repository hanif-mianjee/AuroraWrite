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
    const currentIds = new Set(issues.map((i) => i.id));

    for (const [id, underline] of this.underlines) {
      if (!currentIds.has(id)) {
        underline.element.remove();
        this.underlines.delete(id);
      }
    }

    for (const issue of issues) {
      if (issue.ignored) continue;

      const rects = getRects(issue);
      if (rects.length === 0) continue;

      let underline = this.underlines.get(issue.id);

      if (!underline) {
        const element = this.createUnderlineElement(issue);
        this.container.appendChild(element);
        underline = { element, issue };
        this.underlines.set(issue.id, underline);
      }

      this.positionUnderline(underline.element, rects, issue.category, issue);
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

    element.innerHTML = '';

    for (const rect of rects) {
      const segment = document.createElement('div');
      segment.className = 'aurora-underline-segment';

      const left = rect.left - containerRect.left;
      const top = rect.top - containerRect.top + rect.height - 3;

      segment.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        width: ${rect.width}px;
        height: 3px;
        pointer-events: auto;
        cursor: pointer;
        ${this.getUnderlineStyle(config.underlineStyle, config.color)}
      `;

      // Add direct click handler to segment
      segment.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AuroraWrite] Segment clicked for issue:', issue.id);
        if (this.onSegmentClick) {
          this.onSegmentClick(issue);
        }
      });

      element.appendChild(segment);
    }
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
      const segments = underline.element.querySelectorAll('.aurora-underline-segment');
      for (const segment of segments) {
        const rect = segment.getBoundingClientRect();
        const hitRect = new DOMRect(rect.x, rect.y - 10, rect.width, rect.height + 20);
        if (x >= hitRect.left && x <= hitRect.right && y >= hitRect.top && y <= hitRect.bottom) {
          return underline.issue;
        }
      }
    }
    return null;
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
