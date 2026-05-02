# Gem Infographic Extraction Plan

## Goal
Extract HTML, CSS, and JavaScript from `gem_infographic.html` into separate files with full design token system and BEM naming.

## Decision Summary

| Decision | Choice |
|----------|--------|
| Tailwind CDN | Keep as-is |
| Config block | Convert to explanatory comment |
| JS organization | Flat file with section headers |
| All JS init | Wrap in `DOMContentLoaded` |
| Script placement | `defer` at end of body (required for inline event handlers to work) |
| Design tokens | Full CSS custom property system |
| Token naming | BEM (`gem-card--event`, `gem-text--primary`) |
| Light mode | CSS custom property scoping via `:root.light-mode` |
| Animation classes | Pure CSS utilities (not Tailwind arbitrary values) |
| Font system | Token-based via CSS custom property `--gem-font` |
| Shadow system | Token-based (`--gem-shadow--card`, `--gem-shadow--glow-cyan`) |
| Particles | CSS nth-child color variants (`.gem-particle--1/2/3`) |
| Card animations | BEM with nth-child stagger |
| Tooltip | BEM with light mode token integration |
| Modal/toast | BEM |
| Charts | BEM container in CSS, config in JS |
| Buttons | Token-based with CSS custom properties |
| Search | Full BEM |
| Form elements | BEM |
| HTML class rewrite | Full BEM semantic renaming throughout |

## Design Token System

### Color Tokens (`:root`)
```css
/* Category colors */
--gem-event: #ff6b35;
--gem-pvp: #e91e8a;
--gem-login: #f39c12;
--gem-code: #2ecc71;
--gem-cyan: #00e5ff;
--gem-purple: #9b59b6;
--gem-pink: #e91e8a;

/* Card backgrounds */
--gem-card-bg--event: rgba(255, 107, 53, 0.08);
--gem-card-bg--pvp: rgba(233, 30, 138, 0.08);
--gem-card-bg--login: rgba(243, 156, 18, 0.08);
--gem-card-bg--code: rgba(46, 204, 113, 0.08);
--gem-card-bg--cyan: rgba(0, 229, 255, 0.08);
--gem-card-bg--purple: rgba(155, 89, 182, 0.08);

/* Card borders */
--gem-card-border--event: rgba(255, 107, 53, 0.20);
--gem-card-border--pvp: rgba(233, 30, 138, 0.20);
--gem-card-border--login: rgba(243, 156, 18, 0.20);
--gem-card-border--code: rgba(46, 204, 113, 0.20);
--gem-card-border--cyan: rgba(0, 229, 255, 0.20);
--gem-card-border--purple: rgba(155, 89, 182, 0.20);
--gem-border--subtle: rgba(255, 255, 255, 0.10);
--gem-border--medium: rgba(255, 255, 255, 0.30);

/* Text colors */
--gem-text--primary: #ffffff;
--gem-text--secondary: rgba(255, 255, 255, 0.60);
--gem-text--muted: rgba(255, 255, 255, 0.40);
--gem-text--80: rgba(255, 255, 255, 0.80);

/* Category label colors */
--gem-label--event: #ff6b35;
--gem-label--pvp: #e91e8a;
--gem-label--login: #f39c12;
--gem-label--code: #2ecc71;
--gem-label--season: #00e5ff;

/* Alert colors */
--gem-alert--danger: #ef4444;
--gem-alert--success: #2ecc71;
--gem-alert--info: #00e5ff;
```

### Shadow Tokens
```css
--gem-shadow--card: 0 15px 40px rgba(0, 229, 255, 0.3), 0 0 60px rgba(0, 229, 255, 0.1);
--gem-shadow--glow-cyan: 0 0 20px rgba(0, 229, 255, 0.5);
--gem-shadow--glow-pink: 0 0 20px rgba(233, 30, 138, 0.5);
--gem-shadow--main: 0 0 60px rgba(0, 229, 255, 0.2), inset 0 0 80px rgba(0, 229, 255, 0.05);
```

### Button Tokens
```css
--gem-btn-bg: rgba(255, 255, 255, 0.10);
--gem-btn-border: rgba(0, 229, 255, 0.30);
--gem-btn-hover: rgba(255, 255, 255, 0.20);
```

### Modal/Toast Tokens
```css
--gem-modal-overlay: rgba(0, 0, 0, 0.70);
--gem-modal-bg: rgba(10, 35, 60, 0.98);
--gem-modal-border: rgba(0, 229, 255, 0.40);
--gem-tooltip-bg: rgba(5, 10, 20, 0.95);
--gem-tooltip-border: rgba(0, 229, 255, 0.30);
```

### Light Mode (`:root.light-mode`)
All category colors switch to cyan-based alternatives. Backgrounds become light grays. Borders become darker. Text becomes dark slate.

### Font Token
```css
--gem-font: 'Rajdhani', sans-serif;
```

## BEM Class System

### Cards
- `.gem-card` — base card
- `.gem-card--event`, `.gem-card--pvp`, `.gem-card--login`, `.gem-card--code` — category variants
- `.gem-card--hover` — hover effect (translateY + shadow)
- `.gem-card--fade-in` — entrance animation
- `.gem-card--interactive` — cursor pointer

### Labels/Badges
- `.gem-label` — base label
- `.gem-label--event`, `.gem-label--pvp`, `.gem-label--login`, `.gem-label--code` — category variants

### Text
- `.gem-text--primary`, `.gem-text--secondary`, `.gem-text--muted`, `.gem-text--80`
- `.gem-text--event`, `.gem-text--pvp`, etc. (category colors)

### Borders
- `.gem-border--subtle`, `.gem-border--medium`
- `.gem-border--event`, `.gem-border--pvp`, etc.

### Buttons
- `.gem-btn--icon` — icon-only button
- `.gem-btn--icon-glow` — with cyan glow color
- `.gem-btn--clear` — clear/reset button
- `.gem-btn__icon` — icon element inside button

### Form Elements
- `.gem-select` — base select
- `.gem-select--league` — league selector variant
- `.gem-alert--demotion` — danger alert

### Tooltip
- `.gem-tooltip` — tooltip box
- `.gem-tooltip--trigger` — parent that triggers tooltip on hover

### Modal
- `.gem-modal` — modal container
- `.gem-modal__overlay` — backdrop
- `.gem-modal__content` — content box
- `.gem-modal__close` — close button

### Toast
- `.gem-toast` — base toast
- `.gem-toast--success`, `.gem-toast--error`, `.gem-toast--info` — variants

### Search
- `.gem-search` — search container
- `.gem-search__toggle` — search toggle button
- `.gem-search__input` — search input field
- `.gem-search__clear` — clear button
- `.gem-search--expanded` — expanded state
- `.gem-search__highlight` — matched text highlight
- `.gem-search--empty` — no results state

### Charts
- `.gem-chart` — chart container
- `.gem-chart__container` — wrapper div
- `.gem-chart__canvas` — canvas element

### Animations
- `.gem-animate--pulse-slow` — pulse animation
- `.gem-animate--float` — float animation
- `.gem-animate--fade-in` — fade in animation
- `.gem-animate--glow-pulse` — glow pulse
- `.gem-animate--sparkle` — sparkle effect

### Particles
- `.gem-particle` — base particle
- `.gem-particle--1` — cyan particle (nth-child 3n+1)
- `.gem-particle--2` — pink particle (nth-child 3n+2)
- `.gem-particle--3` — orange particle (nth-child 3n)

## Files to Create

### 1. `styles.css`
All CSS extracted from `<style>` tag with full design token system and BEM classes:
- `:root` with all color, shadow, button, modal tokens
- `:root.light-mode` with light mode overrides
- Base element styles (body, grid-bg)
- BEM component classes
- `@keyframes` animations
- `@media (prefers-reduced-motion)` rules

### 2. `script.js`
All JavaScript organized with section headers:
```javascript
// ===== DATA CONSTANTS =====
// categoryData, GAME constant, pvpDefaults

// ===== TAILWIND CONFIG NOTE =====
// Comment explaining custom values handled via CSS tokens

// ===== UTILITY FUNCTIONS =====
// copyCode, filterCards, getPvpPayout, animateValue, etc.

// ===== UI COMPONENTS =====
// Theme toggle, search, save/share, toast, modal

// ===== CHARTS =====
// Chart.js initialization and filterChart

// ===== COUNTDOWN TIMERS =====
// COUNTDOWN_TARGETS and countdown functions

// ===== INITIALIZATION =====
// DOMContentLoaded wrapper with all init code
```

### 3. `index.html`
Clean HTML with:
- All CDN links intact
- `<link rel="stylesheet" href="styles.css">`
- `<script src="script.js" defer></script>` at end of body
- All class attributes rewritten to use BEM semantic names
- No inline `<style>` or `<script>` blocks

## Execution Order
1. Create `styles.css` with full design token system
2. Create `script.js` with organized sections
3. Create `index.html` with BEM class rewrites
4. Verify all three files work together

## Notes
- Script tag MUST have `defer` and be at end of `<body>`
- HTML class rewrite is comprehensive — every element's class attribute is restructured
- Animation classes use pure CSS, not Tailwind arbitrary values
- Light mode switches via CSS custom property scoping