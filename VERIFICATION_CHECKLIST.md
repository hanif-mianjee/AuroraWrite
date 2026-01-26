# AuroraWrite Extension - Verification Checklist

## Pre-Installation Verification ✅

- [x] All JavaScript files have valid syntax
- [x] manifest.json is valid JSON
- [x] All referenced files exist
- [x] Icons are present (SVG format)
- [x] Content scripts are in correct load order
- [x] Background worker configured as ES6 module
- [x] Content scripts use IIFE pattern (no ES6 modules)

## File Structure Verification ✅

```
extension/
├── manifest.json ✓
├── icon16.svg ✓
├── icon48.svg ✓
├── icon128.svg ✓
├── background/
│   ├── worker.js ✓
│   ├── ratelimit.js ✓
│   └── llm/
│       ├── provider.js ✓
│       ├── groq.js ✓
│       └── mock.js ✓
├── content/
│   ├── cache.js ✓
│   ├── renderer.js ✓
│   ├── observer.js ✓
│   └── overlay.css ✓
├── options/
│   ├── options.html ✓
│   ├── options.css ✓
│   └── options.js ✓
└── shared/
    ├── constants.js ✓
    └── schema.js ✓
```

## Manual Testing Checklist

### Installation Tests
- [ ] Extension loads without errors in chrome://extensions/
- [ ] No error messages in extension details
- [ ] Icons display correctly
- [ ] Options page opens without errors

### Mock Provider Tests
- [ ] Can select Mock provider in options
- [ ] Can save settings
- [ ] Status message shows "Settings saved successfully"

### Basic Functionality Tests (Mock Mode)
- [ ] Open test-page.html in browser
- [ ] Type in textarea: "He has went home"
- [ ] Wait 1 second
- [ ] Red underline appears under "has went"
- [ ] Hover shows popover with suggestion "has gone"
- [ ] Click suggestion applies it
- [ ] Error badge appears showing count

### Input Type Tests
- [ ] Works on textarea elements
- [ ] Works on input[type="text"] elements
- [ ] Works on contenteditable elements

### Spelling Test (Mock Mode)
- [ ] Type: "I recieve your email"
- [ ] Blue underline appears under "recieve"
- [ ] Suggestion shows "receive"

### Punctuation Test (Mock Mode)
- [ ] Type: "Hello world"
- [ ] Yellow underline or suggestion for missing period

### Style Test (Mock Mode)
- [ ] Type: "The report was completed by me"
- [ ] Purple underline suggests active voice

### Cache Test
- [ ] Type same text twice
- [ ] Check console for "cached" message on second analysis
- [ ] Verify no duplicate API calls

### Debounce Test
- [ ] Start typing continuously
- [ ] Verify no analysis happens while typing
- [ ] Stop typing
- [ ] Verify analysis happens after 1 second

### Multiple Fields Test
- [ ] Open test-page.html
- [ ] Type in first textarea
- [ ] Switch to second textarea
- [ ] Type in second textarea
- [ ] Verify both get analyzed independently

### Options Page Tests
- [ ] Open options page
- [ ] Change debounce delay to 2000
- [ ] Save settings
- [ ] Verify new delay is applied (type and wait 2 seconds)

### Rate Limiting Test
- [ ] Make multiple rapid edits
- [ ] After 3 requests in a minute, verify rate limit message
- [ ] Wait a minute
- [ ] Verify requests work again

### Groq Provider Tests (Requires API Key)
- [ ] Get Groq API key from console.groq.com
- [ ] Enter API key in options
- [ ] Select Groq provider
- [ ] Save settings
- [ ] Type text with errors
- [ ] Verify real AI suggestions appear

### Real-World Website Tests
- [ ] Test on Gmail compose
- [ ] Test on GitHub issue/PR description
- [ ] Test on LinkedIn post
- [ ] Test on Notion page
- [ ] Test on any contenteditable website

### Error Handling Tests
- [ ] Type text longer than max length (>3000 chars)
- [ ] Verify no analysis happens
- [ ] Check console for "Text too long" message

### UI/UX Tests
- [ ] Underlines are visible and color-coded
- [ ] Popovers position correctly
- [ ] Popovers don't go off screen
- [ ] Badge doesn't overlap text
- [ ] Animations are smooth
- [ ] No flicker or jank

### Clean-up Tests
- [ ] Navigate away from page
- [ ] Verify overlays are removed
- [ ] Check for memory leaks (console)

### Developer Mode Tests
- [ ] Enable developer mode in options
- [ ] Check console for detailed logs
- [ ] Verify latency is shown
- [ ] Verify request/response details appear

### Cache Clear Test
- [ ] Click "Clear Cache" button
- [ ] Verify success message
- [ ] Type previously analyzed text
- [ ] Verify fresh analysis happens

## Performance Verification
- [ ] No typing lag
- [ ] Suggestions appear within 2 seconds
- [ ] Page scrolling is smooth
- [ ] No CPU spikes during idle

## Privacy Verification
- [ ] API key stored in chrome.storage.local
- [ ] No network requests during typing
- [ ] Only requests after debounce
- [ ] Only to configured LLM provider
- [ ] No telemetry or tracking

## Cross-Site Verification
Test on various popular sites:
- [ ] Gmail
- [ ] GitHub
- [ ] Notion
- [ ] Google Docs
- [ ] LinkedIn
- [ ] Twitter/X
- [ ] Reddit
- [ ] Stack Overflow
- [ ] JIRA
- [ ] Slack

## Known Issues to Watch For
- SVG icons might not work in some Chrome versions (use PNG if needed)
- Very long text (>3000 chars) is not analyzed
- Rate limits are per-minute, not per-hour
- Contenteditable support varies by implementation

## Success Criteria
✅ All core features work
✅ No console errors
✅ Suggestions appear and apply correctly
✅ Rate limiting prevents abuse
✅ Settings persist
✅ Privacy maintained
✅ Performance is acceptable
✅ UI is polished and professional

## Final Sign-Off
- [ ] Manual testing completed
- [ ] No critical bugs found
- [ ] Documentation reviewed
- [ ] Ready for user testing
