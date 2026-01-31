import type { AnalysisResult, TextIssue, IssueCategory } from './analysis';
import type { LLMProviderType, LLMProviderConfig } from './llm';

export type MessageType =
  | 'ANALYZE_TEXT'
  | 'ANALYSIS_RESULT'
  | 'ANALYSIS_ERROR'
  | 'ANALYZE_BLOCK'
  | 'BLOCK_RESULT'
  | 'BLOCK_ERROR'
  | 'GET_SETTINGS'
  | 'SETTINGS_RESPONSE'
  | 'VALIDATE_API_KEY'
  | 'API_KEY_VALID'
  | 'API_KEY_INVALID'
  | 'TRANSFORM_TEXT'
  | 'TRANSFORM_RESULT'
  | 'TRANSFORM_ERROR'
  | 'GET_PROVIDERS'
  | 'PROVIDERS_RESPONSE';

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

export interface AnalyzeBlockMessage {
  type: 'ANALYZE_BLOCK';
  payload: {
    fieldId: string;
    blockId: string;
    blockText: string;
    previousBlockText: string | null;
    nextBlockText: string | null;
    blockStartOffset: number;
  };
}

export interface BlockResultMessage {
  type: 'BLOCK_RESULT';
  payload: {
    fieldId: string;
    blockId: string;
    issues: TextIssue[];
  };
}

export interface BlockErrorMessage {
  type: 'BLOCK_ERROR';
  payload: {
    fieldId: string;
    blockId: string;
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
    providerType?: LLMProviderType;
  };
}

export interface GetProvidersMessage {
  type: 'GET_PROVIDERS';
}

export interface ProvidersResponseMessage {
  type: 'PROVIDERS_RESPONSE';
  payload: LLMProviderConfig[];
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
  | AnalyzeBlockMessage
  | BlockResultMessage
  | BlockErrorMessage
  | GetSettingsMessage
  | SettingsResponseMessage
  | ValidateApiKeyMessage
  | ApiKeyValidMessage
  | ApiKeyInvalidMessage
  | TransformTextMessage
  | TransformResultMessage
  | TransformErrorMessage
  | GetProvidersMessage
  | ProvidersResponseMessage;

import type { Settings } from './settings';
