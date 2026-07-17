# Plan: Image Metadata Fix + Meta Tag Additions

**Date:** 2026-07-17
**Source:** GSC Image Metadata error + SEO gap analysis
**Scope:** 2 independent tasks (can run in parallel)

---

## Task A: Fix ImageObject Missing `creator` (GSC Error)

**Problem:** Google Search Console reports 1 Image Metadata structured data issue — `ImageObject` is missing the required `creator` field.

**Fix:** Add `"creator": { "@type": "Organization", "name": "Anomaly Alpha" }` to every `ImageObject` in the site.

### Files and locations

| File | ImageObject location | Current state | Change |
|------|---------------------|---------------|--------|
| `index.html` | Line 941 — standalone `"@type": "ImageObject"` | Has `contentUrl`, `width`, `height`, `caption`, `license`, `acquireLicensePage`, `creditText`, `copyrightNotice` | Add `"creator"` |
| `index.html` | Line 957 — Organization `logo` `"@type": "ImageObject"` | Has `url`, `width`, `height` | Add `"creator"` (also rename org `name` to `"Anomaly Alpha"` per ToS spec) |
| `guide/code/index.html` | ~line 123 — Publisher `logo` `"@type": "ImageObject"` | Has `url`, `width`, `height` | Add `"creator"` (also rename publisher `name` to `"Anomaly Alpha"`) |
| `guide/event/index.html` | ~line 102 — Publisher `logo` `"@type": "ImageObject"` | Same | Same |
| `guide/faq/index.html` | ~line 102 — Publisher `logo` `"@type": "ImageObject"` | Same | Same |
| `guide/login/index.html` | ~line 101 — Publisher `logo` `"@type": "ImageObject"` | Same | Same |
| `guide/pvp/index.html` | ~line 103 — Publisher `logo` `"@type": "ImageObject"` | Same | Same |
| `guide/beginners/index.html` | ~line 101 — Publisher `logo` `"@type": "ImageObject"` | Same | Same |

**Note:** `guide/xp/index.html` and `404.html` have no `ImageObject` — skipped.

**Verification:** Paste each page into Google Rich Results Test → confirm no Image Metadata errors.

---

## Task B: Add 4 Missing Meta Tags to All 9 Pages

**Problem:** The site is missing common meta tags for mobile browser integration and security.

**Add these 4 tags to all 9 HTML pages:**

```html
<meta name="theme-color" content="#050a14">
<meta name="apple-mobile-web-app-title" content="Gem Rewards Calculator">
<meta name="color-scheme" content="dark light">
<meta name="referrer" content="strict-origin-when-cross-origin">
```

### Rationale

| Tag | Value | Purpose |
|-----|-------|---------|
| `theme-color` | `#050a14` | Address bar / browser chrome matches dark background on mobile |
| `apple-mobile-web-app-title` | `Gem Rewards Calculator` | Proper app name when saved to iOS home screen (site already has `mobile-web-app-capable`) |
| `color-scheme` | `dark light` | Tells browser page supports both themes; prevents light scrollbars/form controls on dark pages |
| `referrer` | `strict-origin-when-cross-origin` | Security best practice — sends origin only for cross-origin requests, full URL for same-origin |

### Pages to update

1. `index.html` — homepage
2. `guide/code/index.html`
3. `guide/event/index.html`
4. `guide/faq/index.html`
5. `guide/login/index.html`
6. `guide/pvp/index.html`
7. `guide/beginners/index.html`
8. `guide/xp/index.html`
9. `404.html`

### Insertion point

Place the 4 tags in `<head>` **after** the viewport meta tag and **before** the OG tags, grouped together with a comment:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Browser integration & security -->
    <meta name="theme-color" content="#050a14">
    <meta name="apple-mobile-web-app-title" content="Gem Rewards Calculator">
    <meta name="color-scheme" content="dark light">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="description" content="...">
```

### Pages NOT needing changes (from Task A overlap)
None — Task B touches all 9 pages, Task A touches 8. The 404.html and xp.html in Task B are independent additions.

---

## Combined file touch list

| File | Task A | Task B |
|------|--------|--------|
| `index.html` | ✅ Add `creator` to 2 ImageObjects + rename org name | ✅ Add 4 meta tags |
| `guide/code/index.html` | ✅ | ✅ |
| `guide/event/index.html` | ✅ | ✅ |
| `guide/faq/index.html` | ✅ | ✅ |
| `guide/login/index.html` | ✅ | ✅ |
| `guide/pvp/index.html` | ✅ | ✅ |
| `guide/beginners/index.html` | ✅ | ✅ |
| `guide/xp/index.html` | — | ✅ |
| `404.html` | — | ✅ |

**Total: 9 files, 2 tasks**

---

## Verification

1. `npm run build` — ensure Tailwind + minification doesn't break
2. Open each modified page in browser — check no rendering regressions
3. Google Rich Results Test — at minimum homepage + code guide (the 2 pages with ImageObject that Google most likely crawls)
4. Mobile check — open homepage on mobile (or DevTools mobile mode) → verify browser chrome shows dark `#050a14`
5. `npm run lighthouse:all` → `npm run lighthouse:report` — confirm no regressions

---

## Related

- Spec: `docs/compose/specs/2026-07-17-tos-privacy-design.md` (shared `Anomaly Alpha` publisher rename)
- GSC issue: Image Metadata — Missing field "creator"
