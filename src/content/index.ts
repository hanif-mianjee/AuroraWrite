import { TextFieldDetector, type TextFieldInfo } from './detector/text-field-detector';
import { TextareaHandler } from './detector/textarea-handler';
import { ContentEditableHandler } from './detector/contenteditable-handler';
import { OverlayManager } from './overlay/overlay-manager';
import { FloatingWidget } from './widget/floating-widget';
import { SuggestionPopover } from './popover/suggestion-popover';
import { SelectionHandler, SelectionTrigger, TransformPopover, type SelectionContext } from './selection';
import { debounce } from '../shared/utils/debounce';
import { addIgnoredWord } from '../shared/utils/storage';
import type { TextIssue, AnalysisResult, IssueCategory } from '../shared/types/analysis';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage, TransformResultMessage, TransformErrorMessage, TransformationType } from '../shared/types/messages';

class AuroraWrite {
  private detector: TextFieldDetector;
  private overlayManager: OverlayManager;
  private widget: FloatingWidget;
  private popover: SuggestionPopover;
  private selectionHandler: SelectionHandler;
  private selectionTrigger: SelectionTrigger;
  private transformPopover: TransformPopover;
  private activeFieldId: string | null = null;
  private lastActiveFieldId: string | null = null;
  private pendingAnalysis: Map<string, AbortController> = new Map();
  private handlers: Map<string, TextareaHandler | ContentEditableHandler> = new Map();
  private currentSelectionContext: SelectionContext | null = null;
  private pendingTransformRequestId: string | null = null;

  constructor() {
    this.detector = new TextFieldDetector();
    this.overlayManager = new OverlayManager();
    this.widget = new FloatingWidget();
    this.popover = new SuggestionPopover();
    this.selectionHandler = new SelectionHandler();
    this.selectionTrigger = new SelectionTrigger();
    this.transformPopover = new TransformPopover();

    this.setupMessageListener();
    this.setupOverlayEvents();
    this.setupWidgetEvents();
    this.setupPopoverEvents();
    this.setupSelectionEvents();
  }

  start(): void {
    this.detector.start(
      (field) => this.onFieldAdded(field),
      (field) => this.onFieldRemoved(field)
    );
  }

  private onFieldAdded(field: TextFieldInfo): void {
    console.log('[AuroraWrite] Field detected:', field.type, field.id);
    this.overlayManager.createOverlay(field);

    const handler = field.type === 'contenteditable'
      ? new ContentEditableHandler(field.element as HTMLElement)
      : new TextareaHandler(field.element as HTMLTextAreaElement | HTMLInputElement);

    this.handlers.set(field.id, handler);

    field.element.addEventListener('focus', () => this.onFieldFocus(field));
    field.element.addEventListener('blur', () => this.onFieldBlur(field));
    field.element.addEventListener('input', this.createInputHandler(field));
  }

  private onFieldRemoved(field: TextFieldInfo): void {
    this.overlayManager.removeOverlay(field.id);
    this.handlers.get(field.id)?.destroy();
    this.handlers.delete(field.id);

    if (this.activeFieldId === field.id) {
      this.widget.hide();
      this.popover.hide();
      this.activeFieldId = null;
    }
  }

  private onFieldFocus(field: TextFieldInfo): void {
    console.log('[AuroraWrite] Field focused:', field.id);
    this.activeFieldId = field.id;
    this.lastActiveFieldId = field.id;
    const issues = this.overlayManager.getIssuesForField(field.id);
    this.widget.show(field.element, issues);

    // Trigger initial analysis if field has content
    const handler = this.handlers.get(field.id);
    if (handler) {
      const text = handler.getText();
      if (text.length >= 10) {
        this.analyzeField(field);
      }
    }
  }

  private onFieldBlur(field: TextFieldInfo): void {
    setTimeout(() => {
      // Don't hide if user is interacting with the widget or popover is visible
      if (this.widget.isUserInteracting() || this.popover.isVisible()) {
        return;
      }
      if (this.activeFieldId === field.id) {
        this.widget.hide();
        this.activeFieldId = null;
      }
    }, 200);
  }

  private createInputHandler(field: TextFieldInfo): () => void {
    const debouncedAnalyze = debounce(() => {
      this.analyzeField(field);
    }, 2000); // 2 second debounce to reduce API calls

    return debouncedAnalyze;
  }

  private async analyzeField(field: TextFieldInfo): Promise<void> {
    const handler = this.handlers.get(field.id);
    if (!handler) return;

    const text = handler.getText();
    console.log('[AuroraWrite] Analyzing field:', field.id, 'text length:', text.length);

    if (!text.trim() || text.length < 10) {
      this.overlayManager.updateAnalysis(field.id, { text, issues: [], timestamp: Date.now() });
      this.widget.update([]);
      return;
    }

    const existing = this.pendingAnalysis.get(field.id);
    if (existing) {
      existing.abort();
    }

    const controller = new AbortController();
    this.pendingAnalysis.set(field.id, controller);

    // Show loading state
    this.widget.showLoading(field.element);

    try {
      console.log('[AuroraWrite] Sending analysis request to background');
      chrome.runtime.sendMessage({
        type: 'ANALYZE_TEXT',
        payload: { text, fieldId: field.id },
      });
    } catch (error) {
      console.error('[AuroraWrite] Failed to send analysis request:', error);
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message: Message) => {
      switch (message.type) {
        case 'ANALYSIS_RESULT':
          this.handleAnalysisResult(message as AnalysisResultMessage);
          break;
        case 'ANALYSIS_ERROR':
          this.handleAnalysisError(message as AnalysisErrorMessage);
          break;
        case 'TRANSFORM_RESULT':
          this.handleTransformResult(message as TransformResultMessage);
          break;
        case 'TRANSFORM_ERROR':
          this.handleTransformError(message as TransformErrorMessage);
          break;
      }
    });
  }

  private handleAnalysisResult(message: AnalysisResultMessage): void {
    const { fieldId, result } = message.payload;

    this.pendingAnalysis.delete(fieldId);
    this.overlayManager.updateAnalysis(fieldId, result);

    if (this.activeFieldId === fieldId) {
      this.widget.update(result.issues);
    }
  }

  private handleAnalysisError(message: AnalysisErrorMessage): void {
    const { fieldId, error } = message.payload;
    this.pendingAnalysis.delete(fieldId);
    console.error(`[AuroraWrite] Analysis error for field ${fieldId}:`, error);

    // Show error in widget
    if (this.activeFieldId === fieldId) {
      const field = this.detector.getFieldById(fieldId);
      if (field) {
        this.widget.showError(field.element, error);
      }
    }
  }

  private setupOverlayEvents(): void {
    this.overlayManager.setOnIssueClick((issue, fieldId) => {
      console.log('[AuroraWrite] Issue click received:', issue.id, 'field:', fieldId);
      this.showPopoverForIssue(issue, fieldId);
    });
  }

  private setupWidgetEvents(): void {
    this.widget.setOnCategoryClick((category: IssueCategory) => {
      if (!this.activeFieldId) return;

      const issues = this.overlayManager.getIssuesForField(this.activeFieldId);
      const firstIssue = issues.find((i) => i.category === category && !i.ignored);

      if (firstIssue) {
        this.showPopoverForIssue(firstIssue, this.activeFieldId);
      }
    });

    this.widget.setOnAcceptAllSpelling(() => {
      this.acceptAllSpelling();
    });
  }

  private acceptAllSpelling(): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (!fieldId) return;

    const issues = this.overlayManager.getIssuesForField(fieldId);
    const spellingIssues = issues
      .filter(i => i.category === 'spelling' && !i.ignored)
      .sort((a, b) => b.startOffset - a.startOffset); // Sort by offset descending to apply from end

    if (spellingIssues.length === 0) return;

    console.log('[AuroraWrite] Accepting all spelling issues:', spellingIssues.length);

    // Apply fixes from end to start to preserve offsets
    for (const issue of spellingIssues) {
      this.overlayManager.removeIssue(fieldId, issue.id);
      this.overlayManager.replaceText(fieldId, issue);
    }

    // Update widget with remaining issues
    const remainingIssues = this.overlayManager.getIssuesForField(fieldId);
    this.widget.update(remainingIssues);
  }

  private setupPopoverEvents(): void {
    this.popover.setActions({
      onAccept: (issue) => this.acceptSuggestion(issue),
      onIgnore: (issue) => this.ignoreIssue(issue),
      onIgnoreAll: (issue) => this.ignoreAllSimilar(issue),
    });
  }

  private setupSelectionEvents(): void {
    console.log('[AuroraWrite] Setting up selection events');
    this.selectionHandler.setOnSelect((context) => {
      console.log('[AuroraWrite] onSelect callback fired, text:', context.text.substring(0, 30));
      // Don't show trigger if transform popover is visible
      if (this.transformPopover.isVisible()) {
        console.log('[AuroraWrite] Transform popover visible, not showing trigger');
        return;
      }
      this.currentSelectionContext = context;
      console.log('[AuroraWrite] Calling selectionTrigger.show');
      this.selectionTrigger.show(context.rects);
    });

    this.selectionHandler.setOnClear(() => {
      // Don't hide if transform popover is visible
      if (!this.transformPopover.isVisible()) {
        this.selectionTrigger.hide();
        this.currentSelectionContext = null;
      }
    });

    this.selectionTrigger.setOnClick(() => {
      if (this.currentSelectionContext) {
        this.selectionTrigger.hide();
        this.transformPopover.show(this.currentSelectionContext.text, this.currentSelectionContext.rects);
      }
    });

    this.transformPopover.setCallbacks({
      onTransform: (type, customPrompt) => this.requestTransform(type, customPrompt),
      onAccept: (transformedText) => this.acceptTransform(transformedText),
      onCancel: () => this.cancelTransform(),
    });
  }

  private requestTransform(type: TransformationType, customPrompt?: string): void {
    if (!this.currentSelectionContext) return;

    const requestId = `transform_${Date.now()}`;
    this.pendingTransformRequestId = requestId;

    chrome.runtime.sendMessage({
      type: 'TRANSFORM_TEXT',
      payload: {
        text: this.currentSelectionContext.text,
        transformationType: type,
        customPrompt,
        requestId,
      },
    });
  }

  private handleTransformResult(message: TransformResultMessage): void {
    const { requestId, transformedText } = message.payload;

    if (requestId !== this.pendingTransformRequestId) {
      return;
    }

    this.transformPopover.updateWithResult(transformedText);
  }

  private handleTransformError(message: TransformErrorMessage): void {
    const { requestId, error } = message.payload;

    if (requestId !== this.pendingTransformRequestId) {
      return;
    }

    this.transformPopover.updateWithError(error);
  }

  private acceptTransform(transformedText: string): void {
    if (!this.currentSelectionContext) {
      this.transformPopover.hide();
      return;
    }

    const { isEditable, editableElement, range } = this.currentSelectionContext;

    if (isEditable && editableElement) {
      this.replaceSelectionText(editableElement, range, transformedText);
    }

    this.transformPopover.hide();
    this.selectionHandler.clearSelection();
    this.currentSelectionContext = null;
    this.pendingTransformRequestId = null;
  }

  private cancelTransform(): void {
    this.transformPopover.hide();
    this.selectionHandler.clearSelection();
    this.currentSelectionContext = null;
    this.pendingTransformRequestId = null;
  }

  private replaceSelectionText(element: HTMLElement, range: Range, newText: string): void {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      // For textarea/input, use value manipulation
      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? 0;
      const value = element.value;
      element.value = value.substring(0, start) + newText + value.substring(end);
      element.selectionStart = element.selectionEnd = start + newText.length;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // For contenteditable, use Range API
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        currentRange.deleteContents();
        currentRange.insertNode(document.createTextNode(newText));
        currentRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(currentRange);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  private showPopoverForIssue(issue: TextIssue, fieldId: string): void {
    console.log('[AuroraWrite] showPopoverForIssue called:', issue.originalText);
    const field = this.detector.getFieldById(fieldId);
    if (!field) {
      console.log('[AuroraWrite] Field not found');
      return;
    }

    const handler = this.handlers.get(fieldId);
    if (!handler) {
      console.log('[AuroraWrite] Handler not found');
      return;
    }

    const text = handler.getText();
    const positions = handler.getTextPositions(text, issue.startOffset, issue.endOffset);
    console.log('[AuroraWrite] Positions:', positions);

    if (positions.rects.length > 0) {
      console.log('[AuroraWrite] Showing popover at:', positions.rects[0]);
      this.popover.show(issue, positions.rects[0]);
    } else {
      console.log('[AuroraWrite] No rects found for popover positioning');
    }
  }

  private acceptSuggestion(issue: TextIssue): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    console.log('[AuroraWrite] acceptSuggestion called, fieldId:', fieldId);
    if (!fieldId) {
      console.log('[AuroraWrite] No field ID for accept');
      return;
    }

    // Remove the issue from overlay IMMEDIATELY (before text replacement)
    // This removes the underline instantly
    this.overlayManager.removeIssue(fieldId, issue.id);
    this.popover.hide();

    // Now replace the text
    this.overlayManager.replaceText(fieldId, issue);

    // Update widget with remaining issues
    const remainingIssues = this.overlayManager.getIssuesForField(fieldId);
    this.widget.update(remainingIssues);

    // Don't manually re-analyze - the input event will trigger the debounced analysis
  }

  private ignoreIssue(issue: TextIssue): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    console.log('[AuroraWrite] ignoreIssue called:', issue.id, 'fieldId:', fieldId);
    if (!fieldId) {
      console.log('[AuroraWrite] No field ID, cannot ignore');
      return;
    }

    // Hide popover first
    this.popover.hide();

    // Remove the issue from overlay (removes underline immediately)
    this.overlayManager.removeIssue(fieldId, issue.id);

    // Update widget with remaining issues
    const updatedIssues = this.overlayManager.getIssuesForField(fieldId);
    this.widget.update(updatedIssues);
  }

  private async ignoreAllSimilar(issue: TextIssue): Promise<void> {
    // Hide popover first
    this.popover.hide();

    await addIgnoredWord(issue.originalText);

    // Remove all similar issues from all fields (removes underlines immediately)
    for (const field of this.detector.getAllFields()) {
      const issues = this.overlayManager.getIssuesForField(field.id);
      for (const i of issues) {
        if (i.originalText.toLowerCase() === issue.originalText.toLowerCase()) {
          this.overlayManager.removeIssue(field.id, i.id);
        }
      }
    }

    // Update widget with remaining issues
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (fieldId) {
      this.widget.update(this.overlayManager.getIssuesForField(fieldId));
    }
  }

  destroy(): void {
    this.detector.stop();
    this.overlayManager.destroy();
    this.widget.destroy();
    this.popover.destroy();
    this.selectionHandler.destroy();
    this.selectionTrigger.destroy();
    this.transformPopover.destroy();

    for (const handler of this.handlers.values()) {
      handler.destroy();
    }
    this.handlers.clear();
  }
}

console.log('[AuroraWrite] Content script loaded');

const aurora = new AuroraWrite();
aurora.start();

console.log('[AuroraWrite] Started');
