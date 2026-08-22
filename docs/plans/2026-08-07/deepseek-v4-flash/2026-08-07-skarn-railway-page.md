# Skarn Railway Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repurpose the broken Railway service to serve a small Skarn landing page at `/skarn-bot/` that links to the bot's research reports and full docs tree.

**Architecture:** Add a zero-dependency Node static file server (`scripts/serve.js`) as the repo's `start` script so Railway/Nixpacks can bind `$PORT`. Add a self-contained landing page (`skarn-bot/index.html`) with a generated docs index injected between `SKARN_INDEX` markers by a small generator (`scripts/generate-skarn-index.js`) that reads `git ls-files skarn-bot/docs`. Markdown reports are linked as GitHub blob URLs (rendered by GitHub), not served locally.

**Tech Stack:** Node.js (>=18), node `http`/`fs`/`path` only. No new dependencies. Plain CommonJS, no test framework (repo convention per AGENTS.md — verification is runnable commands, not unit tests).

## Global Constraints

- **No test framework exists** (AGENTS.md: "No test framework — manual QA via browser open/reload"). Verification = exact commands below (curl / node assertions). Do NOT create test files or add test dependencies.
- **Never `git add -A` / `git add .`.** Stage only the exact files listed in each task's Commit step. The working tree contains unrelated user WIP in the documentation and skarn-bot trees — never commit any of it.
- **Do NOT run `npm run build`** locally — it re-minifies committed assets in place and would dirty the tree. serve.js and the generator are plain Node and need no build step.
- **No new dependencies** in `package.json`. Only two new script entries (`start`, `skarn-index`).
- Code style: match existing root scripts (`scripts/generate-music.js`) — CommonJS, `var`, `function` declarations, `// ===== SECTION =====` headers, no JSDoc, no comments unless the WHY is non-obvious.
- Spec: `docs/specs/2026-08-07/deepseek-v4-flash/2026-08-07-skarn-railway-page-design.md` (committed). Blob URLs use branch `main`.
- Do NOT modify any web-app files (`index.html`, `script.js`, `styles.css`, `guide/*`, build pipeline). The web app's `npm run build` chain is untouched.

---

### Task 1: Static file server + package.json scripts

**Covers:** [S3], [S4], [S7]

**Files:**
- Create: `scripts/serve.js`
- Modify: `package.json` (scripts object only)

**Interfaces:**
- Produces: `scripts/serve.js` — CLI entry `PORT=8123 node scripts/serve.js`; binds `process.env.PORT || 8080`; serves repo root. Used by `npm start` on Railway and by Task 3's curl verification.
- Produces: `package.json` scripts `"start"` and `"skarn-index"` — consumed by Railway (Nixpacks runs `npm start`) and Task 3.

- [ ] **Step 1: Create `scripts/serve.js`**

```js
// ===== STATIC SERVER =====
// Zero-dependency static file server for Railway. Serves the repo root.
// Run: PORT=8123 node scripts/serve.js
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var PORT = process.env.PORT || 8080;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf'
};

function isBlocked(rel) {
  // dotfiles (.env, .git) and node_modules are never served
  var parts = rel.split('/');
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === '' || parts[i] === '.') continue;
    if (parts[i].charAt(0) === '.' || parts[i] === 'node_modules') return true;
  }
  return false;
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

function serveFile(res, filePath) {
  var ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (err, data) {
    if (err) return send(res, 404, 'Not Found');
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}

http.createServer(function (req, res) {
  var urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }
  var rel = urlPath.replace(/^\/+/, '');
  if (isBlocked(rel)) return send(res, 404, 'Not Found');
  var filePath = path.normalize(path.join(ROOT, rel));
  if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
    return send(res, 404, 'Not Found'); // path-traversal guard
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat) return send(res, 404, 'Not Found');
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, function (err2, stat2) {
        if (err2 || !stat2 || !stat2.isFile()) return send(res, 404, 'Not Found');
        serveFile(res, filePath);
      });
    } else {
      serveFile(res, filePath);
    }
  });
  console.log(new Date().toISOString() + ' ' + req.method + ' ' + req.url + ' -> ' + filePath);
}).listen(PORT, function () {
  console.log('Skarn static server listening on port ' + PORT);
});
```

- [ ] **Step 2: Add the two scripts to `package.json`**

In `package.json`, insert `"start": "node scripts/serve.js",` as the FIRST entry of the `scripts` object (before `"update-codes"`), and add `"skarn-index": "node scripts/generate-skarn-index.js",` immediately after the `"update-music"` line. Do not change anything else in the file.

- [ ] **Step 3: Verify the server against the repo**

Run (from repo root):

```bash
PORT=8123 node scripts/serve.js > /tmp/serve.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/          # expect 200 (main site index.html)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/.env      # expect 404 (dotfile block)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/node_modules/  # expect 404
curl -s -o /dev/null -w "%{http_code}\n" --path-as-is "http://localhost:8123/../package.json"  # expect 404 (traversal)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/nonexistent  # expect 404
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8123/skarn-bot/docs/research/skarn/REPORT.md  # expect 200 text/markdown
kill %1
```

All six codes must match the expected values. If any differ, debug before committing (do NOT weaken the security checks to make a test pass).

- [ ] **Step 4: Commit**

```bash
git add scripts/serve.js package.json
git commit -m "feat: add zero-dep static server as npm start for Railway"
```

---

### Task 2: Skarn landing page template

**Covers:** [S5]

**Files:**
- Create: `skarn-bot/index.html`

**Interfaces:**
- Consumes: nothing from Task 1 (independent).
- Produces: `skarn-bot/index.html` containing the `<!--SKARN_INDEX_START-->` / `<!--SKARN_INDEX_END-->` marker pair — Task 3 injects the generated index between them. Served at `/skarn-bot/` by Task 1's server.

- [ ] **Step 1: Create `skarn-bot/index.html`**

Complete file — self-contained, inline CSS only, no external assets, dark "abyss" theme. The `<!--SKARN_INDEX_START-->` / `<!--SKARN_INDEX_END-->` markers must appear exactly once, on their own lines inside the "Docs" section.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skarn — The Warmaster of the Abyss</title>
<meta name="description" content="Skarn Discord bot — research reports and architecture docs for the Warmaster of the Abyss.">
<link rel="canonical" href="https://anomaly-alpha.github.io/skarn-bot/">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 20% -10%, #1a0f14 0%, #0b0f14 55%);
    color: #d8d3cf; line-height: 1.55;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 56px 24px 80px; }
  h1, h2, h3 { color: #f2ede9; font-weight: 700; }
  h1 { font-size: 2.2rem; margin: 0 0 6px; letter-spacing: 0.5px; }
  h1 .accent { color: #ff6b35; }
  h2 { font-size: 1.25rem; margin: 0 0 14px; padding-bottom: 6px; border-bottom: 1px solid #262c33; }
  h3 { font-size: 1rem; margin: 18px 0 6px; color: #ff6b35; }
  .sub { color: #8b8f94; margin: 0 0 28px; font-size: 1.05rem; }
  a { color: #00e5ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .card {
    background: rgba(255, 255, 255, 0.03); border: 1px solid #232a31; border-radius: 10px;
    padding: 18px 22px; margin-bottom: 22px;
  }
  .card p { margin: 6px 0; }
  .card .links { margin-top: 10px; }
  ul { margin: 6px 0 14px; padding-left: 20px; }
  li { margin: 3px 0; }
  .docs h3 + ul { margin-top: 2px; }
  footer { margin-top: 44px; color: #6a6f75; font-size: 0.85rem; border-top: 1px solid #232a31; padding-top: 16px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Skarn — <span class="accent">The Warmaster of the Abyss</span></h1>
  <p class="sub">A 10,000-year-old retired demon. Now a Discord bot for Anomaly Alpha — AI-powered conversation, memory, games, and the Realm of Skarn.</p>

  <div class="card">
    <p><strong>Skarn Bot</strong> — Discord.js v14 bot with AI chat, 77+ commands, persistent SQLite memory, and an in-fiction RPG realm.</p>
    <p class="links">
      <a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/README.md">Bot README (commands &amp; setup)</a> ·
      <a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/tree/main/skarn-bot">Source code</a>
    </p>
  </div>

  <div class="card">
    <h2>Research Reports</h2>
    <ul>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/REPORT.md">Research Report</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/brief.md">Research Brief</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F1.md">Finding F1</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F2.md">Finding F2</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F3.md">Finding F3</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F4.md">Finding F4</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F5.md">Finding F5</a></li>
      <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F6.md">Finding F6</a></li>
    </ul>
  </div>

  <h2>Docs</h2>
  <!--SKARN_INDEX_START-->
  <!--SKARN_INDEX_END-->

  <footer>
    Docs are markdown — click through to GitHub for the rendered view. Generated index refreshed via <code>npm run skarn-index</code>.
    <br>Updated <span id="skarn-updated">Aug 7, 2026</span>
    <br><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io">anomaly-alpha/anomaly-alpha.github.io</a>
  </footer>
</div>
</body>
</html>
```

- [ ] **Step 2: Verify the page serves**

With the Task 1 server still working, run:

```bash
PORT=8123 node scripts/serve.js > /tmp/serve.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/skarn-bot/    # expect 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/skarn-bot     # expect 200 (no trailing slash -> dir index)
curl -s http://localhost:8123/skarn-bot/ | grep -c "<title>Skarn"            # expect 1
curl -s http://localhost:8123/skarn-bot/ | grep -c "SKARN_INDEX_START"       # expect 1
curl -s http://localhost:8123/skarn-bot/ | grep -c "Updated"                  # expect 1 (footer date)
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/index.html
git commit -m "feat: Skarn landing page with research report links"
```

---

### Task 3: Docs index generator + full verification

**Covers:** [S2], [S3], [S6], [S7]

**Files:**
- Create: `scripts/generate-skarn-index.js`
- Modify: `skarn-bot/index.html` (generated index injected between markers — do not hand-edit the generated block)

**Interfaces:**
- Consumes: `skarn-bot/index.html` marker pair from Task 2; `package.json` `skarn-index` script from Task 1.
- Produces: generated HTML block between the markers in `skarn-bot/index.html` — grouping: Top Level (files directly under `skarn-bot/docs/`), then typed sections `Plans`, `Specs`, `Reports`, `Adr`, `Prompts`, each grouped by date directory (descending) then filename (ascending). Excludes `skarn-bot/docs/compose/` and `skarn-bot/docs/research/` subtrees.

- [ ] **Step 1: Create `scripts/generate-skarn-index.js`**

```js
// ===== SKARN DOCS INDEX GENERATOR =====
// Regenerates the docs index inside skarn-bot/index.html between the
// SKARN_INDEX markers. Reads committed files only (git ls-files), so it
// never links uncommitted work. Run from repo root: node scripts/generate-skarn-index.js
var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var PAGE_PATH = path.join(__dirname, '..', 'skarn-bot', 'index.html');
var BLOB_BASE = 'https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/';
var DOCS_PREFIX = 'skarn-bot/docs/';
var TYPES = ['plans', 'specs', 'reports', 'adr', 'prompts'];
var EXCLUDED = ['compose', 'research'];

function labelFromFile(file) {
  return String(path.basename(file, '.md'))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function li(file) {
  return '      <li><a href="' + BLOB_BASE + file + '">' + labelFromFile(file) + '</a></li>';
}

var files = cp.execSync('git ls-files ' + DOCS_PREFIX, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter(function (f) { return f.slice(-3) === '.md'; })
  .filter(function (f) {
    var rest = f.slice(DOCS_PREFIX.length);
    return EXCLUDED.every(function (d) { return rest.indexOf(d + '/') !== 0; });
  });

var html = [];

var topLevel = files.filter(function (f) { return f.indexOf('/', DOCS_PREFIX.length) === -1; }).sort();
if (topLevel.length) {
  html.push('    <section class="docs">\n      <h2>Top Level</h2>\n      <ul>');
  topLevel.forEach(function (f) { html.push(li(f)); });
  html.push('      </ul>\n    </section>');
}

TYPES.forEach(function (type) {
  var ofType = files.filter(function (f) {
    return f.slice(DOCS_PREFIX.length).indexOf(type + '/') === 0;
  });
  if (!ofType.length) return;
  var groups = {};
  ofType.forEach(function (f) {
    var rest = f.slice(DOCS_PREFIX.length + type.length + 1);
    var date = rest.indexOf('/') === -1 ? 'misc' : rest.split('/')[0];
    (groups[date] = groups[date] || []).push(f);
  });
  var dates = Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); });
  if (dates.indexOf('misc') !== -1) { dates.splice(dates.indexOf('misc'), 1); dates.push('misc'); }
  html.push('    <section class="docs">\n      <h2>' + type.charAt(0).toUpperCase() + type.slice(1) + '</h2>');
  dates.forEach(function (date) {
    groups[date].sort();
    html.push('      <h3>' + date + '</h3>\n      <ul>');
    groups[date].forEach(function (f) { html.push(li(f)); });
    html.push('      </ul>');
  });
  html.push('    </section>');
});

var block = '<!--SKARN_INDEX_START-->\n' + html.join('\n') + '\n  <!--SKARN_INDEX_END-->';

if (!fs.existsSync(PAGE_PATH)) {
  console.error('Error: skarn-bot/index.html not found. Create the page template first.');
  process.exit(1);
}
var page = fs.readFileSync(PAGE_PATH, 'utf8');
var markerRe = /<!--SKARN_INDEX_START-->[\s\S]*?<!--SKARN_INDEX_END-->/;
if (!markerRe.test(page)) {
  console.error('Error: SKARN_INDEX markers not found in skarn-bot/index.html');
  process.exit(1);
}
page = page.replace(markerRe, block);
// refresh the footer "Updated" date (mirrors scripts/generate-music.js)
var today = new Date();
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var dateLabel = MONTHS[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();
page = page.replace(/(Updated\s+<span id="skarn-updated">\s*)(\w+\s+\d+,\s+\d{4})/, '$1' + dateLabel);
fs.writeFileSync(PAGE_PATH, page, 'utf8');
console.log('Updated skarn-bot/index.html with ' + files.length + ' docs links');
```

- [ ] **Step 2: Run the generator and verify output**

```bash
node scripts/generate-skarn-index.js
# expect: "Updated skarn-bot/index.html with N docs links" (N >= 20)
# exclusion checks must be scoped to the GENERATED block only (the curated
# research section legitimately contains blob/main/.../research/ links):
node -e "
var fs=require('fs');
var page=fs.readFileSync('skarn-bot/index.html','utf8');
var m=page.match(/<!--SKARN_INDEX_START-->([\s\S]*?)<!--SKARN_INDEX_END-->/);
if(!m){console.error('markers missing');process.exit(1);}
var block=m[1];
console.log('plans links in block:', (block.match(/plans\//g)||[]).length);
if(!/plans\//.test(block)){console.error('plans section missing from index');process.exit(1);}
if(/research\/|compose\//.test(block)){console.error('excluded subtree leaked into generated index');process.exit(1);}
console.log('exclusion checks OK');
"
```

- [ ] **Step 3: Verify idempotency and link validity**

```bash
sha256sum skarn-bot/index.html > /tmp/hash1
node scripts/generate-skarn-index.js
sha256sum skarn-bot/index.html > /tmp/hash2
diff /tmp/hash1 /tmp/hash2   # expect: no output (byte-identical -> idempotent)
# every generated link must resolve to a committed path:
node -e "
var cp=require('child_process');
var committed=cp.execSync('git ls-files skarn-bot/docs').toString().split('\n').filter(Boolean);
var page=require('fs').readFileSync('skarn-bot/index.html','utf8');
var links=[...page.matchAll(/blob\/main\/(skarn-bot\/docs\/[^\"]+)/g)].map(m=>m[1]);
var bad=links.filter(f=>committed.indexOf(f)===-1);
if(bad.length){console.error('UNCOMMITTED LINKS:',bad);process.exit(1);}
console.log('All '+links.length+' generated links point to committed files');
"
# expect: "All N generated links point to committed files"
```

- [ ] **Step 4: Full S7 verification suite**

```bash
PORT=8123 node scripts/serve.js > /tmp/serve.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/skarn-bot/        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/skarn-bot         # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/                  # 200
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8123/skarn-bot/docs/research/skarn/REPORT.md  # 200 text/markdown
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/.env              # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/node_modules/      # 404
curl -s -o /dev/null -w "%{http_code}\n" --path-as-is "http://localhost:8123/../package.json"  # 404
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/nonexistent       # 404
curl -s http://localhost:8123/skarn-bot/ | grep -c "<title>Skarn"                 # 1
kill %1
```

All codes must match. If the generator output changed the page, the `skarn-bot/index.html` diff must contain ONLY the block between the markers.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-skarn-index.js skarn-bot/index.html
git commit -m "feat: generate Skarn docs index from committed docs tree"
```

---

### Task 4: Deployment handoff (user action)

**Covers:** [S7] (Deployment)

**Files:** none

**Interfaces:** Consumes the committed state of Tasks 1–3.

- [ ] **Step 1: Verify `npm start` works from a clean install**

```bash
npm start > /tmp/serve.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/skarn-bot/   # expect 200
kill %1
```

- [ ] **Step 2: Report to the user for push + Railway confirmation**

Summarize for the user:
1. Push `main` to GitHub — Railway rebuilds and redeploys automatically (Railway service `anomaly-alphagithubio`).
2. Confirm `https://anomaly-alphagithubio-production.up.railway.app/skarn-bot/` loads.
3. If the deploy-time `npm run build` is slow or fails: in the Railway dashboard set the service's Build Command to `true` (files are committed; no build output needed). Start Command stays `npm start`.
4. Future docs updates: run `npm run skarn-index` after committing new docs, then push.

Do NOT push yourself unless the user explicitly asks.
