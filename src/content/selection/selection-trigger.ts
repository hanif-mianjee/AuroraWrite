export type TriggerClickCallback = () => void;

export class SelectionTrigger {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private onClick: TriggerClickCallback | null = null;

  setOnClick(callback: TriggerClickCallback): void {
    this.onClick = callback;
  }

  show(rects: DOMRect[]): void {
    this.hide();

    if (rects.length === 0) {
      return;
    }

    // Position at the end of the selection (last rect)
    const lastRect = rects[rects.length - 1];
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    this.container = document.createElement('div');
    this.container.className = 'aurora-selection-trigger';
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = this.getStyles();
    this.shadowRoot.appendChild(styles);

    const button = document.createElement('button');
    button.className = 'trigger-button';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
      </svg>
      <span>Transform</span>
    `;
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClick?.();
    });

    this.shadowRoot.appendChild(button);

    // Calculate position with viewport bounds checking
    const triggerWidth = 100;
    const triggerHeight = 30;
    const padding = 8;

    let left = lastRect.right + scrollX + 4;
    let top = lastRect.bottom + scrollY + 4;

    // Check right edge
    if (left + triggerWidth > viewportWidth + scrollX - padding) {
      left = lastRect.left + scrollX - triggerWidth - 4;
    }

    // Check left edge
    if (left < scrollX + padding) {
      left = scrollX + padding;
    }

    // Check bottom edge
    if (top + triggerHeight > viewportHeight + scrollY - padding) {
      top = lastRect.top + scrollY - triggerHeight - 4;
    }

    // Check top edge
    if (top < scrollY + padding) {
      top = scrollY + padding;
    }

    this.container.style.cssText = `
      position: absolute;
      top: ${top}px;
      left: ${left}px;
      z-index: 2147483646;
    `;

    document.body.appendChild(this.container);
  }

  private getStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .trigger-button {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
        transition: transform 0.15s, box-shadow 0.15s;
        white-space: nowrap;
      }
      .trigger-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
      }
      .trigger-button:active {
        transform: translateY(0);
      }
      .trigger-button svg {
        flex-shrink: 0;
      }
    `;
  }

  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }

  isVisible(): boolean {
    return this.container !== null;
  }

  destroy(): void {
    this.hide();
  }
}
