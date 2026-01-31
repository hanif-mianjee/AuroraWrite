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
   */
  mergeBlockResult(fieldId: string, blockId: string, issues: TextIssue[]): void {
    const state = this.states.get(fieldId);
    if (!state) return;

    const block = state.blocks.find((b) => b.id === blockId);
    if (!block) return;

    block.issues = issues;
    block.version++;
    block.isAnalyzed = true;
    block.isAnalyzing = false;
    state.version++;
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
}

// Singleton instance for use across the extension
export const inputTextStore = new InputTextStore();
