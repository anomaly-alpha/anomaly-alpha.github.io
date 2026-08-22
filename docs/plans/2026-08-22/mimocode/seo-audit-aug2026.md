---
feature: seo-audit-aug2026
status: designed
updated: 2026-08-22
model: mimocode
---

# SEO Audit & Optimization Plan — August 2026

## Goal

Improve organic traffic by addressing the highest-value Search Console opportunities, especially redemption-intent queries, calculator queries, and code-page competition. Preserve useful structured data and avoid changes whose value is only theoretical.

## Evidence

The latest Google Search Console export is `data/https___anomaly-alpha-20260822/`:

- Period: 2026-05-21 through 2026-08-20
- Clicks: 4,432
- Impressions: 60,370
- CTR: 7.34%
- Average position: 6.8
- Mobile share: 92.4% of clicks
- `/guide/code/`: 4,115 clicks and 52,456 impressions

The companion Generative AI export is `data/https___anomaly-alpha-20260822-Generative-AI-Features/`. It contains impression-only data and will be monitored manually for now; automated integration is deferred.

## Decisions

- Keep `FAQPage` JSON-LD. It no longer provides FAQ rich-result enhancement, but it remains useful semantic markup and costs little. Correct schema/content mismatches.
- Create a full `/guide/redeem/` guide rather than relying on a meta-only change.
- Review the code page `HowTo` schema against the visible redemption instructions and fix it if inaccurate.
- Prioritize traffic impact over schema severity: redemption and calculator opportunities are P0; schema cleanup follows.
- Rewrite meta descriptions rather than mechanically trimming them. Keep primary keywords and create similar, non-identical OG and Twitter descriptions.
- Optimize for code-query competition while also strengthening the calculator niche.
- Replace non-standard `Guide` entities with standard `Article` entities where appropriate; remove `DigitalDocument` entities.
- Add a homepage download section with two linked buttons: Apple App Store and Google Play. Do not add a third Ubisoft button.
- Defer the homepage `VideoGame` offer correction to a future audit, but add the download links and verify the remaining homepage schema does not make a false download claim.
- Defer automated Generative AI export integration until the export provides more actionable metrics than impressions alone.

## Scope

### In scope

- New full redemption guide at `/guide/redeem/`
- Code-page redemption metadata and HowTo review
- XP-page calculator targeting and schema repairs
- Full meta-description rewrites for code, PvP, and login pages
- Distinct OG/Twitter copy synchronized with each rewritten description
- FAQPage schema/content consistency review
- Standardization of `Guide`/`Article`/`DigitalDocument` entities
- Homepage App Store and Google Play download section
- Page-level SEO verification, structured-data validation, and Search Console follow-up

### Out of scope

- Automated Generative AI export processing
- A new SEO dashboard or third-party integration
- Removing FAQPage schema solely because rich results were deprecated
- Homepage VideoGame offer redesign beyond the agreed download section
- Broad site redesign or unrelated performance work

## Tasks

### P0 — Capture high-intent traffic

#### T1: Create the redemption guide

**File:** `guide/redeem/index.html`

Create a full, mobile-first guide of approximately 500 words covering:

1. The official portal URL: `https://redeem.invincible.ubisoft.barcelona/`
2. How to generate the in-game verification code
3. How to enter and submit a promo code
4. What to do when a code fails or has expired
5. Links to the active code list and relevant beginner guidance
6. A concise visible FAQ section for common redemption questions

Add self-referencing canonical, title, description, OG/Twitter tags, breadcrumb schema, Article schema, and appropriate internal links. Keep the page clear that the external Ubisoft portal performs redemption.

**Acceptance:** The page directly answers “redeem website,” “redeem code,” and “Ubisoft Barcelona” intent; all links work; metadata and schema match visible content.

#### T2: Optimize code-page redemption intent

**File:** `guide/code/index.html`

Rewrite the title and description to make redemption intent explicit while retaining active-code intent. The HTML description, OG description, and Twitter description must all be updated with similar but non-identical copy.

Include concepts such as “active Invincible GTG codes,” “redeem codes,” and “official Ubisoft Barcelona portal.” Do not make unsupported claims about code availability or rewards.

**Acceptance:** The title and all three descriptions clearly cover both codes and redemption; descriptions remain concise and useful in search and social previews.

#### T3: Optimize XP calculator intent

**File:** `guide/xp/index.html`

Update the title to include “XP Calculator,” for example:

`Invincible GTG XP Calculator & Level-Up Guide [Aug 2026]`

Rewrite the HTML description and create distinct synchronized OG/Twitter descriptions. Ensure the page visibly supports the calculator intent or clearly explains what the calculator/reference provides.

**Acceptance:** The title and visible page content target “Invincible GTG XP calculator” and related level-up/rank-cost queries without misleading users.

### P1 — Improve snippets and repair structured data

#### T4: Rewrite code, PvP, and login descriptions

**Files:**

- `guide/code/index.html`
- `guide/pvp/index.html`
- `guide/login/index.html`

Write each description from scratch for search CTR and AI summarization. Keep each within the project’s verified target range of approximately 120–160 characters, and verify the exact character count. Do not use identical copy across HTML, OG, and Twitter fields: each social variant should be similar, accurate, and intent-aligned.

Required keyword coverage:

- Code: active codes, rewards, redemption portal
- PvP: PvP guide, arenas/leagues, payouts or gems
- Login: login rewards, weekly gems, daily/weekly bonuses

**Acceptance:** Every page has accurate, non-truncated descriptions; OG and Twitter descriptions are synchronized semantically but not duplicated byte-for-byte.

#### T5: Repair XP schema

**File:** `guide/xp/index.html`

Repair the JSON-LD graph by:

- Adding the shared `VideoGame` entity with `@id: "#game"`
- Linking the Article and Guide replacement entity to `#game`
- Changing the Article image from `og-images/home.png` to `og-images/xp.png`
- Bringing the publisher logo/entity fields into alignment with the other guide pages
- Replacing the non-standard Guide entity with a standard Article representation where it adds useful information
- Removing the `DigitalDocument` entity

**Acceptance:** JSON-LD parses successfully, all local `@id` references resolve, and schema image metadata matches the page’s OG image.

#### T6: Review and repair code-page HowTo schema

**File:** `guide/code/index.html`

Compare each `HowToStep` and `HowToTool` against the visible redemption instructions. Keep the HowTo schema only if it accurately describes the visible process. Update stale wording or remove unsupported steps. Do not add HowTo content that is not visible to users.

**Acceptance:** Every retained HowTo step is represented in visible page content, in the same logical order, with no unsupported claims.

### P2 — Normalize page semantics and FAQ markup

#### T7: Reconcile FAQPage schema with visible FAQs

**Files:**

- `guide/code/index.html`
- `guide/pvp/index.html`
- `guide/beginners/index.html`
- `guide/faq/index.html`
- `guide/event/index.html`
- `guide/login/index.html`

Keep FAQPage schema, but make every Question name and accepted answer correspond to visible content. Resolve the known discrepancies:

- PvP: add the missing best-league question or remove it from schema if not visible
- FAQ: include the multiple-accounts question
- Beginners: align the second question’s wording
- Event: align “run” versus “rotate” wording
- Login: restore the complete third answer
- Code: decide whether the five visible FAQs should be represented and, if so, add exact matching entries

**Acceptance:** Every FAQPage Question/Answer pair is visible, materially identical to the page copy, and valid JSON-LD. No schema-only answers remain.

#### T8: Normalize non-standard schema entities

**Files:** all guide pages with these entities

- Replace `Guide` entities with standard `Article` entities only where a distinct, useful Article entity is needed and not already present.
- Remove `DigitalDocument` entities.
- Preserve valid `BreadcrumbList`, `Article`, `VideoGame`, `HowTo`, `FAQPage`, `DefinedTerm`, and other supported types when their content is accurate.

**Acceptance:** No unsupported `Guide` or `DigitalDocument` entities remain; no duplicate Article entities are introduced; all retained entities describe visible page content.

### P3 — Homepage distribution and verification

#### T9: Add homepage app download section

**File:** `index.html`

Add a visually consistent section with two prominent buttons and linked images/badges:

- Apple App Store: `https://apps.apple.com/us/app/invincible-guarding-the-globe/id6449294809`
- Google Play: `https://play.google.com/store/apps/details?id=com.ubisoft.invincible.guardians.globe.idle.superhero.rpg.battle.afk&hl=en_US`

Use accessible alt text, clear external-link behavior, and responsive layout. Use official store badge/image assets if available locally; otherwise use an existing site-native visual treatment rather than downloading unverified third-party images.

**Acceptance:** Both buttons work, are visible on mobile, use accessible names/alt text, and do not claim the site itself distributes the game.

#### T10: Update freshness metadata

**Files:** affected HTML pages and `sitemap.xml`

Only update `dateModified`, visible update dates, and `<lastmod>` when the page receives substantive content changes. Set the sitemap date to the actual implementation date, not merely the export date.

**Acceptance:** No page claims a modification date earlier than its actual substantive update; all changed pages have consistent metadata and sitemap dates.

#### T11: Verify the complete change

Run read-only verification after implementation:

1. Parse every JSON-LD block with a JSON parser.
2. Check every canonical, title, description, OG, and Twitter field.
3. Verify description lengths and semantic alignment.
4. Validate supported structured data with `https://search.google.com/test/rich-results` and general Schema.org structure with `https://validator.schema.org`.
5. Check the new page and homepage visually at mobile and desktop widths.
6. Run `node scripts/analyze-gsc.js` and confirm the new export remains selected.
7. Compare post-change GSC metrics after at least 2–4 weeks; do not infer success from same-day data.

**Acceptance:** All checks pass, no broken links or malformed schema remain, and no unrelated files are changed.

## Future Follow-up

- Reconsider automated Generative AI export reporting when GSC exposes actionable click or visit metrics.
- Audit and correct the homepage `VideoGame` offer semantics if Google reports a structured-data warning or if the entity is used for search features.
- Build dedicated gem, XP, and PvP calculators only after validating demand and maintenance cost.
- Reassess code-query competition using the next GSC export and compare impression/share changes against the current baseline.

## Sources

- Google Generative AI Performance reports: https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- Google Search updates: https://developers.google.com/search/updates
- Google snippets and meta descriptions: https://developers.google.com/search/docs/appearance/snippet
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org
- Apple App Store listing: https://apps.apple.com/us/app/invincible-guarding-the-globe/id6449294809
- Google Play listing: https://play.google.com/store/apps/details?id=com.ubisoft.invincible.guardians.globe.idle.superhero.rpg.battle.afk&hl=en_US
