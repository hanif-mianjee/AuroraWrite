export type IssueCategory = 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone' | 'rephrase';

export type IssueSource = 'analysis' | 'verification';
export type IssueStatus = 'new' | 'applied' | 'verified' | 'stale';

export interface TextIssue {
  id: string;
  category: IssueCategory;
  startOffset: number;
  endOffset: number;
  originalText: string;
  suggestedText: string;
  explanation: string;
  ignored?: boolean;
  source?: IssueSource; // 'analysis' or 'verification'
  status?: IssueStatus; // 'new', 'applied', 'verified', 'stale'
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
  rephrase: number;
  total: number;
}
