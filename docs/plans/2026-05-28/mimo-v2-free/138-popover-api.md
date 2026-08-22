# Plan 138: Popover API for Tooltips and Dropdowns

**Gap:** Tooltips and dropdowns (if any) are implemented with custom JS/CSS. The Popover API (baseline 2024) provides native top-layer rendering, light-dismiss behavior, and accessibility — no JS needed for basic cases.

**Best practice (web.dev):** Use `popover="auto"` for tooltips and dropdowns. Renders in the top layer (above everything), closes on Escape/click-outside, manages focus automatically.

---

## Step 1: Add popover for league info tooltips

```html
<button popovertarget="league-info-1" class="gem-btn--icon text-xs" aria-label="League info">
  ?
</button>

<div id="league-info-1" popover="auto" class="gem-tooltip">
  <p class="gem-text--cyan text-xs font-bold">Intern League</p>
  <p class="gem-text--muted text-xs">500 players — rank 1-10 rewards</p>
</div>
```

---

## Step 2: Style the popover

```css
.gem-tooltip {
  padding: 1rem;
  border: 1px solid var(--gem-border--accent);
  border-radius: 8px;
  background: var(--gem-modal-bg);
  max-width: 250px;
  inset: auto;
  margin: 0.25rem;
}

.gem-tooltip::backdrop {
  background: transparent; /* No backdrop for tooltips */
}
```

---

## Step 3: Use for rank info on PvP cards

```html
<span popovertarget="rank-detail-1" class="gem-text--cyan text-xs cursor-help">
  Rank info ⓘ
</span>

<div id="rank-detail-1" popover="auto" class="gem-tooltip">
  Lower rank number = better position.
  Rank 1 is the top position in any league.
</div>
```

---

## Step 4: Verify accessibility

```bash
# Tab to popover trigger → press Enter → popover opens
# Escape → popover closes
# Click outside → popover closes
# Screen reader announces popover content
```

---

## Files Modified: `index.html`, `styles.css`
