import type { AnalysisResult, TextIssue, IssueCategory } from '../shared/types/analysis';
import type { Settings } from '../shared/types/settings';
import { RateLimiter } from './rate-limiter';
import { CacheManager } from './cache-manager';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a writing assistant that detects errors and issues. Flag problems but do NOT endlessly suggest improvements.

Categories to check:
- spelling: Misspelled words (e.g., "teh" → "the", "recieve" → "receive")
- grammar: Grammatical errors (e.g., "he go" → "he goes", "a apple" → "an apple", missing punctuation)
- style: ONLY flag if there's a clear problem like: extreme wordiness, very awkward phrasing, or obvious redundancy
- clarity: ONLY flag if genuinely confusing or ambiguous

IMPORTANT RULES:
1. If text is correct and readable, return NO issues - don't suggest "better" alternatives
2. Don't flag passive voice unless it's truly confusing
3. Don't suggest restructuring sentences that are already clear
4. Don't flag informal tone unless specifically wrong for context
5. Once text is fixed, it should have NO more issues - don't create endless improvement cycles

For each issue, provide:
1. originalText - the EXACT text with the issue (copy character-for-character)
2. suggestedText - the fix
3. explanation - 1 sentence max

Respond with JSON:
{
  "issues": [
    {
      "category": "spelling|grammar|style|clarity",
      "originalText": "<exact text>",
      "suggestedText": "<fix>",
      "explanation": "<brief explanation>"
    }
  ]
}

If text is acceptable, return: {"issues": []}`;

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
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this text for issues. Only report issues in these categories: ${enabledCategories.join(', ')}\n\nText:\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
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
    return ['spelling', 'grammar', 'style', 'clarity', 'tone'].includes(category);
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
          model: MODEL,
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
}
