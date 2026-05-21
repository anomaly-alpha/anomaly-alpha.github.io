# Plan 07: Build Optimization — Watch Mode, CSS Tree-Shaking, Faster Iteration

**Problem:** The current `npm run build` must be re-run manually after every change. There is no watch mode for Tailwind or the JS/CSS pipeline. Tailwind generates all utility classes even though only a subset is used, and the Tailwind content paths may miss files.

**Goal:** Add a watch mode for rapid development, optimize the Tailwind build, and improve the developer feedback loop.

---

## Step 1: Add Tailwind watch mode

**In `package.json`:**

```json
"watch:tailwind": "tailwindcss -i src/tailwind-input.css -o tailwind.css --watch"
```

This watches all content paths defined in `tailwind.config.js` and regenerates `tailwind.css` on every HTML/JS change.

---

## Step 2: Add full dev watch script

```json
"watch": "npm run build:tailwind && concurrently \"npm:watch:tailwind\" \"npm:dev:js\" \"npm:dev:css\"",
```

This requires the `concurrently` package (or use `npm-run-all`):

```bash
npm install -D concurrently
```

**Alternative without `concurrently`** (using `&` for parallel):

```json
"watch:simple": "tailwindcss -i src/tailwind-input.css -o tailwind.css --watch & echo Watching..."
```

For reliability, install `concurrently`:

```json
"watch": "npm run build:tailwind && concurrently --kill-others \"npm:watch:tailwind\""
```

---

## Step 3: Optimize Tailwind content paths

**Current** (`tailwind.config.json:2`):
```js
content: ["./*.html", "./guide/**/*.html", "./script.js"],
```

This is already good. But check if `script.js` is minified — Tailwind can't scan classes from minified code. After Plan 01, ensure the content path points to `script.src.js` instead:

```js
content: ["./*.html", "./guide/**/*.html", "./script.src.js"],
```

---

## Step 4: Analyze CSS for unused classes

**Check current Tailwind output size:**
```bash
wc -c tailwind.css        # ~12 KB minified
```

**Analyze which classes are actually used:**
```bash
npx tailwindcss -i src/tailwind-input.css -o tailwind.css --analyze
```

If `tailwindcss --analyze` isn't available in v3, use PurgeCSS manually:

```bash
npm install -D purgecss
npx purgecss --css tailwind.css --content "*.html" "guide/**/*.html" "script.js" --output tailwind-purged.css
```

**Compare sizes:**
```bash
wc -c tailwind.css tailwind-purged.css
```

If purge reduces size significantly, integrate into build:

```json
"purge:css": "purgecss --css tailwind.css --content \"*.html\" \"guide/**/*.html\" \"script.js\" --output tailwind.css",
```

---

## Step 5: Add source maps to Tailwind build (dev only)

```json
"dev:tailwind": "tailwindcss -i src/tailwind-input.css -o tailwind.css --source-map"
```

Source maps help debug which Tailwind utility class maps to which rule.

---

## Step 6: Add `npm run dev` as one-command dev server

After implementing Plan 01 (dev build):

```json
"dev": "npm run dev:tailwind && concurrently --kill-others \"npm:watch:tailwind\" \"npx serve .\""
```

Or keep it simple:

```json
"dev": "npm run build:tailwind && npx serve ."
```

(`npx serve` is a simple static file server — install with `npm install -D serve`)

---

## Step 7: Add CSS source maps to minification

In Plan 01, `build:css` already generates `.map` files via csso's `sourceMap: true`. Verify:

```bash
head -c 100 tailwind.css.min.map  # Should contain JSON with mappings
```

---

## Step 8: Configure `.gitignore` for generated files

Ensure `tailwind.css`, `*.min`, `*.map` are in `.gitignore` since they're generated:

```
# Generated assets
tailwind.css
*.min.css
*.min.js
*.map

# Dev dependencies
node_modules/
```

But wait — the current project **commits** `tailwind.css`, `styles.css` (minified), and `script.js` (minified) because they need to be in the repo for GitHub Pages (no build step on the server). After adding CI/CD (Plan 06), these can be gitignored. For now, keep them committed but consider adding the `.map` and `.min` files to `.gitignore`.

**Actually** — since the current workflow relies on committed generated files, don't add them to `.gitignore` until CI/CD is in place. Instead:

```
# Source maps (large, not needed in repo)
*.map

# Min copies (generated during build)
*.min.css
```

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `watch`, `dev`, `dev:tailwind`, `purge:css` scripts; add `concurrently` dependency |
| `tailwind.config.js` | Update content path to `script.src.js` (after Plan 01) |
| `.gitignore` | Add `*.map` and `*.min.css` patterns (after CI/CD) |

---

## Verification

```bash
npm run build:tailwind    # Quick: only tailwind rebuild
npm run watch             # Starts file watcher
# Edit a class in index.html → tailwind.css regenerates automatically

npm run dev               # Build + serve on localhost
# Open http://localhost:3000

# Check unused CSS:
npm run purge:css
# Verify no visual difference
```
