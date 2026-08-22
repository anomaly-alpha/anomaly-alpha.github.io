# Plan 137: `@scope` CSS Encapsulation

**Gap:** All component styles are global. A `.gem-card` style applies to every `.gem-card` on the page. `@scope` lets you limit styles to a subtree, preventing leaks and reducing specificity wars.

**Best practice (web.dev):** Use `@scope (.gem-card) to (.gem-card__body)` to scope styles within the component boundary.

---

## Step 1: Apply to card component

```css
@scope (.gem-card) to (.gem-card__body) {
  /* These styles only apply within .gem-card, but NOT within .gem-card__body */
  :scope {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
  }

  .gem-card__title { font-size: 1rem; }
  .gem-card__value { font-size: 1.5rem; font-weight: 700; }
}
```

---

## Step 2: Apply to modal component

```css
@scope (.gem-modal--visible) {
  :scope {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .gem-modal__content { /* scoped to visible modal only */ }
  .gem-modal__header { /* scoped */ }
}
```

---

## Step 3: Apply to PvP card forms

```css
@scope (.gem-card--pvp) {
  .gem-select {
    /* Only targets selects inside PvP cards */
    background: rgba(233,30,138,0.1);
  }
}
```

---

## Step 4: Measure specificity improvement

Before `@scope`: selectors may need 3-4 classes to override.
After `@scope`: styles are bounded by the scope root, so simpler selectors work.

---

## Files Modified: `styles.css`
