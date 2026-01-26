// Schema definitions for AuroraWrite

/**
 * Suggestion schema - returned by all LLM providers
 * @typedef {Object} Suggestion
 * @property {string} id - Unique identifier (UUID)
 * @property {string} category - One of: grammar, spelling, punctuation, style
 * @property {number} start - Start position in text
 * @property {number} end - End position in text
 * @property {string} original - Original text
 * @property {string[]} replacements - Suggested replacements
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * Analysis response schema
 * @typedef {Object} AnalysisResponse
 * @property {Suggestion[]} suggestions - Array of suggestions
 */

/**
 * Validates a suggestion object
 * @param {any} suggestion - Object to validate
 * @returns {boolean} True if valid
 */
export function isValidSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return false;
  
  const requiredFields = ['id', 'category', 'start', 'end', 'original', 'replacements', 'confidence'];
  const validCategories = ['grammar', 'spelling', 'punctuation', 'style'];
  
  for (const field of requiredFields) {
    if (!(field in suggestion)) return false;
  }
  
  if (!validCategories.includes(suggestion.category)) return false;
  if (!Array.isArray(suggestion.replacements)) return false;
  if (typeof suggestion.confidence !== 'number' || suggestion.confidence < 0 || suggestion.confidence > 1) return false;
  
  return true;
}

/**
 * Validates an analysis response
 * @param {any} response - Response to validate
 * @returns {boolean} True if valid
 */
export function isValidAnalysisResponse(response) {
  if (!response || typeof response !== 'object') return false;
  if (!Array.isArray(response.suggestions)) return false;
  
  return response.suggestions.every(isValidSuggestion);
}
