# Plan 06: HTML Lang Attribute Audit

**Problem:** All HTML pages set `lang="en"` but none specify the dialect (e.g., `lang="en-US"`). Screen readers may use incorrect pronunciation rules. Additionally, individual elements with non-English content (game character names like "Cecil", "Lucan") lack `lang` overrides.

**Goal:** Audit and update all `lang` attributes across all 8 HTML pages for proper dialect specification and mixed-language content.

---

## Step 1: Update root lang attribute on all pages

Change `lang="en"` to `lang="en-US"` on all 8 HTML files:

```html
<!-- index.html, guide/*/index.html, 404.html -->
<html lang="en-US">
```

## Step 2: Add lang overrides for game-specific terms

Wrap character names and game-specific terms that may benefit from language hints:

```html
<!-- In card titles and descriptions -->
<span lang="en" title="Character name">Cecil</span>
```

## Step 3: Verify with axe DevTools

```bash
# Install axe-core for CLI
npm install --save-dev @axe-core/cli
# Run audit
axe http://localhost:3000 --exit
```

## Files Modified
- `index.html` — lang attribute
- `guide/code/index.html` — lang attribute
- `guide/event/index.html` — lang attribute
- `guide/pvp/index.html` — lang attribute
- `guide/login/index.html` — lang attribute
- `guide/faq/index.html` — lang attribute
- `guide/beginners/index.html` — lang attribute
- `404.html` — lang attribute

## Verification
```bash
grep 'lang=' index.html guide/*/index.html 404.html
# All should show lang="en-US" on <html>
```
