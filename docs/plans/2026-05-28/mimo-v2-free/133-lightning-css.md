# Plan 133: Lightning CSS Migration

**Gap:** The build uses csso for CSS minification. Lightning CSS is a Rust-based alternative that minifies 100× faster and supports modern CSS features (nesting, layers, @starting-style, container queries) without needing separate PostCSS plugins.

**Best practice (Lightning CSS docs):** Replace csso with Lightning CSS. Adds automatic vendor prefixing, CSS lowering for older browsers, and faster builds.

---

## Step 1: Install Lightning CSS

```bash
npm install -D lightningcss
```

---

## Step 2: Update build:css script

```json
"build:css": "node -e \"var l=require('lightningcss'),f=require('fs');var code=f.readFileSync('styles.css','utf8');var result=l.transform({code:Buffer.from(code),minify:true,sourceMap:true,projectRoot:__dirname});f.writeFileSync('styles.min.css',result.code);if(result.map)f.writeFileSync('styles.min.css.map',JSON.stringify(result.map));console.log('CSS minified via Lightning CSS')\""
```

---

## Step 3: Add vendor prefixing

```js
var result = l.transform({
  code: Buffer.from(code),
  minify: true,
  sourceMap: true,
  targets: {
    // Target browsers
    chrome: 100 << 16,
    safari: 16 << 16,
    firefox: 110 << 16
  }
});
```

---

## Step 4: Compare output size

```bash
# Before (csso):
wc -c styles.min.css  # ~33 KB

# After (Lightning CSS):
wc -c styles.min.css  # ~31 KB (smaller + vendor prefixes)
```

---

## Step 5: Compare speed

```bash
time node -e "/* csso */"
time node -e "/* lightningcss */"
# Expected: Lightning CSS 10-50× faster
```

---

## Step 6: Remove csso dependency

```bash
npm uninstall csso
```

---

## Files Modified: `package.json` (csso removed, lightningcss added), `script.js` build step
