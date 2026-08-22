# Plan 83: Color Blindness Simulation

**Problem:** Category colors (orange for event, pink for PvP, amber for login, green for code) may be indistinguishable for users with color vision deficiencies. The most common forms (deuteranopia, protanopia) struggle with red-green distinctions.

**Goal:** Simulate all forms of color blindness and adjust the palette if needed to ensure category differentiation. Add visual indicators beyond color.

---

## Step 1: Simulate color blindness

Use DevTools to simulate:
- Chrome DevTools → Rendering → Emulate vision deficiencies
- Test: Protanopia, Deuteranopia, Tritanopia, Achromatopsia

---

## Step 2: Check category distinguishability

| Mode | Current Color | Protanopia | Deuteranopia | Tritanopia |
|------|--------------|------------|--------------|------------|
| Event | `#ff6b35` (orange) | Brownish | Brownish | Pinkish |
| PvP | `#e91e8a` (pink) | Grayish | Grayish | Light green |
| Login | `#f39c12` (amber) | Yellow | Yellow | Pink |
| Code | `#2ecc71` (green) | Brown | Brown | Blue |

---

## Step 3: Add non-color indicators

Add text labels or icons to supplement color:

```css
/* Already using text labels in mode buttons — verify */
.gem-label--event::before { content: "◆ "; }
.gem-label--pvp::before { content: "▲ "; }
.gem-label--login::before { content: "■ "; }
.gem-label--code::before { content: "● "; }
```

For charts, use different dashed patterns:

```js
// In chart-config, add borderDash patterns per category
var chartBorders = {
  event: { borderDash: [] },        // solid
  pvp: { borderDash: [5, 5] },      // dashed
  login: { borderDash: [2, 4] },    // dotted
  code: { borderDash: [10, 5] },    // long dash
};
```

---

## Step 4: Verify with axe-core color checks

The `e2e/accessibility.spec.js` (Plan 44) should catch color-only information. Add:

```js
// Verify no information is conveyed by color alone
results.violations.forEach(v => {
  if (v.id === 'color-contrast-enhanced') {
    console.warn('Color contrast issue:', v.help);
  }
});
```

---

## Files Modified: `styles.css`, `script.js`
