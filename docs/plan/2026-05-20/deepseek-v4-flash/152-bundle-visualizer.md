# Plan 152: Bundle Visualizer Integration

**Gap:** The total bundle size is tracked (Plan 70) but there's no visual breakdown of what's in the JS/CSS bundle. A bundle visualizer shows exactly which parts contribute to file size.

**Best practice (web.dev):** Use `source-map-explorer` or `vite-bundle-visualizer` to generate an interactive treemap of bundle contents.

---

## Step 1: Install source-map-explorer

```bash
npm install -D source-map-explorer
```

---

## Step 2: Generate bundle visualization

```bash
npx source-map-explorer script.js script.js.map --html bundle-report.html
```

---

## Step 3: Add npm script

```json
"analyze:js": "npx source-map-explorer script.js script.js.map --html bundle-report.html",
"analyze:css": "npx source-map-explorer styles.min.css styles.min.css.map --html css-report.html",
"analyze": "npm run analyze:js && npm run analyze:css"
```

---

## Step 4: Visualize in CI

```yaml
- name: Generate bundle analysis
  run: npm run analyze

- name: Upload bundle reports
  uses: actions/upload-artifact@v4
  with:
    name: bundle-reports
    path: "*-report.html"
```

---

## Step 5: Interpret results

After running, open `bundle-report.html` to see which functions take the most space. Use this to:
- Identify large inline SVG strings for potential optimization
- Identify duplicated logic
- Make informed decisions about code splitting

---

## Files Modified: `package.json`, `.github/workflows/deploy.yml`
