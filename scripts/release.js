#!/usr/bin/env node

/**
 * Release Script
 *
 * Bumps version, syncs files, commits, and creates a git tag.
 *
 * Usage:
 *   node scripts/release.js patch    # 1.0.0 -> 1.0.1
 *   node scripts/release.js minor    # 1.0.0 -> 1.1.0
 *   node scripts/release.js major    # 1.0.0 -> 2.0.0
 *   node scripts/release.js 1.2.3    # Set specific version
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readJSON(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function bumpVersion(currentVersion, type) {
  const parts = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      // Assume it's a version string
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}. Use patch, minor, major, or a version string like 1.2.3`);
  }
}

function updateHomeJS(filePath, version) {
  let content = readFileSync(filePath, 'utf-8');
  content = content.replace(
    /const VERSION = '[^']+'/,
    `const VERSION = '${version}'`
  );
  writeFileSync(filePath, content);
}

function exec(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: rootDir, stdio: 'inherit', ...options });
}

function main() {
  const versionType = process.argv[2];

  if (!versionType) {
    console.error('Usage: node scripts/release.js <patch|minor|major|version>');
    console.error('Examples:');
    console.error('  node scripts/release.js patch    # 1.0.0 -> 1.0.1');
    console.error('  node scripts/release.js minor    # 1.0.0 -> 1.1.0');
    console.error('  node scripts/release.js major    # 1.0.0 -> 2.0.0');
    console.error('  node scripts/release.js 1.2.3    # Set specific version');
    process.exit(1);
  }

  // Check for uncommitted changes
  try {
    execSync('git diff-index --quiet HEAD --', { cwd: rootDir });
  } catch {
    console.error('Error: You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  const packagePath = join(rootDir, 'package.json');
  const manifestPath = join(rootDir, 'manifest.json');
  const homeJsPath = join(rootDir, 'docs', 'home.js');

  // Get current version
  const pkg = readJSON(packagePath);
  const currentVersion = pkg.version;
  const newVersion = bumpVersion(currentVersion, versionType);

  console.log(`\nBumping version: ${currentVersion} -> ${newVersion}\n`);

  // Update package.json
  pkg.version = newVersion;
  writeJSON(packagePath, pkg);
  console.log(`Updated package.json`);

  // Update manifest.json
  const manifest = readJSON(manifestPath);
  manifest.version = newVersion;
  manifest.version_name = newVersion;
  writeJSON(manifestPath, manifest);
  console.log(`Updated manifest.json`);

  // Update docs/home.js
  try {
    updateHomeJS(homeJsPath, newVersion);
    console.log(`Updated docs/home.js`);
  } catch (e) {
    console.log('Skipped docs/home.js (file not found)');
  }

  // Build the extension
  console.log('\nBuilding and packaging extension...');
  exec('npm run package');

  // Git operations
  console.log('\nCommitting changes...');
  exec('git add package.json manifest.json docs/home.js');
  exec(`git commit -m "chore: release v${newVersion}"`);

  console.log('\nCreating git tag...');
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

  console.log(`
====================================
Release v${newVersion} complete!
====================================

Next steps:
1. Push changes:     git push origin main
2. Push tags:        git push origin v${newVersion}
3. Create release:   gh release create v${newVersion} --generate-notes

Or push everything:
  git push --follow-tags -f
`);
}

main();
