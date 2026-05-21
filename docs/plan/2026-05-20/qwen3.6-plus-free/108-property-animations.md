# Plan 108: @property for Animations

**Problem:** CSS animations that transition custom properties (like gradient positions) can't be smoothly animated because CSS doesn't know the type. `@property` registers custom properties with types for smooth transitions.

**Goal:** Register animated custom properties for smoother animations.

---

## Step 1: Register custom properties

```css
/* styles.css */
@property --card-color {
  syntax: '<color>';
  inherits: false;
  initial-value: transparent;
}

@property --glow-opacity {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}

@property --border-width {
  syntax: '<length>';
  inherits: false;
  initial-value: 1px;
}
```

## Step 2: Use in animations

```css
/* Smooth card hover transition */
.gem-card {
  --card-color: transparent;
  --glow-opacity: 0;
  transition: --card-color 0.3s, --glow-opacity 0.3s;
}

.gem-card:hover {
  --card-color: var(--gem-cyan);
  --glow-opacity: 0.5;
}
```

## Files Modified
- `styles.css` — @property registrations

## Verification
```bash
npm run build
# Card hover — color transition should be smooth
# Chrome 85+, Safari 16.4+, Firefox behind flag
```
