# Aesthetic Enhancement Plan

## Summary

| Change | Mobile | Desktop |
|--------|--------|---------|
| **Card titles** | 1.1rem → 1.25rem, text-shadow for bold, leading 1.2, overflow-wrap | 1.375rem |
| **Mode button counts** | 1.5rem | 1.75rem |
| **Mode active state** | scale(1.05), box-shadow blur 25px, spread 0.35 | same |
| **Counter display** | text-7xl, pink+cyan text-shadow layers | text-8xl |
| **Card gap** | 1.25rem (unchanged) | 1.25rem → 1rem |
| **Mode gap** | 0.5rem (unchanged) | 0.75rem (unchanged) |
| **Ambient** | gradient orbs + subtle grain | same |
| **Card stagger delay** | 0.075s increments (was 0.1s) | same |
| **Card hover** | scale 1.02 + translateY(-8px) | same |

## Resolved Decisions

1. **Card title weight**: text-shadow for bold appearance (font-weight 800 unavailable in Rajdhani)
2. **Stagger delays**: 0.075s increments (total 0.6s) — snappier but visible
3. **Scanning border**: skipped — existing effects sufficient
4. **Ambient enhancements**: gradient orbs + grain overlay added
5. **Mode button glow**: single-layer box-shadow, blur 25px, spread 0.35 (clean)
6. **Counter text-shadow**: pink + cyan layered glow
7. **Card gap**: 1rem desktop only, padding unchanged
8. **Orbs positioning**: inside `.gem-container` (not fixed) — scoped to content area
9. **Orb colors**: use CSS variables (`--gem-orb-cyan`, `--gem-orb-pvp`)
10. **Grain z-index**: 1 (above content, below modal z-index 50)
11. **Mode transition**: explicit override on `.gem-mode-btn`

## Excluded (constraints)
- Particles remain hidden on mobile (existing behavior)
- No spacing squeeze on touch targets
- Mode buttons keep clean look despite dramatic states
- Scanning border on counter skipped
- Orbs keep percentage positions (scale naturally on mobile)

## Execution Order

1. CSS updates (styles.css)
2. Live reload test
3. Iterate if needed

## Implementation Checklist

### 1. Add Orb Design Tokens (to :root)
```css
/* Orb gradients */
--gem-orb-cyan: var(--gem-cyan);
--gem-orb-pvp: var(--gem-pvp);
```

### 2. Add Grain Overlay
```css
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 1;
}
```

### 3. Add Gradient Orbs (inside container)
```css
.gem-orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  opacity: 0.08;
  z-index: 0;
}
.gem-orb--1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--gem-orb-cyan), transparent 70%);
  top: 20%;
  left: 10%;
}
.gem-orb--2 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, var(--gem-orb-pvp)), transparent 70%);
  top: 50%;
  right: 15%;
}
```

### 4. Mode Button Transition
```css
.gem-mode-btn {
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}
```

### 5. Mode Button Counts
```css
.gem-mode-btn__count {
  font-size: 1.5rem;
}
@media (min-width: 768px) {
  .gem-mode-btn__count {
    font-size: 1.75rem;
  }
}
```

### 6. Mode Active State
```css
.gem-mode-btn.active {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(0, 229, 255, 0.35), 0 8px 32px rgba(0, 0, 0, 0.25);
}
```

### 7. Card Titles
```css
.gem-card__title {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.15);
  max-width: 100%;
  overflow-wrap: break-word;
}
@media (min-width: 768px) {
  .gem-card__title {
    font-size: 1.375rem;
  }
}
```

### 8. Card Stagger Delays (snappier)
```css
.gem-card--delay-0 { animation-delay: 0s; }
.gem-card--delay-1 { animation-delay: 0.075s; }
.gem-card--delay-2 { animation-delay: 0.15s; }
.gem-card--delay-3 { animation-delay: 0.225s; }
.gem-card--delay-4 { animation-delay: 0.3s; }
.gem-card--delay-5 { animation-delay: 0.375s; }
.gem-card--delay-6 { animation-delay: 0.45s; }
.gem-card--delay-7 { animation-delay: 0.525s; }
.gem-card--delay-8 { animation-delay: 0.6s; }
```

### 9. Counter Display
```css
.gem-counter {
  font-size: 4.5rem;
  text-shadow: 
    0 0 30px rgba(233, 30, 138, 0.8),
    0 0 60px rgba(233, 30, 138, 0.5),
    0 0 20px rgba(0, 229, 255, 0.4);
}
@media (min-width: 768px) {
  .gem-counter {
    font-size: 6rem;
  }
}
```

### 10. Card Gap (desktop only)
```css
@media (min-width: 1024px) {
  .gem-grid--cards {
    gap: 1rem;
  }
}
```

## Files to Modify
- `styles.css` — all CSS changes
- `index.html` — add orb divs inside `.gem-container`

## After Execution
- Update line counts in MD docs
- Commit with descriptive message

## Optional (if time permits)
- None remaining — all planned