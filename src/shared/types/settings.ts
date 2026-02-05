import type { IssueCategory } from './analysis';
import type { LLMProviderType } from './llm';

export interface CategorySettings {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface ProviderSettings {
  activeProvider: LLMProviderType;
  providers: {
    [key in LLMProviderType]?: {
      apiKey: string;
      model: string;
    };
  };
}

export interface Settings {
  apiKey: string;
  model: string;
  categories: Record<IssueCategory, CategorySettings>;
  ignoredWords: string[];
  ignoredDomains: string[];
  enabledSites: 'all' | 'whitelist';
  siteList: string[];
  providerSettings?: ProviderSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'llama-3.1-8b-instant',
  categories: {
    spelling: { enabled: true, sensitivity: 'high' },
    grammar: { enabled: true, sensitivity: 'high' },
    style: { enabled: true, sensitivity: 'medium' },
    clarity: { enabled: true, sensitivity: 'medium' },
    tone: { enabled: true, sensitivity: 'low' },
    rephrase: { enabled: true, sensitivity: 'medium' },
  },
  ignoredWords: [],
  ignoredDomains: [],
  enabledSites: 'all',
  siteList: [],
  providerSettings: {
    activeProvider: 'groq',
    providers: {},
  },
};
