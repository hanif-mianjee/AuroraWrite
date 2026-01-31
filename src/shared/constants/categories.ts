import type { IssueCategory } from '../types/analysis';

export interface CategoryConfig {
  name: string;
  color: string;
  underlineStyle: 'squiggly' | 'dashed' | 'dotted' | 'wavy' | 'double';
  description: string;
}

export const CATEGORY_CONFIG: Record<IssueCategory, CategoryConfig> = {
  spelling: {
    name: 'Spelling',
    color: '#e53935',
    underlineStyle: 'squiggly',
    description: 'Typos and misspellings',
  },
  grammar: {
    name: 'Grammar',
    color: '#ff9800',
    underlineStyle: 'dashed',
    description: 'Subject-verb agreement, tense, articles',
  },
  style: {
    name: 'Style',
    color: '#2196f3',
    underlineStyle: 'dotted',
    description: 'Wordiness, passive voice, repetition',
  },
  clarity: {
    name: 'Clarity',
    color: '#9c27b0',
    underlineStyle: 'wavy',
    description: 'Unclear or ambiguous sentences',
  },
  tone: {
    name: 'Tone',
    color: '#4caf50',
    underlineStyle: 'double',
    description: 'Formality mismatches',
  },
  rephrase: {
    name: 'Rephrase',
    color: '#00bcd4',
    underlineStyle: 'dotted',
    description: 'Suggested rewrites for better flow',
  },
};

export const ISSUE_CATEGORIES: IssueCategory[] = [
  'spelling',
  'grammar',
  'style',
  'clarity',
  'tone',
  'rephrase',
];
