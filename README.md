# AuroraWrite

<p align="center">
  <img src="src/assets/icons/icon128.png" alt="AuroraWrite Logo" width="128" height="128">
</p>

<p align="center">
  <strong>AI-Powered Writing Assistant for Chrome</strong>
</p>

<p align="center">
  Real-time grammar, spelling, and style suggestions powered by AI.<br>
  Works anywhere on the web.
</p>

<p align="center">
  <a href="https://github.com/hanif-mianjee/AuroraWrite/releases">
    <img src="https://img.shields.io/github/v/release/hanif-mianjee/AuroraWrite?style=flat-square" alt="Release">
  </a>
  <a href="https://github.com/hanif-mianjee/AuroraWrite/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/hanif-mianjee/AuroraWrite?style=flat-square" alt="License">
  </a>
</p>

---

## Features

- **Spelling Check** - Catch typos and misspellings with intelligent context-aware detection
- **Grammar Analysis** - Subject-verb agreement, tense consistency, article usage, and more
- **Style Suggestions** - Identify wordiness, passive voice, and repetitive phrases
- **Clarity Insights** - Detect unclear or ambiguous sentences
- **Tone Detection** - Ensure your writing matches the intended formality level
- **Text Transforms** - Select text to rephrase, shorten, adjust tone, or translate

## AI Providers

AuroraWrite supports multiple AI providers:

| Provider | Free Tier | Models |
|----------|-----------|--------|
| **Groq** | Yes | Llama 3.1/3.3, Mixtral |
| **OpenAI** | No | GPT-4, GPT-3.5 |
| **Gemini** | Yes | Gemini Pro |
| **Anthropic** | No | Claude 3 |
| **Together** | Yes | Various open-source |
| **Mistral** | Partial | Mistral 7B/Large |

## Installation

### From Releases (Recommended)

1. Download the latest release from [GitHub Releases](https://github.com/hanif-mianjee/AuroraWrite/releases)
2. Unzip the downloaded file
3. Open Chrome and navigate to `chrome://extensions`
4. Enable "Developer mode" (top right)
5. Click "Load unpacked" and select the unzipped folder

### From Source

```bash
# Clone the repository
git clone https://github.com/hanif-mianjee/AuroraWrite.git
cd AuroraWrite

# Install dependencies
npm install

# Build the extension
npm run build
```

Then load the `dist/` folder as an unpacked extension in Chrome.

## Development

```bash
# Start development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Architecture

AuroraWrite uses an innovative **block-based analysis** system to minimize API calls and maximize performance.

### Three-Part Extension Structure

1. **Background Service Worker** - Handles LLM API calls, settings, caching, and message routing
2. **Content Script** - Orchestrates UI and analysis on web pages
3. **Options Page** - Extension settings UI

### Data Flow

```
User Types → Content Script (700ms debounce) → Split into Blocks → Detect Dirty Blocks
→ Send to Background → LLM API Call → Parse Issues → Update Overlay
→ Schedule Stability Pass → Verify → Display Results
```

### Key Optimizations

- **Hash-based Dirty Detection** - Only changed blocks are re-analyzed
- **Stability Pass System** - Verification passes ensure accuracy with confidence scoring
- **Shadow DOM Isolation** - UI components don't conflict with host page styles
- **Incremental Updates** - UI updates as each block completes analysis

## Project Structure

```
src/
├── ai/                  # Analysis orchestration
│   ├── blockAnalyzer.ts
│   └── stabilityPassManager.ts
├── background/          # Service worker
│   ├── index.ts
│   └── providers/       # LLM provider implementations
├── block/               # Block splitting & hashing
├── content/             # Content script & UI
│   ├── detector/        # Field detection
│   ├── overlay/         # Underline rendering
│   ├── widget/          # Floating widget
│   ├── popover/         # Suggestion popover
│   └── selection/       # Text transform UI
├── options/             # Settings page
├── welcome/             # Welcome page
├── shared/              # Shared types & utilities
└── state/               # State management
```

## Extending Functionality

### Adding a New LLM Provider

1. Create a new provider file in `src/background/providers/`:

```typescript
import { BaseLLMProvider } from './base-provider';
import type { LLMProviderConfig } from '../../shared/types/llm';

export class MyProvider extends BaseLLMProvider {
  public readonly config: LLMProviderConfig = {
    type: 'myprovider',
    name: 'My Provider',
    freeTier: true,
    models: [
      { id: 'model-1', name: 'Model 1' },
    ],
    defaultModel: 'model-1',
  };

  protected async callAPI(prompt: string, apiKey: string): Promise<string> {
    // Implement API call
  }
}
```

2. Register in `src/background/providers/llm-factory.ts`

### Adding a New Issue Category

1. Register in `src/shared/constants/categories.ts`:

```typescript
categoryRegistry.register({
  id: 'mycategory',
  name: 'My Category',
  color: '#ff5722',
  underlineStyle: 'wavy',
  description: 'Description of the category',
  defaultEnabled: true,
  defaultSensitivity: 'medium',
});
```

### Adding a New Text Transformer

1. Register in `src/shared/constants/transformers.ts`:

```typescript
transformerRegistry.register({
  id: 'mytransform',
  name: 'My Transform',
  prompt: 'Your transformation prompt here',
});
```

## Building & Packaging

### Development Build

```bash
npm run dev
```

This starts Vite in watch mode. Changes are automatically rebuilt.

### Production Build

```bash
npm run build
```

Creates an optimized build in the `dist/` directory.

### Versioning

The project uses automated version management. Version is synced across:
- `package.json`
- `manifest.json`
- `docs/home.js`

**Quick Release Commands:**

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm run version:patch

# Bump minor version (1.0.0 -> 1.1.0)
npm run version:minor

# Bump major version (1.0.0 -> 2.0.0)
npm run version:major

# Set specific version
npm run release 1.2.3
```

These commands will:
1. Update version in all files
2. Build the extension
3. Create a git commit
4. Create a git tag

**After running a version command:**

```bash
# Push changes and tags
git push origin main --tags

# Create GitHub release (requires gh CLI)
gh release create v1.0.1 --generate-notes
```

**Sync version without releasing:**

```bash
npm run version:sync
```

### Creating a Release

1. Run `npm run version:patch` (or minor/major)
2. Push changes: `git push origin main --tags`
3. Create GitHub release: `gh release create vX.X.X --generate-notes`
4. Attach the `dist/` folder as a zip file

## Publishing to Chrome Web Store

1. Build the extension: `npm run build`
2. Zip the `dist/` folder
3. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Create a new item or update existing
5. Upload the zip file
6. Fill in store listing details
7. Submit for review

## Tech Stack

- **TypeScript** 5.3.3 (strict mode)
- **Vite** 5.4.2 with @crxjs/vite-plugin
- **Chrome Extension** Manifest V3
- **ES2022** target, ES Modules

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- Built with love by [Hanif Mianjee](https://github.com/hanif-mianjee)
- Powered by Groq, OpenAI, Google, Anthropic, Together, and Mistral AI

---

<p align="center">
  <a href="https://hanif-mianjee.github.io/AuroraWrite/">Website</a>
  ·
  <a href="https://github.com/hanif-mianjee/AuroraWrite/issues">Report Bug</a>
  ·
  <a href="https://github.com/hanif-mianjee/AuroraWrite/issues">Request Feature</a>
</p>
