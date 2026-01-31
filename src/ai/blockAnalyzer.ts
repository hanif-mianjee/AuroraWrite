/**
 * Block Analyzer
 *
 * Manages incremental block-based text analysis.
 * Sends only dirty blocks to the AI for analysis and merges results.
 */

import { inputTextStore, DirtyBlocksResult } from '../state';
import type { TextIssue, AnalysisResult } from '../shared/types/analysis';

export interface BlockAnalysisCallbacks {
  onBlockAnalysisStart: (fieldId: string, blockId: string) => void;
  onBlockAnalysisComplete: (fieldId: string, blockId: string, issues: TextIssue[]) => void;
  onBlockAnalysisError: (fieldId: string, blockId: string, error: string) => void;
  onAllBlocksComplete: (fieldId: string, result: AnalysisResult) => void;
}

interface PendingAnalysis {
  fieldId: string;
  pendingBlocks: Set<string>;
  callbacks: BlockAnalysisCallbacks;
}

/**
 * Block Analyzer - coordinates incremental analysis of text blocks.
 */
export class BlockAnalyzer {
  private pendingAnalyses: Map<string, PendingAnalysis> = new Map();

  /**
   * Analyze text incrementally by blocks.
   * Only dirty blocks are sent to the AI.
   *
   * @param fieldId - The text field identifier
   * @param text - The current full text
   * @param callbacks - Callbacks for analysis events
   * @returns DirtyBlocksResult with blocks that need analysis
   */
  analyzeText(
    fieldId: string,
    text: string,
    callbacks: BlockAnalysisCallbacks
  ): DirtyBlocksResult {
    // Update the store and get dirty blocks
    const result = inputTextStore.updateText(fieldId, text);

    if (result.dirtyBlocks.length === 0) {
      // No dirty blocks - return current issues immediately
      const allIssues = inputTextStore.getAllIssues(fieldId);
      callbacks.onAllBlocksComplete(fieldId, {
        text,
        issues: allIssues,
        timestamp: Date.now(),
      });
      return result;
    }

    // Track pending analysis
    const pendingBlockIds = new Set(result.dirtyBlocks.map((b) => b.id));
    this.pendingAnalyses.set(fieldId, {
      fieldId,
      pendingBlocks: pendingBlockIds,
      callbacks,
    });

    // Send each dirty block for analysis
    for (const block of result.dirtyBlocks) {
      inputTextStore.setBlockAnalyzing(fieldId, block.id, true);
      callbacks.onBlockAnalysisStart(fieldId, block.id);

      const context = inputTextStore.getBlockContext(fieldId, block.id);

      // Send message to background for block analysis
      chrome.runtime.sendMessage({
        type: 'ANALYZE_BLOCK',
        payload: {
          fieldId,
          blockId: block.id,
          blockText: block.text,
          previousBlockText: context.previousBlockText,
          nextBlockText: context.nextBlockText,
          blockStartOffset: block.startOffset,
        },
      });
    }

    return result;
  }

  /**
   * Handle block analysis result from background.
   *
   * @param fieldId - The text field identifier
   * @param blockId - The block identifier
   * @param issues - Issues found in this block (offsets relative to full text)
   */
  handleBlockResult(fieldId: string, blockId: string, issues: TextIssue[]): void {
    const pending = this.pendingAnalyses.get(fieldId);
    if (!pending) return;

    // Update the store with block results
    inputTextStore.mergeBlockResult(fieldId, blockId, issues);

    // Notify callback
    pending.callbacks.onBlockAnalysisComplete(fieldId, blockId, issues);

    // Remove from pending
    pending.pendingBlocks.delete(blockId);

    // Check if all blocks are complete
    if (pending.pendingBlocks.size === 0) {
      this.completeAnalysis(fieldId, pending);
    }
  }

  /**
   * Handle block analysis error from background.
   */
  handleBlockError(fieldId: string, blockId: string, error: string): void {
    const pending = this.pendingAnalyses.get(fieldId);
    if (!pending) return;

    inputTextStore.setBlockAnalyzing(fieldId, blockId, false);
    pending.callbacks.onBlockAnalysisError(fieldId, blockId, error);

    // Remove from pending even on error
    pending.pendingBlocks.delete(blockId);

    // Check if all blocks are complete
    if (pending.pendingBlocks.size === 0) {
      this.completeAnalysis(fieldId, pending);
    }
  }

  /**
   * Complete analysis when all blocks are done.
   */
  private completeAnalysis(fieldId: string, pending: PendingAnalysis): void {
    const state = inputTextStore.getState(fieldId);
    if (!state) return;

    const allIssues = inputTextStore.getAllIssues(fieldId);

    pending.callbacks.onAllBlocksComplete(fieldId, {
      text: state.text,
      issues: allIssues,
      timestamp: Date.now(),
    });

    this.pendingAnalyses.delete(fieldId);
  }

  /**
   * Cancel pending analysis for a field.
   */
  cancelAnalysis(fieldId: string): void {
    this.pendingAnalyses.delete(fieldId);
  }

  /**
   * Check if analysis is pending for a field.
   */
  isAnalysisPending(fieldId: string): boolean {
    return this.pendingAnalyses.has(fieldId);
  }

  /**
   * Get the number of pending blocks for a field.
   */
  getPendingBlockCount(fieldId: string): number {
    return this.pendingAnalyses.get(fieldId)?.pendingBlocks.size ?? 0;
  }
}

// Singleton instance
export const blockAnalyzer = new BlockAnalyzer();
