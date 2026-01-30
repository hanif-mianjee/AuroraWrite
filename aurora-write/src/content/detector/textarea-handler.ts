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

    this.mirror.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      pointer-events: none;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    propertiesToCopy.forEach((prop) => {
      (this.mirror!.style as unknown as Record<string, string>)[prop] = styles.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      );
    });

    this.mirror.style.width = `${this.textarea.clientWidth}px`;
    this.mirror.style.height = `${this.textarea.clientHeight}px`;

    document.body.appendChild(this.mirror);
    return this.mirror;
  }

  getTextPositions(text: string, startOffset: number, endOffset: number): TextPosition {
    const mirror = this.createMirror();

    mirror.textContent = '';

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

    const textareaRect = this.textarea.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    const scrollTop = this.textarea.scrollTop;
    const scrollLeft = this.textarea.scrollLeft;

    // Use getClientRects() to get individual line rects for wrapped text
    const clientRects = targetSpan.getClientRects();
    const rects: DOMRect[] = [];

    for (let i = 0; i < clientRects.length; i++) {
      const rect = clientRects[i];
      // Limit width to not exceed textarea bounds
      const maxWidth = textareaRect.width - (rect.left - mirrorRect.left) - 10;
      const adjustedRect = new DOMRect(
        textareaRect.left + (rect.left - mirrorRect.left) - scrollLeft,
        textareaRect.top + (rect.top - mirrorRect.top) - scrollTop,
        Math.min(rect.width, maxWidth),
        rect.height
      );
      rects.push(adjustedRect);
    }

    // Fallback if no rects found
    if (rects.length === 0) {
      const targetRect = targetSpan.getBoundingClientRect();
      const maxWidth = textareaRect.width - (targetRect.left - mirrorRect.left) - 10;
      rects.push(new DOMRect(
        textareaRect.left + (targetRect.left - mirrorRect.left) - scrollLeft,
        textareaRect.top + (targetRect.top - mirrorRect.top) - scrollTop,
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
  }

  destroy(): void {
    if (this.mirror) {
      this.mirror.remove();
      this.mirror = null;
    }
  }
}
