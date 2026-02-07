/**
 * Input Text Store
 *
 * Manages the state of input text with block-based caching.
 * Enables incremental analysis by tracking which blocks have changed.
 */

import { TextIssue } from '../shared/types/analysis';
import { splitIntoBlocks, RawBlock } from '../block/blockSplitter';
import { hashBlock } from '../block/blockHasher';

/**
 * Confidence scoring constants for stability pass system.
 */
export const CONFIDENCE_THRESHOLDS = {
  STABLE: 0.8, // Block is stable when confidence >= 0.8
  NO_ISSUES_BOOST: 0.4, // +0.4 when AI returns no issues
  ALL_APPLIED_BOOST: 0.2, // +0.2 when user applies all suggestions
  NEW_ISSUES_PENALTY: 0.3, // -0.3 if new issues appear after a pass
  MAX_PASSES: 2, // Maximum stability passes per block
};

/**
 * State of an individual text block.
 */
export interface BlockState {
  id: string;
  startOffset: number;
  endOffset: number;
  hash: string;
  text: string;
  issues: TextIssue[];
  version: number;
  isAnalyzed: boolean;
  isAnalyzing: boolean;
  // Stability pass fields
  confidence: number; // 0.0 → 1.0, block is stable at >= 0.8
  passes: number; // Number of stability passes completed
  isStabilityChecking: boolean; // Currently in stability check
  // Issue state machine fields
  hasUnappliedIssues: boolean; // Has issues with status === 'new'
  activeRequestId: string | null; // Current pending request ID for race condition prevention
}

/**
 * State of the entire input text.
 */
export interface InputTextState {
  text: string;
  version: number;
  blocks: BlockState[];
  fieldId: string;
}

/**
 * Result of comparing old and new text states.
 */
export interface DirtyBlocksResult {
  dirtyBlocks: BlockState[];
  cleanBlocks: BlockState[];
  allBlocks: BlockState[];
}

/**
 * Input Text Store - manages text state per field.
 */
export class InputTextStore {
  private states: Map<string, InputTextState> = new Map();

  /**
   * Get the current state for a field.
   */
  getState(fieldId: string): InputTextState | undefined {
    return this.states.get(fieldId);
  }

  /**
   * Initialize or update state for a field with new text.
   * Returns dirty blocks that need re-analysis.
   *
   * @param fieldId - The text field identifier
   * @param newText - The current text content
   * @returns DirtyBlocksResult with dirty and clean blocks
   */
  updateText(fieldId: string, newText: string): DirtyBlocksResult {
    const existingState = this.states.get(fieldId);
    const newBlocks = splitIntoBlocks(newText);

    if (!existingState) {
      // First time - all blocks are dirty
      const blockStates: BlockState[] = newBlocks.map((block) => ({
        id: block.id,
        startOffset: block.startOffset,
        endOffset: block.endOffset,
        hash: block.hash,
        text: block.text,
        issues: [],
        version: 1,
        isAnalyzed: false,
        isAnalyzing: false,
        confidence: 0,
        passes: 0,
        isStabilityChecking: false,
        hasUnappliedIssues: false,
        activeRequestId: null,
      }));

      this.states.set(fieldId, {
        text: newText,
        version: 1,
        blocks: blockStates,
        fieldId,
      });

      return {
        dirtyBlocks: blockStates,
        cleanBlocks: [],
        allBlocks: blockStates,
      };
    }

    // Compare with existing blocks to find dirty ones
    const { dirtyBlocks, cleanBlocks, allBlocks } = this.compareBlocks(
      existingState.blocks,
      newBlocks
    );

    // Update state
    this.states.set(fieldId, {
      text: newText,
      version: existingState.version + 1,
      blocks: allBlocks,
      fieldId,
    });

    return { dirtyBlocks, cleanBlocks, allBlocks };
  }

  /**
   * Compare old blocks with new blocks to identify dirty blocks.
   */
  private compareBlocks(
    oldBlocks: BlockState[],
    newBlocks: RawBlock[]
  ): DirtyBlocksResult {
    const dirtyBlocks: BlockState[] = [];
    const cleanBlocks: BlockState[] = [];
    const allBlocks: BlockState[] = [];

    // Create a map of old blocks by hash for quick lookup
    const oldBlocksByHash = new Map<string, BlockState>();
    for (const block of oldBlocks) {
      // Use hash + rough position to identify blocks
      const key = block.hash;
      if (!oldBlocksByHash.has(key)) {
        oldBlocksByHash.set(key, block);
      }
    }

    // Track which old blocks were matched
    const matchedOldBlocks = new Set<string>();

    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];

      // Try to find matching old block by hash
      const matchingOldBlock = oldBlocksByHash.get(newBlock.hash);

      if (matchingOldBlock && !matchedOldBlocks.has(matchingOldBlock.id)) {
        // Block unchanged - reuse issues
        matchedOldBlocks.add(matchingOldBlock.id);

        // Adjust offsets if block moved
        const blockState: BlockState = {
          ...matchingOldBlock,
          id: newBlock.id,
          startOffset: newBlock.startOffset,
          endOffset: newBlock.endOffset,
          text: newBlock.text,
          // Adjust issue offsets relative to new block position
          issues: this.adjustIssueOffsets(
            matchingOldBlock.issues,
            matchingOldBlock.startOffset,
            newBlock.startOffset
          ),
        };

        cleanBlocks.push(blockState);
        allBlocks.push(blockState);
      } else {
        // Block is new or changed - needs analysis
        const blockState: BlockState = {
          id: newBlock.id,
          startOffset: newBlock.startOffset,
          endOffset: newBlock.endOffset,
          hash: newBlock.hash,
          text: newBlock.text,
          issues: [],
          version: 1,
          isAnalyzed: false,
          isAnalyzing: false,
          confidence: 0,
          passes: 0,
          isStabilityChecking: false,
          hasUnappliedIssues: false,
          activeRequestId: null,
        };

        dirtyBlocks.push(blockState);
        allBlocks.push(blockState);
      }
    }

    return { dirtyBlocks, cleanBlocks, allBlocks };
  }

  /**
   * Adjust issue offsets when a block moves position.
   */
  private adjustIssueOffsets(
    issues: TextIssue[],
    oldBlockStart: number,
    newBlockStart: number
  ): TextIssue[] {
    const delta = newBlockStart - oldBlockStart;
    if (delta === 0) return issues;

    return issues.map((issue) => ({
      ...issue,
      startOffset: issue.startOffset + delta,
      endOffset: issue.endOffset + delta,
    }));
  }

  /**
   * Update a block with analysis results.
   *
   * @param fieldId - The text field identifier
   * @param blockId - The block identifier
   * @param issues - The issues found in this block
   * @param isStabilityPass - Whether this is a stability pass result
   * @param requestId - Optional request ID for race condition prevention
   */
  mergeBlockResult(
    fieldId: string,
    blockId: string,
    issues: TextIssue[],
    isStabilityPass: boolean = false,
    requestId?: string
  ): boolean {
    const state = this.states.get(fieldId);
    if (!state) return false;

    const block = state.blocks.find((b) => b.id === blockId);
    if (!block) return false;

    // Race condition prevention: discard stale responses
    if (requestId && block.activeRequestId && requestId !== block.activeRequestId) {
      console.log(`[AuroraWrite] Discarding stale response for block ${blockId}`);
      return false;
    }

    if (isStabilityPass) {
      // CRITICAL: Verification must NEVER delete existing analysis issues
      // Only ADD new verification issues
      if (issues.length > 0) {
        // Mark new issues with source and status
        const newVerificationIssues = issues.map((issue) => ({
          ...issue,
          source: 'verification' as const,
          status: 'new' as const,
        }));

        // Check for truly new issues (not duplicates of existing)
        const existingIds = new Set(block.issues.map((i) => `${i.startOffset}-${i.endOffset}-${i.suggestedText}`));
        const trulyNewIssues = newVerificationIssues.filter(
          (issue) => !existingIds.has(`${issue.startOffset}-${issue.endOffset}-${issue.suggestedText}`)
        );

        if (trulyNewIssues.length > 0) {
          // Add new issues to existing ones
          block.issues = [...block.issues, ...trulyNewIssues];
          block.confidence = Math.max(
            0.0,
            block.confidence - CONFIDENCE_THRESHOLDS.NEW_ISSUES_PENALTY
          );
        } else {
          // No truly new issues - boost confidence
          block.confidence = Math.min(
            1.0,
            block.confidence + CONFIDENCE_THRESHOLDS.NO_ISSUES_BOOST
          );
        }
      } else {
        // No issues found during verification - boost confidence
        // DO NOT touch existing issues
        block.confidence = Math.min(
          1.0,
          block.confidence + CONFIDENCE_THRESHOLDS.NO_ISSUES_BOOST
        );
      }
      block.passes++;
      block.isStabilityChecking = false;
    } else {
      // Initial analysis - replace all issues
      block.issues = issues.map((issue) => ({
        ...issue,
        source: 'analysis' as const,
        status: 'new' as const,
      }));

      // Set baseline confidence
      if (issues.length === 0) {
        block.confidence = CONFIDENCE_THRESHOLDS.NO_ISSUES_BOOST;
      } else {
        block.confidence = 0;
      }
    }

    block.version++;
    block.isAnalyzed = true;
    block.isAnalyzing = false;
    block.activeRequestId = null;

    // Update hasUnappliedIssues flag
    block.hasUnappliedIssues = block.issues.some(
      (issue) => issue.status === 'new' || issue.status === undefined
    );

    state.version++;
    return true;
  }

  /**
   * Set the active request ID for a block (for race condition prevention).
   */
  setBlockRequestId(fieldId: string, blockId: string, requestId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.activeRequestId = requestId;
    }
  }

  /**
   * Mark a block as currently being analyzed.
   */
  setBlockAnalyzing(fieldId: string, blockId: string, isAnalyzing: boolean): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.isAnalyzing = isAnalyzing;
    }
  }

  /**
   * Get all issues for a field (across all blocks).
   */
  getAllIssues(fieldId: string): TextIssue[] {
    const state = this.states.get(fieldId);
    if (!state) return [];

    return state.blocks.flatMap((block) => block.issues);
  }

  /**
   * Remove a specific issue from a block (after acceptance).
   * Does NOT trigger re-analysis.
   *
   * @param fieldId - The text field identifier
   * @param issueId - The issue identifier to remove
   */
  removeIssue(fieldId: string, issueId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    for (const block of state.blocks) {
      const issueIndex = block.issues.findIndex((i) => i.id === issueId);
      if (issueIndex !== -1) {
        block.issues.splice(issueIndex, 1);
        block.version++;
        state.version++;

        // Update hasUnappliedIssues flag
        block.hasUnappliedIssues = block.issues.some(
          (issue) => issue.status === 'new' || issue.status === undefined
        );
        break;
      }
    }
  }

  /**
   * Apply a text replacement to a block after suggestion acceptance.
   * Updates the block's text, hash, and offsets without triggering analysis.
   *
   * @param fieldId - The text field identifier
   * @param issue - The issue being accepted
   * @param newFullText - The new full text after replacement
   */
  applyLocalChange(fieldId: string, issue: TextIssue, newFullText: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    // Remove the accepted issue
    this.removeIssue(fieldId, issue.id);

    // Calculate the offset delta from the replacement
    const delta = issue.suggestedText.length - issue.originalText.length;

    // Find the block containing this issue and update it
    for (let i = 0; i < state.blocks.length; i++) {
      const block = state.blocks[i];

      if (issue.startOffset >= block.startOffset && issue.startOffset < block.endOffset) {
        // This is the block containing the issue
        const newBlockEnd = block.endOffset + delta;
        const newBlockText = newFullText.slice(block.startOffset, newBlockEnd);

        block.text = newBlockText;
        block.endOffset = newBlockEnd;
        block.hash = hashBlock(newBlockText);
        block.version++;

        // Mark as already analyzed (no need to re-analyze for this change)
        block.isAnalyzed = true;

        // FIX: Adjust remaining issues in THIS block that come after the applied fix
        for (const blockIssue of block.issues) {
          if (blockIssue.startOffset > issue.startOffset) {
            blockIssue.startOffset += delta;
            blockIssue.endOffset += delta;
          }
        }

        // Adjust offsets for subsequent blocks
        for (let j = i + 1; j < state.blocks.length; j++) {
          state.blocks[j].startOffset += delta;
          state.blocks[j].endOffset += delta;

          // Adjust issue offsets in subsequent blocks
          for (const blockIssue of state.blocks[j].issues) {
            blockIssue.startOffset += delta;
            blockIssue.endOffset += delta;
          }
        }

        break;
      }
    }

    // Update full text
    state.text = newFullText;
    state.version++;
  }

  /**
   * Get block context for AI analysis.
   */
  getBlockContext(
    fieldId: string,
    blockId: string
  ): { previousBlockText: string | null; nextBlockText: string | null } {
    const state = this.states.get(fieldId);
    if (!state) return { previousBlockText: null, nextBlockText: null };

    const blockIndex = state.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return { previousBlockText: null, nextBlockText: null };

    return {
      previousBlockText:
        blockIndex > 0 ? state.blocks[blockIndex - 1].text : null,
      nextBlockText:
        blockIndex < state.blocks.length - 1
          ? state.blocks[blockIndex + 1].text
          : null,
    };
  }

  /**
   * Clear state for a field.
   */
  clearState(fieldId: string): void {
    this.states.delete(fieldId);
  }

  /**
   * Clear all states.
   */
  clearAll(): void {
    this.states.clear();
  }

  // ============================================
  // Stability Pass Methods
  // ============================================

  /**
   * Check if a block is stable (confidence >= 0.8 AND passes >= 1).
   */
  isBlockStable(block: BlockState): boolean {
    return (
      block.confidence >= CONFIDENCE_THRESHOLDS.STABLE &&
      block.passes >= 1
    );
  }

  /**
   * Get all unstable blocks for a field that are eligible for verification.
   * STABILITY GUARD: Only blocks without unapplied issues can be verified.
   */
  getUnstableBlocks(fieldId: string): BlockState[] {
    const state = this.states.get(fieldId);
    if (!state) return [];

    return state.blocks.filter(
      (block) =>
        block.isAnalyzed &&
        !block.isAnalyzing &&
        !block.isStabilityChecking &&
        !block.hasUnappliedIssues && // CRITICAL: Only verify blocks with no unapplied issues
        block.passes < CONFIDENCE_THRESHOLDS.MAX_PASSES &&
        !this.isBlockStable(block)
    );
  }

  /**
   * Check if any block in the field has unapplied issues.
   */
  hasAnyUnappliedIssues(fieldId: string): boolean {
    const state = this.states.get(fieldId);
    if (!state) return false;

    return state.blocks.some((block) => block.hasUnappliedIssues);
  }

  /**
   * Check if all blocks for a field are stable.
   */
  areAllBlocksStable(fieldId: string): boolean {
    const state = this.states.get(fieldId);
    if (!state) return true;

    return state.blocks.every(
      (block) =>
        this.isBlockStable(block) ||
        block.passes >= CONFIDENCE_THRESHOLDS.MAX_PASSES
    );
  }

  /**
   * Boost confidence when AI returns no issues for a block.
   * +0.4 confidence
   */
  boostConfidenceNoIssues(fieldId: string, blockId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.confidence = Math.min(
        1.0,
        block.confidence + CONFIDENCE_THRESHOLDS.NO_ISSUES_BOOST
      );
      block.passes++;
      block.isStabilityChecking = false;
    }
  }

  /**
   * Boost confidence when user applies all suggestions for a block.
   * +0.2 confidence
   */
  boostConfidenceAllApplied(fieldId: string, blockId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.confidence = Math.min(
        1.0,
        block.confidence + CONFIDENCE_THRESHOLDS.ALL_APPLIED_BOOST
      );
    }
  }

  /**
   * Penalize confidence when new issues appear after a stability pass.
   * -0.3 confidence
   */
  penalizeConfidenceNewIssues(fieldId: string, blockId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.confidence = Math.max(
        0.0,
        block.confidence - CONFIDENCE_THRESHOLDS.NEW_ISSUES_PENALTY
      );
      block.passes++;
      block.isStabilityChecking = false;
    }
  }

  /**
   * Mark a block as currently in stability check.
   */
  setBlockStabilityChecking(
    fieldId: string,
    blockId: string,
    isChecking: boolean
  ): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.isStabilityChecking = isChecking;
    }
  }

  /**
   * Force a block into stable state (used when max passes reached).
   */
  forceBlockStable(fieldId: string, blockId: string): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (block) {
      block.confidence = CONFIDENCE_THRESHOLDS.STABLE;
      block.passes = CONFIDENCE_THRESHOLDS.MAX_PASSES;
      block.isStabilityChecking = false;
    }
  }

  /**
   * Check if all blocks are analyzed and clean (no pending analysis).
   */
  areAllBlocksClean(fieldId: string): boolean {
    const state = this.states.get(fieldId);
    if (!state) return true;

    return state.blocks.every(
      (block) => block.isAnalyzed && !block.isAnalyzing && !block.isStabilityChecking
    );
  }

  /**
   * Get a specific block by ID.
   */
  getBlock(fieldId: string, blockId: string): BlockState | undefined {
    const state = this.states.get(fieldId);
    if (!state) return undefined;

    return state.blocks.find((b) => b.id === blockId);
  }
}

// Singleton instance for use across the extension
export const inputTextStore = new InputTextStore();
