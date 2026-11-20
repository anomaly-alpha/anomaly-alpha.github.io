# Skarn Analytics Query Surface — Design Spec

**Status:** **PARKED 2026-11-14 (owner decision). Do not implement as written.**
**Date:** 2026-11-14
**Surface:** `skarn-bot/` (Railway) + one small change in the root site project
**Sources:** Search Console API v1, Google Analytics Data API v1beta, Railway docs (all cited in §13)

---

## ⚠️ Read this first — known defects (adversarial review, 2026-11-14)

This spec was reviewed against the code and data the same day it was written. Four claims are
**false** and would break an implementation that follows them literally. Fix these before using
anything below.

| # | Defect | Reality |
|---|---|---|
| B1 | §6.3 says `maxTurns = 3` permits ≤2 tool rounds and shows a two-report chain | `sharedPipeline.js:202` attaches `tools` only when `turnCount === 1`, so **exactly one** tool round is possible. A second `tool_calls` can never be emitted. |
| B2 | §6.1 offers `days: 7\|28\|90` for all 14 reports | §4.3 stores dimension rows for a **single rolling 28-day window**. `days:7`/`days:90` would serve 28-day data under a different footer — violating this spec's own G1. |
| B3 | §4.4 prunes stale windows table-globally "after any dataset failure, keep prior data" | The prune deletes the last good window even when that dataset's upsert failed, and makes the P2 two-window `insight` impossible. |
| B4 | §15 Q3 assumes `sc-domain:anomaly-alpha.github.io` | The property is **URL-prefix**: `https://anomaly-alpha.github.io/` (`scripts/pull-gsc.js:7`, also `summary.json.site`). `sc-domain:` 404s. |

Also: the natural-language path cannot render an embed (§6.4/D7 assume it can — `runTool` only
returns text into the prompt), the AI gate takes a `surface` argument rather than a command name,
`sort`/`filter` binding and ORDER BY whitelisting are unspecified (injection surface), timezone
handling between GSC-PT / GA4-property-TZ / UTC is absent, and the tool schema omits `sort`,
`metric` and `fresh`.

**Corrected reference values** (superseding anything in the companion doc):
`periods.current = 2026-10-15..2026-11-11`; `totals.current = 7,883 clicks / 42,875 impressions /
18.39% / 4.13`; `invincible gtg codes` over 28 days = `1,083 / 2,077 / 52.1% / 1.18` (the
`3,822 / 9,043 / 42.3% / 2.09` figure is the **181-day** window, not 28).

---

## 1. Goal

Skarn keeps chatting exactly as he does now. Added to that, he gains the ability to answer
questions about **the site's own search and traffic numbers** — either when asked in natural
language during normal conversation, or via an explicit slash command.

The design constraint that shapes everything else: **the model must never invent a query.**
Google's two APIs have strict, asymmetric rules (invalid dimension combinations, cost classes,
row caps, thresholding). A model writing `searchanalytics.query` parameters from scratch will
generate invalid or expensive requests. So the surface is a **fixed catalog of 14 named
reports**, and both the slash command and the AI tool are thin adapters over that one catalog.

Non-goals: no dashboards, no scheduled digests, no write operations (no sitemap submission, no
property management), no per-user analytics, no revenue.

---

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Hybrid data path**: nightly sync into SQLite + on-demand live API for uncached/recent queries | Nightly gives instant answers, is cheap, and survives a revoked key. Live covers the 2–3 day GSC lag tail and ad-hoc questions. |
| D2 | **A dedicated service account for the bot**, not a reuse of `ga4-reader@anomaly-alpha-gsc` | Revocation isolation. If the Railway variable leaks, revoke one key without breaking the local pullers. |
| D3 | **One env var, `GOOGLE_SERVICE_ACCOUNT_JSON`** (raw JSON or base64; both accepted) | Railway supports multiline variables natively, but CLI piping mangles newlines. Accepting either makes both upload paths safe. |
| D4 | **No `googleapis` dependency.** Node `crypto` + `https` only, mirroring `scripts/lib/google-auth.js` | `googleapis` is a heavy dependency in a package that already ships `better-sqlite3` and `canvas` (native builds). The repo already hand-mints RS256 JWTs; this is proven code. |
| D5 | **Never persist or echo credential material.** No path, no basename, no key in any DB row or reply | A past incident wrote an absolute credential path into `data/gsc-api/*/meta.json`. Rail guards prevent a repeat. |
| D6 | **Anyone who can already talk to Skarn can ask** (owner ruling, 2026-11-14) | The data is public: it describes an open-source site, no personal data. Abuse is bounded by the existing AI gate, per-user rate limit, and per-guild budget. |
| D7 | **Numbers live in an embed; prose stays in voice** | Skarn's voice contract forbids long answers and exclamation marks. A tool result containing 20 rows must not be narrated. The embed carries data, the model writes ≤2 sentences. |
| D8 | **Bootstrap from the public snapshots** (`https://anomaly-alpha.github.io/data/gsc-api/<date>/`) | The GSC exports are already committed and served. First boot fills the tables with **zero credentials**, so `/analytics` works before the key is ever set. |
| D9 | **`analytics` is added to `EXCLUDED_COMMANDS`** in `toolDefinitions.js` | The model must use the dedicated `site_analytics` tool, not `run_command`, to avoid two code paths producing different numbers. |
| D10 | **SQLite on the existing Railway volume, not a new Postgres** (owner ruling, 2026-11-14) | The volume at `/app/data` already holds `skarn.db` (0.4 GB of 4.9 GB used). One bot process, one writer. Postgres buys nothing until a second service needs the same tables. |

---

## 3. Authentication on Railway

### 3.1 What exists today

- Local pulls authenticate with a service-account key at `%APPDATA%\gcloud\service-account.json`, resolved by `scripts/lib/google-auth.js` (`--key` → `GOOGLE_APPLICATION_CREDENTIALS` → `%APPDATA%` → `~/.config/gcloud`). It refuses any credential whose `type` is not `service_account`.
- Railway's env already carries Google credentials of a different kind: `GOOGLE_CSE_KEY` / `GOOGLE_CSE_CX` (the retired Programmable Search key). Precedent exists for holding a Google secret in Railway variables.
- The Railway service `anomaly-alpha.github.io` (project `cozy-miracle`, environment `production`) has a **volume mounted at `/app/data`** and `SKARN_DB_PATH` resolves there.

### 3.2 What to add

**Step 1 — create a bot-scoped service account.** In project `anomaly-alpha-gsc`:

```
gcloud iam service-accounts create skarn-analytics \
  --display-name="Skarn Discord bot — analytics read-only"
```

**Step 2 — grant access in two places (both are UI-only, neither can be done via API by the SA):**

| Target | Grant | Why |
|---|---|---|
| Search Console property (the site) | Add `skarn-analytics@…iam.gserviceaccount.com` as a user with **Full** | `Full` covers `searchAnalytics`, `sitemaps.list`, and `urlInspection`. A service account cannot verify or own a property, so it can only ever be an added user. |
| GA4 property `541253821` | **Viewer** | Read-only reporting. Matches the existing `ga4-reader` grant. |

**Step 3 — enable the two APIs** in the GCP project: `searchconsole.googleapis.com`, `analyticsdata.googleapis.com`.

**Step 4 — put the key in Railway.** Preferred (dashboard): create the variable in the Raw
Editor and paste the JSON verbatim — multiline values are supported. Alternative (CLI):

```bash
railway variable set --stdin GOOGLE_SERVICE_ACCOUNT_JSON < service-account.json
```

Do **not** use `railway variable set KEY="$(cat file.json)"`; shell substitution plus CLI
quoting is the path that mangles newlines. The loader accepts base64 as a fallback
(`GOOGLE_SERVICE_ACCOUNT_B64`) for exactly this case.

**Step 5 — do not seal it.** Sealed variables are withheld from `railway variable list` and
`railway run`, which makes the one debugging session you will actually need impossible. The
value is a read-only analytics key scoped to a public site; the friction is not worth it. If
you disagree, seal it and accept that local debugging must go through `railway ssh`.

### 3.3 Why not "auth on Railway the way it's authed here"

The local setup cannot be transplanted, for two independent reasons:

1. **File path resolution does not exist in the container.** `%APPDATA%` is Windows-only, and nothing outside `skarn-bot/` is in the Railway build context — the service's Root Directory is `/skarn-bot`. A key on `C:\…` is unreachable by definition.
2. **ADC was retired** (project ruling, 2026-11-07). The OAuth client is unverified/Testing, so `analytics.readonly` is blocked outright and its refresh token expires weekly. Only a service-account key works — which is exactly what the local pullers already use, just delivered by environment variable instead of by disk.

The credential **type** is therefore identical on both machines; only the delivery differs.

### 3.4 Loading, minting, caching

New module `skarn-bot/features/analytics/googleAuth.js`, a port of the root
`scripts/lib/google-auth.js` with the file lookup replaced by an env lookup:

```
getAccessToken(scope) →
  1. in-memory cache hit (keyed by scope), token still > 120 s from expiry  → return
  2. parse GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON if it starts with "{", else base64-decode)
  3. assert type === 'service_account', client_email + private_key present
  4. sign RS256 JWT  {iss, scope, aud:'https://oauth2.googleapis.com/token', iat, exp:+3600}
  5. POST grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer to the token endpoint
  6. cache {token, expiresAt} and return
```

Rules: never `console.log` the credential object; if a parse error must be surfaced, emit the
error message with the key material stripped; cache is process-local and intentionally lost on
restart (no token is ever written to disk).

**Duplication is deliberate and must be documented in code.** `skarn-bot/features/analytics/googleAuth.js`
and `scripts/lib/google-auth.js` are two copies of one algorithm, separated by the Railway build
boundary. A header comment in both files must point at the other and state that a scope or
claim change has to be made in both.

---

## 4. Data architecture

### 4.1 Route by report, not by request

| Route | Reports | Source | Latency |
|---|---|---|---|
| `cached` | overview, queries, pages, trend, compare, countries, devices, appearance, traffic, landing, events | SQLite tables in §4.2 | <50 ms |
| `live` | anything with `fresh:true`, any window the cache does not cover, `inspect` | Google API | 300–1500 ms |
| `local` | status | SQLite + env introspection | <20 ms |

`fresh:true` is opt-in per call and always names its cost in the footer (`live · GSC · final through 2026-11-12`).
Default is cached: the Search Console **load quota** punishes repeated page+query grouping within
a 10-minute bucket, and nightly data is 2–3 days old anyway.

### 4.2 Schema (migration 8)

Added to `db/skarn-schema.sql` **and** as migration version 8 in `db/migrations.js`, both guarded
by `IF NOT EXISTS` (the repo's established belt-and-braces pattern — fresh DBs get tables from
the schema file, existing DBs from the migration).

```sql
-- GSC: one row per day, no dimensions (cheap, complete)
CREATE TABLE IF NOT EXISTS analytics_gsc_daily (
  date TEXT PRIMARY KEY,
  clicks REAL NOT NULL, impressions REAL NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL,
  synced_at INTEGER NOT NULL
);

-- GSC: one row per (window, dimension, key). dimension ∈ query|page|country|device
CREATE TABLE IF NOT EXISTS analytics_gsc_dim (
  window_start TEXT NOT NULL, window_end TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('query','page','country','device')),
  key TEXT NOT NULL,
  clicks REAL NOT NULL, impressions REAL NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (window_start, window_end, dimension, key)
);
CREATE INDEX IF NOT EXISTS idx_analytics_gsc_dim_lookup
  ON analytics_gsc_dim(dimension, window_end, clicks DESC);

-- GSC: query↔page pairs for a single window only (the most expensive load class)
CREATE TABLE IF NOT EXISTS analytics_gsc_query_page (
  window_start TEXT NOT NULL, window_end TEXT NOT NULL, query TEXT NOT NULL, page TEXT NOT NULL,
  clicks REAL NOT NULL, impressions REAL NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (window_start, window_end, query, page)
);

CREATE TABLE IF NOT EXISTS analytics_gsc_appearance (
  window_start TEXT NOT NULL, window_end TEXT NOT NULL, appearance TEXT NOT NULL,
  clicks REAL NOT NULL, impressions REAL NOT NULL, ctr REAL NOT NULL, position REAL NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (window_start, window_end, appearance)
);

-- GSC: URL Inspection results are cached per URL; the API allows 2,000/day
CREATE TABLE IF NOT EXISTS analytics_gsc_inspection (
  url TEXT PRIMARY KEY,
  verdict TEXT, coverage_state TEXT, robots_txt_state TEXT, indexing_state TEXT,
  page_fetch_state TEXT, crawled_as TEXT, last_crawl_time TEXT,
  google_canonical TEXT, user_canonical TEXT, canonical_matches INTEGER,
  rich_results_verdict TEXT, rich_result_types TEXT, rich_result_issues TEXT,
  checked_at INTEGER NOT NULL, error TEXT
);

CREATE TABLE IF NOT EXISTS analytics_gsc_sitemap (
  path TEXT PRIMARY KEY, last_submitted TEXT, is_pending INTEGER, is_index INTEGER,
  warnings INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL
);

-- GA4: daily traffic split by channel group
CREATE TABLE IF NOT EXISTS analytics_ga4_daily (
  date TEXT NOT NULL, channel_group TEXT NOT NULL,
  sessions REAL, total_users REAL, new_users REAL, page_views REAL, engaged_sessions REAL,
  engagement_rate REAL, avg_session_duration REAL, bounce_rate REAL, key_events REAL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (date, channel_group)
);

-- GA4: one row per (window, dimension, key). dimension ∈ page_path|event|country|device|source
CREATE TABLE IF NOT EXISTS analytics_ga4_dim (
  window_start TEXT NOT NULL, window_end TEXT NOT NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('page_path','event','country','device','source')),
  key TEXT NOT NULL,
  sessions REAL, total_users REAL, page_views REAL, event_count REAL, key_events REAL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (window_start, window_end, dimension, key)
);

CREATE TABLE IF NOT EXISTS analytics_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,            -- 'gsc' | 'ga4' | 'bootstrap'
  started_at INTEGER NOT NULL, finished_at INTEGER,
  ok INTEGER NOT NULL DEFAULT 0, rows INTEGER, detail TEXT, error TEXT
);
```

**No credential column exists anywhere.** That is D5 made structural.

### 4.3 What is stored, and why the windows are shaped this way

- **GSC daily**: the whole 16-month-ish history that the API returns for `dimensions:['date']`, ~180 rows. Trivial.
- **GSC dimension rows for a single rolling 28-day window**, refreshed nightly. Storing per-date×per-query for full history would blow the **50,000 rows/day/search-type** cap and the volume, and nobody asks "top queries on 8 March". The 28-day window answers the question people actually ask.
- **Query↔page pairs for 7 days only.** This is the most expensive load class Google documents; one weekly refresh is the budget.
- **GA4**: 90 days of daily rows (small), 28-day windows for page/event/country/device/source.

### 4.4 Nightly sync

`features/analytics/sync.js`, wired into `features/scheduler/index.js` with the existing
`safeRun` helper: one boot run plus a 24-hour `setInterval` (the `generateLoreBatch` pattern).

```
runAnalyticsSync({ force })
  ├─ today   = UTC date
  ├─ gscEnd  = today − 2      (GSC finalises after 2–3 days)
  ├─ ga4End  = today − 1
  ├─ for each dataset:  fetch → upsert (INSERT … ON CONFLICT DO UPDATE) → 1 sync_log row
  ├─ delete dimension rows whose window_end is not the current window (bounded table growth)
  └─ on any single-dataset failure: log, keep prior data, mark the log row ok=0, continue
```

Idempotence: every write is an upsert keyed by the primary key above, so a redeploy mid-sync is
harmless. A deleted upstream row (e.g. a sitemap removed) is handled by the window-prune step, not
by diffing.

### 4.5 Bootstrap from the public snapshots

First boot on an empty DB, or after `force`:

```
GET https://anomaly-alpha.github.io/data/gsc-api/latest.json   → {"date":"2026-11-13"}
GET .../data/gsc-api/<date>/summary.json        → headline totals + periods
GET .../data/gsc-api/<date>/daily-full.json     → analytics_gsc_daily
GET .../data/gsc-api/<date>/queries-full.json   → analytics_gsc_dim (dimension='query', window=full period)
GET .../data/gsc-api/<date>/pages-full.json     → dimension='page'
GET .../data/gsc-api/<date>/countries-full.json → dimension='country'
GET .../data/gsc-api/<date>/devices-full.json   → dimension='device'
GET .../data/gsc-api/<date>/search-appearance-full.json → appearance
GET .../data/gsc-api/<date>/sitemaps.json       → sitemap
GET .../data/gsc-api/<date>/url-inspection.json → inspection
```

`latest.json` does not exist yet — **prerequisite change in the root project** (§9): teach
`scripts/pull-gsc.js` to write a one-line pointer file. Until then the bootstrap date comes from
`ANALYTICS_SNAPSHOT_DATE`, and the bot degrades to live-only.

This is why the feature is useful on day one: the GSC half works with no credential at all.

---

## 5. The report catalog

One file, `features/analytics/catalog.js`, is the single source of truth. Each entry:

```js
{
  id: 'queries',
  group: 'search',                     // search | traffic | diagnostics | system
  summary: 'Top search queries by clicks',   // slash-command description
  params: ['days', 'limit', 'sort', 'contains'],
  route: 'cached',
  source: 'gsc',
  gsc: { dimensions: ['query'], type: 'web' },   // null for ga4/local reports
  ga4: null,
  render: 'table',                     // table | series | keyvalue | footer
}
```

### 5.1 Search Console reports

| id | Params | API call | Notes |
|---|---|---|---|
| `overview` | `days` | GSC: `['date']`; GA4: channel group | Headline 4 GSC metrics + 2 GA4, each with period delta. The default answer. |
| `queries` | `days`, `limit`, `sort` (clicks\|impressions\|ctr\|position), `contains` | `['query']` | `contains` becomes a `dimensionFilterGroups` filter. `sort` is applied locally over the cached window (never affects the API call). |
| `pages` | `days`, `limit`, `sort`, `contains` | `['page']` | URLs are trimmed to paths for display; combined across `https://` and `http://`? **No** — GSC reports the canonical URL only, do not merge. |
| `trend` | `days`, `metric` | `['date']` | One row per day, ascending. Renders an inline sparkline via block characters. |
| `compare` | `days` (7/28/90) | `['date']` twice, or one call + local split | Current window vs the immediately preceding equal-length window. |
| `countries` | `days`, `limit` | `['country']` | Country names as GSC returns them (`usa`, `gbr`, …) — display-uppercased, never geocoded. |
| `devices` | `days` | `['device']` | `MOBILE` / `DESKTOP` / `TABLET`. |
| `appearance` | `days` | `['search_appearance']` | **This dimension must be the only one in the request.** Rich-result issues come from the cached `url-inspection` rows, joined by URL. |
| `inspect` | `url` (required) | `urlInspection.index.inspect` | Live only. Cached per URL for 7 days; re-inspect is explicit. Quota: 2,000/day, 600/min per property. |
| `sitemaps` | — | `sitemaps.list` | Warning/error counts are **strings** in the API response — coerce to integers at the boundary. |

### 5.2 GA4 reports

| id | Params | API call | Notes |
|---|---|---|---|
| `traffic` | `days` | `date × sessionDefaultChannelGroup` × `[sessions, totalUsers, newUsers, screenPageViews, engagedSessions, engagementRate, averageSessionDuration, keyEvents]` | Channel breakdown plus a combined total. |
| `landing` | `days`, `limit` | `pagePath` × `[sessions, screenPageViews, engagementRate]` | "Which pages actually get visited" — the GA4 twin of `pages`. |
| `events` | `days`, `limit` | `eventName` × `[eventCount, totalUsers]` | Sorted by `eventCount` desc. |

### 5.3 System

| id | Params | Returns |
|---|---|---|
| `status` | — | Last sync time per source, row counts, data window coverage, credential state (`configured` / `missing` / `invalid`), snapshot date used for bootstrap, and remaining budget signals. This is the first thing to run after deploy. |

---

## 6. Discord surface

### 6.1 Why one command, not fourteen

Discord already has ~66 commands. Fourteen new ones would be noise, and a `choice` option keeps
three things in lockstep: the catalog, the AI tool's `report` enum, and the help text. Both
adapters import the same `catalog.js`; neither can drift.

Slash form:

```
/analytics report:<overview|queries|pages|trend|compare|countries|devices|appearance|
                  inspect|sitemaps|traffic|landing|events|status>
           days:<7|28|90>      (optional, default 28)
           url:<string>        (required only when report=inspect)
           filter:<string>     (optional, `contains` for queries/pages)
           limit:<5..25>       (optional, default 10)
           fresh:<bool>        (optional, default false — bypass the cache, live API)
```

If subcommands are preferred later, the migration is mechanical: one `addSubcommand` per catalog
entry, same handlers.

### 6.2 Activation phrase

`skarn analytics …` → parsed by the same `parseArgs` as the slash command (`report` inferred from
the first token: `skarn analytics queries`). Registered as `type: 'command'` in the command's
`activation` export so the activation registry picks it up at startup and `run_command` would see
it — except D9 excludes it, so only the deterministic phrase path uses it.

### 6.3 AI tools (natural language) — two, not fourteen

`coreTools` gains two entries in `features/tools/toolDefinitions.js`:

```js
{
  type: 'function',
  function: {
    name: 'site_analytics',
    description: 'Look up this website\'s own search and traffic numbers (Google Search Console + Google Analytics). Use when someone asks about clicks, impressions, CTR, ranking position, top search queries, which pages get traffic, visitors, sessions, or channel sources for anomaly-alpha.github.io. Always pass a report id from the enum; do not guess numbers.',
    parameters: {
      type: 'object',
      properties: {
        report:  { type: 'string', enum: [/* catalog ids, generated */],
                   description: 'Which prebuilt report to run' },
        days:    { type: 'integer', enum: [7, 28, 90], description: 'Lookback window in days. Default 28.' },
        url:     { type: 'string', description: 'Page URL, required only for report=inspect' },
        filter:  { type: 'string', description: 'Substring the query or page must contain' },
        limit:   { type: 'integer', minimum: 5, maximum: 25, description: 'Row count. Default 10.' },
      },
      required: ['report'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'analytics_status',
    description: 'Report whether the analytics data pipeline is healthy: last sync, data freshness, and whether Google credentials are configured. Use when someone asks if the numbers are current, or when site_analytics returns nothing.',
    parameters: { type: 'object', properties: {} },
  },
}
```

Dispatch in `toolRunner.js`: two `case` branches, each returning
`{ role: 'tool', tool_call_id, content }` exactly like `get_weather`. The `content` is a compact
**text** table (≤25 rows, tab-free, one line per row) plus a mandatory trailer:

```
window: 2026-10-17..2026-11-13 (28d, GSC final) · rows 10 of 1,832 · source: cache
```

The model gets the embed's data as text, so it can answer follow-ups ("which of those is new?")
without a second call — and it still cannot miscount, because it is reading, not querying.

`maxTurns = 3` in `sharedPipeline.js` allows at most 2 tool rounds; every catalog report is a
single call, so a two-step question ("compare top pages, then inspect the worst") fits.

### 6.4 Rendering

- Discord embed, one, no fields beyond 3 columns (`name | value | inline`).
- Numbers: thousands separators; `ctr` as a percentage to 2 dp; `position` to 1 dp.
- A footer is **mandatory** on every data reply: `window · source (cache|live) · data state`.
  There is no code path that renders numbers without it. This is how the 2–3 day GSC lag stops
  being a bug report.
- `trend` renders as `▁▂▃▅▇` sparkline + first/last values.
- Empty result → an explicit "no rows for that window / that filter", never a zero.

### 6.5 Access and cost gates

Per D6 the surface is open, but every invocation passes the same gates as any other AI command:

1. `checkAiPermission(userId, guildId, 'analytics')` — and `analytics` must be added to `AI_COMMANDS` in `features/friendTiers/friendPermission.js`, or the gate silently never runs.
2. `canCall(userId, 'analytics', multiplier)` from `lib/rateLimit.js` — a dedicated bucket, because reusing `chat` would let analytics queries starve normal conversation.
3. Slash path only: the sleep-window check in `bot.js` already applies to all slash commands; nothing to add. The mention path is not sleep-gated, matching existing behavior.
4. `/help` discoverability: add `analytics` to `THEME_MAP` in `features/help/helpPages.js`, otherwise it lands in `Other` and logs a startup warning.

---

## 7. Correctness guardrails

These are not style preferences; each prevents a specific wrong number.

| # | Rule | Failure it prevents |
|---|---|---|
| G1 | Every data reply states its window and data state | Presenting 3-day-stale GSC data as "today" |
| G2 | **Never average `position` across rows.** If a blended position is required, compute `SUM(position*impressions)/SUM(impressions)` | GSC `position` is the impression-weighted average rank of the site's topmost result. Averaging row positions produces a number that matches nothing in the console. |
| G3 | **Never filter by `position` before aggregating** | Filtering to "position < 10" then averaging is the censored top-N trap: it reports the survivors' average, not the query's. Filter after aggregation, or not at all. |
| G4 | `ctr` is a 0–1 fraction in response rows but a percent in `summary.json` totals | Mixing the two produces a 100× error |
| G5 | `search_appearance` may be the **only** dimension in its request | The API rejects the combination |
| G6 | Filter groups are `AND`-only; `OR` is unsupported | A "mobile or tablet" filter needs two calls and a local merge |
| G7 | Respect 25,000 rows/request and **50,000 rows/day/search-type**; page+query grouping goes through the cache only | Silent truncation looks like a traffic drop |
| G8 | On the GA4 side: `keyEvents`, not `conversions`; `newVsReturning`, not `userType`; ≤4 date ranges; `limit` default 10,000, max 250,000 | `conversions` is the pre-rename name and is not in the v1beta schema |
| G9 | GA4 thresholded dimensions (`userAgeBracket`, `userGender`, `brandingInterest`, `audienceId`, `audienceName`) return "withheld", never "zero" | Reporting a suppressed demographic row as 0 users is a false claim. Not in the v1 catalog for this reason. |
| G10 | URL Inspection: at most 1 live inspection per invocation, cached 7 days, bulk inspection never | 2,000/day, 600/min per property |
| G11 | If a cached table is empty **and** the live call fails, say so. Never fill the gap with an estimate, a previous number, or a plausible-looking guess | The one failure mode that makes an analytics feature worse than no analytics feature |
| G12 | GSC omits queries below a reporting threshold, so query-level totals are **floors**; the footer says `(queries below Google's reporting threshold are omitted)` whenever a query-level report is shown | Presenting a query sum as property total understates demand, and the understatement is largest for the small families you care about |

---

## 8. Limits and failure modes

| Condition | Behavior |
|---|---|
| No `GOOGLE_SERVICE_ACCOUNT_JSON` | Cached reports keep working from the bootstrap snapshot. Live reports return "live needs a key; cached data is from `<date>`". `/analytics status` shows `credential: missing`. |
| Key invalid / revoked (`401`,`403`) | One retry after clearing the token cache, then a plain message; status flips to `invalid`. |
| Quota exceeded (`429`, GSC `quotaExceeded`) | Back off; serve cached; footer says `live unavailable — cached`. |
| GA4 property not shared with the SA | GA4 reports return "not configured" while GSC keeps working. This is the expected state until the Viewer grant is applied — phase 2 gate. |
| Volume full | Writes fail; reads keep serving. Sync logs `ok=0 disk`. 0.4 GB of 4.9 GB used today; analytics tables are a few MB. |
| Redeploy mid-sync | Upserts are idempotent; next boot re-runs. No partial-state repair needed. |
| Two bot replicas | Not supported: one volume per service, no replicas (Railway constraint). Also true of the SQLite DB as a whole today. |

**Data egress disclosure.** A tool result is placed in the OpenAI prompt, so aggregated analytics
numbers leave the box on every natural-language query. Given the site is public and the numbers
are non-personal (owner ruling, D6), this is accepted — but it is the honest statement of the
trade, and it is why the catalog caches aggregate rows rather than raw exports.

---

---

## 9. Phasing

### P0 — GSC cached + live, no GA4 (shippable alone)

1. Root project: `scripts/pull-gsc.js` writes `data/gsc-api/latest.json` (`{"date":"YYYY-MM-DD","generatedAt":…}`) as part of its normal run. One file, ~4 lines.
2. `db/skarn-schema.sql` + `db/migrations.js` version 8 — the tables in §4.2.
3. `features/analytics/googleAuth.js`, `gscClient.js`, `store.js`.
4. `features/analytics/sync.js` (nightly + bootstrap) wired into `features/scheduler/index.js`.
5. `features/analytics/catalog.js` with the 10 GSC + 1 system entries.
6. `features/analytics/reports.js` + `render.js` + `analytics.handler.js`, `commands/analytics.js`.
7. `toolDefinitions.js`: two tools + `analytics` appended to `EXCLUDED_COMMANDS`; `toolRunner.js`: two cases.
8. `friendPermission.js` `AI_COMMANDS`, `helpPages.js` `THEME_MAP`.
9. Railway: create the SA, grant both properties, set `GOOGLE_SERVICE_ACCOUNT_JSON`, deploy, run `/analytics status`.

**P0 is done when** `/analytics overview` answers from cache with a correct window footer, and
`/analytics queries fresh:true` returns live rows.

### P1 — GA4

10. `ga4Client.js` + three catalog entries; sync extension; `data/ga4-api/` gets populated in the root project too (it has never been committed — see §12 risk 3).
11. Gate: `/analytics status` must report `ga4: ok` before `traffic`/`landing`/`events` are advertised.

### P2 — refinements, only if used

12. `insight` report: 7-day change leaders (queries with the largest click delta, pages that lost clicks) computed from two stored windows. Requires storing two windows, so it is a schema addition, not a UI change.
13. Optional digest: a weekly in-character line posted to a configured channel, reusing `newsDigest.js` as the pattern. Explicitly out of scope for this spec.

---

## 10. Implementation map

```
skarn-bot/
├── commands/analytics.js                  # thin wrapper: data + execute + activation + handleActivation
├── db/skarn-schema.sql                    # + §4.2 tables (IF NOT EXISTS)
├── db/migrations.js                       # + version 8
├── db/database.js                          # + re-export the new accessors through the facade
├── features/analytics/
│   ├── catalog.js                          # 14 report specs (single source of truth)
│   ├── googleAuth.js                       # env JSON → JWT → token, cached
│   ├── gscClient.js                        # searchAnalytics | sitemaps | urlInspection
│   ├── ga4Client.js                        # runReport (P1)
│   ├── store.js                            # reads/writes for analytics_* tables
│   ├── sync.js                             # nightly + bootstrap + window prune
│   ├── reports.js                          # catalog → data (cached | live)
│   ├── render.js                           # embed/table/sparkline + mandatory footer
│   └── analytics.handler.js                # slash execute() + handleActivation()
├── features/scheduler/index.js             # + boot run and 24h interval
├── features/tools/toolDefinitions.js       # + site_analytics, analytics_status; EXCLUDED_COMMANDS += 'analytics'
├── features/tools/toolRunner.js            # + 2 dispatch cases
├── features/friendTiers/friendPermission.js# AI_COMMANDS += 'analytics'
├── features/help/helpPages.js              # THEME_MAP += analytics
├── scripts/smokes/30-analytics-store.js    # temp DB, upsert/idempotence/window prune
├── scripts/smokes/31-analytics-catalog.js  # schema validity, snake_case dimensions, enum ⇄ catalog parity
└── scripts/smokes/32-analytics-render.js   # footer present, no averaging of position, number formats
```

`db/database.js` is a thin `Object.assign` facade over the domain modules; new accessors go in
`store.js` and are re-exported through the facade so existing require sites keep working.

### Tests worth having (and the one that matters most)

`31-analytics-catalog.js` asserts that every `gsc.dimensions` entry is snake_case, that
`search_appearance` never appears alongside another dimension (G5), and that the tool `enum`
in `toolDefinitions.js` equals `catalog.map(c => c.id)`. That last assertion is the anti-drift
guard: it fails the moment someone adds a report to one place and not the other.

`32-analytics-render.js` asserts the footer is present on every rendered report, and that a
fixture where two rows have different positions and impressions renders the weighted value —
not the arithmetic mean (G2).

---

## 11. What this costs

| Resource | Per day | Headroom |
|---|---|---|
| GSC `searchAnalytics` calls | ~15 (nightly) + user-triggered live | 1,200 QPM per site, 40,000 QPM per project |
| GSC URL Inspection | ≤1 per user request, cached 7 days | 2,000/day, 600/min per property |
| GA4 Core tokens | ~60 (12 reports × ≤10 tokens) | 200,000/property/day; **14,000/project/property/hour** is the binding cap |
| Railway volume | a few MB | 4.9 GB available, 0.4 GB used |
| Disk writes | one nightly upsert batch | negligible |

The GA4 hourly project cap (14,000) matters more than the daily one for a single-key setup, but
a bot answering a handful of questions a day will not approach either.

---

## 12. Risks

1. **The nightly sync is clock-derived, not demand-derived.** If Railway sleeps the service or the
   scheduler is disabled, data silently ages. `/analytics status` and the mandatory footer are the
   only mitigations, and both are inside the bot. A Railway cron service would be more robust but
   would need its own deploy and a shared volume — explicitly not worth it for one bot.
2. **`data/gsc-api/latest.json` is a coupling point.** If the root puller stops writing it, bootstrap
   falls back to `ANALYTICS_SNAPSHOT_DATE` and then to live-only. Acceptable, but the failure is quiet.
3. **GA4 has never been verified in this repo.** `scripts/pull-ga4.js` is complete and a 2026-11-08
   commit message claims a successful run, but `data/ga4-api/` does not exist and `git log` shows
   zero commits for that path. The GA4 Viewer grant must be re-verified before P1 is advertised,
   and that is why P1 sits behind a `/analytics status` gate rather than shipping with P0.
4. **Two copies of the JWT code** (§3.4) can drift. Documented in both files; not otherwise enforceable.
5. **The credential is readable by anyone with project access** via `railway variable list`. Accepted
   (D6 + §3.2 step 5). It is read-only, scoped to a public site, and revocable in one step.
6. **`position` will be misread by users** no matter what the footer says. Mitigation is the
   renderer never showing a blended position unless asked for one explicitly.

---

## 13. Sources

| Claim | Source |
|---|---|
| GSC quotas: 1,200 QPM per site/user, 40,000 QPM + 30,000,000 QPD per project; URL Inspection 2,000 QPD / 600 QPM | `https://developers.google.com/webmaster-tools/limits` |
| GSC dimensions, `rowLimit` 1–25,000, `dataState`, `searchType`→`type`, filter operators (RE2), AND-only groups | `https://developers.google.com/webmaster-tools/v1/searchanalytics/query`, `https://searchconsole.googleapis.com/$discovery/rest?version=v1` |
| 50,000 rows/day/search-type cap; 2–3 day data lag; `metadata.firstIncompleteDate` | `https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data` |
| `position` = impression-weighted average rank of the topmost result | `https://support.google.com/webmasters/answer/7576553` |
| No rich-results API; only `urlInspection.richResultsResult` | discovery doc surface (`searchanalytics`, `sitemaps`, `sites`, `urlInspection`) |
| GA4 Core quotas 200,000/day, 40,000/hour, 14,000/project/property/hour, 10 concurrent; `returnPropertyQuota` | `https://developers.google.com/analytics/devguides/reporting/data/v1/quotas` |
| GA4 `runReport` body/response, 4 date ranges, `limit` default 10,000 / max 250,000, `orderBys`, `FilterExpression` | `https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport` |
| GA4 dimension/metric names (`keyEvents`, `newVsReturning`; no `conversions`/`userType`) | `https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema` |
| Railway multiline variables; sealed variables withheld from CLI | `https://docs.railway.com/guides/variables` |
| Railway volumes: one per service, no replicas, redeploy downtime | `https://docs.railway.com/reference/volumes` |
| Railway `variable list/set --stdin`; `run` injects env locally, `ssh` runs in the container | `https://docs.railway.com/cli/variable` |
| Repo facts (pullers, schemas, credential order, tool registry, gates, migrations) | `scripts/pull-gsc.js`, `scripts/pull-ga4.js`, `scripts/lib/google-auth.js`, `features/tools/*.js`, `db/migrations.js`, `CONTEXT.md` |

Two claims could **not** be confirmed from a primary source and are deliberately absent from the
design: a specific GSC history-retention window (16 months is widely repeated but undocumented on
the pages fetched), and whether Google will raise these quotas on request.

---

## 14. Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Live-api-only (no sync) | Every chat question burns Search Console load quota, and page+query grouping is the most expensive class Google documents. Also means the feature dies with the key. |
| Nightly-only (no live) | Cannot answer "what about yesterday", which is the first follow-up anyone asks, and GSC partial data is only reachable with `dataState:'all'` on a live call. |
| Free-form query builder driven by the LLM | Invalid dimension combos, expensive load classes, and fabricated parameters. The catalog is what makes this safe. |
| Fourteen slash commands | Noise in a 66-command bot; guaranteed catalog/command drift; no benefit over one command with a choice. |
| A new Railway Postgres | One writer, one process, a few MB of rows. The volume already exists; Postgres adds a service, a connection pool and a second backup path for zero gain. |
| `googleapis` npm package | Large dependency in a package that already builds two native modules; the repo has working minimal JWT code. |
| GA4 Realtime / demographics / funnel reports | Realtime is a 30-minute window rarely asked about; demographic dimensions are thresholded (G9); funnel needs its own quota category and event config that this property has not set up. |
| Anchoring on `skarn-bot/CONTEXT.md`'s "9 live tools" count | That figure is stale (10 now, 12 after this change). The catalog enum assertion (§10) is the durable guard, not a doc count. |

---

## 15. Open questions

1. **`days` granularity.** The catalog offers 7/28/90. Does 24 h or a single-date report matter?
   GSC cannot answer either for the last 2 days (lag), so it was left out — confirm that is fine.
2. **`/analytics` vs `/stats`.** `aistats` already exists as a command name; `analytics` is unused
   and unambiguous. Naming is trivial to change now and annoying later.
3. **Should the report footer name the property?** `sc-domain:anomaly-alpha.github.io` is implied
   by the bot's identity today, but a second site would need a `site` parameter. Deferred until a
   second property exists.

