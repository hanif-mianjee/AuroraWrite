# AuroraWrite Project Overview

## What Is AuroraWrite?

AuroraWrite is a **privacy-first, AI-powered writing assistant** for Chrome that provides real-time grammar, spelling, punctuation, and style suggestions—similar to Grammarly Premium, but with user-controlled LLM providers.

## Key Features

🎯 **Real-Time Suggestions**: Analyzes text as you type (after 1-second pause)
🎨 **Color-Coded Feedback**: Red (grammar), Blue (spelling), Yellow (punctuation), Purple (style)
🔒 **Privacy-First**: All data stored locally, no telemetry
⚡ **Fast & Lightweight**: ~46KB code, minimal performance impact
🔌 **Pluggable LLMs**: Groq, Mock (OpenAI/Gemini ready for future)
✨ **Professional UI**: Grammarly-style underlines and popovers

## Technical Stack

- **Platform**: Chrome Extension (Manifest V3)
- **Languages**: JavaScript (ES6+), HTML5, CSS3
- **APIs**: Chrome Extension APIs, Groq API
- **Architecture**: Service Worker + Content Scripts
- **Size**: ~46KB total code (excluding icons)

## Project Structure

```
AuroraWrite/
├── extension/                    # Chrome extension source
│   ├── manifest.json            # Extension configuration
│   ├── background/              # Service worker
│   │   ├── worker.js           # Main background logic
│   │   ├── ratelimit.js        # Rate limiting
│   │   └── llm/                # LLM providers
│   │       ├── provider.js     # Base interface
│   │       ├── groq.js         # Groq integration
│   │       └── mock.js         # Mock for testing
│   ├── content/                # Content scripts
│   │   ├── observer.js         # Input detection
│   │   ├── cache.js            # Text caching
│   │   ├── renderer.js         # UI rendering
│   │   └── overlay.css         # Styles
│   ├── options/                # Settings page
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── shared/                 # Shared utilities
│   │   ├── constants.js
│   │   └── schema.js
│   └── icon*.svg               # Extension icons
├── README.md                    # Full documentation
├── QUICKSTART.md               # 5-minute setup guide
├── INSTALLATION.md             # Detailed install guide
├── IMPLEMENTATION_SUMMARY.md   # Technical details
├── VERIFICATION_CHECKLIST.md   # Testing guide
└── test-page.html              # Testing interface
```

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  User types in text field                          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Content Script (observer.js)                      │
│  • Detects input in textarea/input/contenteditable │
│  • Debounces for 1 second                          │
│  • Checks cache for duplicate text                 │
└─────────────────┬───────────────────────────────────┘
                  │ (if changed)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Background Worker (worker.js)                     │
│  • Checks rate limits                              │
│  • Routes to LLM provider (Groq/Mock)              │
│  • Validates response                              │
│  • Caches result                                   │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  LLM Provider                                       │
│  • Groq: Sends to API, gets AI suggestions         │
│  • Mock: Rule-based suggestions (offline)          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│  Content Script (renderer.js)                      │
│  • Renders colored underlines                      │
│  • Shows hover popovers                            │
│  • Displays error badge                            │
│  • Handles click-to-apply                          │
└─────────────────────────────────────────────────────┘
```

## Key Components

### 1. Input Observer
Monitors all text inputs on web pages and triggers analysis after typing pauses.

### 2. Text Cache
Prevents duplicate API calls by hashing text content and caching analysis results.

### 3. Rate Limiter
Enforces limits (1 req/5sec per tab, 3 req/min global) to prevent API abuse.

### 4. LLM Providers
Pluggable interface for different AI backends. Currently: Groq (AI) and Mock (testing).

### 5. Overlay Renderer
Creates visual feedback with colored underlines, popovers, and error badges.

### 6. Options Page
User-friendly settings interface for provider selection, API keys, and performance tuning.

## Design Principles

1. **Privacy First**: No data leaves your control
2. **Performance**: Zero typing lag, debounced analysis
3. **Extensibility**: Easy to add new providers or features
4. **User Control**: Configure everything, control your data
5. **Professional UX**: Polished, Grammarly-like experience

## Supported Input Types

✅ `<textarea>` elements
✅ `<input type="text">` elements  
✅ `contenteditable` elements

Works on: Gmail, GitHub, Notion, LinkedIn, Slack, JIRA, and thousands more sites.

## Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| Provider | Mock | LLM backend (Groq/Mock) |
| API Key | - | Groq API key (if using Groq) |
| Model | mixtral-8x7b-32768 | Groq model name |
| Debounce | 1000ms | Wait time after typing |
| Max Length | 3000 | Max characters to analyze |
| Dev Mode | Off | Enable debug logging |

## Rate Limits

- **Per Tab**: 1 request per 5 seconds
- **Global**: 3 requests per minute
- **Cache**: Unlimited (auto-cleanup after 5 min)

## Performance Metrics

- **Code Size**: ~46 KB
- **Latency**: <2 seconds typical (depends on LLM)
- **Memory**: <10 MB typical
- **CPU**: Minimal (only during analysis)
- **Network**: Only when analyzing new text

## Privacy & Security

✅ No keystroke logging
✅ Analysis only on typing pause
✅ API keys stored locally only
✅ No telemetry or tracking
✅ Minimal permissions requested
✅ Open source (you can audit the code)

## Browser Compatibility

- ✅ Chrome 88+ (Manifest V3)
- 🚧 Edge (should work, untested)
- 🚧 Brave (should work, untested)
- ❌ Firefox (needs manifest v2 version)
- ❌ Safari (needs different implementation)

## Future Roadmap

### Phase 2 (Planned)
- OpenAI provider
- Google Gemini provider
- Local LLM support (Ollama)
- Tone detection & adjustment
- Full document scan mode

### Phase 3 (Vision)
- Team style guides
- Custom dictionaries
- Analytics dashboard
- Multi-language support
- Mobile browser support
- Cross-browser compatibility

## Development Status

✅ **MVP Complete**: All core features implemented
✅ **Code Quality**: Clean, modular, documented
✅ **Testing**: Manual testing framework ready
🚧 **User Testing**: Needs real-world feedback
🚧 **Chrome Store**: Not yet published

## Getting Started

1. **Quick Setup**: See `QUICKSTART.md` (5 minutes)
2. **Detailed Install**: See `INSTALLATION.md`
3. **Testing**: Use `test-page.html`
4. **Documentation**: Read `README.md`

## Contributing

This is an open-source project. Contributions welcome:

- 🐛 Report bugs via GitHub Issues
- 💡 Suggest features
- 🔧 Submit pull requests
- 📖 Improve documentation
- 🧪 Add test coverage

## License

MIT License - Free to use, modify, and distribute

## Support

- **Documentation**: Check markdown files in repo
- **Issues**: GitHub Issues
- **Testing**: Use included verification checklist

## Credits

Built with:
- Chrome Extension APIs
- Groq API (https://groq.com)
- Modern JavaScript (ES6+)
- Love for clean code ❤️

---

**AuroraWrite** — *Write better, privately, with AI*
