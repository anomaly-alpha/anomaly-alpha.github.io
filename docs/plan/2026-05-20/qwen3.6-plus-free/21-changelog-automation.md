# Plan 21: CHANGELOG.md Automation

**Problem:** No changelog exists. Users and contributors have no way to track what changed between versions. Release notes are ad-hoc at best.

**Goal:** Set up conventional commits and auto-generate CHANGELOG.md from git history.

---

## Step 1: Install conventional changelog tool

```bash
npm install --save-dev conventional-changelog-cli
```

## Step 2: Add changelog script

```json
// package.json
"changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
```

## Step 3: Create initial CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [1.0.0] - 2026-05-20

### Added
- Initial release: Gem Rewards Calculator
- 9 reward cards (Events, PvP, Login, Promo Codes)
- Interactive PvP league/rank selector
- Lazy-loaded Chart.js charts
- Dark and light mode
- 6 strategy guides
```

## Step 4: Update CI to generate changelog on release

```yaml
# .github/workflows/release.yml — add step
- name: Generate changelog
  run: npm run changelog
```

## Files Modified
- `CHANGELOG.md` — new file
- `package.json` — changelog script
- `package.json` — dev dependency

## Verification
```bash
npm run changelog
cat CHANGELOG.md
# Should show formatted changelog from git history
```
