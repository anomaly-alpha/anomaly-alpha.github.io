# Structured Data Upgrade — Implementation Plan

- Date: 2026-11-13
- Model: deepseek-v4.1-flash
- Spec: `docs/specs/2026-11-13/deepseek-v4.1-flash/structured-data-upgrade-spec.md`
- Audit: `docs/reports/2026-11-13/deepseek-v4.1-flash/schema-audit-report.md`
- Goal: ship spec §6 (R1-R7, A1-A2) with tests extended to lock each invariant, verified in Chrome via CDP.

## Preconditions

- `git status` clean before starting; note the baseline commit hash.
- Service-account key at `%APPDATA%\gcloud\service-account.json` (only needed to re-pull GSC, not to implement).
- Node 18+; `npm install` already done.

## Phase 0 — Baseline snapshot (5 min)

1. `git rev-parse --short HEAD` → record as `<base>`.
2. Run the four test suites and record pass/fail:
   `npm run test:structured-data`, `npm run test:watch-pages`, `npm run test:creators`, `npm run test:ads-fallback`.
3. Dump the pre-change JSON-LD for every page into a scratch file so the diff is auditable:
   one block per page via a throwaway Node script reading `script[type=application/ld+json]`.
4. Start the local server: `npm start` (port from `scripts/serve.js`). Confirm `http://localhost:<port>/` serves `index.html`.

**Acceptance:** all suites green pre-change; `<base>` recorded.

## Phase 1 — Generators first (order matters)

Generators rewrite output files, so generator changes must land before hand-edits to the same files. `index.html` is touched by `generate-codes.js` (ticker, promo cards, `ItemList` counts); `guide/code/index.html` is rewritten inside marker regions.

1. **`scripts/generate-youtube-creators.js`**
   - `:813` — `isPartOf` → `{ "@id": SITE_ORIGIN + '/#website' }`.
   - Add a `WebSite` node to the `@graph` at `:806-830`: `{ "@id": SITE_ORIGIN + '/#website', "@type": "WebSite", "name": "Invincible GTG", "alternateName": "Invincible Guarding the Globe Guides", "url": SITE_ORIGIN + '/', "inLanguage": "en" }`.
   - `:747-794` (`buildVideoObject`) — add `creator` next to `author`: `{ "@type": "Person", "name": creator.name, "url": creator.channelUrl }`.
   - Keep `publisher`, `about`, `duration`, `interactionStatistic` untouched.
2. **`scripts/generate-watch-pages.js`**
   - `:233-292` (watch page graph) — align the `WebSite` node with the canonical shape above (`alternateName`, `inLanguage`); do not change `WebPage`, `VideoObject`, `BreadcrumbList`.
   - `:728-754` (hub graph) — add the same `WebSite` node so `isPartOf` resolves.
3. **`scripts/generate-music.js`**
   - `:110-150` — add `isPartOf` → `/#website` on the `CollectionPage` and include the `WebSite` node in the emitted block.
4. Regenerate everything: `npm run build`.
5. `git diff --stat` — expect only `guide/creators/index.html`, `watch/index.html`, `watch/*/index.html`, `music/index.html` to change, and only inside JSON-LD blocks (plus minified field order if the generator reserialises).

**Acceptance:** `npm run test:watch-pages` and `npm run test:creators` pass; no non-JSON-LD diff in generated files.

## Phase 2 — Homepage repair (R1)

File: `index.html:860-1230` (single `@graph`).

1. `:865` `@id` → `"https://anomaly-alpha.github.io/#webpage"`.
2. `:870` `dateModified` → `"2026-10-31T00:00:00+00:00"` (keep the existing date value, only qualify it).
3. `:871-874` keep or drop `speakable` — keep (valid, no cost).
4. `:883-886` `about` → `{ "@id": "https://anomaly-alpha.github.io/#game" }`.
5. Add to the `WebPage` node: `"isPartOf": { "@id": "https://anomaly-alpha.github.io/#website" }`, `"mainEntityOfPage": "https://anomaly-alpha.github.io/"`, `"primaryImageOfPage": { "@id": "https://anomaly-alpha.github.io/og-images/home.png" }`, `"inLanguage": "en"`.
6. `:929-941` `WebSite` → add `"@id": "https://anomaly-alpha.github.io/#website"`, `"alternateName": "Invincible Guarding the Globe Guides"`, `"inLanguage": "en"`; **delete** `potentialAction`.
7. `:962-977` replace the `WebPageElement` wrapper with a top-level `ImageObject`:
   `{ "@id": "https://anomaly-alpha.github.io/og-images/home.png", "@type": "ImageObject", "contentUrl": "…/og-images/home.png", "url": "…/og-images/home.png", "width": 1200, "height": 630, "caption": "…", "license": "https://anomaly-alpha.github.io/", "acquireLicensePage": "https://anomaly-alpha.github.io/", "creditText": "Anomaly Alpha", "copyrightNotice": "© Anomaly Alpha", "creator": { "@type": "Organization", "name": "Anomaly Alpha", "@id": "https://anomaly-alpha.github.io/#organization" } }`.
8. `:1021-1026` and `:1036-1041` — delete both `aggregateRating` blocks (trailing comma handling: `sameAs` becomes the last property).
9. `:1097-1112` — delete the homepage `CollectionPage` node.
10. Verify the `Person` node at `:1113+` still ends the array with valid JSON.

**Acceptance:** `node -e` parse of the block succeeds; node inventory is `WebPage, VideoGame, WebSite, BreadcrumbList, WebApplication, ImageObject, Organization, Service, MobileApplication ×2, SoftwareSourceCode, ItemList, Person` — 13 nodes, one `WebPage`, one `WebSite`, zero `CollectionPage`, zero `aggregateRating`.

## Phase 3 — Guide pages (R2, R3, R4)

Files: `guide/{code,beginners,event,wish-event,pvp,login,faq,xp,redeem}/index.html`, `guide/creators/index.html`.

Per guide page, inside its `@graph`:

1. `Article.datePublished` / `dateModified` → `T00:00:00+00:00` suffix (values unchanged).
2. `Article.author[0]` → `{ "@id": "https://anomaly-alpha.github.io/authors/anomaly/#person" }`; keep remaining named co-authors and give each `"url"` only if a real profile exists (they do not — leave name-only).
3. Add `"mainEntityOfPage": "<page url>"`, `"isPartOf": { "@id": "https://anomaly-alpha.github.io/#website" }`, `"inLanguage": "en"`.
4. Add a `WebSite` node to the graph (canonical shape from Phase 1.1).
5. `Article.image` string → `ImageObject` (`contentUrl`, `url`, `width: 1200`, `height: 630`, `license`, `creator`, `creditText`, `copyrightNotice`, `caption` = page title).
6. `guide/code/index.html:165-211` — delete the whole `HowTo` node (including its `speakable`).
7. `guide/creators/index.html:236-278` — delete only the `CollectionPage` node from that hand-written block; keep `BreadcrumbList` and `VideoGame`.
8. `guide/xp/index.html` has no `FAQPage` — leave as-is.

**Acceptance:** each guide graph has exactly one `WebSite`, one page-level node, one `Article`; no `HowTo` anywhere; `grep -c HowTo` across the repo returns only `tests/` history/plan files.

## Phase 4 — Secondary pages (R6, R7)

1. `authors/anomaly/index.html:36-59` — add `"@id": "https://anomaly-alpha.github.io/authors/anomaly/"`, `"dateCreated": "2025-01-01T00:00:00+00:00"`, `"dateModified": "<latest content date>T00:00:00+00:00"`, `"inLanguage": "en"`, `"isPartOf": { "@id": "https://anomaly-alpha.github.io/#website" }`, and a `WebSite` node; enrich `mainEntity` with `"image"`, `"jobTitle": "Founder and editor"`, `"knowsAbout": ["Invincible: Guarding the Globe", "Mobile game rewards", "Promo codes"]`.
   - The `Person` `@id`/`url`/`name` must not change (`tests/structured-data.test.js:97-100`).
   - Convert to an `@graph` block if needed to host the `WebSite` node; keep `@context` `https://schema.org`.
2. `about/index.html:50-95` — qualify dates; `AboutPage.mainEntity` → `{ "@id": "https://anomaly-alpha.github.io/#game" }`; add `isPartOf` + `WebSite` node.
3. `privacy/index.html:47-90`, `terms/index.html:47-90` — qualify dates, add `isPartOf` + `WebSite` node.
4. `music/index.html` — regenerated in Phase 1.3; verify only.

**Acceptance:** no page in the repo references `/#website` without defining it.

## Phase 5 — Extend the test suite (locks the invariants)

File: `tests/structured-data.test.js`.

1. `:124` `requiredTypes['guide/code/index.html']` — remove `'HowTo'`.
2. Add a new invariant section (after the dangling-ref check at `:273`):
   - I1: for each of the 16 pages, exactly one top-level `WebSite` node, `@id === 'https://anomaly-alpha.github.io/#website'`.
   - I2: exactly one page-level node per page (`WebPage|CollectionPage|ProfilePage|AboutPage|Article`) whose `url`/`@id` equals the canonical URL.
   - I4: every `datePublished|dateModified|uploadDate|dateCreated` string matches `/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$|Z$/`.
   - I5: every top-level `ImageObject` with a `contentUrl` also has `width`, `height`, and one of `license|creator|creditText|copyrightNotice`.
   - I6: no `SearchAction`, no `HowTo`, and no `aggregateRating` in any of the 16 pages; plus a repo-wide `watch/**` scan allowing `interactionStatistic` but not `aggregateRating`.
3. Keep `PAGES` at 16 — do not add watch pages here (owned by `tests/youtube-watch-pages.test.js`).
4. Add to `tests/youtube-watch-pages.test.js`: `buildVideoObject` must include `creator` with `url`, and the hub must define the `WebSite` node it references.

**Acceptance:** suite green; then deliberately break one invariant (e.g. re-add `SearchAction`) and confirm the suite fails, then restore.

## Phase 6 — Build and browser verification (Chrome DevTools)

1. `npm run build` — regenerates Tailwind/CSS/JS + all generators. Confirm `git status` shows no unexpected file.
2. Re-run Phase 5 suites (idempotency must be clean).
3. **CDP verification** — serve the site and drive a real Chrome instance:
   - Preferred: `playwright_browser_navigate` to `http://localhost:<port>/…` for all 17 JSON-LD pages, then `playwright_browser_evaluate` with a function that collects `[...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent)`, parse each, and return `{ page, blockCount, types, nodeIds, dateViolations, imageViolations }`.
   - Assert per page: parse OK, `@context` present, exactly one `WebSite`, no duplicate page node, I4/I5/I6 satisfied, zero dangling `@id`.
   - `playwright_browser_console_messages` on the home page and one guide + one watch page: zero errors.
   - Screenshot the home page and one guide to confirm no visual change (the diff must be markup-only).
4. **Fallback if the MCP browser is unavailable:** `npx lighthouse` already launches Chrome; write `scripts/verify-structured-data.js` that uses `chrome-launcher` (already a dependency) + CDP `Runtime.evaluate` to run the same assertions headlessly, and wire it as `npm run verify:schema`.
5. `npm run lighthouse:home` — record scores; abort if LCP/CLS regress beyond the previous run.

**Acceptance:** every page passes I1-I6 from the rendered DOM; console clean; Lighthouse not regressed.

## Phase 7 — Report and handoff

1. Append a "Resolution" section to the audit report: each headline finding → what changed → new GSC-facing expectation (e.g. "Review snippets detection will disappear at the next crawl; that is the intended outcome").
2. `git status` review; stage only the intended files.
3. Commit locally (no push — repo policy: the user pushes from another terminal). Suggested message: `Fix invalid, duplicated and retired structured data; wire entity graph`.
4. Remind the user to `git push`, then re-run `npm run pull-gsc -- --inspect-limit 45` in 3-7 days to confirm: `HowTo`/review-snippet detections gone, `Breadcrumbs` + `Image Metadata` retained, no new issues.

## Verification matrix

| Change | Unit test | Generator idempotency | CDP DOM check | GSC follow-up |
|---|---|---|---|---|
| R1 homepage graph | `test:structured-data` | n/a | yes | next crawl |
| R2 guide dates/author/image | `test:structured-data` | `generate-codes.js` | yes | next crawl |
| R3 `HowTo` deleted | extended test | `generate-codes.js` | yes | `.HowTo` detection gone |
| R4 creators duplicate | `test:creators` | yes | yes | — |
| R5 watch hub ref | `test:watch-pages` | yes | yes | — |
| R6 author profile | `test:structured-data` | n/a | yes | — |
| R7 secondary pages | `test:structured-data` | `generate-music.js` | yes | — |
| A1 `VideoObject.creator` | `test:watch-pages` | yes | yes | Video report clean |

## Rollback

`git reset --hard <base>` restores everything; no database, no deployment, no data-source change. If only the aggregateRating removal is contested, re-add it together with a visible, sourced rating block — never markup-only.

## Appendix — research citations

- Article: https://developers.google.com/search/docs/appearance/structured-data/article
- Organization: …/structured-data/organization
- ProfilePage: …/structured-data/profile-page
- VideoObject: …/structured-data/video
- Breadcrumb: …/structured-data/breadcrumb
- Carousel (ItemList eligibility): …/structured-data/carousel
- Event (physical-location rule): …/structured-data/event
- Software app: …/structured-data/software-app
- Image licence metadata: …/structured-data/image-license-metadata
- Structured data policies (visible content): …/structured-data/sd-policies
- HowTo/FAQ changes 2023-08-08: developers.google.com/search/blog/2023/08/howto-faq-changes
- Sitelinks search box removed 2024-11-21: developers.google.com/search/blog/2024/10/sitelinks-search-box
- Seven types retired 2025-06-12: developers.google.com/search/blog/2025/06/simplifying-search-results
- Changelog: developers.google.com/search/updates
- AI optimisation guide (llms.txt ignored): developers.google.com/search/docs/fundamentals/ai-optimization-guide
