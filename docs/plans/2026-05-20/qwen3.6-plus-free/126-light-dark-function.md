# Plan 126: light-dark() Function

**Problem:** Light mode requires duplicating many CSS token definitions in `:root.light-mode`. The `light-dark()` function allows defining both values in a single declaration.

**Goal:** Replace dual-mode token definitions with `light-dark()`.

---

## Step 1: Replace token definitions

```css
/* Before */
:root {
  --gem-text--primary: #ffffff;
  --gem-bg-dark: #050a14;
}
:root.light-mode {
  --gem-text--primary: #1a202c;
  --gem-bg-dark: #f0f4f8;
}

/* After */
:root {
  --gem-text--primary: light-dark(#ffffff, #1a202c);
  --gem-bg-dark: light-dark(#050a14, #f0f4f8);
}
```

## Step 2: Remove light-mode override block

After converting all dual-mode tokens, the `:root.light-mode` block can be significantly reduced or removed.

## Step 3: Add fallback for unsupported browsers

```css
/* Chrome 123+, Safari 17.4+, Firefox 129+ */
/* For older browsers, keep the :root.light-mode overrides */
```

## Files Modified
- `styles.css` — light-dark() tokens

## Verification
```bash
npm run build
# Toggle theme — should work identically
# Chrome 123+ — uses light-dark()
# Older browsers — falls back to :root.light-mode
```
