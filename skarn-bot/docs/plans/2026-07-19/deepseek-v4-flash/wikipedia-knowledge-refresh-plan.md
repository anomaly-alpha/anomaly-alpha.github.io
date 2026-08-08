# Wikipedia Knowledge Base Daily Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static 117-topic knowledge seed with a daily Wikipedia fetch of ~1000 most-viewed articles, with background loading and 24h cooldown.

**Architecture:** Two files changed: `knowledgeSeeder.js` (add Wikipedia fetch + cooldown logic) and `knowledgeBase.js` (remove 4-char word filter). Keep existing 117 topics as fallback. Use `app_state` table for cooldown timestamp.

**Tech Stack:** Node.js, node-fetch, SQLite (via better-sqlite3), Wikipedia API

## Global Constraints

- All state in SQLite — no in-memory Maps or JSON files
- `node-fetch` v2.7.0 already available as dependency
- `addKnowledgeBase()` already handles upserts via `ON CONFLICT(topic) DO UPDATE`
- `getAppState`/`setAppState` already exported from `database.js`
- Background fetch — bot startup must not block on Wikipedia API
- Wikipedia rate limit: be conservative with API calls

---

### Task 1: Remove 4-char word filter from knowledge search

**Covers:** [S3]

**Files:**
- Modify: `skarn-bot/features/knowledge/knowledgeBase.js:6`

**Interfaces:**
- Consumes: user message text
- Produces: FTS5 query string (now allows any word length)

- [ ] **Step 1: Remove the word length filter**

```js
// Line 6 — change from:
.filter(w => w.length > 3);
// to:
.filter(w => w.length > 0);
```

- [ ] **Step 2: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./features/knowledge/knowledgeBase')"`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add skarn-bot/features/knowledge/knowledgeBase.js
git commit -m "fix(knowledge): remove 4-char word filter to match acronyms"
```

---

### Task 2: Add Wikipedia fetch function to knowledgeSeeder

**Covers:** [S3], [S4]

**Files:**
- Modify: `skarn-bot/features/knowledge/knowledgeSeeder.js:1-151`

**Interfaces:**
- Consumes: Wikipedia Most Viewed API + Summary API
- Produces: `fetchWikipediaTopics()` async function returning topic count

- [ ] **Step 1: Add node-fetch import at top of file**

```js
const fetch = require('node-fetch');
```

- [ ] **Step 2: Rename SEED_TOPICS to FALLBACK_TOPICS**

```js
// Line 3 — change from:
const SEED_TOPICS = [
// to:
const FALLBACK_TOPICS = [
```

- [ ] **Step 3: Add fetchWikipediaTopics function after FALLBACK_TOPICS array**

Add the following function after the closing `];` of FALLBACK_TOPICS (after line 138):

```js
const WIKI_MOST_VIEWED = 'https://en.wikipedia.org/w/api.php?action=query&list=mostviewed&format=json';
const WIKI_SUMMARY = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&exlimit=50&format=json';
const SKIP_PREFIXES = ['Special:', 'Main Page', 'Wikipedia:', 'Help:', 'File:', 'Talk:', 'User:', 'Template:', 'Category:', 'Portal:'];

async function fetchWikipediaTopics() {
  let titles = [];

  // Fetch page 1 (0-499)
  try {
    const res1 = await fetch(`${WIKI_MOST_VIEWED}&pvimlimit=500`);
    const data1 = await res1.json();
    titles.push(...(data1.query?.mostviewed || []));
  } catch (e) {
    console.log(`[Knowledge] Wikipedia page 1 fetch failed: ${e.message}`);
    return 0;
  }

  // Fetch page 2 (500-999)
  try {
    const res2 = await fetch(`${WIKI_MOST_VIEWED}&pvimlimit=500&pvoffset=500`);
    const data2 = await res2.json();
    titles.push(...(data2.query?.mostviewed || []));
  } catch (e) {
    console.log(`[Knowledge] Wikipedia page 2 fetch failed: ${e.message}`);
  }

  // Filter non-article pages
  titles = titles.filter(t => !SKIP_PREFIXES.some(p => t.title.startsWith(p)));
  titles = titles.map(t => t.title);

  // Batch and fetch summaries
  let count = 0;
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    try {
      const url = `${WIKI_SUMMARY}&titles=${encodeURIComponent(batch.join('|'))}`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (page.extract && page.title) {
          const topic = page.title.toLowerCase().replace(/_/g, ' ');
          addKnowledgeBase(topic, page.extract, 'wikipedia', 0.9);
          count++;
        }
      }
    } catch (e) {
      console.log(`[Knowledge] Wikipedia batch ${i} failed: ${e.message}`);
    }
  }

  return count;
}
```

- [ ] **Step 4: Update seedKnowledgeBase to use background fetch**

Replace the existing `seedKnowledgeBase()` function (lines 140-149) with:

```js
function seedFallbackTopics() {
  let count = 0;
  for (const t of FALLBACK_TOPICS) {
    try {
      addKnowledgeBase(t.topic, t.summary, t.source, t.confidence);
      count++;
    } catch {}
  }
  return count;
}

function seedKnowledgeBase() {
  const fallbackCount = seedFallbackTopics();

  const lastSeed = getAppState('last_wikipedia_seed');
  if (lastSeed) {
    const hoursSince = (Date.now() - parseInt(lastSeed, 10)) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      console.log(`[Knowledge] Using cached data (last seed: ${Math.round(hoursSince)}h ago)`);
      return;
    }
  }

  console.log(`[Knowledge] Seeded ${fallbackCount} fallback topics, fetching Wikipedia...`);
  fetchWikipediaTopics().then(wikiCount => {
    setAppState('last_wikipedia_seed', Date.now().toString());
    console.log(`[Knowledge] Wikipedia fetch complete: ${wikiCount} topics added`);
  }).catch(e => {
    console.log(`[Knowledge] Wikipedia fetch failed: ${e.message}`);
  });
}
```

- [ ] **Step 5: Add imports for getAppState and setAppState**

At the top of the file, after line 1, add:

```js
const { getAppState, setAppState } = require('../../db/database');
```

- [ ] **Step 6: Update module.exports**

```js
// Line 151 — change from:
module.exports = { seedKnowledgeBase };
// to:
module.exports = { seedKnowledgeBase, seedFallbackTopics, fetchWikipediaTopics };
```

- [ ] **Step 7: Verify no import errors**

Run: `cd skarn-bot && node -e "require('./features/knowledge/knowledgeSeeder')"`
Expected: no output (no errors)

- [ ] **Step 8: Commit**

```bash
git add skarn-bot/features/knowledge/knowledgeSeeder.js
git commit -m "feat(knowledge): add daily Wikipedia fetch with 24h cooldown"
```

---

### Task 3: Verify full bot startup with Wikipedia fetch

**Covers:** [S5], [S6]

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: bot.js startup sequence
- Produces: logs confirming knowledge seeding

- [ ] **Step 1: Start bot and observe logs**

Run: `cd skarn-bot && node bot.js`
Expected logs:
- `[Knowledge] Seeded 117 fallback topics, fetching Wikipedia...`
- Bot logs in successfully
- After a few seconds: `[Knowledge] Wikipedia fetch complete: N topics added`

- [ ] **Step 2: Restart bot within 24h**

Stop bot, then restart: `cd skarn-bot && node bot.js`
Expected logs:
- `[Knowledge] Seeded 117 fallback topics, fetching Wikipedia...`
- `[Knowledge] Using cached data (last seed: Xh ago)`
- No Wikipedia API calls

- [ ] **Step 3: Verify app_state table**

Run: `cd skarn-bot && node -e "const {db} = require('./db/database'); console.log(db.prepare('SELECT * FROM app_state WHERE key = ?').get('last_wikipedia_seed'))"`
Expected: row with `key: 'last_wikipedia_seed'` and recent timestamp

- [ ] **Step 4: Force re-fetch by deleting cooldown**

Run: `cd skarn-bot && node -e "const {db} = require('./db/database'); db.prepare('DELETE FROM app_state WHERE key = ?').run('last_wikipedia_seed'); console.log('Deleted')"`
Then restart bot — should re-fetch Wikipedia topics
