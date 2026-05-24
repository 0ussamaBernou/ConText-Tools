import './style.css';
import type { ExtensionSettings, TestConnectionRequest } from '@/utils/messages';
import { DEFAULT_SETTINGS } from '@/utils/messages';

const geminiKeyContainer = document.getElementById('gemini-key-container') as HTMLDivElement;
const openrouterKeyContainer = document.getElementById('openrouter-key-container') as HTMLDivElement;

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
const eyeIcon = document.getElementById('eye-icon') as HTMLSpanElement;

const openrouterKeyInput = document.getElementById('openrouter-key') as HTMLInputElement;
const toggleOpenrouterKeyBtn = document.getElementById('toggle-openrouter-key') as HTMLButtonElement;
const openrouterEyeIcon = document.getElementById('openrouter-eye-icon') as HTMLSpanElement;

const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

const saveIndicator = document.getElementById('save-indicator') as HTMLDivElement;
const indicatorDot = saveIndicator.querySelector('.indicator-dot') as HTMLSpanElement;
const indicatorText = saveIndicator.querySelector('.indicator-text') as HTMLSpanElement;

function isOpenRouterModel(modelName: string): boolean {
  return modelName.includes('/');
}

function updateKeyFieldsVisibility() {
  const model = modelSelect.value;
  if (isOpenRouterModel(model)) {
    geminiKeyContainer.classList.add('hidden');
    openrouterKeyContainer.classList.remove('hidden');
  } else {
    geminiKeyContainer.classList.remove('hidden');
    openrouterKeyContainer.classList.add('hidden');
  }
}

// --- Load settings ---
async function loadSettings() {
  const data = await browser.storage.local.get('settings');
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

  apiKeyInput.value = settings.apiKey || '';
  openrouterKeyInput.value = settings.openrouterApiKey || '';
  modelSelect.value = settings.model;
  enabledToggle.checked = settings.enabled;

  updateKeyFieldsVisibility();
}

// --- Debounce helper ---
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  const debounced = function (...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

let hideTimeout: ReturnType<typeof setTimeout>;

function showSaving() {
  clearTimeout(hideTimeout);
  saveIndicator.classList.add('show', 'saving');
  indicatorText.textContent = 'Saving…';
}

async function saveSettingsQuietly() {
  try {
    const settings: ExtensionSettings = {
      apiKey: apiKeyInput.value.trim(),
      openrouterApiKey: openrouterKeyInput.value.trim(),
      model: modelSelect.value,
      enabled: enabledToggle.checked,
    };
    await browser.storage.local.set({ settings });
    
    saveIndicator.classList.remove('saving');
    indicatorText.textContent = 'Saved';
    
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      saveIndicator.classList.remove('show');
    }, 2000);
  } catch (err) {
    console.error('[Writing Tools] Auto-save error:', err);
    saveIndicator.classList.remove('saving');
    indicatorText.textContent = 'Error';
  }
}

const debouncedSave = debounce(saveSettingsQuietly, 500);

function handleInputChange() {
  showSaving();
  debouncedSave();
}

function handleImmediateChange() {
  showSaving();
  saveSettingsQuietly();
}

// --- Save settings ---
async function saveSettings() {
  debouncedSave.cancel();
  showSaving();
  await saveSettingsQuietly();
}

// --- Show/hide Gemini API key ---
let keyVisible = false;
toggleKeyBtn.addEventListener('click', () => {
  keyVisible = !keyVisible;
  apiKeyInput.type = keyVisible ? 'text' : 'password';
  eyeIcon.textContent = keyVisible ? '🙈' : '👁';
});

// --- Show/hide OpenRouter API key ---
let openrouterKeyVisible = false;
toggleOpenrouterKeyBtn.addEventListener('click', () => {
  openrouterKeyVisible = !openrouterKeyVisible;
  openrouterKeyInput.type = openrouterKeyVisible ? 'text' : 'password';
  openrouterEyeIcon.textContent = openrouterKeyVisible ? '🙈' : '👁';
});

// --- Event listeners for auto-save ---
apiKeyInput.addEventListener('input', handleInputChange);
openrouterKeyInput.addEventListener('input', handleInputChange);

modelSelect.addEventListener('change', () => {
  updateKeyFieldsVisibility();
  handleImmediateChange();
});

enabledToggle.addEventListener('change', handleImmediateChange);

// --- Test connection ---
testBtn.addEventListener('click', async () => {
  // Save first so background picks up the current key
  await saveSettings();

  testBtn.disabled = true;
  testBtn.textContent = 'Testing…';
  showStatus('Testing connection…', 'info');

  try {
    const response = await browser.runtime.sendMessage({
      type: 'TEST_CONNECTION',
    } satisfies TestConnectionRequest);

    if (response?.type === 'TEST_CONNECTION_RESULT') {
      if (response.success) {
        showStatus('Connection successful ✓', 'success');
      } else {
        showStatus(`Connection failed: ${response.error}`, 'error');
      }
    } else {
      showStatus('Unexpected response from background.', 'error');
    }
  } catch (err: any) {
    showStatus(`Error: ${err.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

// --- Status display ---
function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusEl.textContent = message;
  statusEl.className = `status status-${type}`;
  statusEl.classList.remove('hidden');

  // Auto-hide after 4 seconds
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 4000);
}

// --- Init ---
loadSettings();
