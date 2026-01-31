/**
 * Stability Pass Manager
 *
 * Manages the stability pass system that runs after initial analysis.
 * Detects newly exposed issues from dependency-based corrections.
 *
 * Trigger conditions:
 * - All blocks are marked clean (analyzed, not analyzing)
 * - No dirty blocks exist
 * - User is idle for 1000ms
 */

import { inputTextStore, CONFIDENCE_THRESHOLDS, BlockState } from '../state';
import type { TextIssue, AnalysisResult } from '../shared/types/analysis';

/**
 * Generate a unique request ID for race condition prevention.
 */
function generateRequestId(): string {
  return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface StabilityPassCallbacks {
  onStabilityPassStart: (fieldId: string, blockIds: string[]) => void;
  onBlockVerified: (fieldId: string, blockId: string, newIssues: TextIssue[]) => void;
  onStabilityPassComplete: (fieldId: string, result: AnalysisResult) => void;
  onStabilityPassCancelled: (fieldId: string) => void;
}

interface PendingStabilityPass {
  fieldId: string;
  pendingBlocks: Set<string>;
  blockRequestIds: Map<string, string>; // blockId -> requestId
  callbacks: StabilityPassCallbacks;
  isCancelled: boolean;
}

/**
 * Stability Pass Manager - coordinates verification of recently analyzed blocks.
 */
export class StabilityPassManager {
  private idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingPasses: Map<string, PendingStabilityPass> = new Map();
  private readonly IDLE_DELAY = 1000; // 1 second idle before stability pass

  /**
   * Schedule a stability pass check after idle timeout.
   * Call this after all blocks complete initial analysis.
   */
  scheduleStabilityCheck(fieldId: string, callbacks: StabilityPassCallbacks): void {
    // Clear any existing timer
    this.cancelIdleTimer(fieldId);

    // Schedule new check
    const timer = setTimeout(() => {
      this.runStabilityPass(fieldId, callbacks);
    }, this.IDLE_DELAY);

    this.idleTimers.set(fieldId, timer);
  }

  /**
   * Cancel scheduled stability check (e.g., user started typing).
   */
  cancelIdleTimer(fieldId: string): void {
    const timer = this.idleTimers.get(fieldId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(fieldId);
    }
  }

  /**
   * Cancel an ongoing stability pass (e.g., user applied a suggestion).
   */
  cancelStabilityPass(fieldId: string): void {
    this.cancelIdleTimer(fieldId);

    const pending = this.pendingPasses.get(fieldId);
    if (pending) {
      pending.isCancelled = true;
      pending.callbacks.onStabilityPassCancelled(fieldId);

      // Mark all pending blocks as not checking
      for (const blockId of pending.pendingBlocks) {
        inputTextStore.setBlockStabilityChecking(fieldId, blockId, false);
      }

      this.pendingPasses.delete(fieldId);
    }
  }

  /**
   * Run stability pass on unstable blocks.
   */
  private runStabilityPass(
    fieldId: string,
    callbacks: StabilityPassCallbacks
  ): void {
    // Check if all blocks are clean (analyzed, not analyzing)
    if (!inputTextStore.areAllBlocksClean(fieldId)) {
      console.log('[AuroraWrite:Stability] Skipping - not all blocks clean');
      return;
    }

    // STABILITY GUARD: Don't run if there are unapplied issues visible to user
    if (inputTextStore.hasAnyUnappliedIssues(fieldId)) {
      console.log('[AuroraWrite:Stability] Skipping - has unapplied issues');
      return;
    }

    // Check if all blocks are already stable
    if (inputTextStore.areAllBlocksStable(fieldId)) {
      console.log('[AuroraWrite:Stability] Skipping - all blocks stable');
      return;
    }

    // Get unstable blocks that need verification (already filtered by hasUnappliedIssues)
    const unstableBlocks = inputTextStore.getUnstableBlocks(fieldId);

    if (unstableBlocks.length === 0) {
      console.log('[AuroraWrite:Stability] Skipping - no unstable blocks eligible');
      return;
    }

    console.log(
      `[AuroraWrite:Stability] Starting stability pass for ${unstableBlocks.length} blocks`
    );

    // Track pending blocks
    const pendingBlockIds = new Set(unstableBlocks.map((b) => b.id));
    const blockRequestIds = new Map<string, string>();

    this.pendingPasses.set(fieldId, {
      fieldId,
      pendingBlocks: pendingBlockIds,
      blockRequestIds,
      callbacks,
      isCancelled: false,
    });

    // Notify start
    callbacks.onStabilityPassStart(
      fieldId,
      unstableBlocks.map((b) => b.id)
    );

    // Send each unstable block for verification
    for (const block of unstableBlocks) {
      // Check max passes
      if (block.passes >= CONFIDENCE_THRESHOLDS.MAX_PASSES) {
        inputTextStore.forceBlockStable(fieldId, block.id);
        pendingBlockIds.delete(block.id);
        continue;
      }

      const requestId = generateRequestId();
      blockRequestIds.set(block.id, requestId);

      inputTextStore.setBlockStabilityChecking(fieldId, block.id, true);
      inputTextStore.setBlockRequestId(fieldId, block.id, requestId);

      const context = inputTextStore.getBlockContext(fieldId, block.id);

      // Send verification message to background
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

    // Check if all blocks were skipped due to max passes
    if (pendingBlockIds.size === 0) {
      this.completeStabilityPass(fieldId);
    }
  }

  /**
   * Handle verification result from background.
   */
  handleVerificationResult(
    fieldId: string,
    blockId: string,
    issues: TextIssue[],
    requestId?: string
  ): void {
    const pending = this.pendingPasses.get(fieldId);
    if (!pending || pending.isCancelled) return;

    // Validate request ID to prevent race conditions
    if (requestId && pending.blockRequestIds.has(blockId)) {
      const expectedId = pending.blockRequestIds.get(blockId);
      if (expectedId !== requestId) {
        console.log(`[AuroraWrite:Stability] Discarding stale verification for ${blockId}`);
        return;
      }
    }

    // Update store with results (as stability pass)
    const accepted = inputTextStore.mergeBlockResult(fieldId, blockId, issues, true, requestId);
    if (!accepted) {
      console.log(`[AuroraWrite:Stability] Verification result rejected for ${blockId}`);
      return;
    }

    // Notify callback
    pending.callbacks.onBlockVerified(fieldId, blockId, issues);

    // Remove from pending
    pending.pendingBlocks.delete(blockId);
    pending.blockRequestIds.delete(blockId);

    // Check if all blocks complete
    if (pending.pendingBlocks.size === 0) {
      this.completeStabilityPass(fieldId);
    }
  }

  /**
   * Handle verification error from background.
   */
  handleVerificationError(fieldId: string, blockId: string, error: string): void {
    const pending = this.pendingPasses.get(fieldId);
    if (!pending || pending.isCancelled) return;

    console.error(
      `[AuroraWrite:Stability] Verification error for block ${blockId}:`,
      error
    );

    // Force block stable on error to prevent infinite retries
    inputTextStore.forceBlockStable(fieldId, blockId);

    // Remove from pending
    pending.pendingBlocks.delete(blockId);

    // Check if all blocks complete
    if (pending.pendingBlocks.size === 0) {
      this.completeStabilityPass(fieldId);
    }
  }

  /**
   * Complete the stability pass.
   */
  private completeStabilityPass(fieldId: string): void {
    const pending = this.pendingPasses.get(fieldId);
    if (!pending) return;

    const state = inputTextStore.getState(fieldId);
    if (state) {
      const allIssues = inputTextStore.getAllIssues(fieldId);

      pending.callbacks.onStabilityPassComplete(fieldId, {
        text: state.text,
        issues: allIssues,
        timestamp: Date.now(),
      });
    }

    this.pendingPasses.delete(fieldId);

    console.log(`[AuroraWrite:Stability] Stability pass complete for ${fieldId}`);
  }

  /**
   * Check if a stability pass is pending for a field.
   */
  isStabilityPassPending(fieldId: string): boolean {
    return this.pendingPasses.has(fieldId);
  }

  /**
   * Check if an idle timer is scheduled for a field.
   */
  isIdleTimerScheduled(fieldId: string): boolean {
    return this.idleTimers.has(fieldId);
  }
}

// Singleton instance
export const stabilityPassManager = new StabilityPassManager();
