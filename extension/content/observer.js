// Main content script - Input observer
(function() {
  'use strict';
  
  // Initialize cache and renderer (from global scope)
  const cache = new window.TextCache();
  const renderer = new window.OverlayRenderer();

// Configuration
let config = {
  debounceMs: 1000,
  maxLength: 3000,
  enabled: true
};

// Debounce timers
const debounceTimers = new Map();

// Active element tracking
let activeElement = null;

/**
 * Load configuration from storage
 */
async function loadConfig() {
  const result = await chrome.storage.local.get([
    'debounce_ms',
    'max_text_length'
  ]);
  
  config.debounceMs = result.debounce_ms || 1000;
  config.maxLength = result.max_text_length || 3000;
}

/**
 * Check if element is editable and supported
 * @param {Element} element - Element to check
 * @returns {boolean} True if supported
 */
function isEditableElement(element) {
  if (!element) return false;
  
  const tagName = element.tagName?.toLowerCase();
  
  // Textareas
  if (tagName === 'textarea') return true;
  
  // Text inputs
  if (tagName === 'input' && element.type === 'text') return true;
  
  // Contenteditable
  if (element.contentEditable === 'true') return true;
  
  return false;
}

/**
 * Get text from element
 * @param {Element} element - Input element
 * @returns {string} Text content
 */
function getElementText(element) {
  if (!element) return '';
  
  if (element.contentEditable === 'true') {
    return element.textContent || '';
  }
  
  return element.value || '';
}

/**
 * Handle text input
 * @param {Element} element - Input element
 */
function handleInput(element) {
  if (!isEditableElement(element)) return;
  
  const text = getElementText(element);
  
  // Check text length
  if (text.length === 0) {
    renderer.clearOverlay(element);
    return;
  }
  
  if (text.length > config.maxLength) {
    console.log(`Text too long (${text.length} > ${config.maxLength}), skipping analysis`);
    return;
  }
  
  // Check if text changed
  if (!cache.hasChanged(element, text)) {
    return;
  }
  
  // Clear existing timer
  const elementKey = cache.getElementKey(element);
  const existingTimer = debounceTimers.get(elementKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new debounce timer
  const timer = setTimeout(() => {
    analyzeText(element, text);
  }, config.debounceMs);
  
  debounceTimers.set(elementKey, timer);
}

/**
 * Analyze text using background worker
 * @param {Element} element - Input element
 * @param {string} text - Text to analyze
 */
async function analyzeText(element, text) {
  try {
    console.log('Analyzing text:', text.substring(0, 50) + '...');
    
    const response = await chrome.runtime.sendMessage({
      action: 'analyzeText',
      text: text
    });
    
    if (!response || !response.success) {
      console.error('Analysis failed:', response?.error);
      return;
    }
    
    const { result, cached } = response;
    console.log(`Analysis complete (${cached ? 'cached' : 'new'}):`, result.suggestions?.length, 'suggestions');
    
    // Update cache
    cache.update(element, text, result);
    
    // Render suggestions
    renderer.render(element, result.suggestions);
    
  } catch (error) {
    console.error('Analysis error:', error);
  }
}

/**
 * Handle focus event
 * @param {Event} event - Focus event
 */
function handleFocus(event) {
  const element = event.target;
  
  if (!isEditableElement(element)) return;
  
  activeElement = element;
  
  // Check if we have cached analysis
  const cached = cache.get(element);
  if (cached && cached.analysis) {
    renderer.render(element, cached.analysis.suggestions);
  }
}

/**
 * Handle blur event
 * @param {Event} event - Blur event
 */
function handleBlur(event) {
  const element = event.target;
  
  if (element === activeElement) {
    activeElement = null;
  }
  
  // Keep overlay for a moment
  setTimeout(() => {
    if (activeElement !== element) {
      renderer.clearOverlay(element);
    }
  }, 300);
}

/**
 * Attach observers to element
 * @param {Element} element - Element to observe
 */
function attachObserver(element) {
  if (!isEditableElement(element)) return;
  
  // Skip if already attached
  if (element.__auroraWriteAttached) return;
  element.__auroraWriteAttached = true;
  
  // Add event listeners
  element.addEventListener('input', () => handleInput(element));
  element.addEventListener('keyup', () => handleInput(element));
  element.addEventListener('focusin', handleFocus);
  element.addEventListener('focusout', handleBlur);
}

/**
 * Scan and attach to all editable elements
 */
function scanPage() {
  // Textareas
  document.querySelectorAll('textarea').forEach(attachObserver);
  
  // Text inputs
  document.querySelectorAll('input[type="text"]').forEach(attachObserver);
  
  // Contenteditable
  document.querySelectorAll('[contenteditable="true"]').forEach(attachObserver);
}

/**
 * Initialize content script
 */
async function init() {
  console.log('AuroraWrite content script initializing...');
  
  // Load configuration
  await loadConfig();
  
  // Initial scan
  scanPage();
  
  // Watch for new elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          attachObserver(node);
          node.querySelectorAll?.('textarea, input[type="text"], [contenteditable="true"]').forEach(attachObserver);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Periodic cache cleanup
  setInterval(() => cache.cleanup(), 60000);
  
  console.log('AuroraWrite content script initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
