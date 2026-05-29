# Plan 24: CHANGELOG.md from Git History

**Problem:** There is no changelog. Users visiting the repository cannot see what has changed between versions. The README has a "Recent Updates" section that's manually maintained and has already drifted from the actual git history.

**Goal:** Create a changelog from git history using conventional commit messages. Set up a convention for automatic updates going forward.

---

## Step 1: Generate initial changelog from git log

```bash
git log --reverse --format="%ad %s" --date=short > /tmp/gitlog.txt
```

Parse into a structured changelog:

```bash
#!/bin/bash
# Parse git log into changelog sections

echo "# Changelog"
echo ""
echo "All notable changes to the Gem Rewards Calculator."
echo ""

# Group by year-month
git log --reverse --format="%ad|%s" --date=short | while IFS='|' read -r date msg; do
  yearmonth=$(echo "$date" | cut -d- -f1,2)
  echo "[$yearmonth] $msg"
done | sort -t'[' -k2 -r | awk -F'|' '{
  # This is simplified — better to use a proper changelog generator
  print $0
}'
```

---

## Step 2: Better approach — use standard-version or keepachangelog format

Manually curate from git history for a clean result:

```bash
git log --oneline --no-decorate --format="* %s (%h)" | head -50
```

**File: `CHANGELOG.md`** (hand-curated from git log):

```md
# Changelog

## [Unreleased]
### Planned
- PWA support (manifest + service worker)
- Testing infrastructure
- Accessibility improvements

## [2026-05-12]
### Performance
- 100/100 Lighthouse on all pages
- Fix 404 SEO (noindex removed)
- Fix homepage CLS from async Tailwind

### Bug Fixes
- Eliminate last CLS 0.04 on homepage
- Fix a11y label mismatch
- Mobile audit ~99/100

## [2026-05-11]
### Performance
- Zero CDN dependencies — eliminate all external origins
- Self-host Google Fonts (Rajdhani + Orbitron)
- Font-display: swap → optional
- Chart.js self-hosted in vendor/
- Remove Tailwind Play CDN from guide pages (283 KB blocking script per page)

## [2026-05-10]
### Performance
- CSS/JS minification via csso + terser (-31 KB)
- Remove Font Awesome → 32 inline SVGs (~300 KB saved)
- Remove floating controls (theme toggle, save/share, export)
- Inline @keyframes pulse — no Tailwind CDN dependency

## [2026-05-09]
### Performance
- Critical CSS inlined on all pages
- DOMContentLoaded in requestAnimationFrame (TBT 240ms→30ms)
- CSS-driven countdown pulse (replace JS interval)
- GPU-optimized particles with will-change + translate3d
- Remove 27 continuous animations → 9 particles only
- Lazy-load Chart.js (205KB deferred)

## [2026-05-08]
### Features
- Card modal system (9 cards with hero tagline, tips, live PvP data)
- Mode button hover highlight
- Charts toggle with animated chevron
- Custom SVG favicon (cyan-to-pink gradient)

## [2026-05-07]
### Features
- 14 PvP leagues with real payout tables
- 3 interactive PvP cards (Restricted, Open, Alliance War)
- Real arena payout data from game source files
- State persistence via localStorage + URL params
- Spider chart live updates

## [2026-05-06]
### Content
- 6 guide pages (code, event, pvp, login, faq, beginners)
- OG images (7 per-page PNGs)
- robots.txt + sitemap.xml + Google Search Console verification

## [2026-05-05]
### Features
- Inline JSON config system (no fetch, works from file://)
- Promo code reveal with 3D flip animation
- Mode filtering (5-mode selector)
- Countdown timers (weekly, daily, event)

## [2026-05-04]
### Features
- Initial release
- Gem total calculator
- Basic PvP selectors
- Animated counter
```

---

## Step 3: Add `npm run changelog` script

For future automated generation, consider `auto-changelog`:

```bash
npm install -D auto-changelog
```

```json
"changelog": "auto-changelog --template compact --hide-credit",
"changelog:full": "auto-changelog --hide-credit"
```

---

## Step 4: Link changelog from README

**In `README.md`**, add a badge or link:

```md
[![Changelog](CHANGELOG.md)](/CHANGELOG.md)
```

Or in the "Recent Updates" section, replace the manual list with a link:

```md
> See [CHANGELOG.md](CHANGELOG.md) for the full history of updates.
```

Consider removing the "Recent Updates" section from README in favor of the CHANGELOG (to prevent drift).

---

## Files Created/Modified

| File | Status |
|------|--------|
| `CHANGELOG.md` | **New** |
| `package.json` | Add `changelog` script |
| `README.md` | Link to CHANGELOG, optionally remove stale "Recent Updates" section |

---

## Verification

```bash
cat CHANGELOG.md
# Verify dates match git history
git log --oneline --format="%ad %s" --date=short | head -20
# Cross-reference with CHANGELOG entries
```
