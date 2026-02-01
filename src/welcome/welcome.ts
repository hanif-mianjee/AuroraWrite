/**
 * AuroraWrite Welcome Page
 *
 * Handles welcome page interactions and checks API configuration status
 */

import { VERSION, getVersionDisplay } from '../shared/version';

// Update version displays
function updateVersionDisplays(): void {
  const versionBadge = document.getElementById('version-badge');
  const footerVersion = document.getElementById('footer-version');

  const versionText = getVersionDisplay();

  if (versionBadge) {
    versionBadge.textContent = versionText;
  }

  if (footerVersion) {
    footerVersion.textContent = versionText;
  }
}

// Check if API key is configured
async function checkApiConfiguration(): Promise<boolean> {
  try {
    const result = await chrome.storage.sync.get(['apiKey', 'providerType']);
    return !!(result.apiKey && result.apiKey.trim());
  } catch {
    return false;
  }
}

// Update step status based on configuration
async function updateStepStatus(): Promise<void> {
  const step1Status = document.getElementById('step-1-status');
  const isConfigured = await checkApiConfiguration();

  if (step1Status) {
    if (isConfigured) {
      step1Status.innerHTML = '<span class="status-done">Configured</span>';
    } else {
      step1Status.innerHTML = '<span class="status-pending">Pending</span>';
    }
  }
}

// Open settings page
function openSettings(): void {
  if (chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    // Fallback for development
    window.open('chrome-extension://' + chrome.runtime.id + '/src/options/index.html', '_blank');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateVersionDisplays();
  updateStepStatus();

  // Bind open settings button
  const openSettingsBtn = document.getElementById('open-settings');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', openSettings);
  }

  // Add entrance animations with intersection observer
  const animatedElements = document.querySelectorAll('.animate-fade-in, .animate-fade-in-up, .animate-fade-in-left');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  animatedElements.forEach((el) => observer.observe(el));
});

// Listen for storage changes to update status in real-time
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiKey) {
    updateStepStatus();
  }
});
