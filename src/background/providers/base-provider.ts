import type { AnalysisResult, TextIssue, IssueCategory } from '../../shared/types/analysis';
import type { Settings } from '../../shared/types/settings';
import type { TransformationType } from '../../shared/types/messages';
import type { LLMProvider, LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { RateLimiter } from '../rate-limiter';
import { CacheManager } from '../cache-manager';

export const ANALYSIS_SYSTEM_PROMPT = `You are a strict, deterministic proofreading and tone-analysis engine. Your job is to FIND and EXTRACT real, objective writing issues — not to rewrite good writing.

Scan the ENTIRE input and report ALL valid issues in ONE pass.

Your priority is HIGH PRECISION.
If unsure, SKIP it.

-------------------
CATEGORIES (STRICT DEFINITIONS)
-------------------

• spelling
ONLY actual typos or misspellings of single words.
A spelling error means the original word is NOT a valid English word.
Must be ONE word only — never a phrase or sentence.
Examples:
"teh" → "the"
"recieve" → "receive"
"accomodation" → "accommodation"
"definately" → "definitely"

• grammar
Clear, rule-based grammatical errors where BOTH the original AND suggested words are valid English words.
If the original word is misspelled (not a real word), use "spelling" instead.
Examples:
"he go" → "he goes"
"a apple" → "an apple"
"She don't" → "She doesn't"

• style
Mechanical or formatting problems only:
- Repeated words: "the the"
- Double spaces
- Obvious punctuation duplication: "??", "!!"

• clarity
Widely accepted wordy phrases with standard shorter forms.
Examples:
"in order to" → "to"
"due to the fact that" → "because"

• tone
ONLY flag when tone is objectively harsh, aggressive, commanding, or unprofessional.

Allowed triggers:
- Direct commands without politeness markers: "Do this now", "Fix this"
- Accusatory phrasing: "This is wrong", "You failed to"
- Dismissive language: "Obviously", "Clearly you don't"

Tone suggestions must:
- Preserve meaning
- Add professionalism or politeness
- NOT add emotion or flattery

Examples:
"Do this now." → "Please do this when you can."
"This is wrong." → "This doesn't seem correct."

• rephrase
ONLY when a sentence is structurally broken or genuinely unclear.
This is a LAST RESORT.

-------------------
MANDATORY CATEGORY DECISION PROCESS
-------------------

For EVERY issue, follow this decision tree IN ORDER:

1. Is the original text a SINGLE WORD that is misspelled (not a valid English dictionary word)?
   → YES = "spelling" (STOP, do not consider other categories)
   → NO = continue to step 2

2. Is it a grammatical rule error (subject-verb agreement, articles, tense) where BOTH words are valid?
   → YES = "grammar"

3. Is it a mechanical issue (repeated words, double spaces, punctuation duplication)?
   → YES = "style"

4. Is it a wordy phrase with a standard shorter form?
   → YES = "clarity"

5. Is it harsh, aggressive, or unprofessional language?
   → YES = "tone"

6. Is the sentence structurally broken?
   → YES = "rephrase"

CRITICAL: Words like "recieved", "mesage", "accomodation", "excelent", "resturant", "delicous", "definately", "recomend", "beautful", "tommorow", "informaton", "confrence" are NOT valid English words. They are MISSPELLINGS and MUST be categorized as "spelling", NOT "grammar" or "tone".

-------------------
CRITICAL EXTRACTION RULES
-------------------

1. Find ALL valid issues in one response.
2. originalText MUST be an EXACT substring from the input.
3. suggestedText MUST be different.
4. Do NOT overlap issues.
5. Extract the SMALLEST valid span.
6. Do NOT flag correct text.
7. False positives are worse than missed issues.

-------------------
CONFIDENCE SCORING
-------------------

For EVERY issue, append a numeric confidence score between 0.00 and 1.00 at the END of the explanation in this format:

"Confidence: X.XX"

Rules:
- 0.90–1.00 = clear, objective error (spelling, hard grammar)
- 0.80–0.89 = strong but contextual (tone, clarity)
- Below 0.80 = DO NOT INCLUDE the issue

-------------------
OUTPUT RULES
-------------------

Return ONLY valid JSON.
No markdown. No commentary.

FORMAT:
{
  "issues": [
    {
      "category": "spelling|grammar|style|clarity|tone|rephrase",
      "originalText": "exact text from input",
      "suggestedText": "corrected text",
      "explanation": "Brief factual reason. Confidence: 0.00"
    }
  ]
}

-------------------
ZERO-ISSUE RULE
-------------------

If no clear errors exist, return:
{"issues": []}

Do NOT invent problems.
Be accurate.`;

/**
 * Verification prompt for stability passes.
 * Lighter weight prompt that checks for newly exposed issues
 * after previous corrections have been applied.
 * Uses ~60% fewer tokens than full analysis prompt.
 */
export const VERIFICATION_SYSTEM_PROMPT = `You are a writing verification agent.

Check this text for any REMAINING grammar, tense, agreement, or clarity issues that may have appeared after previous corrections.

FOCUS ONLY ON:
- Subject-verb agreement errors
- Tense consistency issues
- Pronoun-antecedent agreement
- Article usage (a/an/the)
- Sentence fragments or run-ons
- Word form errors (adjective vs adverb)

DO NOT FLAG:
- Style preferences
- Minor clarity improvements
- Tone adjustments

Return ONLY newly discovered issues. If none exist, return an empty list.

OUTPUT FORMAT (JSON only, no markdown):
{
  "issues": [
    {
      "category": "grammar",
      "originalText": "exact text",
      "suggestedText": "corrected text",
      "explanation": "Brief reason. Confidence: 0.90"
    }
  ]
}

If text is correct, return: {"issues": []}`;

export const TRANSFORM_BASE_RULES = `
You are a high-precision text transformation engine.

GLOBAL RULES:
- Preserve the original meaning exactly
- Do NOT add new facts, opinions, or assumptions
- Do NOT remove important details
- Do NOT explain your changes
- Do NOT include quotes, markdown, or commentary
- Output ONLY the transformed text
- Keep formatting, punctuation style, and line breaks unless the transformation requires changing them
- If the input is already optimal for the requested transformation, return it unchanged
`;

export const TRANSFORM_PROMPTS: Record<TransformationType, string> = {
  improve: `${TRANSFORM_BASE_RULES}
TASK:
Fix grammar, spelling, and clarity issues.
Make the text more fluent and professional WITHOUT changing tone or intent.
Avoid stylistic rewriting unless it improves readability or correctness.`,

  rephrase: `${TRANSFORM_BASE_RULES}
TASK:
Rewrite the text using different wording while preserving meaning, tone, and level of formality.
Do NOT simplify or embellish.
Maintain approximately the same length.`,

  translate: `${TRANSFORM_BASE_RULES}
TASK:
Auto-detect the source language.
If the text is NOT English, translate it into natural, fluent English.
If the text IS English, translate it into natural, fluent Spanish.
Preserve formatting and structure.`,

  shorten: `${TRANSFORM_BASE_RULES}
TASK:
Reduce the length of the text while preserving all key information and intent.
Remove redundancy and filler.
Do NOT remove essential details.
Aim for at least 30% reduction unless the text is already concise.`,

  friendly: `${TRANSFORM_BASE_RULES}
TASK:
Make the text sound friendly, approachable, and conversational.
Keep professionalism where appropriate.
Avoid slang, emojis, or excessive informality.
Preserve the original message and intent.`,

  formal: `${TRANSFORM_BASE_RULES}
TASK:
Make the text sound formal, professional, and business-appropriate.
Avoid casual language, contractions, and colloquial phrasing.
Preserve meaning and structure.`,

  custom: `${TRANSFORM_BASE_RULES}
TASK:
Transform the following text as requested.`,
};

interface GroqResponse {
  issues: Array<{
    category: string;
    originalText: string;
    suggestedText: string;
    explanation: string;
  }>;
}

export abstract class BaseProvider implements LLMProvider {
  abstract readonly type: LLMProviderType;
  abstract readonly config: LLMProviderConfig;

  protected rateLimiter: RateLimiter;
  protected cache: CacheManager;
  protected pendingRequests: Map<string, Promise<AnalysisResult>> = new Map();

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
      console.log('[AuroraWrite] PROVIDER CACHE HIT - returning cached result with', cached.issues.length, 'issues');
      return this.filterIssues(cached, settings);
    }
    console.log('[AuroraWrite] PROVIDER CACHE MISS - will call API');

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

  protected async performAnalysis(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.recordRequest();

    const enabledCategories = Object.entries(settings.categories)
      .filter(([_, config]) => config.enabled)
      .map(([category]) => category);

    console.log('[AuroraWrite] Enabled categories:', enabledCategories);
    console.log('[AuroraWrite] Text being analyzed (first 200 chars):', text.substring(0, 200));

    const content = await this.callAPI(
      apiKey,
      settings,
      ANALYSIS_SYSTEM_PROMPT,
      `Analyze this text for issues. Only report issues in these categories: ${enabledCategories.join(', ')}\n\nText:\n${text}`,
      true
    );

    console.log('[AuroraWrite] Raw API response:', content);

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

  /**
   * Verify text for stability pass.
   * Uses a lighter verification prompt to detect newly exposed issues.
   * Does NOT use cache (we want fresh analysis).
   */
  async verifyText(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult> {
    if (!text.trim() || text.length < 3) {
      return { text, issues: [], timestamp: Date.now() };
    }

    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getWaitTime();
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.recordRequest();

    const content = await this.callAPI(
      apiKey,
      settings,
      VERIFICATION_SYSTEM_PROMPT,
      `Verify this text for remaining issues:\n\n${text}`,
      true
    );

    console.log('[AuroraWrite:Stability] Verification response:', content);

    const parsed = this.parseResponse(content, text);
    console.log('[AuroraWrite:Stability] Verification issues found:', parsed.length);

    const result: AnalysisResult = {
      text,
      issues: parsed,
      timestamp: Date.now(),
    };

    // Don't cache verification results - they're context-dependent
    return this.filterIssues(result, settings);
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

    let systemPrompt = TRANSFORM_PROMPTS[transformationType] || TRANSFORM_PROMPTS.improve;
    if (transformationType === 'custom' && customPrompt) {
      systemPrompt = `${TRANSFORM_BASE_RULES}
CUSTOM TASK:
${customPrompt}
Apply this instruction to the following text.`;
    }

    const content = await this.callAPI(apiKey, settings, systemPrompt, text, false);

    if (!content) {
      throw new Error('Empty response from API');
    }

    return content.trim();
  }

  abstract validateApiKey(apiKey: string): Promise<boolean>;

  protected abstract callAPI(
    apiKey: string,
    settings: Settings,
    systemPrompt: string,
    userMessage: string,
    jsonMode: boolean
  ): Promise<string>;

  protected parseResponse(content: string, originalText: string): TextIssue[] {
    let parsed: GroqResponse;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('[AuroraWrite] Failed to parse API response:', content);
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

  protected findTextPosition(text: string, searchText: string, usedRanges: Array<{ start: number; end: number }>): number {
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

  protected findTextPositionCaseInsensitive(text: string, searchText: string, usedRanges: Array<{ start: number; end: number }>): number {
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

  protected isValidCategory(category: string): category is IssueCategory {
    return ['spelling', 'grammar', 'style', 'clarity', 'tone', 'rephrase'].includes(category);
  }

  protected filterIssues(result: AnalysisResult, settings: Settings): AnalysisResult {
    const filteredIssues = result.issues.filter((issue) => {
      if (!settings.categories[issue.category]?.enabled) return false;

      const lowerOriginal = issue.originalText.toLowerCase();
      if (settings.ignoredWords.includes(lowerOriginal)) return false;

      return true;
    });

    return { ...result, issues: filteredIssues };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
