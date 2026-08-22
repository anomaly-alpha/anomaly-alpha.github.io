# Plan 19: CONTRIBUTING.md Template

**Problem:** No contribution guidelines exist. External contributors (like the 4 listed contributors) have no guidance on how to update promo codes, add new leagues, or modify styles.

**Goal:** Create a CONTRIBUTING.md with clear instructions for common contribution types.

---

## Step 1: Create CONTRIBUTING.md

```markdown
# Contributing to Gem Rewards Calculator

## Quick Start

```bash
npm install && npm run build
```

Open `index.html` in a browser.

## Common Updates

### Updating Promo Codes

Edit `index.html`, find `rewards-config` JSON block:

```json
{"code":"NEWCODE","gems":300,"tickets":0}
```

For expired codes, add `"expired":true,"expiredDate":"YYYY-MM-DD"`.

### Updating PvP Payouts

Edit the `game-config` JSON block. Payout tables are at:
- `game.pvp.arenas.restricted[leagueId]` — Restricted Arena
- `game.pvp.arenas.open[leagueId]` — Open Arena
- `game.pvp.multiverse[leagueGroup]` — Alliance War

### Adding a New League

1. Add to `game.pvp.leagues[]` array
2. Add payout tables to `game.pvp.arenas.restricted` and `open`
3. Update `game.pvp.multiverseLeagueGroupMap` if needed

### Updating Styles

- Design tokens: `styles.css` `:root` custom properties
- Component classes: BEM naming (`.gem-block__element--modifier`)
- After changes: `npm run build`

### Updating Guide Content

Guide pages are at `guide/{code,event,pvp,login,faq,beginners}/index.html`.
Each guide links to all 5 other guides + back to main page.

## Code Style

- JavaScript: ES5, function declarations, camelCase, UPPER_SNAKE_CASE constants
- No JSDoc — use `// ===== SECTION NAME =====` headers
- No `fetch()`, no CDN, no ES modules
- CSS: BEM naming, custom property tokens

## Pull Requests

1. Run `npm run build` before committing
2. Run `npm run check-links` to verify links
3. Test in browser — dark mode, light mode, mobile
4. Describe what changed and why
```

## Files Modified
- `CONTRIBUTING.md` — new file

## Verification
```bash
cat CONTRIBUTING.md
# Review content for accuracy against actual codebase
```
