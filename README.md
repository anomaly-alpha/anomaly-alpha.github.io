# anomaly-alpha.github.io

Gem rewards infographic for Invincible Mobile Game featuring interactive charts and visualizations with a sci-fi aesthetic.

## Gem Summary

- **Total Gems**: ~2,521 (one-time + recurring, varies with PvP selections)
- **By Category**:
  - **PvP**: ~1,428 gems (varies with rank/league selections - Restricted Arena, Open Arena, Multiverse Alliance War)
  - **Daily/Weekly**: 293 gems (daily: 30×7=210 + weekly: 60 + monthly÷4=23)
  - **Event**: 500 gems (The Long Haul, Earth's Defenders)
  - **Promo Codes**: 300 gems (code: 30KGTG)

## Features

### Interactive Elements
- Animated counter that counts up on page load
- Copy-to-clipboard for promo code (click the card)
- Theme toggle (dark/light mode)
- **Unified Mode Cards** - 5 large clickable cards (All, Event, PvP, Daily, Code) showing:
  - Total gems for each mode
  - Countdown timer relevant to that mode
  - Click to filter cards, update charts, and animate main total
- Card filter buttons: All, Event, PvP, Daily, Code
- Charts update based on mode selection
- **Search** - Find rewards by name/description with text highlighting
- **Save/Share** - Save views, load saved, copy link, export as PNG
- Export data as JSON
- **Data Drill-Down** - Click category cards for detailed modal view

### Visual Effects
- Floating particles in background
- Scanning line animation
- Rotating gradient on total section
- Corner decorations
- Sparkle particles on cards
- Glow hover effects on cards
- Grid background overlay
- Card fade-in animations

### Charts (3 in single row)
- **Distribution** - Doughnut chart by category
- **Rewards** - Bar chart for individual rewards
- **Performance** - Spider/Radar chart (actual vs target)
- Rich hover tooltips with gems, %, vs average
- Smooth animated transitions on filter changes

## PvP Interactive Feature

Three PvP cards with league and rank selectors:
- **Restricted Arena** - Weekly PvP
- **Open Arena** - Weekly PvP
- **Multiverse Alliance War** - 5 matches / 2 weeks

Each card has:
- League selector: Elite I (70%), Elite II (85%), Elite III (100%), Invincible (125%)
- Rank selector: 1-120
- Dynamic gems, cards, chips based on selection
- Demotion zone warning at rank 86+
- localStorage persistence
- Clear button to reset to defaults

## File Structure

- `index.html` - Main HTML structure (clean, no inline styles/scripts)
- `styles.css` - Design system: CSS custom properties + BEM component classes
- `script.js` - All interactive functionality: charts, filters, PvP, countdown timers
- `gem_infographic.html` - Redirects to index.html (archived)
- `gem_infographic.png` - Static infographic image
- `EXTRACTION_PLAN.md` - Design decision documentation

## Usage

Open `index.html` in a browser to view the infographic. The old `gem_infographic.html` redirects automatically.

## Design System

CSS custom property design tokens with BEM naming convention:
- Color tokens: `--gem-event`, `--gem-pvp`, `--gem-login`, `--gem-code`, `--gem-cyan`, etc.
- Component classes: `.gem-card--event`, `.gem-label--pvp`, `.gem-text--primary`, etc.
- Shadow tokens: `--gem-shadow--card`, `--gem-shadow--glow-cyan`, etc.
- Light mode support via `:root.light-mode` token overrides

## Tech Stack

- Tailwind CSS (via CDN)
- Chart.js for charts (doughnut, bar, radar, line)
- html2canvas for PNG export
- Font Awesome icons
- Rajdhani font (Google Fonts)

## Recent Updates (May 2026)

- ✅ **Extracted to separate files** - `index.html`, `styles.css`, `script.js` from `gem_infographic.html`
- ✅ **Design token system** - CSS custom properties for all colors, shadows, and design values
- ✅ **BEM naming** - Semantic component classes (`.gem-card--event`, `.gem-label--pvp`, etc.)
- ✅ **gem_infographic.html** - Now redirects to index.html
- ✅ **Added gem icons** - Pink diamond icons beside mode selector totals
- ✅ **Consistent pink styling** - All gem icons use same gradient and glow
- ✅ **Removed 4th chart** - Now 3 charts (Distribution, Rewards, Performance) in full-width layout
- ✅ Removed Season category and cards (replaced with PvP)
- ✅ Merged Warfare into PvP (Multiverse Alliance War)
- ✅ Created unified mode cards at top with totals and timers
- ✅ Unified filter buttons + countdowns into single section
- ✅ Charts now update based on mode filter selection
- ✅ Removed legend, calculator, summary boxes
- ✅ Added localStorage persistence for PvP selections
- ✅ Added animated total counter updates
- ✅ Added demotion zone warnings for PvP
- ✅ Fixed HTML structure (article tags, main close, nav close)
- ✅ Fixed JavaScript values (totalGems, baseStatic, chartFilterData)
- ✅ Multi-select mode filtering - toggle Event, PvP, Daily, Code independently
- ✅ Main total updates based on selected modes (PvP uses dynamic value)
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
- ✅ **Spider chart fix** - 4 axes (Events, PvP, Login, Code), targets (550, 1500, 360, 330), login value corrected to 293
- ✅ **Rewards bar chart** - Dynamic bars based on selected modes, mode colors, full height (y.max set dynamically)
- ✅ **Mode button active states** - Added CSS `.active` rules, simplified JS to just toggle class
- ✅ **Category chart** - Removed obsolete Season label, 4 axes matching spider chart
- ✅ **Card body wrapper** - Wrapped content above gem-divider in `.gem-card__body` for consistent height
- ✅ **Promo code reveal animation** - First tap reveals with 3D flip/glow animation, second tap copies
- ✅ **Reordered cards** - Code now first (after All Modes), mode selector and card order aligned
- ✅ **Verbose descriptions** - Non-PvP cards now have story-like descriptions below divider

## Contributors

- Anomaly
- TheOneTruePanda
- dbp loves allen