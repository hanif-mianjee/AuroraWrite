# AuroraWrite Design System

This document defines the design language, components, and patterns used throughout AuroraWrite.

## Table of Contents

- [Brand Identity](#brand-identity)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing](#spacing)
- [Components](#components)
- [Animations](#animations)
- [Accessibility](#accessibility)
- [Icon Guidelines](#icon-guidelines)

---

## Brand Identity

### Logo

The AuroraWrite logo consists of:
- A circular gradient background (Blue #1976d2 → Purple #7c4dff)
- A bold white "A" letterform
- A green (#4caf50) curved underline representing the writing assistance

```svg
<svg viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1976d2"/>
      <stop offset="100%" style="stop-color:#7c4dff"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#grad)"/>
  <text x="64" y="82" font-size="60" font-weight="bold" fill="white" text-anchor="middle">A</text>
  <path d="M30 100 Q64 85 98 100" stroke="#4caf50" stroke-width="6" fill="none"/>
</svg>
```

### Brand Voice

- **Professional** - Clear, concise, trustworthy
- **Approachable** - Friendly without being casual
- **Helpful** - Focused on user productivity
- **Modern** - Contemporary and forward-thinking

---

## Color System

### Primary Palette

| Role | Hex | Usage |
|------|-----|-------|
| Primary | `#1976d2` | Main brand color, primary buttons, links |
| Primary Dark | `#1565c0` | Hover states, active states |
| Primary Light | `#42a5f5` | Highlights, secondary elements |
| Accent Purple | `#7c4dff` | Gradient endpoints, special emphasis |
| Accent Green | `#4caf50` | Success states, positive feedback |

### Issue Category Colors

Each issue category has a distinct color for visual differentiation:

| Category | Hex | Underline Style |
|----------|-----|-----------------|
| Spelling | `#e53935` (Red) | Squiggly |
| Grammar | `#ff9800` (Orange) | Dashed |
| Style | `#2196f3` (Blue) | Dotted |
| Clarity | `#9c27b0` (Purple) | Wavy |
| Tone | `#4caf50` (Green) | Double |
| Rephrase | `#00bcd4` (Cyan) | Dotted |

### Neutral Palette

| Role | Hex | Usage |
|------|-----|-------|
| Background Primary | `#f8fafc` | Page backgrounds |
| Background Secondary | `#ffffff` | Cards, containers |
| Background Tertiary | `#f1f5f9` | Input fields, subtle areas |
| Text Primary | `#0f172a` | Headings, body text |
| Text Secondary | `#475569` | Descriptions, labels |
| Text Muted | `#94a3b8` | Placeholders, hints |
| Border | `#e2e8f0` | Dividers, card borders |

### Semantic Colors

| Role | Hex | Usage |
|------|-----|-------|
| Success | `#2e7d32` | Positive feedback, confirmations |
| Success BG | `#e8f5e9` | Success backgrounds |
| Error | `#c62828` | Errors, warnings |
| Error BG | `#ffebee` | Error backgrounds |
| Info | `#1565c0` | Informational states |
| Info BG | `#e3f2fd` | Info backgrounds |

### Gradients

```css
/* Primary Gradient */
--gradient-primary: linear-gradient(135deg, #1976d2 0%, #7c4dff 100%);

/* Hero Background */
--gradient-hero: linear-gradient(180deg, #f0f9ff 0%, #fafbfc 100%);

/* CTA Gradient */
--gradient-cta: linear-gradient(135deg, #1976d2 0%, #7c4dff 50%, #00bcd4 100%);
```

---

## Typography

### Font Family

```css
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

[Google Fonts Link](https://fonts.google.com/share?selection.family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800)

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 60px | 800 | 1.1 | Hero titles |
| H1 | 40px | 700 | 1.2 | Section headings |
| H2 | 32px | 700 | 1.25 | Subsection headings |
| H3 | 18px | 600 | 1.4 | Card headings |
| Body | 16px | 400 | 1.6 | Paragraphs |
| Body Small | 14px | 400 | 1.5 | Secondary text |
| Caption | 13px | 500 | 1.4 | Labels, hints |
| Micro | 11-12px | 600 | 1.3 | Badges, tags |

### Font Weights

- **Light**: 300 - Minimal use, large display text only
- **Regular**: 400 - Body text, paragraphs
- **Medium**: 500 - Emphasis, labels
- **Semibold**: 600 - Subheadings, buttons
- **Bold**: 700 - Headings
- **Extrabold**: 800 - Display text, hero

---

## Spacing

### Base Unit

The spacing system uses a base unit of **4px**.

### Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline spacing |
| `--space-2` | 8px | Tight spacing |
| `--space-3` | 12px | Compact spacing |
| `--space-4` | 16px | Default spacing |
| `--space-5` | 20px | Comfortable spacing |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Large spacing |
| `--space-10` | 40px | Extra large spacing |
| `--space-12` | 48px | Section gaps |
| `--space-16` | 64px | Major sections |
| `--space-20` | 80px | Hero spacing |
| `--space-24` | 96px | Page sections |

### Container

```css
--container-max: 1200px;
--section-padding: 100px 0;
--nav-height: 72px;
```

---

## Components

### Buttons

#### Primary Button

```css
.btn-primary {
  background: var(--gradient-primary);
  color: white;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 15px;
  box-shadow: 0 4px 14px rgba(25, 118, 210, 0.4);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(25, 118, 210, 0.5);
}
```

#### Secondary Button

```css
.btn-secondary {
  background: white;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 14px 28px;
  border-radius: 12px;
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-light);
}
```

### Cards

```css
.card {
  background: var(--bg-secondary);
  border-radius: 16px;
  border: 1px solid var(--border);
  padding: 28px;
  transition: transform 250ms ease, box-shadow 250ms ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}
```

### Input Fields

```css
input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
}
```

### Toggle Switch

```css
.toggle {
  width: 48px;
  height: 26px;
  background: #ccc;
  border-radius: 26px;
  transition: 0.3s;
}

.toggle.active {
  background: var(--primary);
}

.toggle::before {
  content: "";
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}
```

### Tags/Badges

```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 16px;
  font-size: 13px;
}

.badge-free {
  background: #dcfce7;
  color: #166534;
}

.badge-paid {
  background: #fef3c7;
  color: #92400e;
}
```

### Floating Widget (Content Script)

```css
.widget {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: white;
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border);
  z-index: 10000;
}
```

### Suggestion Popover

```css
.popover {
  position: absolute;
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border);
  max-width: 320px;
  z-index: 10001;
}
```

---

## Animations

### Timing Functions

```css
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 400ms ease;
```

### Common Animations

#### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

#### Fade In Up

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Pulse

```css
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
```

#### Float

```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
```

### Hover Effects

- **Buttons**: `transform: translateY(-2px)` with increased shadow
- **Cards**: `transform: translateY(-4px)` with shadow
- **Links**: Color change with underline

### Reduced Motion

Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Accessibility

### Color Contrast

- All text meets WCAG 2.1 AA standards (4.5:1 for normal text)
- Primary text on white: #0f172a has 15.7:1 contrast
- Secondary text on white: #475569 has 7.4:1 contrast
- Category colors are reinforced with underline styles, not color alone

### Focus States

```css
*:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

### Touch Targets

- Minimum touch target: 44x44px
- Buttons: minimum height 44px
- Toggle switches: 48x26px

### Keyboard Navigation

- All interactive elements are focusable
- Tab order follows visual order
- Skip links for navigation (if applicable)

### Screen Readers

- All images have alt text
- Icon buttons have aria-label
- Form inputs have associated labels
- ARIA landmarks for major sections

---

## Icon Guidelines

### Icon Library

Use **Lucide Icons** (or Heroicons) for consistency.

### Icon Sizes

| Context | Size |
|---------|------|
| Button Icon | 18-20px |
| Card Icon | 24-26px |
| Feature Icon | 48-52px |
| Navigation | 14-16px |

### Icon Colors

- Use `currentColor` for flexibility
- Match icon color to text color in context
- Category icons use their respective category colors

### Do's

- Use SVG icons, not emojis
- Maintain consistent stroke width (2px default)
- Ensure icons are centered in containers

### Don'ts

- Don't use emojis as icons in UI
- Don't mix icon styles (filled vs outlined)
- Don't use icons without labels for critical actions

---

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
--shadow-glow: 0 0 40px rgba(25, 118, 210, 0.15);
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small elements, badges |
| `--radius-md` | 8px | Input fields, small cards |
| `--radius-lg` | 12px | Buttons, medium cards |
| `--radius-xl` | 16px | Large cards, modals |
| `--radius-2xl` | 24px | Pills, badges |
| `--radius-full` | 9999px | Circular elements |

---

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Base | 1 | Default stacking |
| Dropdown | 10 | Dropdowns, tooltips |
| Sticky | 20 | Sticky headers |
| Fixed | 30 | Fixed elements |
| Modal Backdrop | 40 | Modal overlays |
| Modal | 50 | Modal content |
| Popover | 100 | Popovers, tooltips |
| Toast | 200 | Notifications |
| Content Script | 10000+ | Extension UI |

---

## File Organization

```
src/
├── assets/
│   └── icons/           # Extension icons
├── welcome/
│   ├── welcome.css      # Welcome page styles
│   └── welcome.ts       # Welcome page scripts
├── options/
│   ├── options.css      # Options page styles
│   └── options.ts       # Options page scripts
docs/
├── home.css             # Landing page styles
├── home.js              # Landing page scripts
└── index.html           # Landing page
```

---

## Resources

- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- [Lucide Icons](https://lucide.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Chrome Extension Design](https://developer.chrome.com/docs/extensions/mv3/user_interface/)
