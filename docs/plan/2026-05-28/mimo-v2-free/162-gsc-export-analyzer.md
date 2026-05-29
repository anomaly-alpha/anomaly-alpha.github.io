# Plan 162: GSC Export Analyzer

**Date:** 2026-05-28
**Model:** deepseek-v4-flash-free
**Goal:** Analyze GSC exports from `data/` → update `docs/reports/SEO_PERFORMANCE.md`

---

## Input

Export folders at `data/https___anomaly-alpha*`. Newest is alphabetically first (`https___anomaly-alpha`). Each contains 6 CSVs with identical column layout: `Clicks, Impressions, CTR, Position`.

| CSV | Column 1 | Notes |
|-----|----------|-------|
| Chart.csv | Date | One row per day |
| Pages.csv | Page URL | Strip `https://anomaly-alpha.github.io` prefix |
| Queries.csv | Query | CTR leaks: impressions > 5, clicks = 0 |
| Devices.csv | Device | Mobile / Desktop / Tablet |
| Countries.csv | Country | Top 10 by clicks |
| Search appearance.csv | Search appearance | If header-only, no rich results |

## Steps

### 1. Compute export-level metrics from Chart.csv

For each export folder, sum clicks and impressions from all rows. Compute CTR (`clicks/impressions*100`), avg position. Split into calendar weeks for weekly averages. Build a comparison table:

| Export | Period | Days | Clicks | Impressions | CTR | Position |
|--------|--------|------|--------|-------------|-----|----------|

### 2. Compare Pages.csv across exports

For each page, compute deltas (clicks, impressions, CTR, position). Flag: CTR < 1%, impressions > 100 with 0 clicks, position drop ≥ 2.

### 3. Analyze Queries.csv (newest only)

Two lists: top queries by clicks (limit 10), CTR leaks sorted by `score = impressions * (11 - min(position, 10))`. Label severity: ≤5 CRITICAL, ≤8 HIGH, ≤10 MEDIUM, >10 LOW.

### 4. Device, Country, Search appearance (newest only)

Devices: click/impression share by device. Countries: top 10 by clicks. Search appearance: if no data past header, mark "None detected".

### 5. Update the report

Write `docs/reports/SEO_PERFORMANCE.md` with sections in this order:

1. **Quick Summary** — metric table with current, previous, change columns
2. **Trend** — daily Chart.csv rows + weekly averages
3. **Page Performance** — newest + previous Pages.csv tables
4. **Query Performance** — top queries + CTR leaks
5. **Devices** — device breakdown
6. **Countries** — top 10
7. **Rich Results** — Search appearance status
8. **Issues & Opportunities** — Open (preserve existing, update metrics, add new), Closed (move resolved), Actions Taken, Next Actions
9. **Comparison History** — cumulative export table

Preserve existing open issues. Only resolve if data confirms improvement. Deduplicate.

### 6. Verify

- Daily row count matches CSV (skip header)
- Sum of page clicks = total from Chart.csv
- All percentages include `%`
- No duplicate issues
