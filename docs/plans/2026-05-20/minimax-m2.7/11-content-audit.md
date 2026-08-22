# Plan 11: Content Audit - All 8 Pages

**Problem:** Content may be outdated — promo code lists have expired codes mixed in, event descriptions reference mechanics that may have changed, and the FAQ hasn't been updated since launch.

**Goal:** Audit every page for accuracy, currency, and completeness. Create an audit report and update content where needed.

---

## Step 1: Create an audit checklist
Create a markdown audit report at `docs/audit/2026-05-20-content-audit.md`:

```markdown
# Content Audit — 2026-05-20

## index.html
- [ ] Description meta tag mentions ~4,043 gems/week — verify math
- [ ] Check if 24 active promo codes are all still valid
- [ ] Check spider chart targets (events:550, pvp:2664, login:360, code:330) — still accurate?
- [ ] Verify GAME.pvp.defaults (league: eliteII, rank: 13) — still reasonable defaults

## guide/code/
- [ ] Verify redeem.invincible.ubisoft.barcelona URL still works
- [ ] Check promo code list: remove fully expired codes, add any new ones
- [ ] Verify redemption steps still match current game UI

## guide/event/
- [ ] The Long Haul description: is "Top 5%" still the threshold?
- [ ] Earth's Defenders description: is "Top 10%" still accurate?

## guide/pvp/
- [ ] Verify all 14 league names and order match in-game
- [ ] Check demotionThreshold: 86 — still correct?
- [ ] Verify payout table data matches data/arena_payouts.txt

## guide/login/
- [ ] Daily (130×7=910), Weekly (460), Monthly (23÷4) — still accurate?
- [ ] Check if monthly hero schedule changed

## guide/faq/
- [ ] Verify all FAQ answers still match current game state
- [ ] Add new FAQ entries for common questions seen in community

## guide/beginners/
- [ ] Check if beginner recommendations still match meta
- [ ] Verify spending tips are current

## 404.html
- [ ] Check for broken links in 404 content
```

## Step 2: Run through each item
Manually verify each item in the checklist. For each discrepancy:
1. Note the current state vs expected state
2. Update the relevant HTML or JSON config
3. Mark the item as fixed in the audit file

## Step 3: Create an action list for major updates
Any item that needs more than a text fix becomes a separate plan. For example:
- Promo code removal → could be automated script
- Payout table update → update game-config JSON

## Files Modified
- `docs/audit/2026-05-20-content-audit.md` — new file
- `index.html` — update descriptions if needed
- `guide/code/index.html` — update code list
- `guide/*/index.html` — update outdated content

## Verification
```bash
# Review audit file, confirm all items checked and actioned
open docs/audit/2026-05-20-content-audit.md
```