import { getSettings, saveSettings, saveApiKey, addIgnoredWord, removeIgnoredWord } from '../shared/utils/storage';
import type { Settings, CategorySettings } from '../shared/types/settings';
import type { IssueCategory } from '../shared/types/analysis';

const CATEGORIES: IssueCategory[] = ['spelling', 'grammar', 'style', 'clarity', 'tone'];

class OptionsPage {
  private settings: Settings | null = null;

  async init(): Promise<void> {
    this.settings = await getSettings();
    this.populateForm();
    this.setupEventListeners();
  }

  private populateForm(): void {
    if (!this.settings) return;

    const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    apiKeyInput.value = this.settings.apiKey;

    for (const category of CATEGORIES) {
      const config = this.settings.categories[category];
      const checkbox = document.getElementById(`cat-${category}`) as HTMLInputElement;
      const sensitivity = document.getElementById(`sens-${category}`) as HTMLSelectElement;

      if (checkbox) checkbox.checked = config.enabled;
      if (sensitivity) sensitivity.value = config.sensitivity;
    }

    this.renderIgnoredWords();
  }

  private renderIgnoredWords(): void {
    const container = document.getElementById('ignored-words-list');
    if (!container || !this.settings) return;

    if (this.settings.ignoredWords.length === 0) {
      container.innerHTML = '<span class="tags-empty">No ignored words</span>';
      return;
    }

    container.innerHTML = this.settings.ignoredWords
      .map(
        (word) => `
        <span class="tag">
          ${this.escapeHtml(word)}
          <button class="tag-remove" data-word="${this.escapeHtml(word)}" title="Remove">×</button>
        </span>
      `
      )
      .join('');

    container.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const word = (e.target as HTMLElement).getAttribute('data-word');
        if (word) {
          await this.removeWord(word);
        }
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private setupEventListeners(): void {
    document.getElementById('toggle-visibility')?.addEventListener('click', () => {
      const input = document.getElementById('api-key') as HTMLInputElement;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('save-api-key')?.addEventListener('click', () => this.saveApiKey());

    document.getElementById('add-word')?.addEventListener('click', () => this.addWord());

    document.getElementById('new-word')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addWord();
      }
    });

    document.getElementById('save-settings')?.addEventListener('click', () => this.saveAllSettings());
  }

  private async saveApiKey(): Promise<void> {
    const input = document.getElementById('api-key') as HTMLInputElement;
    const statusEl = document.getElementById('api-status');
    const apiKey = input.value.trim();

    if (!apiKey) {
      this.showStatus(statusEl, 'Please enter an API key', 'error');
      return;
    }

    this.showStatus(statusEl, 'Validating...', 'loading');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'VALIDATE_API_KEY',
        payload: { apiKey },
      });

      if (response.type === 'API_KEY_VALID') {
        await saveApiKey(apiKey);
        if (this.settings) {
          this.settings.apiKey = apiKey;
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

    await saveSettings({ categories });
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

document.addEventListener('DOMContentLoaded', () => {
  const page = new OptionsPage();
  page.init();
});
