# Plan 141: `<details>` for Collapsible Guide Sections

**Gap:** Guide pages have long sections. There's no way to collapse/expand sections to focus on specific content. Native `<details>`/`<summary>` provides this without JS.

**Best practice (HTML spec):** Use `<details>` for expandable guide sections. Screen-reader-friendly, keyboard-accessible, zero JS needed.

---

## Step 1: Identify collapsible sections

Guide pages with:
- Payout tables (PvP guide)
- Code list (Code guide)
- Multiple event explanations (Event guide)
- Multiple FAQ questions (FAQ guide)

---

## Step 2: Wrap sections

```html
<details class="gem-details" open>
  <summary class="gem-details__summary">
    <span class="gem-text--cyan text-sm font-bold">Payout Tables</span>
  </summary>
  <div class="gem-details__content">
    <!-- existing payout table content -->
  </div>
</details>

<details class="gem-details">
  <summary class="gem-details__summary">
    <span class="gem-text--cyan text-sm font-bold">Alliance War Rewards</span>
  </summary>
  <div class="gem-details__content">
    <!-- content -->
  </div>
</details>
```

---

## Step 3: Style details element

```css
.gem-details {
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.gem-details__summary {
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.03);
  cursor: pointer;
  list-style: none; /* Remove default triangle */
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gem-details__summary::-webkit-details-marker {
  display: none; /* Remove Safari default triangle */
}

.gem-details__summary::after {
  content: '+';
  font-size: 1.2rem;
  color: var(--gem-cyan);
  transition: transform 0.2s;
}

.gem-details[open] .gem-details__summary::after {
  content: '−';
}

.gem-details__content {
  padding: 1rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}
```

---

## Step 4: Add smooth open/close animation

```css
.gem-details__content {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

/* The `details` element needs `interpolate-size` for smooth animation */
.gem-details {
  interpolate-size: allow-keywords;
}
```

---

## Files Modified: `guide/*/index.html`, `styles.css`
