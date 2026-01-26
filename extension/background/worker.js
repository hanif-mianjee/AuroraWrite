// Background service worker for AuroraWrite
import { GroqProvider } from './llm/groq.js';
import { MockProvider } from './llm/mock.js';
import { rateLimiter } from './ratelimit.js';
import { isValidAnalysisResponse } from '../shared/schema.js';

// Initialize providers
const providers = {
  groq: new GroqProvider(),
  mock: new MockProvider()
};

// Cache for analysis results
const analysisCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Get configuration from storage
 * @returns {Promise<Object>} Configuration object
 */
async function getConfig() {
  const result = await chrome.storage.local.get([
    'llm_provider',
    'api_key',
    'model_name',
    'dev_mode'
  ]);
  
  return {
    provider: result.llm_provider || 'mock',
    apiKey: result.api_key || '',
    model: result.model_name || 'mixtral-8x7b-32768',
    devMode: result.dev_mode || false
  };
}

/**
 * Generate hash for text
 * @param {string} text - Text to hash
 * @returns {string} Hash string
 */
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Handle analyze text request
 * @param {Object} request - Request object
 * @param {Object} sender - Sender information
 * @returns {Promise<Object>} Analysis result
 */
async function handleAnalyzeText(request, sender) {
  const { text } = request;
  const tabId = sender.tab?.id || 0;
  
  try {
    // Check rate limit
    if (!rateLimiter.allowRequest(tabId)) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait before trying again.'
      };
    }
    
    // Check cache
    const textHash = hashText(text);
    if (analysisCache.has(textHash)) {
      console.log('Returning cached result for hash:', textHash);
      return {
        success: true,
        result: analysisCache.get(textHash),
        cached: true
      };
    }
    
    // Get configuration
    const config = await getConfig();
    
    if (config.devMode) {
      console.log('Analysis request:', { text: text.substring(0, 100), tabId, config });
    }
    
    // Get provider
    const provider = providers[config.provider];
    if (!provider) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }
    
    // Analyze text
    const startTime = Date.now();
    const result = await provider.analyzeText(text, config);
    const latency = Date.now() - startTime;
    
    if (config.devMode) {
      console.log('Analysis result:', { latency, suggestionsCount: result.suggestions?.length });
    }
    
    // Validate result
    if (!isValidAnalysisResponse(result)) {
      console.error('Invalid analysis response:', result);
      return {
        success: false,
        error: 'Invalid response from analysis provider'
      };
    }
    
    // Cache result
    if (analysisCache.size >= MAX_CACHE_SIZE) {
      const firstKey = analysisCache.keys().next().value;
      analysisCache.delete(firstKey);
    }
    analysisCache.set(textHash, result);
    
    return {
      success: true,
      result,
      latency,
      cached: false
    };
    
  } catch (error) {
    console.error('Analysis error:', error);
    return {
      success: false,
      error: error.message || 'Analysis failed'
    };
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeText') {
    handleAnalyzeText(request, sender).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'clearCache') {
    analysisCache.clear();
    sendResponse({ success: true });
    return true;
  }
});

console.log('AuroraWrite background worker initialized');
