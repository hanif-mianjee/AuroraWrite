#!/usr/bin/env node

/**
 * Version Sync Script
 *
 * Syncs version across all files:
 * - package.json (source of truth)
 * - manifest.json
 * - docs/home.js
 *
 * Usage:
 *   node scripts/version-sync.js          # Sync from package.json
 *   node scripts/version-sync.js 1.2.3    # Set specific version
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function updateHomeJS(filePath, version) {
  let content = readFileSync(filePath, 'utf-8');
  content = content.replace(
    /const VERSION = '[^']+'/,
    `const VERSION = '${version}'`
  );
  writeFileSync(filePath, content);
}

function main() {
  const packagePath = join(rootDir, 'package.json');
  const manifestPath = join(rootDir, 'manifest.json');
  const homeJsPath = join(rootDir, 'docs', 'home.js');

  // Get version from argument or package.json
  let version = process.argv[2];

  if (!version) {
    const pkg = readJSON(packagePath);
    version = pkg.version;
    console.log(`Using version from package.json: ${version}`);
  } else {
    // Update package.json with new version
    const pkg = readJSON(packagePath);
    pkg.version = version;
    writeJSON(packagePath, pkg);
    console.log(`Updated package.json to: ${version}`);
  }

  // Update manifest.json
  const manifest = readJSON(manifestPath);
  manifest.version = version;
  writeJSON(manifestPath, manifest);
  console.log(`Updated manifest.json to: ${version}`);

  // Update docs/home.js
  try {
    updateHomeJS(homeJsPath, version);
    console.log(`Updated docs/home.js to: ${version}`);
  } catch (e) {
    console.log('Skipped docs/home.js (file not found)');
  }

  console.log(`\nVersion synced to: ${version}`);
}

main();
