import type { AnalysisResult, TextIssue, IssueCategory } from '../shared/types/analysis';
import type { Settings } from '../shared/types/settings';
import type { TransformationType } from '../shared/types/messages';
import { RateLimiter } from './rate-limiter';
import { CacheManager } from './cache-manager';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a strict proofreader. Find ALL errors in ONE pass. Be conservative—only flag clear mistakes.

CATEGORIES (be strict):
• spelling: ONLY actual typos/misspellings. Single misspelled WORDS only, not sentences. Examples: "teh"→"the", "recieve"→"receive", "definately"→"definitely"
• grammar: Clear grammatical errors. Examples: "he go"→"he goes", "a apple"→"an apple", "their going"→"they're going"
• style: Repeated words, double spaces. Examples: "the the"→"the", "very very"→"very"
• clarity: Wordy phrases that have standard shorter forms. Examples: "in order to"→"to", "due to the fact that"→"because"
• rephrase: ONLY for genuinely awkward/unclear sentences. Do NOT suggest alternatives to correct text.

CRITICAL RULES:
1. Find ALL issues in the text at once—do not hold back issues for later
2. originalText must EXACTLY match text from input (character-for-character)
3. suggestedText must be DIFFERENT from originalText (if they're the same, don't include it)
4. For spelling: originalText should be the misspelled WORD only, not the whole sentence
5. Do NOT flag correct text. If unsure, skip it.
6. Do NOT suggest stylistic alternatives to correct writing
7. Be conservative: fewer false positives is better than catching everything

OUTPUT FORMAT (strict JSON):
{
  "issues": [
    {
      "category": "spelling|grammar|style|clarity|rephrase",
      "originalText": "exact text from input",
      "suggestedText": "corrected text (must be different)",
      "explanation": "Brief reason"
    }
  ]
}

If text has no errors, return: {"issues": []}`;

interface GroqResponse {
  issues: Array<{
    category: string;
    originalText: string;
    suggestedText: string;
    explanation: string;
  }>;
}

export class GroqClient {
  private rateLimiter: RateLimiter;
  private cache: CacheManager;
  private pendingRequests: Map<string, Promise<AnalysisResult>> = new Map();

  constructor() {
    this.rateLimiter = new RateLimiter(30, 60000);
    this.cache = new CacheManager(100, 300000);
  }

  async analyzeText(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult> {
    if (!text.trim() || text.length < 3) {
      return { text, issues: [], timestamp: Date.now() };
    }

    const cached = this.cache.get(text);
    if (cached) {
      return this.filterIssues(cached, settings);
    }

    const pendingKey = text;
    const pending = this.pendingRequests.get(pendingKey);
    if (pending) {
      return pending;
    }

    const promise = this.performAnalysis(text, apiKey, settings);
    this.pendingRequests.set(pendingKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(pendingKey);
    }
  }

  private async performAnalysis(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.recordRequest();

    const enabledCategories = Object.entries(settings.categories)
      .filter(([_, config]) => config.enabled)
      .map(([category]) => category);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this text for issues. Only report issues in these categories: ${enabledCategories.join(', ')}\n\nText:\n${text}` },
        ],
        temperature: 0.05,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Parse rate limit errors for user-friendly message
      if (response.status === 429) {
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || '';

          // Extract wait time if present
          const waitMatch = message.match(/try again in (\d+m\d+)/);
          const waitTime = waitMatch ? waitMatch[1] : '5 minutes';

          throw new Error(`Rate limit reached. Please wait ${waitTime} or upgrade your Groq plan.`);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Rate limit')) {
            throw e;
          }
          throw new Error('Rate limit reached. Please wait a few minutes.');
        }
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('[AuroraWrite] Raw Groq response:', content);

    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    const parsed = this.parseResponse(content, text);
    console.log('[AuroraWrite] Parsed issues before filtering:', parsed.length);
    const result: AnalysisResult = {
      text,
      issues: parsed,
      timestamp: Date.now(),
    };

    this.cache.set(text, result);
    return this.filterIssues(result, settings);
  }

  private parseResponse(content: string, originalText: string): TextIssue[] {
    let parsed: GroqResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('[AuroraWrite] Failed to parse Groq response:', content);
      return [];
    }

    console.log('[AuroraWrite] Parsed JSON, issues array:', parsed.issues);
    console.log('[AuroraWrite] Original text for matching:', originalText);

    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      console.log('[AuroraWrite] No issues array in response');
      return [];
    }

    const usedRanges: Array<{ start: number; end: number }> = [];
    const issues: TextIssue[] = [];

    for (const issue of parsed.issues) {
      if (!this.isValidCategory(issue.category)) continue;
      if (!issue.originalText || !issue.suggestedText) continue;

      // Filter out false positives where original equals suggested
      const normalizedOriginal = issue.originalText.trim().toLowerCase();
      const normalizedSuggested = issue.suggestedText.trim().toLowerCase();
      if (normalizedOriginal === normalizedSuggested) {
        console.log('[AuroraWrite] Skipping false positive - same text:', issue.originalText);
        continue;
      }

      // Find the originalText in the text, trying exact match first
      let startOffset = this.findTextPosition(originalText, issue.originalText, usedRanges);

      if (startOffset === -1) {
        // Try case-insensitive search
        startOffset = this.findTextPositionCaseInsensitive(originalText, issue.originalText, usedRanges);
      }

      if (startOffset === -1) {
        console.warn(`Could not find "${issue.originalText}" in text`);
        continue;
      }

      const endOffset = startOffset + issue.originalText.length;

      // Mark this range as used to avoid duplicate matches
      usedRanges.push({ start: startOffset, end: endOffset });

      // Get the actual text at this position (for case-insensitive matches)
      const actualText = originalText.substring(startOffset, endOffset);

      issues.push({
        id: `issue_${Date.now()}_${issues.length}`,
        category: issue.category as IssueCategory,
        startOffset,
        endOffset,
        originalText: actualText,
        suggestedText: issue.suggestedText,
        explanation: issue.explanation,
      });
    }

    return issues;
  }

  private findTextPosition(text: string, searchText: string, usedRanges: Array<{ start: number; end: number }>): number {
    let startIndex = 0;

    while (true) {
      const index = text.indexOf(searchText, startIndex);
      if (index === -1) return -1;

      // Check if this range overlaps with any used range
      const overlaps = usedRanges.some(
        (range) => !(index + searchText.length <= range.start || index >= range.end)
      );

      if (!overlaps) {
        return index;
      }

      startIndex = index + 1;
    }
  }

  private findTextPositionCaseInsensitive(text: string, searchText: string, usedRanges: Array<{ start: number; end: number }>): number {
    const lowerText = text.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    let startIndex = 0;

    while (true) {
      const index = lowerText.indexOf(lowerSearch, startIndex);
      if (index === -1) return -1;

      // Check if this range overlaps with any used range
      const overlaps = usedRanges.some(
        (range) => !(index + searchText.length <= range.start || index >= range.end)
      );

      if (!overlaps) {
        return index;
      }

      startIndex = index + 1;
    }
  }

  private isValidCategory(category: string): category is IssueCategory {
    return ['spelling', 'grammar', 'style', 'clarity', 'tone', 'rephrase'].includes(category);
  }

  private filterIssues(result: AnalysisResult, settings: Settings): AnalysisResult {
    const filteredIssues = result.issues.filter((issue) => {
      if (!settings.categories[issue.category]?.enabled) return false;

      const lowerOriginal = issue.originalText.toLowerCase();
      if (settings.ignoredWords.includes(lowerOriginal)) return false;

      return true;
    });

    return { ...result, issues: filteredIssues };
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  async transformText(
    text: string,
    transformationType: TransformationType,
    apiKey: string,
    settings: Settings,
    customPrompt?: string
  ): Promise<string> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.recordRequest();

    const systemPrompt = this.getTransformPrompt(transformationType, customPrompt);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || '';
          const waitMatch = message.match(/try again in (\d+m\d+)/);
          const waitTime = waitMatch ? waitMatch[1] : '5 minutes';
          throw new Error(`Rate limit reached. Please wait ${waitTime}.`);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Rate limit')) {
            throw e;
          }
          throw new Error('Rate limit reached. Please wait a few minutes.');
        }
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from API');
    }

    return content.trim();
  }

  private getTransformPrompt(type: TransformationType, customPrompt?: string): string {
    const prompts: Record<TransformationType, string> = {
      improve: `You are a writing improvement assistant. Improve the following text by fixing any errors and enhancing clarity while preserving the original meaning and tone. Output ONLY the improved text, nothing else.`,
      rephrase: `You are a writing assistant. Rephrase the following text to express the same meaning in a different way. Keep the same tone and level of formality. Output ONLY the rephrased text, nothing else.`,
      translate: `You are a translation assistant. Auto-detect the source language and translate the following text to English. If the text is already in English, translate it to Spanish. Output ONLY the translated text, nothing else.`,
      shorten: `You are a writing assistant. Shorten the following text while preserving the key meaning and information. Make it more concise. Output ONLY the shortened text, nothing else.`,
      friendly: `You are a writing assistant. Rewrite the following text to sound more friendly and casual while keeping the same meaning. Output ONLY the rewritten text, nothing else.`,
      formal: `You are a writing assistant. Rewrite the following text to sound more formal and professional while keeping the same meaning. Output ONLY the rewritten text, nothing else.`,
      custom: customPrompt
        ? `${customPrompt}\n\nApply this to the following text. Output ONLY the transformed text, nothing else.`
        : `Transform the following text as requested. Output ONLY the transformed text, nothing else.`,
    };

    return prompts[type] || prompts.improve;
  }
}
