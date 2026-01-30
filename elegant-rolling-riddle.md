# AuroraWrite - Chrome Extension Implementation Plan

## Overview
AuroraWrite is a Grammarly-like personal AI writing assistant Chrome extension that provides real-time text analysis using Groq LLM with visual underline indicators, floating widget, and suggestion popovers.

## Project Structure

```
aurora-write/
├── manifest.json                     # Chrome Extension Manifest V3
├── package.json                      # Dependencies (TypeScript, Vite)
├── vite.config.ts                    # Build configuration
├── tsconfig.json                     # TypeScript config
│
├── src/
│   ├── background/                   # Service Worker
│   │   ├── index.ts                  # Entry point
│   │   ├── groq-client.ts            # Groq API wrapper
│   │   ├── cache-manager.ts          # LRU response cache
│   │   └── rate-limiter.ts           # API rate limiting
│   │
│   ├── content/                      # Content Scripts
│   │   ├── index.ts                  # Entry point
│   │   ├── detector/                 # Text field detection
│   │   │   ├── text-field-detector.ts
│   │   │   ├── textarea-handler.ts
│   │   │   └── contenteditable-handler.ts
│   │   ├── overlay/                  # Underline rendering
│   │   │   ├── overlay-manager.ts
│   │   │   └── underline-renderer.ts
│   │   ├── widget/                   # Floating counter widget
│   │   │   └── floating-widget.ts
│   │   └── popover/                  # Suggestion cards
│   │       └── suggestion-popover.ts
│   │
│   ├── options/                      # Options Page
│   │   ├── index.html
│   │   ├── options.ts
│   │   └── options.css
│   │
│   ├── shared/                       # Shared utilities
│   │   ├── types/
│   │   │   ├── analysis.ts           # Issue types
│   │   │   ├── messages.ts           # Message protocol
│   │   │   └── settings.ts           # Settings types
│   │   ├── constants/
│   │   │   └── categories.ts         # Issue category definitions
│   │   └── utils/
│   │       ├── debounce.ts
│   │       └── storage.ts
│   │
│   └── assets/
│       └── icons/                    # Extension icons
│
└── dist/                             # Build output
```

---

## Core Features

### 1. Issue Categories & Visual Indicators
| Category | Color | Underline Style | Description |
|----------|-------|-----------------|-------------|
| Spelling | Red (#e53935) | Squiggly | Typos and misspellings |
| Grammar | Orange (#ff9800) | Dashed | Subject-verb agreement, tense, articles |
| Style | Blue (#2196f3) | Dotted | Wordiness, passive voice, repetition |
| Clarity | Purple (#9c27b0) | Wavy | Unclear or ambiguous sentences |
| Tone | Green (#4caf50) | Double | Formality mismatches |

### 2. Floating Widget
- Appears at bottom-right corner of focused text field
- Shows issue counts by category with colored indicators
- Collapsible/expandable
- Click to jump to issues

### 3. Suggestion Popover
- Appears on hover/click of underlined text
- Shows: category header, original → suggested text, explanation
- Actions: Accept, Ignore, Ignore All

### 4. Options Page
- Groq API key configuration (with validation)
- Enable/disable individual categories
- Sensitivity settings
- Ignored words list

---

## Technical Approach

### Text Field Detection
- Detect: `<textarea>`, `<input type="text">`, `[contenteditable="true"]`
- Use MutationObserver for dynamically added elements
- Traverse open Shadow DOMs (closed are inaccessible by design)

### Underline Positioning
- **ContentEditable**: Use `Range.getClientRects()` for precise positioning
- **Textarea/Input**: Create hidden mirror element with identical styling to calculate text positions

### Overlay Strategy
- Inject overlay container as sibling to text field (not inside)
- Use closed Shadow DOM to isolate styles from page
- Position absolutely relative to text field

### Groq Integration
- Model: `llama-3.3-70b-versatile` (fast, accurate)
- JSON response format for structured output
- System prompt engineered for precise character offsets
- Debounce: 500ms after typing stops
- Cache responses (5 min TTL, 100 entry LRU)
- Rate limit: 30 requests/minute

### Performance Optimizations
- Debounced analysis (500ms)
- Incremental analysis (only re-analyze changed paragraphs)
- CSS transforms for position updates (avoid reflow)
- Request queuing with max 3 concurrent requests

---

## Implementation Steps

### Phase 1: Project Foundation
1. Initialize npm project with TypeScript + Vite
2. Configure Manifest V3 with required permissions
3. Set up build pipeline (dev/prod)
4. Create basic folder structure

### Phase 2: Core Infrastructure
5. Implement storage utilities (API key, settings)
6. Build message passing protocol
7. Create text field detector
8. Set up service worker skeleton

### Phase 3: Groq Integration
9. Implement Groq API client with prompts
10. Add rate limiting and caching
11. Build options page for API key config
12. Add request/response handling with validation

### Phase 4: Visual Layer
13. Create overlay manager with Shadow DOM
14. Implement underline renderer (ContentEditable)
15. Add mirror-based positioning for textarea
16. Build floating widget component

### Phase 5: Interactivity
17. Implement suggestion popover
18. Add accept/ignore functionality
19. Connect text replacement logic
20. Add keyboard navigation

### Phase 6: Polish & Testing
21. Performance optimization pass
22. Error handling and offline states
23. Cross-site testing (Gmail, Docs, Twitter, etc.)
24. Build production bundle

---

## Verification Plan

### Manual Testing
1. Load unpacked extension in Chrome
2. Test on various sites:
   - Simple textarea (GitHub comment)
   - ContentEditable (Gmail compose)
   - Complex editor (Google Docs, Notion)
3. Verify underlines appear at correct positions
4. Test suggestion popover and accept functionality
5. Verify widget counts update correctly
6. Test options page API key save/load

### Automated Testing
- Unit tests for Groq client response parsing
- Unit tests for text position calculations
- Integration tests for message passing

---

## Key Files to Create

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `manifest.json` | Extension configuration |
| 2 | `src/background/groq-client.ts` | LLM API integration |
| 3 | `src/content/detector/text-field-detector.ts` | Input detection |
| 4 | `src/content/overlay/underline-renderer.ts` | Visual underlines |
| 5 | `src/content/widget/floating-widget.ts` | Issue counter |
| 6 | `src/options/options.ts` | Settings page |
| 7 | `src/shared/types/analysis.ts` | Type definitions |

---

## Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@crxjs/vite-plugin": "^2.0.0"
  }
}
```

No runtime dependencies - vanilla TypeScript for minimal bundle size.
