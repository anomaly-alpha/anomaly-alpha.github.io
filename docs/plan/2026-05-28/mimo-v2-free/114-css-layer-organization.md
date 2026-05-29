# Plan 114: `@layer` CSS Cascade Organization

**Gap:** `styles.css` has no layer structure. All rules compete at the same cascade level, making overrides unpredictable. Tailwind utilities and BEM classes can conflict.

**Best practice (web.dev):** Use `@layer` to explicitly control cascade order. Lower layers can be overridden by higher layers.

---

## Step 1: Define cascade layers

```css
@layer reset, tokens, base, components, utilities, overrides;
```

---

## Step 2: Reorganize styles.css into layers

```css
@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
}

@layer tokens {
  :root {
    --gem-event: #ff6b35;
    --gem-pvp: #e91e8a;
    /* ... all CSS custom properties ... */
  }
}

@layer base {
  body { font-family: 'Rajdhani', sans-serif; }
  /* ... base element styles ... */
}

@layer components {
  .gem-card { /* ... */ }
  .gem-modal { /* ... */ }
}

@layer utilities {
  .gem-text--cyan { color: var(--gem-cyan); }
  /* ... utility classes ... */
}
```

---

## Step 3: Move Tailwind into correct layer

Tailwind utilities should be in the `utilities` layer — loaded **before** component overrides.

```css
@layer utilities {
  /* Tailwind classes go here — or import into this layer */
}
```

---

## Step 4: Verify specificity behavior

```bash
# Before: any rule could override any other (specificity wars)
# After: components → utilities → overrides (clear order)
# Test: open page, verify all styles applied correctly
```

---

## Files Modified: `styles.css`
