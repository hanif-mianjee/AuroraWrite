// Base provider interface for LLM providers
export class LLMProvider {
  /**
   * Analyze text and return suggestions
   * @param {string} text - Text to analyze
   * @param {Object} config - Provider configuration
   * @returns {Promise<Object>} Analysis response
   */
  async analyzeText(text, config) {
    throw new Error('analyzeText must be implemented by provider');
  }
  
  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    throw new Error('getName must be implemented by provider');
  }
}
