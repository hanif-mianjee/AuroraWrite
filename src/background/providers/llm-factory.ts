import type { LLMProvider, LLMProviderConfig, LLMProviderType } from '../../shared/types/llm';
import { GroqProvider } from './groq-provider';
import { OpenAIProvider } from './openai-provider';
import { GeminiProvider } from './gemini-provider';
import { AnthropicProvider } from './anthropic-provider';
import { TogetherProvider } from './together-provider';
import { MistralProvider } from './mistral-provider';

class LLMFactoryClass {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();

  constructor() {
    // Register all providers
    this.register(new GroqProvider());
    this.register(new OpenAIProvider());
    this.register(new GeminiProvider());
    this.register(new AnthropicProvider());
    this.register(new TogetherProvider());
    this.register(new MistralProvider());
  }

  register(provider: LLMProvider): void {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: LLMProviderType): LLMProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      // Default to Groq if provider not found
      return this.providers.get('groq')!;
    }
    return provider;
  }

  getAvailableProviders(): LLMProviderConfig[] {
    return Array.from(this.providers.values()).map(p => p.config);
  }

  getProviderTypes(): LLMProviderType[] {
    return Array.from(this.providers.keys());
  }
}

export const LLMFactory = new LLMFactoryClass();
