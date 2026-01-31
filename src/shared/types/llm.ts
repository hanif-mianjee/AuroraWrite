import type { AnalysisResult } from './analysis';
import type { Settings } from './settings';
import type { TransformationType } from './messages';

export type LLMProviderType = 'groq' | 'openai' | 'gemini' | 'anthropic' | 'together' | 'mistral';

export interface LLMProviderConfig {
  type: LLMProviderType;
  name: string;
  apiUrl: string;
  defaultModel: string;
  models: Array<{ id: string; name: string }>;
  requiresApiKey: boolean;
  freeTier: boolean;
}

export interface LLMProvider {
  readonly type: LLMProviderType;
  readonly config: LLMProviderConfig;
  analyzeText(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult>;
  verifyText(text: string, apiKey: string, settings: Settings): Promise<AnalysisResult>;
  transformText(text: string, type: TransformationType, apiKey: string, settings: Settings, customPrompt?: string): Promise<string>;
  validateApiKey(apiKey: string): Promise<boolean>;
}
