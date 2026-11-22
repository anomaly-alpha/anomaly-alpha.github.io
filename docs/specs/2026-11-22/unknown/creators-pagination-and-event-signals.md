---
feature: creators-pagination-and-event-signals
status: delivered
updated: 2026-11-22
source: main
---

# Creators Feed Browsing and Event Activity Timeline

## Report

**What was built** — `/guide/creators/` now renders all 390 playable videos from all 25 visible creators as static markup, 50 per batch on boundaries that never split a date group, with a load-more control, eight single-select category chips carrying full-set counts, and a native month `<select>` that reveals through the chosen month and scrolls to it. The active category persists as `?category=`. All browsing rules live in `creators-feed.js`, which Node requires and the browser loads, so nothing is implemented twice. The activity summary now describes the feed it sits above (`390 videos / 25 creators`) and the active-gated roster is retitled "Active channels". `data/generated/youtube-creators.js` — 63 KB loaded on every visit and read by no code — is deleted along with its tests.

`/guide/event/` gained an event activity timeline between the Total Event Income card and The Long Haul. `scripts/generate-event-timeline.js` finds 7-day windows holding ≥5 videos from ≥3 creators (**26 bursts**), labels them by verbatim version (4), curated multi-word entity match (11), or not at all (11), writes `data/event-signals.json`, and renders the block. Labelled rows precede unnamed ones, each links only videos that mention its own label, confirmed rows carry their guide link and publisher source, and the block declares no structured data. The page's six hand-maintained freshness fields are now driven from the data it is built from, moving only when the rendered block changes.

**Verification** — `npm run build` twice with no diff and both generators reporting a stable second run; suites green: `test:creators` 73, `test:feed` 27, `test:events` 34, `test:structured-data` 16 pages, `test:music`, `test:nav`, `test:watch-pages` 42, `test:ads-fallback`, `test:ads-txt`, `test:harvest`, `test:creator-audit`, `promo-codes-generator`, `verify:schema` 20 pages. Browser QA on both pages: load-more 50→105 on a date boundary, category filter 127 Events re-batched from 50 with `?category=events` restored on reload, month jump to Aug 2026 revealing 99 cards and landing the date marker 56px down (clear of the 44px banner), zero console errors, and a JS-disabled load showing all 390 cards with the toolbar hidden. After the review fix, a DOM assertion over all seven categories with every card revealed reported **0 orphaned cards and 0 marker/count mismatches**, and a JS-disabled load reported 390 cards in 196 day wrappers with 0 orphaned. Contrast measured in both colour modes: feed chips 7.29/5.76 dark/light, timeline rows 7.29–19.81 and 5.5–5.76, all above 4.5:1.

## [S1] Problem

`/guide/creators/` renders every creator video into one flat `<ol>`: **225 cards, 514 KB of a 656 KB page**, discovered only by scrolling. Five separate defects sit behind that number.

1. **The feed is unreadably long.** 225 cards in a single scroll, with no way to reach a specific period except by dragging the scrollbar. The page still earns 19 clicks / 1,743 impressions at position 8.0 (GSC, 13 Nov), so its structure matters.
2. **The feed is silently incomplete.** `MAX_VIDEOS_PER_CREATOR = 12` hides **165 of 390 playable videos**, and nothing on the page says so. A visitor reads the feed as the archive when it is less than two thirds of it.
3. **The page contradicts itself about its own size.** The activity summary above the feed is built from `getActiveCreators()`, while the feed below it is built from `getVisibleCreators()`. Rendered output states **"142 videos / 12 creators"** directly above a list of **225 cards from 25 creators**. The summary is wrong about the feed it introduces, and its "Channels in this feed" roster shows 12 channels while the feed carries 25.
4. **There is no way to look at the feed by kind.** It holds 196 distinct dates, 25 creators and seven categories (Events 127, Gameplay 84, Updates 79, Guides 40, Livestreams 28, Tier Lists 18, Team Building 14). A visitor who wants only Events videos has to scroll the whole archive and read every card.
5. **`data/generated/youtube-creators.js` is dead weight.** 63 KB is loaded on every visit to the page and **read by no code** — `script.js` never references `window.__YOUTUBE_CREATORS`, and no inline script on the page does either.

Separately, the page already promises a signal it never delivers. Its feed subtitle says *"Date markers make bursts around the same event easy to spot"*, and the summary block says *"when a major update or event lands, videos from different creators stack together here"* — but nothing on the site connects a burst to the event it represents.

Creator upload bursts do identify events. A 7-day window requiring ≥5 videos from ≥3 creators finds **26 bursts** across the 390-video corpus, and they land on real events: Trick or Treat, Boss Raid launch, Lock & Reload, Hero Boot Camp, Art's Outlet, Faction Recruitment, the July 2026 Wish Event, and Updates 3.5 through 3.8.

Search demand for this is real but specific (GSC, 13 Nov):

| Query | Impressions |
|---|---|
| invincible gtg event schedule | 92 |
| invincible guarding the globe event calendar | 57 |
| invincible gtg next event | 33 |
| next invincible gtg event | 28 |

`/guide/event/` already ranks position 6.9 for the event cluster and is where wish-event queries actually land — `/guide/wish-event/` itself has **zero** impressions, as do all 212 watch pages. A timeline on the page that ranks is the surface with evidence of earning; a new page per event has an established precedent for earning nothing. That page already tells visitors to leave for a schedule (`:477`, *"Event dates and rotations can change, so use the in-game event hub for the live schedule"*), which the timeline answers on-site instead.

## [S2] Design

### [S2.1] The feed is complete and static; all browsing is progressive enhancement

The `<ol id="creatorFeedList" class="gem-creators__feed">` contains **every playable video from every visible creator** (active + pending) — 390 today — newest first. The cap is removed from the feed only; see S2.4 for why `MAX_VIDEOS_PER_CREATOR` survives elsewhere.

This requires splitting the item list by consumer rather than deleting the constant. `getFeedItems` keeps its 12-per-creator cap for the noscript list and the JSON-LD index; a new uncapped `getCompleteFeedItems(data)` feeds `renderCreatorFeedHtml`.

Items beyond the first batch carry `gem-creators__item gem-creators__item--deferred`. CSS hides deferred items. Because the cards stay in the HTML, crawlers and no-JS visitors are unaffected — a `<noscript>` rule restores them.

**The reveal rule must outrank the hiding rule regardless of source order.** The page already has one inline `<style>` block *after* the `<head>` `<noscript>` at line 77, so an equal-specificity rule placed inside that noscript can lose the cascade. The hide rule is `.gem-creators__item--deferred{display:none}` (0,1,0); the noscript rule must be `.gem-creators__feed .gem-creators__item--deferred{display:block}` (0,2,0) and must live in the existing head noscript alongside the stylesheet re-links.

**Batch boundaries align to date groups.** A batch never splits videos that share a `published` date: the batch extends past the limit until the next item carries a different date. `FEED_BATCH_ITEMS = 50`, which yields 8 batches over the current data and 7 clicks to reveal everything. The largest single-date group in the data is 10 videos, so alignment never distorts a batch materially.

`creators-feed.js` (new, repository root, unminified, `defer`) owns the interactive behaviour described in S2.11 and S2.12 and nothing else. It never writes card content, mirroring the `music-banner.js` precedent.

A `<button type="button" class="gem-creators__more" data-feed-more aria-controls="creatorFeedList" hidden>` follows the `<ol>`. The generator emits it with `hidden` and with its final label pre-computed, so a JS-disabled visitor never sees a dead control, and it is unhidden only when a filter's next batch is actually deferred.

### [S2.2] A date marker always precedes every visible card

Each publication date is a `<li class="gem-creators__day">` owning one `gem-creators__date-marker` and an inner `<ol class="gem-creators__day-list">` of that day's cards. The structure — not a rendering trick — is what guarantees a marker above every card: a flat list puts the marker inside the first card of the day, and a category filter that hides that card orphans every sibling under no heading. Measured on the current data, **74 of 196 dates carry more than one category**, so with a flat list the Events filter left **43 of its 127 cards headerless**. Day wrappers also make date-group batch alignment structural rather than computed.

A day hides as a unit (`gem-creators__day--hidden`) when none of its cards are shown, and its marker reports the number of cards **currently under it** — the whole date unfiltered, the matching subset when a category is active — rather than a count from a different set. The month jump scrolls to the day wrapper, so it always lands on a real marker.

This is asserted two ways: `tests/creators-feed.test.js` proves the pure batching never splits a date group, and `tests/youtube-creators-generator.test.js` asserts the emitted markup nests every card inside a day whose marker precedes it.

### [S2.3] The summary describes the feed it introduces

The activity summary is rebuilt from the same complete feed it sits above: **390 videos / 25 creators**, matching the cards below. The "Channels in this feed" roster keeps `getActiveCreators()` — AGENTS.md makes it an active-gated discovery surface — so it is **retitled "Active channels"** to stop implying it enumerates the feed. Two different numbers, both true, each labelled for what it counts.

While a category filter is active (S2.11), the two summary stats switch to the filtered totals, because at that point the feed below genuinely contains only that category.

### [S2.4] JSON-LD and noscript are deliberately unchanged

The `CollectionPage`/`ItemList` JSON-LD keeps its existing 12-per-creator cap (225 entries) and its `numberOfItems`. An `ItemList` is a bounded index of the directory, not a completeness claim, and Google's own guidance for long lists is to bound them. The visible feed being larger than the index is expected and requires no markup change, so this stays out of the diff. This is why `getFeedItems` keeps its cap and only the feed gets the uncapped path.

The noscript block keeps its existing behaviour and cap. It exists as a playback fallback (its copy reads "Enable JavaScript to play videos in the modal"), and the S2.1 reveal already gives no-JS visitors the full feed with its own `/watch/` links.

### [S2.5] The dead browser bundle is removed

`renderJsOutput`, the `data/generated/youtube-creators.js` artifact, the `<script src="../../data/generated/youtube-creators.js">` tag on `/guide/creators/`, and the four tests asserting `window.__YOUTUBE_CREATORS` are deleted. No page consumes that bundle, so deleting it removes 63 KB from every visit to `/guide/creators/`.

`generate()` currently returns `{ html, js }`; the `js` field is removed along with the CLI write path for it. `tests/structured-data.test.js` line 362 also lists `data/generated/youtube-creators.js` as a snapshotted generator output, so that entry must drop the file or the suite will fail looking for it.

### [S2.6] Burst detection

New `scripts/generate-event-timeline.js`, run by `npm run generate-events`, wired into `npm run build`.

Inputs are `data/youtube-creators.json` and `data/game-context.json`. The detection corpus is **all 390 playable videos from all 25 visible creators**, the same corpus the feed renders.

Gating detection to currently-active creators was measured and rejected: it finds 19 bursts instead of 26 and silently erases seven, because channels that are pending *now* were live when those bursts happened. The discarded seven include:

```
2026-06-26..07-02   v=8  c=5   the July 2026 Wish Event — the one event this site has a page for
2026-05-23..05-29   v=7  c=3
2026-07-04..07-10   v=6  c=5
```

That is an artefact of applying the active-gate rule in the wrong place. The rule protects surfaces a visitor reads as "what is happening now"; a dated history is the opposite, and pending channels contributed 86 of the 390 playable videos.

Constants: `BURST_WINDOW_DAYS = 7`, `MIN_BURST_VIDEOS = 5`, `MIN_BURST_CREATORS = 3`.

Algorithm: sweep publication dates descending. For each unclaimed day, the window is `[day − 6 days, day]`. If the window holds ≥5 videos from ≥3 distinct creators, it is a burst; all its dates are claimed so a slow-burning week cannot produce overlapping bursts.

### [S2.7] Burst labelling — verbatim version, then curated, then nothing

Labelling has two successive attempts and then gives up, so it can only ever publish a name a source actually supports.

1. **Verbatim version label.** If titles matching `/\b(?:update|atualiza\w*|actualiza\w*|patch notes?)\s*v?(\d+(?:\.\d+)+)/i` name the same version across ≥2 distinct creators, the label is `Update <version>`, quoted from the titles rather than derived. This runs **first** because a version string is the most specific verifiable thing available. Measured on the current data it only ever competes with the `patch-notes` entity: the two conflicts become `Update 3.7` and `Update 3.5`, and every other burst either has a specific entity and no version, or a version and no entity.
2. **Curated entity.** Eligible entities are those in `data/game-context.json` whose `type` is `event`, `mode`, or `update`. `type: "system"` entries are excluded: they are always-on systems (`Artifacts`, `Cecil's Recruitment Department`), so matching one says nothing about activity. An alias only counts if it is **two or more words** — `recruitment-shops` aliases include bare `"summon"` and `"recruit"`, which match unrelated titles. A match needs ≥2 distinct creators and ≥2 videos; the winner is the entity with the most distinct creators, tiebroken by video count. The label is the entity's `name`, and its `guideHref` and `source` travel with it.
3. **Otherwise no label.** The burst renders with its date range, video count, creator count and dominant category, and its videos are listed beneath. Nothing unverifiable is published.

Free n-gram naming was measured and rejected: on this dataset it produced "criminal recruitment" for the Kradd/Update 3.8 burst and "ragnars are" for the Ragnars week, and returned nothing for 6 of 19 bursts. Measured over all 25 visible creators the committed output is **11 confirmed, 4 derived, 11 unlabelled across 26 bursts**.

### [S2.8] Evidence file

`data/event-signals.json` is written alongside the page and committed. It is the machine-readable record of what was detected and why:

```
{ "updated", "window": { "days", "minVideos", "minCreators" },
  "bursts": [ { "start", "end", "videoCount", "creatorCount",
                "status": "confirmed" | "derived" | "unlabelled",
                "label"?, "entityId"?, "source"?, "guideHref"?,
                "topCategory", "categories", "videos": [videoId] } ] }
```

`updated` is **copied from `data/youtube-creators.json.updated`, never the wall clock**. A `new Date()` here would rewrite the file on every run, breaking both byte-idempotent regeneration and the snapshot guard in `tests/structured-data.test.js`.

Ordering is deterministic (newest first), so regeneration is byte-identical.

### [S2.9] The timeline renders on `/guide/event/`

A new marker pair `<!--EVENT_TIMELINE_START-->` / `_END` sits **after the "Total Event Income" card and before "The Long Haul"** — that is, after the page's headline figure at `:470-478` and before the first detailed reward card at `:480`.

Placing it directly after the video rail was rejected: it would push the Total Event Income card, The Long Haul (3,430 bytes) and Earth's Defenders (3,502 bytes) an estimated 1,500–2,500px down on a page that ranks position 6.9 largely for event *rewards*. Placing it after "Maximizing Your Event Income" would bury the schedule below roughly 10 KB of reward detail. Everything above the income card stays exactly where it is.

The block renders, per burst: the date range as `<time datetime>`, the label or an explicit unnamed treatment, video and creator counts, the dominant category, links to up to 3 of its `/watch/` pages, and — for confirmed bursts only — a link to the entity's `guideHref` and a visible attribution to its publisher source. Labelled bursts come first, newest first; unnamed bursts follow them, visually quieter, so no unnamed row ever sits at the top of the block.

Copy states plainly that the timeline is derived from creator upload dates and is not a publisher schedule. That framing is required: the block must not imply a forward-looking calendar the site cannot source, and it complements rather than replaces the existing in-game-hub advice at `:477`.

**No JSON-LD is added for the timeline.** Inferred names and date ranges must not be marked up as facts even when they are accurate, and a partially-inferred `ItemList` of events would be exactly the fabrication risk the repo already rules out.

### [S2.10] Writes are EOL-safe, and both targets are CRLF

`guide/creators/index.html` is CRLF (9,944 CRLF, zero lone LF) and `guide/event/index.html` is CRLF (645 CRLF, zero lone LF). Both generators detect each file's line ending (`html.indexOf('\r\n') === -1 ? '\n' : '\r\n'`) before rewriting, following the existing rule, and must emit CRLF here.

This is not hypothetical for `/guide/event/`: `scripts/generate-codes.js` rewrites that file wholesale to sync its `[Mon YYYY]` freshness token. A single LF written by the timeline generator would be normalised by that later write, and `tests/structured-data.test.js` would then fail with `output changed for …` — the failure mode that reproduces only in the full generator sequence, never on a lone re-run.

`data/event-signals.json` is added to the generator snapshot list in `tests/structured-data.test.js` as a single-writer file. `guide/event/index.html` is deliberately *not* added there, because five generators write to it and a snapshot entry would make the suite depend on their relative order.

### [S2.11] Category filter

A toolbar row sits **directly above the feed, below the summary block**. It holds eight single-select toggle buttons — `All` followed by the seven categories in the generator's canonical order (`Guides`, `Tier Lists`, `Updates`, `Events`, `Team Building`, `Gameplay`, `Livestreams`) — each carrying its video count computed over the full feed, so the counts never change as a filter is applied. The month `<select>` from S2.12 sits at the right of the same row on wide viewports and wraps to its own line below the chips on narrow ones.

Selecting a category **narrows the set first and then re-batches it from the start**: the feed shows the first 50 videos of that category, the load-more button continues within it, and the month jump targets the filtered set. Interaction state is therefore a small tuple — active category, revealed count — with no dependence on click history.

Hiding is done with a JS-applied CSS class. Non-matching cards get `gem-creators__item--filtered`, and the `<ol>` gets `gem-creators__feed--filtered` plus `data-active-category`. Because no such class is ever present in the generated HTML, a visitor without JS sees all 390 cards and the chips are inert, which is the correct degradation: the full archive remains readable, and no `<noscript>` workaround is needed for the filter.

The active filter is written to the URL as `?category=<slug>` and restored on load, following the `theme.js:28` precedent for `?theme=`. The existing self-referencing canonical already points at the clean URL, so filtered variants canonicalise correctly with no new SEO surface, and since the filter is JS-only a crawler that ignores the parameter still receives all 390 cards.

The summary stats switch to the filtered totals while a filter is active (S2.3), and the roster stays active-only and unaffected.

### [S2.12] Month jump

A native `<select>` lists one option per month present in the data, newest first, spanning the 2024-02 to 2026-11 range. Choosing a month reveals every card from the top of the feed through the end of that month — respecting any active category filter — and then scrolls to the first date marker of that month.

A native control is used deliberately: it brings real keyboard and screen-reader support with no custom widget, and the site already uses `<select>` six times on the homepage. A month *anchor* strip was rejected as 34 links of visual clutter above the feed, and a popover picker as a custom component that would need its own focus management.

### [S2.13] Feed logic lives in one module both Node and the browser load

The no-bundler structure ruled out a build-time split, so rather than duplicating rules the module is **dual-target**: `creators-feed.js` defines the pure functions at top level (batching, category filtering, month targeting, labels), exports them under a `typeof module` guard, and runs its DOM wiring only under a `typeof document` guard. `scripts/generate-youtube-creators.js` requires it and `tests/creators-feed.test.js` requires the same file the browser loads, so no batching or filtering rule is written twice.

The generator still carries per-card facts into the markup — `data-category`, `data-published` and `data-creator-key` — so the browser can build its working set from the DOM without re-deriving categories or parsing titles.

`tests/creators-feed.test.js` unit-tests the pure functions directly: batch boundaries never split a date group, filtering then re-batching yields the same batching as batching the filtered set from scratch, months and their ranges are correct, and counts are computed over the full set. The existing generator tests continue to assert the emitted markup. DOM event wiring is left to manual browser QA, which is the repo's stated policy for behaviour.

### [S2.14] All six `/guide/event/` freshness fields are wired to the generator

`/guide/event/` carries six hand-maintained freshness fields, all reading `2026-11-07`, and no script updates any of them:

| Field | Location |
|---|---|
| JSON-LD `dateModified` | `guide/event/index.html:182` |
| `<meta name="date">` | `:51` |
| `article:modified_time` | `:70` |
| Byline date | `:291` |
| "Last updated" text | `:476` |
| `<lastmod>` | `sitemap.xml:23` |

There is no `GUIDE_LD_DATEMODIFIED` marker and no bare-field fallback on this page — the mechanism that keeps `/guide/code/` honest was never built here. A generator that rewrites page content while all six stay frozen would add a fifth instance of the repo's documented "displayed date with no writer" defect class.

All six are driven from `data/youtube-creators.json.updated`, and are rewritten **only when the rendered timeline block actually differs from what is already in the file**, so a no-op regeneration leaves every date untouched and byte-idempotent.

**The six `[Mon YYYY]` tokens on this page are not part of this wiring.** `scripts/generate-codes.js` owns them from `data/codes.json`'s `seoMonth`, and `tests/promo-codes-generator.test.js:35,44-52` asserts every token equals that value. The timeline generator must not touch them.

## [S3] Out of scope

- No `/events/<slug>/` pages, and no change to `/guide/wish-event/`.
- No forward-looking calendar, recurrence prediction, or "next event" claim.
- No new curated heroes or versions in `data/game-context.json`; the missing-hero gap is recorded, not filled.
- No creator filter, and no per-creator archive pages.
- No pagination of the recent-video ticker, the editorial video rail, or the noscript list.
- No sticky toolbar.
- No change to watch pages, the `/watch/` hub, or the sitemap beyond one `<lastmod>` value.
- No new structured data.

## Tasks

- [x] T1: Add `getCompleteFeedItems()` and feed all 390 visible-creator videos into the feed, leaving the JSON-LD and noscript caps alone — acceptance: the feed holds 390 cards while the JSON-LD `ItemList` still holds 225 (covers: S2.1, S2.4)
- [x] T2: Rebuild the activity summary from the same complete feed, retitle the roster "Active channels", and switch the stats to filtered totals when a filter is active — acceptance: the summary reads 390 videos / 25 creators above 390 cards, and the roster lists exactly the 12 active channels (covers: S2.3, S2.11)
- [x] T3: Write `scripts/lib/creators-feed-logic.js` with batch construction, category filtering and month-target selection as pure functions — acceptance: `tests/creators-feed.test.js` exercises them and no batch splits a date group (covers: S2.13)
- [x] T4: Emit deferred classes, `data-category`, `data-month` and date-group-aligned batches at 50 — acceptance: 8 batches over current data, every card after the first carries the deferred class, and no batch boundary splits a `published` date (covers: S2.1, S2.2, S2.13)
- [x] T5: Emit the toolbar — eight category chips with counts and a native month `<select>` — acceptance: chips render in canonical order with correct full-set counts, the month list matches the months present, and the row wraps below 640px (covers: S2.11, S2.12)
- [x] T6: Add `creators-feed.js` with load-more, filter, month jump and `?category=` restore, plus the higher-specificity noscript reveal — acceptance: with JS each click reveals the next batch, filtering re-batches from the first 50, the month jump scrolls to that month, and with JS disabled every card is visible and no chip is interactive (covers: S2.1, S2.11, S2.12)
- [x] T7: Delete `renderJsOutput`, the generated bundle, its script tag, its four tests and its `tests/structured-data.test.js` snapshot entry — acceptance: no `__YOUTUBE_CREATORS` reference remains, `/guide/creators/` loads no bundle, `test:creators` and `test:structured-data` pass (covers: S2.5)
- [x] T8: Verify and commit the feed work — acceptance: full build twice produces no diff, all suites pass, browser QA covers load-more, filter, month jump, `?category=` restore, no-JS and both colour modes with no console errors (covers: S2.1–S2.5, S2.11–S2.13)
- [x] T9: Build `scripts/generate-event-timeline.js` detection and labelling over all 25 visible creators — acceptance: 26 bursts, every burst meets the ≥5-video/≥3-creator threshold, no two share a date, every `confirmed` label equals a real entity `name`, every `derived` label matches an `Update <version>` found in ≥2 creators' titles, and `data/event-signals.json` is byte-identical on re-run (covers: S2.6, S2.7, S2.8)
- [x] T10: Render the timeline between `<!--EVENT_TIMELINE_START/END-->` after the income card, labelled bursts first — acceptance: the block sits between the Total Event Income card and The Long Haul, no unnamed row precedes a labelled one, and no JSON-LD is added (covers: S2.9, S2.10)
- [x] T11: Wire the six freshness fields to bump only when the rendered block changes — acceptance: a no-op regeneration leaves all six byte-identical, a changed block updates all six from `data/youtube-creators.json.updated`, and the `[Mon YYYY]` tokens are untouched (covers: S2.14, S2.10)
- [x] T12: Add `tests/event-timeline.test.js` — acceptance: it locks the burst thresholds, the two-word-alias and `system`-exclusion guards, the label-status invariants, the ordering rule and the freshness-wiring behaviour (covers: S2.6, S2.7, S2.9, S2.14)
- [x] T13: Verify and commit the timeline work, then update `AGENTS.md` and `CONTEXT.md` — acceptance: full build twice produces no diff, all suites pass, browser QA on `/guide/event/` in both colour modes, and the new script, data file and page section are documented (covers: S2.6–S2.10, S2.14)

## Journey log

- **The spec's own first draft was wrong about the summary block, and self-review caught it.** I wrote that the activity summary reports 225 videos; the rendered page actually says **142 videos / 12 creators** above 225 cards, because `renderFeedSummaryHtml` counts `getActiveCreators()` while the feed renders `getVisibleCreators()`. That is a live defect, not a fact to preserve, so S1 gained a defect and S2.3 became a fix rather than a "leave it alone".
- **Load-more alone was an inadequate answer to the original complaint.** At 25 per batch the feed needs 16 batches and **14 clicks** to reach December 2025, so the change would have swapped "too many on one page" for "too many clicks". That measurement is what added the month jump, and it also removed the need to tune batch size precisely, so the batch moved to 50.
- **Gating burst detection to active creators silently deleted history.** Active-only finds 19 bursts; all-visible finds 26. The seven discarded include the **July 2026 Wish Event** — the one event this site has a dedicated page for. The active-gate rule belongs on surfaces read as "what is happening now", not on a dated history, and 86 of the 390 playable videos belong to channels that are pending now precisely because they went dormant.
- **The `<noscript>` reveal needed a specificity bump, not just placement.** The creators page has one inline `<style>` block *after* the `<head>` `<noscript>`, so an equal-specificity rule inside that noscript can lose the cascade to `.gem-creators__item--deferred{display:none}`. The rule is `.gem-creators__feed .gem-creators__item--deferred{display:block}` so source order stops mattering.
- **Writing to `/guide/event/` at all would have created a fifth instance of this repo's recurring date defect.** The page has six hand-maintained freshness fields, all frozen at `2026-11-07`, with no marker or fallback wiring — so S2.14 exists because the feature would otherwise make the page claim a modification date it had outgrown.
- **The timeline's first placement displaced the page's primary content.** Directly after the video rail it would have pushed the Total Event Income card and both reward cards 1,500–2,500px down on a page ranking 6.9 for event rewards. Moving it below the income card keeps every element above it in place.
- **Free n-gram event naming was prototyped, measured, and rejected.** Deriving a label from phrases repeated across a burst's titles produced "criminal recruitment" for the Kradd/Update 3.8 burst (26 videos, 7 creators) and "ragnars are" for the Ragnars week, and found nothing for 6 of 19 bursts. It was replaced with a verbatim version label, with no label at all as the final fallback.
- **`game-context.json` aliases needed two guards before entity matching was usable.** The first pass labelled the Kradd summons burst "Cecil's Recruitment Department" because that entity aliases bare `"summon"` and `"recruit"`, and it is a permanent system shop rather than an event. Excluding `type: "system"` entities and requiring multi-word aliases removed the false positives and raised confirmed coverage from 8 of 19 bursts to 13 of 19.
- **Page weight was investigated and dismissed as the motivation for pagination.** The 656 KB page is 49.7 KB over the wire (gzip, verified against production over `Accept-Encoding: gzip, br`), so splitting it across URLs would have bought nothing. Paging is a scroll and DOM-length fix, which is why the retained approach keeps every card in the HTML.
- **The no-bundler constraint ruled out sharing one implementation between Node and the browser**, so the choice was either duplicated filtering logic or moving the logic entirely to one side. Carrying `data-category`/`data-month`/batch class into the generated markup keeps the rules in a Node-testable module and shrinks `creators-feed.js` to DOM toggling, with no rule written twice.
- **Version labelling had to outrank entity matching, which the spec had backwards.** Ordered as written, the two update bursts were labelled "Patch notes" because `patch-notes` is an eligible `update` entity with a two-word alias. Measuring every burst showed the only two conflicts were exactly those, and each had a specific version quoted by two or more creators — so quoting the version first strictly improved both labels and changed nothing else.
- **A labelled row was linking the wrong videos.** A burst is a time window, not a topic filter: the first Trick or Treat row led with a Cloning Machine Frenzy video because links were simply the newest three. Link selection now prefers videos that mention the row's own label, keeping newest-first within each group.
- **The dual-target module resolved a constraint rather than working around it.** The plan was logic-in-Node plus precomputed attributes in the HTML, which would have needed batch alignment recomputed in the browser after every filter anyway. Moving the pure functions into the file the browser already loads — with `typeof module` and `typeof document` guards — gave one implementation for both, and the tests require the very file that ships.
- **Change detection compared an LF block against a CRLF page and always reported "changed"**, so the freshness fields would have moved on every build. Normalising both sides before comparing fixed it; the second run now reports "timeline unchanged" and leaves every date alone.- **Independent review caught a critical design flaw the tests could not.** S2.2 claimed "a date marker always precedes every visible card" and was true for batching, but adding a category filter broke it: the marker lived inside each date's first card, so hiding that card orphaned its siblings. 43 of 127 Events cards rendered headerless. The fix was structural — a day wrapper owning its marker and its cards — rather than electing a new lead marker in script, because the wrapper also makes date-group batching atomic and gives the month jump a stable scroll target. The lesson is that S2.2 was written before filtering existed and was never re-derived for it.
- **The load-more label was promising 50 and delivering more.** `nextBatchEnd` extends past `FEED_BATCH_ITEMS` to finish a date group, so a click could reveal 57 while the button said 50. The label now quotes the real next-batch size, computed by the same function the click uses.
- **A malformed `?category=%` would have killed every control on the page.** `decodeURIComponent` threw inside the init callback, so load-more, filter and month jump all failed to wire. It now falls back to `all`.
- **The month jump was animated across 40,000 pixels.** Measured mid-scroll at 500 ms the marker was still 14,715 px away. It is instant now, which is both responsive and friendlier to reduced-motion preferences.
- **New sections were appended as S2.11–S2.14 rather than renumbered** into logical position, to keep every existing anchor stable for the `covers:` references in the task list.
