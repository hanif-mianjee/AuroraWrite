// Mock LLM Provider for testing and offline mode
import { LLMProvider } from './provider.js';

export class MockProvider extends LLMProvider {
  getName() {
    return 'mock';
  }
  
  async analyzeText(text, config) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const suggestions = [];
    
    // Simple mock rules for demonstration
    
    // Check for "has went" -> "has gone"
    const hasWentMatch = text.match(/has went/gi);
    if (hasWentMatch) {
      const index = text.toLowerCase().indexOf('has went');
      suggestions.push({
        id: `mock-${Date.now()}-1`,
        category: 'grammar',
        start: index,
        end: index + 8,
        original: 'has went',
        replacements: ['has gone'],
        confidence: 0.95
      });
    }
    
    // Check for common misspellings
    const misspellings = [
      { wrong: 'recieve', correct: 'receive' },
      { wrong: 'occured', correct: 'occurred' },
      { wrong: 'seperate', correct: 'separate' },
      { wrong: 'definately', correct: 'definitely' }
    ];
    
    misspellings.forEach((spelling, idx) => {
      const regex = new RegExp(spelling.wrong, 'gi');
      const match = text.match(regex);
      if (match) {
        const index = text.toLowerCase().indexOf(spelling.wrong);
        suggestions.push({
          id: `mock-${Date.now()}-spell-${idx}`,
          category: 'spelling',
          start: index,
          end: index + spelling.wrong.length,
          original: spelling.wrong,
          replacements: [spelling.correct],
          confidence: 0.98
        });
      }
    });
    
    // Check for missing punctuation at end
    if (text.length > 10 && !text.trim().match(/[.!?]$/)) {
      suggestions.push({
        id: `mock-${Date.now()}-punct`,
        category: 'punctuation',
        start: text.length,
        end: text.length,
        original: '',
        replacements: ['.'],
        confidence: 0.7
      });
    }
    
    // Check for style - passive voice (simple detection)
    const passiveMatch = text.match(/\b(is|are|was|were) \w+ed\b/gi);
    if (passiveMatch) {
      const index = text.toLowerCase().indexOf(passiveMatch[0].toLowerCase());
      suggestions.push({
        id: `mock-${Date.now()}-style`,
        category: 'style',
        start: index,
        end: index + passiveMatch[0].length,
        original: passiveMatch[0],
        replacements: ['Consider using active voice'],
        confidence: 0.6
      });
    }
    
    return { suggestions };
  }
}
