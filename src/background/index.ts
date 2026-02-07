import { LLMFactory } from './providers';
import { getSettings, getApiKey, saveSettings } from '../shared/utils/storage';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage, TransformResultMessage, TransformErrorMessage, BlockResultMessage, BlockErrorMessage, VerifyResultMessage, VerifyErrorMessage } from '../shared/types/messages';
import type { LLMProviderType } from '../shared/types/llm';
import type { TextIssue } from '../shared/types/analysis';
import type { Settings } from '../shared/types/settings';

console.log('[AuroraWrite] Background service worker starting');

// Open welcome page on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/welcome/index.html')
    });
  }
});

function getActiveProvider(settings: { providerSettings?: { activeProvider: LLMProviderType } }) {
  const providerType = settings.providerSettings?.activeProvider || 'groq';
  return LLMFactory.getProvider(providerType);
}


function getAvailableFallbackProviders(settings: Settings): LLMProviderType[] {
  const activeProvider = settings.providerSettings?.activeProvider || 'groq';
  const allTypes = LLMFactory.getProviderTypes();
  const activeIndex = allTypes.indexOf(activeProvider);

  // Round-robin order starting after active provider
  const ordered = [
    ...allTypes.slice(activeIndex + 1),
    ...allTypes.slice(0, activeIndex),
  ];

  // Only include providers that have API keys configured
  return ordered.filter(type => {
    const key = settings.providerSettings?.providers?.[type]?.apiKey;
    return key && key.trim().length > 0;
  });
}

async function executeWithFallback<T>(
  settings: Settings,
  operation: (providerType: LLMProviderType, apiKey: string) => Promise<T>,
): Promise<T> {
  const activeProvider = settings.providerSettings?.activeProvider || 'groq';
  const activeApiKey = settings.providerSettings?.providers?.[activeProvider]?.apiKey
    || (activeProvider === 'groq' ? await getApiKey() : '');

  // Try active provider first (if it has a key)
  if (activeApiKey) {
    try {
      return await operation(activeProvider, activeApiKey);
    } catch (activeError) {
      console.warn(`[AuroraWrite] Active provider ${activeProvider} failed:`, activeError);

      if (!settings.providerSettings?.autoFallback) {
        throw activeError;
      }

      // Try fallback providers
      const fallbacks = getAvailableFallbackProviders(settings);
      if (fallbacks.length === 0) {
        throw activeError;
      }

      for (const fallbackType of fallbacks) {
        const fallbackKey = settings.providerSettings!.providers![fallbackType]!.apiKey;
        try {
          console.log(`[AuroraWrite] Trying fallback provider: ${fallbackType}`);
          const result = await operation(fallbackType, fallbackKey);
          // Persist the new active provider (fire-and-forget)
          console.log(`[AuroraWrite] Fallback to ${fallbackType} succeeded, persisting as active provider`);
          saveSettings({
            providerSettings: { ...settings.providerSettings!, activeProvider: fallbackType },
          }).catch(() => {});
          return result;
        } catch (fallbackError) {
          console.warn(`[AuroraWrite] Fallback provider ${fallbackType} also failed:`, fallbackError);
        }
      }

      // All providers failed, throw the original error
      throw activeError;
    }
  }

  // Active provider has no key — if fallback enabled, try others
  if (settings.providerSettings?.autoFallback) {
    const fallbacks = getAvailableFallbackProviders(settings);
    if (fallbacks.length > 0) {
      let firstError: Error | null = null;
      for (const fallbackType of fallbacks) {
        const fallbackKey = settings.providerSettings!.providers![fallbackType]!.apiKey;
        try {
          console.log(`[AuroraWrite] Active provider has no key, trying fallback: ${fallbackType}`);
          const result = await operation(fallbackType, fallbackKey);
          saveSettings({
            providerSettings: { ...settings.providerSettings!, activeProvider: fallbackType },
          }).catch(() => {});
          return result;
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[AuroraWrite] Fallback provider ${fallbackType} failed:`, err);
        }
      }
      if (firstError) throw firstError;
    }
  }

  // No key and no fallback available
  const provider = LLMFactory.getProvider(activeProvider);
  throw new Error(`API key not configured. Please set your ${provider.config.name} API key in extension options.`);
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

      try {
        const result = await executeWithFallback(settings, (providerType, apiKey) => {
          const provider = LLMFactory.getProvider(providerType);
          console.log('[AuroraWrite] Calling', provider.config.name, 'API...');
          return provider.analyzeText(text, apiKey, settings);
        });
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

    case 'ANALYZE_BLOCK': {
      const { fieldId, blockId, blockText, previousBlockText, nextBlockText, blockStartOffset, requestId } = message.payload;
      console.log('[AuroraWrite] ANALYZE_BLOCK for field:', fieldId, 'block:', blockId, 'text length:', blockText.length);

      const settings = await getSettings();

      try {
        // Analyze just this block with context
        const contextPrefix = previousBlockText ? `[Previous context: ${previousBlockText.slice(-100)}]\n\n` : '';
        const contextSuffix = nextBlockText ? `\n\n[Following context: ${nextBlockText.slice(0, 100)}]` : '';
        const textWithContext = contextPrefix + blockText + contextSuffix;

        const result = await executeWithFallback(settings, (providerType, apiKey) => {
          const provider = LLMFactory.getProvider(providerType);
          return provider.analyzeText(textWithContext, apiKey, settings);
        });

        // Filter issues to only those within the block text (not in context)
        const contextPrefixLength = contextPrefix.length;
        const blockEndInContext = contextPrefixLength + blockText.length;

        const blockIssues: TextIssue[] = result.issues
          .filter(issue => {
            return issue.startOffset >= contextPrefixLength &&
                   issue.endOffset <= blockEndInContext;
          })
          .map(issue => ({
            ...issue,
            startOffset: issue.startOffset - contextPrefixLength + blockStartOffset,
            endOffset: issue.endOffset - contextPrefixLength + blockStartOffset,
          }));

        console.log('[AuroraWrite] Block analysis complete, issues found:', blockIssues.length);

        const response: BlockResultMessage = {
          type: 'BLOCK_RESULT',
          payload: { fieldId, blockId, issues: blockIssues, requestId },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, response);
        }
        return response;
      } catch (error) {
        console.error('[AuroraWrite] Block analysis error:', error);
        const errorResponse: BlockErrorMessage = {
          type: 'BLOCK_ERROR',
          payload: { fieldId, blockId, error: error instanceof Error ? error.message : 'Unknown error' },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }
    }

    case 'VERIFY_BLOCK': {
      const { fieldId, blockId, blockText, previousBlockText, nextBlockText, blockStartOffset, requestId } = message.payload;
      console.log('[AuroraWrite:Stability] VERIFY_BLOCK for field:', fieldId, 'block:', blockId);

      const settings = await getSettings();

      try {
        const contextPrefix = previousBlockText ? `[Context before: ${previousBlockText.slice(-50)}]\n\n` : '';
        const contextSuffix = nextBlockText ? `\n\n[Context after: ${nextBlockText.slice(0, 50)}]` : '';
        const textWithContext = contextPrefix + blockText + contextSuffix;

        const result = await executeWithFallback(settings, (providerType, apiKey) => {
          const provider = LLMFactory.getProvider(providerType);
          return provider.verifyText(textWithContext, apiKey, settings);
        });

        const contextPrefixLength = contextPrefix.length;
        const blockEndInContext = contextPrefixLength + blockText.length;

        const blockIssues: TextIssue[] = result.issues
          .filter((issue: TextIssue) => {
            return issue.startOffset >= contextPrefixLength &&
                   issue.endOffset <= blockEndInContext;
          })
          .map((issue: TextIssue) => ({
            ...issue,
            startOffset: issue.startOffset - contextPrefixLength + blockStartOffset,
            endOffset: issue.endOffset - contextPrefixLength + blockStartOffset,
          }));

        console.log('[AuroraWrite:Stability] Verification complete, new issues found:', blockIssues.length);

        const response: VerifyResultMessage = {
          type: 'VERIFY_RESULT',
          payload: { fieldId, blockId, issues: blockIssues, requestId },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, response);
        }
        return response;
      } catch (error) {
        console.error('[AuroraWrite:Stability] Verification error:', error);
        const errorResponse: VerifyErrorMessage = {
          type: 'VERIFY_ERROR',
          payload: { fieldId, blockId, error: error instanceof Error ? error.message : 'Unknown error' },
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

      try {
        const transformedText = await executeWithFallback(settings, (providerType, apiKey) => {
          const provider = LLMFactory.getProvider(providerType);
          return provider.transformText(text, transformationType, apiKey, settings, customPrompt);
        });
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

    case 'CLEAR_CACHE': {
      console.log('[AuroraWrite] Clearing provider cache');
      const settings = await getSettings();
      const provider = getActiveProvider(settings);
      provider.clearCache();
      return { type: 'CACHE_CLEARED' };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('AuroraWrite extension installed');
});
