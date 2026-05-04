# Design System — Gem Rewards Infographic

**Status:** Current (May 2, 2026)
**Version:** 1.0

---

## Overview

The design system uses CSS custom properties (design tokens) for all visual values, enabling consistent theming and easy dark/light mode switching. BEM naming convention provides semantic class names for all components.

---

## Token Categories

### Category Colors (Primary Palette)

| Token | Hex | Usage |
|-------|-----|-------|
| `--gem-event` | `#ff6b35` | Event category — orange |
| `--gem-pvp` | `#e91e8a` | PvP category — pink |
| `--gem-login` | `#f39c12` | Login category — amber |
| `--gem-code` | `#2ecc71` | Promo code category — green |
| `--gem-cyan` | `#00e5ff` | Accent/highlight — cyan |
| `--gem-purple` | `#9b59b6` | Alliance/special — purple |
| `--gem-star` | `#ffeb3b` | Badge/tips highlight — yellow |

### Background Colors

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--gem-bg-dark` | `#050a14` | `#f0f4f8` | Page background base |
| `--gem-bg-mid` | `#0a1628` | `#e2e8f0` | Card container bg |
| `--gem-bg-light` | `#0d1f3c` | `#cbd5e1` | Elevated surfaces |

### Card Backgrounds

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-card-bg--event` | `rgba(255,107,53,0.08)` | `rgba(0,229,255,0.15)` |
| `--gem-card-bg--pvp` | `rgba(233,30,138,0.08)` | `rgba(0,229,255,0.15)` |
| `--gem-card-bg--login` | `rgba(243,156,18,0.08)` | `rgba(0,229,255,0.15)` |
| `--gem-card-bg--code` | `rgba(46,204,113,0.08)` | `rgba(0,229,255,0.15)` |
| `--gem-card-bg--cyan` | `rgba(0,229,255,0.08)` | — |
| `--gem-card-bg--purple` | `rgba(155,89,182,0.08)` | — |

### Card Borders

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-card-border--event` | `rgba(255,107,53,0.20)` | — |
| `--gem-card-border--pvp` | `rgba(233,30,138,0.20)` | — |
| `--gem-card-border--login` | `rgba(243,156,18,0.20)` | — |
| `--gem-card-border--code` | `rgba(46,204,113,0.20)` | — |
| `--gem-card-border--cyan` | `rgba(0,229,255,0.20)` | — |
| `--gem-card-border--purple` | `rgba(155,89,182,0.20)` | — |
| `--gem-border--subtle` | `rgba(255,255,255,0.10)` | `rgba(26,32,44,0.10)` |
| `--gem-border--medium` | `rgba(255,255,255,0.30)` | `rgba(26,32,44,0.30)` |
| `--gem-border--accent` | `rgba(0,229,255,0.30)` | — |

### Text Colors

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-text--primary` | `#ffffff` | `#1a202c` |
| `--gem-text--secondary` | `rgba(255,255,255,0.60)` | `rgba(26,32,44,0.70)` |
| `--gem-text--muted` | `rgba(255,255,255,0.40)` | `rgba(26,32,44,0.50)` |
| `--gem-text--80` | `rgba(255,255,255,0.80)` | — |

### Label/Badge Colors

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-label-bg--event` | `rgba(255,107,53,0.15)` | `rgba(0,229,255,0.20)` |
| `--gem-label-bg--pvp` | `rgba(233,30,138,0.15)` | `rgba(0,229,255,0.20)` |
| `--gem-label-bg--login` | `rgba(243,156,18,0.15)` | `rgba(0,229,255,0.20)` |
| `--gem-label-bg--code` | `rgba(46,204,113,0.15)` | `rgba(0,229,255,0.20)` |
| `--gem-label-bg--cyan` | `rgba(0,229,255,0.15)` | — |
| `--gem-label-border--event` | `rgba(255,107,53,0.30)` | — |
| `--gem-label-border--pvp` | `rgba(233,30,138,0.30)` | — |
| `--gem-label-border--login` | `rgba(243,156,18,0.30)` | — |
| `--gem-label-border--code` | `rgba(46,204,113,0.30)` | — |
| `--gem-label-border--cyan` | `rgba(0,229,255,0.30)` | — |

### Alert Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--gem-alert--danger-bg` | `rgba(239,68,68,0.20)` | Demotion warning bg |
| `--gem-alert--danger-border` | `rgba(239,68,68,0.50)` | Demotion warning border |
| `--gem-alert--danger-text` | `#ef4444` | Demotion warning text |
| `--gem-alert--success-bg` | `rgba(46,204,113,0.20)` | Safe zone bg |
| `--gem-alert--success-border` | `rgba(46,204,113,0.30)` | Safe zone border |
| `--gem-alert--success-text` | `#2ecc71` | Safe zone text |
| `--gem-alert--info-bg` | `rgba(0,229,255,0.20)` | Info toast bg |
| `--gem-alert--info-border` | `rgba(0,229,255,0.30)` | Info toast border |
| `--gem-alert--info-text` | `#00e5ff` | Info toast text |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--gem-shadow--card` | `0 15px 40px rgba(0,229,255,0.3), 0 0 60px rgba(0,229,255,0.1)` | Container/card shadow |
| `--gem-shadow--glow-cyan` | `0 0 20px rgba(0,229,255,0.5)` | Cyan glow effect |
| `--gem-shadow--glow-pink` | `0 0 20px rgba(233,30,138,0.5), inset 0 0 15px rgba(255,255,255,0.3)` | Pink/gem glow |
| `--gem-shadow--main` | `0 0 60px rgba(0,229,255,0.2), inset 0 0 80px rgba(0,229,255,0.05)` | Main container |
| `--gem-shadow--gem` | `0 0 30px rgba(233,30,138,0.6)` | Gem icon glow |

### Orb Gradients

| Token | Value | Usage |
|-------|-------|-------|
| `--gem-orb-cyan` | `var(--gem-cyan)` | Cyan gradient orb |
| `--gem-orb-pvp` | `var(--gem-pvp)` | Pink gradient orb |

### Button Tokens

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-btn-bg` | `rgba(255,255,255,0.10)` | `rgba(0,0,0,0.05)` |
| `--gem-btn-border` | `rgba(0,229,255,0.30)` | `rgba(0,229,255,0.40)` |
| `--gem-btn-hover` | `rgba(255,255,255,0.20)` | `rgba(0,0,0,0.10)` |

### Modal/Overlay Tokens

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-modal-overlay` | `rgba(0,0,0,0.70)` | `rgba(0,0,0,0.50)` |
| `--gem-modal-bg` | `rgba(10,35,60,0.98)` | `rgba(240,244,248,0.98)` |
| `--gem-modal-border` | `rgba(0,229,255,0.40)` | `rgba(0,229,255,0.50)` |

### Tooltip Tokens

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `--gem-tooltip-bg` | `rgba(5,10,20,0.95)` | `rgba(240,244,248,0.98)` |
| `--gem-tooltip-border` | `rgba(0,229,255,0.30)` | `rgba(0,229,255,0.50)` |

### Font

| Token | Value |
|-------|-------|
| `--gem-font` | `'Rajdhani', sans-serif` |

---

## BEM Class Inventory

### Card Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-card` | Block | Base card container |
| `.gem-card--event` | Modifier | Event category card |
| `.gem-card--pvp` | Modifier | PvP category card |
| `.gem-card--login` | Modifier | Login category card |
| `.gem-card--code` | Modifier | Code category card |
| `.gem-card--hover` | Modifier | Hover effect enabled |
| `.gem-card--fade-in` | Modifier | Entrance animation |
| `.gem-card--delay-0` through `.gem-card--delay-8` | Modifier | Staggered animation delay |
| `.gem-card__body` | Element | Card content area |
| `.gem-card__info-btn` | Element | Info icon button (triggers modal) |
| `.gem-card__divider` | Element | Section divider |

**Mode highlight modifiers (added dynamically via JS):**
- `.gem-card--mode-highlight--event`
- `.gem-card--mode-highlight--pvp`
- `.gem-card--mode-highlight--login`
- `.gem-card--mode-highlight--code`
- `.gem-card--mode-highlight--all`

### Label Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-label` | Block | Base label |
| `.gem-label--event` | Modifier | Event label |
| `.gem-label--pvp` | Modifier | PvP label |
| `.gem-label--login` | Modifier | Login label |
| `.gem-label--code` | Modifier | Code label |
| `.gem-label--cyan` | Modifier | Cyan label |

### Text Utilities

| Class | Token Used |
|-------|------------|
| `.gem-text--primary` | `--gem-text--primary` |
| `.gem-text--secondary` | `--gem-text--secondary` |
| `.gem-text--muted` | `--gem-text--muted` |
| `.gem-text--80` | `--gem-text--80` |
| `.gem-text--event` | `--gem-event` |
| `.gem-text--pvp` | `--gem-pvp` |
| `.gem-text--login` | `--gem-login` |
| `.gem-text--code` | `--gem-code` |
| `.gem-text--cyan` | `--gem-cyan` |
| `.gem-text--purple` | `--gem-purple` |

### Border Utilities

| Class | Token Used |
|-------|------------|
| `.gem-border--subtle` | `--gem-border--subtle` |
| `.gem-border--medium` | `--gem-border--medium` |
| `.gem-border--accent` | `--gem-border--accent` |

### Button Components

| Class | Type | Description |
|-------|------|-------------|
| `.gem-btn--icon` | Block | Icon-only button |
| `.gem-btn--icon-glow` | Modifier | With cyan glow |
| `.gem-btn--clear` | Block | Clear/reset button |
| `.gem-btn__icon` | Element | Icon inside button |

### Select Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-select` | Block | Base select input with `appearance: none` + custom chevron arrow |
| `.gem-select:hover` | State | Brighter border on hover |
| `.gem-select:focus` | State | Cyan border + glow ring on focus |
| `.gem-select--league` | Modifier | Wider league selector (`min-width: 9rem`) |
| `.gem-select--pvp` | Modifier | Pink (#e91e8a) category — background, border, arrow |
| `.gem-select--login` | Modifier | Amber (#f39c12) category — background, border, arrow |
| `.gem-select--event` | Modifier | Orange (#ff6b35) category — background, border, arrow |
| `.gem-select--code` | Modifier | Green (#2ecc71) category — background, border, arrow |
| Arrow hover | State | Arrow brightens per category on `.gem-select--{cat}:hover` |

### Alert Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-alert--demotion` | Block | Demotion warning box |
| `.gem-alert__icon--danger` | Element | Danger icon |
| `.gem-alert__text--danger` | Element | Danger text |

### Tooltip Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-tooltip` | Block | Tooltip content box |
| `.gem-tooltip--trigger` | Modifier | Parent triggers on hover |

### Modal Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-modal` | Block | Modal container |
| `.gem-modal--visible` | Modifier | Visible state |
| `.gem-modal__overlay` | Element | Backdrop |
| `.gem-modal__content` | Element | Content box |
| `.gem-modal__header` | Element | Header row |
| `.gem-modal__body` | Element | Scrollable body |
| `.gem-modal__footer` | Element | Footer with close button |
| `.gem-modal__icon-box` | Element | Category icon box |
| `.gem-modal__title` | Element | Title text |
| `.gem-modal__badge` | Element | Badge span |
| `.gem-modal__badge--star` | Modifier | Star style badge |
| `.gem-modal__total` | Element | Gems total line |
| `.gem-modal__close` | Element | Close button |
| `.gem-modal__hero` | Element | Hero tagline |
| `.gem-modal__body-text` | Element | Description text |
| `.gem-modal__tips` | Element | Tips section |
| `.gem-modal__tips-header` | Element | Tips header |
| `.gem-modal__demotion-warning` | Element | Demotion warning |
| `.gem-modal__demotion-warning--safe` | Modifier | Safe zone variant |

### Toast Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-toast` | Block | Toast container |
| `.gem-toast--success` | Modifier | Success variant |
| `.gem-toast--error` | Modifier | Error variant |
| `.gem-toast--info` | Modifier | Info variant |

### Chart Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-chart` | Block | Chart container |
| `.gem-chart__title` | Element | Chart title |

### Icon Components

| Class | Type | Description |
|-------|------|-------------|
| `.gem-icon--gem` | Block | Small gem icon (12×12) |
| `.gem-icon--star` | Block | Star badge |

### Orb Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-orb` | Block | Gradient orb base |
| `.gem-orb--1` | Modifier | Cyan orb (larger) |
| `.gem-orb--2` | Modifier | Pink orb (smaller) |

### Code Reveal Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-code__hint` | Element | Hint text |
| `.gem-code__reveal` | Element | Revealed code |
| `.gem-code__value` | Element | Code value |
| `.gem-code__copy-hint` | Element | Copy hint |

### Mode Button Component

| Class | Type | Description |
|-------|------|-------------|
| `.gem-mode-btn` | Block | Mode selector button |
| `.gem-mode-btn--all` | Modifier | All modes button |
| `.gem-mode-btn--event` | Modifier | Event mode button |
| `.gem-mode-btn--pvp` | Modifier | PvP mode button |
| `.gem-mode-btn--login` | Modifier | Login mode button |
| `.gem-mode-btn--code` | Modifier | Code mode button |
| `.gem-mode-btn__icon` | Element | Icon |
| `.gem-mode-btn__count` | Element | Gem count |
| `.gem-mode-btn__label` | Element | Label text |
| `.gem-mode-btn__countdown` | Element | Countdown timer |

### Grid Layouts

| Class | Description |
|-------|-------------|
| `.gem-grid--cards` | Card grid (1→2→3 columns) |
| `.gem-grid--modes` | Mode button row |
| `.gem-grid--charts` | Chart grid (2→3 columns) |

---

## Color Palette

```
┌─────────────────────────────────────────────────────────┐
│ Category Colors                                          │
├──────────┬──────────┬───────────────────────────────────┤
│ Event    │ #ff6b35  │ ████ orange                       │
│ PvP      │ #e91e8a  │ ████ pink                         │
│ Login    │ #f39c12  │ ████ amber                        │
│ Code     │ #2ecc71  │ ████ green                        │
│ Cyan     │ #00e5ff  │ ████ cyan                         │
│ Purple   │ #9b59b6  │ ████ purple                       │
│ Star     │ #ffeb3b  │ ████ yellow (badges/tips)         │
└──────────┴──────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Background Gradient (Dark Mode)                          │
├──────────┬──────────┬───────────────────────────────────┤
│ Dark     │ #050a14  │ ████ darkest                      │
│ Mid      │ #0a1628  │ ████ middle                       │
│ Light    │ #0d1f3c  │ ████ lightest                     │
└──────────┴──────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Background Gradient (Light Mode)                         │
├──────────┬──────────┬───────────────────────────────────┤
│ Dark     │ #f0f4f8  │ ████ lightest                     │
│ Mid      │ #e2e8f0  │ ████ middle                       │
│ Light    │ #cbd5e1  │ ████ darkest                      │
└──────────┴──────────┴───────────────────────────────────┘
```

---

## Light Mode

Light mode is activated by adding `light-mode` class to `<body>`. All tokens with light mode overrides are defined in `:root.light-mode`.

### Key Differences

| Aspect | Dark Mode | Light Mode |
|--------|-----------|------------|
| Page background | Dark gradient | Light gray gradient |
| Text | White with opacity variants | Dark slate with opacity variants |
| Card backgrounds | Category-colored translucent | Cyan-tinted translucent |
| Borders | White with opacity | Dark slate with opacity |

### Toggle Behavior

```javascript
document.body.classList.toggle('light-mode');
// Icon swaps between moon/sun
```

### URL Parameter

`?theme=light` applies light mode on page load.

---

## Theming Architecture

### Token Definition (`:root`)

All tokens are defined at the `:root` level for global availability.

### Light Mode Override (`:root.light-mode`)

Tokens that need different values in light mode are overridden in `:root.light-mode`.

### Per-Component Dynamic Values

Some components use CSS variables set dynamically via JavaScript:

```javascript
// Card hover uses --card-color set per card
card.style.setProperty('--card-color', colorMap[card.dataset.category]);
```

### CSS Custom Property Advantages

1. **Single source of truth** — All colors defined once
2. **Easy theming** — Override at scope level
3. **Consistent usage** — All components reference tokens
4. **Debuggable** — Can inspect token values in DevTools

---

## Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| `gem-fade-in` | 0.6s | ease-out | Card entrance |
| `gem-fade-in` stagger | 0.075s increments | ease-out | Card stagger (0s, 0.075s...0.6s) |
| `gem-code--reveal` | 0.8s | cubic-bezier(0.34, 1.56, 0.64, 1) | Code reveal (3D flip) |
| `gem-code--glow` | 2s | ease-in-out | Code glow pulse (infinite) |
| `gem-code--fade-in` | 0.5s | ease-out | Copy hint appear |
| `gem-code--copied` | 0.4s | ease-out | Copied flash |
| `gem-float-particle` | 15s | linear | Background particles (infinite, GPU-composited via `translate3d`) |
| `pulse` | 3s | cubic-bezier(0.4, 0, 0.6, 1) | Header icon pulse (infinite) |
| `gem-countdown-pulse` | 1s | ease-out infinite | Countdown second tick (CSS-only) |
| `gem-modal--pop-in` | 0.3s | cubic-bezier(0.34, 1.56, 0.64, 1) | Modal entry |

---

## File Structure
```
anomaly-alpha/
├── styles.css       — Design tokens + BEM classes + animations
├── index.html       — HTML with inline JSON configs + gradient orbs
├── script.js        — JavaScript with token-aware logic
├── tailwind.css         — Generated Tailwind utility classes
├── package.json         — Dev dependencies (Tailwind CLI)
├── tailwind.config.js   — Tailwind content paths config
├── src/
│   └── tailwind-input.css — Tailwind source directives
├── vendor/
│   └── chart.umd.js     — Self-hosted Chart.js 4.4.1
├── fonts/               — Self-hosted Rajdhani + Orbitron woff2 files
├── journal/               — Daily session journals (YYYY-MM-DD/index.md)
├── docs/
    ├── plan/              — Session plans (YYYY-MM-DD/*.md)
    │   └── DESIGN_SYSTEM.md          — This file
```
anomaly-alpha/
├── styles.css       (1392 lines) — Design tokens + BEM classes + animations
├── index.html       (1282 lines) — HTML with inline JSON configs
├── script.js        (1224 lines) — JavaScript with token-aware logic
├── tailwind.css         — Generated Tailwind utility classes (1105 lines)
├── package.json         — Dev dependencies (Tailwind CLI)
├── tailwind.config.js   — Tailwind content paths config
├── src/
│   └── tailwind-input.css — Tailwind source directives
├── vendor/
│   └── chart.umd.js     — Self-hosted Chart.js 4.4.1
├── fonts/               — Self-hosted Rajdhani + Orbitron woff2 files
├── journal/               — Daily session journals (YYYY-MM-DD/index.md)
├── docs/
    ├── plan/              — Session plans (YYYY-MM-DD/*.md)
    └── DESIGN_SYSTEM.md          — This file
```

---

## Maintenance

### Updating Colors

To update a color across the entire application, change the token value in `styles.css`:

```css
:root {
  --gem-pvp: #new-color;  /* All PvP elements update */
}
```

### Adding New Category

1. Add token in `:root` (e.g., `--gem-new-category: #hex`)
2. Add card modifier (`.gem-card--new-category`)
3. Add label modifier (`.gem-label--new-category`)
4. Add text utility (`.gem-text--new-category`)
5. Add light mode overrides if needed
6. Update JavaScript colorMap

### Browser Support

- CSS custom properties (tokens): All modern browsers
- `color-mix()` function: Safari 15.4+, Chrome 111+, Firefox 113+
- `backdrop-filter`: All modern browsers (graceful degradation)

---

## References

- [MDN: CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [BEM Naming Convention](http://getbem.com/introduction/)
- [color-mix() Function](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix())