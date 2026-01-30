import type { IssueCategory } from './analysis';

export interface CategorySettings {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
}

export interface Settings {
  apiKey: string;
  categories: Record<IssueCategory, CategorySettings>;
  ignoredWords: string[];
  enabledSites: 'all' | 'whitelist';
  siteList: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  categories: {
    spelling: { enabled: true, sensitivity: 'high' },
    grammar: { enabled: true, sensitivity: 'high' },
    style: { enabled: true, sensitivity: 'medium' },
    clarity: { enabled: true, sensitivity: 'medium' },
    tone: { enabled: false, sensitivity: 'low' },
  },
  ignoredWords: [],
  enabledSites: 'all',
  siteList: [],
};
