# Plan 128: Popover API for Tooltips

**Problem:** Tooltips use custom JavaScript for show/hide logic. The Popover API provides native tooltip behavior with proper accessibility.

**Goal:** Replace custom tooltips with native popover.

---

## Step 1: Update tooltip HTML

```html
<!-- Before -->
<div class="gem-tooltip">
  <span class="gem-tooltip__trigger">Hover me</span>
  <div class="gem-tooltip__content">Tooltip text</div>
</div>

<!-- After -->
<button popovertarget="tooltip-1" aria-describedby="tooltip-1">Hover me</button>
<div id="tooltip-1" popover class="gem-tooltip">Tooltip text</div>
```

## Step 2: Add popover CSS

```css
/* styles.css */
[popover] {
  border: none;
  background: var(--gem-tooltip-bg);
  color: var(--gem-text--primary);
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--gem-tooltip-border);
  font-size: 0.8rem;
  max-width: 250px;
}

[popover]:popover-open {
  display: block;
}
```

## Step 3: Use auto popover for hover

```html
<button popovertarget="tooltip-1" popovertargetaction="toggle"
        onmouseenter="this.showPopover()" onmouseleave="this.hidePopover()">
  Info
</button>
```

## Files Modified
- `index.html` — popover tooltips
- `styles.css` — popover styles

## Verification
```bash
npm run build
# Hover tooltip — should appear natively
# Chrome 114+, Firefox 129+, Safari 17.4+
```
