import type { AnalysisResult, TextIssue, IssueCategory } from './analysis';

export type MessageType =
  | 'ANALYZE_TEXT'
  | 'ANALYSIS_RESULT'
  | 'ANALYSIS_ERROR'
  | 'GET_SETTINGS'
  | 'SETTINGS_RESPONSE'
  | 'VALIDATE_API_KEY'
  | 'API_KEY_VALID'
  | 'API_KEY_INVALID'
  | 'TRANSFORM_TEXT'
  | 'TRANSFORM_RESULT'
  | 'TRANSFORM_ERROR';

export type TransformationType = 'improve' | 'rephrase' | 'translate' | 'shorten' | 'friendly' | 'formal' | 'custom';

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

export interface TransformTextMessage {
  type: 'TRANSFORM_TEXT';
  payload: {
    text: string;
    transformationType: TransformationType;
    customPrompt?: string;
    requestId: string;
  };
}

export interface TransformResultMessage {
  type: 'TRANSFORM_RESULT';
  payload: {
    requestId: string;
    originalText: string;
    transformedText: string;
  };
}

export interface TransformErrorMessage {
  type: 'TRANSFORM_ERROR';
  payload: {
    requestId: string;
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
  | ApiKeyInvalidMessage
  | TransformTextMessage
  | TransformResultMessage
  | TransformErrorMessage;

import type { Settings } from './settings';
