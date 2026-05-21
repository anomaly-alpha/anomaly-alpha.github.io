# Plan 95: Speculation Rules Prerendering

**Problem:** Guide pages load from scratch when users click guide links. Prerendering would make guide page navigation instant.

**Goal:** Add Speculation Rules API to prerender guide pages when users hover over links.

---

## Step 1: Add speculation rules script

```html
<!-- index.html — add to <head> -->
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "list",
      "urls": [
        "/guide/code/",
        "/guide/event/",
        "/guide/pvp/",
        "/guide/login/",
        "/guide/faq/",
        "/guide/beginners/"
      ],
      "eagerness": "moderate"
    }
  ]
}
</script>
```

## Step 2: Add prerender on hover for faster response

```html
<!-- Alternative: prerender on hover -->
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "document",
      "where": { "and": [
        { "href_matches": "/guide/*" },
        { "not": { "selector_matches": ".no-prerender" } }
      ]},
      "eagerness": "eager"
    }
  ]
}
</script>
```

## Files Modified
- `index.html` — speculation rules
- Guide pages — speculation rules pointing to other guides

## Verification
```bash
# Chrome 121+ required
# DevTools > Application > Speculation Rules — should show prerendered pages
# Click guide link — should load instantly
```
