import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type {
  RequestMessage,
  ResponseMessage,
  ExtensionSettings,
} from '@/utils/messages';
import { DEFAULT_SETTINGS } from '@/utils/messages';

const SYSTEM_PROMPT = `You are a proofreading assistant. Your task is to fix grammar, spelling, punctuation, and style errors in the given text.

Rules:
- Return ONLY the corrected text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve the original tone and intent.
- If the text is already correct, return it unchanged.
- Preserve line breaks and formatting.
- Do not add or remove content — only fix errors.`;

async function getSettings(): Promise<ExtensionSettings> {
  const data = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

async function handleProofread(text: string): Promise<ResponseMessage> {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return {
      type: 'PROOFREAD_ERROR',
      error: 'No API key configured. Click the extension icon to set up your Gemini API key.',
    };
  }

  if (!settings.enabled) {
    return {
      type: 'PROOFREAD_ERROR',
      error: 'Extension is disabled.',
    };
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey: settings.apiKey,
    });

    const result = await generateText({
      model: google(settings.model || 'gemini-2.0-flash'),
      system: SYSTEM_PROMPT,
      prompt: text,
    });

    const corrected = result.text.trim();

    return {
      type: 'PROOFREAD_RESULT',
      text: corrected,
    };
  } catch (err: any) {
    console.error('[ConText] AI SDK error:', err);

    let errorMessage = 'Failed to proofread text.';

    if (err?.message?.includes('API key')) {
      errorMessage = 'Invalid API key. Please check your settings.';
    } else if (err?.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
    } else if (err?.message?.includes('rate')) {
      errorMessage = 'Rate limit hit. Please wait a moment.';
    } else if (err?.message) {
      errorMessage = err.message;
    }

    return {
      type: 'PROOFREAD_ERROR',
      error: errorMessage,
    };
  }
}

async function handleTestConnection(): Promise<ResponseMessage> {
  const settings = await getSettings();

  if (!settings.apiKey) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      success: false,
      error: 'No API key provided.',
    };
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey: settings.apiKey,
    });

    await generateText({
      model: google(settings.model || 'gemini-2.0-flash'),
      prompt: 'Say "ok".',
      maxTokens: 5,
    });

    return {
      type: 'TEST_CONNECTION_RESULT',
      success: true,
    };
  } catch (err: any) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      success: false,
      error: err?.message || 'Connection failed.',
    };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: RequestMessage, _sender, sendResponse) => {
      (async () => {
        let response: ResponseMessage;

        switch (message.type) {
          case 'PROOFREAD':
            response = await handleProofread(message.text);
            break;
          case 'TEST_CONNECTION':
            response = await handleTestConnection();
            break;
          default:
            response = {
              type: 'PROOFREAD_ERROR',
              error: 'Unknown message type.',
            };
        }

        sendResponse(response);
      })();

      // Return true to keep the message channel open for async response
      return true;
    },
  );
});
