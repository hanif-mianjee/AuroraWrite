import { GroqClient } from './groq-client';
import { getSettings, getApiKey } from '../shared/utils/storage';
import type { Message, AnalysisResultMessage, AnalysisErrorMessage } from '../shared/types/messages';

console.log('[AuroraWrite] Background service worker starting');

const groqClient = new GroqClient();

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

      const apiKey = await getApiKey();
      console.log('[AuroraWrite] API key configured:', !!apiKey);

      if (!apiKey) {
        console.log('[AuroraWrite] No API key, sending error');
        const errorResponse: AnalysisErrorMessage = {
          type: 'ANALYSIS_ERROR',
          payload: { fieldId, error: 'API key not configured. Please set your Groq API key in extension options.' },
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorResponse);
        }
        return errorResponse;
      }

      try {
        const settings = await getSettings();
        console.log('[AuroraWrite] Calling Groq API...');
        const result = await groqClient.analyzeText(text, apiKey, settings);
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
      const { apiKey } = message.payload;
      const isValid = await groqClient.validateApiKey(apiKey);
      if (isValid) {
        return { type: 'API_KEY_VALID' };
      }
      return { type: 'API_KEY_INVALID', payload: { error: 'Invalid API key' } };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('AuroraWrite extension installed');
});
