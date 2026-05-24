import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type {
  RequestMessage,
  ResponseMessage,
  ExtensionSettings,
} from '@/utils/messages';
import { DEFAULT_SETTINGS } from '@/utils/messages';

import type { ProcessActionType } from '@/utils/messages';

const SYSTEM_PROMPT_MAP: Record<ProcessActionType, string> = {
  proofread: `You are a proofreading assistant. Your task is to fix grammar, spelling, punctuation, and style errors in the given text.

Rules:
- Return ONLY the corrected text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve the original tone and intent.
- If the text is already correct, return it unchanged.
- Preserve line breaks and formatting.
- Do not add or remove content — only fix errors.
- NEVER use "—" and ";".`,

  rewrite: `You are a rewriting assistant. Your task is to rewrite the text to improve flow, clarity, and vocabulary while keeping the original meaning and language.

Rules:
- Return ONLY the rewritten text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve the original tone and intent.
- Preserve line breaks and formatting.`,

  friendly: `You are a writing assistant. Rewrite the given text to make the tone friendly, warm, and approachable, while preserving the original meaning, language, and formatting.

Rules:
- Return ONLY the rewritten text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve line breaks and formatting.`,

  professional: `You are a writing assistant. Rewrite the given text to make the tone professional, polite, and executive-level, while preserving the original meaning, language, and formatting.

Rules:
- Return ONLY the rewritten text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve line breaks and formatting.`,

  concise: `You are a writing assistant. Rewrite the given text to make it concise and direct, removing fluff while keeping the core meaning, language, and formatting.

Rules:
- Return ONLY the rewritten text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).
- Preserve line breaks and formatting.`,

  summary: `You are a writing assistant. Summarize the given text concisely.

Rules:
- Return ONLY the summary — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).`,

  key_points: `You are a writing assistant. Convert the given text into a list of key points (using bullet points).

Rules:
- Return ONLY the bullet points — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).`,

  table: `You are a writing assistant. Convert the given text/data into a clean Markdown table representation.

Rules:
- Return ONLY the table — no explanations, no quotes, no prefixes.`,

  list: `You are a writing assistant. Convert the given text into a formatted list (bulleted or numbered, depending on content structure).

Rules:
- Return ONLY the list — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).`,

  custom: `You are a writing assistant. Modify the given text according to the user's instructions.

Rules:
- Return ONLY the modified text — no explanations, no quotes, no prefixes.
- Preserve the original language (do not translate).`
};

async function getSettings(): Promise<ExtensionSettings> {
  const data = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

function isOpenRouterModel(modelName: string): boolean {
  return modelName.includes('/');
}

async function handleProcessText(text: string, action: ProcessActionType, customPrompt?: string): Promise<ResponseMessage> {
  const settings = await getSettings();
  const modelName = settings.model || 'gemini-3.1-flash-lite-preview';
  const isOR = isOpenRouterModel(modelName);

  if (isOR && !settings.openrouterApiKey) {
    return {
      type: 'PROCESS_TEXT_ERROR',
      error: 'No OpenRouter API key configured. Click the extension icon to set up your OpenRouter API key.',
    };
  }

  if (!isOR && !settings.apiKey) {
    return {
      type: 'PROCESS_TEXT_ERROR',
      error: 'No Gemini API key configured. Click the extension icon to set up your Gemini API key.',
    };
  }

  if (!settings.enabled) {
    return {
      type: 'PROCESS_TEXT_ERROR',
      error: 'Extension is disabled.',
    };
  }

  try {
    let modelInstance;
    if (isOR) {
      const openrouter = createOpenRouter({
        apiKey: settings.openrouterApiKey,
      });
      modelInstance = openrouter.chat(modelName);
    } else {
      const google = createGoogleGenerativeAI({
        apiKey: settings.apiKey,
      });
      modelInstance = google(modelName);
    }

    const systemPrompt = SYSTEM_PROMPT_MAP[action] || SYSTEM_PROMPT_MAP.proofread;
    let promptText = text;
    let systemText: string | undefined = systemPrompt;

    if (action === 'custom' && customPrompt) {
      promptText = `Instruction: ${customPrompt}\n\nText to modify:\n${text}`;
    }

    if (isOR) {
      if (action === 'custom' && customPrompt) {
        promptText = `${systemPrompt}\n\nInstruction: ${customPrompt}\n\nText to modify:\n${text}`;
      } else {
        promptText = `${systemPrompt}\n\nText to process:\n${text}`;
      }
      systemText = undefined;
    }

    const result = await generateText({
      model: modelInstance,
      system: systemText,
      prompt: promptText,
    });

    const processed = result.text.trim();

    return {
      type: 'PROCESS_TEXT_RESULT',
      text: processed,
    };
  } catch (err: any) {
    console.error('[Writing Tools] AI SDK error:', err);

    let errorMessage = 'Failed to process text.';

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
      type: 'PROCESS_TEXT_ERROR',
      error: errorMessage,
    };
  }
}

async function handleTestConnection(): Promise<ResponseMessage> {
  const settings = await getSettings();
  const modelName = settings.model || 'gemini-3.1-flash-lite-preview';
  const isOR = isOpenRouterModel(modelName);

  if (isOR && !settings.openrouterApiKey) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      success: false,
      error: 'No OpenRouter API key provided.',
    };
  }

  if (!isOR && !settings.apiKey) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      success: false,
      error: 'No Gemini API key provided.',
    };
  }

  try {
    let modelInstance;
    if (isOR) {
      const openrouter = createOpenRouter({
        apiKey: settings.openrouterApiKey,
      });
      modelInstance = openrouter.chat(modelName);
    } else {
      const google = createGoogleGenerativeAI({
        apiKey: settings.apiKey,
      });
      modelInstance = google(modelName);
    }

    await generateText({
      model: modelInstance,
      prompt: 'Say "ok".',
      maxOutputTokens: 5,
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
          case 'PROCESS_TEXT':
            response = await handleProcessText(message.text, message.action, message.customPrompt);
            break;
          case 'TEST_CONNECTION':
            response = await handleTestConnection();
            break;
          default:
            response = {
              type: 'PROCESS_TEXT_ERROR',
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
