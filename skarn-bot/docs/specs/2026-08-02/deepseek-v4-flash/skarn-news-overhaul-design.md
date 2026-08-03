# Skarn News Overhaul — Design Spec

- **Date:** 2026-08-02
- **Status:** DESIGN — not implemented. No code changes yet (user: "review your spec and save it, then run grill with docs").
- **Audience:** agentic implementers + reviewers; meant to be grille-checked against skarn-bot docs before planning.
- **Related:** `CONTEXT.md` §2 (vertical slices), §4 (rate buckets); `skarn-bot/docs/specs/2026-08-02/deepseek-v4-flash/skarn-tool-invocation-design.md` (get_news tool arm); Railway production log 2026-08-02 (search-backend failures on the news path).

---

## [S1] Problem

Skarn's news does not work in real time and fetches few stories. Seven root causes, established by reading the code and reproducing live (2026-08-02):

1. **Search-first pipeline fails on Railway** — `fetchNews()` (`features/news/newsFetcher.js:61`) tries `searchWeb('tech and gaming news today')` (Google CSE → DuckDuckGo → Wikipedia) *first*, RSS only as a fallback. On Railway: Google CSE returns null (free-tier quota exhausted), DDG flags the shared datacenter IP ("anomaly"), and Wikipedia opensearch returns `[],[],[]` for compound queries (verified live). Production log: `All backends failed for query: tech and gaming news today` → `RSS fallback: 138 articles`.
2. **Search results are not news** — even when search works, it returns arbitrary tech web pages, not articles. The "news" is a web search for the hardcoded query `NEWS_QUERY = 'tech and gaming news today'` (`newsFetcher.js:4`).
3. **`MAX_ARTICLES = 10` truncates** — RSS parses 138 articles, `.slice(0, 10)` stores only 10, discarding 128 (`newsFetcher.js:94`).
4. **No publication date captured** — `parseRSSItems` (`newsFetcher.js:16`) drops `<pubDate>`; the table only stores `fetched_at` (fetch time). Ordering is by when Skarn fetched, not when the story published — "real time" is impossible.
5. **Hourly fetch + 24h prune** — scheduler fetches once/hour (`features/scheduler/index.js:50`), retention 24h by fetch time. Stories are an hour+ stale at read and vanish after 24h.
6. **Only 4 feeds, all tech/gaming** — HN, Verge, Ars, RockPaperShotgun (`RSS_FEEDS`, `newsFetcher.js:9`). No general/topical coverage.
7. **Every reader shares the shallow cache** — `/news`, the `get_news` tool, and the AI prompt context line (`promptContext.js:65`) all read `getRecentNews(10)`.

**Success criteria:**
1. `/news` and `@Skarn` news requests return real articles from dozens of live sources, not search results.
2. Stories are ordered by publication time (real-time feel) and retained ~72h.
3. Coverage spans 5 categories (tech, gaming, world, science, business), selectable by readers.
4. The AI-commentary mode ("Skarn's take") survives and reads from the richer data.
5. One feed going down (blocked IP, 404, 403) cannot sink the fetch — per-feed isolation.
6. No new user-facing errors; failure degrades to fewer categories, never a crash.

## [S2] Scope

- **In scope (V0):** rewrite `features/news/newsFetcher.js` (fetch/parse/store); add `category` option to `commands/news.js`; add optional `category` param to the `get_news` tool (schema + runner arm); category-label the digest (`features/news/newsDigest.js`); schema migration v2 (`published_at`); fresh-install schema update (`db/skarn-schema.sql`); scheduler cadence 60min → 15min; docs (README, CONTEXT.md).
- **Out of scope (V0):**
  - The search command/tool (`/search`, `search_web`) — `searchWeb` stays for search; only the *news path* drops it.
  - Per-user news preferences, saved favorites, or notification subscriptions.
  - Full-text search over the news cache (the `daily_news` table has no FTS and none is added).
  - AI summarization of individual articles on demand (the skarn mode summarizes the headline list, not article bodies).
  - News translation/localization.

## [S3] Architecture overview

A rewrite of the news vertical slice. `features/news/newsFetcher.js` owns fetch/parse/dedupe/store and exposes the same two functions it does today — `fetchNews(category?)` and `getRecentNews(limit, category?)` — so all existing consumers (`commands/news.js`, `features/news/newsDigest.js`, `features/tools/toolRunner.js`, `features/promptContext.js`) keep working with signature-compatible calls.

The overhauled pipeline:

```
38 validated RSS+Atom feeds (5 categories)
        │   parallel fetch (Promise.all, per-feed 8s timeout, redirect follow)
        ▼
   fetchFeed(url) → parse RSS <item> / Atom <entry> → {title, snippet, link, publishedAt}
        │   per-feed try/catch — one dead feed costs only that feed
        ▼
   dedupe by URL + normalized title across feeds
        ▼
   upsert into daily_news (published_at = publishedAt; migration wipes stale cache)
        ▼
   prune >72h by published_at    (no search fallback — dropped in grill Q3)
```

**Scheduler:** `setInterval(fetchNews, 15min)` in `features/scheduler/index.js:50-53` (was 60min); boot fetch kept; digest stays at 18:00.

## [S4] Feed registry (38 validated sources)

The registry is a module-level constant in `features/news/newsFetcher.js` — a flat array of `{ category, name, url }` entries. **All 38 URLs were tested live 2026-08-02** (HTTP 200, real items, pubDate present); failed candidates (IGN 404, Reuters agency 404, Bloomberg 403, Economist 403, Fox 400) are excluded. Some feeds 301/302 → the fetcher must use `redirect: 'follow'` (Node `fetch` default, made explicit).

| Category | Feeds (36) |
|---|---|
| **tech** (11) | Ars Technica, TechCrunch, BBC Technology, Engadget, Lifehacker, MacRumors, Gizmodo, 9to5Mac, Android Authority, The Verge (Atom), CNET (Atom) |
| **gaming** (6) | RockPaperShotgun, Polygon, PC Gamer, Eurogamer, GameSpot, Kotaku |
| **world** (9) | BBC World, Al Jazeera, NYT World, Guardian World, CBS World, ABC News, NPR, SCMP, France 24 |
| **science** (7) | ScienceDaily, Phys.org, NASA, Space.com, Quanta Magazine, Science News, New Scientist |
| **business** (5) | CNBC, MarketWatch, WSJ Markets, Forbes Innovation, Forbes Business |

Exact URLs are captured in the implementation plan (plan task T1); the registry is the single source of truth for feeds, matching the "one hand-edited source" convention.

## [S5] Fetch, parse, dedupe, store

1. **`fetchNews(category?)`** — if a category is given, fetch only that category's feeds (used by the tool's category param); otherwise all 36. `Promise.all` over feeds, each wrapped in its own try/catch with `AbortSignal.timeout(8000)`.
2. **`fetchFeed(url)`** — GET with `User-Agent: SkarnBot/1.0 (news-fetch)` + `redirect: 'follow'`. Detect format by root element: RSS (`<item>`) or Atom (`<entry>`). Parse to a normalized `{ title, snippet, link, publishedAt }`:
   - RSS: `<title>`, `<description>` (HTML-stripped), `<link>`, `<pubDate>`.
   - Atom: `<title>`, `<summary>`, `<link rel="alternate" href>`, `<published>` (fall back to `<updated>`).
   - `publishedAt` = `Date.parse(...)` in ms; feeds with no parseable date get `publishedAt = Date.now()` (fetch time) so they still appear, sorted last.
3. **Dedupe** across all fetched feeds: skip items whose URL matches an already-seen URL, or whose normalized title (lowercased, first 60 chars) matches. This is an upgrade of the existing 40-char-title dedupe with a URL check.
4. **Upsert** into `daily_news`: on new URL → INSERT with `published_at`; on existing URL → UPDATE snippet/headline (refresh). Bound by `MAX_ARTICLES = 200` (was 10).
5. **Prune** `DELETE FROM daily_news WHERE published_at < now - 72h` (was 24h by fetched_at).
6. **No search fallback** (grill Q3): with 38 feeds the all-fail case is effectively unreachable, and search results were the root-cause bug. If every feed fails, `fetchNews` returns 0 and readers see the fail-open strings. `newsFetcher.js` no longer imports `searchEngine` (the search command/tool keep their own `searchWeb` usage).

**`getRecentNews(limit, category?)`** — `WHERE category = ?` when given, `ORDER BY published_at DESC LIMIT ?`. Existing callers pass no category → mixed, newest-first.

## [S6] Schema migration v2

`db/migrations.js` gains migration v2 `add_daily_news_published_at`:

```sql
DELETE FROM daily_news;                        -- stale search-era cache; repopulated by next fetch (grill Q2)
ALTER TABLE daily_news ADD COLUMN published_at INTEGER;
```

Idempotent via the existing `user_version` mechanism (migration framework at `db/migrations.js:14-25`). `db/skarn-schema.sql` (fresh installs) adds `published_at INTEGER` to the `CREATE TABLE IF NOT EXISTS daily_news` definition — fresh DBs get the column directly, existing DBs via the migration. Retention, cap, and indexes: `idx_daily_news_fetched` and `idx_daily_news_category` remain; ordering reads use `published_at` (a new index on `(category, published_at)` is optional — the table is ≤200 rows, so not required for V0).

## [S7] Reader surfaces

1. **`/news`** (`commands/news.js`) — add a `category` string option: tech / gaming / world / science / business (default: top-mixed). Raw mode lists up to 10 per category (was 5 mixed). Skarn AI mode picks top 3 from the chosen category + commentary (unchanged mechanism, `roles.search` + persona). Activation phrase `skarn news` gains `skarn news <category>` parsing. Empty-category guard: "No <category> news cached yet."
2. **`get_news` tool** — schema (`features/tools/toolDefinitions.js`) gains optional `category` param with the 5 choices; runner arm (`features/tools/toolRunner.js`) passes it to `getRecentNews(5, category)`; on empty category cache, triggers `fetchNews(category)` once then re-reads (grill Q5 — on-demand category fetch kept; the latency trade is accepted since a category fetch is only 2-11 feeds). Privacy: no change (no user data involved).
3. **`postDigest`** (`features/news/newsDigest.js`) — top 5 mixed stories, each line category-labeled (e.g. `[tech] headline`). Same 18:00 schedule.
4. **`promptContext.js:65` — intent-gated news line (grill Q1):** the news line is injected only when the user's message looks news-related (a keyword check for "news", "headline", "happening", current-events terms — the same trigger pattern the socratic engine uses), and capped at **3** headlines. This keeps headline tokens off the hot path of every AI call and makes the injection relevant when it fires. Skarn's "own style" comes from this line + the skarn AI mode: headlines are data, voice is persona.

## [S8] Error handling & safety

- **Per-feed isolation:** each feed fetch is its own try/catch; one dead/blocked feed logs a line and the batch continues. This is the direct answer to the Railway-datacenter-IP concern: a Railway-side block of one host costs only that feed.
- **Never throws into the scheduler:** `fetchNews` returns a count (0 on total failure) — existing call sites already `.catch(() => {})`.
- **Fail-open reads:** empty cache / empty category → "No news cached yet" strings (existing behavior, category-aware wording).
- **No new user-facing error strings** introduced; the digest/skarn fallback-to-raw path stays.
- **Rate-limit note:** 38 parallel fetches every 15 min is ~3,500 requests/day against public RSS hosts. Feeds are designed for this cadence, but per-feed timeout (8s) + isolation means a 403/429 from one host doesn't cascade. CONTEXT.md §4's separate-buckets rule applies to AI calls, not plain HTTP fetches (same as wttr.in / search fallback today).

## [S9] Verification (project convention: no test framework — node -e smokes)

The project is deliberately test-free (CONTEXT.md §11.2). Verify via `node --check` + `node -e` smoke with a `SKARN_DB_PATH` temp DB:

- `node --check` on all changed files (`newsFetcher.js`, `newsDigest.js`, `commands/news.js`, `toolDefinitions.js`, `toolRunner.js`, `db/migrations.js`).
- **Parser smoke (offline, stubbed XML):** feed a canned RSS `<item>` block (with `<pubDate>`) and a canned Atom `<entry>` block (with `<published>`) into the parser; assert normalized `{title, snippet, link, publishedAt}` and that the RSS date parses (not `Date.now()`).
- **Fetch smoke (offline, stubbed `fetchFeed`):** monkey-patch `fetchFeed` to return canned items (including one duplicate URL and one duplicate title across "feeds"); run `fetchNews()`; assert: dedupe removed both dupes, upsert inserted the rest, `published_at` populated, 72h prune removes a stubbed-old row, category filter (`getRecentNews(5, 'tech')`) returns only tech.
- **Migration smoke:** run migrations against a temp DB; assert `user_version = 2`, `daily_news` has `published_at`, and the stale cache was wiped (0 rows).
- **Tool smoke:** `runTool('get_news', { category: 'science' })` with stubbed `getRecentNews`/`fetchNews` returns category-scoped lines; empty-category on-demand fetch path exercised.
- **Live feed-fetch check:** `node -e "require('./features/news/newsFetcher').fetchNews().then(c => console.log(c))"` — the same call Railway will run — asserting >0 articles from the real feeds. (This machine ≠ Railway's IP; the definitive Railway check happens after deploy, but this catches dead feeds/parser bugs.)
- **Boot check:** `node bot.js` boots without load errors.

## [S10] Non-goals / deferred

- Per-user news preferences / subscriptions / saved articles.
- FTS over the news cache; article-body retrieval or per-article AI summaries.
- Localization/translation; per-region or per-language feed selection.
- Search command/tool changes (`searchWeb` is untouched; only the news path drops it).
- News push-notifications or per-guild digest scheduling config (digest stays fixed 18:00).

---

## [S11] Resolved decisions (brainstorming, 2026-08-02)

Locked during brainstorming; do not silently reverse them (re-grill first if a later pass conflicts):

| Decision | Locked answer |
|---|---|
| Scope | **Multi-category real RSS** — not search results, not tech-only. |
| Approach | **A — Full overhaul + migration**: RSS-primary, `published_at` column, category column, parallel fetch, 200/72h retention. |
| Feed count | **38 validated sources** across 5 categories (tech 11, gaming 6, world 9, science 7, business 5). All URL-tested live 2026-08-02. |
| Cadence | Fetch **every 15 min** (was 60), boot fetch kept, digest stays 18:00. |
| Retention | **72h** by `published_at` (was 24h by fetched_at); cap **200** (was 10). |
| Formats | Parse **both RSS `<item>` and Atom `<entry>`** (Verge/CNET are Atom); normalize to `{title, snippet, link, publishedAt}`. |
| Ordering | Reads ordered by **`published_at` DESC** — real-time feel; undated items sort last with `publishedAt = now`. |
| Search role | **Dropped entirely from the news path** (grill Q3) — with 38 feeds the all-fail case is effectively unreachable; search results were the root-cause bug. `newsFetcher.js` no longer imports `searchEngine`; the search command/tool are untouched. |
| Railway resilience | **Per-feed isolation** (individual try/catch + 8s timeout + redirect follow); one blocked feed costs only that feed. |
| Reader surfaces | `/news` gains `category` option (raw lists 10/cat, skarn mode picks from newest 10 of category); `get_news` tool gains optional `category` + keeps on-demand category fetch on empty cache (grill Q5, latency trade accepted); digest lines category-labeled. |
| Prompt news line | **Intent-gated, cap 3** (grill Q1) — `promptContext.js` injects top-3 headlines only when the message looks news-related (keyword check, like the socratic trigger); keeps cost off the hot path and the line relevant when it fires. |
| Migration data | **Wipe `daily_news` in migration v2** (grill Q2) — it's a cache, not user data; the next 15-min fetch repopulates from real feeds. No stale search-result rows linger in the new cache. |
| Dedupe | **URL then normalized-title-60** (grill Q4) — exact URL wins; title fallback (first 60 chars, lowercased, alphanumerics-only) catches syndicated copies across the 38 overlapping sources. |
| Skarn AI mode | **Model picks from newest 10** of the category (grill Q6) — preserves Skarn's editorial judgment; same mechanism as today, category-scoped. |
| AI style | Skarn's voice comes from the existing skarn AI mode + persona — headlines are data, voice is persona. |

---

## Source anchors (for downstream plan `Covers:`)

Consumed by `compose:plan`. Section IDs `[S1]`–`[S11]` are stable — do not renumber on later rewordings.
