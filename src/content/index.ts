import { TextFieldDetector, type TextFieldInfo } from './detector/text-field-detector';
import { TextareaHandler } from './detector/textarea-handler';
import { ContentEditableHandler } from './detector/contenteditable-handler';
import { OverlayManager } from './overlay/overlay-manager';
import { FloatingWidget } from './widget/floating-widget';
import { SuggestionPopover } from './popover/suggestion-popover';
import { SelectionHandler, SelectionTrigger, TransformPopover, type SelectionContext } from './selection';
import { debounce } from '../shared/utils/debounce';
import { addIgnoredWord, addIgnoredDomain, isDomainIgnored } from '../shared/utils/storage';
import { performanceLogger } from '../shared/utils/performance';
import { blockAnalyzer, stabilityPassManager } from '../ai';
import { inputTextStore } from '../state';
import type { TextIssue, AnalysisResult, IssueCategory } from '../shared/types/analysis';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage, TransformResultMessage, TransformErrorMessage, TransformationType, BlockResultMessage, BlockErrorMessage, VerifyResultMessage, VerifyErrorMessage } from '../shared/types/messages';

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
  private sessionIgnoredIssues: Map<string, Set<string>> = new Map();
  private lastAnalysisTime: Map<string, number> = new Map(); // Track when analysis was last run
  private postFixVerificationTimer: Map<string, ReturnType<typeof setTimeout>> = new Map(); // Delayed verification after last fix
  private appliedFixCategories: Map<string, Set<IssueCategory>> = new Map(); // Track categories of fixes applied
  private suppressInputAnalysis: Map<string, number> = new Map(); // Temporarily suppress input-triggered analysis after applying fix

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
      // Skip if analysis was just triggered (within last 800ms)
      // This prevents duplicate analysis after accepting last suggestion
      // Must be > 700ms (debounce time) to catch the debounced call
      const lastTime = this.lastAnalysisTime.get(field.id);
      if (lastTime && Date.now() - lastTime < 800) {
        console.log('[AuroraWrite] Skipping debounced analysis - recent analysis exists');
        return;
      }
      this.analyzeField(field);
    }, 700); // 700ms debounce as per incremental architecture spec

    // Return a handler that also cancels pending post-fix verification
    return () => {
      // Check if we should suppress analysis (just applied a suggestion)
      const suppressUntil = this.suppressInputAnalysis.get(field.id);
      if (suppressUntil && Date.now() < suppressUntil) {
        console.log('[AuroraWrite] Suppressing input analysis - suggestion just applied');
        return;
      }
      this.suppressInputAnalysis.delete(field.id);

      // Cancel any pending post-fix verification - user is typing new content
      this.cancelPostFixVerification(field.id);
      // Clear applied fix categories since user is now typing fresh content
      this.appliedFixCategories.delete(field.id);
      // Trigger the debounced analysis
      debouncedAnalyze();
    };
  }

  private async analyzeField(field: TextFieldInfo): Promise<void> {
    const handler = this.handlers.get(field.id);
    if (!handler) return;

    const text = handler.getText();

    if (!text.trim() || text.length < 10) {
      this.overlayManager.updateAnalysis(field.id, { text, issues: [], timestamp: Date.now() });
      this.widget.update([]);
      return;
    }

    // Record analysis time to prevent duplicate analyses
    this.lastAnalysisTime.set(field.id, Date.now());

    // Cancel any existing analysis, stability pass, and post-fix verification
    blockAnalyzer.cancelAnalysis(field.id);
    stabilityPassManager.cancelStabilityPass(field.id);
    this.cancelPostFixVerification(field.id);
    this.appliedFixCategories.delete(field.id);

    // Start performance tracking
    performanceLogger.startAnalysis(field.id);

    // Show loading state
    this.widget.showLoading(field.element);

    console.log(`[AuroraWrite] Starting analysis for field ${field.id}, text: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);

    try {
      // Use incremental block-based analysis
      const result = blockAnalyzer.analyzeText(field.id, text, {
        onBlockAnalysisStart: (fieldId, blockId) => {
          console.log(`[AuroraWrite] Block analysis started: ${blockId}`);
        },
        onBlockAnalysisComplete: (fieldId, blockId, issues) => {
          console.log(`[AuroraWrite] Block analysis complete: ${blockId}, issues: ${issues.length}`);
          // Update overlay incrementally as each block completes
          const allIssues = inputTextStore.getAllIssues(fieldId);
          this.overlayManager.updateAnalysis(fieldId, {
            text,
            issues: allIssues,
            timestamp: Date.now(),
          });
          if (this.activeFieldId === fieldId) {
            this.widget.update(allIssues);
          }
        },
        onBlockAnalysisError: (fieldId, blockId, error) => {
          console.error(`[AuroraWrite] Block ${blockId} analysis error:`, error);
        },
        onAllBlocksComplete: (fieldId, analysisResult) => {
          console.log(`[AuroraWrite] All blocks complete for field ${fieldId}, total issues: ${analysisResult.issues.length}`);
          this.overlayManager.updateAnalysis(fieldId, analysisResult);
          if (this.activeFieldId === fieldId) {
            this.widget.update(analysisResult.issues);
          }

          // Schedule stability pass to check for newly exposed issues
          this.scheduleStabilityPass(fieldId);
        },
      });

      // Record performance metrics
      performanceLogger.recordAnalysis(
        field.id,
        result.allBlocks.length,
        result.dirtyBlocks.length,
        result.cleanBlocks.length
      );

      // If no dirty blocks, the callback is called synchronously
      if (result.dirtyBlocks.length === 0) {
        console.log('[AuroraWrite] No dirty blocks, using cached analysis');
      } else {
        console.log(`[AuroraWrite] Analyzing ${result.dirtyBlocks.length} dirty blocks out of ${result.allBlocks.length} total`);
      }
    } catch (error) {
      console.error('[AuroraWrite] Failed to start block analysis:', error);
    }
  }

  /**
   * Schedule a stability pass to check for newly exposed issues.
   * This runs after all blocks complete initial analysis.
   */
  private scheduleStabilityPass(fieldId: string): void {
    stabilityPassManager.scheduleStabilityCheck(fieldId, {
      onStabilityPassStart: (fId, blockIds) => {
        console.log(`[AuroraWrite:Stability] Starting stability pass for ${blockIds.length} blocks`);
        performanceLogger.startAnalysis(`${fId}_stability`);
      },
      onBlockVerified: (fId, blockId, newIssues) => {
        console.log(`[AuroraWrite:Stability] Block ${blockId} verified, new issues: ${newIssues.length}`);
      },
      onStabilityPassComplete: (fId, result) => {
        console.log(`[AuroraWrite:Stability] Stability pass complete, total issues: ${result.issues.length}`);
        performanceLogger.recordAnalysis(
          `${fId}_stability`,
          inputTextStore.getState(fId)?.blocks.length || 0,
          0, // Stability pass already counted blocks
          inputTextStore.getState(fId)?.blocks.length || 0
        );
      },
      onStabilityPassCancelled: (fId) => {
        console.log(`[AuroraWrite:Stability] Stability pass cancelled for field ${fId}`);
      },
    });
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
        case 'BLOCK_RESULT':
          this.handleBlockResult(message as BlockResultMessage);
          break;
        case 'BLOCK_ERROR':
          this.handleBlockError(message as BlockErrorMessage);
          break;
        case 'VERIFY_RESULT':
          this.handleVerifyResult(message as VerifyResultMessage);
          break;
        case 'VERIFY_ERROR':
          this.handleVerifyError(message as VerifyErrorMessage);
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

    // Filter out session-ignored issues before updating
    const sessionIgnored = this.sessionIgnoredIssues.get(fieldId);
    if (sessionIgnored && sessionIgnored.size > 0) {
      result.issues = result.issues.filter(
        issue => !sessionIgnored.has(issue.originalText.toLowerCase())
      );
    }

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

  private handleBlockResult(message: BlockResultMessage): void {
    const { fieldId, blockId, issues, requestId } = message.payload;

    // Filter out session-ignored issues
    const sessionIgnored = this.sessionIgnoredIssues.get(fieldId);
    const filteredIssues = sessionIgnored && sessionIgnored.size > 0
      ? issues.filter(issue => !sessionIgnored.has(issue.originalText.toLowerCase()))
      : issues;

    // Delegate to block analyzer with requestId for validation
    blockAnalyzer.handleBlockResult(fieldId, blockId, filteredIssues, requestId);
  }

  private handleBlockError(message: BlockErrorMessage): void {
    const { fieldId, blockId, error } = message.payload;
    console.error(`[AuroraWrite] Block analysis error for field ${fieldId}, block ${blockId}:`, error);

    // Delegate to block analyzer
    blockAnalyzer.handleBlockError(fieldId, blockId, error);
  }

  private handleVerifyResult(message: VerifyResultMessage): void {
    const { fieldId, blockId, issues, requestId } = message.payload;

    // Filter out session-ignored issues
    const sessionIgnored = this.sessionIgnoredIssues.get(fieldId);
    const filteredIssues = sessionIgnored && sessionIgnored.size > 0
      ? issues.filter(issue => !sessionIgnored.has(issue.originalText.toLowerCase()))
      : issues;

    // Check if this is a post-fix verification (bypasses stabilityPassManager)
    const isPostFixVerification = requestId?.startsWith('postfix_');

    if (isPostFixVerification) {
      // Handle post-fix verification directly
      const accepted = inputTextStore.mergeBlockResult(fieldId, blockId, filteredIssues, false, requestId);
      if (accepted) {
        inputTextStore.setBlockAnalyzing(fieldId, blockId, false);
        console.log(`[AuroraWrite] Post-fix verification for block ${blockId}: ${filteredIssues.length} issues`);
      }
    } else {
      // Delegate to stability pass manager with requestId for validation
      stabilityPassManager.handleVerificationResult(fieldId, blockId, filteredIssues, requestId);
    }

    // Update UI with any new issues
    const allIssues = inputTextStore.getAllIssues(fieldId);
    this.overlayManager.updateAnalysis(fieldId, {
      text: inputTextStore.getState(fieldId)?.text || '',
      issues: allIssues,
      timestamp: Date.now(),
    });
    if (this.activeFieldId === fieldId) {
      this.widget.update(allIssues);
    }
  }

  private handleVerifyError(message: VerifyErrorMessage): void {
    const { fieldId, blockId, error } = message.payload;
    console.error(`[AuroraWrite] Verification error for field ${fieldId}, block ${blockId}:`, error);

    // Check if this might be a post-fix verification error
    const state = inputTextStore.getState(fieldId);
    const block = state?.blocks.find(b => b.id === blockId);
    const isPostFixVerification = block?.activeRequestId?.startsWith('postfix_');

    if (isPostFixVerification) {
      // Handle post-fix verification error - just mark block as not analyzing
      inputTextStore.setBlockAnalyzing(fieldId, blockId, false);
      // Show clean state anyway (user fixed all issues, verification just failed)
      this.widget.update([]);
    } else {
      // Delegate to stability pass manager
      stabilityPassManager.handleVerificationError(fieldId, blockId, error);
    }
  }

  private setupOverlayEvents(): void {
    this.overlayManager.setOnIssueClick((issue, fieldId) => {
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

    this.widget.setOnReanalyze(() => {
      this.triggerReanalyze();
    });

    this.widget.setOnToggleDomain(() => {
      this.toggleCurrentDomain();
    });
  }

  private async toggleCurrentDomain(): Promise<void> {
    const domain = window.location.hostname;
    await addIgnoredDomain(domain);
    console.log(`[AuroraWrite] Domain ${domain} added to ignored list`);

    // Destroy the extension for this page
    this.destroy();

    // Show a brief notification (using a simple alert-style notification)
    this.showDomainDisabledNotification(domain);
  }

  private showDomainDisabledNotification(domain: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      z-index: 2147483647;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s, transform 0.3s;
    `;
    notification.textContent = `AuroraWrite disabled for ${domain}`;
    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    });

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  private triggerReanalyze(): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (!fieldId) return;

    console.log('[AuroraWrite] Manual re-analyze triggered');

    // Clear provider cache first to force fresh API call
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, () => {
      console.log('[AuroraWrite] Provider cache cleared');

      // Clear block state to force fresh analysis
      inputTextStore.clearState(fieldId);

      // Trigger analysis
      const field = this.detector.getFieldById(fieldId);
      if (field) {
        this.analyzeField(field);
      }
    });
  }

  private acceptAllSpelling(): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (!fieldId) return;

    const issues = this.overlayManager.getIssuesForField(fieldId);
    const spellingIssues = issues
      .filter(i => i.category === 'spelling' && !i.ignored)
      .sort((a, b) => b.startOffset - a.startOffset); // Sort by offset descending to apply from end

    console.log('[AuroraWrite] acceptAllSpelling - spelling issues:', spellingIssues.length);

    if (spellingIssues.length === 0) return;

    // Cancel any pending stability pass
    stabilityPassManager.cancelStabilityPass(fieldId);

    // Get NON-spelling issues to preserve them (with adjusted offsets)
    const nonSpellingIssues = issues.filter(i => i.category !== 'spelling' && !i.ignored);
    console.log('[AuroraWrite] Preserving non-spelling issues:', nonSpellingIssues.length);

    // Get the current text from the overlay manager
    let text = this.overlayManager.getFieldText(fieldId);
    if (!text) return;

    console.log('[AuroraWrite] Original text:', text);

    // Build list of offset adjustments (spelling issues are already sorted descending)
    const offsetAdjustments: { position: number; delta: number }[] = [];
    for (const issue of spellingIssues) {
      const delta = issue.suggestedText.length - issue.originalText.length;
      offsetAdjustments.push({ position: issue.startOffset, delta });
      console.log('[AuroraWrite] Fixing:', issue.originalText, '->', issue.suggestedText, 'at', issue.startOffset);
      text = text.substring(0, issue.startOffset) + issue.suggestedText + text.substring(issue.endOffset);
    }

    console.log('[AuroraWrite] New text:', text);

    // Adjust offsets for non-spelling issues that come AFTER each spelling fix
    const adjustedNonSpellingIssues = nonSpellingIssues.map(issue => {
      let startOffset = issue.startOffset;
      let endOffset = issue.endOffset;

      // Apply each offset adjustment (sorted descending by position)
      for (const adj of offsetAdjustments) {
        if (issue.startOffset > adj.position) {
          startOffset += adj.delta;
          endOffset += adj.delta;
        }
      }

      return { ...issue, startOffset, endOffset };
    });

    // Suppress input-triggered analysis (prevents spinner from setFieldText triggering input event)
    this.suppressInputAnalysis.set(fieldId, Date.now() + 100);

    // Set the final text in one operation
    this.overlayManager.setFieldText(fieldId, text);

    // CRITICAL: Wait for browser layout reflow before calculating underline positions
    requestAnimationFrame(() => {
      // Update overlay with ONLY the adjusted non-spelling issues (preserves them)
      this.overlayManager.updateAnalysis(fieldId, {
        text,
        issues: adjustedNonSpellingIssues,
        timestamp: Date.now(),
      });
    });

    // Update widget with remaining non-spelling issues
    this.widget.update(adjustedNonSpellingIssues);

    // Update the store with preserved issues
    inputTextStore.clearState(fieldId);
    inputTextStore.updateText(fieldId, text);

    // Add preserved non-spelling issues back to the store blocks
    const state = inputTextStore.getState(fieldId);
    if (state) {
      for (const issue of adjustedNonSpellingIssues) {
        for (const block of state.blocks) {
          if (issue.startOffset >= block.startOffset && issue.startOffset < block.endOffset) {
            block.issues.push({
              ...issue,
              source: issue.source || 'analysis',
              status: issue.status || 'new',
            });
            block.hasUnappliedIssues = true;
            break;
          }
        }
      }
    }

    // Record performance metric
    performanceLogger.recordSuggestionAcceptance(fieldId);

    // Track that spelling was fixed (for smart verification)
    if (!this.appliedFixCategories.has(fieldId)) {
      this.appliedFixCategories.set(fieldId, new Set());
    }
    this.appliedFixCategories.get(fieldId)!.add('spelling');

    // If no non-spelling issues remain, schedule post-fix verification
    // to catch grammar/clarity issues revealed by spelling fixes
    if (adjustedNonSpellingIssues.length === 0) {
      console.log('[AuroraWrite] All issues fixed, scheduling post-fix verification');
      this.schedulePostFixVerification(fieldId);
    } else {
      // There are still non-spelling issues - no need to verify yet
      // User will likely address those, triggering verification after the last one
      console.log('[AuroraWrite] Non-spelling issues remain, skipping verification');
    }
  }

  private setupPopoverEvents(): void {
    this.popover.setActions({
      onAccept: (issue) => this.acceptSuggestion(issue),
      onIgnore: (issue) => this.ignoreIssue(issue),
      onIgnoreAll: (issue) => this.ignoreAllSimilar(issue),
    });
  }

  private setupSelectionEvents(): void {
    this.selectionHandler.setOnSelect((context) => {
      // Don't show trigger if transform popover is visible
      if (this.transformPopover.isVisible()) {
        return;
      }
      this.currentSelectionContext = context;
      this.selectionTrigger.show(context.rects, context.editableElement);
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
        this.transformPopover.show(
          this.currentSelectionContext.text,
          this.currentSelectionContext.rects,
          this.currentSelectionContext.editableElement
        );
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
    const field = this.detector.getFieldById(fieldId);
    if (!field) {
      return;
    }

    const handler = this.handlers.get(fieldId);
    if (!handler) {
      return;
    }

    const text = handler.getText();
    const positions = handler.getTextPositions(text, issue.startOffset, issue.endOffset);

    if (positions.rects.length > 0) {
      this.popover.show(issue, positions.rects[0]);
    } else {
    }
  }

  private acceptSuggestion(issue: TextIssue): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (!fieldId) {
      return;
    }

    // Cancel any pending stability pass and post-fix verification - user is actively making changes
    stabilityPassManager.cancelStabilityPass(fieldId);
    this.cancelPostFixVerification(fieldId);

    // Track the category of applied fix (for smart verification decisions)
    if (!this.appliedFixCategories.has(fieldId)) {
      this.appliedFixCategories.set(fieldId, new Set());
    }
    this.appliedFixCategories.get(fieldId)!.add(issue.category);

    // Remove the issue from overlay IMMEDIATELY (before text replacement)
    // This removes the underline instantly
    this.overlayManager.removeIssue(fieldId, issue.id);
    this.popover.hide();

    // Suppress input-triggered analysis for 100ms (prevents spinner from replaceText triggering input event)
    this.suppressInputAnalysis.set(fieldId, Date.now() + 100);

    // DEBUG: Log the issue being fixed
    console.log(`[AuroraWrite:DEBUG] Fixing issue: "${issue.originalText}" -> "${issue.suggestedText}" at offset ${issue.startOffset}-${issue.endOffset}`);

    // Replace the text in the DOM FIRST
    this.overlayManager.replaceText(fieldId, issue);

    // Get the new text from DOM after replacement
    const handler = this.handlers.get(fieldId);
    if (!handler) return;
    const newText = handler.getText();

    // DEBUG: Log before applyLocalChange
    const beforeIssues = inputTextStore.getAllIssues(fieldId);
    console.log(`[AuroraWrite:DEBUG] Before applyLocalChange - ${beforeIssues.length} issues:`,
      beforeIssues.map(i => `"${i.originalText}" at ${i.startOffset}-${i.endOffset}`));

    // Use applyLocalChange to handle all offset adjustments correctly
    // This removes the issue AND adjusts all remaining issue offsets in one operation
    inputTextStore.applyLocalChange(fieldId, issue, newText);

    // Get remaining issues with CORRECT offsets
    const remainingIssues = inputTextStore.getAllIssues(fieldId);

    // DEBUG: Log after applyLocalChange
    console.log(`[AuroraWrite:DEBUG] After applyLocalChange - ${remainingIssues.length} issues:`,
      remainingIssues.map(i => `"${i.originalText}" at ${i.startOffset}-${i.endOffset}`));
    const isLastSuggestion = remainingIssues.length === 0;

    // Record that we avoided an API call
    performanceLogger.recordSuggestionAcceptance(fieldId);

    // CRITICAL: Wait for browser layout reflow before calculating underline positions
    // Without this, positions are calculated before DOM has updated, causing misalignment
    requestAnimationFrame(() => {
      // Update overlay with adjusted issues so underlines render at correct positions
      this.overlayManager.updateAnalysis(fieldId, {
        text: newText,
        issues: remainingIssues,
        timestamp: Date.now(),
      });
    });

    // Update widget with remaining issues (shows "All Fixed" if empty)
    this.widget.update(remainingIssues);

    if (isLastSuggestion) {
      // This was the last suggestion - show "All Fixed" immediately (already done by widget.update)
      console.log('[AuroraWrite] Last suggestion applied, showing clean state immediately');

      // Get the categories that were fixed in this session
      const fixedCategories = this.appliedFixCategories.get(fieldId) || new Set();
      const needsVerification = fixedCategories.has('spelling') || fixedCategories.has('grammar');

      if (needsVerification) {
        // Schedule delayed verification (1.5s) to catch cascading issues
        // e.g., fixing spelling might reveal grammar issues
        console.log('[AuroraWrite] Scheduling delayed verification for cascading issues');
        this.schedulePostFixVerification(fieldId);
      } else {
        // Style/clarity/tone/rephrase fixes rarely cause cascading issues
        console.log('[AuroraWrite] No verification needed - only style/tone fixes applied');
        // Clear state for future analysis but don't trigger immediate re-analysis
        inputTextStore.clearState(fieldId);
        this.appliedFixCategories.delete(fieldId);
      }
    }
    // NOTE: Don't schedule stability pass here - we only verify after ALL fixes are applied
    // This saves API calls when user is rapidly accepting suggestions
  }

  /**
   * Schedule a delayed verification pass after all suggestions are applied.
   * Uses lighter VERIFY_BLOCK instead of full ANALYZE_BLOCK.
   * Only runs if spelling/grammar fixes were applied (which can reveal cascading issues).
   */
  private schedulePostFixVerification(fieldId: string): void {
    const POST_FIX_VERIFICATION_DELAY = 1500; // 1.5 seconds

    const timer = setTimeout(() => {
      this.postFixVerificationTimer.delete(fieldId);
      this.runPostFixVerification(fieldId);
    }, POST_FIX_VERIFICATION_DELAY);

    this.postFixVerificationTimer.set(fieldId, timer);
  }

  /**
   * Cancel any pending post-fix verification for a field.
   */
  private cancelPostFixVerification(fieldId: string): void {
    const timer = this.postFixVerificationTimer.get(fieldId);
    if (timer) {
      clearTimeout(timer);
      this.postFixVerificationTimer.delete(fieldId);
    }
  }

  /**
   * Run post-fix verification using the lighter VERIFY_BLOCK message.
   * This catches cascading issues (e.g., grammar issues revealed after spelling fix).
   */
  private runPostFixVerification(fieldId: string): void {
    const handler = this.handlers.get(fieldId);
    if (!handler) return;

    const text = handler.getText();
    if (text.length < 10) {
      // Too short to analyze - just clear and return
      inputTextStore.clearState(fieldId);
      this.appliedFixCategories.delete(fieldId);
      return;
    }

    console.log('[AuroraWrite] Running post-fix verification');

    // Clear old state and re-initialize with fresh blocks
    inputTextStore.clearState(fieldId);
    const { allBlocks } = inputTextStore.updateText(fieldId, text);

    // Track analysis time to prevent duplicate analysis from input handler
    this.lastAnalysisTime.set(fieldId, Date.now());

    // Show loading state while verifying
    const field = this.detector.getFieldById(fieldId);
    if (field) {
      this.widget.showLoading(field.element);
    }

    // Send VERIFY_BLOCK for each block (lighter than full analysis)
    for (const block of allBlocks) {
      const requestId = `postfix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      inputTextStore.setBlockRequestId(fieldId, block.id, requestId);
      inputTextStore.setBlockAnalyzing(fieldId, block.id, true);

      const context = inputTextStore.getBlockContext(fieldId, block.id);

      chrome.runtime.sendMessage({
        type: 'VERIFY_BLOCK',
        payload: {
          fieldId,
          blockId: block.id,
          blockText: block.text,
          previousBlockText: context.previousBlockText,
          nextBlockText: context.nextBlockText,
          blockStartOffset: block.startOffset,
          requestId,
        },
      });
    }

    // Clear applied fix categories
    this.appliedFixCategories.delete(fieldId);
  }

  private ignoreIssue(issue: TextIssue): void {
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (!fieldId) {
      return;
    }

    // Hide popover first
    this.popover.hide();

    // Add to session-ignored issues for this field
    if (!this.sessionIgnoredIssues.has(fieldId)) {
      this.sessionIgnoredIssues.set(fieldId, new Set());
    }
    this.sessionIgnoredIssues.get(fieldId)!.add(issue.originalText.toLowerCase());

    // Remove the issue from overlay (removes underline immediately)
    this.overlayManager.removeIssue(fieldId, issue.id);

    // Also remove from the input text store
    inputTextStore.removeIssue(fieldId, issue.id);

    // Check remaining issues to see if this was the last one
    const remainingIssues = inputTextStore.getAllIssues(fieldId);
    const isLastIssue = remainingIssues.length === 0;

    // Update widget with remaining issues from the store
    this.widget.update(remainingIssues);

    if (isLastIssue) {
      // This was the last issue - clear state and trigger fresh analysis
      console.log('[AuroraWrite] Last issue ignored, clearing state for re-analysis');
      inputTextStore.clearState(fieldId);

      // Trigger fresh analysis
      const field = this.detector.getFieldById(fieldId);
      if (field) {
        setTimeout(() => {
          const currentState = inputTextStore.getState(fieldId);
          if (!currentState || currentState.blocks.length === 0) {
            console.log('[AuroraWrite] Triggering fresh analysis after last issue ignored');
            this.analyzeField(field);
          }
        }, 50);
      }
    } else {
      // More issues remain - schedule stability pass
      this.scheduleStabilityPass(fieldId);
    }
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
          // Also remove from the input text store
          inputTextStore.removeIssue(field.id, i.id);
        }
      }
    }

    // Update widget with remaining issues from the store
    const fieldId = this.activeFieldId || this.lastActiveFieldId;
    if (fieldId) {
      const remainingIssues = inputTextStore.getAllIssues(fieldId);
      this.widget.update(remainingIssues);

      if (remainingIssues.length === 0) {
        // All issues gone - clear state and trigger fresh analysis
        console.log('[AuroraWrite] All issues ignored, clearing state for re-analysis');
        inputTextStore.clearState(fieldId);

        const field = this.detector.getFieldById(fieldId);
        if (field) {
          setTimeout(() => {
            const currentState = inputTextStore.getState(fieldId);
            if (!currentState || currentState.blocks.length === 0) {
              console.log('[AuroraWrite] Triggering fresh analysis after all issues ignored');
              this.analyzeField(field);
            }
          }, 50);
        }
      } else {
        // More issues remain - schedule stability pass
        this.scheduleStabilityPass(fieldId);
      }
    }
  }

  destroy(): void {
    // Log performance summary before destroying
    performanceLogger.logSummary();

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


// Check if domain is ignored before starting
async function initAuroraWrite(): Promise<void> {
  const domain = window.location.hostname;
  const isIgnored = await isDomainIgnored(domain);

  if (isIgnored) {
    console.log(`[AuroraWrite] Domain ${domain} is ignored, not starting`);
    return;
  }

  const aurora = new AuroraWrite();
  aurora.start();
}

initAuroraWrite();

