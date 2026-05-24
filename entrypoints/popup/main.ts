import './style.css';
import type { ExtensionSettings, TestConnectionRequest } from '@/utils/messages';
import { DEFAULT_SETTINGS } from '@/utils/messages';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
const eyeIcon = document.getElementById('eye-icon') as HTMLSpanElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const enabledToggle = document.getElementById('enabled-toggle') as HTMLInputElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

// --- Load settings ---
async function loadSettings() {
  const data = await browser.storage.local.get('settings');
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };

  apiKeyInput.value = settings.apiKey;
  modelSelect.value = settings.model;
  enabledToggle.checked = settings.enabled;
}

// --- Save settings ---
async function saveSettings() {
  const settings: ExtensionSettings = {
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    enabled: enabledToggle.checked,
  };

  await browser.storage.local.set({ settings });
  showStatus('Settings saved ✓', 'success');
}

// --- Show/hide API key ---
let keyVisible = false;
toggleKeyBtn.addEventListener('click', () => {
  keyVisible = !keyVisible;
  apiKeyInput.type = keyVisible ? 'text' : 'password';
  eyeIcon.textContent = keyVisible ? '🙈' : '👁';
});

// --- Save handler ---
saveBtn.addEventListener('click', async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    await saveSettings();
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Settings';
  }
});

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
