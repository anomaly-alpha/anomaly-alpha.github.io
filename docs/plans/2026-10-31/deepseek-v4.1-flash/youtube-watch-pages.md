# YouTube Watch Pages + VideoObject Datetime Fix

- **Date:** 2026-10-31
- **Model:** deepseek-v4.1-flash
- **Scope:** `scripts/generate-youtube-creators.js`, new `scripts/generate-watch-pages.js`, new `watch/**`, `sitemap.xml`, `tailwind.config.js`, `package.json`, `tests/`, `AGENTS.md`

## Problem

Search Console's **Video indexing** report flags `/guide/creators/` with
**"Video isn't on a watch page."**

Verified via the GSC URL Inspection API on 2026-10-31:

- `/guide/creators/` is the only page on the site with video markup.
- It carries **142 `VideoObject` entities inside one `ItemList`** on a single directory page.
- Google's own definition of a non-watch page explicitly includes
  *"a video category page that lists multiple videos of equal prominence."*
  The directory is that page, so the status is technically correct.

The same API call surfaced a **second, genuine defect**:

```
Invalid datetime value for "uploadDate"                    [WARNING]  × 141
Datetime property "uploadDate" is missing a timezone       [WARNING]  × 141
```

Cause: `scripts/generate-youtube-creators.js:702` emits `uploadDate: video.published`,
and `published` is date-only (`"2026-10-31"`), enforced by `DATE_RE` in validation.

## Goals

1. Emit a timezone-qualified ISO 8601 `uploadDate` everywhere.
2. Give every one of the 142 videos a **dedicated watch page** that Google can index:
   one video, primary content, full metadata.
3. Stop advertising 142 competing videos on the directory page so the report can clear.
4. Add a stable, crawlable URL per video without title-churn breakage.

## Non-goals

- No per-creator pages (no creator has a dedicated landing page yet).
- No transcripts, durations, or view counts — that data is **not in
  `data/youtube-creators.json`** and will not be invented.
- No changes to the YouTube modal behaviour on the directory page.

## Design decisions

### 1. URL shape: `/watch/<videoId>/`

Stable and opaque. Video IDs never change; titles do. Slug-in-URL would 404 on every
title edit and force redirects across 142 pages. `/watch/index.html` acts as a hub.

### 2. One `VideoObject` per watch page, none on the directory

- Watch page `@graph`: `WebPage` (with `mainEntity` → the video), `VideoObject`,
  `BreadcrumbList`. One video only, so it reads unambiguously as a watch page.
- Directory page: replace the 142-`VideoObject` `ItemList` with a
  `CollectionPage` + `ItemList` of **links to the watch pages**. This removes the
  "many equal-prominence videos on one page" signal that triggers the error.

### 3. Player present at load, no JavaScript

Google's follow-on error *"Cannot determine video position and size"* fires when the
player is not in the page on load. So the watch page uses a plain
`<iframe src="https://www.youtube-nocookie.com/embed/<id>">` placed **immediately after
the `<h1>`**, `loading="eager"`, full size via CSS `aspect-ratio`.

Consequence: watch pages load **no `script.js`**. `script.js` and `styles.css` are
committed minified (1 line each), so hand-editing them is unsupported; the pages stay
static HTML + shared CSS, which is also the most crawlable option.

### 4. Page weight control

`videoObject.duration`, `interactionStatistic`, `potentialAction` (SeekToAction) are all
**omitted** because they require duration, which the data does not carry. Emitting them
would mean fabricating values.

### 5. `contentUrl` omitted

`contentUrl` must be the media file; the source data only has the YouTube watch page URL.
Declaring a page URL as `contentUrl` is invalid, so watch pages supply `embedUrl` only.

## Steps

1. **`generate-youtube-creators.js`**
   - Add `toIsoDateTime(dateStr)` → `YYYY-MM-DDT00:00:00+00:00` (date-only input is a
     real, timezone-unknown UTC date; UTC midnight is the standard neutral encoding).
   - Add exported `buildVideoObject(video, creator)` — the single source of VideoObject
     shape, used by both generators.
   - Rewrite `renderJsonLdHtml` to emit `CollectionPage` + link `ItemList`.
2. **`scripts/generate-watch-pages.js`** (new)
   - Reuse `buildData`, `getVisibleFeedItems`, `escapeHtml`, `escapeJsonLd`, `buildVideoObject`.
   - Emit `watch/<id>/index.html` per active video and `watch/index.html` hub.
   - Prune stale `watch/` directories so the set stays in sync with the data.
   - Rewrite the `WATCH_SITEMAP` marker region in `sitemap.xml`.
3. **`sitemap.xml`** — add `<!--WATCH_SITEMAP_START-->` / `<!--WATCH_SITEMAP_END-->`.
4. **`tailwind.config.js`** — add `./watch/**/*.html` to content globs, else utility
   classes used only on watch pages are absent from the built `tailwind.css`.
5. **`package.json`** — `generate-watch` script; wire into `build` after creator generation.
6. **`tests/youtube-watch-pages.test.js`** — assert datetime format, one VideoObject per
   page, `mainEntity` wiring, sitemap coverage, stale-dir pruning, hub links.
7. **`AGENTS.md`** — update file-ownership rows and command list.

## Verification

- `npm run test:creators` — existing generator contract still passes.
- `npm run test:watch-pages` — new suite.
- `npm run test:structured-data` — JSON-LD still valid site-wide.
- `npm run build` — full regeneration, including Tailwind.
- Local `npm start` + Playwright: confirm iframe renders at load, headings, breadcrumbs.
- **Requires the user to push** before GSC re-crawls. Then re-run the URL Inspection API
  against `/watch/<id>/`: expect `Videos` with **zero** `uploadDate` warnings, and the
  directory page to stop reporting 142 un-indexable videos.

## Risks

- **Thin-content exposure.** Descriptions in the data run 49–125 chars (median 78).
  Each page's unique text is title + description + creator/category/date facts + a
  distinct related-video set. That is genuinely unique per page, but shallow. If GSC
  later reports these as *Crawled – currently not indexed*, the honest remedy is richer
  source data (real per-video descriptions or transcripts), not more generated prose.
- **Competing with the source.** The YouTube watch page for the same video will usually
  outrank these. Expect indexing to succeed while traffic stays modest.
- 142 pages × inline head analytics is ~a few hundred KB of repo growth; acceptable.

## Results (2026-10-31)

Delivered:

| Item | Result |
|---|---|
| `uploadDate` format | `YYYY-MM-DDT00:00:00+00:00` on all 142 pages (was a bare date) |
| Watch pages | 142 generated, one `VideoObject` each |
| `/watch/` hub | 142 links across 16 creator sections |
| Directory JSON-LD | `CollectionPage` + `ItemList` of 142 watch links, **0** `VideoObject` |
| Directory anchors | 142 crawlable `Video page` links added to video cards |
| Sitemap | 157 `<loc>` (14 editorial + hub + 142 watch pages) |
| Unique `<title>` | 142/142 (duplicate livestream titles disambiguated by date) |
| Unique meta description | 142/142 |
| Broken internal watch links | 0 |

Verification run:

- `npm run build` — clean, creator generator idempotency check passed.
- `npm run test:creators` — 70/70.
- `npm run test:watch-pages` — 21/21 (new suite).
- `npm run test:structured-data` — 14 pages passed.
- `npm run test:ads-fallback`, `test:ads-txt`, `test:creator-audit` — passed.
- Browser QA (`npm start` + Playwright): watch page renders with the player as primary
  content at full size on load; directory renders the new per-card links; hub renders.
- `script.js` and `styles.css` were **not** modified (both are committed minified).

## Not yet verified

GSC re-crawl requires a deployment. After the push, re-inspect a watch page with the
URL Inspection API and confirm the `uploadDate` warnings are gone; then check that the
Video indexing report stops reporting `/guide/creators/` as "not a watch page".

