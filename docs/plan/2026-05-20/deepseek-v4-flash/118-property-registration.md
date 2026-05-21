# Plan 118: `@property` for Animation-Performant Custom Properties

**Gap:** CSS custom properties used in animations (`--card-color`, `--gem-cyan`) are treated as undefined types by the browser — they can't be animated or interpolated. `@property` registers them with a type so the browser can animate them smoothly.

**Best practice (web.dev):** Use `@property` to register custom properties used in transitions/animations with proper types (color, length, number).

---

## Step 1: Register animated custom properties

```css
@property --card-color {
  syntax: '<color>';
  inherits: true;
  initial-value: rgba(0, 229, 255, 0.5);
}

@property --card-opacity {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}
```

---

## Step 2: Use registered properties in animations

```css
.gem-card {
  --card-color: rgba(0, 229, 255, 0.1);
  background: var(--card-color);
  transition: --card-color 0.3s ease;
}

.gem-card:hover {
  --card-color: rgba(0, 229, 255, 0.25);
  /* Color transition is now smooth instead of instant */
}
```

---

## Step 3: Apply to glow effects

```css
@property --glow-opacity {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

.gem-card--hover .gem-card__glow {
  opacity: var(--glow-opacity);
  transition: --glow-opacity 0.3s ease;
}
```

---

## Step 4: Verify no performance regression

```bash
# Check DevTools Performance tab
# Registered properties use GPU-composited transitions
# Should show fewer layout/recalc events
```

---

## Files Modified: `styles.css`
