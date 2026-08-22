# Plan 12: Dark Mode System Preference Detection

**Problem:** The site defaults to dark mode regardless of the user's OS-level preference (`prefers-color-scheme`). Users who prefer light mode must manually click a toggle (which no longer exists — it was removed as part of performance optimization). The theme is only readable from a legacy `localStorage` key.

**Goal:** Detect `prefers-color-scheme: light` on first visit and apply light mode automatically. Respect the OS setting as the default when no saved preference exists.

---

## Step 1: Add `prefers-color-scheme` detection in the critical CSS

Add a `media` attribute to the theme stylesheet so the browser applies the correct mode before rendering:

```html
<!-- In index.html <head>, before main CSS -->
<style>
  html { visibility: hidden }
  /* ... critical CSS ... */
  html { visibility: visible }
</style>

<!-- Light mode override loaded early -->
<style media="(prefers-color-scheme: light)">
  /* Inline light mode token overrides (same as .light-mode in styles.css) */
  :root {
    --gem-bg-dark: #f0f4f8;
    --gem-bg-mid: #e2e8f0;
    --gem-bg-light: #cbd5e1;
    --gem-text--primary: #1a202c;
    --gem-text--secondary: rgba(26,32,44,0.70);
    /* ... copy all light-mode token overrides ... */
  }
</style>
```

Alternatively (simpler), set a class on `<html>` before paint using a blocking `<script>`:

```html
<script>
  (function() {
    var saved = localStorage.getItem('gem_theme');
    if (!saved) {
      // No saved preference — use OS setting
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.classList.add('light-mode');
      }
    } else if (saved === 'light') {
      document.documentElement.classList.add('light-mode');
    }
  })();
</script>
```

**Important:** Put this immediately after the `<style>` block and before any visible content. It must run synchronously to prevent FOUC.

---

## Step 2: Update `loadPageState()` to respect the new approach

In `script.js`, modify `loadPageState()` or the init function:

```js
function loadPageState() {
  // Theme is already handled by inline script above.
  // But ensure body class matches html class:
  if (document.documentElement.classList.contains('light-mode')) {
    document.body.classList.add('light-mode');
  }

  // ... rest of loadPageState (modes, chart filter, etc.) ...
}
```

---

## Step 3: Remove legacy `gem_theme` localStorage reads from JS

The current code reads `localStorage.getItem('gem_theme')`. The inline script now handles this. Check the JS for the old read and remove it (or let it be redundant — harmless).

---

## Step 4: Add a listener for OS theme changes (live update)

For users who change their OS theme while the page is open:

```js
if (window.matchMedia) {
  var colorSchemeQuery = window.matchMedia('(prefers-color-scheme: light)');
  colorSchemeQuery.addEventListener('change', function(e) {
    if (!localStorage.getItem('gem_theme')) {
      // No saved preference — follow OS
      if (e.matches) {
        document.body.classList.add('light-mode');
      } else {
        document.body.classList.remove('light-mode');
      }
    }
  });
}
```

---

## Step 5: Save preference on manual toggle (if toggling is readded)

If the theme toggle button is ever added back, save the choice:

```js
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  var isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('gem_theme', isLight ? 'light' : 'dark');
}
```

This overrides the OS preference with a manual choice.

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add inline `<script>` before paint to detect `prefers-color-scheme` |
| `guide/*/index.html` (×6) | Same inline `<script>` block |
| `script.js` | Update `loadPageState()`, add OS change listener |

---

## Verification

```bash
# On macOS: System Settings → Appearance → Light/Dark
# Reload the page — theme should match OS setting
# Switch OS theme while page is open — page should update live (if listener added)
# Clear localStorage — should respect OS preference again
```

```js
// DevTools Console test:
matchMedia('(prefers-color-scheme: light)').matches  // true/false
document.body.classList.contains('light-mode')  // should match above
```
