# Plan 11: Guide Page Consistency Audit

**Problem:** The 6 guide pages have drifted in structure, meta tags, and data accuracy. The code guide title still says "26 Active Codes" (should be 24). Structured data presence varies widely (beginners has 5 references, event has 15). Internal linking patterns are inconsistent.

**Goal:** Audit all 6 guide pages against a canonical template and fix all inconsistencies.

---

## Step 1: Define canonical guide page template

Every guide page must have:

**Required elements:**
- `<title>` with consistent format: `"[Topic] — Gem Rewards Guide | Invincible Guarding the Globe"`
- `<meta name="description">` — unique, keyword-rich, 150-160 chars
- `<meta property="og:title">` matching `<title>`
- `<meta property="og:description">` matching meta description
- `<meta property="og:url">` self-referencing
- `<meta property="og:image">` per-page PNG
- `<meta name="twitter:card">` summary_large_image
- `<link rel="canonical">` self-referencing
- `<link rel="stylesheet">` to both CSS files
- `<style>` inlined critical CSS
- `<main id="main-content">` landmark
- `<h1>` with page title
- `<h2>` section headings
- Back link to main page (`/`)
- Links to all 5 other guides
- `<footer class="gem-contributors">`
- Structured data: BreadcrumbList + Guide

---

## Step 2: Audit each page

Run this check script:

```bash
#!/bin/bash
PAGES="guide/code guide/event guide/pvp guide/login guide/faq guide/beginners"
for p in $PAGES; do
  echo "=== $p ==="
  f="$p/index.html"
  grep -c 'og:title' "$f" || echo "  MISSING: og:title"
  grep -c 'og:description' "$f" || echo "  MISSING: og:description"
  grep -c 'og:image' "$f" || echo "  MISSING: og:image"
  grep -c 'og:url' "$f" || echo "  MISSING: og:url"
  grep -c 'twitter:card' "$f" || echo "  MISSING: twitter:card"
  grep -c 'canonical' "$f" || echo "  MISSING: canonical"
  grep -c 'id="main-content"' "$f" || echo "  MISSING: main-content"
  grep -c 'BreadcrumbList' "$f" || echo "  MISSING: BreadcrumbList schema"
  grep -c 'Guide' "$f" | head -1
  grep -c 'guide/.*/index.html' "$f" || echo "  MISSING: links to other guides"
  echo ""
done
```

---

## Step 3: Specific fixes needed

### 3a: Code guide title — "26 Active Codes" → "24 Active Codes"

**In `guide/code/index.html`**, line containing `<title>`:

```html
<title>Invincible Guarding the Globe Codes — 24 Active Codes</title>
```

Same for:
```html
<meta property="og:title" content="Invincible Guarding the Globe Codes — 24 Active Codes">
<meta name="twitter:title" content="Invincible Guarding the Globe Codes — 24 Active Codes">
```

### 3b: Structured data — missing pages

Some pages lack BreadcrumbList + Guide schema. Add to all 6:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://anomaly-alpha.github.io/" },
    { "@type": "ListItem", "position": 2, "name": "[Page Topic] Guide", "item": "https://anomaly-alpha.github.io/guide/[page]/" }
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Guide",
  "name": "[Page Title]",
  "description": "[Meta description]",
  "url": "https://anomaly-alpha.github.io/guide/[page]/",
  "author": {
    "@type": "Person",
    "name": "Anomaly"
  }
}
</script>
```

### 3c: Internal linking completeness

Verify each guide links to all 5 other guides:
```bash
for p in code event pvp login faq beginners; do
  echo "=== $p ==="
  for other in code event pvp login faq beginners; do
    if [ "$p" != "$other" ]; then
      found=$(grep -c "guide/$other/" "guide/$p/index.html")
      [ "$found" -eq 0 ] && echo "  MISSING: link to $other"
    fi
  done
done
```

### 3d: Beginners page content gap

The beginners page has significantly fewer structured data references. Consider adding:
- FAQPage schema (it answers "what should I spend gems on?")
- More section headings to improve content depth

---

## Step 4: Verify meta description character counts

```bash
for f in guide/*/index.html; do
  desc=$(grep 'name="description"' "$f" | sed 's/.*content="//;s/".*//')
  echo "$(basename $(dirname $f)): ${#desc} chars"
done
```

Target: 150-160 characters per description.

---

## Files Modified

| File | Change |
|------|--------|
| `guide/code/index.html` | Fix "26" → "24" in title + OG + Twitter tags |
| `guide/*/index.html` (×6) | Add missing BreadcrumbList + Guide schema where absent |
| `guide/*/index.html` (×6) | Add missing links to other guides |

---

## Verification

```bash
# Re-run the audit script — all pages should pass all checks
# Check that code guide no longer says "26 Active Codes"
grep "26 Active" guide/code/index.html  # Should return nothing
```
