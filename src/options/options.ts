import { getSettings, saveSettings, saveApiKey, addIgnoredWord, removeIgnoredWord, addIgnoredDomain, removeIgnoredDomain, saveProviderSettings } from '../shared/utils/storage';
import type { Settings, CategorySettings, ProviderSettings } from '../shared/types/settings';
import type { IssueCategory } from '../shared/types/analysis';
import type { LLMProviderConfig, LLMProviderType } from '../shared/types/llm';
import { getVersionDisplay } from '../shared/version';

const CATEGORIES: IssueCategory[] = ['spelling', 'grammar', 'style', 'clarity', 'tone'];

const API_KEY_HELP_LINKS: Record<LLMProviderType, string> = {
  groq: 'https://console.groq.com/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  anthropic: 'https://console.anthropic.com/settings/keys',
  together: 'https://api.together.xyz/settings/api-keys',
  mistral: 'https://console.mistral.ai/api-keys/',
};

class OptionsPage {
  private settings: Settings | null = null;
  private providers: LLMProviderConfig[] = [];
  private activeProvider: LLMProviderType = 'groq';

  async init(): Promise<void> {
    this.settings = await getSettings();
    // Clean up any corrupted/empty domains on load
    await this.cleanupIgnoredDomains();
    await this.loadProviders();
    this.activeProvider = this.settings?.providerSettings?.activeProvider || 'groq';
    this.populateForm();
    this.setupEventListeners();
  }

  private async cleanupIgnoredDomains(): Promise<void> {
    if (!this.settings) return;

    const ignoredDomains = this.settings.ignoredDomains || [];
    console.log('[AuroraWrite Options] Current ignored domains:', ignoredDomains);

    // Filter out empty/invalid domains
    const validDomains = ignoredDomains.filter(d => d && typeof d === 'string' && d.trim().length > 0);

    // If there were invalid entries, clean them up
    if (validDomains.length !== ignoredDomains.length) {
      console.log('[AuroraWrite Options] Cleaning up invalid domains. Removed:', ignoredDomains.length - validDomains.length);
      await saveSettings({ ignoredDomains: validDomains });
      this.settings = await getSettings();
    }
  }

  private async loadProviders(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PROVIDERS' });
      if (response.type === 'PROVIDERS_RESPONSE') {
        this.providers = response.payload;
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      // Fallback to default providers
      this.providers = [
        { type: 'groq', name: 'Groq', freeTier: true, models: [{ id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' }] } as LLMProviderConfig,
      ];
    }
  }

  private populateForm(): void {
    if (!this.settings) return;

    this.renderProviderGrid();
    this.updateProviderConfig();

    for (const category of CATEGORIES) {
      const config = this.settings.categories[category];
      const checkbox = document.getElementById(`cat-${category}`) as HTMLInputElement;
      const sensitivity = document.getElementById(`sens-${category}`) as HTMLSelectElement;

      if (checkbox) checkbox.checked = config.enabled;
      if (sensitivity) sensitivity.value = config.sensitivity;
    }

    this.renderIgnoredWords();
    this.renderIgnoredDomains();
  }

  private renderProviderGrid(): void {
    const grid = document.getElementById('provider-grid');
    if (!grid) return;

    grid.innerHTML = this.providers.map(provider => `
      <div class="provider-card${provider.type === this.activeProvider ? ' active' : ''}" data-provider="${provider.type}">
        <div class="provider-card-header">
          <span class="provider-name">${provider.name}</span>
          <span class="provider-badge ${provider.freeTier ? 'free' : 'paid'}">${provider.freeTier ? 'Free Tier' : 'Paid'}</span>
        </div>
      </div>
    `).join('');

    // Add click handlers
    grid.querySelectorAll('.provider-card').forEach(card => {
      card.addEventListener('click', () => {
        const providerType = card.getAttribute('data-provider') as LLMProviderType;
        this.selectProvider(providerType);
      });
    });
  }

  private selectProvider(providerType: LLMProviderType): void {
    this.activeProvider = providerType;
    this.renderProviderGrid();
    this.updateProviderConfig();
  }

  private updateProviderConfig(): void {
    const provider = this.providers.find(p => p.type === this.activeProvider);
    if (!provider) return;

    // Update API key input
    const apiKeyInput = document.getElementById('provider-api-key') as HTMLInputElement;
    const savedApiKey = this.settings?.providerSettings?.providers?.[this.activeProvider]?.apiKey ||
      (this.activeProvider === 'groq' ? this.settings?.apiKey : '');
    if (apiKeyInput) {
      apiKeyInput.value = savedApiKey || '';
    }

    // Update help text
    const helpText = document.getElementById('api-key-help');
    if (helpText) {
      const link = API_KEY_HELP_LINKS[this.activeProvider];
      helpText.innerHTML = `Get your API key from <a href="${link}" target="_blank">${provider.name}</a>`;
    }

    // Update model select
    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
    if (modelSelect) {
      modelSelect.innerHTML = provider.models.map(model =>
        `<option value="${model.id}">${model.name}</option>`
      ).join('');

      const savedModel = this.settings?.providerSettings?.providers?.[this.activeProvider]?.model ||
        (this.activeProvider === 'groq' ? this.settings?.model : '') ||
        provider.defaultModel;
      modelSelect.value = savedModel;
    }
  }

  private renderIgnoredWords(): void {
    const container = document.getElementById('ignored-words-list');
    if (!container || !this.settings) return;

    if (this.settings.ignoredWords.length === 0) {
      container.innerHTML = '<span class="tags-empty">No ignored words</span>';
      return;
    }

    // Clear container and build elements programmatically
    container.innerHTML = '';

    this.settings.ignoredWords.forEach((word) => {
      const tag = document.createElement('span');
      tag.className = 'tag';

      const textSpan = document.createElement('span');
      textSpan.className = 'tag-text';
      textSpan.textContent = word;
      tag.appendChild(textSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-remove';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.removeWord(word);
      });
      tag.appendChild(removeBtn);

      container.appendChild(tag);
    });
  }

  private renderIgnoredDomains(): void {
    const container = document.getElementById('ignored-domains-list');
    if (!container || !this.settings) return;

    const ignoredDomains = this.settings.ignoredDomains || [];

    console.log('[AuroraWrite Options] Rendering ignored domains:', JSON.stringify(ignoredDomains));

    if (ignoredDomains.length === 0) {
      container.innerHTML = '<span class="tags-empty">No ignored websites</span>';
      return;
    }

    // Clear container and build elements programmatically for reliable event handling
    container.innerHTML = '';

    ignoredDomains.forEach((domain, index) => {
      const safeDomain = String(domain || '');
      console.log('[AuroraWrite Options] Rendering domain:', safeDomain);

      const tag = document.createElement('span');
      tag.className = 'tag tag-domain';

      const textSpan = document.createElement('span');
      textSpan.className = 'tag-text';
      textSpan.textContent = safeDomain;
      tag.appendChild(textSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-remove';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AuroraWrite Options] Remove clicked for domain:', safeDomain);
        await this.removeDomain(safeDomain);
      });
      tag.appendChild(removeBtn);

      container.appendChild(tag);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private setupEventListeners(): void {
    document.getElementById('save-api-key')?.addEventListener('click', () => this.saveProviderApiKey());

    document.getElementById('add-word')?.addEventListener('click', () => this.addWord());

    document.getElementById('new-word')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addWord();
      }
    });

    document.getElementById('add-domain')?.addEventListener('click', () => this.addDomain());

    document.getElementById('new-domain')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addDomain();
      }
    });

    document.getElementById('save-settings')?.addEventListener('click', () => this.saveAllSettings());
  }

  private async saveProviderApiKey(): Promise<void> {
    const input = document.getElementById('provider-api-key') as HTMLInputElement;
    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
    const statusEl = document.getElementById('api-status');
    const apiKey = input.value.trim();
    const model = modelSelect?.value || '';

    if (!apiKey) {
      this.showStatus(statusEl, 'Please enter an API key', 'error');
      return;
    }

    this.showStatus(statusEl, 'Validating...', 'loading');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_API_KEY',
        payload: { apiKey, providerType: this.activeProvider },
      });

      if (response.type === 'API_KEY_VALID') {
        // Save provider settings
        const providerSettings: ProviderSettings = {
          activeProvider: this.activeProvider,
          providers: {
            ...this.settings?.providerSettings?.providers,
            [this.activeProvider]: { apiKey, model },
          },
        };

        await saveProviderSettings(providerSettings);

        // Also save as legacy apiKey for backwards compatibility
        if (this.activeProvider === 'groq') {
          await saveApiKey(apiKey);
        }

        if (this.settings) {
          this.settings.providerSettings = providerSettings;
          if (this.activeProvider === 'groq') {
            this.settings.apiKey = apiKey;
            this.settings.model = model;
          }
        }

        this.showStatus(statusEl, 'API key saved and validated!', 'success');
      } else {
        this.showStatus(statusEl, 'Invalid API key', 'error');
      }
    } catch (error) {
      this.showStatus(statusEl, 'Failed to validate API key', 'error');
    }
  }

  private showStatus(element: HTMLElement | null, message: string, type: 'success' | 'error' | 'loading'): void {
    if (!element) return;

    element.textContent = message;
    element.className = `status-badge ${type}`;
    element.classList.remove('hidden');

    if (type !== 'loading') {
      setTimeout(() => {
        element.classList.add('hidden');
      }, 3000);
    }
  }

  private async addWord(): Promise<void> {
    const input = document.getElementById('new-word') as HTMLInputElement;
    const word = input.value.trim().toLowerCase();

    if (!word) return;

    await addIgnoredWord(word);
    this.settings = await getSettings();
    this.renderIgnoredWords();
    input.value = '';
  }

  private async removeWord(word: string): Promise<void> {
    await removeIgnoredWord(word);
    this.settings = await getSettings();
    this.renderIgnoredWords();
  }

  private async addDomain(): Promise<void> {
    const input = document.getElementById('new-domain') as HTMLInputElement;
    let domain = input.value.trim().toLowerCase();

    if (!domain) return;

    // Clean up the domain (remove protocol, path, etc.)
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    await addIgnoredDomain(domain);
    this.settings = await getSettings();
    this.renderIgnoredDomains();
    input.value = '';
  }

  private async removeDomain(domain: string): Promise<void> {
    console.log('[AuroraWrite Options] Removing domain:', domain);
    await removeIgnoredDomain(domain);
    this.settings = await getSettings();
    console.log('[AuroraWrite Options] Settings after removal:', this.settings.ignoredDomains);
    this.renderIgnoredDomains();
  }

  private async saveAllSettings(): Promise<void> {
    const categories: Record<IssueCategory, CategorySettings> = {} as Record<IssueCategory, CategorySettings>;

    for (const category of CATEGORIES) {
      const checkbox = document.getElementById(`cat-${category}`) as HTMLInputElement;
      const sensitivity = document.getElementById(`sens-${category}`) as HTMLSelectElement;

      categories[category] = {
        enabled: checkbox?.checked ?? true,
        sensitivity: (sensitivity?.value as 'low' | 'medium' | 'high') ?? 'medium',
      };
    }

    const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
    const model = modelSelect?.value || 'llama-3.1-8b-instant';

    // Save provider settings along with other settings
    const providerSettings: ProviderSettings = {
      activeProvider: this.activeProvider,
      providers: {
        ...this.settings?.providerSettings?.providers,
        [this.activeProvider]: {
          ...this.settings?.providerSettings?.providers?.[this.activeProvider],
          model,
        },
      },
    };

    await saveSettings({ categories, model, providerSettings });
    this.settings = await getSettings();

    const statusEl = document.getElementById('save-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 2000);
    }
  }
}

// Update version display
function updateVersionDisplay(): void {
  const versionText = getVersionDisplay();

  // Update nav version badge
  const navVersion = document.getElementById('nav-version');
  if (navVersion) {
    navVersion.textContent = versionText;
  }

  // Update footer version
  const versionEl = document.getElementById('version-display');
  if (versionEl) {
    versionEl.textContent = `AuroraWrite ${versionText}`;
  }
}

// Setup toggle visibility button
function setupToggleVisibility(): void {
  const toggleBtn = document.getElementById('toggle-visibility');
  const input = document.getElementById('provider-api-key') as HTMLInputElement;
  const eyeIcon = toggleBtn?.querySelector('.icon-eye');
  const eyeOffIcon = toggleBtn?.querySelector('.icon-eye-off');

  if (toggleBtn && input) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      eyeIcon?.classList.toggle('hidden', !isPassword);
      eyeOffIcon?.classList.toggle('hidden', isPassword);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateVersionDisplay();
  setupToggleVisibility();
  const page = new OptionsPage();
  page.init();
});
