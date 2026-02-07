import { DEFAULT_SETTINGS, type Settings, type ProviderSettings } from '../types/settings';

const STORAGE_KEY = 'aurora_write_settings';

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      const stored = result[STORAGE_KEY];
      if (stored) {
        resolve({ ...DEFAULT_SETTINGS, ...stored });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    });
  });
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...settings };

  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: updated }, () => {
      resolve();
    });
  });
}

export async function getApiKey(): Promise<string> {
  const settings = await getSettings();
  return settings.apiKey;
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await saveSettings({ apiKey });
}

export async function getIgnoredWords(): Promise<string[]> {
  const settings = await getSettings();
  return settings.ignoredWords;
}

export async function addIgnoredWord(word: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.ignoredWords.includes(word.toLowerCase())) {
    settings.ignoredWords.push(word.toLowerCase());
    await saveSettings({ ignoredWords: settings.ignoredWords });
  }
}

export async function removeIgnoredWord(word: string): Promise<void> {
  const settings = await getSettings();
  settings.ignoredWords = settings.ignoredWords.filter(
    (w) => w !== word.toLowerCase()
  );
  await saveSettings({ ignoredWords: settings.ignoredWords });
}

export async function saveProviderSettings(providerSettings: ProviderSettings): Promise<void> {
  await saveSettings({ providerSettings });
}

export async function getProviderSettings(): Promise<ProviderSettings | undefined> {
  const settings = await getSettings();
  return settings.providerSettings;
}

export async function getIgnoredDomains(): Promise<string[]> {
  const settings = await getSettings();
  return settings.ignoredDomains || [];
}

export async function addIgnoredDomain(domain: string): Promise<void> {
  // Validate domain - don't add empty or invalid domains
  const cleanDomain = (domain || '').trim().toLowerCase();
  if (!cleanDomain || cleanDomain === 'localhost' && cleanDomain.length < 3) {
    return;
  }

  const settings = await getSettings();
  const ignoredDomains = settings.ignoredDomains || [];
  if (!ignoredDomains.includes(cleanDomain)) {
    ignoredDomains.push(cleanDomain);
    await saveSettings({ ignoredDomains });
  }
}

export async function removeIgnoredDomain(domain: string): Promise<void> {
  const settings = await getSettings();
  const domainToRemove = domain.toLowerCase();
  const ignoredDomains = (settings.ignoredDomains || []).filter(
    (d) => d.toLowerCase() !== domainToRemove
  );
  await saveSettings({ ignoredDomains });
}

export async function isDomainIgnored(domain: string): Promise<boolean> {
  const settings = await getSettings();
  const ignoredDomains = settings.ignoredDomains || [];
  return ignoredDomains.includes(domain.toLowerCase());
}
