# Plan 70: Build Artifact Size Tracking in CI

**Problem:** Bundle sizes change over time but there's no tracking. A commit that adds 50 KB of CSS goes unnoticed until Lighthouse drops.

**Goal:** Track key asset sizes across builds. Report changes as PR comments. Store historical data for trend visualization.

---

## Step 1: Add size tracking script

**File: `scripts/track-sizes.js`**:

```js
var fs = require('fs');
var path = require('path');

var assets = [
  'index.html',
  'script.js',
  'styles.min.css',
  'tailwind.min.css',
  'vendor/chart.umd.js'
];

var total = 0;
var report = {
  date: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
  files: {}
};

assets.forEach(function (file) {
  var fullPath = path.join(__dirname, '..', file);
  try {
    var size = fs.statSync(fullPath).size;
    report.files[file] = size;
    total += size;
  } catch (e) {
    report.files[file] = -1; // file not found
  }
});

report.total = total;
console.log(JSON.stringify(report, null, 2));
```

---

## Step 2: Store historical data

```yaml
# In .github/workflows/deploy.yml
- name: Track build sizes
  run: node scripts/track-sizes.js >> size-history.json

- name: Upload size history
  uses: actions/upload-artifact@v4
  with:
    name: size-history
    path: size-history.json
```

---

## Step 3: Compare with baseline

```js
// In track-sizes.js, also load previous report and compute diff
var historyPath = path.join(__dirname, '..', 'size-history.json');
var previous = { files: {} };
try {
  var lines = fs.readFileSync(historyPath, 'utf8').trim().split('\n');
  if (lines.length > 1) {
    previous = JSON.parse(lines[lines.length - 2]);
  }
} catch (e) {}

var diff = {};
Object.keys(report.files).forEach(function (file) {
  var prev = previous.files[file] || 0;
  var curr = report.files[file];
  diff[file] = curr - prev;
});
```

---

## Step 4: Add PR comment with size change

```yaml
- name: Comment size changes
  uses: actions/github-script@v7
  if: github.event_name == 'pull_request'
  with:
    script: |
      const sizes = require('./size-report.json');
      let comment = '## Bundle Size Changes\n\n';
      for (const [file, size] of Object.entries(sizes.files)) {
        const change = sizes.diff[file];
        const sign = change > 0 ? '+' : '';
        comment += `- ${file}: ${formatSize(size)} (${sign}${formatSize(change)})\n`;
      }
      comment += `\n**Total:** ${formatSize(sizes.total)}`;
      github.rest.issues.createComment({ ...context.issue, body: comment });
```

---

## Step 5: Add badge generation

```md
![Total Size](https://img.shields.io/badge/size-300KB-blue)
```

---

## Files Created: `scripts/track-sizes.js`, `.github/workflows/deploy.yml` (updated)
