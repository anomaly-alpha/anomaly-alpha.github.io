# Plan 93: CSS Nesting Migration

**Problem:** CSS uses flat selectors with repeated parent prefixes (`.gem-card__header`, `.gem-card__body`). Native CSS nesting would reduce repetition and improve readability.

**Goal:** Migrate to native CSS nesting where supported.

---

## Step 1: Enable CSS nesting in build

Since Tailwind already processes CSS, add the nesting plugin:

```bash
npm install --save-dev postcss-nesting
```

## Step 2: Rewrite CSS with nesting

```css
/* Before */
.gem-card { border: 1px solid ...; }
.gem-card__header { display: flex; }
.gem-card__header:hover { background: ...; }
.gem-card__body { padding: 1rem; }

/* After */
.gem-card {
  border: 1px solid ...;

  &__header {
    display: flex;

    &:hover {
      background: ...;
    }
  }

  &__body {
    padding: 1rem;
  }
}
```

## Step 3: Update Tailwind input

```css
/* src/tailwind-input.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  /* Nested styles here */
}
```

## Files Modified
- `styles.css` — nested CSS
- `src/tailwind-input.css` — nesting plugin

## Verification
```bash
npm run build
# Output CSS should be flattened (nesting resolved)
# Visual check — identical to before
```
