/**
 * Block Hasher
 *
 * Provides efficient hashing for text blocks to detect changes.
 * Uses a fast string hash algorithm optimized for short text blocks.
 */

/**
 * Generate a hash for a text block.
 * Uses djb2 algorithm for fast, collision-resistant hashing.
 *
 * @param text - The text content to hash
 * @returns A hex string hash of the text
 */
export function hashBlock(text: string): string {
  if (!text) return '0';

  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    // Keep hash within 32-bit integer range
    hash = hash >>> 0;
  }

  return hash.toString(16);
}

/**
 * Compare two hashes for equality.
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns True if hashes are identical
 */
export function hashesEqual(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
