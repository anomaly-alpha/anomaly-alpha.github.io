---
feature: image-metadata
status: delivered
updated: 2026-07-26
branch: fix/image-metadata
commits: 5583260..HEAD
---

# Image Metadata Structured Data

## Report

**What was built** — Added missing Google Image Metadata structured data properties (`license`, `acquireLicensePage`, `creditText`, `copyrightNotice`, `creator`) to all 10 `ImageObject` entries across 8 pages (`index.html`, `terms/index.html`, `privacy/index.html`, and 7 guide pages). Also updated existing `creditText`/`copyrightNotice` values from "Gem Rewards Calculator" to "Anomaly Alpha" for consistency with the publisher organization name change.

**Verification** — `npm run build` passes (Tailwind + CSS min + JS min). All 10 ImageObject entries verified via JSON-LD parsing: every entry has `license`, `acquireLicensePage`, `creditText`, `copyrightNotice`, and `creator` with "Anomaly Alpha" attribution values. Lighthouse could not run (no Chrome on this system).

**Journey log** — Credit text attribution: user confirmed "Anomaly Alpha" over "Gem Rewards Calculator". Noindex pages (terms, privacy): user confirmed to fix them too. GSC reported 4 issues; fix covers all 10 ImageObject entries proactively.

## [S1] Problem

Google Search Console reports 4 Image Metadata structured data issues on `https://anomaly-alpha.github.io/`. Nine `ImageObject` entries across the site are missing required metadata properties (`license`, `acquireLicensePage`, `creditText`, `copyrightNotice`, `creator`) that Google expects for image licensing attribution.

## [S2] Design

Add the following properties to every `ImageObject` entry that lacks them:

```json
"license": "https://anomaly-alpha.github.io/",
"acquireLicensePage": "https://anomaly-alpha.github.io/",
"creditText": "Anomaly Alpha",
"copyrightNotice": "\u00a9 Anomaly Alpha"
```

For image objects also missing `creator`:

```json
"creator": { "@type": "Organization", "name": "Anomaly Alpha" }
```

### Affected ImageObject entries

| Page | Line | Type | Missing / Update |
|------|------|------|-----------------|
| `index.html` | 946 | WebPageElement image | `creditText`/`copyrightNotice` update to "Anomaly Alpha" |
| `index.html` | 963 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `terms/index.html` | 49 | Organization logo | all 5 (inc. `creator`) |
| `privacy/index.html` | 49 | Organization logo | all 5 (inc. `creator`) |
| `guide/login/index.html` | 106 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `guide/pvp/index.html` | 108 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `guide/event/index.html` | 107 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `guide/faq/index.html` | 107 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `guide/beginners/index.html` | 106 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |
| `guide/code/index.html` | 128 | Organization logo | `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` |

### No-change entries

`index.html` line 946 (WebPageElement image) already has the full set — not modified structurally, but its `creditText` and `copyrightNotice` values are updated from "Gem Rewards Calculator" to "Anomaly Alpha" for consistency.

### Insertion pattern

For entries that already have `creator` (guide pages + index.html:963), insert the 4 missing fields between `height` and `creator` (or at end of object).

For entries missing everything (terms, privacy), insert all 5 fields.

### Verification

- `npm run build` passes (no build errors).
- Validate structured data output: each ImageObject has all 4 metadata fields present.

## [S3] Out of Scope

- No structural changes to `index.html` line 946 (already has metadata fields) — only value update (`creditText`/`copyrightNotice` → "Anomaly Alpha").
- No changes to non-ImageObject structured data.
- No changes to OG tags, meta tags, or page content.
- No changes to 404.html (no ImageObject present).
- No functional or visual changes — structured data only.

## Tasks

- [x] T1: Add missing Image Metadata to all 9 incomplete ImageObject entries + update `creditText`/`copyrightNotice` on `index.html:946` — acceptance: each of the 10 entries verified to have `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` (and `creator` where missing) with value "Anomaly Alpha" (covers: S2)
- [x] T2: Build and verify — acceptance: `npm run build` succeeds (covers: S2; depends: T1)
