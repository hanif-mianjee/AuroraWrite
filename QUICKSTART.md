# Quick Start Guide

Get AuroraWrite running in 5 minutes!

## Step 1: Load Extension (1 minute)

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Toggle "Developer mode" ON (top right)
4. Click "Load unpacked"
5. Navigate to and select the `extension` folder

✅ You should see "AuroraWrite" in your extensions list

## Step 2: Configure (2 minutes)

### Option A: Quick Test with Mock Provider (No API Key)
1. Click the AuroraWrite icon in your toolbar
2. Select "Mock" from Provider dropdown
3. Click "Save Settings"

### Option B: Real AI with Groq (Requires Free API Key)
1. Visit https://console.groq.com (create free account)
2. Generate an API key
3. Click the AuroraWrite icon in your toolbar
4. Select "Groq" from Provider dropdown
5. Paste your API key
6. Click "Save Settings"

## Step 3: Test (2 minutes)

### Quick Test
1. Open any website with a text input (or use the included `test-page.html`)
2. Type: "He has went to the store"
3. Wait 1 second
4. See red underline appear!
5. Hover to see suggestion
6. Click to apply fix

### Test Page
Open `test-page.html` from the repository for comprehensive testing with pre-filled examples.

## What You Should See

✅ **Colored Underlines**
- Red = Grammar errors
- Blue = Spelling mistakes  
- Yellow = Punctuation issues
- Purple = Style suggestions

✅ **Hover Popover**
Shows category, original text, and clickable suggestions

✅ **Error Badge**
Small badge near input showing error counts by color

## Troubleshooting

❌ **No suggestions appearing?**
- Wait at least 1 second after typing
- Check provider is set (Mock or Groq)
- If using Groq, verify API key is correct
- Check browser console (F12) for errors

❌ **Extension not loading?**
- Make sure you selected the `extension` folder
- Check `chrome://extensions/` for error messages
- Verify all files are present

❌ **API errors?**
- Verify your Groq API key
- Check you haven't hit rate limits (3 requests/minute)
- Try Mock provider to verify extension works

## Next Steps

- **Configure settings** in Options page
- **Test on real sites** like Gmail, GitHub, LinkedIn
- **Adjust debounce delay** for your preference
- **Enable dev mode** to see what's happening

## Support

- Read `README.md` for full documentation
- Check `INSTALLATION.md` for detailed setup
- Review `VERIFICATION_CHECKLIST.md` for testing guide

---

**That's it!** You're ready to write better with AuroraWrite! ✨
