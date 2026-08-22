# Plan 136: `light-dark()` CSS Color Function

**Gap:** Theme toggling requires overriding every CSS custom property in `:root.light-mode`. This is repetitive and error-prone. The `light-dark()` CSS function returns different values for light/dark mode automatically, eliminating manual overrides.

**Best practice (web.dev):** Use `light-dark(light-value, dark-value)` for per-property theming. Requires `color-scheme: light dark` on the root.

---

## Step 1: Enable color-scheme

```css
:root {
  color-scheme: light dark;
}
```

---

## Step 2: Replace token overrides with light-dark()

**Before (dozens of overrides in `:root.light-mode`):**
```css
:root {
  --gem-bg-dark: #050a14;
  --gem-text--primary: #ffffff;
}
:root.light-mode {
  --gem-bg-dark: #f0f4f8;
  --gem-text--primary: #1a202c;
}
```

**After (single definition with light-dark):**
```css
:root {
  --gem-bg-dark: light-dark(#f0f4f8, #050a14);
  --gem-text--primary: light-dark(#1a202c, #ffffff);
  --gem-text--secondary: light-dark(rgba(26,32,44,0.7), rgba(255,255,255,0.6));
}
```

---

## Step 3: Remove `:root.light-mode` block

After migration, the entire `:root.light-mode` block can be deleted — `light-dark()` handles both modes automatically.

---

## Step 4: Update JS theme toggle

```js
function toggleTheme() {
  // No longer need to toggle class on body
  // Instead, toggle color-scheme:
  var root = document.documentElement;
  var current = getComputedStyle(root).colorScheme;
  root.style.colorScheme = current === 'dark' ? 'light' : 'dark';
}
```

Or let the browser handle it via `prefers-color-scheme` (Plan 12).

---

## Step 5: Verify

```bash
# Toggle system theme — all colors update automatically
# No :root.light-mode block needed
# Verify every token has both light/dark values
```

---

## Files Modified: `styles.css`, `script.js`
