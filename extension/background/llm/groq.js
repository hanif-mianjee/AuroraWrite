// Groq LLM Provider
import { LLMProvider } from './provider.js';

export class GroqProvider extends LLMProvider {
  getName() {
    return 'groq';
  }
  
  async analyzeText(text, config) {
    const apiKey = config.apiKey;
    const model = config.model || 'mixtral-8x7b-32768';
    
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }
    
    const systemPrompt = `You are a professional grammar and writing assistant. Analyze the provided text and return a JSON object with suggestions for improvements in grammar, spelling, punctuation, and style.

Return your response in this exact JSON format:
{
  "suggestions": [
    {
      "id": "unique-id",
      "category": "grammar|spelling|punctuation|style",
      "start": 0,
      "end": 10,
      "original": "text with issue",
      "replacements": ["corrected text"],
      "confidence": 0.95
    }
  ]
}

Rules:
- Only include actual errors or improvements
- Be conservative - don't flag correct text
- Provide clear, helpful replacements
- Use confidence scores: 0.9+ for clear errors, 0.7-0.9 for suggestions
- Return empty suggestions array if text is perfect`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      const result = JSON.parse(content);
      
      // Ensure we have the right structure
      if (!result.suggestions) {
        result.suggestions = [];
      }
      
      // Add unique IDs if missing
      result.suggestions = result.suggestions.map((s, idx) => ({
        ...s,
        id: s.id || `groq-${Date.now()}-${idx}`
      }));
      
      return result;
    } catch (error) {
      console.error('Groq provider error:', error);
      throw error;
    }
  }
}
