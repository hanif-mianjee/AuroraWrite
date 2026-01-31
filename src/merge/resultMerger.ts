/**
 * Result Merger
 *
 * Merges block analysis results into a complete analysis result.
 * Handles offset adjustments when blocks move or change.
 */

import type { TextIssue, AnalysisResult } from '../shared/types/analysis';
import type { BlockState } from '../state';

/**
 * Adjust issue offsets from block-relative to text-absolute positions.
 *
 * @param issues - Issues with block-relative offsets
 * @param blockStartOffset - The block's start position in the full text
 * @returns Issues with adjusted absolute offsets
 */
export function adjustIssueOffsets(
  issues: TextIssue[],
  blockStartOffset: number
): TextIssue[] {
  return issues.map((issue) => ({
    ...issue,
    startOffset: issue.startOffset + blockStartOffset,
    endOffset: issue.endOffset + blockStartOffset,
  }));
}

/**
 * Merge issues from all blocks into a single sorted array.
 *
 * @param blocks - All block states with their issues
 * @returns Merged and sorted issues array
 */
export function mergeBlockIssues(blocks: BlockState[]): TextIssue[] {
  const allIssues: TextIssue[] = [];

  for (const block of blocks) {
    allIssues.push(...block.issues);
  }

  // Sort by start offset for consistent display
  return allIssues.sort((a, b) => a.startOffset - b.startOffset);
}

/**
 * Create a complete AnalysisResult from block states.
 *
 * @param text - The full text
 * @param blocks - All block states
 * @returns Complete AnalysisResult
 */
export function createAnalysisResult(
  text: string,
  blocks: BlockState[]
): AnalysisResult {
  return {
    text,
    issues: mergeBlockIssues(blocks),
    timestamp: Date.now(),
  };
}

/**
 * Validate that all issue offsets are within text bounds.
 * Removes any issues with invalid offsets.
 *
 * @param issues - Issues to validate
 * @param textLength - Length of the full text
 * @returns Valid issues only
 */
export function validateIssueOffsets(
  issues: TextIssue[],
  textLength: number
): TextIssue[] {
  return issues.filter((issue) => {
    if (issue.startOffset < 0 || issue.endOffset > textLength) {
      console.warn(
        `[AuroraWrite] Invalid issue offset: ${issue.startOffset}-${issue.endOffset} for text length ${textLength}`
      );
      return false;
    }
    if (issue.startOffset >= issue.endOffset) {
      console.warn(
        `[AuroraWrite] Invalid issue range: start ${issue.startOffset} >= end ${issue.endOffset}`
      );
      return false;
    }
    return true;
  });
}

/**
 * Remove duplicate issues (same position and suggestion).
 *
 * @param issues - Issues to deduplicate
 * @returns Deduplicated issues
 */
export function deduplicateIssues(issues: TextIssue[]): TextIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.startOffset}-${issue.endOffset}-${issue.suggestedText}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
