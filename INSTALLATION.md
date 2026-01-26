# Installation Guide

## Quick Start

### 1. Load the Extension

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" toggle (top right corner)
4. Click "Load unpacked"
5. Select the `extension` folder from this repository

### 2. Configure AuroraWrite

1. Click the AuroraWrite icon in your browser toolbar (or right-click and select "Options")
2. Choose your LLM provider:
   - **Mock**: No API key needed, good for testing
   - **Groq**: Requires API key (get one free from https://console.groq.com)

#### For Groq Provider:
3. Sign up at https://console.groq.com
4. Create an API key
5. Paste your API key in the extension options
6. Set model name (e.g., `mixtral-8x7b-32768`)
7. Click "Save Settings"

#### For Mock Provider:
3. Just select "Mock" from the provider dropdown
4. Click "Save Settings"

### 3. Test the Extension

1. Open the included `test-page.html` in your browser, OR
2. Navigate to any website with text inputs (Gmail, GitHub, Notion, etc.)
3. Start typing in any text field
4. Pause for 1 second
5. Look for colored underlines on text with suggestions
6. Hover over underlines to see suggested fixes
7. Click a suggestion to apply it

## Settings Explained

- **Provider**: Choose your LLM backend (Groq for real AI, Mock for testing)
- **API Key**: Your Groq API key (stored locally, never sent anywhere except Groq)
- **Model Name**: Which Groq model to use (default: mixtral-8x7b-32768)
- **Debounce Delay**: How long to wait after typing stops before analyzing (default: 1000ms)
- **Max Text Length**: Maximum characters to analyze (default: 3000)
- **Developer Mode**: Enable console logging for debugging

## Troubleshooting

### Extension doesn't load
- Make sure you selected the `extension` folder, not the root folder
- Check for any error messages in `chrome://extensions/`
- Ensure all files are present in the extension folder

### No suggestions appearing
- Verify your API key is correct (if using Groq)
- Try the Mock provider first to verify functionality
- Check browser console (F12) for error messages
- Make sure you're typing in a supported field (textarea, input, contenteditable)

### API errors
- Verify your Groq API key is valid
- Check that you haven't exceeded rate limits
- Try the Mock provider to verify the extension works

### Rate limit errors
- The extension limits requests to prevent API abuse
- Per tab: 1 request per 5 seconds
- Global: 3 requests per minute
- Wait a moment and try again

## Supported Input Types

AuroraWrite works on:
- `<textarea>` elements
- `<input type="text">` elements
- `contenteditable` elements (like rich text editors)

Works on popular sites:
- Gmail
- GitHub
- Notion
- Google Docs
- JIRA
- Slack
- LinkedIn
- And many more!

## Privacy & Security

- API keys are stored in Chrome's local storage only
- No data is sent to any server except your chosen LLM provider
- No telemetry or tracking
- Works only on text you actively type in
- You control all settings

## Next Steps

- Try different websites and input types
- Experiment with settings to find your preferred configuration
- Report any issues on GitHub
- Contribute improvements!
