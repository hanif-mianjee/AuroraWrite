import { LLMFactory } from './providers';
import { getSettings, getApiKey } from '../shared/utils/storage';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage, TransformResultMessage, TransformErrorMessage } from '../shared/types/messages';
import type { LLMProviderType } from '../shared/types/llm';

console.log('[AuroraWrite] Background service worker starting');

function getActiveProvider(settings: { providerSettings?: { activeProvider: LLMProviderType } }) {
  const providerType = settings.providerSettings?.activeProvider || 'groq';
  return LLMFactory.getProvider(providerType);
}

async function getActiveApiKey(settings: { providerSettings?: { activeProvider: LLMProviderType; providers: Record<string, { apiKey: string }> } }): Promise<string> {
  const providerType = settings.providerSettings?.activeProvider || 'groq';
  const providerApiKey = settings.providerSettings?.providers?.[providerType]?.apiKey;
  if (providerApiKey) {
    return providerApiKey;
  }
  // Fallback to legacy apiKey for backwards compatibility
  return await getApiKey();
}

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  console.log('[AuroraWrite] Received message:', message.type);
  handleMessage(message, sender)
    .then((response) => {
      console.log('[AuroraWrite] Sending response:', response);
      sendResponse(response);
    })
    .catch((error) => {
      console.error('[AuroraWrite] Error handling message:', error);
      sendResponse({ error: error.message });
    });

  return true;
});

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'ANALYZE_TEXT': {
      const { text, fieldId } = message.payload;
      console.log('[AuroraWrite] ANALYZE_TEXT for field:', fieldId, 'text length:', text.length);

      const settings = await getSettings();
      const apiKey = await getActiveApiKey(settings);
      const provider = getActiveProvider(settings);
      console.log('[AuroraWrite] API key configured:', !!apiKey, 'Provider:', provider.type);

      if (!apiKey) {
        console.log('[AuroraWrite] No API key, sending error');
        const errorResponse: AnalysisErrorMessage = {
          type: 'ANALYSIS_ERROR',
          payload: { fieldId, error: `API key not configured. Please set your ${provider.config.name} API key in extension options.` },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }

      try {
        console.log('[AuroraWrite] Calling', provider.config.name, 'API...');
        const result = await provider.analyzeText(text, apiKey, settings);
        console.log('[AuroraWrite] Analysis complete, issues found:', result.issues.length);
        const response: AnalysisResultMessage = {
          type: 'ANALYSIS_RESULT',
          payload: { fieldId, result },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, response);
        }
        return response;
      } catch (error) {
        console.error('[AuroraWrite] Analysis error:', error);
        const errorResponse: AnalysisErrorMessage = {
          type: 'ANALYSIS_ERROR',
          payload: { fieldId, error: error instanceof Error ? error.message : 'Unknown error' },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }
    }

    case 'GET_SETTINGS': {
      const settings = await getSettings();
      return { type: 'SETTINGS_RESPONSE', payload: settings };
    }

    case 'VALIDATE_API_KEY': {
      const { apiKey, providerType } = message.payload;
      const provider = LLMFactory.getProvider(providerType || 'groq');
      const isValid = await provider.validateApiKey(apiKey);
      if (isValid) {
        return { type: 'API_KEY_VALID' };
      }
      return { type: 'API_KEY_INVALID', payload: { error: 'Invalid API key' } };
    }

    case 'GET_PROVIDERS': {
      return { type: 'PROVIDERS_RESPONSE', payload: LLMFactory.getAvailableProviders() };
    }

    case 'TRANSFORM_TEXT': {
      const { text, transformationType, customPrompt, requestId } = message.payload;
      console.log('[AuroraWrite] TRANSFORM_TEXT request:', requestId, transformationType);

      const settings = await getSettings();
      const apiKey = await getActiveApiKey(settings);
      const provider = getActiveProvider(settings);

      if (!apiKey) {
        const errorResponse: TransformErrorMessage = {
          type: 'TRANSFORM_ERROR',
          payload: { requestId, error: `API key not configured. Please set your ${provider.config.name} API key in extension options.` },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }

      try {
        const transformedText = await provider.transformText(text, transformationType, apiKey, settings, customPrompt);
        console.log('[AuroraWrite] Transform complete');
        const response: TransformResultMessage = {
          type: 'TRANSFORM_RESULT',
          payload: { requestId, originalText: text, transformedText },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, response);
        }
        return response;
      } catch (error) {
        console.error('[AuroraWrite] Transform error:', error);
        const errorResponse: TransformErrorMessage = {
          type: 'TRANSFORM_ERROR',
          payload: { requestId, error: error instanceof Error ? error.message : 'Unknown error' },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }
    }

    default:
      return { error: 'Unknown message type' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('AuroraWrite extension installed');
});
