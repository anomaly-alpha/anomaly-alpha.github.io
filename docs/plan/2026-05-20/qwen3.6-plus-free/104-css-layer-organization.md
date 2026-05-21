# Plan 104: CSS @layer Organization

**Problem:** CSS specificity issues require `!important` overrides in some places. CSS cascade layers would provide a cleaner way to manage specificity.

**Goal:** Organize CSS into cascade layers for predictable specificity.

---

## Step 1: Define cascade layers

```css
/* styles.css — reorganize into layers */
@layer reset, base, components, utilities;

@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
}

@layer base {
  body {
    font-family: var(--gem-font);
    background: var(--gem-bg-dark);
    color: var(--gem-text--primary);
  }
}

@layer components {
  .gem-card { ... }
  .gem-btn { ... }
  .gem-modal { ... }
  /* All BEM components */
}

@layer utilities {
  .gem-text--primary { color: var(--gem-text--primary); }
  .gem-text--muted { color: var(--gem-text--muted); }
  /* Utility classes */
}
```

## Step 2: Move Tailwind to utilities layer

```css
/* src/tailwind-input.css */
@layer utilities {
  @tailwind utilities;
}
```

## Files Modified
- `styles.css` — cascade layer organization
- `src/tailwind-input.css` — utilities layer

## Verification
```bash
npm run build
# No !important should be needed for component overrides
# Visual check — identical to before
```
