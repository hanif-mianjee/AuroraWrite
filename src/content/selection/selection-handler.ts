import { debounce } from '../../shared/utils/debounce';

export interface SelectionContext {
  text: string;
  range: Range;
  isEditable: boolean;
  editableElement: HTMLElement | null;
  rects: DOMRect[];
}

export type SelectionCallback = (context: SelectionContext) => void;
export type SelectionClearCallback = () => void;

export class SelectionHandler {
  private onSelect: SelectionCallback | null = null;
  private onClear: SelectionClearCallback | null = null;
  private lastSelectionText = '';
  private isOurComponent = false;
  private activeInputElement: HTMLTextAreaElement | HTMLInputElement | null = null;
  private checkSelectionTimeout: number | null = null;

  constructor() {
    this.setupListeners();
  }

  setOnSelect(callback: SelectionCallback): void {
    this.onSelect = callback;
  }

  setOnClear(callback: SelectionClearCallback): void {
    this.onClear = callback;
  }

  private setupListeners(): void {
    // Use mouseup as primary trigger for selections
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
    // Also listen for selectionchange for keyboard-based selections
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  private handleFocusIn(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      this.activeInputElement = target;
    }
  }

  private handleFocusOut(e: FocusEvent): void {
    // Delay clearing to allow mouseup to capture selection first
    setTimeout(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLTextAreaElement) && !(active instanceof HTMLInputElement)) {
        this.activeInputElement = null;
      }
    }, 150);
  }

  private handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    // Check if clicking inside our components
    this.isOurComponent = target.closest('.aurora-widget-container, .aurora-selection-trigger, .aurora-transform-popover') !== null;

    // Clear selection state when clicking elsewhere
    if (!this.isOurComponent) {
      // Don't clear immediately - wait to see if a new selection is made
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    // Clear any pending check
    if (this.checkSelectionTimeout) {
      clearTimeout(this.checkSelectionTimeout);
    }

    // Small delay to let the selection settle
    this.checkSelectionTimeout = window.setTimeout(() => {
      this.checkAllSelections();
    }, 50);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    // Check for selection on Shift+Arrow keys (common selection method)
    if (e.shiftKey && (e.key.includes('Arrow') || e.key === 'Home' || e.key === 'End')) {
      if (this.checkSelectionTimeout) {
        clearTimeout(this.checkSelectionTimeout);
      }
      this.checkSelectionTimeout = window.setTimeout(() => {
        this.checkAllSelections();
      }, 50);
    }
  }

  private handleSelectionChange(): void {
    // Debounce selection changes
    if (this.checkSelectionTimeout) {
      clearTimeout(this.checkSelectionTimeout);
    }
    this.checkSelectionTimeout = window.setTimeout(() => {
      this.checkAllSelections();
    }, 150);
  }

  private checkAllSelections(): void {
    // First check input/textarea selection
    if (this.activeInputElement) {
      const inputResult = this.checkInputSelection();
      if (inputResult) return; // Found input selection, don't check window selection
    }

    // Then check window selection (for contenteditable and regular text)
    this.checkWindowSelection();
  }

  private checkInputSelection(): boolean {
    if (!this.activeInputElement) return false;

    const element = this.activeInputElement;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;

    if (start === end) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return false;
    }

    const text = element.value.substring(start, end).trim();

    if (text.length < 3) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return false;
    }

    if (text === this.lastSelectionText) {
      return true; // Same selection, don't trigger again
    }

    this.lastSelectionText = text;

    // Get position for the selection in the input
    const rects = this.getInputSelectionRects(element, start, end);

    const context: SelectionContext = {
      text,
      range: document.createRange(),
      isEditable: true,
      editableElement: element,
      rects,
    };

    this.onSelect?.(context);
    return true;
  }

  private getInputSelectionRects(element: HTMLTextAreaElement | HTMLInputElement, start: number, end: number): DOMRect[] {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    // For textarea, try to calculate more accurate position
    if (element instanceof HTMLTextAreaElement) {
      // Create a mirror div to measure text
      const mirror = document.createElement('div');
      mirror.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        white-space: pre-wrap;
        word-wrap: break-word;
        visibility: hidden;
        font: ${computedStyle.font};
        padding: ${computedStyle.padding};
        border: ${computedStyle.border};
        width: ${element.clientWidth}px;
        line-height: ${computedStyle.lineHeight};
      `;

      // Add text up to selection end
      const textBeforeSelection = element.value.substring(0, end);
      mirror.textContent = textBeforeSelection;
      document.body.appendChild(mirror);

      const mirrorHeight = mirror.scrollHeight;
      const lineHeight = parseInt(computedStyle.lineHeight) || 20;
      const lines = Math.ceil(mirrorHeight / lineHeight);

      document.body.removeChild(mirror);

      // Position at bottom-right of textarea or at estimated line position
      const estimatedTop = rect.top + Math.min((lines - 1) * lineHeight, element.clientHeight - lineHeight);

      return [new DOMRect(
        rect.right - 20,
        estimatedTop,
        10,
        lineHeight
      )];
    }

    // For input, position at the right edge
    return [new DOMRect(
      rect.right - 10,
      rect.top,
      10,
      rect.height
    )];
  }

  private checkWindowSelection(): void {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      if (this.lastSelectionText && !this.isOurComponent) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    // Check editable context FIRST - only show trigger for editable content
    const { isEditable, editableElement } = this.getEditableContext(selection);
    if (!isEditable) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    const text = selection.toString().trim();

    if (text.length < 3) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    if (text === this.lastSelectionText) {
      return;
    }

    // Check if selection is inside our components
    const anchorNode = selection.anchorNode;
    if (anchorNode) {
      const parentElement = anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode as HTMLElement;

      if (parentElement?.closest('.aurora-widget-container, .aurora-selection-trigger, .aurora-transform-popover')) {
        return;
      }
    }

    this.lastSelectionText = text;

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());

    if (rects.length === 0) {
      return;
    }

    const context: SelectionContext = {
      text,
      range: range.cloneRange(),
      isEditable,
      editableElement,
      rects,
    };

    this.onSelect?.(context);
  }

  private getEditableContext(selection: Selection): { isEditable: boolean; editableElement: HTMLElement | null } {
    const anchorNode = selection.anchorNode;
    if (!anchorNode) {
      return { isEditable: false, editableElement: null };
    }

    const element = anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : anchorNode as HTMLElement;

    if (!element) {
      return { isEditable: false, editableElement: null };
    }

    // Check for contenteditable
    const contentEditable = element.closest('[contenteditable="true"]') as HTMLElement | null;
    if (contentEditable) {
      return { isEditable: true, editableElement: contentEditable };
    }

    // Check for textarea or input
    const inputElement = element.closest('textarea, input[type="text"], input:not([type])') as HTMLElement | null;
    if (inputElement) {
      return { isEditable: true, editableElement: inputElement };
    }

    return { isEditable: false, editableElement: null };
  }

  clearSelection(): void {
    this.lastSelectionText = '';
    window.getSelection()?.removeAllRanges();
  }

  destroy(): void {
    if (this.checkSelectionTimeout) {
      clearTimeout(this.checkSelectionTimeout);
    }
  }
}
