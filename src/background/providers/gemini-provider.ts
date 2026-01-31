import type { Settings } from '../../shared/types/settings';
import type { LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { BaseProvider } from './base-provider';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider extends BaseProvider {
  readonly type: LLMProviderType = 'gemini';
  readonly config: LLMProviderConfig = {
    type: 'gemini',
    name: 'Google Gemini',
    apiUrl: GEMINI_API_URL,
    defaultModel: 'gemini-2.0-flash',
    models: [
      {id: 'gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash Preview'},
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Fastest)' },
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Best Quality)' },
      { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
    ],
    requiresApiKey: true,
    freeTier: true,
  };

  protected async callAPI(
    apiKey: string,
    settings: Settings,
    systemPrompt: string,
    userMessage: string,
    jsonMode: boolean
  ): Promise<string> {
    const model = settings.providerSettings?.providers?.gemini?.model || this.config.defaultModel;
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    const generationConfig: Record<string, unknown> = {
      temperature: jsonMode ? 0.05 : 0.3,
      maxOutputTokens: 2048,
    };

    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n${userMessage}` }
          ]
        }
      ],
      generationConfig,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || '';

      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }

      if (response.status === 400) {
        if (errorMessage.includes('API key')) {
          throw new Error('Invalid API key. Please check your Gemini API key.');
        }
        throw new Error(`Gemini API error: ${errorMessage || response.status}`);
      }

      if (response.status === 403) {
        throw new Error('API key not authorized. Please check your Gemini API key permissions.');
      }

      throw new Error(`API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      // Check for blocked content or other issues
      const finishReason = data.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY') {
        throw new Error('Content blocked by Gemini safety filters.');
      }
      throw new Error('Empty response from Gemini API');
    }

    return content;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Use the models.list endpoint to validate the API key (doesn't consume quota)
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
