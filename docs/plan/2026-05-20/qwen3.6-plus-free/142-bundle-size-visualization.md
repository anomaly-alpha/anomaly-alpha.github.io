# Plan 142: Bundle Size Visualization

**Problem:** It's hard to understand what contributes to the JS/CSS bundle size. A visual breakdown helps identify optimization opportunities.

**Goal:** Add a bundle visualization using `rollup-plugin-visualizer` or `webpack-bundle-analyzer`.

---

## Step 1: Install visualizer

```bash
npm install --save-dev rollup-plugin-visualizer
```

## Step 2: Create visualization script

```javascript
// scripts/bundle-viz.js
const fs = require('fs');
const path = require('path');

// Analyze script.js functions
const script = fs.readFileSync('script.js', 'utf8');
const functions = script.match(/function\s+(\w+)\s*\(/g) || [];

const sizes = {};
functions.forEach(function(match) {
  const name = match.replace('function ', '').replace('(', '');
  // Find function body
  const regex = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}', 'g');
  const funcMatch = regex.exec(script);
  if (funcMatch) {
    sizes[name] = funcMatch[0].length;
  }
});

// Sort by size
const sorted = Object.entries(sizes).sort(function(a, b) { return b[1] - a[1]; });

console.log('Function sizes (bytes):');
sorted.slice(0, 20).forEach(function(entry) {
  console.log(entry[0] + ': ' + entry[1]);
});

// Generate HTML visualization
const html = '<html><body><h1>Bundle Visualization</h1>' +
  sorted.map(function(entry) {
    var width = (entry[1] / sorted[0][1]) * 100;
    return '<div style="width:' + width + '%;background:#00e5ff;padding:4px;margin:2px 0;color:#000">' +
      entry[0] + ' (' + entry[1] + ' bytes)</div>';
  }).join('') + '</body></html>';

fs.writeFileSync('docs/bundle-viz.html', html);
console.log('Visualization: docs/bundle-viz.html');
```

## Step 3: Add script

```json
// package.json
"bundle-viz": "node scripts/bundle-viz.js"
```

## Files Modified
- `scripts/bundle-viz.js` — new file
- `package.json` — bundle-viz script

## Verification
```bash
npm run bundle-viz
# Open docs/bundle-viz.html — should show function sizes
```
