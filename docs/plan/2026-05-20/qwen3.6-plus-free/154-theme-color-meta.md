# Plan 154: Theme Color Meta Tag

**Problem:** Mobile browsers don't know the app's theme color, so the address bar and status bar use default colors instead of matching the site's cyan theme.

**Goal:** Add theme-color meta tags for mobile browser chrome customization.

---

## Step 1: Add theme-color meta tags

```html
<!-- index.html — add to <head> -->
<meta name="theme-color" content="#050a14" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f0f4f8" media="(prefers-color-scheme: light)">
```

## Step 2: Update theme-color on toggle

```javascript
// script.js — in toggleTheme
function updateThemeColor() {
  var isLight = document.body.classList.contains('light-mode');
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = isLight ? '#f0f4f8' : '#050a14';
  }
}
```

## Files Modified
- `index.html` — theme-color meta tags
- All guide pages — theme-color meta tags
- `script.js` — dynamic theme-color update

## Verification
```bash
npm run build
# Mobile Chrome — address bar should match background color
# Toggle theme — address bar color should change
```
