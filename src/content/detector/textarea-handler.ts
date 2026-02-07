export interface TextPosition {
  rects: DOMRect[];
  startOffset: number;
  endOffset: number;
}

export class TextareaHandler {
  private mirror: HTMLDivElement | null = null;
  private textarea: HTMLTextAreaElement | HTMLInputElement;

  constructor(textarea: HTMLTextAreaElement | HTMLInputElement) {
    this.textarea = textarea;
  }

  createMirror(): HTMLDivElement {
    if (this.mirror) return this.mirror;

    this.mirror = document.createElement('div');
    this.mirror.setAttribute('aria-hidden', 'true');

    const styles = window.getComputedStyle(this.textarea);
    const propertiesToCopy = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'textTransform', 'wordSpacing',
      'textIndent', 'whiteSpace', 'wordWrap', 'wordBreak',
      'lineHeight', 'padding', 'paddingTop', 'paddingRight',
      'paddingBottom', 'paddingLeft', 'border', 'borderWidth',
      'boxSizing', 'textAlign', 'direction',
    ];

    // Base styles - overflow:visible and auto height ensure text wraps same as textarea
    this.mirror.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      pointer-events: none;
      overflow: visible;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    propertiesToCopy.forEach((prop) => {
      (this.mirror!.style as unknown as Record<string, string>)[prop] = styles.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      );
    });

    // CRITICAL: Remove border from mirror - we want the mirror content area to match
    // textarea's clientWidth exactly. Border would reduce content area with border-box.
    this.mirror.style.border = 'none';
    this.mirror.style.borderWidth = '0';

    // Initial width - will be updated on each getTextPositions call
    this.mirror.style.width = `${this.textarea.clientWidth}px`;
    this.mirror.style.height = 'auto';

    document.body.appendChild(this.mirror);
    return this.mirror;
  }

  getTextPositions(text: string, startOffset: number, endOffset: number): TextPosition {
    const mirror = this.createMirror();

    // CRITICAL: Calculate the ACTUAL text content width of the textarea
    // clientWidth includes padding but we need to account for scrollbar if present
    // scrollWidth vs clientWidth difference indicates scrollbar presence
    const styles = window.getComputedStyle(this.textarea);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;

    // The actual width available for text content
    // For textareas, we need the width that text actually renders in
    // This is clientWidth (includes padding, excludes scrollbar)
    const contentWidth = this.textarea.clientWidth;

    // Set mirror to match EXACTLY the textarea's rendering
    mirror.style.width = `${contentWidth}px`;
    mirror.style.height = 'auto'; // Let it grow to fit content naturally
    mirror.style.maxHeight = 'none'; // Remove any height constraints
    mirror.style.overflow = 'visible'; // Don't clip content

    // CRITICAL: Completely rebuild mirror content to ensure accurate layout
    // Remove all children instead of just clearing textContent
    while (mirror.firstChild) {
      mirror.removeChild(mirror.firstChild);
    }

    const beforeText = text.substring(0, startOffset);
    const targetText = text.substring(startOffset, endOffset);
    const afterText = text.substring(endOffset);

    const beforeSpan = document.createElement('span');
    beforeSpan.textContent = beforeText;

    const targetSpan = document.createElement('span');
    targetSpan.textContent = targetText;
    targetSpan.style.backgroundColor = 'transparent';

    const afterSpan = document.createElement('span');
    afterSpan.textContent = afterText;

    mirror.appendChild(beforeSpan);
    mirror.appendChild(targetSpan);
    mirror.appendChild(afterSpan);

    // Force layout reflow before measuring
    // This ensures the browser computes the actual positions
    void mirror.offsetHeight;

    const textareaRect = this.textarea.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    const scrollTop = this.textarea.scrollTop;
    const scrollLeft = this.textarea.scrollLeft;

    // Account for textarea border (mirror has no border, but textarea does)
    // This offset ensures underlines align with text inside the bordered textarea
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const borderTop = parseFloat(styles.borderTopWidth) || 0;

    // Use getClientRects() to get individual line rects for wrapped text
    const clientRects = targetSpan.getClientRects();
    const rects: DOMRect[] = [];

    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      // Limit width to not exceed textarea bounds
      const maxWidth = textareaRect.width - (rect.left - mirrorRect.left) - borderLeft - 10;
      const adjustedRect = new DOMRect(
        textareaRect.left + borderLeft + (rect.left - mirrorRect.left) - scrollLeft,
        textareaRect.top + borderTop + (rect.top - mirrorRect.top) - scrollTop,
        Math.min(rect.width, maxWidth),
        rect.height
      );
      rects.push(adjustedRect);
    }

    // Fallback if no rects found
    if (rects.length === 0) {
      const targetRect = targetSpan.getBoundingClientRect();
      const maxWidth = textareaRect.width - (targetRect.left - mirrorRect.left) - borderLeft - 10;
      rects.push(new DOMRect(
        textareaRect.left + borderLeft + (targetRect.left - mirrorRect.left) - scrollLeft,
        textareaRect.top + borderTop + (targetRect.top - mirrorRect.top) - scrollTop,
        Math.min(targetRect.width, maxWidth),
        targetRect.height
      ));
    }

    return {
      rects,
      startOffset,
      endOffset,
    };
  }

  getText(): string {
    return this.textarea.value;
  }

  replaceText(startOffset: number, endOffset: number, replacement: string): void {
    const text = this.textarea.value;
    const newText = text.substring(0, startOffset) + replacement + text.substring(endOffset);

    this.textarea.value = newText;
    this.textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Invalidate cached mirror since text layout may have changed
    this.invalidateMirror();
  }

  setText(text: string): void {
    this.textarea.value = text;
    this.textarea.dispatchEvent(new Event('input', { bubbles: true }));

    // Invalidate cached mirror since text layout may have changed
    this.invalidateMirror();
  }

  /**
   * Invalidate the cached mirror element.
   * Call this when text changes to ensure fresh layout calculation.
   */
  invalidateMirror(): void {
    if (this.mirror) {
      this.mirror.remove();
      this.mirror = null;
    }
  }

  destroy(): void {
    if (this.mirror) {
      this.mirror.remove();
      this.mirror = null;
    }
  }
}
