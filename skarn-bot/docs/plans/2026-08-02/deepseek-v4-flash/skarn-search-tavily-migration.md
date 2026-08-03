# Tavily Search Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken search provider chain (Google CSE — 403 PERMISSION_DENIED dead key; DuckDuckGo — anomaly-blocked; Wikipedia — compound queries empty) with a single working Tavily backend, and remove the `duck-duck-scrape` dependency.

**Architecture:** `features/search/searchEngine.js` keeps its exact public contract (`searchWeb(query)` → `Promise<{results: Array<{title, snippet, url}>, source: string}>`, `cleanCache()`, LRU cache) so the three consumers (`search_web` tool, `/search` slash command, activation handler) work **unchanged**. Only the provider internals swap: one `POST https://api.tavily.com/search` call (Bearer auth, `max_results: 5`, `search_depth: 'basic'` = 1 credit) replacing the Google CSE → DDG → Wikipedia chain. Source labels become `'tavily'` / `'cache'` / `'error'`. Fail-closed on missing key / non-2xx.

**Tech Stack:** Node.js ≥18 (global `fetch`), Tavily REST API (no SDK), dotenv, better-sqlite3 (untouched).

**Key (never commit):** `TAVILY_API_KEY` goes ONLY into `skarn-bot/.env` (gitignored — verified via `git check-ignore`) and Railway env. The plan uses `<TAVILY_API_KEY>` placeholders; the executing agent pastes the real value from the session's user message into `.env` during Task 3.

## Global Constraints

- Do NOT commit the real API key anywhere. `.env` is gitignored; `.env.example` gets a placeholder only.
- No test framework — verify via `node --check`, temp-script smokes with `SKARN_DB_PATH=$(mktemp -d)/x.db`, and `node bot.js` boot check.
- `searchWeb()` MUST keep returning `{ results: [{title, snippet, url}], source }` — consumers rely on the object shape AND on `source === 'error'` for failure.
- `duck-duck-scrape` must be fully removed from `package.json` AND `package-lock.json` (regenerate lock via `npm install`, never hand-edit).
- Commits: conventional format, paths prefixed `skarn-bot/` from repo root `/Users/prime/Sites/Gems/anomaly-alpha`. Do NOT stage `.mimocode/mimocode.json`. Never commit `docs/NL-TOOLS.md` (user's in-progress worktree edit).
- Search cooldowns, `/search` UX, `search_web` tool schema, and `toolRunner.js`'s already-fixed shape handling are all out of scope — untouched.
- The user pasted Tavily's OpenCode MCP setup instructions; adding the `tavily` MCP entry to `~/.config/opencode/opencode.jsonc` (preserving the existing `mem0` entry) is in scope as Task 4.

---

### Task 1: Rewrite searchEngine.js with a single Tavily backend

**Covers:** [S2] (from design conversation — provider swap, contract preserved)

**Files:**
- Rewrite: `skarn-bot/features/search/searchEngine.js`

**Interfaces:**
- Produces: `searchWeb(query) → Promise<{results: Array<{title, snippet, url}>, source: 'tavily'|'cache'|'error', error?: string}>`, `cleanCache() → void`. Consumers: `features/tools/toolRunner.js:8` (search_web case), `features/search/search.handler.js:31`, `commands/search.js:38`.

- [ ] **Step 1: Replace the file contents**

```js
const TAVILY_URL = 'https://api.tavily.com/search';

// ===== LRU cache =====
const cache = new Map(); // normalizedQuery → { results, cachedAt }
const CACHE_MAX = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RESULTS = 5;

function normalizeQuery(query) {
  return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function searchTavily(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], source: 'error', error: 'Tavily API key not configured' };

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({
      query: query,
      max_results: MAX_RESULTS,
      search_depth: 'basic', // 1 API credit
    }),
  });

  if (!res.ok) {
    // 401 bad key, 429 rate limit, 432 plan limit, 433 paygo limit — all fail closed
    return { results: [], source: 'error', error: 'Tavily returned ' + res.status };
  }

  const data = await res.json();
  const results = (data.results || []).map(r => ({
    title: r.title || '',
    snippet: r.content || '',
    url: r.url || '',
  }));
  return { results, source: 'tavily' };
}

async function searchWeb(query) {
  const key = normalizeQuery(query);

  // Cache hit — reorder for LRU
  const cached = cache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    cache.delete(key);
    cache.set(key, cached);
    return { results: cached.results, source: 'cache' };
  }

  let result;
  try {
    result = await searchTavily(query);
  } catch (e) {
    console.log(`[Search] Tavily error: ${e.message}`);
    return { results: [], source: 'error', error: 'Tavily search failed' };
  }
  if (result.source === 'error') {
    console.log(`[Search] Tavily failed for query: ${query} (${result.error})`);
    return result;
  }

  // Store in cache
  cache.set(key, { results: result.results, cachedAt: Date.now() });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return result;
}

function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL) cache.delete(key);
  }
  // Also enforce max size
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

module.exports = { searchWeb, cleanCache };
```

- [ ] **Step 2: Syntax check**

Run (from `skarn-bot/`): `node --check features/search/searchEngine.js`
Expected: no output, exit 0.

- [ ] **Step 3: Live smoke with the real key**

Create temp script `live-tavily-check.js` in `skarn-bot/` (module resolution needs project dir; delete after):

```js
require('dotenv').config();
const { searchWeb } = require('./features/search/searchEngine');
(async () => {
  const r = await searchWeb('Big Walk game news');
  console.log('source:', r.source, '| results:', r.results.length, '| error:', r.error || '(none)');
  for (const x of r.results.slice(0, 3)) console.log('  •', x.title, '—', (x.snippet || '').slice(0, 80));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
```

Prerequisite: the real key passed inline via env var (dotenv does not override an already-set env var). Run:
`TAVILY_API_KEY=<real key from the user's message — tvly-dev-...> SKARN_DB_PATH=$(mktemp -d)/t.db node live-tavily-check.js`
Expected: `source: tavily`, ≥1 result with title/snippet. Then `rm live-tavily-check.js`.

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/features/search/searchEngine.js
git commit -m "feat: replace Google CSE/DDG/Wikipedia with Tavily search backend"
```

---

### Task 2: Update search consumers (footer label + startup log)

**Covers:** [S2]

**Files:**
- Modify: `skarn-bot/commands/search.js:83` (footer source label)
- Modify: `skarn-bot/features/search/search.handler.js:80` (footer source label — same fix, second consumer)
- Modify: `skarn-bot/bot.js:79-81` (startup backend log)

**Interfaces:**
- Consumes: `searchWeb()` source values `'tavily' | 'cache' | 'error'` from Task 1.

- [ ] **Step 1: Update the footer label in commands/search.js**

Replace line 83:

```js
        .setFooter({ text: source === 'cache' ? 'Cached' : source === 'wikipedia' ? 'Wikipedia' : source === 'google' ? 'Google' : 'DuckDuckGo' });
```

with:

```js
        .setFooter({ text: source === 'cache' ? 'Cached' : source === 'tavily' ? 'Tavily' : 'Search' });
```

- [ ] **Step 2: Update the footer label in search.handler.js**

Replace line 80 in `skarn-bot/features/search/search.handler.js`:

```js
      .setFooter({ text: source === 'cache' ? 'Cached' : source === 'wikipedia' ? 'Wikipedia' : source === 'google' ? 'Google' : 'DuckDuckGo' });
```

with:

```js
      .setFooter({ text: source === 'cache' ? 'Cached' : source === 'tavily' ? 'Tavily' : 'Search' });
```

- [ ] **Step 3: Update the startup log in bot.js**

Replace lines 79-81:

```js
  const hasKey = !!process.env.GOOGLE_CSE_KEY;
  const hasCx = !!process.env.GOOGLE_CSE_CX;
  console.log(`Search backend: Google CSE ${hasKey && hasCx ? '✓ ready' : '✗ not configured (will use DDG fallback)'}`);
```

with:

```js
  const hasKey = !!process.env.TAVILY_API_KEY;
  console.log(`Search backend: Tavily ${hasKey ? '✓ ready' : '✗ not configured'}`);
```

- [ ] **Step 4: Syntax check both files**

Run: `node --check commands/search.js && node --check features/search/search.handler.js && node --check bot.js && echo "SYNTAX OK"`
Expected: `SYNTAX OK`.

- [ ] **Step 5: Commit**

```bash
git add skarn-bot/commands/search.js skarn-bot/features/search/search.handler.js skarn-bot/bot.js
git commit -m "chore: point search footer labels and startup log at Tavily"
```

---

### Task 3: Config — swap env vars, add real key to .env, drop duck-duck-scrape

**Covers:** [S2]

**Files:**
- Modify: `skarn-bot/.env` (gitignored — real key, do not commit)
- Modify: `skarn-bot/.env.example` (placeholder)
- Modify: `skarn-bot/package.json` (remove duck-duck-scrape)
- Modify: `skarn-bot/features/tools/toolRunner.js:4` (stale comment — says "handles both Google CSE and DDG fallback", now inaccurate)
- Regenerate: `skarn-bot/package-lock.json`

**Interfaces:**
- Produces: `process.env.TAVILY_API_KEY` read by `searchEngine.js` (Task 1). `.env` already has `GOOGLE_CSE_KEY`/`GOOGLE_CSE_CX` lines — replace them.

- [ ] **Step 1: Swap .env lines (real key, gitignored)**

In `skarn-bot/.env`, replace:
```
GOOGLE_CSE_KEY=<old value>
GOOGLE_CSE_CX=<old value>
```
with:
```
TAVILY_API_KEY=<real key from the user's message — tvly-dev-...>
```
Keep the old Google lines removed. Verify: `grep -c TAVILY_API_KEY .env` → 1.

- [ ] **Step 2: Update .env.example**

Replace lines 19-20:
```
GOOGLE_CSE_KEY=your_api_key_here
GOOGLE_CSE_CX=your_search_engine_id_here
```
with:
```
TAVILY_API_KEY=your_api_key_here
```

- [ ] **Step 3: Remove duck-duck-scrape from package.json**

Remove the line `"duck-duck-scrape": "^2.2.7",` from `dependencies`. Then run `npm install` in `skarn-bot/` to regenerate `package-lock.json` and prune the module.

- [ ] **Step 4: Verify dependency removal**

Run: `grep -c duck-duck-scrape package.json package-lock.json; ls node_modules/duck-duck-scrape 2>&1`
Expected: count 0 in both files; module gone from node_modules.

- [ ] **Step 5: Fix the stale comment in toolRunner.js**

In `skarn-bot/features/tools/toolRunner.js` line 4, replace:
```js
// Routing functions for search (handles both Google CSE and DDG fallback)
```
with:
```js
// Routing function for search (Tavily backend)
```

- [ ] **Step 6: Confirm no code still references the old providers**

Run: `grep -rn "GOOGLE_CSE\|duck-duck-scrape\|searchDuckDuckGo\|searchGoogle\|searchWikipedia" features/ commands/ bot.js`
Expected: only hits in `docs/` (historical specs/plans) and CONTEXT.md (updated in Task 4) — zero hits in live code.

- [ ] **Step 7: Commit**

```bash
git add skarn-bot/.env.example skarn-bot/package.json skarn-bot/package-lock.json skarn-bot/features/tools/toolRunner.js
git commit -m "chore: configure TAVILY_API_KEY, drop duck-duck-scrape dependency"
```
Do NOT `git add skarn-bot/.env` (gitignored, contains the secret).

---

### Task 4: Add Tavily MCP entry to OpenCode config (user-requested)

**Covers:** user's pasted setup instructions

**Files:**
- Modify: `/Users/prime/.config/opencode/opencode.jsonc`

**Interfaces:**
- Preserves: existing `mem0` MCP entry (remote, bearer header) — must remain intact.

- [ ] **Step 1: Add the tavily MCP entry**

Current file content is:
```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  "mcp": {
    "mem0": {
      "type": "remote",
      "url": "https://mcp.mem0.ai/mcp/",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer m0-3jAPuQdBZO7sIiasubtYARMg5cIAU2dBTHiJgxu1"
      }
    }
  }
}
```

Add the `tavily` entry inside `"mcp"`:
```jsonc
    "tavily": {
      "type": "remote",
      "url": "https://mcp.tavily.com/mcp/?tavilyApiKey=<real key from the user's message>",
      "enabled": true
    }
```

- [ ] **Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('/Users/prime/.config/opencode/opencode.jsonc'))"` — if the file is strict JSON (no comments), expect success. If the file actually uses JSONC comments, validate with `node -e "JSON.parse(require('fs').readFileSync('/Users/prime/.config/opencode/opencode.jsonc','utf8'))"` and expect success (the existing file has no comments, so either works).
Note: this file is OUTSIDE the repo — no commit. Do NOT add the key to any committed file.

- [ ] **Step 3: Report restart requirement**

No commit. Tell the user: restart OpenCode to load the `tavily_*` MCP tools. (An alternative quick check: `curl -s https://api.tavily.com/search -H "Authorization: Bearer <key>" ...` — already verified working in Task 1.)

---

### Task 5: Docs — CONTEXT.md env table + ARCHITECTURE.md

**Covers:** [S2] (docs parity)

**Files:**
- Modify: `skarn-bot/CONTEXT.md` (§10 env table, lines ~267-279)
- Modify: `skarn-bot/docs/ARCHITECTURE.md` (line ~287)

**Interfaces:**
- Consumes: final env var name `TAVILY_API_KEY` from Task 3.

- [ ] **Step 1: Update CONTEXT.md §10 env table**

Replace the two `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` rows (lines ~267-268) with:

```
| `TAVILY_API_KEY` | For `/search` | — | Tavily API key (`features/search/searchEngine.js`) — free tier 1,000 credits/mo, basic search = 1 credit |
```

Replace the DDG-fallback note (line ~279):
```
> **Note**: When `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` are not configured, the `/search` command falls back to DuckDuckGo (DDG) search via `features/search/searchEngine.js`.
```
with:
```
> **Note**: When `TAVILY_API_KEY` is not configured, the `/search` command and `search_web` tool fail closed with a clear "not configured" result via `features/search/searchEngine.js`. Since 2026-08-02 the provider chain is Tavily-only (Google CSE dead key 403, DDG anomaly-blocked, Wikipedia compound-query-empty all removed; `duck-duck-scrape` dependency dropped).
```

- [ ] **Step 2: Update ARCHITECTURE.md**

Replace line ~287:
```
- `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` enable Google search; without them, search uses a DDG fallback
```
with:
```
- `TAVILY_API_KEY` enables web search via the Tavily API (single provider since 2026-08-02; free tier 1,000 credits/mo, basic search = 1 credit)
```

- [ ] **Step 3: Verify no stale references in live docs**

Run: `grep -n "GOOGLE_CSE" CONTEXT.md docs/ARCHITECTURE.md`
Expected: zero hits (historical specs/plans under `docs/specs/`, `docs/plans/`, `docs/reports/` are left as historical record).

- [ ] **Step 4: Commit**

```bash
git add skarn-bot/CONTEXT.md skarn-bot/docs/ARCHITECTURE.md
git commit -m "docs: document Tavily as the sole search provider"
```

---

### Task 6: End-to-end verification (post-change)

**Covers:** all

**Files:** none (temp smokes only)

**Interfaces:**
- Consumes: everything from Tasks 1-3.

- [ ] **Step 1: Full syntax sweep**

Run (from `skarn-bot/`): `node --check features/search/searchEngine.js && node --check features/tools/toolRunner.js && node --check commands/search.js && node --check features/search/search.handler.js && node --check bot.js && echo "ALL SYNTAX OK"`
Expected: `ALL SYNTAX OK`.

- [ ] **Step 2: search_web tool end-to-end (real key)**

Temp script `e2e-tool-check.js` in `skarn-bot/`:
```js
require('dotenv').config();
const { runTool } = require('./features/tools/toolRunner');
(async () => {
  const toolCall = { id: 'e2e1', function: { name: 'search_web', arguments: JSON.stringify({ query: 'Big Walk game news' }) } };
  const out = await runTool(toolCall, {});
  console.log(out.content.slice(0, 400));
  const ok = out.content.includes('•');
  console.log(ok ? 'PASS: tool returned results' : 'FAIL: tool returned no results');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
```
Run: `SKARN_DB_PATH=$(mktemp -d)/e2e.db node e2e-tool-check.js` then `rm e2e-tool-check.js`.
Expected: `PASS: tool returned results` with real titles.

- [ ] **Step 3: Boot check**

Run: `SKARN_DB_PATH=$(mktemp -d)/boot.db timeout 30 node bot.js 2>&1 | head -20`
Expected: login line + `Search backend: Tavily ✓ ready` + `[activation] Registered 47 activation phrases` + `[News] Initial fetch: 200 articles`. (Boot check requires Discord token + network; if the env blocks login, confirm at minimum the ready-log and search line before the login error.)

- [ ] **Step 4: Commit any stragglers (none expected)**

If `git status` shows only intended files, done. Do not commit `.env`, `.mimocode/mimocode.json`, or `docs/NL-TOOLS.md`.
