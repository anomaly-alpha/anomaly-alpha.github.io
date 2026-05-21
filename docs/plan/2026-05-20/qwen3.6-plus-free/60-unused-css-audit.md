# Plan 60: Unused CSS Audit

**Problem:** `styles.css` is 33KB and `tailwind.css` is 12KB combined. Some CSS rules may no longer be used after feature additions/removals, wasting bytes.

**Goal:** Audit and remove unused CSS rules.

---

## Step 1: Install PurgeCSS

```bash
npm install --save-dev purgecss
```

## Step 2: Create PurgeCSS config

```javascript
// purgecss.config.js
module.exports = {
  content: ['index.html', 'guide/*/index.html', '404.html', 'script.js'],
  css: ['styles.css', 'tailwind.css'],
  output: 'dist/',
  safelist: {
    standard: [/gem-/, /^@keyframes/],
    greedy: [/^gem-card--delay-/]
  },
  fontFace: true,
  keyframes: true
};
```

## Step 3: Run audit

```bash
npx purgecss --config purgecss.config.js --stats
# Shows which rules are unused
```

## Step 4: Remove unused rules manually

Review the PurgeCSS output and remove unused rules from `styles.css`. Keep the safelist to avoid removing dynamically-added classes.

## Files Modified
- `purgecss.config.js` — new file
- `styles.css` — cleaned up unused rules
- `tailwind.css` — rebuilt with correct content paths

## Verification
```bash
npm run build
# Compare file sizes before/after
# Visual check — all features should still work
```
