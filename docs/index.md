# Documentation

## Overview

Gem rewards infographic for Invincible Mobile Game featuring interactive charts and visualizations with a sci-fi aesthetic matching the game's UI.

## Gem Data (Current)

| Category | Gems | Description |
|----------|-----|-------------|
| PvP | ~1,428 (varies) | Restricted Arena + Open Arena + Multiverse Alliance War (Elite II, rank 13 defaults) |
| Event Rewards | 500 | The Long Haul (300), Earth's Defenders (200) |
| Daily/Weekly Rewards | 293 | Daily (210) + Weekly (60) + Monthly÷4 (23) |
| Promo Code | 300 | Code: 30KGTG |

**Total: ~2,521 gems** (varies with PvP selections)

## Features

### Interactive Elements
- Animated counter that counts up on page load
- Copy-to-clipboard for promo code (click the card)
- Theme toggle (dark/light mode)
- **Unified Mode Cards** - 5 large clickable cards (All, Event, PvP, Daily, Code) each showing:
  - Total gems for that mode
  - Countdown timer
  - Click to filter, update charts, and animate main total
- Card filter buttons (All, Event, PvP, Daily, Code) - now integrated into mode cards above
- Charts update based on mode filter selection (no separate chart filters)
- **Search/Find** - Expandable search bar with text highlighting
- **Save/Share** - Save views, load saved, copy share link, export as PNG
- Export data as JSON
- **PvP Interactive Cards** - Three cards with:
  - League selector (Elite I, Elite II, Elite III, Invincible)
  - Rank selector (1-120)
  - Dynamic gems based on tier + rank
  - localStorage persistence
  - Clear button to reset

### Data Drill-Down
- Click on category summary cards to open detailed modal
- Modal shows each reward in category with name, description, gem amount, percentage

### Chart Interactions
- **Hover tooltips** - Rich tooltips showing gems, percentage, vs average comparison
- **Animated transitions** - Staggered entry animations, smooth data transitions on filter changes
- **Chart filtering** - Mode selection updates all 4 charts simultaneously

### Visual Effects
- Floating particles in background
- Scanning line animation
- Rotating gradient on total section
- Corner decorations on main container
- Sparkle particles on cards
- Glow hover effects on cards
- Grid background overlay
- Card fade-in animations (staggered)

### Charts (3 in single row)
- **Distribution** - Doughnut chart by category
- **Rewards** - Bar chart for individual rewards
- **Performance** - Spider/Radar chart (actual vs target)
- Animated tooltips on cards

## Tech Stack

- **Structure**: `index.html` (clean HTML), `styles.css` (design tokens + BEM), `script.js` (all JS)
- **Styling**: Tailwind CSS (via CDN) + custom CSS design token system
- **Charts**: Chart.js (doughnut, bar, radar)
- **Export**: html2canvas for PNG export
- **Icons**: Font Awesome
- **Typography**: Rajdhani font (Google Fonts)

## Design System

CSS custom property design tokens with BEM naming:
- Color tokens: `--gem-event`, `--gem-pvp`, `--gem-login`, `--gem-code`, `--gem-cyan`
- Component classes: `.gem-card--event`, `.gem-label--pvp`, `.gem-text--primary`
- Shadow tokens: `--gem-shadow--card`, `--gem-shadow--glow-cyan`
- Light mode: `:root.light-mode` with token overrides

## Accessibility

- Reduced motion support (`prefers-reduced-motion`)
- Keyboard-navigable buttons
- Sufficient color contrast
- Escape key closes modal

## Recent Updates (May 2026)

- ✅ **Extracted to separate files** - `index.html`, `styles.css`, `script.js` from `gem_infographic.html`
- ✅ **Design token system** - CSS custom properties for all colors, shadows, and design values
- ✅ **BEM naming** - Semantic component classes (`.gem-card--event`, `.gem-label--pvp`, etc.)
- ✅ **gem_infographic.html** - Now redirects to index.html
- ✅ **Added gem icons** - Pink diamond icons beside mode selector totals
- ✅ **Consistent pink styling** - All gem icons use same gradient and glow
- ✅ **Removed 4th chart** - Now 3 charts (Distribution, Rewards, Performance) in full-width layout
- ✅ Removed Season category entirely (replaced with PvP)
- ✅ Merged Warfare into PvP (Multiverse Alliance War is now part of PvP cards)
- ✅ Created unified mode cards at top with totals + timers
- ✅ Charts now update based on mode selection (removed separate chart filters)
- ✅ Removed legend, calculator, summary boxes
- ✅ Added PvP cards with league/rank selectors and localStorage persistence
- ✅ Added animated total counter updates when PvP values change
- ✅ Added demotion zone warnings for PvP (rank 86+)
- ✅ Total updated to 2,550 gems (varies with PvP selections)
- ✅ Fixed HTML structure (PvP article tags, main container close, nav close)
- ✅ Fixed JavaScript values (totalGems: 3217→2550, baseStatic: 2650→1900)
- ✅ Fixed chartFilterData.all.distribution (removed 1820 season value)
- ✅ Multi-select mode filtering - toggle Event, PvP, Daily, Code independently
- ✅ Main total updates based on selected modes (PvP uses dynamic card values)
- ✅ Mode button totals update when PvP cards change
- ✅ Added countdown timers with seconds to each mode selector
- ✅ Added subtle pulse animation on countdown second changes
- ✅ Standardized PvP card colors to pink-glow to match PvP selector
- ✅ Fixed mode button active class toggle functionality
- ✅ Updated daily login from 100 to 30 gems per day (610 weekly total)
- ✅ Updated chart colors to match mode colors
- ✅ Fixed TypeError on demotionEl (null check added)
- ✅ Fixed favicon error (inline SVG)
- ✅ Fixed Chart.js source map error
- ✅ Restructured card layout - gem icons + payout at top, title/selectors below
- ✅ Fixed login rewards total (980→1843) - updated eventsByMode values
- ✅ Updated Daily card to show "30×7=210", Monthly to show "90÷4=23"
- ✅ Made mode selector totals dynamic - now calculated from eventsByMode
- ✅ Fixed PvP percentage calculation to use dynamic total
- ✅ Login mode total now = daily + weekly + (monthly÷4) = 293
- ✅ Updated PvP defaults to Elite II rank 13 (user's settings)
- ✅ Fixed PvP mode selector showing 0 issue
- ✅ Unified event card tag styles - all login cards use yellow-accent
- ✅ Reordered cards: Event → PvP → Login → Code
- ✅ Moved League/Rank selectors to bottom of PvP cards
- ✅ Moved Cards/Chips info to right below gems payout in PvP cards
- ✅ Consolidated GAME data structure - compressed PvP tiers to compact arrays
- ✅ Refactored chart data - buildModeData() derives from GAME + getModeTotal()
- ✅ Shrunk mode selectors 50% - smaller padding, icons, text
- ✅ Shrunk event cards 20% - reduced padding, gap, margins, font sizes
- ✅ Enlarged mode selector timers - text-sm with font-mono for readability
- ✅ Fixed getModeTotal('pvp') returning 0 - moved PvP check before eventsByMode lookup

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen