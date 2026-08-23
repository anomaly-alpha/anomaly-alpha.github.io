---
feature: youtube-creators
status: approved
updated: 2026-08-22
---

# YouTube Creators Directory

## Problem

The site has no dedicated place for players to discover reliable YouTube content about Invincible: Guarding the Globe. The first release will research nine supplied creator candidates, include every candidate that meets the evidence gates, and retain incomplete candidates for future review.

## Scope

In scope:

- New static guide page at `/guide/creators/`.
- Data-driven creator sections sourced from verified public YouTube channels.
- A larger static featured-creator hero. Avatar Shuvd is preferred when qualified; another active creator may be selected as fallback.
- Creator profile metadata and channel links.
- Six confirmed featured items for every active creator, with up to twelve locally revealed items.
- YouTube-hosted thumbnail images.
- Visible play overlays.
- Lazy, user-initiated YouTube modal playback.
- Responsive layout, dark/light mode, keyboard access, and reduced-motion support.
- Page metadata, structured data, sitemap inclusion, and navigation links.

Out of scope:

- Candidates outside the nine supplied channels in this release.
- Authenticated scraping, YouTube Data API integration, or discovery of unrelated channels during updates.
- User accounts, ratings, comments, subscriptions, or personalization.
- Locally stored thumbnails or video files.
- Autonomous synchronization with YouTube. `/add-creator` and `/update-creators` remain approval-gated.

## Project integration

The implementation must follow the existing static architecture:

| Purpose | File |
|---|---|
| Source data | `data/youtube-creators.json` |
| Data generator and validator | `scripts/generate-youtube-creators.js` |
| Generated browser data | `data/generated/youtube-creators.js` |
| Page markup | `guide/creators/index.html` |
| Shared behavior | `script.js` |
| Shared component styles | `styles.css` |
| Generated utility styles | `tailwind.css` |
| URL discovery | `sitemap.xml` |
| Privacy/embed policy, if required | `privacy/index.html` |
| External-frame/security headers, if required | `_headers` |
| Social preview asset | `og-images/creators.png` |

The page must work from both `file://` and a local web server. It must not use runtime `fetch()` for creator data. The generated JavaScript file must be loaded with a relative `<script>` path from the guide page.

The generator must be added to `package.json` as:

```text
generate-creators: node scripts/generate-youtube-creators.js
```

The existing `build` script must invoke `generate-creators` after the existing data generators and before CSS/JS minification. The name is intentionally distinct from the `/update-creators` editorial command. Generated output is committed, matching the existing promo-code workflow.

## Source data schema

`data/youtube-creators.json` is the only hand-edited creator content source. The generator must reject invalid data and exit non-zero when any required field is missing or duplicated.

The top-level object contains:

- `updated`: the source-data revision date.
- `contentMaintainer`: `Anomaly Alpha` for this release.
- `reviewCadenceDays`: exactly `90`, matching the durable reminder cadence.
- `featuredCreatorId`: the approved active creator used for the static hero.
- `candidateSources`: submitted channel/video URLs with `sourceUrl`, `kind`, `resolvedCreatorId` when known, `lastChecked`, `resolutionStatus`, and `statusReason` when unresolved or rejected.
- `ogImageSources`: external image provenance with `sourceUrl`, `license`, `attribution`, and `lastChecked` for every non-original image used by `og-images/creators.png`.
- `creators`: the normalized creator records.

Creator records retain full provenance, evidence notes, rejection reasons, last-checked dates, and image-license metadata where imagery is used. `featuredCreatorId` stores the approved static hero selection.

Required creator fields:

```json
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
```

Allowed creator status values:

- `active` — render normally.
- `pending` — render at the bottom with available eligible cards and a verified channel link.
- `hidden` — retain in source data for future checks but do not render publicly.

Required video fields:

```json
{
  "id": "u6m0gmOzwfs",
  "title": "Complete Tier List",
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

Every public video requires a concise editorial `description` for the card and its `VideoObject` entry. It may be written by the maintainer when grounded in public video evidence.
Rejected or unavailable records require a non-empty `statusReason`; active records may leave it empty.

Allowed video status values:

- `active` — render as a playable card.
- `pending` — exclude from public rendering until confirmed.
- `unavailable` — exclude from cards and report during validation.

Allowed category values are `Guides`, `Tier Lists`, `Updates`, `Events`, `Team Building`, `Gameplay`, and `Livestreams`. A `featured: true` item must have `status: active`; each active creator has exactly six featured items, while additional eligible items use `featured: false`.

Validation rules:

- Creator IDs must be unique and lowercase kebab-case.
- Video IDs must be unique across the page.
- Creator and video names cannot be empty.
- Channel URLs must use `https://www.youtube.com/`.
- Video IDs must match YouTube ID character constraints.
- Dates must use `YYYY-MM-DD`.
- Categories and statuses must use the documented values.
- `displayOrder` must be unique across all creator records; it orders active and pending creators, with the featured creator removed from the normal list after hero rendering.
- A featured video must have `status: active`.
- Every active creator must have at least six eligible items, including at least three published in the previous 180 days. Standard videos and replayable livestreams count; Shorts do not.
- A pending creator must have at least one eligible item and fail an active threshold. A zero-content candidate is hidden.
- A stale active creator becomes pending, remains visible at the bottom, and retains its available cards and verified channel link.
- Public names come from verified YouTube channel display names. Editorial descriptions, tags, and one-sentence video summaries are allowed when grounded in public evidence.
- Accepted and rejected links retain original URL, canonical URL where applicable, evidence notes, and reasons.
- `sourceUrl` preserves the submitted discovery URL; `channelUrl` is the verified canonical channel URL. They may be identical when the channel URL was the submitted source.
- `unavailable` and rejected records retain a non-empty `statusReason`.

Initial creator requirements:

- Research all nine supplied candidate channels. Include every candidate that qualifies and retain zero-content candidates as hidden source records.
- Avatar Shuvd is preferred for the hero whenever active; if he is not qualified, use another active creator selected by the approved editorial ranking.
- The approved featured creator is stored in `featuredCreatorId`; it is selected during the approved update workflow, not rotated in the browser.

## Thumbnail behavior

Do not store thumbnails locally. Derive the URL from the video ID:

```text
https://i.ytimg.com/vi/{VIDEO_ID}/maxresdefault.jpg
```

Use `hqdefault.jpg` as the fallback when the maximum-resolution image fails. The fallback must run only once to avoid an error loop. If both fail, show a neutral thumbnail placeholder with the video title and play icon.

Every thumbnail must include:

- `loading="lazy"`
- `decoding="async"`
- Fixed 16:9 aspect ratio
- Descriptive `alt` text: `Thumbnail for {video title} by {creator name}`
- `referrerpolicy="strict-origin-when-cross-origin"`

## Page structure

The page must follow the existing guide-page conventions:

- `<main>` landmark.
- Breadcrumb navigation labeled `Breadcrumb`.
- Shared guide navigation and legal footer.
- Existing sci-fi container, typography, borders, glow effects, and design tokens.
- Page title: `Invincible GTG YouTube Creators — Guides, Tier Lists & Gameplay`.
- Hero heading: `YouTube Creators`.

The page must contain a static featured hero followed by the normal creator list. The featured creator is omitted from the normal list to avoid duplication. If JavaScript is disabled, the generated static hero and normal list remain complete.

Each active creator section must contain:

- Creator name and handle.
- Short description.
- Content tags.
- Last-checked date.
- `Visit Channel` external link with `target="_blank"` and `rel="noopener noreferrer"`.
- Six featured video cards and an accessible expansion revealing up to twelve locally validated cards, plus a verified channel link.

Pending creators appear after active creators in maintained editorial order. They display available eligible cards, a clear pending label, and a verified channel link. Hidden creators do not render.

Each video card must be a keyboard-accessible `<button>` that opens the modal. The card must not contain a nested anchor. The separate `Watch on YouTube` action belongs inside the modal.

## Modal playback

Use a dedicated creator-video modal rather than coupling creator videos to the reward-card data model. It may reuse the existing modal visual tokens and lifecycle conventions.

The modal must have:

- `role="dialog"`.
- `aria-modal="true"`.
- `aria-labelledby` pointing to the modal title.
- A visible close button with an accessible label.
- Responsive 16:9 player container.
- Video title and creator name.
- `Watch on YouTube` fallback link.
- Escape-to-close.
- Outside-click-to-close.
- Focus trap while open.
- Initial focus on the close button.
- Focus restoration to the triggering card after close.
- Body scroll lock while open.
- Background content unavailable to keyboard interaction while open.

Create the iframe only after a user activates a video. Use the privacy-enhanced host:

```text
https://www.youtube-nocookie.com/embed/{VIDEO_ID}?autoplay=1&rel=0&playsinline=1&origin={PAGE_ORIGIN}
```

The implementation must URL-encode the origin and avoid constructing iframe URLs from arbitrary user input. On close, remove the iframe or clear its `src` so playback stops.

Autoplay is a convenience, not a requirement. If the browser blocks autoplay, the embedded player must remain usable with its native controls.

## Failure states

The UI must handle:

- Missing or failed thumbnail.
- Deleted/private video.
- Embedding disabled.
- Age-restricted video.
- Network failure.
- Autoplay blocked.
- A candidate with zero eligible content.

For video playback failures, keep the modal open, show a concise error message, and provide the `Watch on YouTube` link. Never leave an empty black modal with no explanation.

## Privacy and security

Loading a thumbnail and opening a video can make requests to YouTube. The page must disclose both thumbnail and playback connections in a concise page-level note near the creator content.

Before implementation, inspect and update `_headers` if the deployed security policy adds any of the following:

- `Content-Security-Policy` frame restrictions.
- `frame-src` restrictions.
- `img-src` restrictions.
- `Referrer-Policy` restrictions.

Use `strict-origin-when-cross-origin` and the privacy-enhanced YouTube embed host. Add a disclaimer that creators are independent and are not necessarily endorsed by Ubisoft, YouTube, or Anomaly Alpha. A correction/removal route is not required for this release. Record permission and attribution for any licensed creator imagery in source metadata.

## Metadata and structured data

Add or update:

- Canonical URL for `/guide/creators/`.
- Description and Open Graph/Twitter metadata.
- BreadcrumbList JSON-LD.
- `CollectionPage` JSON-LD.
- `ItemList` containing every locally visible active-status item, including expanded cards, up to the twelve-item cap per creator.
- `VideoObject` entries only for videos with confirmed title, thumbnail, publication date, and YouTube URL.
- `dateModified` using the latest confirmed `lastChecked` date.

The structured data includes the expanded cards even when the expansion control is initially closed; it is capped at twelve active-status items per creator and is not limited to the six featured cards.

Do not publish subscriber counts unless they are stored with a `lastChecked` date and clearly labeled as approximate.

## Navigation and generated files

Update the following as part of implementation:

- Create `guide/creators/index.html`.
- Add the page to every intentional guide navigation surface, including top navigation and bottom cross-link cards. Normalize existing Redeem links while touching those surfaces.
- Add the page to `sitemap.xml` with the implementation date as `lastmod`.
- Require the dedicated approved `og-images/creators.png` asset. Use only licensed creator imagery and record its source/license metadata.
- Add generated creator data to the build output.
- Keep source JSON and generated output synchronized.

## Testing and verification

The implementation is complete only after:

- `npm run generate-creators` validates and generates data successfully.
- `npm run build` completes successfully.
- JSON validation catches duplicate IDs, malformed URLs, missing dates, invalid statuses, threshold violations, missing evidence, and invalid source/canonical URLs.
- The page loads from `file://`.
- The page loads from the local development server.
- All qualifying supplied candidates render correctly; zero-content candidates are hidden.
- Pending candidates render at the bottom with their available cards and verified channel links.
- Thumbnail fallback behavior is tested.
- Modal open, close, Escape, outside-click, and focus restoration are tested.
- Iframe removal stops playback.
- Keyboard-only navigation reaches every card and control.
- Dark mode, light mode, mobile layout, and reduced-motion mode are checked.
- Broken or unavailable video states show a YouTube fallback link.
- Sitemap, canonical, Open Graph, and structured data are checked.
- Lighthouse accessibility, SEO, and performance checks pass without new critical issues.

## Acceptance criteria

- The new `/guide/creators/` page renders from generated creator data rather than duplicated page markup.
- Every active creator renders with six qualifying items, including three from the previous 180 days.
- Avatar Shuvd is the preferred featured creator when qualified; a qualified fallback is used otherwise.
- Pending creators with at least one eligible item render at the bottom; zero-content candidates are hidden but retained in source data.
- No invented channel or video information is published.
- Thumbnails use YouTube-hosted URLs, lazy loading, aspect-ratio reservation, and fallback handling.
- Every video card has a visible play overlay and accessible name.
- Video cards open a correctly labeled modal.
- Modal playback is lazy, privacy-enhanced, keyboard accessible, and stopped on close.
- Playback failures provide a useful message and direct YouTube link.
- The page works from `file://`, local server, desktop, mobile, dark mode, light mode, and reduced-motion mode.
- Navigation, sitemap, metadata, privacy disclosure, and structured data are updated.
- Adding a future creator requires only an approved validated data proposal and generated output; page markup does not need to be rewritten.
