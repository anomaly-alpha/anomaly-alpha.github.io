# Plan 41: Release Checklist

**Problem:** No standardized release process exists. Each release is ad-hoc, with no checklist to ensure all pre-release steps are completed (build, tests, link check, changelog).

**Goal:** Create a release checklist document and automate as much as possible.

---

## Step 1: Create RELEASE.md

```markdown
# Release Checklist

## Pre-release

- [ ] `npm run build` — all assets minified
- [ ] `npm run lint` — no errors
- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] `npm run check-links` — no broken links
- [ ] `npm run check-budget` — within performance budget
- [ ] Promo codes updated (check for new/expired)
- [ ] PvP payout tables verified against game
- [ ] Countdown targets verified

## Browser Testing

- [ ] Chrome (desktop) — dark mode
- [ ] Chrome (desktop) — light mode
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile emulation)
- [ ] Safari (iOS) — if available

## SEO

- [ ] OG images render correctly
- [ ] Meta tags present on all pages
- [ ] Structured data validates (Rich Results Test)
- [ ] Sitemap.xml has correct URLs
- [ ] robots.txt is correct

## Post-release

- [ ] Deploy to production
- [ ] Verify live site loads
- [ ] Check Cloudflare cache cleared
- [ ] Update CHANGELOG.md
- [ ] Create git tag: `git tag v1.x.x && git push --tags`
```

## Step 2: Add release script

```json
// package.json
"release:check": "npm run build && npm run lint && npm run check-links && npm run check-budget && echo 'All checks passed ✓'"
```

## Files Modified
- `RELEASE.md` — new file
- `package.json` — release:check script

## Verification
```bash
npm run release:check
# Should run all pre-release checks
```
