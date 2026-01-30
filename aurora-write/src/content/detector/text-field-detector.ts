export type TextFieldElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

export interface TextFieldInfo {
  element: TextFieldElement;
  type: 'textarea' | 'input' | 'contenteditable';
  id: string;
}

export class TextFieldDetector {
  private observer: MutationObserver | null = null;
  private trackedFields: Map<string, TextFieldInfo> = new Map();
  private onFieldAdded: ((field: TextFieldInfo) => void) | null = null;
  private onFieldRemoved: ((field: TextFieldInfo) => void) | null = null;
  private fieldCounter = 0;

  start(
    onFieldAdded: (field: TextFieldInfo) => void,
    onFieldRemoved: (field: TextFieldInfo) => void
  ): void {
    this.onFieldAdded = onFieldAdded;
    this.onFieldRemoved = onFieldRemoved;

    this.scanDocument(document);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            this.scanDocument(node);
          }
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            this.handleRemovedNode(node);
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.trackedFields.clear();
  }

  private scanDocument(root: Document | HTMLElement): void {
    const textareas = root.querySelectorAll('textarea');
    textareas.forEach((el) => this.trackField(el as HTMLTextAreaElement, 'textarea'));

    const inputs = root.querySelectorAll('input[type="text"], input:not([type])');
    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      if (this.isTextInput(input)) {
        this.trackField(input, 'input');
      }
    });

    const editables = root.querySelectorAll('[contenteditable="true"]');
    editables.forEach((el) => this.trackField(el as HTMLElement, 'contenteditable'));

    if (root instanceof HTMLElement) {
      this.scanShadowRoots(root);
    }
  }

  private scanShadowRoots(root: HTMLElement): void {
    const elements = root.querySelectorAll('*');
    elements.forEach((el) => {
      if (el.shadowRoot && el.shadowRoot.mode === 'open') {
        this.scanDocument(el.shadowRoot as unknown as HTMLElement);
      }
    });
  }

  private isTextInput(input: HTMLInputElement): boolean {
    const type = input.type.toLowerCase();
    return type === 'text' || type === '' || type === 'search' || type === 'url' || type === 'email';
  }

  private trackField(
    element: TextFieldElement,
    type: 'textarea' | 'input' | 'contenteditable'
  ): void {
    let id = element.getAttribute('data-aurora-id');
    if (id && this.trackedFields.has(id)) {
      return;
    }

    id = `aurora_field_${this.fieldCounter++}`;
    element.setAttribute('data-aurora-id', id);

    const fieldInfo: TextFieldInfo = { element, type, id };
    this.trackedFields.set(id, fieldInfo);

    if (this.onFieldAdded) {
      this.onFieldAdded(fieldInfo);
    }
  }

  private handleRemovedNode(node: HTMLElement): void {
    const id = node.getAttribute?.('data-aurora-id');
    if (id) {
      const field = this.trackedFields.get(id);
      if (field && this.onFieldRemoved) {
        this.onFieldRemoved(field);
      }
      this.trackedFields.delete(id);
    }

    const descendants = node.querySelectorAll?.('[data-aurora-id]');
    descendants?.forEach((el) => {
      const descId = el.getAttribute('data-aurora-id');
      if (descId) {
        const field = this.trackedFields.get(descId);
        if (field && this.onFieldRemoved) {
          this.onFieldRemoved(field);
        }
        this.trackedFields.delete(descId);
      }
    });
  }

  getFieldById(id: string): TextFieldInfo | undefined {
    return this.trackedFields.get(id);
  }

  getAllFields(): TextFieldInfo[] {
    return Array.from(this.trackedFields.values());
  }
}
