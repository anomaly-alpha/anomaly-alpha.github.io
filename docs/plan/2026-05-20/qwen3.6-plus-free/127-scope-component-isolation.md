# Plan 127: @scope for Component Isolation

**Problem:** CSS styles can leak between components. `@scope` provides style encapsulation without Shadow DOM.

**Goal:** Use `@scope` to isolate card component styles.

---

## Step 1: Scope card styles

```css
/* styles.css */
@scope (.gem-card) {
  :scope {
    border: 1px solid var(--gem-border--subtle);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  .gem-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .gem-card__title {
    font-size: 1.125rem;
    font-weight: 600;
  }

  .gem-card__body {
    padding: 1rem;
  }
}
```

## Step 2: Scope modal styles

```css
@scope (.gem-modal) {
  :scope {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }

  .gem-modal__content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
}
```

## Files Modified
- `styles.css` — @scope blocks

## Verification
```bash
npm run build
# Card styles should only apply within .gem-card
# Chrome 118+, Safari 17.4+, Firefox 129+
```
