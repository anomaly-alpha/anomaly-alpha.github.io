# Plan 01: Source Maps for Minified Assets

**Problem:** After `npm run build`, both `script.js` and `styles.css` are minified in-place with no source maps. When debugging production issues in DevTools, stack traces show minified line/column numbers that are impossible to trace back to original code.

**Goal:** Generate `.map` files alongside minified outputs so DevTools can show original source during debugging.

---

## Step 1: Add source map generation to terser

Modify the terser command in `package.json` to output a source map file.

```json
// package.json — update the terser portion of the build script
"build": "... && node -e \"var t=require('terser'),f=require('fs');t.minify(f.readFileSync('script.js','utf8'),{compress:true,mangle:true,sourceMap:{filename:'script.js',url:'script.js.map'}}).then(function(r){f.writeFileSync('script.js',r.code);f.writeFileSync('script.js.map',r.map);console.log('JS minified with sourcemap')})\""
```

## Step 2: Add source map generation to csso

Modify the csso command to output source maps for both CSS files.

```json
// package.json — update the csso portion
"build": "tailwindcss -i src/tailwind-input.css -o tailwind.css && node -e \"var c=require('csso'),f=require('fs');['tailwind.css','styles.css'].forEach(function(p){var r=c.minify(f.readFileSync(p,'utf8'),{restructure:true,sourceMap:true});f.writeFileSync(p,r.css);f.writeFileSync(p+'.map',r.map.generateSourceMap())});console.log('CSS minified with sourcemaps')\" && ..."
```

## Step 3: Add source map reference comments

After minification, append the source map reference comment to each file.

```javascript
// Add to the build script after writing each file:
f.writeFileSync('script.js', r.code + '\n//# sourceMappingURL=script.js.map\n');
f.writeFileSync(p, r.css + '\n/*# sourceMappingURL=' + p + '.map */\n');
```

## Files Modified
- `package.json` — build script updated for source map generation

## Verification
```bash
npm run build
ls script.js.map styles.css.map tailwind.css.map  # All three should exist
grep 'sourceMappingURL' script.js styles.css tailwind.css  # Comments present
```
