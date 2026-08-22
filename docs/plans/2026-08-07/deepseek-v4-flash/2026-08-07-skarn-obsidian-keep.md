# Skarn Obsidian Keep / Hellfire Tomes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `skarn-bot/index.html` into the "Obsidian Keep" dark-fantasy look (Diablo-inspired: obsidian stone, ancient fire, black ash) with documents presented as Hellfire Tomes on shelves — content and generator contract untouched.

**Architecture:** CSS-only restyle of the existing page plus two decorative additions (an ember arch div and an ash-particle container). The docs-index generator (`scripts/generate-skarn-index.js`) and its emitted markup (`<section class="docs">`, `<h2>`, `<h3>`, `<ul><li><a>`) are NOT modified; the new CSS targets those existing classes, so `npm run skarn-index` remains byte-idempotent.

**Tech Stack:** Single self-contained HTML file. Inline CSS only. Zero new dependencies, zero external assets. CSS `@keyframes` for ash particles (respects `prefers-reduced-motion`).

## Global Constraints

- Do NOT modify `scripts/generate-skarn-index.js`, `scripts/serve.js`, `package.json`, or any other file.
- Do NOT run `npm run build`. No test framework exists — verification is the commands below.
- Never `git add -A` / `git add .` — stage ONLY `skarn-bot/index.html` (user WIP + other people's commits exist in this repo).
- Content contract MUST survive byte-for-byte: all 10 GitHub blob/tree URLs, the `<!--SKARN_INDEX_START-->`/`<!--SKARN_INDEX_END-->` marker pair (exactly once, own lines, whitespace-only between), the `<span id="skarn-updated">` footer span, `<meta>`/canonical/`lang`/viewport.
- Spec: `docs/specs/2026-08-07/deepseek-v4-flash/2026-08-07-skarn-obsidian-keep-design.md` ([S2] palette, [S3] constraints, [S4] component values).
- Accessibility: body text ≥ 4.5:1 on `#0a0708`; `prefers-reduced-motion: reduce` disables the ash animation; `:focus-visible` ember outline.
- Code style: plain HTML/CSS, no JS, no comments unless the WHY is non-obvious.

---

### Task 1: Restyle the Skarn page into the Obsidian Keep

**Covers:** [S2], [S3], [S4], [S5]

**Files:**
- Modify: `skarn-bot/index.html` (full rewrite of the file — content preserved, styling replaced)

**Interfaces:**
- Consumes: the existing `skarn-bot/index.html` (committed `58012cf` + `2fd60b6` state) — all links/markers/date-span must be copied verbatim.
- Produces: restyled `skarn-bot/index.html` whose generated-block styling works with the UNCHANGED generator output.

- [ ] **Step 1: Read the current file and confirm the content contract**

```bash
grep -c "SKARN_INDEX" skarn-bot/index.html          # expect 2 (start+end markers)
grep -c "skarn-updated" skarn-bot/index.html        # expect 1
grep -c "github.com/anomaly-alpha" skarn-bot/index.html  # expect 10 (8 research + README + tree)
```

- [ ] **Step 2: Rewrite `skarn-bot/index.html` with EXACTLY this content**

IMPORTANT: in the footer below, the text inside `<span id="skarn-updated">` must be copied **verbatim from the current committed file** (it currently holds whatever date the generator last wrote — keep it exactly). Everything else exactly as shown.

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
    margin: 0;
    font-family: Georgia, 'Times New Roman', serif;
    background: radial-gradient(900px 400px at 25% -15%, #33160f 0%, #0a0708 55%), #0a0708;
    color: #e8d9c9;
    line-height: 1.6;
  }
  .wrap { position: relative; max-width: 860px; margin: 0 auto; padding: 40px 24px 80px; }
  .arch {
    height: 34px; border: 2.5px solid #ff6b35; border-bottom: none;
    border-radius: 20px 20px 0 0;
    box-shadow: inset 0 0 14px rgba(255,107,53,.35), 0 -2px 10px rgba(255,107,53,.25);
  }
  .ash { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .ash i {
    position: absolute; bottom: -6px; width: 3px; height: 3px; border-radius: 50%;
    background: #ff6b35; opacity: 0; animation: rise 7s linear infinite;
  }
  .ash i:nth-child(1) { left: 12%; animation-delay: 0s; }
  .ash i:nth-child(2) { left: 35%; animation-delay: 2.2s; }
  .ash i:nth-child(3) { left: 58%; animation-delay: 1.1s; width: 2px; height: 2px; }
  .ash i:nth-child(4) { left: 80%; animation-delay: 3.4s; }
  .ash i:nth-child(5) { left: 92%; animation-delay: 4.6s; }
  @keyframes rise {
    0% { transform: translateY(0); opacity: 0; }
    12% { opacity: .55; }
    100% { transform: translateY(-360px); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .ash i { animation: none; display: none; } }
  h1 { margin: 16px 0 4px; font-size: 2rem; letter-spacing: 1.5px; color: #f6e7d4; text-shadow: 0 0 14px rgba(255,107,53,.4); }
  h1 .accent { color: #ff6b35; }
  .sub { margin: 0 0 26px; color: #a8957e; font-style: italic; font-size: 1.05rem; }
  .plaque {
    background: linear-gradient(180deg, #17100f, #0d0908);
    border: 1px solid #3a2a2c; border-radius: 8px;
    padding: 16px 20px; margin-bottom: 26px;
  }
  .plaque p { margin: 6px 0; }
  .plaque .links { margin-top: 10px; }
  .plaque a { color: #ff6b35; }
  h2 {
    font-size: 1.1rem; letter-spacing: 2px; color: #c96a33;
    border-bottom: 1px solid #3a2a2c; padding-bottom: 8px; margin: 34px 0 16px;
  }
  .docs section { margin-bottom: 20px; }
  .docs h3 {
    font-size: .7rem; font-weight: 400; letter-spacing: 2px; text-transform: uppercase;
    color: #9a8359; margin: 0 0 8px; display: flex; align-items: center; gap: 10px;
  }
  .docs h3::after { content: ''; flex: 1; height: 2px; background: linear-gradient(90deg, #2a1a14, transparent); }
  .docs ul, ul.research {
    list-style: none; margin: 0 0 14px; padding: 2px 4px 10px;
    border-bottom: 3px solid #24181a;
  }
  .docs li, ul.research li { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
  .docs li::before, ul.research li::before {
    content: ''; flex: 0 0 auto; width: 5px; height: 20px; border-radius: 2px 0 0 2px;
    background: linear-gradient(90deg, #4a1d10, #7a2e12 60%, #ff6b35);
    box-shadow: 0 0 6px rgba(255,107,53,.55);
  }
  .docs a, ul.research a { color: #e8d9c9; text-decoration: none; }
  .docs a:hover, ul.research a:hover { color: #ff6b35; }
  a:focus-visible { outline: 2px solid #ff6b35; outline-offset: 2px; }
  ::selection { background: rgba(255,107,53,.35); }
  footer {
    margin-top: 44px; padding-top: 16px; border-top: 1px solid #3a2a2c;
    color: #7d8389; font-size: .85rem; font-style: italic;
  }
  footer a { color: #ff6b35; }
</style>
</head>
<body>
<div class="wrap">
  <div class="ash"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="arch"></div>
  <h1>Skarn — <span class="accent">The Warmaster of the Abyss</span></h1>
  <p class="sub">A 10,000-year-old retired demon. Now a Discord bot for Anomaly Alpha — AI-powered conversation, memory, games, and the Realm of Skarn.</p>

  <div class="plaque">
    <p><strong>Skarn Bot</strong> — Discord.js v14 bot with AI chat, 77+ commands, persistent SQLite memory, and an in-fiction RPG realm.</p>
    <p class="links">
      <a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/README.md">Bot README (commands &amp; setup)</a> ·
      <a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/tree/main/skarn-bot">Source code</a>
    </p>
  </div>

  <h2>Research Reports</h2>
  <ul class="research">
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/REPORT.md">Research Report</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/brief.md">Research Brief</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F1.md">Finding F1</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F2.md">Finding F2</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F3.md">Finding F3</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F4.md">Finding F4</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F5.md">Finding F5</a></li>
    <li><a href="https://github.com/anomaly-alpha/anomaly-alpha.github.io/blob/main/skarn-bot/docs/research/skarn/findings/F6.md">Finding F6</a></li>
  </ul>

  <h2>The Archives</h2>
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

- [ ] **Step 3: Verify the content contract survived**

```bash
grep -c "SKARN_INDEX" skarn-bot/index.html            # expect 2
grep -c "skarn-updated" skarn-bot/index.html          # expect 1
grep -c "github.com/anomaly-alpha" skarn-bot/index.html  # expect 10
node -e "var p=require('fs').readFileSync('skarn-bot/index.html','utf8');var s=(p.match(/<!--SKARN_INDEX_START-->/g)||[]).length,e=(p.match(/<!--SKARN_INDEX_END-->/g)||[]).length;console.log('markers',s,e);console.log('between:',JSON.stringify(p.split('<!--SKARN_INDEX_START-->')[1].split('<!--SKARN_INDEX_END-->')[0]));"
# expect markers 1 1 and between "\n  " (whitespace only)
```

- [ ] **Step 4: Verify generator idempotency (the critical contract)**

The generator refreshes the footer date to TODAY on each run, so the first run may legitimately change that one line if the committed date differs from today. Idempotency means: the SECOND run must be byte-identical to the first.

```bash
node scripts/generate-skarn-index.js            # run 1 (may update the footer date line)
shasum -a 256 skarn-bot/index.html > /tmp/after1
node scripts/generate-skarn-index.js            # run 2
shasum -a 256 skarn-bot/index.html > /tmp/after2
diff /tmp/after1 /tmp/after2                    # expect: NO output (run 2 byte-identical = idempotent)
git diff --stat skarn-bot/index.html            # expect: only the marker block + footer date line differ from committed
```

- [ ] **Step 5: Verify serving + link validity + a11y basics**

```bash
PORT=8123 node scripts/serve.js > /tmp/serve.log 2>&1 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8123/skarn-bot/     # 200
curl -s http://localhost:8123/skarn-bot/ | grep -c "<title>Skarn"             # 1
curl -s http://localhost:8123/skarn-bot/ | grep -c "prefers-reduced-motion"   # 1
kill %1
node -e "
var cp=require('child_process');
var committed=cp.execSync('git ls-files skarn-bot').toString().split('\n').filter(Boolean);
var page=require('fs').readFileSync('skarn-bot/index.html','utf8');
var links=[...page.matchAll(/github\.com\/anomaly-alpha\/anomaly-alpha\.github\.io\/blob\/main\/(skarn-bot\/[^\" >]+)/g)].map(m=>m[1]);
var bad=links.filter(f=>committed.indexOf(f)===-1);
console.log('blob links:',links.length,'bad:',bad.length);
"
# expect: blob links 9, bad 0
```

- [ ] **Step 6: Commit**

```bash
git add skarn-bot/index.html
git commit -m "feat: restyle Skarn page as Obsidian Keep with Hellfire Tomes"
```

- [ ] **Step 7: Report for visual confirmation**

Tell the user the page is restyled and they can open `http://localhost:8123/skarn-bot/` (or the deployed URL after push) to see the Obsidian Keep look — arch, ember glow, rising ash, tomes on shelves. If they want color/font tweaks, those are small CSS-value edits.
