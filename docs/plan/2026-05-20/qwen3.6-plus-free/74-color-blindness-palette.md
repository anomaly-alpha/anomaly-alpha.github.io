# Plan 74: Color Blindness Palette

**Problem:** Category colors (orange, pink, amber, green) may be indistinguishable for users with certain types of color blindness (especially red-green). The spider chart relies heavily on color differentiation.

**Goal:** Add patterns or icons alongside colors in charts for color-blind accessibility.

---

## Step 1: Update chart config with patterns

```javascript
// script.js — update chart initialization
function initCharts() {
  // ... existing chart setup

  // Add pattern to datasets for color-blind differentiation
  distributionChart.data.datasets[0].borderDash = [5, 5];
  spiderChart.data.datasets.forEach(function(dataset, i) {
    dataset.borderDash = [[5, 5], [10, 5], [2, 2], [15, 5]][i] || [];
    dataset.pointStyle = ['circle', 'rect', 'triangle', 'star'][i] || 'circle';
    dataset.pointRadius = 6;
  });
}
```

## Step 2: Add legend with icons

```css
/* styles.css — enhance chart legend */
.gem-chart__legend-item::before {
  content: '';
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border: 2px solid;
}
.gem-chart__legend-item[data-category="event"]::before { border-radius: 50%; }
.gem-chart__legend-item[data-category="pvp"]::before { border-radius: 0; }
.gem-chart__legend-item[data-category="login"]::before { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
.gem-chart__legend-item[data-category="code"]::before { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
```

## Files Modified
- `script.js` — chart pattern updates
- `styles.css` — legend icon shapes

## Verification
```bash
npm run build
# Use Chrome DevTools > Rendering > Emulate vision deficiencies
# Protanopia/Deuteranopia — shapes should differentiate categories
```
