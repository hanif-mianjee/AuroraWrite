// Rate limiter using token bucket algorithm
export class RateLimiter {
  constructor() {
    // Per-tab rate limiting: 1 request per 5 seconds
    this.tabLimits = new Map();
    
    // Global rate limiting: 3 requests per minute
    this.globalTokens = 3;
    this.globalLastRefill = Date.now();
    this.globalRefillInterval = 60000; // 1 minute
    this.globalMaxTokens = 3;
  }
  
  /**
   * Check if request is allowed for a specific tab
   * @param {number} tabId - Tab identifier
   * @returns {boolean} True if allowed
   */
  allowRequest(tabId) {
    const now = Date.now();
    
    // Check global rate limit
    this.refillGlobalTokens(now);
    if (this.globalTokens < 1) {
      console.log('Global rate limit exceeded');
      return false;
    }
    
    // Check per-tab rate limit
    const tabLimit = this.tabLimits.get(tabId);
    if (tabLimit && (now - tabLimit) < 5000) {
      console.log(`Tab ${tabId} rate limit exceeded`);
      return false;
    }
    
    // Allow request
    this.tabLimits.set(tabId, now);
    this.globalTokens--;
    
    return true;
  }
  
  /**
   * Refill global tokens based on time elapsed
   * @param {number} now - Current timestamp
   */
  refillGlobalTokens(now) {
    const elapsed = now - this.globalLastRefill;
    if (elapsed >= this.globalRefillInterval) {
      const intervals = Math.floor(elapsed / this.globalRefillInterval);
      this.globalTokens = Math.min(
        this.globalMaxTokens,
        this.globalTokens + (intervals * this.globalMaxTokens)
      );
      this.globalLastRefill = now;
    }
  }
  
  /**
   * Clean up old tab entries
   */
  cleanup() {
    const now = Date.now();
    for (const [tabId, timestamp] of this.tabLimits.entries()) {
      if (now - timestamp > 60000) {
        this.tabLimits.delete(tabId);
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Periodic cleanup
setInterval(() => rateLimiter.cleanup(), 60000);
