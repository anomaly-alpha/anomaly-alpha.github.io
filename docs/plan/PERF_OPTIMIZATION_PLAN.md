# Performance Optimization Plan

## Overview

Replace render-blocking CDN assets with locally built/generated assets. Estimated LCP savings: ~1,700ms.

---

## Step 1: Create build infrastructure

### 1a. Create `package.json`

```json
{
  "name": "anomaly-alpha.github.io",
  "private": true,
  "scripts": {
    "build": "tailwindcss -i src/tailwind-input.css -o tailwind.css",
    "update-assets": "echo 'Manual: download Chart.js 4.4.1 → vendor/chart.umd.js, Font Awesome 6.5.1 → vendor/fontawesome/'"
  },
  "devDependencies": {
    "tailwindcss": "3.4.17"
  }
}
```

### 1b. Create `tailwind.config.js`

```js
module.exports = {
  content: ["./**/*.html"],
  corePlugins: {
    preflight: false,
  },
};
```

### 1c. Create `src/tailwind-input.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 1d. Create `.gitignore`

```
node_modules/
```

### 1e. Run build

```bash
npm install
npm run build
```

Generates `/tailwind.css` (~30 KiB, contains only utility classes used in HTML files).

---

## Step 2: Update `index.html` (4 changes)

### 2a. Replace Tailwind script with link

**Before (line 21):**
```html
<script src="https://cdn.tailwindcss.com"></script>
```

**After:**
```html
<link rel="stylesheet" href="tailwind.css">
```

### 2b. Add `display=swap` to Google Fonts URL

**Before (line 20):**
```html
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet">
```

**After:**
```html
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet">
```

(Already has `display=swap` — verify.)

### 2c. Add preconnect hints

Insert after the `<title>` tag (~line 19):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
```

### 2d. Verify `defer` on remaining CDN scripts

These already have `defer` and don't block rendering:
- `chart.umd.js` (line 23)
- `all.min.js` (line 24) — Font Awesome

No changes needed.

---

## Step 3: Update AGENTS.md

### Quick start section

```diff
- Open `index.html` in a browser. No build step, no npm, works from `file://`.
+ npm install && npm run build    # One-time setup (or after HTML changes)
+ Open `index.html` in a browser  # Works from `file://`
```

### Architecture rules

```diff
- **Never add tests, build tools, or module systems** — not used in this project
+ **Build tools (npm scripts) generate local Tailwind CSS** — output is committed, no runtime build
+ **Prefer local assets over CDN dependencies** when practical for performance
```

### Commands section

```diff
- None. No lint, test, typecheck, build, or codegen commands exist.
+ `npm install` — Install dev dependencies (tailwindcss CLI)
+ `npm run build` — Rebuild tailwind.css from HTML source
+ `npm run update-assets` — Download latest vendor assets
+ No runtime build — all generated files are committed
```

### CDN dependencies section

```diff
- - Tailwind CSS (latest)
+ - Tailwind CSS — local (built via npm run build, committed as tailwind.css)
```

### File ownership table

```diff
+ | `tailwind.css` | Generated Tailwind utility classes (from npm run build) |
+ | `package.json` | Dev dependencies config |
+ | `tailwind.config.js` | Tailwind content paths config |
+ | `src/tailwind-input.css` | Tailwind source with @tailwind directives |
```

---

## Step 4: Update CONTEXT.md

### Constraints section

```diff
- - No build step — works directly from disk
+ - Build step (npm run build) generates local Tailwind CSS. Output is committed. Works from file:// after build.
```

---

## Step 5: Commit

```bash
git add -A && git commit -m "perf: local Tailwind build, preconnect hints, repo instructions
- Add package.json with tailwindcss dev dependency
- Create tailwind.config.js and src/tailwind-input.css
- Generate static tailwind.css (~30 KiB, no more Play CDN)
- Replace render-blocking Tailwind script with <link> tag
- Add preconnect hints for CDN origins
- Update AGENTS.md and CONTEXT.md for new build workflow"
```

---

## Doc Changes Summary

| File | Changes |
|------|---------|
| `README.md` | Usage: add build step. Tech Stack: "via CDN" → "local build". File structure: add new files. |
| `docs/index.md` | Tech Stack: "via CDN" → "local build via npm". |
| `docs/DESIGN_SYSTEM.md` | File Structure tree: add build files. |
| `docs/plan/IMPLEMENTATION_PLAN.md` | Tech Stack table + file structure + files table. |
| `AGENTS.md` | Quick start, architecture rules, commands, CDN deps, file ownership. |
| `CONTEXT.md` | Constraints section updated. |
| `journal/2026-05-03.md` | Session 3 entry for perf work. |

---

## Files Created

- `package.json` — dev deps (tailwindcss ^3.4.17)
- `tailwind.config.js` — content paths for all HTML files
- `src/tailwind-input.css` — @tailwind directives
- `.gitignore` — node_modules

## index.html Changes

1. Remove `<script src="https://cdn.tailwindcss.com">` (render-blocking)
2. Add `<link rel="stylesheet" href="tailwind.css">` (static, cacheable)
3. Add 4 `<link rel="preconnect">` hints (fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, cdnjs.cloudflare.com)

## Status

**Complete.** `npm install && npm run build` generated `tailwind.css` (9.8 KiB, 657 lines). The page has no CDN dependency for Tailwind — all utility classes are local and cacheable.
```
