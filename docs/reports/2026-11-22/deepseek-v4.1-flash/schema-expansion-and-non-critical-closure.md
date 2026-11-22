# Structured-data expansion and non-critical issue closure

Date: 2026-11-22
Scope: all 232 indexable pages (16 editorial + `/watch/` hub + 215 per-video watch pages)

## What was asked

"Expand schema on all pages to maximum performance including all non-critical issues,
use tavily to search for modern best schemas and implement them on every page."

The research step changed the answer, so this report leads with that.

## Finding 1 — the site is already at Google's supported ceiling

Checked against Google's live "Structured data markup that Google Search supports"
gallery (last updated 2026-06-15) rather than SEO blog advice.

| Type | Status | Consequence here |
|---|---|---|
| `Article` | Supported | Already present and complete. Google's recommended set is `author`, `dateModified`, `datePublished`, `headline`, `image` — all present on all 9 guide pages. |
| `BreadcrumbList` | Supported | Was missing on 4 pages + the watch hub. **Fixed.** |
| `Image metadata` | Supported | Present; one item rendered as "Unnamed item". **Fixed** by adding `name`. |
| `Software app` | Supported | Present on `/` and `/authors/anomaly/`. |
| `Video` (`VideoObject`) | Supported | Present on all 215 watch pages, one per page, correctly. |
| `Profile page` | Supported | Present on `/authors/anomaly/`. |
| `Organization` | Supported | Homepage only, which is correct — see below. |
| `FAQPage` | **Retired 2026-05-07** | FAQ rich results stopped appearing; RRT support removed June 2026. The 8 blocks stay (real Q&A, still parsed for AI, asserted by tests) but earn nothing in Search. |
| `HowTo` | **Retired** (desktop 2023) | Not used, and forbidden by `tests/structured-data.test.js` I6. |
| `Speakable` | Supported but **news-only** | Deliberately *not* propagated. |

Two corrections to the "more schema = more performance" premise:

- **`Speakable` should not be spread sitewide.** Google's own doc scopes it to "your news
  content ... to be eligible as answers to topical news queries", US/English, Google
  Assistant. A game-guide fan site is outside that intent. Third-party AEO blogs recommend
  it broadly; Google's documentation contradicts them. The homepage's pre-existing
  `speakable` was left untouched.
- **`Organization` should not go on every page.** Google: "We recommend placing this
  information on your home page, or a single page that describes your organization ...
  You don't need to include it on every page of your site." So it stays top-level on `/`
  and is now also top-level on `/about/` (the page Google names for exactly this), with
  other pages referencing `#organization` by `@id`.

## Finding 2 — the real cause of the `Articles` non-critical warning

The previous session attributed it to a dangling `author` `@id` and fixed that. The fix
deployed, and the warning **persisted**. Drilling the Rich Results Test two levels deep
(click `Non-critical issues detected`, then the item row) surfaced the actual message:

```
author
  Missing field "url" (optional)
  └ type: Person, name: TheOneTruePanda
```

`TheOneTruePanda` is a community contributor (an in-game ally, player code in
`skarn-bot/data/friends.json`) with **no public web profile**, so no honest `url` exists.

Control that proves causation: `/guide/wish-event/` lists only Anomaly (who has a `url`)
and reports `1 valid item detected` with **no** non-critical issue. The other 8 pages
differ only by that one author entry.

The fix is therefore accuracy, not a workaround — they are also never credited visibly on
those guide pages, so claiming them as an author there was unsupported markup:

- **8 guide pages**: `author` → Anomaly only.
- **`index.html`**: `author` → Anomaly only; the three other people the page *does* credit
  moved to `contributor`, matching the visible `<footer class="gem-contributors">` headed
  "Contributors".

No value was invented. Adding a fabricated `url` would be the same violation as inventing
an `aggregateRating`.

## Finding 3 — what remains, and why it stays

The `Software Apps` items on `/` and `/authors/anomaly/` still report
`Missing field "aggregateRating" (optional)`.

This is **accepted divergence**, for two independent reasons:

1. The property is optional — Google states the item is valid without it.
2. Clearing it would require inventing a rating, which is fabricated review data and a
   guidelines violation. `tests/structured-data.test.js` (I6) additionally forbids
   `aggregateRating` anywhere in the graph, so "fixing" it would fail the test suite.

## Changes made

| File | Change |
|---|---|
| `about/index.html` | + `BreadcrumbList`; + top-level `Organization`; `publisher` → typed `@id` reference |
| `authors/anomaly/index.html` | + `BreadcrumbList` |
| `privacy/index.html`, `terms/index.html` | + `BreadcrumbList` |
| `index.html` | `VideoGame` + `alternateName`/`url`; `ImageObject` + `name`; `author` → Anomaly; + `contributor` ×3 |
| `guide/{code,beginners,event,pvp,login,faq,xp,redeem}/index.html` | `VideoGame` + `alternateName`/`url`; `ImageObject` + `name`; `author` → Anomaly only |
| `guide/wish-event/index.html` | `VideoGame` + `alternateName`/`url`; `ImageObject` + `name` |
| `scripts/generate-watch-pages.js` | watch hub: + `BreadcrumbList` and `CollectionPage.breadcrumb` |
| `watch/index.html` | regenerated (only file the watch generator changed — the 215 per-video pages are byte-identical) |
| `AGENTS.md` | two new architecture rules recording the ceiling and the author rule |

Deliberately **not** done: `Speakable` sitewide (news-only), `Organization` sitewide
(Google says unnecessary), `FAQPage` removal (real content, still parsed), invented
`aggregateRating`/`url`/dates.

## Verification

```
npm run test:structured-data   -> passed for 16 pages
npm run test:watch-pages       -> 42 passed, 0 failed
npm run test:music             -> passed (19 pages, 27 creators, 11 cards)
npm run test:nav               -> passed
npm run test:creators          -> 76 passed, 0 failed
npm run verify:schema          -> 20 pages checked, 20 passed, 0 failed
```

Generator idempotency: re-running all six generators changed no file, so the hand edits
are not being overwritten by `npm run build`.

Live Rich Results Test (deployed state, before this change):

```
/guide/code/        4 valid items | Articles: Non-critical issues detected
/guide/xp/          4 valid items | Articles: Non-critical issues detected
/guide/wish-event/  1 valid item  | Articles: clean        <- control
/authors/anomaly/   2 valid items | Software Apps: Non-critical issues detected
```

## How to confirm the fix after deploy

The Rich Results Test reads the live URL, so the author fix cannot show until the change is
pushed. Re-run:

```
chrome --remote-debugging-port=9222 --user-data-dir=<repo>/.rrt-profile
node scripts/audit-rich-results.js --cdp http://127.0.0.1:9222 \
  --url "https://anomaly-alpha.github.io/guide/xp/,https://anomaly-alpha.github.io/about/" \
  --out data/rrt/author-fix-verify.json
```

Expected: `Articles` on `/guide/xp/` reports `1 valid item detected` with no non-critical
note; `/about/` gains a `Breadcrumbs` item (page count rises from 1 to 2).

`audit-rich-results.js` only records the phrase `Non-critical issues detected` in its
`detail` field. To read the per-issue strings you must drill the UI: click
`Non-critical issues detected`, then the item row.
