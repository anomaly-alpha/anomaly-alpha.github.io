# Plan 71: Hreflang for Future i18n

**Problem:** The site is English-only now, but if translated versions are added in the future, hreflang tags will be needed. Planning the structure now prevents future rework.

**Goal:** Add hreflang self-referencing tags as a foundation for future internationalization.

---

## Step 1: Add self-referencing hreflang

```html
<!-- All HTML pages — add to <head> -->
<link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/">
<link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/">
```

## Step 2: Add hreflang to guide pages

```html
<!-- guide/pvp/index.html -->
<link rel="alternate" hreflang="en" href="https://anomaly-alpha.github.io/guide/pvp/">
<link rel="alternate" hreflang="x-default" href="https://anomaly-alpha.github.io/guide/pvp/">
```

## Step 3: Document future i18n structure

```markdown
# docs/I18N.md
## Adding a new language

1. Create `/guide/{lang}/` directory or `/es/index.html` etc.
2. Add hreflang tags to all pages pointing to new language
3. Add hreflang tags to new language pages pointing to English
4. Update sitemap.xml with new URLs
```

## Files Modified
- All 8 HTML pages — hreflang tags
- `docs/I18N.md` — new file

## Verification
```bash
grep 'hreflang' index.html
# Should show en and x-default references
```
