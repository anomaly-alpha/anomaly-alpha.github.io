# [S1] GSC Analyzer Script + SEO Dashboard — Design Spec

**Date:** 2026-07-17
**Status:** Approved design

---

## [S2] Problem

Google Search Console exports are downloaded to `data/` but there's no automated way to turn them into actionable insights. The existing `SEO_PERFORMANCE.md` report requires manual table-by-table updates across 9 sections. There's also no visual dashboard for quick performance checks.

## [S3] Solution overview

Two features:
1. **`scripts/analyze-gsc.js`** — Node.js script that reads GSC CSV exports, computes metrics, updates `SEO_PERFORMANCE.md`, and generates dashboard data
2. **`/seo/` dashboard page** — Private (`noindex`) page rendering GSC data with Chart.js charts

## [S4] Script: analyze-gsc.js

### Location & command
- **File**: `scripts/analyze-gsc.js`
- **npm command**: `npm run analyze-gsc`
- **Pattern**: Same as `scripts/gen-serp-dumps.js` and `scripts/generate-codes.js` (pure Node.js, no external deps)

### Inputs
- GSC export folders at `data/https___anomaly-alpha*` (two naming conventions — see S15)
- Existing `docs/reports/SEO_PERFORMANCE.md` (for issue preservation)
- Each export folder contains 6 CSVs: Chart, Pages, Queries, Devices, Countries, Search appearance

### Outputs
- Updated `docs/reports/SEO_PERFORMANCE.md` (full regeneration)
- `data/generated/seo-data.js` (dashboard data, sets `window.__SEO_DATA`)

### Processing steps

**Step 1: Export discovery**
- Scan `data/` for folders matching `https___anomaly-alpha*`
- Parse date from folder name (see S9 for format)
- Sort descending, pick newest + previous

**Step 2: CSV parsing**
- Read each CSV into arrays of objects
- Handle: header-only Search appearance.csv (no rich results), empty lines, percentage values with `%`

**Step 3: Metric computation**

| Metric | Source | Formula |
|--------|--------|---------|
| Total clicks | Chart.csv | SUM(clicks) |
| Total impressions | Chart.csv | SUM(impressions) |
| CTR | Chart.csv | clicks/impressions×100 |
| Avg position | Chart.csv | AVG(position) |
| Period | Chart.csv | MIN(date) → MAX(date) |
| Weekly avg clicks | Chart.csv | SUM(7-day window)/7 |
| Per-day clicks | Chart.csv | total/days |
| Page clicks | Pages.csv | Direct from CSV |
| Page CTR | Pages.csv | clicks/impressions×100 |
| Click share | Pages.csv | page/total×100 |
| CTR leak score | Queries.csv | impressions × (11 − MIN(position, 10)) |
| Device share | Devices.csv | device/total×100 |

**Step 4: Issue lifecycle** (cross-reference with existing report)

Parse existing `SEO_PERFORMANCE.md` to extract:
- Open issues: ID, query, position, impressions, clicks, severity, first_seen
- Recently improved: issue description, resolution status
- Actions taken: bullet list
- Comparison history: previous export rows

Issue resolution logic:
```
For each open issue:
  query_matches = find in current Queries.csv (case-insensitive substring)
  if query_matches AND clicks == 0:
    UPDATE impressions, position (issue persists)
  elif query_matches AND clicks > 0:
    MOVE to Recently Improved (resolved — now converting)
  else:
    MOVE to Recently Improved (resolved — not in top queries)

For each CTR leak (impressions>5, clicks=0, position<12):
  if NOT matching any existing open issue:
    ADD as new issue with computed severity
```

**Step 5: Section generation**

Generate each report section as Markdown:

- **S5.1 Quick Summary** — Table with current vs previous metrics + raw Δ + per-day Δ
- **S5.2 Trend** — Daily Chart.csv rows (show newest 60 days max) + weekly averages table
- **S5.3 Page Performance** — Newest Pages.csv (sorted by clicks desc) + previous for comparison
- **S5.4 Query Performance** — Top 30 queries by clicks + CTR leaks sorted by severity score
- **S5.5 Devices** — Device breakdown with share
- **S5.6 Countries** — Top 10 by clicks
- **S5.7 Rich Results** — From Search appearance.csv
- **S5.8 Issues & Opportunities** — Merged: preserved existing + new auto-detected, sorted by severity
- **S5.9 Recently Improved** — Preserved from previous + newly resolved
- **S5.10 Actions Taken** — Preserved from previous + auto-generated for new changes
- **S5.11 Confirmed Impact** — Simplified auto-generated: compare current vs previous key metrics
- **S5.12 Comparison History** — Previous rows preserved + new row appended

**The script does NOT touch** the narrative descriptions within Issues (the "Impact" column text) or the Confirmed Impact analysis paragraphs. Those are preserved verbatim. Only metrics and issue existence are updated.

**Step 6: Dashboard data generation**
Write `data/generated/seo-data.js`:
```js
window.__SEO_DATA = {
  fetched: "2026-07-17",
  totals: { clicks: 1032, impressions: 22683, ctr: 4.55, position: 7.1 },
  daily: [{ date: "2026-05-02", clicks: 0, impressions: 0 }, ...],
  pages: [{ url: "/guide/code/", clicks: 830, share: 80.4, ... }, ...],
  queries: [{ query: "invincible codes", clicks: 42, ... }, ...],
  devices: { mobile: { clicks: 920, share: 89.5 }, ... },
  ctrLeaks: [{ query: "...", impressions: 23, position: 3.39, score: 175, severity: "CRITICAL" }, ...]
};
```

## [S5] Dashboard page: /seo/

### URL & template
- **URL**: `/seo/` → `seo/index.html`
- **Metadata**: `noindex, nofollow`, OG tags pointing to home page, Article schema
- **Template**: Same dark theme (tailwind.css, styles.css, particles background), simplified hero

### Page layout

**Hero area**:
- Back link to homepage
- "SEO Performance Dashboard" + "Updated <date>"
- KPI row: 4 mini cards (total clicks, impressions, CTR, avg position) for last 7 days

**Trend chart**:
- Chart.js line chart, dual axis: clicks (primary, cyan line) + impressions (secondary, purple line, dashed)
- Shows last 30 days of data from `__SEO_DATA.daily`
- Chart init via inline `<script>`: `initSeoCharts()`

**Page performance table**:
- All pages sorted by clicks descending
- Columns: Page, Clicks, Impressions, CTR, Position
- Highlight the top page (code guide) with green category color

**CTR leaks table**:
- Columns: Query, Impressions, Position, Severity
- Severity badge colored: CRITICAL=red, HIGH=orange, MEDIUM=yellow

**Device breakdown**:
- Simple styled table: Mobile / Desktop / Tablet counts and shares

### Data loading
```html
<script src="../data/generated/seo-data.js"></script>
<script src="../vendor/chart.umd.js"></script>
<script>
function initSeoCharts() {
  const data = window.__SEO_DATA;
  if (!data) return;
  // render chart, populate tables
}
document.addEventListener('DOMContentLoaded', initSeoCharts);
</script>
```

No changes to `script.js` — dashboard has its own independent init.

### Files

| File | Type | Change |
|------|------|--------|
| `scripts/analyze-gsc.js` | New | Analyzer script |
| `seo/index.html` | New | Dashboard page |
| `data/generated/seo-data.js` | Generated | Dashboard data (by script) |
| `docs/reports/SEO_PERFORMANCE.md` | Updated | Full report (by script) |
| `package.json` | Modified | Add `"analyze-gsc"` script entry |

## [S6] npm command

```json
"analyze-gsc": "node scripts/analyze-gsc.js"
```

Not part of `npm run build` — only run when a new GSC export is added.

## [S7] Verification

1. Run `npm run analyze-gsc` with the current export in place
2. Verify `docs/reports/SEO_PERFORMANCE.md` is updated — check all 12 sections
3. Verify `data/generated/seo-data.js` exists and has valid JSON
4. Open `/seo/` in browser — check KPI cards render, chart loads, tables populate
5. Run `npm run build` to ensure no regressions on other pages
6. Add a test export folder with known data, re-run, verify correct deltas

## [S8] Edge cases

- **Only one export exists**: Script runs in "no comparison" mode — shows current data only, no deltas
- **No exports at all**: Script exits with message "No GSC exports found in data/"
- **Search appearance.csv is header-only**: Interpreted as "no rich results detected"
- **CTR leak with query exceeding 40 chars**: Truncated in report with `…`
- **Issue query no longer in top 500 queries**: Moved to Recently Improved with "dropped from top queries"

## [S9] Export folder naming

Two conventions:

| Convention | Format | Example | Date parsed |
|-----------|--------|---------|-------------|
| Old (pre-Jul 2026) | `https___anomaly-alpha-{MMDD}` | `https___anomaly-alpha-0704` | 2026-07-04 |
| New (Jul 2026+) | `https___anomaly-alpha.github.io_-Performance-on-Search-{YYYY-MM-DD}` | `…-2026-07-17` | 2026-07-17 |

Both parsed via regex. Old format assumes current year (2026).

## [S10] Issue severity scoring

Per Plan 162:

```
score = impressions × (11 − MIN(position, 10))

Score ≥ 150  → CRITICAL
Score ≥ 80   → HIGH
Score ≥ 30   → MEDIUM
Score < 30   → LOW
```

## [S11] Script execution safety

The script does NOT modify `data/https___anomaly-alpha*` folders (read-only). It only writes to:
- `docs/reports/SEO_PERFORMANCE.md`
- `data/generated/seo-data.js`

Both are committed. No destructive operations.

## [S12] References

- Plan 162: GSC Export Analyzer (`docs/plan/2026-05-28/deepseek-v4-flash-free/162-gsc-export-analyzer.md`)
- Existing generator patterns: `scripts/gen-serp-dumps.js`, `scripts/generate-codes.js`
- Existing dashboard data pattern: `data/generated/promo-codes.js`
- Current report: `docs/reports/SEO_PERFORMANCE.md`
- Current export: `data/https___anomaly-alpha.github.io_-Performance-on-Search-2026-07-17/`
