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
import { hashBlock } from '../block';
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

    return debouncedAnalyze;
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

    // Cancel any existing analysis and stability pass
    blockAnalyzer.cancelAnalysis(field.id);
    stabilityPassManager.cancelStabilityPass(field.id);

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

    // Delegate to stability pass manager with requestId for validation
    stabilityPassManager.handleVerificationResult(fieldId, blockId, filteredIssues, requestId);

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
    console.error(`[AuroraWrite:Stability] Verification error for field ${fieldId}, block ${blockId}:`, error);

    // Delegate to stability pass manager
    stabilityPassManager.handleVerificationError(fieldId, blockId, error);
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

    // Set the final text in one operation
    this.overlayManager.setFieldText(fieldId, text);

    // Update overlay with ONLY the adjusted non-spelling issues (preserves them)
    this.overlayManager.updateAnalysis(fieldId, {
      text,
      issues: adjustedNonSpellingIssues,
      timestamp: Date.now(),
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

    // Schedule stability pass to find newly exposed issues (after user is idle)
    this.scheduleStabilityPass(fieldId);
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

    // Cancel any pending stability pass - user is actively making changes
    stabilityPassManager.cancelStabilityPass(fieldId);

    // Remove the issue from overlay IMMEDIATELY (before text replacement)
    // This removes the underline instantly
    this.overlayManager.removeIssue(fieldId, issue.id);
    this.popover.hide();

    // Check remaining issues BEFORE applying changes
    // (We remove from store first to get accurate count)
    inputTextStore.removeIssue(fieldId, issue.id);
    const remainingIssues = inputTextStore.getAllIssues(fieldId);
    const isLastSuggestion = remainingIssues.length === 0;

    // Now replace the text in the DOM
    this.overlayManager.replaceText(fieldId, issue);

    // Record that we avoided an API call
    performanceLogger.recordSuggestionAcceptance(fieldId);

    // Update widget with remaining issues
    this.widget.update(remainingIssues);

    if (isLastSuggestion) {
      // This was the last suggestion - clear state and trigger fresh analysis
      console.log('[AuroraWrite] Last suggestion applied, clearing state for re-analysis');
      inputTextStore.clearState(fieldId);

      // Directly trigger analysis after DOM has updated
      // Use setTimeout to ensure DOM changes from replaceText are complete
      const field = this.detector.getFieldById(fieldId);
      if (field) {
        setTimeout(() => {
          // Double-check state is still clear (no other analysis started)
          const currentState = inputTextStore.getState(fieldId);
          if (!currentState || currentState.blocks.length === 0) {
            console.log('[AuroraWrite] Triggering fresh analysis after last suggestion');
            this.analyzeField(field);
          } else {
            console.log('[AuroraWrite] Analysis already started by another handler, skipping');
          }
        }, 50); // Small delay to let DOM update
      }
    } else {
      // More issues remain - apply local change to preserve state
      const handler = this.handlers.get(fieldId);
      if (handler) {
        const newText = handler.getText();
        // Re-add the issue we removed, then apply the change properly
        // Actually, we already removed it, so just update the text/offsets
        const state = inputTextStore.getState(fieldId);
        if (state) {
          // Update block text and offsets for the change
          const delta = issue.suggestedText.length - issue.originalText.length;
          for (const block of state.blocks) {
            if (issue.startOffset >= block.startOffset && issue.startOffset < block.endOffset) {
              // This block contains the fix
              const newBlockEnd = block.endOffset + delta;
              const newBlockText = newText.slice(block.startOffset, newBlockEnd);
              block.text = newBlockText;
              block.endOffset = newBlockEnd;
              block.hash = hashBlock(newBlockText); // Use proper hash function
            } else if (block.startOffset > issue.startOffset) {
              // Adjust subsequent block offsets
              block.startOffset += delta;
              block.endOffset += delta;
              for (const blockIssue of block.issues) {
                blockIssue.startOffset += delta;
                blockIssue.endOffset += delta;
              }
            }
          }
          state.text = newText;
        }
      }
      // Schedule stability pass for when user is idle
      this.scheduleStabilityPass(fieldId);
    }
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

