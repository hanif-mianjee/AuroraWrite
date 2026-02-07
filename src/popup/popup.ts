import { getSettings, saveSettings, removeIgnoredDomain } from '../shared/utils/storage';
import { categoryRegistry } from '../shared/constants/categories';
import type { Settings, CategorySettings } from '../shared/types/settings';
import type { IssueCategory } from '../shared/types/analysis';
import { getVersionDisplay } from '../shared/version';

const CATEGORIES: IssueCategory[] = ['spelling', 'grammar', 'style', 'clarity', 'tone', 'rephrase'];

class PopupPage {
  private settings: Settings | null = null;

  async init(): Promise<void> {
    this.settings = await getSettings();
    this.renderCategories();
    this.renderDomains();
    this.setupEventListeners();
  }

  private renderCategories(): void {
    const container = document.getElementById('categories-list');
    if (!container || !this.settings) return;

    container.innerHTML = '';

    for (const categoryId of CATEGORIES) {
      const config = categoryRegistry.get(categoryId);
      if (!config) continue;

      const categorySettings = this.settings.categories[categoryId];
      const isEnabled = categorySettings?.enabled ?? config.defaultEnabled;

      const row = document.createElement('div');
      row.className = 'popup-category-row';

      const dot = document.createElement('span');
      dot.className = 'popup-category-dot';
      dot.style.background = config.color;
      row.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'popup-category-name';
      name.textContent = config.name;
      row.appendChild(name);

      const toggle = document.createElement('label');
      toggle.className = 'popup-toggle';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = isEnabled;
      input.dataset.category = categoryId;
      input.addEventListener('change', () => this.onCategoryToggle(categoryId, input.checked));
      toggle.appendChild(input);

      const track = document.createElement('span');
      track.className = 'popup-toggle-track';
      toggle.appendChild(track);

      row.appendChild(toggle);
      container.appendChild(row);
    }
  }

  private renderDomains(): void {
    const container = document.getElementById('domains-list');
    if (!container || !this.settings) return;

    const domains = this.settings.ignoredDomains || [];
    container.innerHTML = '';

    if (domains.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'popup-domains-empty';
      empty.textContent = 'No ignored websites';
      container.appendChild(empty);
      return;
    }

    for (const domain of domains) {
      const safeDomain = String(domain || '').trim();
      if (!safeDomain) continue;

      const tag = document.createElement('span');
      tag.className = 'popup-domain-tag';

      const text = document.createElement('span');
      text.className = 'popup-domain-text';
      text.textContent = safeDomain;
      tag.appendChild(text);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'popup-domain-remove';
      removeBtn.title = 'Remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.removeDomain(safeDomain);
      });
      tag.appendChild(removeBtn);

      container.appendChild(tag);
    }
  }

  private async onCategoryToggle(categoryId: IssueCategory, enabled: boolean): Promise<void> {
    if (!this.settings) return;

    const categories = { ...this.settings.categories };
    categories[categoryId] = {
      ...categories[categoryId],
      enabled,
    };

    await saveSettings({ categories });
    this.settings = await getSettings();
  }

  private async removeDomain(domain: string): Promise<void> {
    await removeIgnoredDomain(domain);
    this.settings = await getSettings();
    this.renderDomains();
  }

  private setupEventListeners(): void {
    // Open settings gear button
    document.getElementById('open-settings')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Open full settings button
    document.getElementById('open-settings-full')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function updateVersionDisplay(): void {
  const versionText = getVersionDisplay();
  const versionEl = document.getElementById('popup-version');
  if (versionEl) {
    versionEl.textContent = versionText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateVersionDisplay();
  const page = new PopupPage();
  page.init();
});
