/**
 * Block Splitter
 *
 * Splits input text into stable logical blocks for incremental analysis.
 * Each block is independently analyzable and hashable.
 *
 * Strategy:
 * 1. Primary: Split by paragraphs (double newline or single newline with blank)
 * 2. Fallback: Split by sentences if paragraph is too long
 * 3. Final fallback: Split by character limit (300-500 chars)
 */

import { hashBlock } from './blockHasher';

export interface RawBlock {
  id: string;
  startOffset: number;
  endOffset: number;
  text: string;
  hash: string;
}

const MAX_BLOCK_SIZE = 500;
const MIN_BLOCK_SIZE = 50;

/**
 * Generate a unique block ID based on position and content.
 */
function generateBlockId(index: number, startOffset: number): string {
  return `block_${index}_${startOffset}`;
}

/**
 * Split text by paragraphs (double newlines or significant whitespace).
 */
function splitByParagraphs(text: string): { text: string; start: number; end: number }[] {
  const blocks: { text: string; start: number; end: number }[] = [];

  // Match paragraphs separated by one or more blank lines
  const paragraphRegex = /[^\n]+(?:\n(?!\n)[^\n]*)*/g;
  let match;

  while ((match = paragraphRegex.exec(text)) !== null) {
    const blockText = match[0];
    if (blockText.trim()) {
      blocks.push({
        text: blockText,
        start: match.index,
        end: match.index + blockText.length,
      });
    }
  }

  // If no paragraphs found, treat entire text as one block
  if (blocks.length === 0 && text.trim()) {
    blocks.push({
      text: text,
      start: 0,
      end: text.length,
    });
  }

  return blocks;
}

/**
 * Split a long block by sentences.
 */
function splitBySentences(
  blockText: string,
  baseOffset: number
): { text: string; start: number; end: number }[] {
  const blocks: { text: string; start: number; end: number }[] = [];

  // Match sentences ending with . ! ? followed by space or end
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g;
  let match;
  let currentOffset = baseOffset;

  while ((match = sentenceRegex.exec(blockText)) !== null) {
    const sentenceText = match[0];
    if (sentenceText.trim()) {
      blocks.push({
        text: sentenceText,
        start: currentOffset + match.index,
        end: currentOffset + match.index + sentenceText.length,
      });
    }
  }

  return blocks;
}

/**
 * Split a long block by character limit.
 * Tries to break at word boundaries.
 */
function splitBySize(
  blockText: string,
  baseOffset: number,
  maxSize: number = MAX_BLOCK_SIZE
): { text: string; start: number; end: number }[] {
  const blocks: { text: string; start: number; end: number }[] = [];
  let currentStart = 0;

  while (currentStart < blockText.length) {
    let end = Math.min(currentStart + maxSize, blockText.length);

    // Try to break at word boundary if not at end
    if (end < blockText.length) {
      const lastSpace = blockText.lastIndexOf(' ', end);
      if (lastSpace > currentStart + MIN_BLOCK_SIZE) {
        end = lastSpace + 1; // Include the space in current block
      }
    }

    const chunkText = blockText.slice(currentStart, end);
    if (chunkText.trim()) {
      blocks.push({
        text: chunkText,
        start: baseOffset + currentStart,
        end: baseOffset + end,
      });
    }

    currentStart = end;
  }

  return blocks;
}

/**
 * Split input text into stable logical blocks.
 *
 * @param text - The full input text to split
 * @returns Array of RawBlock objects with id, offsets, text, and hash
 */
export function splitIntoBlocks(text: string): RawBlock[] {
  if (!text || !text.trim()) {
    return [];
  }

  const result: RawBlock[] = [];
  let blockIndex = 0;

  // Step 1: Split by paragraphs
  const paragraphs = splitByParagraphs(text);

  for (const para of paragraphs) {
    // Step 2: If paragraph is too long, split by sentences
    if (para.text.length > MAX_BLOCK_SIZE) {
      const sentences = splitBySentences(para.text, para.start);

      for (const sentence of sentences) {
        // Step 3: If sentence is still too long, split by size
        if (sentence.text.length > MAX_BLOCK_SIZE) {
          const chunks = splitBySize(sentence.text, sentence.start);
          for (const chunk of chunks) {
            result.push({
              id: generateBlockId(blockIndex++, chunk.start),
              startOffset: chunk.start,
              endOffset: chunk.end,
              text: chunk.text,
              hash: hashBlock(chunk.text),
            });
          }
        } else {
          result.push({
            id: generateBlockId(blockIndex++, sentence.start),
            startOffset: sentence.start,
            endOffset: sentence.end,
            text: sentence.text,
            hash: hashBlock(sentence.text),
          });
        }
      }
    } else {
      result.push({
        id: generateBlockId(blockIndex++, para.start),
        startOffset: para.start,
        endOffset: para.end,
        text: para.text,
        hash: hashBlock(para.text),
      });
    }
  }

  return result;
}

/**
 * Get context for a block (previous and next block text).
 * Useful for providing LLM with surrounding context.
 *
 * @param blocks - All blocks
 * @param blockIndex - Index of the target block
 * @returns Object with previousBlockText and nextBlockText
 */
export function getBlockContext(
  blocks: RawBlock[],
  blockIndex: number
): { previousBlockText: string | null; nextBlockText: string | null } {
  return {
    previousBlockText: blockIndex > 0 ? blocks[blockIndex - 1].text : null,
    nextBlockText: blockIndex < blocks.length - 1 ? blocks[blockIndex + 1].text : null,
  };
}
