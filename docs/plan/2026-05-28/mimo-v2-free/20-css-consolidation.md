# Plan 20: CSS Consolidation

**Problem:** The site loads two separate CSS files: `styles.css` (custom tokens + BEM, ~33 KB minified) and `tailwind.css` (generated utilities, ~12 KB minified). Many Tailwind utility classes duplicate what's already in BEM classes. The split increases HTTP requests and complexity.

**Goal:** Merge `tailwind.css` into `styles.css`, eliminating one HTTP request. Optionally, reduce Tailwind's output to only classes actually used.

---

## Step 1: Measure current CSS

```bash
wc -c styles.css tailwind.css
# Current: ~33 KB + ~12 KB = ~45 KB total CSS
# After merge: ~45 KB single file
```

---

## Step 2: Generate a comprehensive Tailwind build

First, ensure Tailwind scans all files for used classes:

**In `tailwind.config.js`**:
```js
content: ["./*.html", "./guide/**/*.html", "./script.src.js"],
```

Use `script.src.js` instead of `script.js` (which is minified and can't be scanned).

---

## Step 3: Concatenate both files into one

**In `package.json`**, add a merge step:

```json
"merge:css": "cat tailwind.css styles.css > styles.bundle.css",
"build:css": "node -e \"var c=require('csso'),f=require('fs');f.writeFileSync('styles.bundle.css',f.readFileSync('tailwind.css','utf8')+'\\n'+f.readFileSync('styles.css','utf8'));var r=c.minify(f.readFileSync('styles.bundle.css','utf8'),{sourceMap:true});f.writeFileSync('styles.min.css',r.css);if(r.map)f.writeFileSync('styles.min.css.map',r.map);console.log('CSS bundled + minified')\"",
```

---

## Step 4: Update HTML to load single CSS file

Replace two `<link>` tags with one in all 7 pages + 404.html:

```html
<!-- Before: -->
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="tailwind.css">

<!-- After: -->
<link rel="stylesheet" href="styles.min.css">
```

And in the async preload:
```html
<!-- Before: -->
<link rel="preload" as="style" href="styles.css" onload="this.rel='stylesheet'">
<link rel="preload" as="style" href="tailwind.css" onload="this.rel='stylesheet'">

<!-- After: -->
<link rel="preload" as="style" href="styles.min.css" onload="this.rel='stylesheet'">
```

---

## Step 5: Analyze potential conflicts

Both files define classes that may overlap:
- `tailwind.css` uses Tailwind's naming (`.text-white`, `.flex`, `.p-4`)
- `styles.css` uses BEM naming (`.gem-card`, `.gem-modal`)

There should be no conflicts since naming conventions are distinct. Verify:

```bash
# Check for same class name in both files:
grep -oP '^\.[a-zA-Z][a-zA-Z0-9_-]*' tailwind.css | sort > /tmp/tw.txt
grep -oP '^\.[a-zA-Z][a-zA-Z0-9_-]*' styles.css | sort > /tmp/custom.txt
comm -12 /tmp/tw.txt /tmp/custom.txt
# If no output, there are no conflicts
```

---

## Step 6: Remove unused Tailwind classes (optional, advanced)

```bash
npm install -D purgecss
npx purgecss --css tailwind.css --content "*.html" "guide/**/*.html" "script.src.js" --output tailwind-purged.css
wc -c tailwind-purged.css
# Compare size vs original tailwind.css
```

If purge reduces size significantly, integrate into the build:

```json
"purge:css": "purgecss --css tailwind.css --content \"*.html\" \"guide/**/*.html\" \"script.src.js\" --output tailwind-purged.css && mv tailwind-purged.css tailwind.css"
```

---

## Step 7: Delete old separate files (after verifying)

Once the merge is confirmed working:

```bash
# Remove old CSS files (they're superseded by styles.min.css)
rm tailwind.css styles.css
rm tailwind.css.min styles.css.min  # If .min variants existed
```

**Or better:** Keep them in the repo but stop loading them. Remove old `<link>` tags only.

---

## Step 8: Remove duplicate inline critical CSS

Both `tailwind.css` and `styles.css` had inline critical CSS blocks. After merging, ensure no duplicate critical CSS rules exist in the bundled critical block.

---

## Files Modified

| File | Change |
|------|--------|
| `package.json` | Add `merge:css`, update `build:css` |
| `index.html` | Single CSS link instead of two |
| `guide/*/index.html` (×6) | Single CSS link |
| `404.html` | Single CSS link |
| `styles.min.css` (generated) | Bundled output (was `styles.css`) |

---

## Verification

```bash
# Check file size:
ls -lh styles.min.css  # Should be ~45 KB combined

# Visual diff check:
# 1. Build and serve
npm run build && npx serve .
# 2. Compare original vs merged visually:
# Open in browser — all styles should look identical
# 3. Check Lighthouse — only 1 CSS request
```
