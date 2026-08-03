# Skarn News Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Skarn's broken search-first news pipeline with a real multi-category RSS+Atom news cache — 38 validated sources across 5 categories, published-time ordering, category-aware reader surfaces, and Railway-resilient per-feed isolation.

**Architecture:** Base the design on the spec at `skarn-bot/docs/specs/2026-08-02/deepseek-v4-flash/skarn-news-overhaul-design.md` ([S1]–[S11]). Rewrite `features/news/newsFetcher.js` as an RSS-primary pipeline: parallel per-feed fetch with dual RSS/Atom parsing → dedupe → upsert into `daily_news` with a new `published_at` column (migration v2 wipes the stale cache) → 72h/200-article retention. The scheduler drops to 15-min cadence; `searchWeb` is removed from the news path entirely (grill Q3). Reader surfaces: `/news` gains a `category` option, the `get_news` tool gains an optional `category` param, the digest category-labels lines, and `promptContext.js`'s news line becomes intent-gated and capped at 3 (grill Q1).

**Tech Stack:** Node.js ≥18, CommonJS, no build step; no new dependencies (uses `fetch`, `better-sqlite3`, existing migration framework, existing tool runner).

## Global Constraints

- **No test framework** (CONTEXT.md §11.2, deliberate). Verification = `node --check` + `node -e` smoke runs against a temp DB via `SKARN_DB_PATH` + a `node bot.js` boot check + a live `fetchNews()` run. Never add tests.
- **No search fallback** (grill Q3, spec [S5.6]): `newsFetcher.js` must NOT import `searchEngine` — search results were the root-cause bug. If every feed fails, `fetchNews` returns 0 and readers fail open. The `/search` command and `search_web` tool keep their own `searchWeb` usage untouched.
- **Per-feed isolation** (spec [S5]/[S8]): every feed fetch is its own try/catch with `AbortSignal.timeout(8000)`; one dead/blocked feed costs only that feed. Never throw into the scheduler (call sites already `.catch(() => {})`).
- **Dedupe rule** (grill Q4): exact URL wins; otherwise normalized-title (first 60 chars, lowercased, alphanumerics-only). No other dedupe heuristics.
- **Reader surfaces** (spec [S7]): `/news` category option (raw lists 10/cat, skarn mode picks from newest 10); `get_news` tool optional `category` + on-demand `fetchNews(category)` on empty cache (grill Q5); digest lines category-labeled.
- **Prompt news line is intent-gated, cap 3** (grill Q1, spec [S7.4]): `promptContext.js` injects `getRecentNews(3)` ONLY when the user message matches a news-intent keyword check; otherwise no headlines in the prompt.
- **Migration v2 wipes `daily_news`** (grill Q2, spec [S6]): stale search-era rows are deleted; the next fetch repopulates from real feeds.
- **Scheduler cadence 15 min** (spec [S3]): `setInterval(fetchNews, 15 * 60 * 1000)` at `features/scheduler/index.js:50-53`; boot fetch kept; digest stays 18:00.
- **36→38 feeds** — the spec's category table sums to 38 sources (tech 11, gaming 6, world 9, science 7, business 5); the registry must contain exactly those 38 validated URLs.
- Code style: `const`/`let` in new code, `function` declarations, UPPER_SNAKE_CASE constants, section-header comments (`// ===== NAME =====`). No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Migration v2 (`published_at`) + fresh-install schema

**Covers:** [S6] Schema migration v2; [S11] Migration data (grill Q2).

**Files:**
- Modify: `skarn-bot/db/migrations.js` (append migration v2)
- Modify: `skarn-bot/db/skarn-schema.sql` (add `published_at` to `daily_news` CREATE TABLE)

**Interfaces:**
- Consumes: the existing migration framework (`MIGRATIONS` array + `runMigrations` at `db/migrations.js:14-25`; invoked at `db/database.js:38-39`)
- Produces: `daily_news.published_at INTEGER` column on existing DBs (with stale cache wiped) and fresh installs; `user_version = 2` after init

- [ ] **Step 1: Append migration v2**

In `skarn-bot/db/migrations.js`, append to the `MIGRATIONS` array (after the version-1 entry):

```js
  {
    version: 2,
    name: 'add_daily_news_published_at',
    up(db) {
      db.prepare('DELETE FROM daily_news').run(); // stale search-era cache; repopulated by next fetch (grill Q2)
      db.prepare('ALTER TABLE daily_news ADD COLUMN published_at INTEGER').run();
    },
  },
```

- [ ] **Step 2: Update fresh-install schema**

In `skarn-bot/db/skarn-schema.sql`, the `daily_news` CREATE TABLE (currently lines 504-512) gains the new column. Change:

```sql
CREATE TABLE IF NOT EXISTS daily_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  source TEXT,
  category TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);
```

to:

```sql
CREATE TABLE IF NOT EXISTS daily_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT NOT NULL,
  snippet TEXT,
  url TEXT,
  source TEXT,
  category TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  published_at INTEGER
);
```

- [ ] **Step 3: Verify (temp DB, fresh + migrated paths)**

Run from `skarn-bot/`:

```bash
node --check db/migrations.js
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { db } = require('./db/database');
const version = db.pragma('user_version', { simple: true });
const cols = db.prepare('PRAGMA table_info(daily_news)').all().map(c => c.name);
console.log('user_version:', version);
console.log('has published_at:', cols.includes('published_at'));
console.log('fresh install rows:', db.prepare('SELECT COUNT(*) c FROM daily_news').get().c);
"
```

Expected: `user_version: 2`, `has published_at: true`, `fresh install rows: 0`.

Then the migrated path — simulate a legacy DB (user_version 1, old schema, a stale row):

```bash
SKARN_DB_PATH=$(mktemp -d)/legacy.db node -e "
const Database = require('better-sqlite3');
const path = process.env.SKARN_DB_PATH;
const db = new Database(path);
db.pragma('user_version = 1');
db.exec('CREATE TABLE daily_news (id INTEGER PRIMARY KEY AUTOINCREMENT, headline TEXT NOT NULL, snippet TEXT, url TEXT, source TEXT, category TEXT NOT NULL, fetched_at INTEGER NOT NULL)');
db.prepare(\"INSERT INTO daily_news (headline, category, fetched_at) VALUES ('stale search junk', 'tech_gaming', 1)\").run();
db.close();
const { runMigrations } = require('./db/migrations');
const db2 = require('./db/database').db;
runMigrations(db2);
console.log('migrated version:', db2.pragma('user_version', { simple: true }));
console.log('migrated has published_at:', db2.prepare('PRAGMA table_info(daily_news)').all().map(c => c.name).includes('published_at'));
console.log('stale rows wiped:', db2.prepare('SELECT COUNT(*) c FROM daily_news').get().c === 0);
"
```

Expected: `migrated version: 2`, `migrated has published_at: true`, `stale rows wiped: true`.

- [ ] **Step 4: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/db/migrations.js skarn-bot/db/skarn-schema.sql
git commit -m "feat: add daily_news published_at migration (wipe stale cache)"
```

### Task 2: Rewrite `features/news/newsFetcher.js` — registry, dual-format parsing, parallel fetch, dedupe, upsert

**Covers:** [S3] Architecture; [S4] Feed registry; [S5] Fetch/parse/dedupe/store; [S8] Error handling & safety; [S11] Formats, Ordering, Dedupe, Search role, Railway resilience.

**Files:**
- Rewrite: `skarn-bot/features/news/newsFetcher.js` (replace entire file)

**Interfaces:**
- Consumes: `db` from `../../db/database`; Node `fetch` (global, Node ≥18). Does NOT import `searchEngine` (grill Q3).
- Produces: exports `fetchNews(category?) -> Promise<number>` (count stored, 0 on total failure), `getRecentNews(limit = 10, category?) -> Array<{headline, snippet, url, source, category, published_at, fetched_at}>`, and `FEEDS` (the 38-entry registry). Signature-compatible with all existing callers: `scheduler/index.js:51,53` (count), `toolRunner.js:110-115` (getRecentNews(10) + fetchNews()), `promptContext.js:65` (getRecentNews(5)), `newsDigest.js:6` (getRecentNews(5)), `commands/news.js:20,72` (getRecentNews(10)).

- [ ] **Step 1: Write the full new module**

Replace the entire contents of `skarn-bot/features/news/newsFetcher.js` with:

```js
// ===== News Fetcher =====
// RSS+Atom headline cache fed by 38 curated sources across 5 categories.
// Scheduler-populated every 15 min; readers query daily_news by category.
// Per-feed isolation: one dead/blocked feed costs only that feed. (spec [S3]/[S8])

const { db } = require('../../db/database');

const MAX_ARTICLES = 200;
const MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72h by published_at
const FEED_TIMEOUT_MS = 8000;
const FETCH_UA = 'SkarnBot/1.0 (news-fetch)';

// 38 validated sources, tested live 2026-08-02 (HTTP 200, real items, pubDate).
// Single source of truth for feeds. (spec [S4])
const FEEDS = [
  // tech (11)
  { category: 'tech', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { category: 'tech', name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { category: 'tech', name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'tech', name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { category: 'tech', name: 'Lifehacker', url: 'https://lifehacker.com/rss' },
  { category: 'tech', name: 'MacRumors', url: 'https://www.macrumors.com/macrumors.xml' },
  { category: 'tech', name: 'Gizmodo', url: 'https://www.gizmodo.com/rss' },
  { category: 'tech', name: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { category: 'tech', name: 'Android Authority', url: 'https://www.androidauthority.com/feed/' },
  { category: 'tech', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }, // Atom
  { category: 'tech', name: 'CNET', url: 'https://www.cnet.com/rss/news/' }, // Atom
  // gaming (6)
  { category: 'gaming', name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed' },
  { category: 'gaming', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
  { category: 'gaming', name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  { category: 'gaming', name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  { category: 'gaming', name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/' },
  { category: 'gaming', name: 'Kotaku', url: 'https://kotaku.com/rss' },
  // world (9)
  { category: 'world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { category: 'world', name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { category: 'world', name: 'Guardian World', url: 'https://feeds.guardian.co.uk/theguardian/world/rss' },
  { category: 'world', name: 'CBS World', url: 'https://www.cbsnews.com/latest/rss/world' },
  { category: 'world', name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories' },
  { category: 'world', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml' },
  { category: 'world', name: 'SCMP', url: 'https://www.scmp.com/rss/91/feed' },
  { category: 'world', name: 'France 24', url: 'https://www.france24.com/en/rss' },
  // science (7)
  { category: 'science', name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/all.xml' },
  { category: 'science', name: 'Phys.org', url: 'https://phys.org/rss-feed/' },
  { category: 'science', name: 'NASA', url: 'https://www.nasa.gov/feed/' },
  { category: 'science', name: 'Space.com', url: 'https://www.space.com/feeds/all' },
  { category: 'science', name: 'Quanta Magazine', url: 'https://www.quantamagazine.org/feed/' },
  { category: 'science', name: 'Science News', url: 'https://www.sciencenews.org/feed' },
  { category: 'science', name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/' },
  // business (5)
  { category: 'business', name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { category: 'business', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { category: 'business', name: 'WSJ Markets', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' },
  { category: 'business', name: 'Forbes Innovation', url: 'https://www.forbes.com/innovation/feed/' },
  { category: 'business', name: 'Forbes Business', url: 'https://www.forbes.com/business/feed/' },
];

// ===== Parsing (RSS <item> + Atom <entry>, spec [S5.2]/[S11] Formats) =====

function tagContent(block, tag) {
  var m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function parseRSSItem(block) {
  var title = tagContent(block, 'title');
  var link = tagContent(block, 'link');
  var desc = stripHtml(tagContent(block, 'description'));
  var pub = Date.parse(tagContent(block, 'pubDate'));
  if (!title || !link) return null;
  return { title: title, snippet: desc.slice(0, 200), url: link, publishedAt: isNaN(pub) ? Date.now() : pub };
}

function parseAtomEntry(block) {
  var title = tagContent(block, 'title');
  var linkM = block.match(/<link[^>]*href="([^"]+)"/i);
  var summary = stripHtml(tagContent(block, 'summary') || tagContent(block, 'content'));
  var pub = Date.parse(tagContent(block, 'published') || tagContent(block, 'updated'));
  if (!title || !linkM) return null;
  return { title: title, snippet: summary.slice(0, 200), url: linkM[1], publishedAt: isNaN(pub) ? Date.now() : pub };
}

function parseFeed(xml) {
  if (/<item[\s>]/i.test(xml)) {
    var items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return items.map(parseRSSItem).filter(Boolean);
  }
  if (/<entry[\s>]/i.test(xml)) {
    var entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
    return entries.map(parseAtomEntry).filter(Boolean);
  }
  return [];
}

async function fetchFeed(feed) {
  var res = await fetch(feed.url, {
    headers: { 'User-Agent': FETCH_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(feed.url + ' -> ' + res.status);
  var xml = await res.text();
  var parsed = parseFeed(xml);
  return parsed.map(function(item) {
    return { category: feed.category, source: feed.name, title: item.title, snippet: item.snippet, url: item.url, publishedAt: item.publishedAt };
  });
}

// ===== Dedupe (URL wins, then normalized title-60 — grill Q4) =====

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 60);
}

// ===== Fetch + store =====

async function fetchNews(category) {
  var feeds = category ? FEEDS.filter(function(f) { return f.category === category; }) : FEEDS;

  // Parallel per-feed fetch with per-feed isolation (spec [S8])
  var batches = await Promise.all(feeds.map(async function(feed) {
    try {
      return await fetchFeed(feed);
    } catch (e) {
      console.log('[News] Feed failed (' + feed.name + '): ' + e.message);
      return [];
    }
  }));
  var items = batches.reduce(function(a, b) { return a.concat(b); }, []);

  // Dedupe: exact URL wins, then normalized-title-60 (grill Q4)
  var seenUrl = new Set();
  var seenTitle = new Set();
  var unique = [];
  for (var item of items) {
    if (!item.title || !item.url) continue;
    if (seenUrl.has(item.url)) continue;
    var nt = normalizeTitle(item.title);
    if (seenTitle.has(nt)) continue;
    seenUrl.add(item.url);
    seenTitle.add(nt);
    unique.push(item);
  }

  if (unique.length === 0) return 0;

  // Upsert + prune (spec [S5.4-5])
  var now = Date.now();
  var count = 0;
  var upsert = db.transaction(function() {
    for (var item of unique.slice(0, MAX_ARTICLES)) {
      var existing = db.prepare('SELECT id FROM daily_news WHERE url = ?').get(item.url);
      if (existing) {
        db.prepare('UPDATE daily_news SET headline = ?, snippet = ?, source = ?, category = ?, published_at = ? WHERE id = ?')
          .run(item.title, item.snippet, item.source, item.category, item.publishedAt, existing.id);
      } else {
        db.prepare('INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(item.title, item.snippet, item.url, item.source, item.category, now, item.publishedAt);
      }
      count++;
    }
    db.prepare('DELETE FROM daily_news WHERE published_at < ?').run(now - MAX_AGE_MS);
  });
  upsert();

  return count;
}

function getRecentNews(limit = 10, category) {
  if (category) {
    return db.prepare('SELECT * FROM daily_news WHERE category = ? ORDER BY published_at DESC LIMIT ?').all(category, limit);
  }
  return db.prepare('SELECT * FROM daily_news ORDER BY published_at DESC LIMIT ?').all(limit);
}

module.exports = { fetchNews, getRecentNews, FEEDS };
```

- [ ] **Step 2: Verify — offline parser smoke (temp DB, stubbed fetch)**

Run from `skarn-bot/`:

```bash
node --check features/news/newsFetcher.js
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const nf = require('./features/news/newsFetcher');
// Stub fetch before calling fetchNews
const origFetch = global.fetch;
let call = 0;
global.fetch = async (url, opts) => {
  call++;
  if (call === 1) { // RSS feed with pubDate + duplicate title/url
    return { ok: true, text: async () => '<rss><channel>' +
      '<item><title>Alpha story one</title><link>https://a.com/1</link><description>&lt;p&gt;desc one&lt;/p&gt;</description><pubDate>Sat, 02 Aug 2026 12:00:00 GMT</pubDate></item>' +
      '<item><title>Alpha story one</title><link>https://a.com/1</link><description>dupe</description><pubDate>Sat, 02 Aug 2026 12:00:00 GMT</pubDate></item>' +
      '<item><title>Alpha story two</title><link>https://a.com/2</link><description>desc two</description><pubDate>Sat, 02 Aug 2026 13:00:00 GMT</pubDate></item>' +
      '</channel></rss>' };
  }
  if (call === 2) { // Atom feed
    return { ok: true, text: async () => '<feed><entry>' +
      '<title>Beta atom story</title><link rel=\"alternate\" href=\"https://b.com/1\"/><summary>atom desc</summary><published>2026-08-02T10:00:00Z</published>' +
      '</entry><entry><title>Alpha story two</title><link href=\"https://a.com/2\"/><summary>cross-feed dupe title</summary></entry>' +
      '</feed>' };
  }
  return { ok: false, text: async () => '' };
};
(async () => {
  const count = await nf.fetchNews();
  global.fetch = origFetch;
  const all = nf.getRecentNews(50);
  const tech = nf.getRecentNews(50, 'tech');
  console.log('stored count:', count);
  console.log('all rows:', all.length);
  console.log('tech rows:', tech.length);
  console.log('first is newest (story two, 13:00):', all[0] && all[0].headline.includes('two'));
  console.log('atom parsed:', all.some(r => r.headline.includes('Beta atom')));
  console.log('cross-feed dupe merged:', all.filter(r => r.headline.includes('two')).length === 1);
  console.log('url dupe merged:', all.filter(r => r.url === 'https://a.com/1').length === 1);
  console.log('published_at set:', all.every(r => typeof r.published_at === 'number'));
})();
"
```

Expected: `stored count: 3`, `all rows: 3`, `tech rows: 3` (both stubbed feeds are tech), `first is newest...: true`, `atom parsed: true`, `cross-feed dupe merged: true`, `url dupe merged: true`, `published_at set: true`.

- [ ] **Step 3: Verify — fail-open isolation + prune**

```bash
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const nf = require('./features/news/newsFetcher');
global.fetch = async () => { throw new Error('network down'); };
(async () => {
  const count = await nf.fetchNews();
  console.log('all feeds down -> 0:', count === 0);
})();
"
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { db } = require('./db/database');
const nf = require('./features/news/newsFetcher');
db.prepare(\"INSERT INTO daily_news (headline, category, fetched_at, published_at) VALUES ('old', 'tech', 1, 1)\").run();
global.fetch = async (url, opts) => ({ ok: true, text: async () => '<rss><channel><item><title>Fresh</title><link>https://f.com/1</link><description>d</description><pubDate>Sat, 02 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>' });
(async () => {
  await nf.fetchNews('tech');
  const rows = db.prepare('SELECT headline FROM daily_news').all();
  console.log('old pruned, fresh kept:', rows.length === 1 && rows[0].headline === 'Fresh');
})();
"
```

Expected: `all feeds down -> 0: true` and `old pruned, fresh kept: true`.

- [ ] **Step 4: Verify — live feed-fetch check (the call Railway will run)**

```bash
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const nf = require('./features/news/newsFetcher');
nf.fetchNews().then(count => {
  console.log('live articles stored:', count);
  const cats = {};
  for (const f of nf.FEEDS) cats[f.category] = (cats[f.category] || 0) + 1;
  console.log('feeds per category:', JSON.stringify(cats));
  console.log('registry size:', nf.FEEDS.length);
}).catch(e => console.error('fetch error:', e.message));
"
```

Expected: `live articles stored` > 0 (real feeds), `registry size: 38`, category counts `{"tech":11,"gaming":6,"world":9,"science":7,"business":5}`. (This machine ≠ Railway's IP; per-feed isolation + the boot check are the Railway-side defenses.)

- [ ] **Step 5: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/features/news/newsFetcher.js
git commit -m "feat: rewrite news fetcher as 38-feed RSS/Atom pipeline with published-time ordering"
```

### Task 3: Drop news fetch to 15-min cadence in the scheduler

**Covers:** [S3] Scheduler; [S11] Cadence.

**Files:**
- Modify: `skarn-bot/features/scheduler/index.js:50-53`

**Interfaces:**
- Consumes: `fetchNews` (Task 2 export, count-returning)
- Produces: news refreshed every 15 min instead of 60

- [ ] **Step 1: Change the interval**

In `skarn-bot/features/scheduler/index.js`, change line 50-52 from:

```js
  setInterval(() => {
    fetchNews().then(count => { if (count > 0) console.log('[News] Fetched ' + count + ' articles'); }).catch(() => {});
  }, 60 * 60 * 1000);
```

to:

```js
  setInterval(() => {
    fetchNews().then(count => { if (count > 0) console.log('[News] Fetched ' + count + ' articles'); }).catch(() => {});
  }, 15 * 60 * 1000);
```

- [ ] **Step 2: Verify**

```bash
node --check features/scheduler/index.js
```

- [ ] **Step 3: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/features/scheduler/index.js
git commit -m "chore: fetch news every 15 minutes"
```

### Task 4: Add the `category` option to `/news`

**Covers:** [S7.1] /news reader surface; [S11] Reader surfaces, Skarn AI mode (grill Q6).

**Files:**
- Modify: `skarn-bot/commands/news.js` (SlashCommandBuilder option, execute, handleActivation, parseArgs)

**Interfaces:**
- Consumes: `getRecentNews(limit, category)` (Task 2)
- Produces: `/news [style] [category]`, `skarn news <category>`; raw lists 10/cat, skarn mode picks from newest 10 of category

- [ ] **Step 1: Add the category option to the command schema**

In `skarn-bot/commands/news.js`, after the `style` option (lines 5-9), add a `category` option to the same `.addStringOption` chain:

```js
    .addStringOption(option =>
      option.setName('category')
        .setDescription('News category (default: top mixed)')
        .addChoices(
          { name: 'Tech', value: 'tech' },
          { name: 'Gaming', value: 'gaming' },
          { name: 'World', value: 'world' },
          { name: 'Science', value: 'science' },
          { name: 'Business', value: 'business' },
        )),
```

- [ ] **Step 2: Thread `category` through `execute`**

In `execute(interaction)`, read the option and pass it to `getRecentNews`. Replace:

```js
    const style = interaction.options.getString('style') || 'skarn';
    const articles = getRecentNews(10);
```

with:

```js
    const style = interaction.options.getString('style') || 'skarn';
    const category = interaction.options.getString('category') || null;
    const articles = getRecentNews(10, category);
```

And update the empty-cache reply to be category-aware. Replace:

```js
    if (!articles || articles.length === 0) {
      return interaction.reply({ content: 'No news articles cached yet. Check back in a bit.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
```

with:

```js
    if (!articles || articles.length === 0) {
      const label = category ? category + ' news' : 'news articles';
      return interaction.reply({ content: 'No ' + label + ' cached yet. Check back in a bit.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
```

Then in the raw embed (line ~28) and the skarn fallback embed (line ~97), make the title category-aware. Replace the two occurrences of:

```js
        .setTitle('📰 today\'s headlines')
```

with:

```js
        .setTitle(category ? '📰 ' + category + ' headlines' : '📰 today\'s headlines')
```

(There are two occurrences — the raw-mode embed and the skarn-mode fallback embed. Both use the same `category` variable which is now in scope.)

- [ ] **Step 3: Update `handleActivation` + `parseArgs` for `skarn news <category>`**

In `handleActivation(message, args)`, use the category. Replace:

```js
  async handleActivation(message) {
    const articles = getRecentNews(10);
    if (!articles || articles.length === 0) {
      return message.reply({ content: 'No news articles cached yet.', allowedMentions: { parse: ['users'] } });
    }
```

with:

```js
  async handleActivation(message, args) {
    const category = (args && args.category) || null;
    const articles = getRecentNews(10, category);
    if (!articles || articles.length === 0) {
      const label = category ? category + ' news' : 'news articles';
      return message.reply({ content: 'No ' + label + ' cached yet.', allowedMentions: { parse: ['users'] } });
    }
```

And make the embed title category-aware in `handleActivation` too (the same `setTitle` line). Then replace the `parseArgs`:

```js
    parseArgs: function() { return {}; },
```

with:

```js
    parseArgs: function(content) {
      var rest = content.slice('skarn news'.length).trim();
      var valid = ['tech', 'gaming', 'world', 'science', 'business'];
      return valid.indexOf(rest) !== -1 ? { category: rest } : {};
    },
```

- [ ] **Step 4: Verify**

```bash
node --check commands/news.js
```

Then an offline behavior smoke (from `skarn-bot/`):

```bash
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { db } = require('./db/database');
db.prepare(\"INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES ('Tech A', '', '', 'x', 'tech', 1, 2)\").run();
db.prepare(\"INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES ('Sci B', '', '', 'x', 'science', 1, 1)\").run();
const { getRecentNews } = require('./features/news/newsFetcher');
console.log('mixed returns both:', getRecentNews(10).length === 2);
console.log('tech filter:', getRecentNews(10, 'tech').length === 1 && getRecentNews(10, 'tech')[0].headline === 'Tech A');
console.log('science filter:', getRecentNews(10, 'science')[0].headline === 'Sci B');
"
```

Expected: `mixed returns both: true`, `tech filter: true`, `science filter: true`.

- [ ] **Step 5: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/commands/news.js
git commit -m "feat: add category option to /news and skarn news"
```

### Task 5: Add the optional `category` param to the `get_news` tool

**Covers:** [S7.2] get_news tool; [S11] Reader surfaces, on-demand category fetch (grill Q5).

**Files:**
- Modify: `skarn-bot/features/tools/toolDefinitions.js` (get_news schema)
- Modify: `skarn-bot/features/tools/toolRunner.js` (get_news arm)

**Interfaces:**
- Consumes: `getRecentNews(limit, category)` + `fetchNews(category)` (Task 2)
- Produces: `get_news` accepts `{ category?: 'tech'|'gaming'|'world'|'science'|'business' }`; returns top 5 of that category or mixed

- [ ] **Step 1: Add the `category` param to the schema**

In `skarn-bot/features/tools/toolDefinitions.js`, the `get_news` tool currently has `parameters: { type: 'object', properties: {} }`. Replace that with:

```js
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'News category: tech, gaming, world, science, or business. Omit for top mixed stories.', enum: ['tech', 'gaming', 'world', 'science', 'business'] },
        },
      },
```

- [ ] **Step 2: Thread `category` through the runner arm**

In `skarn-bot/features/tools/toolRunner.js`, the `get_news` arm currently reads `getRecentNews(10)` and calls `fetchNews()`. Replace the arm body:

```js
    case 'get_news': {
      const { getRecentNews, fetchNews } = require('../news/newsFetcher');
      try {
        let articles = getRecentNews(10);
        if (!articles || articles.length === 0) {
          await fetchNews(); // on-demand refresh (spec [S11] News freshness)
          articles = getRecentNews(10);
        }
        if (!articles || articles.length === 0) {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'No news cached yet — check back in a bit.' };
        }
        const lines = articles.slice(0, 5).map(a =>
          `• ${(a.headline || '').slice(0, 100)}${a.snippet ? ' — ' + a.snippet.slice(0, 150) + '…' : ''}`
        );
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'News is unreachable right now — try again later.' };
      }
    }
```

with:

```js
    case 'get_news': {
      const { getRecentNews, fetchNews } = require('../news/newsFetcher');
      const category = parsed.category || null;
      try {
        let articles = getRecentNews(5, category);
        if (!articles || articles.length === 0) {
          await fetchNews(category); // on-demand category refresh (grill Q5)
          articles = getRecentNews(5, category);
        }
        if (!articles || articles.length === 0) {
          const label = category ? category + ' news' : 'news';
          return { role: 'tool', tool_call_id: toolCall.id, content: 'No ' + label + ' cached yet — check back in a bit.' };
        }
        const lines = articles.slice(0, 5).map(a =>
          `[${a.category || 'mixed'}] ${(a.headline || '').slice(0, 100)}${a.snippet ? ' — ' + a.snippet.slice(0, 150) + '…' : ''}`
        );
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'News is unreachable right now — try again later.' };
      }
    }
```

- [ ] **Step 3: Verify — tool smoke (offline)**

Run from `skarn-bot/`:

```bash
node --check features/tools/toolDefinitions.js && node --check features/tools/toolRunner.js
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { db } = require('./db/database');
db.prepare(\"INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES ('Sci Headline One', '', '', 'x', 'science', 1, 2)\").run();
const nf = require('./features/news/newsFetcher');
nf.fetchNews = async () => 0; // stubbed — no on-demand network
const { runTool } = require('./features/tools/toolRunner');
const mk = (name, args) => ({ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } });
(async () => {
  const s = await runTool(mk('get_news', { category: 'science' }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('science category:', s.content.includes('[science]') && s.content.includes('Sci Headline One'));
  const m = await runTool(mk('get_news', {}), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('mixed includes science row:', m.content.includes('Sci Headline One'));
  const e = await runTool(mk('get_news', { category: 'world' }), { userId: 'u1', guildId: 'g1', channelId: 'c1' });
  console.log('empty category fail-open:', e.content.includes('No world news cached'));
})();
"
```

Expected: `science category: true`, `mixed includes science row: true`, `empty category fail-open: true`.

- [ ] **Step 4: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/features/tools/toolDefinitions.js skarn-bot/features/tools/toolRunner.js
git commit -m "feat: support category param on get_news tool"
```

### Task 6: Category-label the digest + intent-gate the prompt news line

**Covers:** [S7.3] postDigest; [S7.4] promptContext intent-gated news line (grill Q1); [S11] Prompt news line.

**Files:**
- Modify: `skarn-bot/features/news/newsDigest.js`
- Modify: `skarn-bot/features/promptContext.js` (news line)

**Interfaces:**
- Consumes: `getRecentNews(5)` / `getRecentNews(3)` (Task 2)
- Produces: digest lines `[category] headline`; prompt news line only when message matches news intent, capped at 3

- [ ] **Step 1: Category-label digest lines**

In `skarn-bot/features/news/newsDigest.js`, replace the embed description map (lines 11-13):

```js
    .setDescription(articles.map((a, i) =>
      `**${i + 1}.** ${a.headline}\n${a.snippet ? a.snippet.slice(0, 120) + '...' : ''}`
    ).join('\n\n'))
```

with:

```js
    .setDescription(articles.map((a, i) =>
      `**[${a.category || 'mixed'}] ${a.headline}**\n${a.snippet ? a.snippet.slice(0, 120) + '...' : ''}`
    ).join('\n\n'))
```

- [ ] **Step 2: Intent-gate the prompt news line**

In `skarn-bot/features/promptContext.js`, find the news-line block (currently lines 63-66):

```js
  const recentNews = getRecentNews(5);
  const newsLine = recentNews.length > 0
    ? 'Today\'s headlines: ' + recentNews.map(function(n) { return n.headline; }).join(' | ')
    : '';
```

Replace it with an intent-gated version (grill Q1 — inject only when the user's message looks news-related, capped at 3). The user message is available as `opts.userContent` (the `buildContext` opts param). Add a news-intent keyword check:

```js
  // News line is intent-gated (grill Q1): only injected when the user's message
  // looks news-related, capped at 3 headlines — keeps tokens off the hot path.
  const NEWS_INTENT_RE = /\b(news|headlines?|happening in the world|current events|top stories|what'?s (going on|up) in)\b/i;
  var newsLine = '';
  if (opts.userContent && NEWS_INTENT_RE.test(opts.userContent)) {
    const recentNews = getRecentNews(3);
    if (recentNews.length > 0) {
      newsLine = 'Today\'s headlines: ' + recentNews.map(function(n) { return n.headline; }).join(' | ');
    }
  }
```

Verify the `opts` parameter name in `buildContext` matches — the function signature is `buildContext(userId, guildId, channelId, opts)` and it reads `opts.roleNature`, `opts.userContent`, `opts.interactionCount`. If the parameter is named differently (e.g. destructured), adapt accordingly — read the function signature first.

- [ ] **Step 3: Verify**

```bash
node --check features/news/newsDigest.js && node --check features/promptContext.js
```

Then an offline intent-gate smoke (from `skarn-bot/`):

```bash
SKARN_DB_PATH=$(mktemp -d)/skarn.db node -e "
const { db } = require('./db/database');
db.prepare(\"INSERT INTO daily_news (headline, snippet, url, source, category, fetched_at, published_at) VALUES ('Headline X', '', '', 'x', 'tech', 1, 2)\").run();
const { buildContext } = require('./features/promptContext');
const gated = buildContext('u1', 'g1', 'c1', { userContent: 'any news today?', interactionCount: 1 });
console.log('news intent injects line:', gated.newsLine.includes('Headline X'));
const plain = buildContext('u1', 'g1', 'c1', { userContent: 'hello skarn', interactionCount: 1 });
console.log('plain message no news line:', plain.newsLine === '');
"
```

Expected: `news intent injects line: true`, `plain message no news line: true`. (Note: `buildContext` may need DB rows for other lines; the smoke asserts only `newsLine`.)

- [ ] **Step 4: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/features/news/newsDigest.js skarn-bot/features/promptContext.js
git commit -m "feat: category-label news digest and intent-gate the prompt news line"
```

### Task 7: Boot check + docs (README, CONTEXT.md, NL-TOOLS guide)

**Covers:** [S9] Verification; docs.

**Files:**
- Modify: `skarn-bot/README.md` (Verification section: news smokes)
- Modify: `skarn-bot/CONTEXT.md` (mark news overhaul implemented)
- Modify: `skarn-bot/docs/NL-TOOLS.md` (get_news category mention)

**Interfaces:**
- Consumes: the overhauled fetcher from Tasks 1-6
- Produces: documented smokes; CONTEXT.md/NL-TOOLS.md reflect the live state

- [ ] **Step 1: Boot check**

From `skarn-bot/` (uses the real `.env`; boot to 'Logged in as' then Ctrl+C):

```bash
node bot.js
```

Expected: boots to `Logged in as Skarn#0821` with no load errors; the news initial fetch runs. If `.env` is absent, report the load phase and note login skipped.

- [ ] **Step 2: Add news smokes to README Verification**

Read `skarn-bot/README.md` and find the Verification section (after the tool-runner smoke added earlier). Append:

```bash
    # News fetcher (offline; fetch stubbed, temp DB): parsing, dedupe, categories
    node -e "
    const nf = require('./features/news/newsFetcher');
    global.fetch = async () => ({ ok: true, text: async () => '<rss><channel><item><title>Alpha</title><link>https://a.com/1</link><description>d</description><pubDate>Sat, 02 Aug 2026 12:00:00 GMT</pubDate></item><item><title>Alpha</title><link>https://a.com/1</link><description>dup</description><pubDate>Sat, 02 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>' });
    (async () => {
      const count = await nf.fetchNews('tech');
      const rows = nf.getRecentNews(10, 'tech');
      console.log('news parses + dedupes:', count === 1 && rows.length === 1 && rows[0].headline === 'Alpha');
    })();
    "
```

Match the surrounding block formatting (comment header + `node -e "` + IIFE + closing pattern).

- [ ] **Step 3: Update CONTEXT.md**

In `skarn-bot/CONTEXT.md`, the "News cache" glossary entry added during the grill currently describes the overhaul as a design. Change "**Overhauled 2026-08-02 (design `docs/specs/...skarn-news-overhaul-design.md`)**" to mark it implemented:

```
- **News cache** (`daily_news` table, `features/news/newsFetcher.js`): scheduler-populated headline cache for the news command, the `get_news` AI tool, and the AI prompt context `newsLine`. **Overhauled 2026-08-02 (spec `docs/specs/2026-08-02/deepseek-v4-flash/skarn-news-overhaul-design.md`)**: 38 validated RSS+Atom feeds across 5 categories (tech/gaming/world/science/business), parallel per-feed-isolated fetch every 15 min, 200-article / 72h retention by `published_at`, dual RSS+Atom parsing, dedupe by URL+title, no search fallback. The `newsLine` in `promptContext.js` is **intent-gated** — injected only when the message looks news-related, capped at 3 headlines.
```

- [ ] **Step 4: Update NL-TOOLS.md**

In `skarn-bot/docs/NL-TOOLS.md`, the News section (## 2. News — `get_news`) — add a line noting categories are supported:

```
News covers 5 categories — tech, gaming, world, science, business — and you can ask for a
specific one: "what's the gaming news?", "any science headlines?", "tech news?".
```

- [ ] **Step 5: Verify the new commands run**

```bash
node --check features/news/newsFetcher.js
node -e "<paste the Step 2 README block verbatim>"   # run from skarn-bot/
```

Expected: `news parses + dedupes: true`.

- [ ] **Step 6: Commit**

From repo root `/Users/prime/Sites/Gems/anomaly-alpha`:

```bash
git add skarn-bot/README.md skarn-bot/CONTEXT.md skarn-bot/docs/NL-TOOLS.md
git commit -m "docs: document news overhaul smokes; mark implemented"
```

---

## Self-review

- **Spec coverage:** [S6]→T1; [S3]/[S4]/[S5]/[S8]/[S11-formats+ordering+dedupe+search+resilience]→T2; [S3-cadence]/[S11-cadence]→T3; [S7.1]/[S11-reader+skarn-mode]→T4; [S7.2]/[S11-on-demand]→T5; [S7.3]/[S7.4]/[S11-prompt-line]→T6; [S9]/docs→T7. [S1] problem context captured in header; [S2] out-of-scope items encoded as Global Constraints (no search fallback, no search command changes, no user prefs). [S10] non-goals are untouched by design. Every spec section has a task; every Covers: ID resolves.
- **Placeholders:** concrete code in every step; no "TBD". All smokes are offline + deterministic (fetch stubbed, temp DB) except the T2 Step 4 live feed check and the T7 boot check, which are explicitly live checks. One deliberate verify-then-adapt: T6 Step 2 notes the `buildContext` opts parameter name should be confirmed against the function signature before editing (the smoke then proves it).
- **Type consistency:** `fetchNews(category?) -> count` and `getRecentNews(limit, category?)` defined in T2, consumed identically in T3 (scheduler, count), T4 (news command, `getRecentNews(10, category)`), T5 (tool, `getRecentNews(5, category)` + `fetchNews(category)`), T6 (digest `getRecentNews(5)`, prompt `getRecentNews(3)`). `FEEDS` export (38 entries) used in T2 Step 4. `category` values are the constant set `tech|gaming|world|science|business` across T2 (registry), T4 (command choices + parseArgs), T5 (schema enum + runner). `published_at` column name consistent across T1 (migration/schema), T2 (inserts/selects), T4/T5/T6 smokes.
- **One risk checked:** the fresh-install migration path — schema.sql gets `published_at` AND migration v2 ALTERs the column. On a fresh DB, `CREATE TABLE IF NOT EXISTS` already includes the column, so migration v2's `ALTER TABLE ... ADD COLUMN` would fail with "duplicate column name". The T1 Step 3 fresh-path smoke would catch this — and the fix (if it occurs) is to make migration v2 conditional: check `PRAGMA table_info(daily_news)` for the column before ALTERing. This is the implementer's call; the smoke is the gate.

## Execution handoff

1. T1 (migration) → T2 (fetcher rewrite — the core) → T3 (cadence) → T4 (/news category) → T5 (tool category) → T6 (digest + prompt gate) → T7 (boot + docs), executed with the chosen sub-agent style (preference: `subagent`, saved 2026-08-02). After T2's live feed check and T7's boot check, a live manual QA pass — `@Skarn what's in the news`, `@Skarn any science news`, `/news category:world` — verifies the reader surfaces in-context.
