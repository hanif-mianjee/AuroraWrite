// Overlay renderer for suggestions
(function() {
  'use strict';
  
  // Constants (inline for content script)
  const COLORS = {
    grammar: '#ff4444',
    spelling: '#4444ff',
    punctuation: '#ffcc00',
    style: '#aa44ff'
  };
  
  window.OverlayRenderer = class OverlayRenderer {
  constructor() {
    this.overlays = new Map();
    this.popovers = new Map();
    this.badges = new Map();
  }
  
  /**
   * Render suggestions for an element
   * @param {Element} element - Input element
   * @param {Array} suggestions - Suggestions to render
   */
  render(element, suggestions) {
    this.clearOverlay(element);
    
    if (!suggestions || suggestions.length === 0) {
      return;
    }
    
    const elementKey = this.getElementKey(element);
    
    // Create underlines for each suggestion
    suggestions.forEach(suggestion => {
      this.createUnderline(element, suggestion);
    });
    
    // Create error badge
    this.createBadge(element, suggestions);
  }
  
  /**
   * Create underline for a suggestion
   * @param {Element} element - Input element
   * @param {Object} suggestion - Suggestion object
   */
  createUnderline(element, suggestion) {
    // For contenteditable, we can add spans
    // For textarea/input, we need an overlay approach
    
    const isContentEditable = element.contentEditable === 'true';
    
    if (isContentEditable) {
      // For contenteditable, mark the text directly
      this.markContentEditableText(element, suggestion);
    } else {
      // For textarea/input, create visual overlay
      this.createTextareaOverlay(element, suggestion);
    }
  }
  
  /**
   * Mark text in contenteditable element
   * @param {Element} element - Contenteditable element
   * @param {Object} suggestion - Suggestion object
   */
  markContentEditableText(element, suggestion) {
    const text = element.textContent || '';
    const { start, end, category } = suggestion;
    
    // Create marker span
    const marker = document.createElement('span');
    marker.className = `aurora-write-underline aurora-write-${category}`;
    marker.dataset.suggestionId = suggestion.id;
    marker.style.textDecoration = 'underline';
    marker.style.textDecorationColor = COLORS[category];
    marker.style.textDecorationThickness = '3px';
    marker.style.textUnderlineOffset = '3px';
    marker.style.cursor = 'pointer';
    
    // Add hover event
    marker.addEventListener('mouseenter', (e) => {
      this.showPopover(e.target, suggestion);
    });
    
    marker.addEventListener('mouseleave', () => {
      this.hidePopover();
    });
    
    // Store suggestion for later
    marker.__auroraSuggestion = suggestion;
    marker.__auroraElement = element;
  }
  
  /**
   * Create overlay for textarea/input
   * @param {Element} element - Textarea or input element
   * @param {Object} suggestion - Suggestion object
   */
  createTextareaOverlay(element, suggestion) {
    const elementKey = this.getElementKey(element);
    
    // Get or create overlay container
    let overlay = this.overlays.get(elementKey);
    if (!overlay) {
      overlay = this.createOverlayContainer(element);
      this.overlays.set(elementKey, overlay);
    }
    
    const text = element.value || '';
    const { start, end, category } = suggestion;
    
    // Create underline span
    const underline = document.createElement('span');
    underline.className = `aurora-write-underline aurora-write-${category}`;
    underline.dataset.suggestionId = suggestion.id;
    underline.textContent = text.substring(start, end);
    underline.style.borderBottom = `3px solid ${COLORS[category]}`;
    underline.style.cursor = 'pointer';
    underline.style.position = 'relative';
    
    // Add hover events
    underline.addEventListener('mouseenter', (e) => {
      this.showPopover(e.target, suggestion, element);
    });
    
    underline.addEventListener('mouseleave', () => {
      this.hidePopover();
    });
    
    underline.__auroraSuggestion = suggestion;
    underline.__auroraElement = element;
    
    overlay.appendChild(underline);
  }
  
  /**
   * Create overlay container for element
   * @param {Element} element - Input element
   * @returns {Element} Overlay container
   */
  createOverlayContainer(element) {
    const overlay = document.createElement('div');
    overlay.className = 'aurora-write-overlay';
    overlay.style.position = 'absolute';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    
    // Position overlay
    const rect = element.getBoundingClientRect();
    overlay.style.left = rect.left + window.scrollX + 'px';
    overlay.style.top = rect.top + window.scrollY + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    
    document.body.appendChild(overlay);
    
    return overlay;
  }
  
  /**
   * Show popover for suggestion
   * @param {Element} target - Target element
   * @param {Object} suggestion - Suggestion object
   * @param {Element} inputElement - Original input element
   */
  showPopover(target, suggestion, inputElement) {
    this.hidePopover();
    
    const popover = document.createElement('div');
    popover.className = 'aurora-write-popover';
    
    const category = document.createElement('div');
    category.className = 'aurora-write-popover-category';
    category.textContent = suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1);
    category.style.color = COLORS[suggestion.category];
    category.style.fontWeight = 'bold';
    category.style.marginBottom = '8px';
    
    const original = document.createElement('div');
    original.className = 'aurora-write-popover-original';
    original.textContent = suggestion.original || '(text)';
    original.style.textDecoration = 'line-through';
    original.style.marginBottom = '4px';
    original.style.color = '#666';
    
    popover.appendChild(category);
    popover.appendChild(original);
    
    // Add replacements
    suggestion.replacements.forEach((replacement, idx) => {
      const replacementDiv = document.createElement('div');
      replacementDiv.className = 'aurora-write-popover-replacement';
      replacementDiv.textContent = `→ ${replacement}`;
      replacementDiv.style.cursor = 'pointer';
      replacementDiv.style.padding = '4px';
      replacementDiv.style.marginBottom = '2px';
      replacementDiv.style.borderRadius = '3px';
      
      replacementDiv.addEventListener('mouseenter', () => {
        replacementDiv.style.backgroundColor = '#e8f4f8';
      });
      
      replacementDiv.addEventListener('mouseleave', () => {
        replacementDiv.style.backgroundColor = 'transparent';
      });
      
      replacementDiv.addEventListener('click', () => {
        this.applyReplacement(inputElement || suggestion.__auroraElement, suggestion, replacement);
        this.hidePopover();
      });
      
      popover.appendChild(replacementDiv);
    });
    
    // Position popover
    const rect = target.getBoundingClientRect();
    popover.style.left = rect.left + window.scrollX + 'px';
    popover.style.top = rect.bottom + window.scrollY + 5 + 'px';
    
    document.body.appendChild(popover);
    this.currentPopover = popover;
  }
  
  /**
   * Hide popover
   */
  hidePopover() {
    if (this.currentPopover) {
      this.currentPopover.remove();
      this.currentPopover = null;
    }
  }
  
  /**
   * Apply replacement to text
   * @param {Element} element - Input element
   * @param {Object} suggestion - Suggestion object
   * @param {string} replacement - Replacement text
   */
  applyReplacement(element, suggestion, replacement) {
    if (!element) return;
    
    const isContentEditable = element.contentEditable === 'true';
    
    if (isContentEditable) {
      const text = element.textContent || '';
      const newText = text.substring(0, suggestion.start) + replacement + text.substring(suggestion.end);
      element.textContent = newText;
    } else {
      const text = element.value || '';
      const newText = text.substring(0, suggestion.start) + replacement + text.substring(suggestion.end);
      element.value = newText;
      
      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Clear overlay and trigger re-analysis
    this.clearOverlay(element);
  }
  
  /**
   * Create error badge for element
   * @param {Element} element - Input element
   * @param {Array} suggestions - All suggestions
   */
  createBadge(element, suggestions) {
    const elementKey = this.getElementKey(element);
    
    // Remove existing badge
    const existingBadge = this.badges.get(elementKey);
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Count by category
    const counts = {
      grammar: 0,
      spelling: 0,
      punctuation: 0,
      style: 0
    };
    
    suggestions.forEach(s => {
      if (counts[s.category] !== undefined) {
        counts[s.category]++;
      }
    });
    
    // Create badge
    const badge = document.createElement('div');
    badge.className = 'aurora-write-badge';
    
    // Add counts
    Object.entries(counts).forEach(([category, count]) => {
      if (count > 0) {
        const item = document.createElement('span');
        item.className = `aurora-write-badge-item aurora-write-badge-${category}`;
        item.textContent = count;
        item.style.backgroundColor = COLORS[category];
        badge.appendChild(item);
      }
    });
    
    // Position badge
    const rect = element.getBoundingClientRect();
    badge.style.left = (rect.right - 100 + window.scrollX) + 'px';
    badge.style.top = (rect.bottom - 30 + window.scrollY) + 'px';
    
    document.body.appendChild(badge);
    this.badges.set(elementKey, badge);
  }
  
  /**
   * Clear overlay for element
   * @param {Element} element - Input element
   */
  clearOverlay(element) {
    const elementKey = this.getElementKey(element);
    
    // Remove overlay
    const overlay = this.overlays.get(elementKey);
    if (overlay) {
      overlay.remove();
      this.overlays.delete(elementKey);
    }
    
    // Remove badge
    const badge = this.badges.get(elementKey);
    if (badge) {
      badge.remove();
      this.badges.delete(elementKey);
    }
    
    // Hide popover
    this.hidePopover();
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
};
})();
