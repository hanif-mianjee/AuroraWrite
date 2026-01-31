import { LLMFactory } from './providers';
import { getSettings, getApiKey } from '../shared/utils/storage';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage, TransformResultMessage, TransformErrorMessage, BlockResultMessage, BlockErrorMessage, VerifyResultMessage, VerifyErrorMessage } from '../shared/types/messages';
import type { LLMProviderType } from '../shared/types/llm';
import type { TextIssue } from '../shared/types/analysis';

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

    case 'ANALYZE_BLOCK': {
      const { fieldId, blockId, blockText, previousBlockText, nextBlockText, blockStartOffset, requestId } = message.payload;
      console.log('[AuroraWrite] ANALYZE_BLOCK for field:', fieldId, 'block:', blockId, 'text length:', blockText.length);

      const settings = await getSettings();
      const apiKey = await getActiveApiKey(settings);
      const provider = getActiveProvider(settings);

      if (!apiKey) {
        const errorResponse: BlockErrorMessage = {
          type: 'BLOCK_ERROR',
          payload: { fieldId, blockId, error: `API key not configured. Please set your ${provider.config.name} API key in extension options.` },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }

      try {
        // Analyze just this block with context
        const contextPrefix = previousBlockText ? `[Previous context: ${previousBlockText.slice(-100)}]\n\n` : '';
        const contextSuffix = nextBlockText ? `\n\n[Following context: ${nextBlockText.slice(0, 100)}]` : '';
        const textWithContext = contextPrefix + blockText + contextSuffix;

        const result = await provider.analyzeText(textWithContext, apiKey, settings);

        // Filter issues to only those within the block text (not in context)
        const contextPrefixLength = contextPrefix.length;
        const blockEndInContext = contextPrefixLength + blockText.length;

        const blockIssues: TextIssue[] = result.issues
          .filter(issue => {
            // Issue must be within the block text portion
            return issue.startOffset >= contextPrefixLength &&
                   issue.endOffset <= blockEndInContext;
          })
          .map(issue => ({
            ...issue,
            // Adjust offsets: remove context prefix, add block's position in full text
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
      const apiKey = await getActiveApiKey(settings);
      const provider = getActiveProvider(settings);

      if (!apiKey) {
        const errorResponse: VerifyErrorMessage = {
          type: 'VERIFY_ERROR',
          payload: { fieldId, blockId, error: `API key not configured.` },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }

      try {
        // Verify this block with context using lighter verification prompt
        const contextPrefix = previousBlockText ? `[Context before: ${previousBlockText.slice(-50)}]\n\n` : '';
        const contextSuffix = nextBlockText ? `\n\n[Context after: ${nextBlockText.slice(0, 50)}]` : '';
        const textWithContext = contextPrefix + blockText + contextSuffix;

        const result = await provider.verifyText(textWithContext, apiKey, settings);

        // Filter issues to only those within the block text (not in context)
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
