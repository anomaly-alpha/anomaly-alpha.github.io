# Plan 140: `<search>` Element Migration

**Gap:** Navigation landmarks use `<nav aria-label="...">` and search sections use generic `<div>`. The `<search>` semantic element (baseline 2024) provides a built-in landmark for search or filtering regions.

**Best practice (HTML spec):** Use `<search>` instead of `<div role="search">` or generic containers for filter/search regions. Automatically exposes a `search` landmark.

---

## Step 1: Wrap mode filter buttons in `<search>`

```html
<search aria-label="Filter gem categories">
  <div class="gem-grid--modes">
    <button class="gem-mode-btn" onclick="filterCards('all')">All</button>
    <!-- ... -->
  </div>
</search>
```

---

## Step 2: Wrap any search/filter UI

```html
<search aria-label="Filter options">
  <!-- PvP presets, mode filters, etc. -->
</search>
```

---

## Step 3: Update screen reader announcements

```html
<search aria-label="Gem mode filters" role="group">
```

`role="group"` on the inner container gives additional structure.

---

## Step 4: Verify with axe-core

```bash
npx playwright test e2e/accessibility.spec.js
# Should not find any issues with search landmark
```

---

## Files Modified: `index.html`, `guide/*/index.html`
