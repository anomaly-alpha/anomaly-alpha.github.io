# Plan 01: Source Maps + Dev/Prod Build Separation

**Problem:** The single `npm run build` command minifies CSS and JS destructively — overwriting the source files with minified output. There is no source map, making it impossible to debug in production. There is no dev build that preserves readability.

**Goal:** Add source map generation to both CSS and JS minification. Create separate dev and prod build commands so developers can debug without sifting through a single minified line.

---

## Step 1: Update `package.json` scripts

Replace the single `build` script with separate dev and prod variants.

**Current** (`package.json:5`):
```json
"build": "tailwindcss -i src/tailwind-input.css -o tailwind.css && node -e \"var c=require('csso'),f=require('fs');['tailwind.css','styles.css'].forEach(function(p){var r=c.minify(f.readFileSync(p,'utf8'));f.writeFileSync(p,r.css)});console.log('CSS minified')\" && node -e \"var t=require('terser'),f=require('fs');t.minify(f.readFileSync('script.js','utf8'),{compress:true,mangle:true}).then(function(r){f.writeFileSync('script.js',r.code);console.log('JS minified')})\"",
```

**Replace with:**

```json
{
  "scripts": {
    "build:tailwind": "tailwindcss -i src/tailwind-input.css -o tailwind.css",
    "build:css": "node -e \"var c=require('csso'),f=require('fs');['tailwind.css','styles.css'].forEach(function(p){var r=c.minify(f.readFileSync(p,'utf8'),{sourceMap:true});f.writeFileSync(p+'.min',r.css);if(r.map)f.writeFileSync(p+'.map',r.map)});console.log('CSS → .min + .map')\"",
    "build:js": "node -e \"var t=require('terser'),f=require('fs');t.minify(f.readFileSync('script.src.js','utf8'),{compress:true,mangle:true,sourceMap:{url:'script.js.map',includeSources:true}}).then(function(r){f.writeFileSync('script.js',r.code);if(r.map)f.writeFileSync('script.js.map',r.map);console.log('JS → min + .map')})\"",
    "dev:css": "node -e \"var f=require('fs');['tailwind.css','styles.css'].forEach(function(p){f.writeFileSync(p+'.min',f.readFileSync(p,'utf8'))});console.log('CSS → .min (unminified copy)')\"",
    "dev:js": "node -e \"var f=require('fs');f.writeFileSync('script.js',f.readFileSync('script.src.js','utf8'));f.writeFileSync('script.js.map','');console.log('JS → unminified')\"",
    "build": "npm run build:tailwind && npm run build:css && npm run build:js",
    "dev": "npm run build:tailwind && npm run dev:css && npm run dev:js",
    "update-assets": "curl -Lo vendor/chart.umd.js https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"
  }
}
```

---

## Step 2: Rename source JS to preserve unminified version

The current `script.js` is overwritten by terser. We need to keep an unminified source file.

- Move `script.js` → `script.src.js` (this is the source you edit)
- The `build:js` script reads `script.src.js` and outputs `script.js`
- The `dev:js` script copies `script.src.js` → `script.js` unchanged

**Important:** After renaming, update the `<script src="script.js">` tag — it stays `script.js` since that's the output file. No HTML changes needed.

---

## Step 3: Update HTML to reference `.min` CSS files

The current `<link>` tags point to `styles.css` and `tailwind.css`. After this change, the built/minified output goes to `.min` files.

**In `index.html`** (and all 6 guide pages):

```html
<!-- Before -->
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="tailwind.css">

<!-- After -->
<link rel="stylesheet" href="styles.min.css">
<link rel="stylesheet" href="tailwind.min.css">
```

**In `404.html`:**
Same change — update both `<link>` tags.

---

## Step 4: Dev build with HTML source map references (optional)

For dev builds, you can optionally add `/*# sourceMappingURL=script.js.map */` comments. With the approach above, the dev build is just a straight copy — debugger-friendly because the code is unminified.

---

## Step 5: Verify

```bash
npm run build          # Produces .min + .map files
ls -la *.min *.map     # Verify output exists
npm run dev            # Produces unminified output
# Open index.html in browser, check DevTools Sources tab
```

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Split build scripts, add source maps, add dev script |
| `script.src.js` (new) | Renamed from `script.js` |
| `script.js` (generated) | Minified output (or dev copy) |
| `script.js.map` (generated) | New — source map file |
| `styles.min.css` (generated) | New — minified CSS |
| `tailwind.min.css` (generated) | New — minified CSS |
| `index.html` | Update CSS references to `.min` |
| `guide/*/index.html` (×6) | Update CSS references to `.min` |
| `404.html` | Update CSS references to `.min` |

---

## Rollback

If issues arise:
```bash
git checkout -- package.json index.html guide/*/index.html 404.html
# Restore script.js from script.src.js
cp script.src.js script.js
```
