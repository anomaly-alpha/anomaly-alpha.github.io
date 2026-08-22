# Plan 154: `appearance: base` for Form Consistency

**Gap:** The project uses `appearance: none` on `<select>` elements and custom styles. `appearance: base` (baseline 2024) provides a consistent base style across browsers while allowing custom colors/borders — simpler than full custom styling.

**Best practice (web.dev):** Use `appearance: base` for form controls. It strips browser-specific chrome while keeping native behaviors. Customize with your own border/background/shadow tokens.

---

## Step 1: Apply to all form elements

```css
.gem-select,
.gem-input--goal,
.gem-range {
  appearance: base;
  /* Now customize with your tokens */
  background: var(--gem-bg-light);
  border: 1px solid var(--gem-border--subtle);
  color: var(--gem-text--primary);
  border-radius: 6px;
  padding: 0.5rem;
  font-family: var(--gem-font);
}
```

---

## Step 2: Remove custom chevron code

The `.gem-select` custom chevron (SVG background) can be simplified since `appearance: base` provides a standard chevron.

---

## Step 3: Test across browsers

```bash
# Test in Chrome, Safari, Firefox
# Verify:
# - Select dropdowns show native dropdown arrow
# - Custom border/background colors apply
# - Focus ring is the custom one (not browser default)
```

---

## Files Modified: `styles.css`
