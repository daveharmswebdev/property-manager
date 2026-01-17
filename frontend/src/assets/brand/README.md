# Upkeep Brand Assets

## Logo Files

### Icon Only
| File | Use Case |
|------|----------|
| `logo-outline-white.svg` | Dark backgrounds (sidebar, dark mode) |
| `logo-outline-gradient.svg` | Light backgrounds |
| `logo-icon-only-white.svg` | Compact dark contexts |
| `logo-icon-only-gradient.svg` | Compact light contexts |

### Logo + Wordmark
| File | Use Case |
|------|----------|
| `logo-lockup-horizontal-white.svg` | Dark backgrounds |
| `logo-lockup-horizontal-gradient.svg` | Light backgrounds (icon gradient, text dark) |
| `logo-lockup-horizontal-dark.svg` | Light backgrounds (icon gradient, text indigo) |

### Favicon & App Icons
| File | Size | Use Case |
|------|------|----------|
| `favicon.svg` | 80×80 | Modern browsers (scalable) |
| `favicon-32.svg` | 32×32 | Browser tabs |
| `favicon-16.svg` | 16×16 | Smallest favicon |
| `apple-touch-icon.svg` | 180×180 | iOS home screen |

---

## Color Palette

### Primary (Blue)
- Cobalt: `#4361ee`
- Deep Cobalt: `#3651d4`
- Soft Blue: `#6b8cff`

### Secondary (Purple)
- Violet: `#7c3aed`
- Deep Violet: `#6429cd`
- Lavender: `#a78bfa`

### Tertiary (Teal)
- Teal: `#0d9488`
- Deep Teal: `#0f766e`
- Soft Teal: `#5eead4`

### Warm Accent
- Terracotta: `#c2784e`
- Sienna: `#9c5a35`
- Soft Clay: `#e8b89d`

### Neutrals
- Sidebar BG: `#1e2340`
- Text Primary: `#0f172a`
- Text Secondary: `#475569`
- Text Muted: `#94a3b8`

### Gradient
```css
background: linear-gradient(135deg, #4361ee 0%, #7c3aed 100%);
```

### Background Gradient (Content Area)
```css
background: linear-gradient(to top, #eef2ff 0%, #f8faff 30%, #ffffff 70%);
```

---

## Typography

- **Font Family:** Inter
- **Wordmark Weight:** 600 (Semi-Bold)
- **Letter Spacing:** -0.02em

---

## Usage Guidelines

### Logo Selection
```
Dark background? → White outline version
Light background? → Gradient outline version
Size < 24px?     → Use contained favicon version
```

### Minimum Sizes
- Icon only: 24px minimum (use contained below this)
- Lockup: 120px width minimum
- Favicon: 16px (use optimized favicon-16.svg)

### Clear Space
Maintain clear space equal to 25% of logo width on all sides.

---

## Generating Production Files

### Using realfavicongenerator.net (Recommended)

1. Go to **https://realfavicongenerator.net**
2. Upload `favicon.svg` from this folder
3. Customize settings if desired (the defaults work well)
4. Download the generated package
5. Extract and place files in `frontend/public/`

This generates everything you need:
- `favicon.ico` (multi-size for legacy browsers)
- `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180×180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`
- `site.webmanifest` (for PWA support)
- Ready-to-paste HTML for `index.html`

---

## File Placement for Production

After generating PNG/ICO files:

```
frontend/
├── public/
│   ├── favicon.ico          # Legacy browsers
│   ├── favicon.svg          # Modern browsers
│   ├── favicon-32.png       # 32px PNG
│   ├── apple-touch-icon.png # iOS (180×180)
│   └── site.webmanifest     # PWA manifest
├── src/
│   └── assets/
│       └── brand/           # Source SVGs (this folder)
```

### Update index.html
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

---

## Brand Name

- **Full name:** Upkeep
- **Wordmark style:** lowercase `upkeep`
- **Domain:** upkeep-io.com / upkeep-io.dev
