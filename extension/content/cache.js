// Cache manager for content script
export class TextCache {
  constructor() {
    this.cache = new Map();
  }
  
  /**
   * Generate hash for text
   * @param {string} text - Text to hash
   * @returns {string} Hash string
   */
  hash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  /**
   * Check if text has changed
   * @param {Element} element - Input element
   * @param {string} text - Current text
   * @returns {boolean} True if changed
   */
  hasChanged(element, text) {
    const key = this.getElementKey(element);
    const cached = this.cache.get(key);
    
    if (!cached) return true;
    
    const currentHash = this.hash(text);
    return cached.hash !== currentHash;
  }
  
  /**
   * Update cache for element
   * @param {Element} element - Input element
   * @param {string} text - Text content
   * @param {Object} analysis - Analysis result
   */
  update(element, text, analysis) {
    const key = this.getElementKey(element);
    this.cache.set(key, {
      text,
      hash: this.hash(text),
      analysis,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get cached data for element
   * @param {Element} element - Input element
   * @returns {Object|null} Cached data
   */
  get(element) {
    const key = this.getElementKey(element);
    return this.cache.get(key) || null;
  }
  
  /**
   * Clear cache for element
   * @param {Element} element - Input element
   */
  clear(element) {
    const key = this.getElementKey(element);
    this.cache.delete(key);
  }
  
  /**
   * Get unique key for element
   * @param {Element} element - Input element
   * @returns {string} Unique key
   */
  getElementKey(element) {
    if (!element.__auroraWriteId) {
      element.__auroraWriteId = `aw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return element.__auroraWriteId;
  }
  
  /**
   * Clean up old cache entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }
}
