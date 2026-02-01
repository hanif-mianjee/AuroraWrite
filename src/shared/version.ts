/**
 * AuroraWrite Version Management
 *
 * This module exports the extension version from package.json.
 * The version is injected at build time by Vite.
 */

// Version is injected at build time via Vite's define option
declare const __APP_VERSION__: string;

export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const VERSION_INFO = {
  version: VERSION,
  name: 'AuroraWrite',
  description: 'AI-powered writing assistant with real-time grammar, spelling, and style suggestions',
  repository: 'https://github.com/hanif-mianjee/AuroraWrite',
  author: 'Hanif Mianjee',
};

/**
 * Get formatted version string for display
 */
export function getVersionDisplay(): string {
  return `v${VERSION}`;
}

/**
 * Get full version info for about sections
 */
export function getFullVersionInfo(): typeof VERSION_INFO {
  return VERSION_INFO;
}
