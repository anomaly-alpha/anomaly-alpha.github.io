# Plan 162: GSC Export Analyzer

**Date:** 2026-05-28
**Model:** deepseek-v4-flash-free
**Goal:** Analyze Google Search Console exports from `data/` and update `docs/reports/SEO_PERFORMANCE.md`

---

## Overview

This plan is designed to be run by any AI model when a new GSC export folder is added to `data/`. The model reads the CSVs, computes metrics, compares against previous exports, and updates the SEO performance report.

---

## Steps

### Step 1: Discover Export Folders

List all folders matching `data/https___anomaly-alpha*`:

```bash
ls -d data/https___anomaly-alpha*
```

Expected names:
- `data/https___anomaly-alpha` — latest export (always the freshest)
- `data/https___anomaly-alpha-0512` — older (May 12)
- `data/https___anomaly-alpha-0505` — oldest (May 5)

Identify the newest folder (alphabetically sorted, `https___anomaly-alpha` is newest). Set `$NEWEST` to its path.

### Step 2: Read Chart.csv for Each Export

Read `Chart.csv` from each export folder. Format:

```
Date,Clicks,Impressions,CTR,Position
2026-05-03,4,55,7.27%,5.5
```

Compute for each export:

| Metric | How to compute |
|--------|---------------|
| Period start | First date in column 1 (skip header) |
| Period end | Last date in column 1 |
| Days | Number of data rows |
| Total clicks | Sum column 2 |
| Total impressions | Sum column 3 |
| CTR | `total_clicks / total_impressions * 100` (2 decimal places + `%`) |
| Avg position | Average of column 5 (rounded to 1 decimal) |
| Peak impressions day | Row with max column 3 |
| Peak clicks day | Row with max column 2 |

Weekly averages: split data into calendar weeks (Mon-Sun), compute avg clicks/day, avg impressions/day, avg CTR, avg position for each week.

Store in a comparison table:

| Export | Period | Days | Clicks | Impressions | CTR | Position |
|--------|--------|------|--------|-------------|-----|----------|
| 0505 | May 2–5 | ~3 | ~7 | ~55 | ~12.7% | ~5.5 |
| 0512 | May 2–12 | 10 | 20 | 557 | 3.59% | 6.9 |
| Current | May 3–26 | 24 | 53 | 1,694 | 3.13% | 6.9 |

### Step 3: Read Pages.csv for Each Export

Read `Pages.csv` from each export folder. Format:

```
Top pages,Clicks,Impressions,CTR,Position
https://anomaly-alpha.github.io/guide/pvp/,27,666,4.05%,6.37
```

Strip the `https://anomaly-alpha.github.io` prefix from each URL for readability.

Compare newest vs previous export — compute for each page:

| Metric | How to compute |
|--------|---------------|
| Clicks change | `new_clicks - prev_clicks` |
| Impressions change | `new_impressions - prev_impressions` |
| CTR change | `new_ctr - prev_ctr` (percentage points) |
| Position change | `prev_position - new_position` (negative = worse) |

Flag pages where:
- CTR < 1% → **LOW CTR** warning
- Impressions > 100 and clicks = 0 → **ZERO CTR** alert
- Position dropped by 2+ → **POSITION LOSS** warning

### Step 4: Read Queries.csv (Newest Export Only)

Read `Queries.csv` from the newest export. Format:

```
Top queries,Clicks,Impressions,CTR,Position
invincible guarding the globe gems,1,5,20%,6.8
```

Compute two lists:

**A. Top queries with clicks** — sort by clicks descending, limit 10

**B. CTR leaks** — queries with 0 clicks where impressions > 5. Priority scoring:
- Score = `impressions * (11 - min(position, 10))`
- `position <= 5` → **CRITICAL** leak
- `position <= 8` → **HIGH** leak  
- `position <= 10` → **MEDIUM** leak
- `position > 10` → **LOW** leak

Sort by score descending.

### Step 5: Read Devices.csv (Newest Export Only)

Read `Devices.csv`. Format:

```
Device,Clicks,Impressions,CTR,Position
Mobile,42,1133,3.71%,6.81
```

Compute:
- Total clicks across devices
- Total impressions across devices
- Each device's share of clicks and impressions (percentage)

### Step 6: Read Search appearance.csv (Newest Export Only)

Read `Search appearance.csv`. If only a header row exists with no data, report **No rich results detected**.

If data exists, list each search appearance feature with its clicks, impressions, CTR.

### Step 7: Read Countries.csv (Newest Export Only)

Read `Countries.csv`. List top 10 by clicks descending. Compute each country's share of total clicks.

### Step 8: Update the Report

Write updated content to `docs/reports/SEO_PERFORMANCE.md` using this exact section structure:

```markdown
# SEO Performance Report

**Generated:** [today's date]
**GSC export periods:** [period1], [period2], [period3]

---

## How to Update

[preserve existing instructions]

---

## Quick Summary

Table with: Metric | Current | Previous | Change
- GSC Period
- Total Clicks
- Total Impressions
- CTR
- Avg Position
- Pages with Data
- Rich Results
- Mobile Share (clicks)

---

## Trend (Chart.csv)

Daily table (all rows from newest Chart.csv)
Weekly averages table (4-5 rows)

---

## Page Performance (Pages.csv)

Newest export table
Previous export table (for comparison)

---

## Query Performance (Queries.csv)

Top queries with clicks table
CTR leaks table

---

## Devices (Devices.csv)

Device breakdown table

---

## Countries (Countries.csv)

Top 10 countries by clicks

---

## Rich Results (Search appearance.csv)

Feature table. If no data, mark as "None detected".

---

## Issues & Opportunities

### Open Issues
[preserve existing open issues, update metrics, add new ones from Step 3 page flags]

### Closed Issues
[move resolved open issues here, add resolution date]

### Actions Taken This Period
[list what was done since last report]

### Next Actions
[top recommended actions]

---

## Comparison History

All exports in a cumulative table
```

### Step 9: Preserve Existing Issues

When updating, do NOT delete existing open issues — only:
1. Update their metrics if the data changed
2. Add new issues found in this analysis
3. Move issues to Closed if the data shows they're resolved (CTR improved, position improved, etc.)

---

## Quick Reference: File Paths

| File | Path |
|------|------|
| Newest export | `data/https___anomaly-alpha/` |
| Previous export | `data/https___anomaly-alpha-0512/` |
| Oldest export | `data/https___anomaly-alpha-0505/` |
| Report output | `docs/reports/SEO_PERFORMANCE.md` |

### CSV files inside each export folder

| CSV | Columns |
|-----|---------|
| Chart.csv | Date, Clicks, Impressions, CTR, Position |
| Pages.csv | Top pages, Clicks, Impressions, CTR, Position |
| Queries.csv | Top queries, Clicks, Impressions, CTR, Position |
| Devices.csv | Device, Clicks, Impressions, CTR, Position |
| Countries.csv | Country, Clicks, Impressions, CTR, Position |
| Search appearance.csv | Search Appearance, Clicks, Impressions, CTR, Position |

---

## Verification

After updating the report, verify:
1. Daily chart row count matches the CSV (skip header)
2. Sum of page clicks equals total clicks from Chart.csv
3. All URLs have `https://anomaly-alpha.github.io` prefix stripped
4. No tables have merged/overlapping cells due to commas in values
5. All percentages include `%` suffix
6. Issues section has no duplicates
