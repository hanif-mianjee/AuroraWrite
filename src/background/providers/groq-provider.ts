import type { Settings } from '../../shared/types/settings';
import type { LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { BaseProvider } from './base-provider';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider extends BaseProvider {
  readonly type: LLMProviderType = 'groq';
  readonly config: LLMProviderConfig = {
    type: 'groq',
    name: 'Groq',
    apiUrl: GROQ_API_URL,
    defaultModel: 'llama-3.1-8b-instant',
    models: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Best Quality)' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
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
    const model = settings.providerSettings?.providers?.groq?.model || settings.model || this.config.defaultModel;
    console.log('[AuroraWrite] Using Groq model:', model);

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

    const response = await fetch(GROQ_API_URL, {
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
        try {
          const errorJson = JSON.parse(errorText);
          const message = errorJson.error?.message || '';
          const waitMatch = message.match(/try again in (\d+m\d+)/);
          const waitTime = waitMatch ? waitMatch[1] : '5 minutes';
          throw new Error(`Rate limit reached. Please wait ${waitTime} or upgrade your Groq plan.`);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Rate limit')) {
            throw e;
          }
          throw new Error('Rate limit reached. Please wait a few minutes.');
        }
      }

      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    return content;
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(GROQ_API_URL, {
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
