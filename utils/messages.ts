/**
 * Message types for content ↔ background communication.
 */

export interface ProofreadRequest {
  type: 'PROOFREAD';
  text: string;
}

export interface ProofreadSuccess {
  type: 'PROOFREAD_RESULT';
  text: string;
}

export interface ProofreadError {
  type: 'PROOFREAD_ERROR';
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

export type RequestMessage = ProofreadRequest | TestConnectionRequest;
export type ResponseMessage = ProofreadSuccess | ProofreadError | TestConnectionResult;

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
