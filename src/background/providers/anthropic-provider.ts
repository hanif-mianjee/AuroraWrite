import type { Settings } from '../../shared/types/settings';
import type { LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { BaseProvider } from './base-provider';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider extends BaseProvider {
  readonly type: LLMProviderType = 'anthropic';
  readonly config: LLMProviderConfig = {
    type: 'anthropic',
    name: 'Anthropic',
    apiUrl: ANTHROPIC_API_URL,
    defaultModel: 'claude-3-haiku-20240307',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Best Quality)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
    requiresApiKey: true,
    freeTier: false,
  };

  protected async callAPI(
    apiKey: string,
    settings: Settings,
    systemPrompt: string,
    userMessage: string,
    _jsonMode: boolean
  ): Promise<string> {
    const model = settings.providerSettings?.providers?.anthropic?.model || this.config.defaultModel;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment and try again.');
      }

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Anthropic API key.');
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Empty response from Anthropic API');
    }

    return content;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
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
