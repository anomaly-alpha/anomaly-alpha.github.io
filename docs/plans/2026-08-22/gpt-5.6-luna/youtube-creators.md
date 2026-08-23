---
feature: youtube-creators
status: ready-for-implementation
updated: 2026-08-22
spec: docs/specs/2026-08-22/gpt-5.6-luna/youtube-creators-avatar-shuvd.md
---

# Implementation Plan — YouTube Creators

## Objective

Build a static `/guide/creators/` page for Invincible: Guarding the Globe. It must research nine supplied creator candidates, include every qualifying candidate, prefer Avatar Shuvd for a static featured hero when qualified, use YouTube-hosted thumbnails, and open videos in an accessible, lazy-loaded modal.

The implementation must preserve the site's existing static architecture: no runtime API calls or data fetches, support for `file://`, shared CSS/JavaScript, and generated data committed to the repository.

## Authority and guardrails

- Treat `docs/specs/2026-08-22/gpt-5.6-luna/youtube-creators-avatar-shuvd.md` as the approved product contract.
- Do not modify or revert unrelated worktree changes.
- Do not fabricate any creator’s channel URL, handle, biography, video ID, title, date, category, or evidence.
- Do not add a YouTube API key, external JavaScript SDK, analytics tag, framework, or package.
- Do not download, copy, or commit YouTube thumbnails or video files for page cards. The dedicated OG asset may use licensed creator imagery only, with source/license metadata retained.
- Use `https://i.ytimg.com` only for thumbnails and `https://www.youtube-nocookie.com` only after a visitor activates playback.
- Where this plan resolves an ambiguity in the linked specification, this plan is the executable source of truth.

## Completion definition

The feature is complete only when the data generator, new guide page, navigation, modal, metadata, sitemap, tests, and build output all pass the verification checklist at the end of this document.

## Phase 0 — Preflight

1. Work from the repository root: `C:\Users\petra\Desktop\anomaly-alpha.github.io`.
2. Read `AGENTS.md`, the implementation spec, `CONTEXT.md`, `README.md`, `package.json`, `_headers`, and `privacy/index.html`.
3. Record `git status --short` before editing. Existing changes are user-owned.
4. Inspect one representative guide page, preferably `guide/beginners/index.html`, and the existing card modal code in `index.html`, `script.js`, and `styles.css`.
5. Inspect `scripts/generate-codes.js` and `data/generated/promo-codes.js`. Reuse its source-data-to-generated-output pattern; do not introduce a second architecture.
6. Identify every existing guide navigation surface. `rg` is not installed in this Windows environment; use PowerShell `Get-ChildItem -Recurse -File | Select-String` (or an equivalent available search) instead. The new Creators link must be added consistently wherever guide links are intentionally listed.
7. Confirm the approval-gated workflow files exist before implementation: local `.mimocode/skills/add-creator/SKILL.md`, `.mimocode/skills/update-creators/SKILL.md`, `.mimocode/command/add-creator.md`, `.mimocode/command/update-creators.md`, plus the matching global copies under `C:\Users\petra\.agents\skills\`. Do not recreate or broaden their permissions.
8. Confirm the durable notification reminder exists: `0 9 1 */3 *`, Eastern Time, notification-only. It prompts `/update-creators` and does not start research automatically.

### Workflow assets

The research workflows are part of execution readiness, not an optional follow-up:

- `/add-creator` accepts channel and/or video URLs, supports batch research with separate approval per creator, and proposes `active`, `pending`, or `hidden` records without writing before approval.
- `/update-creators` audits active, pending, and hidden known records, proposes status/featured/content/linked-output changes in a dry run, and writes only after explicit approval.
- Both workflows use public YouTube pages/oEmbed only, preserve provenance/evidence/rejection reasons, and never commit or push.
- Global skills are under `C:\Users\petra\.agents\skills\`; project-local skills and command wrappers are under `.mimocode\skills\` and `.mimocode\command\`.

### Content approval gate

Before adding an `active` creator or video to the source JSON, confirm its public YouTube page and record original and canonical URLs as provenance. A video is eligible only when all of these are true:

- It is publicly reachable without signing in.
- Its page, title, description, or clear contextual evidence establishes Invincible: Guarding the Globe relevance; record a short evidence note.
- It is relevant to players: guide, tier list, update, event, team-building, or gameplay.
- Its title, publication date, and 11-character video ID are confirmed from the YouTube page.
- It is a standard video or replayable livestream. Shorts do not count toward qualification.

The supplied candidate set includes these seed URLs; group them by verified channel and research each channel further. The channel names below come from public oEmbed metadata and still require current page-level verification before publication:

| Video ID | Resolved channel | Confirmed title | Confirmed publication date | Direct URL |
|---|---|---|---|---|
| `kPDC78Dv1NI` | RapidGTG (`@RapidGTG`) | Boss Raid is Finally Here! | unknown | `https://www.youtube.com/watch?v=kPDC78Dv1NI` |
| `1NF0U3lJYoo` | Tutaaa-GTG (`@TutaaaGTG`) | We Waited All This Time… FOR THIS?! | unknown | `https://www.youtube.com/watch?v=1NF0U3lJYoo` |
| `vZ0pb6iUPP0` | Avatar Shuvd (`@avatarshuvd`) | My Boss Raid FEEDBACK! | unknown | `https://www.youtube.com/watch?v=vZ0pb6iUPP0` |
| `u6m0gmOzwfs` | Avatar Shuvd (`@avatarshuvd`) | Complete Tier List (Update 2.14 Edition) | 2026-02-22 | `https://www.youtube.com/watch?v=u6m0gmOzwfs` |
| `cqRWJ_F4p64` | Avatar Shuvd (`@avatarshuvd`) | WE'RE BACK! | 2026-01-20 | `https://www.youtube.com/watch?v=cqRWJ_F4p64` |
| `S0xrNwdkExw` | Avatar Shuvd (`@avatarshuvd`) | TIER LIST TIME! | 2025-03-19 | `https://www.youtube.com/watch?v=S0xrNwdkExw` |
| `P6yTQHW6YFA` | TH3O (`@TH3Oyt`) | New Recruitment Road Event!! | unknown | `https://www.youtube.com/watch?v=P6yTQHW6YFA` |
| `r4c19_n0wr4` | LAVAMOOSE (`@LAVAMOOSE1369`) | The Entire Second Season of Invincible In Invincible Guarding The Globe | unknown | `https://www.youtube.com/watch?v=r4c19_n0wr4` |
| `mCw0PowHTls` | Tutaaa-GTG (`@TutaaaGTG`) | I'M GOING FREE TO PLAY in Invincible: Guarding the Globe… Here's Why | unknown | `https://www.youtube.com/watch?v=mCw0PowHTls` |
| `wNKoLf9xKJA` | OMNI-BANE (`@BaneApe5`) | Invincible Guarding The Globe - New Hero Tease | unknown | `https://www.youtube.com/watch?v=wNKoLf9xKJA` |
| `pK9C7mUMceI` | Just a Guy named Francis (`@JustaGuynamedFrancis`) | NEW CHARACTER RELEASE DAY | unknown | `https://www.youtube.com/live/pK9C7mUMceI` |

The supplied Shorts `kGq-Racu8tw` (Beaoloooo, `@marvin2804`) and `sxosoNY7WDU` (KingSlay727, `@kingslay727`) are retained as rejected research records and do not count. Before implementation, re-open every seed and research each verified channel until its status is known. The executor may replace a candidate only with another item that passes the eligibility rules above. Avatar Shuvd is preferred for the hero when active; no named secondary creator is mandatory.

### Research gate before code

Do not begin page or generator implementation until the research pass has:

1. Resolved all eleven regular-video/livestream seeds to the nine candidate channels without guessing identities.
2. Recorded each channel’s verified display name, canonical channel URL, source URLs, evidence notes, and last-checked date.
3. Collected enough eligible items to classify every candidate as active (six total, three recent), pending (at least one), or hidden (zero).
4. Recorded rejected Shorts, unavailable items, and every rejection reason in `candidateSources` or the relevant video record.
5. Confirmed at least one active creator for the static hero. If no candidate qualifies, stop and report the missing-content blocker rather than creating an empty or invented hero.
6. Obtained the license/permission and attribution metadata needed for `og-images/creators.png` before using creator imagery.

## Phase 1 — Define the data contract

### Files

- Create: `data/youtube-creators.json`
- Create: `scripts/generate-youtube-creators.js`
- Create: `data/generated/youtube-creators.js`
- Create: `tests/youtube-creators-generator.test.js`
- Modify: `package.json`

### 1.1 Source JSON

Create `data/youtube-creators.json` with a top-level object containing `updated`, `contentMaintainer`, `reviewCadenceDays`, `featuredCreatorId`, `candidateSources`, `ogImageSources`, and `creators`.

```json
{
  "updated": "2026-08-22",
  "contentMaintainer": "Anomaly Alpha",
  "reviewCadenceDays": 90,
  "featuredCreatorId": null,
  "candidateSources": [
    {
      "sourceUrl": "https://www.youtube.com/watch?v=vZ0pb6iUPP0",
      "kind": "video-seed",
      "resolvedCreatorId": "avatar-shuvd",
      "lastChecked": "2026-08-22",
      "resolutionStatus": "verified"
    }
  ],
  "ogImageSources": [],
  "creators": [
    {
      "id": "avatar-shuvd",
      "name": "Avatar Shuvd",
      "handle": "@AvatarShuvd",
      "channelUrl": "https://www.youtube.com/@AvatarShuvd",
      "description": "Invincible GTG tier lists, guides, and updates.",
      "tags": ["Tier Lists", "Guides", "Updates"],
      "status": "active",
      "displayOrder": 1,
      "lastChecked": "2026-08-22",
      "videos": [],
      "sourceUrl": "https://www.youtube.com/@AvatarShuvd"
    }
  ]
}
```

Research all eleven regular-video/livestream seed URLs across nine resolved channels. Every active creator requires at least six confirmed eligible items, including at least three published in the previous 180 days. Standard videos and replayable livestreams count; Shorts do not. Keep up to twelve locally rendered items and retain additional validated records in source data.

The sample `featuredCreatorId: null` is only a pre-research shape. Before the first build, set it to the approved active Avatar Shuvd record or to the approved active fallback. The generator must reject a release dataset whose featured ID is null, unknown, pending, or hidden.

Before the first build, populate `ogImageSources` with the source URL, license/permission basis, attribution, and last-checked date for every non-original image used in `og-images/creators.png`. The generator must reject a release asset with missing provenance.

Every active video must also include a one-sentence `description`. It is displayed only where appropriate and supplies the `description` required for its structured-data entry. Example:

```json
{
  "id": "u6m0gmOzwfs",
  "title": "Complete Tier List (Update 2.14 Edition)",
  "description": "Avatar Shuvd ranks the Invincible: Guarding the Globe roster for Update 2.14.",
  "category": "Tier Lists",
  "published": "2026-02-22",
  "lastChecked": "2026-08-22",
  "status": "active",
  "featured": true,
  "sourceUrl": "https://www.youtube.com/watch?v=u6m0gmOzwfs",
  "canonicalUrl": "https://www.youtube.com/watch?v=u6m0gmOzwfs",
  "evidenceNote": "The title and page content identify an Invincible: Guarding the Globe tier-list video.",
  "statusReason": ""
}
```

Rejected or unavailable records require a non-empty `statusReason`; active records may leave it empty.

Exactly six items per active creator have `featured: true`; additional eligible items have `featured: false` and may appear in the expansion up to the twelve-item cap.

### 1.2 Resolve the creator status and featured rules

Implement this status rule:

- `active` creators require all profile fields, at least six eligible items, and at least three items published in the previous 180 days.
- `pending` creators require at least one eligible item but fail an active threshold. They render after active creators, show available cards, and retain verified channel links.
- `hidden` creators have zero eligible items. They remain in source data for future checks and render nowhere.
- When an active creator loses recent activity, propose `pending` rather than deleting its historical data.
- `featuredCreatorId` may reference only an active creator. Prefer Avatar Shuvd when qualified; otherwise propose the highest editorial score.

Record this rule in the data generator's validation error messages and, if the spec is edited during implementation, amend its source-data section to match.

### 1.3 Generator validation

Implement validation before writing any output. On failure, print each error and exit with code 1. Validate:

- Valid JSON and top-level `updated` date.
- `contentMaintainer` is a non-empty string and `reviewCadenceDays` is exactly `90`, matching the durable reminder cadence.
- `candidateSources` is a non-empty array with valid source URLs, `kind`, resolution status, and last-checked dates; each source resolves to zero or one known creator.
- `ogImageSources` records provenance, permission/license, attribution, and last-checked date for every external image used by the OG asset.
- Unique lowercase kebab-case creator IDs.
- Unique numeric `displayOrder` values across all creators; use the same editorial order for active and pending groups, with the featured creator omitted only after hero rendering.
- Creator status in `active`, `pending`, or `hidden`.
- Valid ISO date-only values for `updated`, `lastChecked`, and `published`.
- Active and pending creator URLs begin with `https://www.youtube.com/` when a channel is verified.
- Active creator fields are non-empty.
- Tags are a non-empty string array for active creators.
- Video IDs are unique across every creator and match `^[A-Za-z0-9_-]{11}$`.
- Video status in `active`, `pending`, or `unavailable`.
- Video category is one of `Guides`, `Tier Lists`, `Updates`, `Events`, `Team Building`, `Gameplay`, or `Livestreams`.
- Active featured videos have all required fields and valid `lastChecked`/`published` dates.
- Active featured videos have a concise, non-empty description.
- Active creators contain at least six eligible items, including at least three published within the previous 180 days.
- Active creators contain exactly six `featured: true` items; additional eligible items are not featured.
- Every `featured: true` item has `status: active`.
- Pending creators contain at least one eligible item.
- Hidden creators contain zero eligible items and never appear in public output.
- The featured creator is active and is excluded from the normal list when rendered in the hero.
- Store submitted URLs, canonical URLs, evidence notes, rejection reasons, and image-license metadata.
- `sourceUrl` is the submitted discovery URL; `channelUrl` is the verified canonical channel URL. `statusReason` is required for rejected or unavailable records.
- Pending and unavailable videos never appear in generated public cards or JSON-LD.
- Every public video passes the content approval gate. Standard videos and replayable livestreams are eligible; Shorts are retained as rejected records and never qualify.

### 1.4 Generated outputs

The generator must write:

```js
window.__YOUTUBE_CREATORS = [/* public, sorted creator data */];
```

to `data/generated/youtube-creators.js`.

It must also replace three explicit marker pairs in `guide/creators/index.html`:

```html
<!--FEATURED_CREATOR_START-->
<!--FEATURED_CREATOR_END-->

<!--CREATOR_SECTIONS_START-->
<!--CREATOR_SECTIONS_END-->

<!--CREATORS_JSON_LD_START-->
<!--CREATORS_JSON_LD_END-->
```

The generated HTML keeps the actual creator content in the static document for crawlers and `file://` use. The generated JavaScript gives `script.js` the data needed to populate the modal. Escape all text interpolated into HTML, attribute values, and JSON-LD.

The generator must first assert that each marker pair occurs exactly once. It must retain the markers after replacement, so a second run produces byte-for-byte identical creator sections and JSON-LD. Run the generator twice during verification and fail the test if the second run changes the file.

Generated output must render the approved `featuredCreatorId` as a static hero with the creator profile and six featured cards, then omit that creator from the normal list. Active creators come first in `displayOrder`; pending creators follow in the same editorial order; hidden creators are omitted. Pending creators render available eligible cards, a clear pending label, and a verified channel link. The normal list and hero must remain correct with JavaScript disabled.

Generate six featured cards per active creator and an accessible expansion revealing up to twelve validated cards, plus a verified channel link. The generator must include every locally visible item in the ItemList/VideoObject JSON-LD. The featured creator is selected during the approved `/update-creators` workflow and is not rotated in the browser.

“Every locally visible item” includes cards behind the expansion control: the JSON-LD contains all validated active-status items rendered by the page up to twelve per creator, not only the initial six featured cards.

### 1.5 Build integration

Add:

```json
"generate-creators": "node scripts/generate-youtube-creators.js"
```

to `package.json` scripts. Add a second script:

```json
"test:creators": "node tests/youtube-creators-generator.test.js"
```

Refactor the generator so its pure validation and rendering functions can be imported by this test file while the CLI writes project files only when executed directly. Update `build` to run this generator after the existing data generators and before CSS/JavaScript minification. The build command must continue to work on a clean checkout.

## Phase 2 — Build the new guide page

### Files

- Create: `guide/creators/index.html`
- Create: `og-images/creators.png` from licensed source imagery and record its provenance in source metadata
- Modify: `styles.css`
- Modify: `script.js`
- Modify: `src/tailwind-input.css` only if new Tailwind utilities are genuinely needed

### 2.1 Copy the page shell

Use an existing guide page as the structural template. Preserve its:

- Relative font, stylesheet, and script paths.
- Critical CSS/preload pattern.
- Main container, corner decorations, background, breadcrumb, guide navigation, legal footer, back-to-top control, and deferred shared script.
- Dark/light behavior and reduced-motion support.

Do not copy an unrelated guide's content or JSON-LD verbatim.

### 2.2 Page metadata

Add page-specific values:

- `<title>`: `Invincible GTG YouTube Creators — Guides, Tier Lists & Gameplay`
- Canonical: `https://anomaly-alpha.github.io/guide/creators/`
- Description that identifies the page as a curated GTG creator directory.
- Matching Open Graph and Twitter title/description/url tags.
- `og:type` appropriate for a guide/collection page.
- Require the approved `og-images/creators.png` asset. It may use scraped creator imagery only when a documented license permits reuse; retain source/license metadata.
- `meta name="referrer" content="strict-origin-when-cross-origin"`.

Add BreadcrumbList and CollectionPage JSON-LD to the existing graph style. Let the generator populate a separate ItemList/VideoObject marker from every locally visible active-status item belonging to active or pending creators, up to twelve per creator. Do not include subscriber counts in visible content or schema.

For every active video, generate this minimum `VideoObject` shape:

```json
{
  "@type": "VideoObject",
  "name": "{title}",
  "description": "{description}",
  "thumbnailUrl": "https://i.ytimg.com/vi/{id}/hqdefault.jpg",
  "uploadDate": "{published}",
  "contentUrl": "https://www.youtube.com/watch?v={id}",
  "embedUrl": "https://www.youtube-nocookie.com/embed/{id}"
}
```

The `ItemList` must reference only these generated active VideoObjects. Escape `<`, `>`, `&`, and every closing-script sequence in JSON-LD strings before writing the HTML.

### 2.3 Static body markers

Place the following page introduction before the generated static featured hero:

```text
YOUTUBE CREATORS
Discover creators helping players build stronger teams,
clear events, and master Invincible: Guarding the Globe.
```

Below it, include these marker pairs exactly once:

```html
<!--FEATURED_CREATOR_START-->
<!--FEATURED_CREATOR_END-->

<!--CREATOR_SECTIONS_START-->
<!--CREATOR_SECTIONS_END-->

<!--CREATORS_JSON_LD_START-->
<!--CREATORS_JSON_LD_END-->
```

Load `../../data/generated/youtube-creators.js` before `../../script.js`.

The generated creator sections must include a featured-hero marker and a normal-list marker. The approved featured creator appears only in the hero. The hero is larger and bolder than the other creator sections.

Include a brief note below the section marker:

```text
Thumbnails and playback may connect to YouTube. Videos play through YouTube when selected. Creator activity and video availability can change.
```

Immediately after the generated sections, include a `<noscript>` fallback. It must list every locally visible active and pending video as a normal `Watch {title} by {creator} on YouTube` link. This is the only direct watch link outside the modal; when JavaScript is available, playback remains initiated by the video-card button and the modal retains its separate Watch on YouTube action.

Add this independent-creator disclaimer: “Creators listed here are independent community members and are not necessarily endorsed by Ubisoft, YouTube, or Anomaly Alpha.” A correction/removal contact link is not required for this release. Do not invent a contact route or leave it as a handoff blocker; the 90-day editorial review process is the maintenance mechanism.

### 2.4 Generated creator markup contract

Generate one `<section>` per visible creator with:

- `id="creator-{creator.id}"`.
- Heading containing creator name and optional handle.
- Optional tag list.
- Description and last-checked time.
- External `Visit Channel` link for every creator with a verified channel URL, including pending creators.
- A responsive video-list container.

Generate each locally visible active-status video as exactly one button:

```html
<button
  type="button"
  class="gem-creator-video"
  data-youtube-video-id="..."
  data-creator-id="..."
  aria-label="Play {video title} by {creator name}">
  <!-- thumbnail, overlay, title, category/date -->
</button>
```

Use an `<img>` with `maxresdefault.jpg`, descriptive `alt="Thumbnail for {video title} by {creator name}"`, and `data-thumbnail-fallback="maxres"`. The thumbnail error handler must change it once to `hqdefault.jpg`; if that also fails, it must replace/hide the image and reveal the CSS placeholder. Do not use inline `onclick` attributes.

Pending creators show all available eligible cards and a “More videos coming soon” message when fewer than six are available. Active creators always meet the six-item and recent-activity gates at launch.

### 2.5 Creator-video modal markup

Add a single modal as the final direct child of `<body>` (not inside `<main>` or the page container). It must be initially hidden and include:

```html
<div id="creatorVideoModal" class="gem-modal hidden" role="dialog"
     aria-modal="true" aria-labelledby="creatorVideoModalTitle">
```

Inside it, include:

- Overlay/click-target element.
- Close button with `aria-label="Close video"`.
- Title element with `id="creatorVideoModalTitle"`.
- Creator-name element.
- Empty player mount element.
- Status/error element using `role="status"` or `aria-live="polite"`.
- A `Watch on YouTube` anchor updated when opening.

Never put the iframe in the page before a visitor opens a video.

## Phase 3 — Shared styles and behavior

### 3.1 CSS

Add BEM-style classes to `styles.css`:

- `.gem-creators`
- `.gem-creators__featured`
- `.gem-creators__list`
- `.gem-creator`
- `.gem-creator--featured`
- `.gem-creator__meta`
- `.gem-creator__tags`
- `.gem-creator__videos`
- `.gem-creator-video`
- `.gem-creator-video__thumbnail`
- `.gem-creator-video__play`
- `.gem-creator-video__fallback`
- `.gem-creator-video-modal`
- `.gem-creator-video-modal__player`
- `.gem-creator-video-modal__error`

Use existing design tokens rather than new hard-coded colors. Cards must display one column on narrow screens, two on medium screens, and three on desktop where space permits. Make play overlay hover/focus effects subtle and remove nonessential movement under `prefers-reduced-motion: reduce`.

Add visible `:focus-visible` styling. Maintain a 16:9 aspect ratio for thumbnail and player containers to avoid layout shift.

### 3.2 JavaScript lifecycle

Add page-safe functions to `script.js`; each must return without action if creator-page elements are absent:

- `initCreatorVideos()`
- `openCreatorVideoModal(videoId, trigger)`
- `closeCreatorVideoModal()`
- `getCreatorVideo(videoId)`
- `handleCreatorThumbnailError(image)`

Run `initCreatorVideos()` from the existing DOMContentLoaded flow. Avoid duplicate initialization if the script has multiple DOMContentLoaded listeners.

Use event listeners, not global inline handlers. `initCreatorVideos()` must:

1. Attach click and keyboard-compatible button behavior to video cards.
2. Attach click handling for the close button and overlay.
3. Attach one thumbnail error handler to each thumbnail.
4. Preserve the triggering button before the modal opens.

`openCreatorVideoModal()` must:

1. Look up the video only from `window.__YOUTUBE_CREATORS`.
2. Populate title, creator, and direct watch URL: `https://www.youtube.com/watch?v={VIDEO_ID}`.
3. Clear previous error text and player content.
4. Create a single iframe with `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`, `allowfullscreen`, a descriptive `title`, and `referrerpolicy="strict-origin-when-cross-origin"`.
5. Build the iframe URL from a validated 11-character video ID.
6. Use `https://www.youtube-nocookie.com/embed/{ID}?autoplay=1&rel=0&playsinline=1`.
7. Add `origin=${encodeURIComponent(location.origin)}` only when `location.origin` is not `"null"`; omit the parameter for `file://` previews.
8. Reveal the modal, lock body scroll, make background interaction unavailable, and focus the close button.

`closeCreatorVideoModal()` must:

1. Remove the iframe node, not merely hide it.
2. Clear title, creator, and error state.
3. Hide the modal and restore body scrolling.
4. Restore the prior button focus if it is still connected.

### 3.3 Keyboard and modal coordination

Implement a focus trap using the first and last focusable elements in the creator modal. Handle Tab and Shift+Tab. The existing document Escape listener must close the creator modal first when it is open, and must not interfere with an open reward-card modal. Do not change existing card-modal behavior outside this coordination.

Because the modal is a direct child of `body`, isolate the background by selecting every other direct child of `body`. When the modal opens, set `inert` on those siblings and store whether each sibling already had `aria-hidden`. When it closes, remove only the `inert`/`aria-hidden` state added by this feature and restore any prior `aria-hidden` state. This must include fixed UI such as the music banner and back-to-top button, not only `<main>`.

For browsers without `inert`, add `aria-hidden="true"` to each non-modal sibling and use the focus trap to prevent keyboard escape. Do not apply `aria-hidden` to any ancestor of the modal.

### 3.4 Error behavior

The iframe can fail without a reliably detectable browser event. Always retain the direct YouTube link. If iframe creation/load emits an error, display:

```text
This video could not be played here. Watch it on YouTube instead.
```

Do not claim a private, age-gated, or embedding-disabled cause unless the page can know it. The autoplay-blocked case remains usable through player controls.

## Phase 4 — Navigation, privacy, and discovery

### Files

- Modify: `index.html` if its guide navigation exposes all guides
- Modify: `guide/code/index.html`
- Modify: `guide/event/index.html`
- Modify: `guide/pvp/index.html`
- Modify: `guide/login/index.html`
- Modify: `guide/faq/index.html`
- Modify: `guide/beginners/index.html`
- Modify: `guide/xp/index.html`
- Modify: `guide/redeem/index.html`
- Modify: `404.html`
- Modify: `music/index.html`
- Modify: `sitemap.xml`
- Modify after the feature files exist: `AGENTS.md`, `README.md`, `CONTEXT.md`
- Review/modify only if needed: `privacy/index.html`, `_headers`

1. Find all intentional guide navigation surfaces, including the homepage, every guide page, `404.html`, `music/index.html`, top navigation, homepage structured guide lists, and bottom cross-link card grids. Add a `Creators` link with correct relative paths everywhere. Normalize existing `Redeem` links across the same surfaces.
2. Add `https://anomaly-alpha.github.io/guide/creators/` to `sitemap.xml` with the current implementation date.
3. Add a concise page-level privacy disclosure: loading thumbnails and opening playback may connect the visitor to YouTube. A public correction/removal route is not required.
4. Inspect `_headers`. If no CSP exists, do not introduce an unrelated policy. If a CSP exists in the deployed configuration, allow `https://www.youtube-nocookie.com` in `frame-src` and `https://i.ytimg.com` in `img-src`.
5. After the feature files exist, update `AGENTS.md`, `README.md`, and `CONTEXT.md` once so ownership, guide counts, and the topical cluster are accurate. Keep those documents, the approved spec, and this plan manually maintained during recurring content refreshes.

### Ongoing content maintenance

`contentMaintainer` is Anomaly Alpha. The manual `/update-creators` workflow audits all active, pending, and hidden records. A notification reminder fires at 9:00 AM Eastern on the first day of every third month; it only prompts the maintainer and does not start research automatically.

At each approved update:

1. Open every known creator channel and every known item URL, including hidden candidates.
2. Confirm the item remains public, GTG-relevant, and eligible. Standard videos and replayable livestreams count; Shorts do not.
3. Update `lastChecked`, evidence notes, canonical URLs, and source metadata for records that still qualify.
4. Change missing, irrelevant, or otherwise ineligible records to `unavailable` with a reason instead of deleting historical source data.
5. Promote or demote creators in the dry-run proposal: active requires six items and three within the previous 180 days; pending requires at least one; hidden has zero.
6. Suggest an active `featuredCreatorId`, preferring Avatar Shuvd when qualified and otherwise using the editorial score.
7. Propose updates to generated data, creator markup/JSON-LD, all guide navigation/card grids, Redeem links, sitemap, page metadata, creator copy, and `og-images/creators.png` when the qualifying set changes.
8. Keep AGENTS, README, CONTEXT, the plan, and the spec manual during recurring content refreshes.
9. Run `npm run test:creators`, `npm run generate-creators`, `npm run build`, and relevant browser checks after approval.

The public page displays active creators first and pending creators with at least one eligible item at the bottom. Hidden and unavailable records remain in source data for the editorial audit trail.

## Phase 5 — Verification

### Automated checks

Run from the repository root:

```text
npm run test:creators
npm run generate-creators
npm run build
node --check scripts/generate-youtube-creators.js
```

`tests/youtube-creators-generator.test.js` must use Node's built-in `assert` module and temporary directories. It must not mutate project source files. It must cover:

- Valid active Avatar Shuvd fixture generates a static featured hero, excludes the hero from the normal list, generates six featured cards plus expansion data, a no-JavaScript fallback list, and VideoObject JSON-LD.
- Valid pending fixture with one eligible item renders at the bottom with its available card and verified channel link.
- Hidden zero-content fixture remains in source data and is absent from all public output.
- Duplicate creator ID.
- Duplicate video ID.
- Invalid YouTube video ID.
- Malformed active channel URL.
- Missing active-video description or date.
- Invalid status.
- Fewer than six active items.
- Fewer than three active items in the previous 180 days.
- Pending creator with zero eligible items.
- Featured creator pointing to a pending or hidden record.
- Missing evidence note or provenance.
- Marker missing, duplicated, or malformed.
- A second rendering pass produces byte-identical output and preserves every marker pair.

In addition to the automated test, use a temporary copy or a deliberate malformed-data CLI test to prove the generator rejects:

- Duplicate creator ID.
- Duplicate video ID.
- Invalid YouTube video ID.
- Malformed active channel URL.
- Missing active-video date.
- Invalid status.

Restore valid source data after every negative test. Do not leave fixtures or invalid data in the repository.

### Browser checks

Check both `file:///.../guide/creators/index.html` and the local server:

- Page has no missing styles, scripts, or relative-path errors.
- The static hero uses the approved `featuredCreatorId`, is larger/bolder than normal sections, and contains six cards.
- The hero creator is not duplicated in the normal list; active creators precede pending creators.
- Pending creators show available cards, a pending label, and verified channel links; hidden candidates do not render.
- Thumbnails preserve layout before loading.
- Simulate thumbnail errors and confirm maxres → hqdefault → placeholder fallback.
- Click a video: correct title, creator name, watch link, and iframe appear.
- Close by close button, Escape, and outside click; iframe is removed and focus returns.
- Tab/Shift+Tab never reaches background controls while the modal is open.
- Test mobile width, dark mode, light mode, and `prefers-reduced-motion`.
- Test a direct YouTube fallback link manually.
- Disable JavaScript or inspect the `<noscript>` output and confirm every locally visible video remains reachable as a direct YouTube link.

### SEO and quality checks

- Confirm canonical URL, title, description, Open Graph, Twitter tags, BreadcrumbList, CollectionPage, ItemList, and valid VideoObject entries.
- Confirm hidden/unavailable videos are absent from JSON-LD and pending visible items are included up to the twelve-item cap.
- Confirm every VideoObject has `name`, `description`, `thumbnailUrl`, `uploadDate`, `contentUrl`, and `embedUrl`.
- Confirm sitemap entry, normalized Redeem links, Creators links, and all navigation surfaces resolve.
- Run the project's relevant Lighthouse command(s) and ensure no new critical accessibility, SEO, or performance regression.
- Inspect `git diff --check` and review only feature-related changes before handoff.

## Handoff report format

The implementing model must report:

1. Summary of implemented behavior.
2. Every file added or changed.
3. Confirmed creator candidates and videos included, with source/canonical URLs and evidence notes.
4. Avatar Shuvd status and featured-hero recommendation; fallback creator if used.
5. The direct URLs and last-checked dates used for every active video.
6. Commands run and their outcomes, including `npm run test:creators`.
7. Manual browser checks completed, including modal isolation and the no-JavaScript fallback.
8. `/add-creator` and `/update-creators` skill behavior, approval gates, and validation results.
9. Reminder registration and cadence: notification-only, 9:00 AM Eastern on day 1 of every third month.
10. Any remaining blocker, including an active creator failing the six-item/recent-activity gates. The lack of a correction/removal contact link is not a blocker for this release.
