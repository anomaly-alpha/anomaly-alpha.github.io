# Schema & Rich-Results Audit - 2026-11-13

Status: complete
Sources: `data/gsc-api/2026-11-13/` (all JSON), page JSON-LD in each `index.html`, `tests/structured-data.test.js`.

## 1. Method

Search Console **Search Analytics** (web, discover, image — `summary.json:250,260`) and **URL Inspection** on `https://anomaly-alpha.github.io/` (`summary.json:2`), service-account key (`meta.json:4-5`; `ga4-reader@anomaly-alpha-gsc.iam.gserviceaccount.com`, `docs/reports/2026-11-07/deepseek-v4.1-flash/search-console-traffic-spike-root-cause.md:163`). Full window 2026-05-15 → 2026-11-11 (181 days) plus 28-day comparison windows (`summary.json:4-19`); snapshot has 45 inspection records and 0 pull failures (`summary.json:271-281`). Re-run: `npm run pull-gsc -- --inspect-limit 45` (default 25 at `scripts/pull-gsc.js:124`, flag read at `:307`).

Totals, 181 days: **23,555 clicks / 168,740 impressions / 13.96% CTR / position 5.05**; last 28 days 7,883 / 42,875 / 18.39% / 4.13 (`summary.json:21-42`).

## 2. Headline findings

1. **One URL carries the site.** `/guide/code/` took 22,069 of 23,555 clicks (93.7%) on 134,561 of 168,740 impressions (79.7%) at position 4.79 (`pages-full.json:3-10`); the 11th row, `/guide/codes/`, adds 1 impression and 0 clicks — 10 URLs carry all traffic.
2. **35 of 45 inspected URLs are unknown to Google** — `NEUTRAL`, `lastCrawlTime: null`, never crawled: `/guide/wish-event/`, `/authors/anomaly/`, `/music/`, `/about/`, `/privacy/`, `/terms/`, `/watch/`, and **28** (not 26) `/watch/<videoId>/` pages. The sitemap, submitted 2026-10-31T15:34:24Z, is still `isPending: true` with 0 errors and 0 warnings (`sitemaps.json:3-8`); `sitemap.xml` holds 210 URLs, 193 of them watch pages — all contribute zero clicks.
3. **One appearance type exists.** `search-appearance-full.json` has a single row, `TRANSLATED_RESULT`: 208 clicks / 2,453 impressions / 8.48% / position 5.81 (28-day: 115 clicks). No FAQ, video, review-snippet, breadcrumb or sitelink row in 181 days: no markup here produces a visible rich result.
4. **`Review snippets` is detected on the homepage and earns nothing.** Two `aggregateRating` nodes ship at `index.html:1021-1026` (iOS 4.8, 63,000) and `:1036-1041` (Android 4.4, 86,000). Neither value appears in the stripped `<body>` text, violating Google's visible-content requirement; both also rate a third-party app, a self-serving-review exposure.
5. **FAQ markup is inert by policy.** `FAQPage` ships on 8 pages (`/guide/{code,beginners,event,wish-event,pvp,login,faq,redeem}/`), 7 indexed. Google ended FAQ rich results 2026-05-07 (government/health only since 2023-08-08; `docs/specs/2026-11-13/deepseek-v4.1-flash/structured-data-upgrade-spec.md:44`): no FAQ appearance in 181 days. GSC reports only `Breadcrumbs` + `Image Metadata` for `/guide/code/` despite its `HowTo` and `FAQPage` nodes — retired types yield no item type.
6. **Breadcrumbs pass everywhere.** 10 of 10 indexed URLs carry `Breadcrumbs` (all `PASS`, 0 issues); `Image Metadata` covers 9 because `/guide/creators/` ships no `ImageObject`.
7. **The sample is partial:** 45 of 210 sitemap URLs inspected, so the true uncrawled surface is roughly 7× larger.

## 3. Schema inventory as shipped

Top-level `@graph` members of each page's JSON-LD block; inspected URLs only, as at the pull.

| Page | Top-level `@type` | GSC item types |
|---|---|---|
| `/` | WebPage, VideoGame, WebSite, BreadcrumbList, WebApplication, WebPageElement, Organization, Service, MobileApplication ×2, SoftwareSourceCode, ItemList, CollectionPage, Person | Breadcrumbs, Image Metadata, Review snippets |
| `/guide/code/` | BreadcrumbList, VideoGame, Article, HowTo, FAQPage, DefinedTerm | Breadcrumbs, Image Metadata |
| other indexed guides (`beginners`, `event`, `pvp`, `login`, `faq`, `xp`, `redeem`) | BreadcrumbList, VideoGame, Article, DefinedTerm (absent on `redeem`); FAQPage (absent on `xp`) | Breadcrumbs, Image Metadata |
| `/guide/creators/` | BreadcrumbList, VideoGame, CollectionPage; + CollectionPage, ItemList | Breadcrumbs |
| `/guide/wish-event/` | BreadcrumbList, VideoGame, Article, FAQPage, DefinedTerm | none |
| `/authors/anomaly/` | ProfilePage, Person, WebApplication | none |
| `/music/` | BreadcrumbList, CollectionPage, ItemList | none |
| `/about/` | AboutPage, Thing, Person | none |
| `/privacy/`, `/terms/` | Article (+ nested Person, Organization, VideoGame) | none |
| `/watch/` | CollectionPage, ItemList, ListItem | none |
| `/watch/<videoId>/` (28) | WebSite, VideoGame, WebPage, VideoObject, BreadcrumbList, ImageObject | none |

## 4. Rich-result gap analysis

| Rich result | Markup on site | Detected | Appearances | Verdict |
|---|---|---|---|---|
| Breadcrumbs | `BreadcrumbList`, 16 editorial + 193 watch pages | 10 / 10 indexed | no export row; unmeasurable | keep |
| Image metadata | `ImageObject`, home + 9 guides | 9 / 10 | none | keep |
| Review snippets | 2 `aggregateRating`, home only, values invisible | home only | 0 | fix — delete or source visibly |
| FAQ | `FAQPage`, 8 pages (7 indexed) | not detected | 0 | drop — ended 2026-05-07 |
| HowTo | `HowTo` + steps + tools, `/guide/code/` | not detected | 0 | drop — type retired |
| Video | `VideoObject`, 193 watch pages | not detected (0 indexed) | 0 | keep markup; blocker is indexation |
| Sitelinks search box | `SearchAction` via `WebSite.potentialAction`, home | not detected | 0 | drop — removed 2024-11-21 |
| ItemList carousel | `ItemList` of `Code` (home); `ItemList` (creators) | not detected | 0 | structure only — carousel: Course/Movie/Recipe/Restaurant |
| Translated results | no markup | n/a | 208 clicks / 2,453 impressions | nothing to do |

Net: 4 types detected, 1 appearance earned, 0 errors.

## 5. Indexation blockers (out of scope, ranked)

Discovery and demand, not schema; no JSON-LD change moves these.

1. **193 watch pages, none crawled.** Request indexing for the highest-demand videos in the GSC UI (unavailable via API); confirm `/guide/creators/` and `/watch/` emit crawlable `<a href>` links, not `ItemList` entries alone; check thin content — a page whose only unique text is a video title is unlikely to index.
2. **`/watch/` hub unknown**, so the cluster depends on the creators page and sitemap.
3. **`/guide/wish-event/` unknown** while 8 sibling guides are indexed: request indexing, then confirm guides link to it.
4. **`/music/`, `/about/`, `/privacy/`, `/terms/`, `/authors/anomaly/` unknown.** Low value except the author page, `Article.author`'s `Person` target.
5. **Sitemap pending since 2026-10-31** with no errors or warnings: confirm it reaches `Success` on the next pull.

## 6. Constraints for the fix

- `tests/structured-data.test.js:122-139` — `requiredTypes` demands `HowTo` for `guide/code/`; delete the node only together with the test edit.
- `:188-200` — every `FAQPage` question and answer must be visible text, blocking markup-only FAQ additions.
- `:202-210` — `Product`/`Review` banned; `VideoObject` needs a visible `name` or `description`; nothing guards `aggregateRating`, so the invisible homepage ratings survive.
- `:238-273` — the dangling-reference check asserts only for objects carrying `@type` (`:265`), so an untyped `{"@id": "…/#website"}` reference passes even with no `WebSite` definition.
- `:277-295` — idempotency: `scripts/generate-codes.js` (reverts hand edits to `index.html`, `guide/code/`, `guide/faq/`, `promo-codes.js`, `sitemap.xml`), `scripts/generate-youtube-creators.js` (`guide/creators/`), `scripts/generate-music.js` (`music/`) — edit the generator, not its output.
- `:174-181` — sitemap must hold exactly `16 + 1 + watch dirs` = 210 `<loc>` entries; `:224-230` — `lastmod` for `/`, `/guide/code/`, `/guide/faq/` must equal `data/codes.json` `updated`.
- `scripts/generate-watch-pages.js` and `buildVideoObject()` own all `/watch/` markup; `tests/youtube-watch-pages.test.js` validates it.

## 7. Resolution - 2026-11-13

Every fix below was implemented, then verified twice: by the Node contract suite (`npm run test:structured-data`, `test:watch-pages`, `test:creators`) and by a Chrome DevTools Protocol run against the rendered DOM (`npm run verify:schema -- --all`, 210/210 pages passing).

| Finding | Change | Expected at next crawl |
|---|---|---|
| 4 - invisible `aggregateRating` | Both `MobileApplication.aggregateRating` blocks deleted (`index.html`); `Person`/`Organization`/`Product` remain | `Review snippets` detection disappears on the homepage. That is the intended outcome: 181 days produced 0 review appearances, and invisible marked-up values are a policy violation |
| 5 - inert `FAQPage` | Markup retained deliberately (schema.org-valid, tests enforce visible-text parity); `HowTo` deleted from `/guide/code/` | `.HowTo` item type was never reported, so nothing is lost; no FAQ appearance was ever recorded |
| 6 - breadcrumbs / image metadata | Kept; `Article.image` promoted from a URL string to a full `ImageObject` (dimensions, licence, creator, credit) on all 9 guides | `Image Metadata` coverage should extend past `publisher.logo` to each page's primary image |
| Constraints - `requiredTypes` held `HowTo` | Test edited, plus new invariants I1-I6 and a proof-of-bite check | A regression now fails locally instead of surfacing in Search Console weeks later |

Also corrected while in the markup (not in the original findings, found during implementation):

- The homepage `WebSite` had a `SearchAction` pointing at `google.com/search?q=site:...`. The sitelinks search box was removed 2024-11-21 and that target was never a valid implementation, so it is gone.
- The homepage carried two nodes describing the same URL (`WebPage` and `CollectionPage`) plus a `WebPageElement` named "Image" wrapping an `ImageObject`; the homepage is now a single `WebPage` with a top-level `ImageObject`.
- `/guide/creators/` shipped two `CollectionPage` nodes; the hand-written duplicate is deleted and the generated one is authoritative.
- `/watch/` referenced `/#website` without defining it; the hub now emits the node.
- `scripts/generate-codes.js` and `scripts/generate-music.js` wrote bare `YYYY-MM-DD` datetimes into JSON-LD, which would have reverted the tz-qualified fix on the next build. Both generators now emit offset-qualified values.
- `/privacy/` and `/terms/` `Article` nodes had no `url`, so nothing identified them as their own page entity; both now do.

Deliberately not done: no schema was added for `Event`, `Quiz`, `Dataset`, `Speakable`, `DiscussionForumPosting`, `QAPage`, `SoftwareApplication` or `llms.txt` - each is either retired, restricted to a vertical this site is not in, or requires data (ratings, physical venues, real UGC) we do not have. The dated reasoning is in spec section 5.
