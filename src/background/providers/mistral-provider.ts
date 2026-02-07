import type { Settings } from '../../shared/types/settings';
import type { LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { BaseProvider } from './base-provider';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

export class MistralProvider extends BaseProvider {
  readonly type: LLMProviderType = 'mistral';
  readonly config: LLMProviderConfig = {
    type: 'mistral',
    name: 'Mistral AI',
    apiUrl: MISTRAL_API_URL,
    defaultModel: 'mistral-small-latest',
    models: [
      { id: 'mistral-small-latest', name: 'Mistral Small (Fast) (Free)' },
      { id: 'ministral-8b-latest', name: 'Ministral 8B (Free)' },
      { id: 'mistral-medium-3', name: 'Mistral Medium 3' },
      { id: 'mistral-large-latest', name: 'Mistral Large (Best Quality)' },
      { id: 'magistral-small-latest', name: 'Magistral Small (Reasoning)' },
      { id: 'magistral-medium-latest', name: 'Magistral Medium (Reasoning)' },
      { id: 'mistral-saba-latest', name: 'Mistral Saba (Multilingual)' },
    ],
    requiresApiKey: true,
    freeTier: false,
  };

  protected async callAPI(
    apiKey: string,
    settings: Settings,
    systemPrompt: string,
    userMessage: string,
    jsonMode: boolean
  ): Promise<string> {
    const model = settings.providerSettings?.providers?.mistral?.model || this.config.defaultModel;

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: jsonMode ? 0.05 : 0.3,
      max_tokens: 2048,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Mistral API key.');
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Mistral API');
    }

    return content;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
