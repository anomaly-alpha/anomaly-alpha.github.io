# Consistency Audit Plan — Fix All Discrepancies

**Source of truth:** `index.html` configs + `data/arena_payouts.txt` + `data/multiverse_war_payouts.txt`

**Current line counts (after all May 3 commits):**
- index.html: 1284
- script.js: 1207
- styles.css: 1342

---

## 1. Fix Guide Pages (6 files)

### guide/code/index.html
- Fix percentages on line ~102: "one-third of your weekly event income (300 is 60% of 500, not 33%)" → "**60%** of your weekly event income"
- Fix "half of your weekly login bonus (300 is 21.5% of 1393, not 50%)" → "**~22%** of your weekly login bonus"
- Fix link card login total: `993 gems/week` → `1,393 gems/week`

### guide/login/index.html
- Fix main heading/total: login `993` → `1,393`
- Fix weekly login: `60` → `460`
- Fix monthly total claim: `3,970/month` → `5,572/month` (1393×4)
- Fix percentage: "~30% of total" → "~34% of total" (1393/4043)
- Fix FAQ at bottom: total `3,643` → `4,043`

### guide/faq/index.html
- Fix body text total: `3,643` → `4,043`
- Fix login: `993` → `1,393`
- **Remove multiplier language** (lines ~50-60: "Intern ×0.30", "Elite II ×0.85", "Invincible ×1.25") — replace with: "Each league has its own payout table. Climbing to a higher league gives access to that league's better bracket values."

### guide/beginners/index.html
- Fix total: `3,643` → `4,043`
- Fix login: `993` → `1,393`
- **Remove multiplier language** (line ~134: "×0.85 multiplier") — replace with payout table explanation

### guide/pvp/index.html
- Fix line ~123 PvP Currency: `590` → `970` (matches Elite II rank 13 payout in payout table at line ~117)
- Fix line ~170 demotion wording: "drops below rank 86" → "reaches or exceeds rank 86"
- Lines ~173-174 are already correct ("Rank 86+")

### guide/event/index.html
- Check link cards for stale `993` login total — fix to `1,393`

---

## 2. Fix index.html Cleanup (1 file)

### index.html
- Remove `data-league` attributes from 3 PvP `<article>` elements (lines ~930, ~994, ~1058):
  - `data-league="eliteIII"` → remove
  - `data-league="eliteI"` → remove
  - `data-league="eliteII"` → remove
- These are unused by JS and don't match `<select>` defaults

---

## 3. Fix MD Documentation (4 files)

### README.md
- Line counts: 1294→1284, 1223→1207, 1331→1342

### docs/index.md
- Line counts: 1294→1284, 1331→1342, 1223→1207
- Fix line ~73: "Weekly (60)" → "Weekly (460)"

### docs/DESIGN_SYSTEM.md
- Line counts: styles.css 1331→1342, index.html 1306→1284, script.js 1224→1207

### docs/plan/2026-04-29/IMPLEMENTATION_PLAN.md
- Line counts throughout: 1294→1284, 1224→1207, 1326→1342
- Fix duplicate rows in Files Summary table (lines ~548-549): remove duplicate faq row, fix beginners line count to 181

### journal/2026-05-03/index.md
- Fix Session 2 line count claims: 1294→1284, 1223→1207, 1331→1342

---

## 4. Fix Historical Plan Files (9 files)

Update all stale gem values (login 60→460, 293→1393, total 3643→4043, spider 1500→2664). Files:

| File | Key values to update |
|------|---------------------|
| `docs/plan/2026-05-02/JSON_EXTRACTION_PLAN.md` | weeklyTotal=60→460, loginTotal 293→1393 |
| `docs/plan/2026-05-02/REWARDS_CHART_FIX.md` | Login=293→1393 |
| `docs/plan/2026-05-02/SPIDER_CHART_FIX.md` | Login=293→1393, PvP actual 750→live, targets [550,1500,360,330]→[550,2664,360,330] |
| `docs/plan/2026-05-01/DYNAMIC_MODE_TOTALS.md` | Weekly=293→460 |
| `docs/plan/2026-05-01/FIX_TOTAL_GEMS.md` | Weekly=293→460, Login=293→1393 |
| `docs/plan/2026-05-01/PVP_TOTAL_FIX.md` | Any stale login/PvP values |
| `docs/plan/2026-05-01/TOTAL_UPDATE_PLAN.md` | Any stale gem totals |
| `docs/plan/2026-05-01/PVP_IMPLEMENTATION_PLAN.md` | Remove multiplier references, explain payout table system |
| `docs/plan/2026-05-02/PLAN_state_persistence.md` | Fix `gemInfographicState` contradiction — text says single key but code block shows 4 individual keys |
