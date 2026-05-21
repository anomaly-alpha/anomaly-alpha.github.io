# Plan 123: Lightning CSS Replacement

**Problem:** csso is a good minifier but Lightning CSS offers faster minification with additional features like CSS nesting transformation and vendor prefixing.

**Goal:** Replace csso with Lightning CSS in the build pipeline.

---

## Step 1: Install Lightning CSS

```bash
npm install --save-dev lightningcss-cli
```

## Step 2: Update build script

```json
// package.json — replace csso with lightningcss
"build:css": "lightningcss --minify --bundle tailwind.css -o tailwind.css && lightningcss --minify --bundle styles.css -o styles.css"
```

## Step 3: Add Lightning CSS config for nesting

```json
// lightningcss.json (or via CLI flags)
{
  "drafts": {
    "nesting": true
  },
  "targets": {
    "chrome": 110,
    "firefox": 110,
    "safari": 16
  }
}
```

## Files Modified
- `package.json` — updated build script
- `lightningcss.json` — new config file

## Verification
```bash
npm run build
# CSS should be minified
# Compare sizes — should be similar or smaller
# Visual check — identical to before
```
