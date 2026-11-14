# Structured Data Upgrade — Spec

- Date: 2026-11-13
- Model: deepseek-v4.1-flash
- Status: accepted (implementation pending)
- Evidence: `docs/reports/2026-11-13/deepseek-v4.1-flash/schema-audit-report.md` (GSC pull of 2026-11-13), `data/gsc-api/2026-11-13/`
- Plan: `docs/plans/2026-11-13/deepseek-v4.1-flash/structured-data-upgrade-plan.md`

## 1. Goal

Make the site's JSON-LD *correct, policy-compliant, and internally consistent*, and stop paying page weight for markup that cannot produce a result. No new rich-result type is achievable on this site today — that is a finding, not a failure of effort, and the spec records the evidence for each rejected type so nobody re-litigates it next quarter.

Success is defined as:

1. Every page ships one coherent entity graph with no dangling `@id`, no duplicate page nodes, and no type that Google has retired.
2. No marked-up value is absent from the visible page (Google structured-data policy).
3. All existing structured-data tests pass, extended with assertions that would have caught each defect fixed here.
4. Rendered output verified in a real Chrome instance via CDP, not just by reading source.

## 2. Evidence base

### 2.1 What Search Console actually sees

| Fact | Value | Source |
|---|---|---|
| URLs inspected | 45 | `data/gsc-api/2026-11-13/url-inspection.json` |
| Indexed (`PASS`) | 10 — home + 9 guides | same |
| Unknown to Google (`NEUTRAL`) | 35 — wish-event, authors, music, about, privacy, terms, watch hub, 26 watch pages | same |
| Rich-result item types detected | `Breadcrumbs` (10), `Image Metadata` (9), `Review snippets` (home only) | same |
| Rich-result *appearances* in 181 days | one row: `TRANSLATED_RESULT` | `search-appearance-full.json` |
| Clicks on `/guide/code/` | 22,069 of 23,555 (93.7%) | `pages-full.json` |
| Sitemap state | 1 sitemap, submitted 2026-10-31, `isPending: true` | `sitemaps.json` |

Two conclusions drive the whole spec:

- **Detected is not earned.** Every indexed page passes rich-result validation, yet the site earns zero breadcrumb, review, video or FAQ appearances. Validation success is not a reason to keep or add markup.
- **`Review snippets` detected on the homepage is a liability.** The `aggregateRating` values (iOS 4.8/63,000, Android 4.4/86,000) exist only inside JSON-LD — they appear nowhere in visible page text. Google requires marked-up content to be visible, so this is a policy exposure with a measured payoff of zero appearances.

### 2.2 What Google supports as of November 2026

| Type on site | Status | Consequence |
|---|---|---|
| `HowTo` | Deprecated; docs removed 2025-09-14 | Delete the node, keep the visible steps |
| `FAQPage` | Rich results ended 2026-05-07 (restricted to gov/health since 2023-08-08) | Keep the markup only as semantic scaffolding; expect nothing; do not invest |
| `SearchAction` | Sitelinks search box removed 2024-11-21 | Delete; the current target (`google.com/search?q=site:…`) was never a valid implementation |
| `Event` | Since 2025-06-05/25 requires a physical location bookable by the public | In-game events are ineligible; do not add |
| `VideoGame` alone | No rich result unless co-typed with an app type *and* carrying `offers` + rating/review | Keep as an entity; do not co-type (the rating is being removed) |
| `ItemList` carousel | Only `Course`, `Movie`, `Recipe`, `Restaurant` | The creators `ItemList` and home `ItemList` of `Code` yield no carousel; keep as structure only |
| `ProfilePage` | Supported; `mainEntity` required | Upgrade the author page |
| `ImageObject` license fields | Supported; `license` required for the Licensable badge | Extend to `Article.image` |
| `Quiz`, `Dataset`, `Speakable`, `DiscussionForumPosting`, `QAPage` | Ineligible, out of vertical, or requires real UGC | Rejected — see §5 |
| `llms.txt`, AI-specific markup | Google Search ignores it; requires no special markup | Rejected |

Sources: `developers.google.com/search/docs/appearance/structured-data/*` (article, organization, profile-page, video, breadcrumb, carousel, event, software-app, image-license-metadata, sd-policies), `search/blog/2023/08/howto-faq-changes`, `search/blog/2024/10/sitelinks-search-box`, `search/blog/2025/06/simplifying-search-results`, `search/updates`, `search/docs/fundamentals/ai-optimization-guide`. Full citations in the audit report and the research brief captured in §7 of the plan.

## 3. Non-goals

- **Fixing indexation.** 35 of 45 URLs are unknown to Google. That is a discovery/thin-content problem; schema changes cannot move it and must not pretend to. Follow-ups are listed in the audit report §5.
- **Chasing rich results that no longer exist.** No work on `FAQPage` content expansion, `HowTo` step quality, or `SearchAction`.
- **Inventing ratings, reviews, or prices.** No new `Review`, `aggregateRating`, `Product`, or `Offer` data. `tests/structured-data.test.js:203-204` already bans `Product`/`Review`; this spec extends the ban to `aggregateRating` on our own properties.
- **Restyling or copy changes.** Zero visible-content edits. Every change is inside `<script type="application/ld+json">` or the generator that emits it.

## 4. Target entity graph

One canonical `@id` per entity, defined once per page and referenced by `@id` everywhere else. Absolute URLs only.

| Entity | `@id` | Defined on | Referenced by |
|---|---|---|---|
| WebSite | `https://anomaly-alpha.github.io/#website` | every page with JSON-LD | `isPartOf` on page nodes |
| WebPage (home) | `https://anomaly-alpha.github.io/#webpage` | home | `mainEntityOfPage` |
| Organization | `https://anomaly-alpha.github.io/#organization` | home; `publisher` inline on guides | `publisher` |
| VideoGame | `https://anomaly-alpha.github.io/#game` | home + guides | `about` |
| Person | `https://anomaly-alpha.github.io/authors/anomaly/#person` | author page | `author`, `accountablePerson`, `reviewedBy` |
| Primary image | `https://anomaly-alpha.github.io/og-images/<page>.png` (as `@id` on the `ImageObject`) | each page | `primaryImageOfPage`, `Article.image` |
| VideoObject | `https://anomaly-alpha.github.io/watch/<id>/#video` | watch page | `WebPage.mainEntity` |
| Video index | `https://anomaly-alpha.github.io/guide/creators/#video-index` | creators | `CollectionPage.mainEntity` |

Invariants (enforced by tests, §6):

- I1 — one `WebSite` node per page, `@id` = `/#website`.
- I2 — one page-level node per page (`WebPage`/`CollectionPage`/`Article`/`ProfilePage`/`AboutPage`); never two nodes describing the same URL.
- I3 — every `@id` reference in a page resolves to a node in that page's graph.
- I4 — every datetime carries an offset (`YYYY-MM-DDT00:00:00+00:00` for date-only editorial values).
- I5 — every `ImageObject` carries `contentUrl`, `width`, `height`, and one of `license`/`creator`/`creditText`/`copyrightNotice`.
- I6 — no `SearchAction`, no `HowTo`, no `aggregateRating` on a node whose values are not visible on the page.

## 5. Rejected additions (decided, do not reopen without new Google documentation)

| Candidate | Decision | Reason |
|---|---|---|
| `Event` for in-game events | Reject | Physical-location + public-bookability requirement (2025-06-05); virtual in-game events cannot qualify |
| `HowTo` refresh | Delete instead | Type retired; docs deleted 2025-09-14 |
| `QAPage` for FAQ answers | Reject | Valid only when a page hosts exactly one question with user answers; ours are multi-question editorial FAQs |
| `Quiz` / practice problems | Reject | Education-topic queries only; our content is a game-rewards site |
| `Dataset` | Reject | Dataset Search only, nothing in Google Search |
| `Speakable` expansion | Reject | Still beta; news content, US English only |
| `DiscussionForumPosting` | Reject | Requires genuine user-generated posts and interaction; inventing it is spam |
| `SoftwareApplication` co-type on `#game` | Reject | Requires a rating/review we cannot source; `VideoGame` alone is the honest entity |
| `llms.txt` / "AI schema" | Reject | Search ignores it; no such markup is required for AI Overviews |
| `Organization.merchantReturnPolicy` / loyalty | Reject | We are not a merchant |
| `DefinedTerm` cleanup | Keep as-is | Valid schema.org; no feature consumes it, but removal is churn with no benefit |

## 6. Change list

Grouped by risk. `R*` = repair, `A*` = addition.

### R1 — Homepage graph repair (`index.html:860-1230`)

| # | Change | Why |
|---|---|---|
| R1.1 | `WebPage.@id` → absolute `https://anomaly-alpha.github.io/#webpage` | Relative `#webpage` resolves differently per page and cannot be cross-referenced |
| R1.2 | `WebSite` gains `@id: /#website`, `alternateName`, `inLanguage`; `potentialAction`/`SearchAction` deleted | Sitelinks search box removed 2024-11-21; current target points at google.com, never valid |
| R1.3 | `WebPage.about` becomes `{"@id": "…/#game"}` | It currently inlines a second, `@id`-less `VideoGame`, duplicating the real entity |
| R1.4 | `WebPage.isPartOf` → `{"@id": "/#website"}`; add `mainEntityOfPage`, `primaryImageOfPage` → the image's own `@id` (see R1.5), `inLanguage` | Entity wiring; makes the image and site references resolvable |
| R1.5 | The `WebPageElement` named "Image" is replaced by a top-level `ImageObject` whose `@id` is the image URL itself (`…/og-images/<page>.png`), not a page fragment | `WebPageElement` is not an image type; the nested `ImageObject` is why `Image Metadata` is detected but unattributable. The URL form also makes the node globally identifiable, so `primaryImageOfPage` resolves to the actual image rather than a page-local fragment |
| R1.6 | Both `MobileApplication.aggregateRating` blocks deleted | Values are invisible on the page; 0 review-snippet appearances in 181 days; self-serving-review exposure |
| R1.7 | Homepage `CollectionPage` node (`:1098`) deleted | It describes the same URL as `WebPage` with a contradictory type; its `hasPart` guide list duplicates `WebPage.hasPart` |
| R1.8 | `dateModified` → offset-qualified | I4 |

### R2 — Editorial pages: dates, author wiring, site linkage (10 guide pages, about, privacy, terms, music)

| # | Change | Why |
|---|---|---|
| R2.1 | `datePublished`/`dateModified` → `YYYY-MM-DDT00:00:00+00:00` | I4; consistent with watch pages, which already do this |
| R2.2 | `Article.author` first entry becomes `{"@id": "…/authors/anomaly/#person"}` and keeps a second named co-author; add `author.url` where a name-only Person exists | Google's Article doc recommends `author.url`; the entity already exists |
| R2.3 | `Article.mainEntityOfPage` → page URL; `Article.isPartOf` → `/#website`; `Article.inLanguage` | Entity wiring |
| R2.4 | A single `WebSite` node (`/#website`) added to each page's `@graph` | Makes R2.3/I3 resolvable without cross-page assumptions |
| R2.5 | `Article.image` (plain URL string) becomes an `ImageObject` with `contentUrl`, `width: 1200`, `height: 630`, `license`, `creator`, `creditText`, `copyrightNotice` | Licensable-badge / creator-credit eligibility (image license metadata) |

### R3 — Delete retired `HowTo` (`guide/code/index.html:165-211`)

Delete the node and its `speakable` block. The visible redemption steps stay untouched. Update `tests/structured-data.test.js:124` `requiredTypes` to drop `HowTo` and add `assert(!types.includes('HowTo'))` so it cannot come back.

### R4 — `/guide/creators/` duplicate node (`guide/creators/index.html:236-278`)

Delete the hand-written `BreadcrumbList`+`VideoGame`+`CollectionPage` block's `CollectionPage` node only — keep its `BreadcrumbList` and `VideoGame`, which the generated block does not contain. The generator-emitted `CollectionPage` (`:285`) remains the single page node. In `scripts/generate-youtube-creators.js:813`, `isPartOf` → `{"@id": SITE_ORIGIN + '/#website'}` and a `WebSite` node is added to that graph.

### R5 — Watch hub dangling reference (`scripts/generate-watch-pages.js:728-754`)

The hub references `/#website` but ships no `WebSite` node. Add it to the hub graph. Watch pages already define `WebSite` — verify they still match the canonical shape after R1.2 (same `@id`, `name`, `url`, `alternateName`, `inLanguage`).

### R6 — Author profile upgrade (`authors/anomaly/index.html:36-59`)

Add `@id` (page URL), `dateCreated`, `dateModified`, `inLanguage`, `isPartOf`, and enrich `mainEntity` `Person` with `image`, `jobTitle`, `knowsAbout`, `sameAs` (already present), `description` (present). The `@id`/`url` of the `Person` are test-frozen (`tests/structured-data.test.js:99-100`) and must not change.

### R7 — About / privacy / terms / music

Dates per R2.1; `AboutPage.mainEntity` → `{"@id": "/#game"}`; add `isPartOf` + `WebSite` node where a page node exists. Music is generator-owned (`scripts/generate-music.js:110-150`) — change the generator, never the output.

### A1 — `VideoObject.creator` (`scripts/generate-youtube-creators.js:747-794`)

Add `creator` as `{ "@type": "Person", "name": creator.name, "url": creator.channelUrl }` alongside the existing `author`. Documented property; costs nothing; the channel URL is already in the data.

### A2 — Licence metadata on `Article.image` / primary images

Covered by R2.5 and R1.5. Only `og-images/*.png` are eligible; YouTube thumbnails on watch pages are third-party and must **not** get a `license` field — keep `primaryImageOfPage` pointing at them without licence claims.

## 7. Data contracts

- Generated files are never hand-edited: `guide/creators/` (markers `<!--CREATORS_JSON_LD_START/END-->`), `music/index.html`, `watch/**`, `guide/code` marker regions, `data/generated/*`.
- `data/codes.json` remains the only hand-edited source for the active-code count; `npm run update-codes` must keep the `FAQPage` answer in sync (`tests/structured-data.test.js:213-223`).
- Generator idempotency (`tests/structured-data.test.js:277-295`) means every generator change must be committed *with* its regenerated output, or the test restores the snapshot and fails.

## 8. Test plan

Layered, cheapest first.

1. **Unit/contract (Node)** — extend `tests/structured-data.test.js` with invariants I1-I6, plus negative assertions: no `SearchAction`, no `HowTo`, no `aggregateRating` outside `watch/`. Run `npm run test:structured-data`, `npm run test:watch-pages`, `npm run test:creators`, `node tests/promo-codes-generator.test.js`.
2. **Generator idempotency** — `npm run build` then re-run the test suite; the working tree must stay clean for generated files.
3. **Rendered DOM (Chrome DevTools Protocol)** — start `npm start` (or `python -m http.server`), attach a real Chrome instance, and for each of the 17 JSON-LD pages: extract every `script[type="application/ld+json"]`, parse it, and assert the same invariants against the *rendered* DOM (catching generator/escaping defects that source-level tests miss). Also assert zero console errors and no CSP-blocked script.
4. **Rich-result sanity** — submit the local page HTML to schema.org-shaped validation via the same DOM payload (structural checks only; Google's Rich Results Test cannot validate a local, unpublished URL).
5. **Regression** — `npm run lighthouse:home` to confirm no perf regression from the (smaller and larger) JSON-LD payloads.

## 9. Risks and rollback

| Risk | Mitigation |
|---|---|
| Deleting `aggregateRating` loses the only `Review snippets` detection | Detection produced 0 appearances in 181 days; invisible values are a policy violation. Re-addition requires a visible, sourced rating block first |
| `FAQPage` retention is questioned again later | Documented in §5 with the 2026-05-07 date; tests keep the visible-text parity so it stays honest |
| Generator edits break byte-idempotency | Every generator change is followed by regeneration in the same commit; the idempotency test is the gate |
| Removing the homepage `CollectionPage` reduces "collection" semantics | The homepage is a calculator, not an index; `/guide/creators/` and `/music/` keep their `CollectionPage` nodes |
| A rejected type turns out to be supported later | §5 records the exact doc/date each rejection rests on; re-opening requires a newer citation |

Rollback is per-change: every repair is a self-contained node edit; `git revert` of the implementation commit restores the previous markup exactly, because no generated data source changes.

## 10. Open questions

1. Should `/about/` become the `Organization` home (it is currently a plain `AboutPage` while the home page carries the `Organization`)? Deferred — no rich-result effect.
2. `404.html`, `seo/`, `skarn-bot/` ship no JSON-LD. `404.html` is `noindex` and ineligible; `seo/` and `skarn-bot/` are excluded from the sitemap. Decision: no action, recorded here so the omission is intentional rather than an oversight.
