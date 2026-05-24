/**
 * Message types for content ↔ background communication.
 */

export type ProcessActionType =
  | 'proofread'
  | 'rewrite'
  | 'friendly'
  | 'professional'
  | 'concise'
  | 'summary'
  | 'key_points'
  | 'table'
  | 'list'
  | 'custom';

export interface ProcessTextRequest {
  type: 'PROCESS_TEXT';
  text: string;
  action: ProcessActionType;
  customPrompt?: string;
}

export interface ProcessTextSuccess {
  type: 'PROCESS_TEXT_RESULT';
  text: string;
}

export interface ProcessTextError {
  type: 'PROCESS_TEXT_ERROR';
  error: string;
}

export interface TestConnectionRequest {
  type: 'TEST_CONNECTION';
}

export interface TestConnectionResult {
  type: 'TEST_CONNECTION_RESULT';
  success: boolean;
  error?: string;
}

export type RequestMessage = ProcessTextRequest | TestConnectionRequest;
export type ResponseMessage = ProcessTextSuccess | ProcessTextError | TestConnectionResult;

/**
 * Settings stored in browser.storage.local
 */
export interface ExtensionSettings {
  apiKey: string;
  openrouterApiKey: string;
  enabled: boolean;
  model: string;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiKey: '',
  openrouterApiKey: '',
  enabled: true,
  model: 'gemini-3.1-flash-lite-preview',
};

