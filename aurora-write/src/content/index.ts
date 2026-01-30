import { TextFieldDetector, type TextFieldInfo } from './detector/text-field-detector';
import { TextareaHandler } from './detector/textarea-handler';
import { ContentEditableHandler } from './detector/contenteditable-handler';
import { OverlayManager } from './overlay/overlay-manager';
import { FloatingWidget } from './widget/floating-widget';
import { SuggestionPopover } from './popover/suggestion-popover';
import { debounce } from '../shared/utils/debounce';
import { addIgnoredWord } from '../shared/utils/storage';
import type { TextIssue, AnalysisResult, IssueCategory } from '../shared/types/analysis';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage } from '../shared/types/messages';

class AuroraWrite {
  private detector: TextFieldDetector;
  private overlayManager: OverlayManager;
  private widget: FloatingWidget;
  private popover: SuggestionPopover;
  private activeFieldId: string | null = null;
  private lastActiveFieldId: string | null = null;
  private pendingAnalysis: Map<string, AbortController> = new Map();
  private handlers: Map<string, TextareaHandler | ContentEditableHandler> = new Map();

  constructor() {
    this.detector = new TextFieldDetector();
    this.overlayManager = new OverlayManager();
    this.widget = new FloatingWidget();
    this.popover = new SuggestionPopover();

    this.setupMessageListener();
    this.setupOverlayEvents();
    this.setupWidgetEvents();
    this.setupPopoverEvents();
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
    }, 500);

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
  }

  private setupPopoverEvents(): void {
    this.popover.setActions({
      onAccept: (issue) => this.acceptSuggestion(issue),
      onIgnore: (issue) => this.ignoreIssue(issue),
      onIgnoreAll: (issue) => this.ignoreAllSimilar(issue),
    });
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

    this.overlayManager.replaceText(fieldId, issue);

    const field = this.detector.getFieldById(fieldId);
    if (field) {
      setTimeout(() => this.analyzeField(field), 100);
    }
  }

  private ignoreIssue(issue: TextIssue): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    console.log('[AuroraWrite] ignoreIssue called:', issue.id, 'fieldId:', fieldId);
    if (!fieldId) {
      console.log('[AuroraWrite] No field ID, cannot ignore');
      return;
    }

    this.overlayManager.ignoreIssue(fieldId, issue.id);
    const updatedIssues = this.overlayManager.getIssuesForField(fieldId);
    console.log('[AuroraWrite] Updated issues after ignore:', updatedIssues.map(i => ({ id: i.id, ignored: i.ignored })));
    this.widget.update(updatedIssues);
  }

  private async ignoreAllSimilar(issue: TextIssue): Promise<void> {
    await addIgnoredWord(issue.originalText);

    for (const field of this.detector.getAllFields()) {
      const issues = this.overlayManager.getIssuesForField(field.id);
      for (const i of issues) {
        if (i.originalText.toLowerCase() === issue.originalText.toLowerCase()) {
          this.overlayManager.ignoreIssue(field.id, i.id);
        }
      }
    }

    if (this.activeFieldId) {
      this.widget.update(this.overlayManager.getIssuesForField(this.activeFieldId));
    }
  }

  destroy(): void {
    this.detector.stop();
    this.overlayManager.destroy();
    this.widget.destroy();
    this.popover.destroy();

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
