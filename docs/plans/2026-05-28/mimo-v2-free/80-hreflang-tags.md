# Plan 80: Hreflang Tags for Multi-Region

**Problem:** The site serves English content globally. While the game is available in multiple regions (US, EU, Asia), the calculator is English-only. If multi-language versions are added later, hreflang tags will be needed.

**Goal:** Add `hreflang` tags for the current English-only version. Structure prepare for future localization.

---

## Step 1: Add self-referencing hreflang

```html
<link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/">
<link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/">
```

---

## Step 2: Add to all pages

Same tags in every page template.

---

## Step 3: Prepare for future languages

Add commented-out structure for future localization:

```html
<!-- Future localization (comment in when available):
<link rel="alternate" hreflang="es" href="https://anomaly-alpha.github.io/es/">
<link rel="alternate" hreflang="fr" href="https://anomaly-alpha.github.io/fr/">
<link rel="alternate" hreflang="de" href="https://anomaly-alpha.github.io/de/">
<link rel="alternate" hreflang="ja" href="https://anomaly-alpha.github.io/ja/">
<link rel="alternate" hreflang="ko" href="https://anomaly-alpha.github.io/ko/">
-->
```

---

## Step 4: Verify with Google Search Console

After deploying, check International Targeting in GSC:
- Verify no "no return tags" warnings
- Verify language targeting is correct

---

## Files Modified: `index.html`, `guide/*/index.html`
