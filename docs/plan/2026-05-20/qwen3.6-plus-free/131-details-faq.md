# Plan 131: <details> for FAQ

**Problem:** The FAQ page uses custom JavaScript for expand/collapse. Native `<details>` elements provide this behavior without JS.

**Goal:** Replace custom FAQ accordion with `<details>` elements.

---

## Step 1: Update FAQ HTML

```html
<!-- guide/faq/index.html -->
<details class="gem-faq__item">
  <summary class="gem-faq__question">How many gems can I earn per week?</summary>
  <div class="gem-faq__answer">
    <p>Players can earn approximately 4,043 gems per week from all sources...</p>
  </div>
</details>

<details class="gem-faq__item">
  <summary class="gem-faq__question">What are the PvP leagues?</summary>
  <div class="gem-faq__answer">
    <p>There are 14 PvP leagues: Intern, Junior I through III...</p>
  </div>
</details>
```

## Step 2: Add styling

```css
/* styles.css */
.gem-faq__item {
  border-bottom: 1px solid var(--gem-border--subtle);
  padding: 0.75rem 0;
}
.gem-faq__question {
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.gem-faq__question::-webkit-details-marker { display: none; }
.gem-faq__question::before {
  content: '▸ ';
  color: var(--gem-cyan);
  transition: transform 0.2s;
}
details[open] .gem-faq__question::before {
  content: '▾ ';
}
.gem-faq__answer {
  padding: 0.5rem 0 0 1.25rem;
  color: var(--gem-text--secondary);
}
```

## Files Modified
- `guide/faq/index.html` — details elements
- `styles.css` — FAQ styles

## Verification
```bash
npm run build
# Click FAQ questions — should expand/collapse natively
# No JavaScript needed for toggle
```
