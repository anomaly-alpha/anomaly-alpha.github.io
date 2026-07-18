# [S1] SEO Growth & Marketing Optimization — Design Spec

**Date:** 2026-07-17
**Status:** Approved design
**Source:** GSC export analysis — 1,027 clicks, 13.7/day, code guide 80.4% of traffic

---

## [S2] Problem

The site has strong growth (1027 clicks, +150% from previous period) but traffic is heavily concentrated on the code guide (80.4%). Other pages have high impression counts but very low CTRs (0.96%-3.05% vs code guide's 4.93%). Several high-position queries get zero clicks due to meta snippet mismatch. No marketing distribution system exists to amplify content.

## [S3] Solution overview

Three-phase plan: (A) Fix the highest-impact CTR leaks and cross-promote, (B) Fill content gaps for underperforming queries, (C) Add marketing distribution features.

---

## [S4] Phase A: Snippet Fixes + Cross-Promotion

### A1: Fix "invincible gem" CTR leak (pos 2.79, 39 imp, 0 clicks)

**Files:** `index.html`

Add gems definition paragraph below the homepage hero subtitle:
```html
<p class="text-white/60 text-sm max-w-2xl mx-auto mt-2">
    Gems are the premium currency in Invincible: Guarding the Globe — used for energy refills, hero pulls, and shop items. 
    Earn up to ~4,043 free gems every week from all sources combined.
</p>
```

Rewrite homepage meta description to front-load "gems":
```
Current:  "Get all free gems in Invincible Guarding the Globe — promo codes, PvP rewards..."
New:      "Calculate your free gems in Invincible Guarding the Globe — 4,043/week from promo codes, PvP rewards, login bonuses, and weekly events."
```

### A2: Fix "invincible calculator" CTR leak (pos 4.14, 21 imp, 0 clicks)

Rewrite homepage meta description to lead with "Calculate":
```
Current:  "Get all free gems..."
New:      "Calculate your exact weekly gem income in Invincible Guarding the Globe — 4,043/week from all sources."
```

### A3: Rewrite underperforming guide meta descriptions

**FAQ** (1.31% CTR):
```
Current:  "All your Invincible Guarding the Globe questions answered — gem earnings, PvP leagues, promo codes, login rewards, and events. Updated weekly."
New:      "How many gems per week in Invincible Guarding the Globe? ~4,043 from PvP, events, login streaks, and 28 active promo codes. Complete FAQ with payout tables and redemption guide."
```

**Login** (0.96% CTR):
```
Current:  "Plan your 1,393 weekly login gems — daily (910), weekly (460), and monthly bonuses explained. Login rewards are your most reliable gem source."
New:      "Login rewards give you 1,393 free gems every week in Invincible Guarding the Globe — daily logins (910), weekly streaks (460), and monthly bonuses. Your most reliable income source."
```

**Event** (1.09% CTR) — unchanged (description is already specific with numbers)
**XP** (1.97% CTR) — title fix only (see B1)

### A4: Internal cross-links from code guide

**Files:** `guide/code/index.html`

Add 2 context-rich cross-links between the active codes section and the tips section:
```html
<p class="text-white/60 text-sm mt-6">
    💎 Already grabbed your codes? Check your <a href="../pvp/" class="gem-text--pvp hover:text-white transition-colors">PvP earnings</a> 
    and <a href="../login/" class="gem-text--login hover:text-white transition-colors">login rewards</a> to see your full weekly total.
</p>
```

---

## [S5] Phase B: Content Expansion

### B1: Fix XP guide title mismatch

**Files:** `guide/xp/index.html`

The meta title says "XP Calculator" but the page is a static reference table. Change:
```
Current:  "Invincible Guarding the Globe XP Calculator — Leveling & Progression"
New:      "Invincible Guarding the Globe XP Guide — Hero Rank-Up Costs Rare to Omnipotent+"
```

Update OG title, Twitter title, and `<title>` consistently.

### B2: "How to Get Free Gems" — homepage meta description update

Already covered in A1 (the gems definition paragraph addresses this query). Update the description:
```
Current:  "Get all free gems in Invincible Guarding the Globe — promo codes, PvP rewards..."
New:      "How to get free gems and calculate your weekly income in Invincible Guarding the Globe — 4,043/week from promo codes, PvP, login, and events."
```

### B3: PvP league comparison section

**Files:** `guide/pvp/index.html`

Add a league comparison card after the payout tables heading — a 14-row table showing the gem jump between consecutive leagues:
```html
<h2 class="text-lg font-bold gem-text--pvp mb-4">League Comparison — Gem Jumps</h2>
<p class="text-white/60 text-sm mb-4">Moving up a league increases your weekly gem payout. Here's how much each promotion is worth:</p>
<table class="w-full text-sm">
  <thead>
    <tr class="text-white/50 text-xs uppercase tracking-wider border-b border-white/10">
      <th class="text-left p-2">League Promotion</th>
      <th class="text-right p-2">Gem Increase/Week</th>
    </tr>
  </thead>
  <tbody id="leagueComparisonTable"></tbody>
</table>
```

Populated from `GAME.pvp.leagues` (inline JSON config). This requires a small JS addition to render the table on page load.

### B4: Expired code badge

**Files:** `styles.css`

Make expired codes more visually distinctive with a red "EXPIRED" badge, not just dimmed text. This is a CSS change to the existing expired code chip styles.

---

## [S6] Phase C: Marketing Distribution

### C1: Social share buttons

**Files:** `script.js`, `index.html`, `guide/code/index.html`

Add to `script.js`:
```js
function shareOnTwitter(url, text) {
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'width=600,height=400');
}
function shareOnReddit(url, title) {
  window.open('https://www.reddit.com/submit?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title), '_blank', 'width=600,height=400');
}
function copyLink(url) {
  navigator.clipboard.writeText(url).then(function() {
    // toast notification
  });
}
```

Add share button row to homepage and code guide hero areas.

### C2: "New Code" badge in generator

**Files:** `scripts/generate-codes.js`, `styles.css`

Add `<7 day` detection in the chip generator. When `code.dateAdded` is less than 7 days from now, add a `<span class="gem-code--badge gem-code--badge--new">NEW</span>` to the chip HTML.

CSS:
```css
.gem-code--badge { display: inline-block; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 3px; margin-left: 0.25rem; font-weight: 700; text-transform: uppercase; vertical-align: middle; }
.gem-code--badge--new { background: #2ecc71; color: #000; }
.gem-code--badge--recent { background: #00e5ff; color: #000; }
```

### C3: Shareable gem summary card

**Files:** `index.html`

A styled card positioned after the calculator cards, before charts:
```html
<section class="gem-card p-6 mt-8">
  <h2 class="text-lg font-bold gem-text--cyan mb-4">Your Weekly Gem Summary</h2>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
    <div><p class="text-white/50 text-xs">PvP</p><p class="text-xl font-bold gem-text--pvp">~1,850</p></div>
    <div><p class="text-white/50 text-xs">Events</p><p class="text-xl font-bold gem-text--event">500</p></div>
    <div><p class="text-white/50 text-xs">Login</p><p class="text-xl font-bold gem-text--login">1,393</p></div>
    <div><p class="text-white/50 text-xs">Codes</p><p class="text-xl font-bold gem-text--code">300</p></div>
  </div>
  <p class="text-center text-2xl font-bold gem-text--cyan">~4,043 gems/week</p>
  <p class="text-center text-white/40 text-xs mt-2">anomaly-alpha.github.io</p>
</section>
```

Share buttons at the bottom of the card.

### C4: UTM documentation

**Files:** `advertising.md`

Add UTM-tagged URL variants to each advertising copy block:
```
https://anomaly-alpha.github.io/?utm_source=discord&utm_medium=social&utm_campaign=gem-calc-promo
```

---

## [S7] Files modified

| File | Phase | Change |
|------|-------|--------|
| `index.html` | A1, A2, C3 | Hero gems text, meta description, share buttons, summary card |
| `guide/code/index.html` | A4, C1 | Cross-links, share buttons |
| `guide/pvp/index.html` | B3 | League comparison table |
| `guide/xp/index.html` | B1 | Title change (XP Calculator → XP Guide) |
| `styles.css` | B4, C2 | Expired code badge, NEW code badge CSS |
| `script.js` | C1 | Share/copy functions |
| `scripts/generate-codes.js` | C2 | "NEW" badge in chip template |
| `advertising.md` | C4 | UTM-tagged URLs |

## [S8] Verification

1. `npm run build` — no regressions
2. Open all modified pages in browser — check rendering
3. Run GSC analyzer to confirm no structured data broken: `npm run analyze-gsc`
4. Check code guide chips for NEW badge (add a test code with today's date in `data/codes.json`)
5. Verify share buttons on homepage + code guide
6. Verify league comparison table renders on PvP guide
