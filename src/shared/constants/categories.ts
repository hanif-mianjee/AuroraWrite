import type { IssueCategory } from '../types/analysis';

export interface CategoryConfig {
  id: string;
  name: string;
  color: string;
  underlineStyle: 'squiggly' | 'dashed' | 'dotted' | 'wavy' | 'double' | 'solid';
  thickness: number;
  description: string;
  defaultEnabled: boolean;
  defaultSensitivity: 'low' | 'medium' | 'high';
}

class CategoryRegistry {
  private categories: Map<string, CategoryConfig> = new Map();

  register(category: CategoryConfig): void {
    this.categories.set(category.id, category);
  }

  get(id: string): CategoryConfig | undefined {
    return this.categories.get(id);
  }

  getAll(): CategoryConfig[] {
    return Array.from(this.categories.values());
  }

  getAllIds(): string[] {
    return Array.from(this.categories.keys());
  }
}

export const categoryRegistry = new CategoryRegistry();

// Register default categories
categoryRegistry.register({
  id: 'spelling',
  name: 'Spelling',
  color: '#e53935',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Typos and misspellings',
  defaultEnabled: true,
  defaultSensitivity: 'high',
});

categoryRegistry.register({
  id: 'grammar',
  name: 'Grammar',
  color: '#ff9800',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Subject-verb agreement, tense, articles',
  defaultEnabled: true,
  defaultSensitivity: 'high',
});

categoryRegistry.register({
  id: 'style',
  name: 'Style',
  color: '#2196f3',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Wordiness, passive voice, repetition',
  defaultEnabled: true,
  defaultSensitivity: 'medium',
});

categoryRegistry.register({
  id: 'clarity',
  name: 'Clarity',
  color: '#9c27b0',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Unclear or ambiguous sentences',
  defaultEnabled: true,
  defaultSensitivity: 'medium',
});

categoryRegistry.register({
  id: 'tone',
  name: 'Tone',
  color: '#4caf50',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Formality mismatches',
  defaultEnabled: true,
  defaultSensitivity: 'low',
});

categoryRegistry.register({
  id: 'rephrase',
  name: 'Rephrase',
  color: '#00bcd4',
  underlineStyle: 'solid',
  thickness: 4,
  description: 'Suggested rewrites for better flow',
  defaultEnabled: true,
  defaultSensitivity: 'medium',
});

// Legacy exports for backwards compatibility
export const CATEGORY_CONFIG: Record<IssueCategory, Omit<CategoryConfig, 'id' | 'defaultEnabled' | 'defaultSensitivity'>> =
  Object.fromEntries(
    categoryRegistry.getAll().map(cat => [
      cat.id,
      { name: cat.name, color: cat.color, underlineStyle: cat.underlineStyle, thickness: cat.thickness, description: cat.description }
    ])
  ) as Record<IssueCategory, Omit<CategoryConfig, 'id' | 'defaultEnabled' | 'defaultSensitivity'>>;

export const ISSUE_CATEGORIES: IssueCategory[] = categoryRegistry.getAllIds() as IssueCategory[];
