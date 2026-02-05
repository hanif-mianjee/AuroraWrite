# CLAUDE.md - Complete Developer Handover Document

This document provides comprehensive guidance for developers working on AuroraWrite. It contains everything needed to understand, maintain, and extend the codebase without reading individual files.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Quick Start](#quick-start)
3. [Architecture Overview](#architecture-overview)
4. [Directory Structure](#directory-structure)
5. [Core Components Deep Dive](#core-components-deep-dive)
6. [Data Flow & Message Protocol](#data-flow--message-protocol)
7. [State Management](#state-management)
8. [UI Components](#ui-components)
9. [LLM Provider System](#llm-provider-system)
10. [Categories & Transformers](#categories--transformers)
11. [Storage & Settings](#storage--settings)
12. [Key Algorithms](#key-algorithms)
13. [Common Tasks & Where to Look](#common-tasks--where-to-look)
14. [Important Constraints](#important-constraints)

---

## Project Overview

**AuroraWrite** is a Chrome Extension (Manifest v3) that provides AI-powered writing assistance with real-time grammar, spelling, and style suggestions.

### Mission
Provide seamless, intelligent writing assistance directly in any text field on the web, with minimal API calls and maximum responsiveness.

### Key Features
- Real-time spelling, grammar, style, clarity, and tone analysis
- Incremental block-based analysis (only re-analyze changed content)
- Multiple LLM provider support (Groq, OpenAI, Gemini, Anthropic, Together, Mistral)
- Text transformation (improve, rephrase, shorten, formal, friendly, translate)
- Per-domain disable option
- Ignored words dictionary

### Tech Stack
- **TypeScript 5.3.3** (strict mode enabled)
- **Vite 7.3.1** with @crxjs/vite-plugin for Chrome extension building
- **ES2022** target, ES Modules
- **Chrome Extension Manifest v3**

---

## Quick Start

### Build Commands
```bash
npm run dev      # Watch mode for development
npm run build    # Production build to dist/
npm run package  # Build + create ZIP for distribution
```

### Load Extension
1. Run `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" → select `dist/` folder

### Development Workflow
1. Run `npm run dev` (watch mode)
2. Make changes to source files
3. Extension auto-rebuilds
4. Click refresh icon on extension card in Chrome

---

## Architecture Overview

### Three-Part Chrome Extension Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     BACKGROUND SERVICE WORKER                │
│                   src/background/index.ts                    │
│                                                              │
│  • Receives messages from content script                     │
│  • Manages LLM API calls via provider factory               │
│  • Handles caching and rate limiting                        │
│  • Returns analysis results                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ chrome.runtime.sendMessage
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       CONTENT SCRIPT                         │
│                   src/content/index.ts                       │
│                                                              │
│  • Detects text fields on web pages                         │
│  • Orchestrates UI components (overlay, widget, popover)    │
│  • Manages block-based analysis flow                        │
│  • Handles user interactions (accept, ignore, transform)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        OPTIONS PAGE                          │
│                     src/options/                             │
│                                                              │
│  • API key configuration per provider                       │
│  • Category enable/disable and sensitivity                  │
│  • Ignored words and domains management                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

| Pattern | Usage | Location |
|---------|-------|----------|
| **Factory** | LLM provider instantiation | `src/background/providers/llm-factory.ts` |
| **Registry** | Extensible categories/transformers | `src/shared/constants/` |
| **Observer** | Field detection callbacks | `src/content/detector/` |
| **State Machine** | Issue lifecycle (new→applied→verified) | `src/state/inputTextStore.ts` |
| **Shadow DOM** | Style isolation for UI | All UI components |

---

## Directory Structure

```
src/
├── ai/                              # Analysis orchestration
│   ├── index.ts                    # Exports
│   ├── blockAnalyzer.ts            # Incremental block analysis coordinator
│   └── stabilityPassManager.ts     # Post-analysis verification system
│
├── background/                      # Background service worker
│   ├── index.ts                    # Message handler (306 lines)
│   ├── cache-manager.ts            # API response caching
│   ├── rate-limiter.ts             # API rate limiting
│   └── providers/                  # LLM provider implementations
│       ├── base-provider.ts        # Abstract base with prompts (517 lines)
│       ├── llm-factory.ts          # Factory pattern
│       ├── groq-provider.ts        # Groq API
│       ├── openai-provider.ts      # OpenAI GPT
│       ├── gemini-provider.ts      # Google Gemini
│       ├── anthropic-provider.ts   # Anthropic Claude
│       ├── together-provider.ts    # Together AI
│       └── mistral-provider.ts     # Mistral API
│
├── block/                           # Text block management
│   ├── blockSplitter.ts            # Split text into logical blocks
│   └── blockHasher.ts              # Hash-based dirty detection
│
├── content/                         # Content script & UI (917 lines main)
│   ├── index.ts                    # Main AuroraWrite class
│   ├── detector/                   # Text field detection
│   │   ├── text-field-detector.ts  # Detects textarea/contenteditable
│   │   ├── textarea-handler.ts     # Textarea/input text operations
│   │   └── contenteditable-handler.ts # Contenteditable operations
│   ├── overlay/                    # Issue visualization
│   │   ├── overlay-manager.ts      # Manages overlay per field
│   │   └── underline-renderer.ts   # Renders colored underlines
│   ├── widget/                     # Floating action widget
│   │   └── floating-widget.ts      # Issue count badge (580 lines)
│   ├── popover/                    # Suggestion detail popover
│   │   └── suggestion-popover.ts   # Accept/ignore UI (259 lines)
│   └── selection/                  # Text selection & transform
│       ├── selection-handler.ts    # Selection detection
│       ├── selection-trigger.ts    # Transform button
│       └── transform-popover.ts    # Transform options UI
│
├── state/                           # State management
│   └── inputTextStore.ts           # Per-field state (659 lines)
│
├── shared/                          # Shared code
│   ├── types/
│   │   ├── analysis.ts             # TextIssue, AnalysisResult
│   │   ├── messages.ts             # 24 message types
│   │   ├── settings.ts             # Settings interfaces
│   │   └── llm.ts                  # LLMProvider interface
│   ├── constants/
│   │   ├── categories.ts           # CategoryRegistry (6 categories)
│   │   └── transformers.ts         # TransformerRegistry (7 transforms)
│   ├── utils/
│   │   ├── debounce.ts             # 700ms debounce utility
│   │   ├── storage.ts              # Chrome storage wrapper
│   │   └── performance.ts          # Performance logging
│   └── version.ts                  # Version constant
│
├── options/                         # Settings page
│   ├── index.html
│   ├── options.ts                  # Settings logic (410 lines)
│   └── options.css                 # Styling (833 lines)
│
└── welcome/                         # Welcome page
    ├── index.html
    ├── welcome.ts
    └── welcome.css
```

---

## Core Components Deep Dive

### 1. AuroraWrite Main Class (`src/content/index.ts`)

The central orchestrator that coordinates all UI and analysis.

**Key Properties:**
```typescript
class AuroraWrite {
  private detector: TextFieldDetector;      // Finds text fields
  private overlayManager: OverlayManager;   // Renders underlines
  private widget: FloatingWidget;           // Issue count badge
  private popover: SuggestionPopover;       // Issue detail card
  private handlers: Map<string, Handler>;   // Per-field text handlers
  private activeFieldId: string | null;     // Currently focused field
  private sessionIgnoredIssues: Map<string, Set<string>>; // Ignored this session
}
```

**Key Methods:**

| Method | Purpose | Line |
|--------|---------|------|
| `analyzeField(field)` | Triggers block analysis | 128 |
| `handleBlockResult(msg)` | Processes LLM response | 301 |
| `acceptSuggestion(issue)` | Applies fix, updates state | 699 |
| `ignoreIssue(issue)` | Hides issue for session | 785 |
| `ignoreAllSimilar(issue)` | Persists to ignored words | 835 |
| `scheduleStabilityPass(fieldId)` | Queues verification | 212 |

### 2. Block Analyzer (`src/ai/blockAnalyzer.ts`)

Coordinates incremental analysis with request ID tracking.

**Key Concept:** Only dirty (changed) blocks are sent to LLM API.

```typescript
analyzeText(fieldId, text, callbacks) {
  // 1. Get dirty blocks from inputTextStore
  // 2. Generate unique requestId per block
  // 3. Send ANALYZE_BLOCK message for each
  // 4. Track pending blocks
  // 5. Call onAllBlocksComplete when done
}
```

**Race Condition Prevention:**
- Each block gets unique `requestId`
- Results validated against stored `requestId`
- Stale results discarded

### 3. Input Text Store (`src/state/inputTextStore.ts`)

Manages all state for text fields with block-level caching.

**Block State Structure:**
```typescript
interface BlockState {
  id: string;
  startOffset: number;
  endOffset: number;
  hash: string;              // For dirty detection
  text: string;
  issues: TextIssue[];
  isAnalyzed: boolean;
  isAnalyzing: boolean;
  confidence: number;        // 0.0-1.0, stable at >= 0.8
  passes: number;            // Stability passes completed
  hasUnappliedIssues: boolean; // BLOCKS stability pass if true
}
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `updateText(fieldId, text)` | Splits text, detects dirty blocks |
| `mergeBlockResult(...)` | Integrates LLM results |
| `getUnstableBlocks(fieldId)` | Returns blocks needing verification |
| `getAllIssues(fieldId)` | Returns all current issues |

### 4. Background Service Worker (`src/background/index.ts`)

Handles all LLM communication.

**Message Handlers:**

| Message | Purpose |
|---------|---------|
| `ANALYZE_BLOCK` | Block analysis with context |
| `VERIFY_BLOCK` | Stability pass verification |
| `TRANSFORM_TEXT` | Text transformation |
| `VALIDATE_API_KEY` | API key validation |
| `GET_PROVIDERS` | List available providers |
| `CLEAR_CACHE` | Force fresh analysis |

**Context Injection (ANALYZE_BLOCK):**
```typescript
// Provides surrounding text for better analysis
const contextText = `[Previous: ${prev}]\n\n${blockText}\n\n[Following: ${next}]`;
// LLM sees context but issues filtered to block range only
```

---

## Data Flow & Message Protocol

### Complete Analysis Flow

```
1. USER TYPES (debounced 700ms)
   └─→ AuroraWrite.analyzeField()

2. BLOCK DETECTION
   └─→ inputTextStore.updateText()
       └─→ splitIntoBlocks() → hash comparison → dirty blocks identified

3. SEND TO BACKGROUND (per dirty block)
   └─→ chrome.runtime.sendMessage({ type: 'ANALYZE_BLOCK', ... })

4. BACKGROUND PROCESSING
   └─→ Provider.analyzeText()
       └─→ Rate limit check → Cache check → LLM API call
       └─→ Parse JSON response → Create TextIssue objects

5. RECEIVE RESULTS
   └─→ AuroraWrite.handleBlockResult()
       └─→ blockAnalyzer.handleBlockResult()
           └─→ Validate requestId
           └─→ inputTextStore.mergeBlockResult()

6. UPDATE UI
   └─→ overlayManager.updateAnalysis() → underlines appear
   └─→ widget.update() → counts refresh

7. STABILITY PASS (1000ms after idle)
   └─→ stabilityPassManager.scheduleStabilityCheck()
       └─→ VERIFY_BLOCK messages (lighter prompt)
       └─→ Add new issues (never delete existing)
       └─→ Update confidence scores
```

### Message Types (24 total)

**Analysis:**
- `ANALYZE_TEXT` / `ANALYSIS_RESULT` / `ANALYSIS_ERROR`
- `ANALYZE_BLOCK` / `BLOCK_RESULT` / `BLOCK_ERROR`
- `VERIFY_BLOCK` / `VERIFY_RESULT` / `VERIFY_ERROR`

**Transform:**
- `TRANSFORM_TEXT` / `TRANSFORM_RESULT` / `TRANSFORM_ERROR`

**Settings:**
- `GET_SETTINGS` / `SETTINGS_RESPONSE`
- `VALIDATE_API_KEY` / `API_KEY_VALID` / `API_KEY_INVALID`
- `GET_PROVIDERS` / `PROVIDERS_RESPONSE`
- `CLEAR_CACHE`

---

## State Management

### Three Levels of State

| Level | Scope | Storage | Location |
|-------|-------|---------|----------|
| **Field State** | Per text field | Memory | `inputTextStore` |
| **Session State** | Current page session | Memory | `AuroraWrite.sessionIgnoredIssues` |
| **Persistent State** | Across sessions | `chrome.storage.sync` | `storage.ts` |

### Issue Lifecycle

```
new → applied (user accepted)
    → stale (text changed)
    → verified (stability pass confirmed)

Issues can be:
- ignored (session only, filtered from results)
- ignored all (persisted to ignoredWords)
```

### Confidence Scoring (Stability Pass)

```typescript
// Constants
STABLE_THRESHOLD = 0.8
NO_ISSUES_BOOST = +0.4
NEW_ISSUES_PENALTY = -0.3
MAX_PASSES = 2

// Block becomes stable when:
confidence >= 0.8 AND passes >= 1
```

---

## UI Components

### 1. Floating Widget (`src/content/widget/floating-widget.ts`)

**States:** `hidden` → `loading` → `issues` | `clean` | `error`

**Position:** Bottom-right of text field (fixed, z-index: max)

**Features:**
- Loading: Spinner + power button (hover)
- Issues: Category breakdown, "Fix All Spelling" button
- Clean: Checkmark → refresh on hover
- Power button: Disable for domain

### 2. Suggestion Popover (`src/content/popover/suggestion-popover.ts`)

**Layout:**
```
┌─────────────────────────┐
│ [●] Category Name       │
├─────────────────────────┤
│ ~~original~~ → suggested│
│ Explanation text...     │
├─────────────────────────┤
│ [Accept] [Ignore]       │
│ [Always Ignore]         │
└─────────────────────────┘
```

**Positioning:** Below underline, flips above if near bottom

### 3. Overlay Manager (`src/content/overlay/overlay-manager.ts`)

- Creates Shadow DOM container per field
- Positions absolutely over text field
- Delegates to UnderlineRenderer for visual rendering

### 4. Underline Renderer (`src/content/overlay/underline-renderer.ts`)

**Styles per category:**
- `solid` - Simple colored line
- `wavy` - SVG sine wave
- `dashed` - Repeating dashes
- `dotted` - Repeating dots
- `squiggly` - Zigzag pattern
- `double` - Two parallel lines

**Thickness:** Configurable per category (default 2-4px)

---

## LLM Provider System

### Provider Factory (`src/background/providers/llm-factory.ts`)

```typescript
// Get provider instance
const provider = LLMFactory.getProvider('groq'); // or 'openai', 'gemini', etc.

// Provider interface
interface LLMProvider {
  analyzeText(text, apiKey, settings): Promise<AnalysisResult>;
  verifyText(text, apiKey, settings): Promise<AnalysisResult>;
  transformText(text, type, apiKey, settings, customPrompt?): Promise<string>;
  validateApiKey(apiKey): Promise<boolean>;
}
```

### Supported Providers

| Provider | Free Tier | Default Model |
|----------|-----------|---------------|
| Groq | Yes | llama-3.1-8b-instant |
| OpenAI | No | gpt-4o-mini |
| Gemini | Yes | gemini-1.5-flash |
| Anthropic | No | claude-3-haiku |
| Together | Yes | meta-llama/Llama-3-8b-chat-hf |
| Mistral | Yes | mistral-small-latest |

### Base Provider (`src/background/providers/base-provider.ts`)

**Key Features:**
- Shared prompts (ANALYSIS_SYSTEM_PROMPT, VERIFICATION_SYSTEM_PROMPT)
- Response parsing with validation
- Caching (100 entries, 300s TTL)
- Rate limiting (30 req/60s)
- Pending request deduplication

**Prompts:**
- Analysis prompt: Full detailed checks (~118 lines)
- Verification prompt: Lighter, grammar-focused (~32 lines)

---

## Categories & Transformers

### Categories (`src/shared/constants/categories.ts`)

```typescript
interface CategoryConfig {
  id: string;
  name: string;
  color: string;
  underlineStyle: 'solid' | 'wavy' | 'dashed' | 'dotted' | 'squiggly' | 'double';
  thickness: number;
  description: string;
  defaultEnabled: boolean;
  defaultSensitivity: 'low' | 'medium' | 'high';
}
```

| Category | Color | Style | Thickness | Default |
|----------|-------|-------|-----------|---------|
| spelling | #e53935 (red) | wavy | 3 | enabled, high |
| grammar | #ff9800 (orange) | dashed | 3 | enabled, high |
| style | #2196f3 (blue) | dotted | 2 | enabled, medium |
| clarity | #9c27b0 (purple) | wavy | 2 | enabled, medium |
| tone | #4caf50 (green) | double | 2 | enabled, low |
| rephrase | #00bcd4 (cyan) | dotted | 2 | enabled, medium |

### Transformers (`src/shared/constants/transformers.ts`)

| Type | Description |
|------|-------------|
| improve | Fix grammar/spelling without changing tone |
| rephrase | Rewrite with different wording |
| shorten | Make concise (30% reduction target) |
| friendly | Make conversational |
| formal | Make professional |
| translate | English ↔ Spanish |
| custom | User-provided prompt |

---

## Storage & Settings

### Settings Structure

```typescript
interface Settings {
  apiKey: string;                    // Legacy Groq key
  model: string;                     // Legacy Groq model
  providerSettings: ProviderSettings; // Multi-provider config
  categories: Record<IssueCategory, CategorySettings>;
  ignoredWords: string[];            // Skip these in spelling
  ignoredDomains: string[];          // Disable on these sites
}

interface ProviderSettings {
  activeProvider: LLMProviderType;
  providers: Record<LLMProviderType, { apiKey: string; model: string }>;
}

interface CategorySettings {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
}
```

### Storage Functions (`src/shared/utils/storage.ts`)

| Function | Purpose |
|----------|---------|
| `getSettings()` | Load merged settings |
| `saveSettings(partial)` | Save partial update |
| `addIgnoredWord(word)` | Add to ignored list |
| `addIgnoredDomain(domain)` | Add to disabled sites |
| `isDomainIgnored(domain)` | Check if site disabled |

---

## Key Algorithms

### 1. Block Splitting (`src/block/blockSplitter.ts`)

```
Text → Split by double newlines (paragraphs)
     → If block > MAX_SIZE, split by sentences
     → If still > MAX_SIZE, split by fixed chunks
```

### 2. Dirty Detection (`src/block/blockHasher.ts`)

```typescript
// Hash = MD5 of normalized text
function hashBlock(text: string): string {
  return md5(text.trim().toLowerCase());
}

// Block is dirty if:
// - New block (no matching hash in old blocks)
// - Hash changed (content modified)
```

### 3. Offset Adjustment (Background)

```typescript
// Context added for better analysis:
const contextText = `[Prev: ...]\n\n${blockText}\n\n[Next: ...]`;

// Issues from LLM have offsets into contextText
// Must filter to block range and adjust:
issue.startOffset = llmOffset - contextPrefixLength + blockStartOffset;
```

### 4. Stability Pass Eligibility

```typescript
// Block eligible for stability pass if:
block.isAnalyzed === true &&
block.isAnalyzing === false &&
block.isStabilityChecking === false &&
block.hasUnappliedIssues === false &&  // CRITICAL
block.passes < MAX_PASSES &&
block.confidence < STABLE_THRESHOLD
```

---

## Common Tasks & Where to Look

### Adding a New LLM Provider

1. Create `src/background/providers/[name]-provider.ts`
2. Extend `BaseProvider`
3. Implement `callAPI()` method
4. Register in `llm-factory.ts`
5. Add host permission in `manifest.json`

### Adding a New Issue Category

1. Add to `IssueCategory` type in `src/shared/types/analysis.ts`
2. Register in `src/shared/constants/categories.ts`
3. Add to `IssueCounts` type
4. Update prompts in `base-provider.ts`

### Adding a New Transform Type

1. Add to `TransformationType` in `src/shared/types/messages.ts`
2. Register in `src/shared/constants/transformers.ts`
3. Add prompt template in `base-provider.ts`

### Modifying Underline Styles

1. Edit `getUnderlineStyle()` in `src/content/overlay/underline-renderer.ts`
2. Style uses CSS backgrounds (gradients, SVG)
3. Thickness from `CategoryConfig.thickness`

### Changing Widget Appearance

1. Edit `src/content/widget/floating-widget.ts`
2. Styles in `getStyles()` method
3. HTML in `getWidgetHTML()` method

### Modifying Analysis Prompts

1. Edit `ANALYSIS_SYSTEM_PROMPT` in `src/background/providers/base-provider.ts`
2. Edit `VERIFICATION_SYSTEM_PROMPT` for stability pass
3. Be careful with JSON output format requirements

### Debugging Analysis Flow

1. Check console for `[AuroraWrite]` prefixed logs
2. Block analyzer logs: `[AuroraWrite] Block analysis started/complete`
3. Stability pass logs: `[AuroraWrite:Stability]`
4. Background logs visible in service worker console

---

## Important Constraints

### DO NOT Break

1. **Block-based dirty detection** - Critical for performance
2. **Request ID validation** - Prevents race conditions
3. **Stability pass guards** - `hasUnappliedIssues` check is critical
4. **Shadow DOM isolation** - Prevents CSS conflicts

### Performance Critical

- 700ms debounce on input (don't reduce)
- Only dirty blocks sent to API
- Cache results (100 entries, 300s TTL)
- Rate limit: 30 requests per 60 seconds

### User Experience

- Underlines appear incrementally (per-block)
- Accept/ignore actions are instant (UI updates before API)
- Last suggestion triggers fresh analysis
- Session-ignored issues filter without API call

### Security

- API keys stored in `chrome.storage.sync` (encrypted by Chrome)
- No API keys in code or logs
- Domain validation before adding to ignored list

---

## Version & Release

**Current Version:** 0.1.0

**Version Management:**
```bash
npm run version:patch  # 0.1.0 → 0.1.1
npm run version:minor  # 0.1.0 → 0.2.0
npm run version:major  # 0.1.0 → 1.0.0
npm run release        # Full release process
```

**Files with version:**
- `package.json`
- `manifest.json`
- `src/shared/version.ts`

---

## Quick Reference

### File → Responsibility

| File | What it does |
|------|--------------|
| `content/index.ts` | Main orchestrator, start here |
| `background/index.ts` | All LLM communication |
| `state/inputTextStore.ts` | All state management |
| `ai/blockAnalyzer.ts` | Analysis coordination |
| `background/providers/base-provider.ts` | Prompts & parsing |
| `content/widget/floating-widget.ts` | Issue count UI |
| `content/overlay/underline-renderer.ts` | Visual underlines |
| `shared/constants/categories.ts` | Category config |
| `options/options.ts` | Settings page |

### Debug Checklist

1. Is API key configured? (Options page)
2. Is domain ignored? (Check `ignoredDomains`)
3. Check browser console for errors
4. Check service worker console (background)
5. Verify extension permissions in manifest
