# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AuroraWrite is a Chrome Extension (Manifest v3) that provides AI-powered writing assistance with real-time grammar, spelling, and style suggestions. It uses incremental block-based analysis to minimize API calls and improve performance.

## Build Commands

```bash
npm run dev      # Watch mode for development
npm run build    # Production build to dist/
```

The extension builds to `dist/` - load this as an unpacked extension in Chrome.

## Architecture

### Three-Part Extension Structure

1. **Background Service Worker** (`src/background/index.ts`) - Handles LLM API calls, settings, caching, and message routing
2. **Content Script** (`src/content/index.ts`) - Main `AuroraWrite` class that orchestrates UI and analysis on web pages
3. **Options Page** (`src/options/`) - Extension settings UI

### Key Subsystems

- **`src/ai/`** - Analysis orchestration: `blockAnalyzer.ts` for incremental analysis, `stabilityPassManager.ts` for post-analysis verification
- **`src/background/providers/`** - Pluggable LLM providers (Groq, OpenAI, Gemini, Anthropic, Together, Mistral) via factory pattern in `llm-factory.ts`
- **`src/block/`** - Block splitting and hash-based dirty detection
- **`src/state/inputTextStore.ts`** - Per-field state management with block tracking and issue lifecycle
- **`src/content/`** - UI components: detector, overlay, widget, popover, selection handling
- **`src/shared/`** - Types, constants (CategoryRegistry, TransformerRegistry), and utilities

### Data Flow

```
User types → Content script (700ms debounce) → Split into blocks → Detect dirty blocks
→ Send ANALYZE_BLOCK to background → LLM API call → Parse TextIssue objects
→ Update overlay → Schedule stability pass (1000ms idle) → Verify blocks → Display results
```

### Key Patterns

- **Factory Pattern**: LLMFactory manages provider implementations
- **Registry Pattern**: CategoryRegistry and TransformerRegistry for extensible categories/transformers
- **Block-Based Analysis**: Hash-based dirty detection, only re-analyze changed blocks
- **Stability Pass System**: Verifies blocks post-analysis with confidence scoring (0.8 threshold, max 2 passes)
- **Issue State Machine**: Tracks issue lifecycle (`source`, `status`) with request ID validation

### Message Protocol

Content script communicates with background via `chrome.runtime.sendMessage`:
- `ANALYZE_TEXT`, `ANALYZE_BLOCK`, `VERIFY_BLOCK`, `TRANSFORM_TEXT`
- All messages include request IDs to prevent race conditions

## Tech Stack

- TypeScript 5.3.3 (strict mode)
- Vite 5.4.2 with @crxjs/vite-plugin
- ES2022 target, ES Modules
- No test framework or linter currently configured

## Important Constraints

- **DO NOT BREAK EXISTING FUNCTIONALITY** - This is emphasized in project requirements
- Changes should be incremental with review between milestones
- The block analysis system is performance-critical - maintain hash-based dirty detection
