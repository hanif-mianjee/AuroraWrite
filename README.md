# AuroraWrite — Personal AI Writing Assistant

**A Grammarly-like Chrome Extension powered by Groq LLM**

AuroraWrite is a **lightweight, professional, and privacy-first personal AI writing assistant** for the browser. It provides real-time, inline writing improvements across grammar, spelling, punctuation, and style — without disrupting user flow.

## ✨ Features

- **Real-time Analysis**: Detects typing in `<textarea>`, `<input type="text">`, and `contenteditable` elements
- **Smart Debouncing**: Analysis triggers after 1 second of typing pause (configurable)
- **Inline Underlines**: Color-coded by category (Grammar, Spelling, Punctuation, Style)
- **Hover Popovers**: Click-to-apply suggestions with explanations
- **Error Counter Badge**: Visual feedback near active input
- **Privacy-First**: API keys stored locally, no cloud sync
- **Rate Limited**: Prevents excessive API calls
- **Cached Results**: Reuses analysis for identical text

## 🎨 Category Colors

| Category    | Color  |
| ----------- | ------ |
| Grammar     | Red    |
| Spelling    | Blue   |
| Punctuation | Yellow |
| Style       | Purple |

## 🚀 Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/hanif-mianjee/AuroraWrite.git
   cd AuroraWrite
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `extension` folder

3. Configure your settings:
   - Click the AuroraWrite icon or right-click and select "Options"
   - Choose your LLM provider (Groq or Mock for testing)
   - Enter your API key (if using Groq)
   - Adjust debounce timing and max text length as needed

## 🔧 Configuration

### LLM Providers

#### Groq (Recommended)
- Get your free API key from [Groq Console](https://console.groq.com)
- Supports models: `mixtral-8x7b-32768`, `llama2-70b-4096`, etc.
- Fast and accurate

#### Mock Provider
- No API key required
- Offline testing mode
- Simple rule-based suggestions
- Great for development

### Settings

- **Provider**: Choose between Groq and Mock
- **API Key**: Your Groq API key (stored locally)
- **Model Name**: Groq model to use
- **Debounce Delay**: Wait time after typing (default: 1000ms)
- **Max Text Length**: Maximum characters to analyze (default: 3000)
- **Developer Mode**: Enable console logging for debugging

## 📁 Project Structure

```
extension/
├── manifest.json           # Chrome extension manifest (Manifest V3)
├── content/
│   ├── observer.js        # Input detection and event handling
│   ├── cache.js           # Text caching and hashing
│   ├── renderer.js        # Overlay and popover rendering
│   └── overlay.css        # Visual styles for underlines and UI
├── background/
│   ├── worker.js          # Background service worker
│   ├── llm/
│   │   ├── groq.js       # Groq LLM provider
│   │   ├── mock.js       # Mock provider for testing
│   │   └── provider.js   # Base provider interface
│   └── ratelimit.js      # Rate limiting logic
├── options/
│   ├── options.html      # Options page UI
│   ├── options.js        # Options page logic
│   └── options.css       # Options page styles
└── shared/
    ├── schema.js         # Data schema validation
    └── constants.js      # Shared constants
```

## 🏗️ Architecture

```
┌──────────────┐
│  Web Page    │
│  (DOM)       │
└─────┬────────┘
      │
┌─────▼────────┐
│ Content Script │
│ - Input observer
│ - Text cache
│ - Debouncer
│ - Overlay renderer
└─────┬────────┘
      │ chrome.runtime
┌─────▼────────┐
│ Background Worker │
│ - Rate limiting
│ - LLM provider
│ - Response parser
└─────┬────────┘
      │
┌─────▼────────┐
│ Options Page │
│ - API keys
│ - Provider config
│ - Dev mode
└──────────────┘
```

## 🔐 Privacy & Security

- **No Background Logging**: Text is only analyzed when you stop typing
- **Local Storage**: API keys stored in `chrome.storage.local`
- **No Telemetry**: No usage data is collected or sent
- **User-Controlled**: You manage your own API keys and data
- **Rate Limited**: Prevents excessive API calls

## 🎯 Usage

1. Navigate to any website with text inputs (Gmail, GitHub, Notion, etc.)
2. Start typing in a textarea, input field, or contenteditable element
3. After pausing for 1 second, AuroraWrite analyzes your text
4. Underlined text indicates suggestions
5. Hover over underlines to see suggestions
6. Click a suggestion to apply it

## 🧪 Testing

### Using Mock Provider

1. Go to Options
2. Select "Mock" as the provider
3. Save settings
4. Test with these sample texts:
   - "He has went to the store" (grammar error)
   - "I recieve your email" (spelling error)
   - "Hello world" (missing punctuation)

## 🛠️ Development

### Adding a New LLM Provider

1. Create a new provider class in `background/llm/`:
   ```javascript
   import { LLMProvider } from './provider.js';
   
   export class MyProvider extends LLMProvider {
     getName() {
       return 'myprovider';
     }
     
     async analyzeText(text, config) {
       // Implement API call
       // Return { suggestions: [...] }
     }
   }
   ```

2. Register in `background/worker.js`:
   ```javascript
   import { MyProvider } from './llm/myprovider.js';
   const providers = {
     groq: new GroqProvider(),
     mock: new MockProvider(),
     myprovider: new MyProvider()
   };
   ```

3. Add to options page dropdown

## 📝 LLM Response Schema

All providers must return this JSON structure:

```json
{
  "suggestions": [
    {
      "id": "unique-id",
      "category": "grammar|spelling|punctuation|style",
      "start": 0,
      "end": 10,
      "original": "text with issue",
      "replacements": ["corrected text"],
      "confidence": 0.95
    }
  ]
}
```

## 🚦 Rate Limits

- **Per Tab**: 1 request per 5 seconds
- **Global**: 3 requests per minute
- **Cache**: Identical text reuses cached results

## 🐛 Troubleshooting

### No suggestions appearing
- Check that you've configured your API key (if using Groq)
- Verify the provider is set correctly in Options
- Enable Developer Mode and check console logs
- Try the Mock provider to verify functionality

### API errors
- Verify your API key is correct
- Check that the model name is valid
- Ensure you haven't exceeded rate limits

### Performance issues
- Increase debounce delay in Options
- Reduce max text length
- Clear cache using "Clear Cache" button

## 🎓 Future Enhancements

- [ ] Support for OpenAI, Gemini, and local LLMs
- [ ] Full document scan mode
- [ ] Tone detection and adjustment
- [ ] Custom style guides
- [ ] Team collaboration features
- [ ] Analytics dashboard
- [ ] Browser support: Firefox, Edge, Safari

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- Chrome Extension Manifest V3
- Groq API
- Modern JavaScript (ES6+)

## 🔗 Links

- [GitHub Repository](https://github.com/hanif-mianjee/AuroraWrite)
- [Groq API Docs](https://console.groq.com/docs)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

---

**AuroraWrite** — *Your personal AI writing assistant — fast, private, and professional.*
