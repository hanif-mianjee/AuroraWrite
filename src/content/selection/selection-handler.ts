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
  private debouncedHandleSelection: () => void;
  private lastSelectionText = '';
  private isOurComponent = false;
  private activeInputElement: HTMLTextAreaElement | HTMLInputElement | null = null;

  constructor() {
    this.debouncedHandleSelection = debounce(() => this.handleSelection(), 200);
    this.setupListeners();
  }

  setOnSelect(callback: SelectionCallback): void {
    this.onSelect = callback;
  }

  setOnClear(callback: SelectionClearCallback): void {
    this.onClear = callback;
  }

  private setupListeners(): void {
    console.log('[AuroraWrite] SelectionHandler.setupListeners - adding event listeners');
    document.addEventListener('selectionchange', this.debouncedHandleSelection);
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
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
    }, 100);
  }

  private handleMouseUp(e: MouseEvent): void {
    // Check for input/textarea selection after mouse up
    if (this.activeInputElement) {
      setTimeout(() => this.checkInputSelection(), 10);
    }
  }

  private checkInputSelection(): void {
    if (!this.activeInputElement) return;

    const element = this.activeInputElement;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;

    if (start === end) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    const text = element.value.substring(start, end).trim();
    console.log('[AuroraWrite] Input selection detected:', text.substring(0, 30));

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

    this.lastSelectionText = text;

    // Get position for the selection in the input
    const rects = this.getInputSelectionRects(element, start, end);
    console.log('[AuroraWrite] Input selection rects:', rects.length);

    const context: SelectionContext = {
      text,
      range: document.createRange(), // Placeholder range
      isEditable: true,
      editableElement: element,
      rects,
    };

    console.log('[AuroraWrite] Calling onSelect for input selection');
    this.onSelect?.(context);
  }

  private getInputSelectionRects(element: HTMLTextAreaElement | HTMLInputElement, start: number, end: number): DOMRect[] {
    // Create a temporary mirror element to measure text position
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);

    // For simplicity, position the trigger at the end of the input/textarea
    // Creating a rect at the selection end position
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
      width: ${element.offsetWidth}px;
    `;

    const textBefore = element.value.substring(0, end);
    mirror.textContent = textBefore;
    document.body.appendChild(mirror);

    const span = document.createElement('span');
    span.textContent = element.value.substring(start, end) || '.';
    mirror.textContent = element.value.substring(0, start);
    mirror.appendChild(span);

    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(mirror);

    // Calculate the actual position relative to the input
    const scrollLeft = element.scrollLeft || 0;
    const scrollTop = element.scrollTop || 0;

    // Create a simplified rect at the end of the selection
    const selectionRect = new DOMRect(
      rect.left + Math.min(spanRect.width, element.offsetWidth - 20),
      rect.top + (element instanceof HTMLTextAreaElement ? Math.min(spanRect.height, element.offsetHeight - 10) : 0),
      10,
      parseInt(computedStyle.lineHeight) || 20
    );

    return [selectionRect];
  }

  private handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    // Check if clicking inside our components (shadow DOM containers)
    this.isOurComponent = target.closest('.aurora-widget-container, .aurora-selection-trigger, .aurora-transform-popover') !== null;
  }

  private handleSelection(): void {
    console.log('[AuroraWrite] SelectionHandler.handleSelection called');
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      console.log('[AuroraWrite] No selection or collapsed');
      if (this.lastSelectionText && !this.isOurComponent) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    const text = selection.toString().trim();
    console.log('[AuroraWrite] Selection text:', text.substring(0, 50));

    // Filter: minimum 3 characters
    if (text.length < 3) {
      if (this.lastSelectionText) {
        this.lastSelectionText = '';
        this.onClear?.();
      }
      return;
    }

    // Avoid re-triggering for the same selection
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
    console.log('[AuroraWrite] Selection rects:', rects.length);

    // Determine if selection is in an editable element
    const { isEditable, editableElement } = this.getEditableContext(selection);
    console.log('[AuroraWrite] Selection isEditable:', isEditable);

    const context: SelectionContext = {
      text,
      range: range.cloneRange(),
      isEditable,
      editableElement,
      rects,
    };

    console.log('[AuroraWrite] Calling onSelect callback');
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
    document.removeEventListener('selectionchange', this.debouncedHandleSelection);
    // Note: Other bound listeners can't be easily removed, but they're on document so it's fine
  }
}
