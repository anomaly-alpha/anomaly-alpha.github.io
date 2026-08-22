# Plan 116: `:has()` Parent Selectors

**Gap:** The project likely uses JS for some styling logic that `:has()` could handle in pure CSS (e.g., "highlight card when its checkbox is checked").

**Best practice (web.dev):** `:has()` (baseline 2024) enables parent selection based on child state. Use it to simplify JS logic.

---

## Step 1: Audit JS-driven parent styling

Look for patterns like:
```js
// JS checking child state to style parent
if (select.value === 'someValue') {
  card.classList.add('gem-card--highlighted');
}
```

Replace with CSS:
```css
.gem-card:has(.gem-select--league[value="11"]) {
  border-color: var(--gem-cyan);
}
```

---

## Step 2: Apply to mode filter highlighting

```css
/* Highlight cards when their mode button is hovered */
body:has(.gem-mode-btn--event:hover) .gem-card--event {
  opacity: 1;
  border-color: var(--gem-event);
}

body:has(.gem-mode-btn--event:hover) .gem-card:not(.gem-card--event) {
  opacity: 0.4;
}
```

---

## Step 3: Style card with active info button

```css
.gem-card:has(.gem-card__info-btn:focus-visible) {
  outline: 2px solid var(--gem-cyan);
  outline-offset: 2px;
}
```

---

## Step 4: Remove equivalent JS

After migration, remove the JS that was doing the same job.

---

## Files Modified: `styles.css`, `script.js` (simplify)
