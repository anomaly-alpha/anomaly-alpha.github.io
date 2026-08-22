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
6. Identify every existing guide navigation block with `rg`. The new Creators link must be added consistently wherever guide links are intentionally listed.

### Content approval gate

Before adding an `active` creator or video to the source JSON, confirm its public YouTube page and record original and canonical URLs as provenance. A video is eligible only when all of these are true:

- It is publicly reachable without signing in.
- Its page, title, description, or clear contextual evidence establishes Invincible: Guarding the Globe relevance; record a short evidence note.
- It is relevant to players: guide, tier list, update, event, team-building, or gameplay.
- Its title, publication date, and 11-character video ID are confirmed from the YouTube page.
- It is a standard video or replayable livestream. Shorts do not count toward qualification.

The supplied candidate set includes these seed URLs; group them by verified channel and research each channel further:

| Video ID | Confirmed title | Confirmed publication date | Direct URL |
|---|---|---|---|
| `kPDC78Dv1NI` | Boss Raid is Finally Here! | unknown | `https://www.youtube.com/watch?v=kPDC78Dv1NI` |
| `1NF0U3lJYoo` | We Waited All This Time… FOR THIS?! | unknown | `https://www.youtube.com/watch?v=1NF0U3lJYoo` |
| `vZ0pb6iUPP0` | My Boss Raid FEEDBACK! | unknown | `https://www.youtube.com/watch?v=vZ0pb6iUPP0` |
| `P6yTQHW6YFA` | New Recruitment Road Event!! | unknown | `https://www.youtube.com/watch?v=P6yTQHW6YFA` |
| `r4c19_n0wr4` | The Entire Second Season of Invincible In Invincible Guarding The Globe | unknown | `https://www.youtube.com/watch?v=r4c19_n0wr4` |
| `mCw0PowHTls` | I'M GOING FREE TO PLAY in Invincible: Guarding the Globe… Here's Why | unknown | `https://www.youtube.com/watch?v=mCw0PowHTls` |
| `wNKoLf9xKJA` | Invincible Guarding The Globe - New Hero Tease | unknown | `https://www.youtube.com/watch?v=wNKoLf9xKJA` |
| `pK9C7mUMceI` | NEW CHARACTER RELEASE DAY | unknown | `https://www.youtube.com/live/pK9C7mUMceI` |

The supplied Shorts `kGq-Racu8tw` and `sxosoNY7WDU` are retained as rejected research records and do not count. Before implementation, re-open every seed and research each verified channel until its status is known. The executor may replace a candidate only with another item that passes the eligibility rules above. Avatar Shuvd is preferred for the hero when active; no named secondary creator is mandatory.

## Phase 1 — Define the data contract

### Files

- Create: `data/youtube-creators.json`
- Create: `scripts/generate-youtube-creators.js`
- Create: `data/generated/youtube-creators.js`
- Create: `tests/youtube-creators-generator.test.js`
- Modify: `package.json`

### 1.1 Source JSON

Create `data/youtube-creators.json` with a top-level object containing `updated`, `contentMaintainer`, `reviewCadenceDays`, `featuredCreatorId`, `candidateSources`, and `creators`.

```json
{
  "updated": "2026-08-22",
  "contentMaintainer": "Anomaly Alpha",
  "reviewCadenceDays": 90,
  "featuredCreatorId": "avatar-shuvd",
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
      "sourceUrl": "https://www.youtube.com/@AvatarShuvd",
      "featuredCreator": true
    }
  ]
}
```

Research all nine supplied channels. Every active creator requires at least six confirmed eligible items, including at least three published in the previous 180 days. Standard videos and replayable livestreams count; Shorts do not. Keep up to twelve locally rendered items and retain additional validated records in source data.

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
  "evidenceNote": "The title and page content identify an Invincible: Guarding the Globe tier-list video."
}
```

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
- `contentMaintainer` is a non-empty string and `reviewCadenceDays` is an integer from 30 to 180.
- Unique lowercase kebab-case creator IDs.
- Unique numeric `displayOrder` values.
- Creator status in `active`, `pending`, or `hidden`.
- Valid ISO date-only values for `updated`, `lastChecked`, and `published`.
- Active and pending creator URLs begin with `https://www.youtube.com/` when a channel is verified.
- Active creator fields are non-empty.
- Tags are a non-empty string array for active creators.
- Video IDs are unique across every creator and match `^[A-Za-z0-9_-]{11}$`.
- Video status in `active`, `pending`, or `unavailable`.
- Active featured videos have all required fields and valid `lastChecked`/`published` dates.
- Active featured videos have a concise, non-empty description.
- Active creators contain at least six eligible items, including at least three published within the previous 180 days.
- Pending creators contain at least one eligible item.
- Hidden creators contain zero eligible items and never appear in public output.
- The featured creator is active and is excluded from the normal list when rendered in the hero.
- Store submitted URLs, canonical URLs, evidence notes, rejection reasons, and image-license metadata.
- Pending and unavailable videos never appear in generated public cards or JSON-LD.
- Every public video passes the content approval gate. Standard videos and replayable livestreams are eligible; Shorts are retained as rejected records and never qualify.

### 1.4 Generated outputs

The generator must write:

```js
window.__YOUTUBE_CREATORS = [/* public, sorted creator data */];
```

to `data/generated/youtube-creators.js`.

It must also replace two explicit marker pairs in `guide/creators/index.html`:

```html
<!--CREATOR_SECTIONS_START-->
<!--CREATOR_SECTIONS_END-->

<!--CREATORS_JSON_LD_START-->
<!--CREATORS_JSON_LD_END-->
```

The generated HTML keeps the actual creator content in the static document for crawlers and `file://` use. The generated JavaScript gives `script.js` the data needed to populate the modal. Escape all text interpolated into HTML, attribute values, and JSON-LD.

The generator must first assert that each marker pair occurs exactly once. It must retain the markers after replacement, so a second run produces byte-for-byte identical creator sections and JSON-LD. Run the generator twice during verification and fail the test if the second run changes the file.

Generated output must render the approved `featuredCreatorId` as a static hero with the creator profile and six featured cards, then omit that creator from the normal list. Active creators come first in `displayOrder`; pending creators follow in the same editorial order; hidden creators are omitted. Pending creators render available eligible cards, a clear pending label, and a verified channel link. The normal list and hero must remain correct with JavaScript disabled.

Generate six featured cards per active creator and an accessible expansion revealing up to twelve validated cards, plus a verified channel link. The generator must include every locally visible item in the ItemList/VideoObject JSON-LD. The featured creator is selected during the approved `/update-creators` workflow and is not rotated in the browser.

### 1.5 Build integration

Add:

```json
"update-creators": "node scripts/generate-youtube-creators.js"
```

to `package.json` scripts. Add a second script:

```json
"test:creators": "node tests/youtube-creators-generator.test.js"
```

Refactor the generator so its pure validation and rendering functions can be imported by this test file while the CLI writes project files only when executed directly. Update `build` to run this generator after the existing data generators and before CSS/JavaScript minification. The build command must continue to work on a clean checkout.

## Phase 2 — Build the new guide page

### Files

- Create: `guide/creators/index.html`
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

Add BreadcrumbList and CollectionPage JSON-LD to the existing graph style. Let the generator populate a separate ItemList/VideoObject marker from every locally visible active or pending item, up to twelve per creator. Do not include subscriber counts in visible content or schema.

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

Below it, include the `CREATOR_SECTIONS` markers exactly once. Load `../../data/generated/youtube-creators.js` before `../../script.js`.

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
- External `Visit Channel` link only for active creators.
- A responsive video-list container.

Generate each active featured video as exactly one button:

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
- `.gem-creator`
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
- Modify: `sitemap.xml`
- Review/modify only if needed: `privacy/index.html`, `_headers`, `README.md`, `CONTEXT.md`

1. Find all intentional guide navigation surfaces, including top navigation, homepage structured guide lists, and bottom cross-link card grids. Add a `Creators` link with correct relative paths everywhere. Normalize existing `Redeem` links across the same surfaces.
2. Add `https://anomaly-alpha.github.io/guide/creators/` to `sitemap.xml` with the current implementation date.
3. Add a concise page-level privacy disclosure: loading thumbnails and opening playback may connect the visitor to YouTube. A public correction/removal route is not required.
4. Inspect `_headers`. If no CSP exists, do not introduce an unrelated policy. If a CSP exists in the deployed configuration, allow `https://www.youtube-nocookie.com` in `frame-src` and `https://i.ytimg.com` in `img-src`.
5. Keep `README.md`, `CONTEXT.md`, the approved spec, and this plan manually maintained during recurring content refreshes.

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
8. Keep README, CONTEXT, the plan, and the spec manual.
9. Run `npm run test:creators`, `npm run update-creators`, `npm run build`, and relevant browser checks after approval.

The public page displays active creators first and pending creators with at least one eligible item at the bottom. Hidden and unavailable records remain in source data for the editorial audit trail.

## Phase 5 — Verification

### Automated checks

Run from the repository root:

```text
npm run test:creators
npm run update-creators
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
8. Any remaining blocker, including an active creator failing the six-item/recent-activity gates. The lack of a correction/removal contact link is not a blocker for this release.
