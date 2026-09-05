# September 2026 Complete Site Freshness Update

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/site-freshness.md)

Status: approved design for implementation planning
Snapshot date: 2026-09-04

## [S1] Goal and success definition

Refresh the public Invincible GTG site so its data, guide copy, SEO metadata, indexation signals, and structured data describe the current site state as of 2026-09-04.

The update is successful when:

- supplied promo-code changes are represented exactly once in the source data and all generated code surfaces agree;
- every /guide/*/ route has current, evidence-backed prose and synchronized metadata;
- creator and video records are rechecked against public YouTube evidence and remain inside the existing eligibility contract;
- every indexable site page has valid, page-appropriate JSON-LD with stable entity relationships;
- sitemap membership, robots directives, canonical URLs, visible freshness labels, and structured-data dates agree;
- automated generation, structured-data, build, browser, and Lighthouse checks pass.

## [S2] In-scope pages and exclusions

In scope:

- /;
- every /guide/*/ route in the sitemap: code, beginners, event, pvp, login, faq, xp, redeem, and creators;
- /authors/anomaly/;
- /music/;
- /privacy/;
- /terms/;
- sitemap.xml, robots.txt verification, and CHANGELOG.md.

The author, music, privacy, and terms pages become indexable. The SEO dashboard (seo/) remains internal and noindex. The independent skarn-bot/ project, 404/test pages, internal docs, and historical SERP dumps are excluded.

All guide routes receive a content rewrite. The creator directory’s generated creator/video records remain source-driven; only its maintained introductory/editorial copy is rewritten directly or through its generator template.

## [S3] Promo-code source and generated surfaces

Edit only data/codes.json for code records.

Required source state:

- set top-level updated to 2026-09-04;
- keep JUL4TH expired on 2026-07-29;
- keep DINOSR active with dateAdded 2026-05-19 and reward 1 x Dinosaurus;
- set GLOB34 expired on 2026-08-28, with its existing 500-gem reward;
- add exactly one active RAID02 record with dateAdded 2026-08-31, zero tracked gems/tickets, and reward text 1 x Bulletproof, 1 x Powerplex;
- do not substitute the existing RAID26 record for RAID02.

The supplied app/source record is accepted as the initial evidence for RAID02; the freshness ledger records it and notes any conflicting external result without silently changing the code identifier.

Run the existing code generator after the source edit. The resulting data/generated/promo-codes.js, root inline promo-code payload, code chips, counts, share copy, visible update labels, and generated code-page title must agree. Add generator-owned freshness markers for the code page’s date meta, description, Article modified date, and visible labels so they cannot drift from data/codes.json; preserve the original publication date.

## [S4] Tavily research and evidence ledger

Use the available Tavily search and extraction tools for current-content discovery. Tavily snippets are discovery signals, not final evidence.

Research order:

1. Check official Ubisoft/game and redemption sources for code status, reward, portal, game mechanics, and current event information.
2. Check direct public YouTube channel/video pages for creator identity, canonical video URL, title, publication date, standard-video format, and current availability.
3. Use multiple reputable community sources for strategy or interpretation when first-party documentation does not cover the claim.
4. Resolve conflicts in favor of direct first-party evidence; if no reliable evidence resolves a conflict, preserve the existing numeric value and record the uncertainty.

Record the research in docs/reports/2026-09-04/unknown/site-freshness-evidence.md. Each entry includes page or data record, claim, previous value, new value, source URL(s), retrieval date, evidence summary, and disposition. The report is an audit trail, not a page citation dump.

## [S5] Creator and video refresh

Edit only data/youtube-creators.json for creator/video records, then run npm run generate-creators.

The full refresh must:

- recheck every visible active and pending creator;
- update the top-level updated, creator lastChecked, and rechecked video lastChecked values to the snapshot date;
- add newly published eligible standard YouTube videos with verified 11-character IDs, canonical URLs, dates, categories, descriptions, evidence notes, and status;
- exclude Shorts and other ineligible formats;
- mark removed or unavailable videos as unavailable with a status reason;
- demote creators to pending or hidden when current evidence no longer satisfies the existing thresholds;
- preserve creator IDs and display order unless an evidence-backed identity/status correction is required;
- preserve the existing thresholds: active creators need at least 6 eligible videos, at least 3 within 180 days, and exactly 6 featured videos; pending creators need at least 1 eligible video;
- respect the existing 12-video rendered cap.

No unverifiable creator or video is promoted to active. Generated data/generated/youtube-creators.js and the marked sections of guide/creators/index.html are the only public outputs of the creator generator.

## [S6] Guide and policy content rewrite

Rewrite human-facing prose, headings, FAQs, explanations, and examples on every guide route. Preserve calculators, JavaScript behavior, inline configuration, payout tables, and other numeric data unless direct evidence requires a correction.

Numeric claims—including gem totals, PvP payouts, event rewards, XP costs, code rewards, dates, and thresholds—must come from repository source data or verified evidence. Do not infer a number from a search snippet or from rewritten prose.

Every FAQPage entry must match a question and answer visibly rendered on the same page. Remove stale FAQ entries rather than keeping schema that no longer reflects the page.

Privacy and terms are also rewritten, but their source of truth is the current policy text plus verified repository behavior. The rewrite may make substantive changes to factual, rights, analytics, storage, external-embed, and liability language, but must not invent operational behavior. Automated checks are the selected release gate; passing them does not certify legal compliance.

## [S7] SEO metadata and freshness rules

Use concise, query-first, unique titles targeting roughly 50–60 characters where practical.

Create a title matrix in the freshness evidence report before editing. It records each in-scope URL, primary search intent, final title, character count, and the synchronized OG/Twitter/JSON-LD values. Titles must remain unique, lead with the relevant Invincible GTG query, and avoid unsupported numeric claims.

Indexed game-content pages—home and all guide routes—receive reviewed September title wording and a [Sep 2026] suffix where it fits. The author profile, music, privacy, and terms titles remain evergreen even though those pages become indexable.

When a page title changes, synchronize:

- title;
- og:title;
- twitter:title;
- JSON-LD headline where present.

For pages actually rewritten or technically refreshed, use 2026-09-04 for page-level dateModified, visible review/update text, and sitemap lastmod. Preserve each page’s original datePublished. The expected publication dates for currently undated schema are: creators 2026-08-23, privacy 2026-07-17, terms 2026-07-17, and music 2026-07-17, based on the earliest known file history.

Music gets a separate source-level reviewed date of 2026-09-04 in data/playlists.json and displays it as Reviewed. Keep playlists.updated tied to actual playlist-content changes; do not reset it merely because the page was reviewed.

Add a September entry to CHANGELOG.md describing the code, creator, guide, indexation, SEO, and schema refresh.

## [S8] Structured-data contract

Every JSON-LD block must independently include the schema.org context, parse as JSON, and use page-appropriate schema. Shared entities use stable absolute IDs:

- https://anomaly-alpha.github.io/#game for Invincible Guarding the Globe;
- https://anomaly-alpha.github.io/authors/anomaly/#person for Anomaly;
- https://anomaly-alpha.github.io/#organization for Anomaly Alpha.

Required page behavior:

- Home keeps its existing comprehensive graph and adds page-level freshness data to WebPage.
- Standard guides retain BreadcrumbList, VideoGame, and Article; FAQPage, HowTo, and DefinedTerm appear only where the visible page content supports them. Align the XP and redeem VideoGame nodes and publisher logo with the fuller site pattern.
- Creators retains CollectionPage, VideoGame, BreadcrumbList, and generated ItemList/VideoObject data. Add the missing collection datePublished and the missing context on the generated ItemList. YouTube uploadDate remains the video publication date, not the site review date.
- Author becomes an indexable ProfilePage whose mainEntity is a fully described Person; the Person’s ID and url point to the author profile URL. Add complete OG/Twitter metadata, including profile image/type and og:image:alt.
- Music receives a valid CollectionPage plus BreadcrumbList and playlist collection representation, while preserving its new indexable status.
- Privacy and terms retain Article, add their original datePublished, use 2026-09-04 dateModified after the policy rewrite, and define or inline every referenced Person, Organization, and site/game node so no local ID is dangling.
- No page receives FAQ, Product, Review, or VideoObject schema without matching visible content.

Structured-data checks validate syntax, per-block context, canonical URL alignment, expected page types, required entity relationships, stable IDs, and visible FAQ parity. They report Google rich-result eligibility separately; not every valid schema type produces a rich result.

## [S9] Indexation and sitemap

Remove noindex from the author, music, privacy, and terms pages. Keep seo/ noindex/nofollow.

The sitemap contains 14 indexable site URLs: the current 11 entries plus music, privacy, and terms. Retain the author entry now that it is indexable. Do not add the internal dashboard or the skarn-bot project.

Because the indexed pages are rewritten or receive a substantive metadata/schema/indexation update, their sitemap lastmod values are set to 2026-09-04. robots.txt continues to allow crawling and references the sitemap.

## [S10] Generated-file durability

The implementation must edit source/templates before generated outputs:

- data/codes.json → scripts/generate-codes.js → data/generated/promo-codes.js, index.html, and guide/code/index.html;
- data/youtube-creators.json → scripts/generate-youtube-creators.js → data/generated/youtube-creators.js and guide/creators/index.html;
- data/playlists.json plus its review-date field → scripts/generate-music.js → music/index.html.

Static guide, author, legal, sitemap, and metadata changes must remain compatible with later generator runs. Add or update generator markers when generated pages need new durable metadata; never rely on an untracked manual edit to generated content.

## [S11] Verification and release criteria

Run, in this order:

1. npm run update-codes;
2. npm run generate-creators;
3. npm run update-music;
4. the creator tests and new/updated structured-data regression tests;
5. npm run build;
6. a stale-reference audit confirming no unintended August freshness markers remain in in-scope pages;
7. browser inspection of every indexable page’s rendered JSON-LD, title, canonical, robots directive, and visible review date;
8. npm run lighthouse:all, npm run lighthouse:report, and npm run lighthouse:budget.

The structured-data regression test must cover all 14 indexable pages and assert:

- every JSON-LD block parses and has its own schema context;
- author ProfilePage.mainEntity resolves to the stable Person entity;
- all local references resolve to a node in the same document or are represented by a stable, typed entity reference;
- every Article has a headline, author, publisher, image, datePublished, and dateModified;
- every FAQ schema entry has matching visible FAQ content;
- sitemap URLs are canonical and indexable, and noindex pages are absent;
- generated creator and code output remains idempotent.

Use browser or Google Rich Results validation as supplementary evidence and report any type-specific eligibility limitation separately from structural correctness.

## [S12] Non-goals and risk controls

- No new runtime feature, calculator behavior, or chart behavior is part of this work.
- No numeric data is changed solely to make a title or date look current.
- No YouTube Shorts are added to the creator directory.
- No source is trusted solely because Tavily ranked it highly.
- No original publication date is replaced with the September snapshot date.
- No legal-content change is presented as legally certified merely because automated checks pass.
- No unrelated docs, sub-project, dashboard, or historical research files are rewritten.
