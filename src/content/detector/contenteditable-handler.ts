export interface TextPosition {
  rects: DOMRect[];
  startOffset: number;
  endOffset: number;
}

export class ContentEditableHandler {
  private element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  getTextPositions(text: string, startOffset: number, endOffset: number): TextPosition {
    const range = document.createRange();

    const { node: startNode, offset: startNodeOffset } = this.findTextPosition(startOffset);
    const { node: endNode, offset: endNodeOffset } = this.findTextPosition(endOffset);

    if (!startNode || !endNode) {
      return { rects: [], startOffset, endOffset };
    }

    try {
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
    } catch {
      return { rects: [], startOffset, endOffset };
    }

    const rects = Array.from(range.getClientRects());
    return {
      rects: rects.length > 0 ? rects : [],
      startOffset,
      endOffset,
    };
  }

  private findTextPosition(offset: number): { node: Node | null; offset: number } {
    const walker = document.createTreeWalker(
      this.element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let node = walker.nextNode();

    while (node) {
      const textNode = node as Text;
      const nodeLength = textNode.length;

      if (currentOffset + nodeLength >= offset) {
        return {
          node: textNode,
          offset: offset - currentOffset,
        };
      }

      currentOffset += nodeLength;
      node = walker.nextNode();
    }

    return { node: null, offset: 0 };
  }

  getText(): string {
    return this.element.textContent || '';
  }

  replaceText(startOffset: number, endOffset: number, replacement: string): void {
    const range = document.createRange();

    const { node: startNode, offset: startNodeOffset } = this.findTextPosition(startOffset);
    const { node: endNode, offset: endNodeOffset } = this.findTextPosition(endOffset);

    if (!startNode || !endNode) return;

    try {
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      range.deleteContents();
      range.insertNode(document.createTextNode(replacement));

      this.element.normalize();
      this.element.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      console.error('Failed to replace text:', e);
    }
  }

  setText(text: string): void {
    this.element.textContent = text;
    this.element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  destroy(): void {
    // No cleanup needed
  }
}
