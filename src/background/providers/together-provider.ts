import type { Settings } from '../../shared/types/settings';
import type { LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { BaseProvider } from './base-provider';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

export class TogetherProvider extends BaseProvider {
  readonly type: LLMProviderType = 'together';
  readonly config: LLMProviderConfig = {
    type: 'together',
    name: 'Together.ai',
    apiUrl: TOGETHER_API_URL,
    defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    models: [
      { id: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', name: 'Llama 3.2 3B (Fast)' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B' },
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B (Best Quality)' },
      { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' },
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
    const model = settings.providerSettings?.providers?.together?.model || this.config.defaultModel;

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

    const response = await fetch(TOGETHER_API_URL, {
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
        throw new Error('Invalid API key. Please check your Together.ai API key.');
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Together.ai API');
    }

    return content;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(TOGETHER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.defaultModel,
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
