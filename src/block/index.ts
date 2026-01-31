/**
 * Block module exports
 *
 * Provides block splitting and hashing utilities for incremental text analysis.
 */

export { hashBlock, hashesEqual } from './blockHasher';
export { splitIntoBlocks, getBlockContext } from './blockSplitter';
export type { RawBlock } from './blockSplitter';
