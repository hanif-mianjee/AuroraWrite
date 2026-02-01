# Chrome Web Store Publishing Guide for AuroraWrite

This document contains all information required to publish AuroraWrite on the Chrome Web Store.

---

## Table of Contents

1. [Pre-Publishing Checklist](#pre-publishing-checklist)
2. [Developer Account Setup](#developer-account-setup)
3. [Store Listing Tab](#store-listing-tab)
4. [Privacy Tab](#privacy-tab)
5. [Distribution Tab](#distribution-tab)
6. [Required Assets](#required-assets)
7. [Permission Justifications](#permission-justifications)

---

## Pre-Publishing Checklist

- [ ] Register as Chrome Web Store Developer ($5 one-time fee)
- [ ] Prepare all required images (icons, screenshots, promotional tiles)
- [ ] Create privacy policy page (hosted URL required)
- [ ] Build production extension (`npm run build`)
- [ ] Test extension thoroughly
- [ ] Zip the `dist/` folder for upload

---

## Developer Account Setup

### Registration Requirements

| Field | Value |
|-------|-------|
| **Registration Fee** | $5 USD (one-time) |
| **Developer Email** | Your email address |
| **Publisher Name** | Your name or company name |

### Account Limits

- Maximum 20 published extensions per account
- Themes have no limit

---

## Store Listing Tab

### Product Details

#### Extension Name
**Field:** Name (displayed on Chrome Web Store)

| Requirement | Value |
|-------------|-------|
| **Max Length** | 75 characters |
| **Best Practice** | Clear, descriptive, memorable |

**Recommended Value:**
```
AuroraWrite - Your Personal AI Writing Assistant
```

---

#### Short Name
**Field:** Short name for limited space displays

| Requirement | Value |
|-------------|-------|
| **Max Length** | 12 characters |

**Recommended Value:**
```
AuroraWrite
```

---

#### Summary (Short Description)
**Field:** Brief description shown in search results

| Requirement | Value |
|-------------|-------|
| **Max Length** | 132 characters |
| **Best Practice** | Highlight primary use case, avoid superlatives |

**Recommended Value:**
```
Your personal AI writing assistant with all the premium features. Real-time grammar, spelling, and style suggestions. Supports 6+ LLM providers.
```

---

#### Detailed Description
**Field:** Full description on extension page

| Requirement | Value |
|-------------|-------|
| **Max Length** | No strict limit (recommended: 500-1000 words) |
| **Best Practice** | Overview paragraph + bullet points |

**Recommended Value:**
```
Write Better, Everywhere.

AuroraWrite is your personal AI writing assistant with all the premium features you need. Get real-time grammar, spelling, and style suggestions powered by AI - working in any text field across the web.

PREMIUM FEATURES:

• Spelling Check
  Catch typos and misspellings with intelligent context-aware detection

• Grammar Analysis
  Advanced checking for subject-verb agreement, tense consistency, article usage, and more

• Style Suggestions
  Improve readability by identifying wordiness, passive voice, and repetitive phrases

• Clarity Insights
  Detect unclear or ambiguous sentences that might confuse readers

• Tone Detection
  Ensure your writing matches the intended formality level for your audience

• Text Transforms
  Select any text to rephrase, shorten, adjust tone, or translate with AI-powered transformations

6+ AI PROVIDERS SUPPORTED:

• Groq - Ultra-fast inference with free tier (Recommended)
• OpenAI - GPT-4 and GPT-3.5 models
• Google Gemini - Great balance of speed and quality (Free tier)
• Anthropic Claude - Excellent for nuanced writing
• Together AI - Various open-source models (Free tier)
• Mistral - Efficient multilingual models

BUILT FOR PERFORMANCE:

• Block-Based Analysis - Only changed text blocks are re-analyzed, reducing API calls by up to 80%
• Hash-Based Detection - Instant dirty detection with no redundant processing
• Stability Pass System - Verification ensures accuracy with confidence scoring
• Shadow DOM Isolation - UI never conflicts with host page styles

100% PRIVACY-FIRST:

• Your API key is stored locally and never shared
• Text is only sent to YOUR chosen AI provider
• No data collection, tracking, or third-party sharing
• Open source - verify the code yourself!

WORKS EVERYWHERE:

• Gmail, Google Docs, LinkedIn
• Twitter/X, Facebook, Reddit
• Notion, Slack, Discord
• Any website with text input fields

GETTING STARTED:

1. Install the extension
2. Open Settings and choose your AI provider
3. Enter your API key (Groq offers a free tier!)
4. Start typing anywhere - suggestions appear automatically

PERFECT FOR:

• Writers and content creators
• Students and academics
• Professionals writing emails
• Non-native English speakers
• Developers documenting code
• Anyone who wants to communicate with confidence

Open source and built with love. Star us on GitHub!
```

---

#### Primary Category
**Field:** Main category for store placement

**Recommended Value:**
```
Productivity > Tools
```

**Alternative Categories:**
- Productivity > Writing
- Productivity > Education

---

#### Language
**Field:** Primary language of the extension

**Recommended Value:**
```
English
```

---

### Additional Information

#### Homepage URL
**Field:** Link to extension's website

**Recommended Value:**
```
https://hanif-mianjee.github.io/AuroraWrite/
```

---

#### Support URL
**Field:** Link to support/help page

**Recommended Value:**
```
https://github.com/hanif-mianjee/AuroraWrite/issues
```

---

#### Official URL (Optional)
**Field:** Verified publisher website

**Value:**
```
(Your verified domain if you have one)
```

---

#### Mature Content
**Field:** Contains mature content?

**Value:**
```
No
```

---

## Privacy Tab

### Single Purpose Description
**Field:** Describe extension's single, focused purpose

| Requirement | Value |
|-------------|-------|
| **Purpose** | Help reviewers understand extension focus |
| **Best Practice** | Be specific and narrow |

**Recommended Value:**
```
AuroraWrite's single purpose is to provide real-time writing assistance. The extension detects text input fields on web pages, analyzes text content using user-configured AI providers (Groq, OpenAI, Gemini, Anthropic, Together, Mistral), and displays grammar, spelling, style, clarity, and tone suggestions in a non-intrusive overlay. Users can accept suggestions with one click or use text transformation features (rephrase, shorten, translate).
```

---

### Permission Justifications

Each permission in your manifest requires a justification. Here are the justifications for AuroraWrite:

#### `storage`
**Justification:**
```
The storage permission is required to save user preferences and settings locally, including:
- Selected AI provider (Groq, OpenAI, Gemini, etc.)
- API keys for the chosen provider (stored securely in local storage)
- User interface preferences (enabled/disabled state, display options)
- Cache for analyzed text blocks to improve performance

All data is stored locally on the user's device and is never transmitted to our servers.
```

---

#### `activeTab`
**Justification:**
```
The activeTab permission is required to:
- Detect text input fields on the current webpage
- Read text content from input fields for analysis
- Inject the writing assistant overlay UI to display suggestions
- Apply corrections when users click on suggestions

This permission ensures the extension only accesses the page when the user actively interacts with it, following the principle of least privilege.
```

---

#### Host Permissions (API Endpoints)
**Justification for each host permission:**

**`https://api.groq.com/*`**
```
Required to send text to Groq's AI API for grammar and style analysis when the user selects Groq as their AI provider.
```

**`https://api.openai.com/*`**
```
Required to send text to OpenAI's API for grammar and style analysis when the user selects OpenAI as their AI provider.
```

**`https://generativelanguage.googleapis.com/*`**
```
Required to send text to Google's Gemini API for grammar and style analysis when the user selects Gemini as their AI provider.
```

**`https://api.anthropic.com/*`**
```
Required to send text to Anthropic's Claude API for grammar and style analysis when the user selects Anthropic as their AI provider.
```

**`https://api.together.xyz/*`**
```
Required to send text to Together AI's API for grammar and style analysis when the user selects Together AI as their AI provider.
```

**`https://api.mistral.ai/*`**
```
Required to send text to Mistral AI's API for grammar and style analysis when the user selects Mistral as their AI provider.
```

---

### Remote Code Declaration
**Field:** Does your extension use remote code?

**Value:**
```
No, I am not using remote code.
```

**Justification (if needed):**
```
AuroraWrite does not execute any remotely hosted code. All JavaScript is bundled within the extension package. The extension only makes API calls to AI providers for text analysis, receiving JSON responses that are parsed as data, not executed as code.
```

---

### Data Usage Disclosure

#### Does your extension collect user data?

**Value:**
```
Yes
```

---

#### Data Types Collected

Check the applicable boxes:

| Data Type | Collected? | Justification |
|-----------|------------|---------------|
| **Personally identifiable information** | No | No PII is collected or stored by AuroraWrite |
| **Health information** | No | - |
| **Financial and payment information** | No | - |
| **Authentication information** | Yes | API keys stored locally in Chrome's secure storage to authenticate with user's chosen AI provider |
| **Personal communications** | Yes | Text content from input fields is sent directly to user's chosen AI provider for analysis (not stored by AuroraWrite) |
| **Location** | No | - |
| **Web history** | No | - |
| **User activity** | No | - |
| **Website content** | Yes | Text from input fields is sent to AI providers for grammar/style analysis (not stored by AuroraWrite) |

---

#### Data Usage Certifications

Check these boxes to certify:

- [x] I certify that the data collection and usage disclosures above are accurate and complete
- [x] I certify that my extension's data usage complies with the Chrome Web Store Developer Program Policies, including the Limited Use requirements
- [x] I certify that my extension does not sell user data to third parties
- [x] I certify that my extension does not use or transfer user data for purposes unrelated to the extension's single purpose
- [x] I certify that my extension does not use or transfer user data to determine creditworthiness or for lending purposes

---

### Privacy Policy URL
**Field:** Link to your privacy policy

| Requirement | Value |
|-------------|-------|
| **Required** | Yes (if collecting any user data) |
| **Must Include** | How data is collected, used, and shared |

**Your Privacy Policy is Already Set Up:**

Your privacy policy is already hosted at:
```
https://hanif-mianjee.github.io/AuroraWrite/privacy.html
```

The policy covers all required elements:
- Data collection disclosure (none collected by AuroraWrite)
- Third-party AI provider data handling
- Local storage of API keys and settings
- Permission justifications
- Data security measures
- User rights

**Privacy Policy URL to Enter:**
```
https://hanif-mianjee.github.io/AuroraWrite/privacy.html
```

---

## Distribution Tab

### Pricing

**Field:** Is this a paid extension?

**Value:**
```
Free
```

---

### In-App Purchases

**Field:** Contains in-app purchases?

**Value:**
```
No
```

(Note: Users provide their own API keys, which may have costs from AI providers, but this is not an in-app purchase within the extension)

---

### Visibility

**Field:** Who can see and install this extension?

| Option | Description | Recommended |
|--------|-------------|-------------|
| **Public** | Everyone can see and install | Yes (for release) |
| **Unlisted** | Only users with direct link | For beta testing |
| **Private** | Only specified users | For internal testing |

**Recommended Value:**
```
Public
```

---

### Geographic Distribution

**Field:** Which countries can see this extension?

**Recommended Value:**
```
All regions
```

(Unless you have region-specific limitations)

---

## Required Assets

### Extension Icon

| Size | Dimensions | Format | Required |
|------|-----------|--------|----------|
| Small | 16x16 px | PNG | Yes |
| Medium | 32x32 px | PNG | Recommended |
| Large | 48x48 px | PNG | Yes |
| Store | 128x128 px | PNG | Yes |

**Icon Requirements:**
- 128x128 total size with 96x96 artwork (16px transparent padding per side)
- Works on light and dark backgrounds
- PNG format with transparency
- No rounded corners (Chrome adds them automatically)

**Files to Prepare:**
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

---

### Screenshots

| Requirement | Value |
|-------------|-------|
| **Minimum** | 1 screenshot |
| **Maximum** | 5 screenshots |
| **Dimensions** | 1280x800 px (preferred) or 640x400 px |
| **Format** | JPEG or 24-bit PNG (no alpha) |
| **Corners** | Square (no rounded corners) |
| **Padding** | None (full bleed) |

**Recommended Screenshots for AuroraWrite:**

1. **Main Feature** - Show the extension analyzing text in Gmail/Google Docs with suggestions overlay
2. **Settings Page** - Display the options page with AI provider selection
3. **In Action** - Show corrections being applied in a social media post
4. **Multiple Providers** - Highlight the various AI providers supported
5. **Before/After** - Show text improvement with AuroraWrite suggestions

**Screenshot Guidelines:**
- Demonstrate actual user experience
- Focus on core features
- Ensure clarity (no blurry/pixelated images)
- Minimize text overlay
- Consistent branding

---

### Promotional Images

#### Small Promotional Tile (Required)

| Requirement | Value |
|-------------|-------|
| **Dimensions** | 440x280 px |
| **Format** | PNG or JPEG |
| **Purpose** | Displayed in store listings |

**Design Guidelines:**
- Keep simple and uncluttered
- Test at 50% size for legibility
- Use saturated colors
- Avoid excessive white/gray
- No text required (logo is fine)
- Consistent branding
- Square corners, full bleed

---

#### Marquee Promotional Tile (Optional but Recommended)

| Requirement | Value |
|-------------|-------|
| **Dimensions** | 1400x560 px |
| **Format** | PNG or JPEG |
| **Purpose** | Featured placement in store |

**Note:** Your extension cannot be featured in the marquee section without this image.

---

### YouTube Video (Optional)

| Requirement | Value |
|-------------|-------|
| **Format** | YouTube URL |
| **Purpose** | Demo video on listing page |

**Recommended Video Content:**
- 1-2 minute walkthrough
- Show installation and setup
- Demonstrate key features
- Show before/after writing improvements

---

## Summary Checklist

### Required for Publishing

- [ ] **Developer Account** - Registered and fee paid ($5)
- [ ] **Extension Package** - Zipped `dist/` folder (max 2GB)
- [ ] **Extension Icon** - 128x128 PNG
- [ ] **Screenshot** - At least 1 (1280x800 px)
- [ ] **Small Promo Tile** - 440x280 px
- [ ] **Extension Name** - Max 75 characters
- [ ] **Summary** - Max 132 characters
- [ ] **Detailed Description** - Comprehensive feature list
- [ ] **Primary Category** - Selected
- [ ] **Language** - Selected
- [ ] **Single Purpose** - Described
- [ ] **Permission Justifications** - All permissions explained
- [ ] **Data Usage Disclosures** - Completed
- [ ] **Privacy Policy URL** - Hosted and linked
- [ ] **Visibility** - Set (Public/Unlisted/Private)
- [ ] **Distribution Regions** - Selected

### Recommended for Better Visibility

- [ ] **Marquee Promo Tile** - 1400x560 px
- [ ] **5 Screenshots** - Various features
- [ ] **YouTube Video** - Demo walkthrough
- [ ] **Homepage URL** - Extension website
- [ ] **Support URL** - Help/issues page

---

## After Submission

### Review Process

| Stage | Typical Duration |
|-------|------------------|
| **Initial Review** | 1-3 business days |
| **Policy Violation Found** | Notification email sent |
| **Approved** | 30 days to publish |

### Post-Approval

- You have 30 days to publish after approval
- If not published within 30 days, submission reverts to draft
- Updates to published extensions also require review

---

## References

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Complete Your Listing Information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Fill Out the Privacy Fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/)
- [Set Up Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Supplying Images](https://developer.chrome.com/docs/webstore/images)
- [Creating a Great Listing Page](https://developer.chrome.com/docs/webstore/best-listing)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
