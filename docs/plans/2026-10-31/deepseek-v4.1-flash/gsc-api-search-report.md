# GSC API Pull + Detailed Search Report

**Date:** 2026-10-31
**Model:** deepseek-v4.1-flash
**Status:** Completed

## Goal

Replace manual Search Console CSV exports with a repeatable API pull, then produce a detailed search performance report that combines fresh API data with the historical exports in `data/`.

## Auth / environment

- gcloud 591.0.0 at `~/google-cloud-sdk`, account `pottinger@gmail.com`
- GCP project `anomaly-alpha-gsc`
- API `searchconsole.googleapis.com` enabled
- ADC: `~/.config/gcloud/application_default_credentials.json` with `webmasters.readonly`
- Quota project: `anomaly-alpha-gsc` (send `x-goog-user-project` header for raw REST calls)

## Scope

Property: `https://anomaly-alpha.github.io/`

| Period | Start | End | Days |
|--------|-------|-----|------|
| Full | 2026-05-02 | 2026-10-29 | 181 |
| Current | 2026-10-02 | 2026-10-29 | 28 |
| Previous | 2026-09-04 | 2026-10-01 | 28 |

Data is available through 2026-10-29 (checked 2026-10-31); Oct 30–31 are not yet reported.

## Deliverables

1. `scripts/pull-gsc.js` — dependency-free Node client that:
   - refreshes an access token from ADC
   - pages through Search Analytics API results (25k rows/request)
   - pulls daily, query, page, country, device, query+page, and search-appearance data for the periods above
   - attempts Discover/Image breakdowns
   - writes raw JSON + `meta.json` to `data/gsc-api/2026-10-31/`
2. `package.json` script `pull-gsc`
3. `docs/reports/2026-10-31/deepseek-v4.1-flash/search-console-report.md` with:
   - executive summary (current vs previous 28d)
   - daily/weekly trend
   - page and query performance, gainers/losers
   - CTR leaks, striking-distance queries, cannibalization
   - device, country, search appearance
   - historical comparison against all old exports
   - prioritized recommendations and methodology caveats

## Verification

- Pull completes with HTTP 200 and all expected files present
- Daily row count = 181 and first/last dates match the requested range
- API totals for 2026-07-11 → 2026-10-10 match the `1012` export within rounding
- Page/query row sums are sanity-checked against daily totals (anonymized-query gap noted)
- Report tables spot-checked against raw JSON
