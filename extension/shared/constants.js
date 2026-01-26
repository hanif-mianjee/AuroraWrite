// Constants for AuroraWrite
export const CONSTANTS = {
  // Timing
  DEFAULT_DEBOUNCE_MS: 1000,
  MAX_TEXT_LENGTH: 3000,
  RATE_LIMIT_PER_TAB: 5000, // 1 request per 5 seconds per tab
  RATE_LIMIT_GLOBAL: 60000 / 3, // 3 requests per minute globally (ms per request)
  
  // Categories
  CATEGORIES: {
    GRAMMAR: 'grammar',
    SPELLING: 'spelling',
    PUNCTUATION: 'punctuation',
    STYLE: 'style'
  },
  
  // Colors
  COLORS: {
    grammar: '#ff4444',     // Red
    spelling: '#4444ff',    // Blue
    punctuation: '#ffcc00', // Yellow
    style: '#aa44ff'        // Purple
  },
  
  // Storage keys
  STORAGE_KEYS: {
    PROVIDER: 'llm_provider',
    API_KEY: 'api_key',
    MODEL_NAME: 'model_name',
    DEBOUNCE_MS: 'debounce_ms',
    MAX_LENGTH: 'max_text_length',
    DEV_MODE: 'dev_mode'
  },
  
  // Default values
  DEFAULTS: {
    PROVIDER: 'groq',
    MODEL_NAME: 'mixtral-8x7b-32768',
    DEBOUNCE_MS: 1000,
    MAX_LENGTH: 3000,
    DEV_MODE: false
  },
  
  // LLM Providers
  PROVIDERS: {
    GROQ: 'groq',
    MOCK: 'mock'
  }
};
