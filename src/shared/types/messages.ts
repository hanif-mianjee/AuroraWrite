import type { AnalysisResult, TextIssue, IssueCategory } from './analysis';
import type { LLMProviderType, LLMProviderConfig } from './llm';

export type MessageType =
  | 'ANALYZE_TEXT'
  | 'ANALYSIS_RESULT'
  | 'ANALYSIS_ERROR'
  | 'ANALYZE_BLOCK'
  | 'BLOCK_RESULT'
  | 'BLOCK_ERROR'
  | 'VERIFY_BLOCK'
  | 'VERIFY_RESULT'
  | 'VERIFY_ERROR'
  | 'GET_SETTINGS'
  | 'SETTINGS_RESPONSE'
  | 'VALIDATE_API_KEY'
  | 'API_KEY_VALID'
  | 'API_KEY_INVALID'
  | 'TRANSFORM_TEXT'
  | 'TRANSFORM_RESULT'
  | 'TRANSFORM_ERROR'
  | 'GET_PROVIDERS'
  | 'PROVIDERS_RESPONSE'
  | 'CLEAR_CACHE';

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
    requestId?: string;
  };
}

export interface BlockResultMessage {
  type: 'BLOCK_RESULT';
  payload: {
    fieldId: string;
    blockId: string;
    issues: TextIssue[];
    requestId?: string;
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

export interface VerifyBlockMessage {
  type: 'VERIFY_BLOCK';
  payload: {
    fieldId: string;
    blockId: string;
    blockText: string;
    previousBlockText: string | null;
    nextBlockText: string | null;
    blockStartOffset: number;
    requestId?: string;
  };
}

export interface VerifyResultMessage {
  type: 'VERIFY_RESULT';
  payload: {
    fieldId: string;
    blockId: string;
    issues: TextIssue[];
    requestId?: string;
  };
}

export interface VerifyErrorMessage {
  type: 'VERIFY_ERROR';
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

export interface ClearCacheMessage {
  type: 'CLEAR_CACHE';
}

export type Message =
  | AnalyzeTextMessage
  | AnalysisResultMessage
  | AnalysisErrorMessage
  | AnalyzeBlockMessage
  | BlockResultMessage
  | BlockErrorMessage
  | VerifyBlockMessage
  | VerifyResultMessage
  | VerifyErrorMessage
  | GetSettingsMessage
  | SettingsResponseMessage
  | ValidateApiKeyMessage
  | ApiKeyValidMessage
  | ApiKeyInvalidMessage
  | TransformTextMessage
  | TransformResultMessage
  | TransformErrorMessage
  | GetProvidersMessage
  | ProvidersResponseMessage
  | ClearCacheMessage;

import type { Settings } from './settings';
