import type { AnalysisResult, TextIssue, IssueCategory } from './analysis';

export type MessageType =
  | 'ANALYZE_TEXT'
  | 'ANALYSIS_RESULT'
  | 'ANALYSIS_ERROR'
  | 'GET_SETTINGS'
  | 'SETTINGS_RESPONSE'
  | 'VALIDATE_API_KEY'
  | 'API_KEY_VALID'
  | 'API_KEY_INVALID';

export interface AnalyzeTextMessage {
  type: 'ANALYZE_TEXT';
  payload: {
    text: string;
    fieldId: string;
  };
}

export interface AnalysisResultMessage {
  type: 'ANALYSIS_RESULT';
  payload: {
    fieldId: string;
    result: AnalysisResult;
  };
}

export interface AnalysisErrorMessage {
  type: 'ANALYSIS_ERROR';
  payload: {
    fieldId: string;
    error: string;
  };
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface SettingsResponseMessage {
  type: 'SETTINGS_RESPONSE';
  payload: Settings;
}

export interface ValidateApiKeyMessage {
  type: 'VALIDATE_API_KEY';
  payload: {
    apiKey: string;
  };
}

export interface ApiKeyValidMessage {
  type: 'API_KEY_VALID';
}

export interface ApiKeyInvalidMessage {
  type: 'API_KEY_INVALID';
  payload: {
    error: string;
  };
}

export type Message =
  | AnalyzeTextMessage
  | AnalysisResultMessage
  | AnalysisErrorMessage
  | GetSettingsMessage
  | SettingsResponseMessage
  | ValidateApiKeyMessage
  | ApiKeyValidMessage
  | ApiKeyInvalidMessage;

import type { Settings } from './settings';
