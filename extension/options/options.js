// Options page script
import { CONSTANTS } from '../shared/constants.js';

// Get DOM elements
const providerSelect = document.getElementById('provider');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const debounceInput = document.getElementById('debounceMs');
const maxLengthInput = document.getElementById('maxLength');
const devModeCheckbox = document.getElementById('devMode');
const saveBtn = document.getElementById('saveBtn');
const clearCacheBtn = document.getElementById('clearCacheBtn');
const statusDiv = document.getElementById('status');
const apiKeyGroup = document.getElementById('apiKeyGroup');
const modelGroup = document.getElementById('modelGroup');

/**
 * Load settings from storage
 */
async function loadSettings() {
  const settings = await chrome.storage.local.get([
    CONSTANTS.STORAGE_KEYS.PROVIDER,
    CONSTANTS.STORAGE_KEYS.API_KEY,
    CONSTANTS.STORAGE_KEYS.MODEL_NAME,
    CONSTANTS.STORAGE_KEYS.DEBOUNCE_MS,
    CONSTANTS.STORAGE_KEYS.MAX_LENGTH,
    CONSTANTS.STORAGE_KEYS.DEV_MODE
  ]);
  
  providerSelect.value = settings[CONSTANTS.STORAGE_KEYS.PROVIDER] || CONSTANTS.DEFAULTS.PROVIDER;
  apiKeyInput.value = settings[CONSTANTS.STORAGE_KEYS.API_KEY] || '';
  modelNameInput.value = settings[CONSTANTS.STORAGE_KEYS.MODEL_NAME] || CONSTANTS.DEFAULTS.MODEL_NAME;
  debounceInput.value = settings[CONSTANTS.STORAGE_KEYS.DEBOUNCE_MS] || CONSTANTS.DEFAULTS.DEBOUNCE_MS;
  maxLengthInput.value = settings[CONSTANTS.STORAGE_KEYS.MAX_LENGTH] || CONSTANTS.DEFAULTS.MAX_LENGTH;
  devModeCheckbox.checked = settings[CONSTANTS.STORAGE_KEYS.DEV_MODE] || CONSTANTS.DEFAULTS.DEV_MODE;
  
  updateProviderFields();
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    [CONSTANTS.STORAGE_KEYS.PROVIDER]: providerSelect.value,
    [CONSTANTS.STORAGE_KEYS.API_KEY]: apiKeyInput.value,
    [CONSTANTS.STORAGE_KEYS.MODEL_NAME]: modelNameInput.value,
    [CONSTANTS.STORAGE_KEYS.DEBOUNCE_MS]: parseInt(debounceInput.value),
    [CONSTANTS.STORAGE_KEYS.MAX_LENGTH]: parseInt(maxLengthInput.value),
    [CONSTANTS.STORAGE_KEYS.DEV_MODE]: devModeCheckbox.checked
  };
  
  try {
    await chrome.storage.local.set(settings);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

/**
 * Clear analysis cache
 */
async function clearCache() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'clearCache'
    });
    
    if (response && response.success) {
      showStatus('Cache cleared successfully!', 'success');
    } else {
      showStatus('Error clearing cache', 'error');
    }
  } catch (error) {
    showStatus('Error clearing cache: ' + error.message, 'error');
  }
}

/**
 * Show status message
 * @param {string} message - Message to show
 * @param {string} type - Type: 'success' or 'error'
 */
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  
  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

/**
 * Update provider-specific fields visibility
 */
function updateProviderFields() {
  const provider = providerSelect.value;
  
  if (provider === 'mock') {
    apiKeyGroup.classList.add('hidden');
    modelGroup.classList.add('hidden');
  } else {
    apiKeyGroup.classList.remove('hidden');
    modelGroup.classList.remove('hidden');
  }
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);
clearCacheBtn.addEventListener('click', clearCache);
providerSelect.addEventListener('change', updateProviderFields);

// Load settings on page load
loadSettings();
