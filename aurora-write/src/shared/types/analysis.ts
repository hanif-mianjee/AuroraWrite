export type IssueCategory = 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';

export interface TextIssue {
  id: string;
  category: IssueCategory;
  startOffset: number;
  endOffset: number;
  originalText: string;
  suggestedText: string;
  explanation: string;
  ignored?: boolean;
}

export interface AnalysisResult {
  text: string;
  issues: TextIssue[];
  timestamp: number;
}

export interface AnalysisRequest {
  text: string;
  fieldId: string;
}

export interface IssueCounts {
  spelling: number;
  grammar: number;
  style: number;
  clarity: number;
  tone: number;
  total: number;
}
