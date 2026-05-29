# Plan 161: Add New Codes & Update Reward System

**Date:** May 20, 2026
**Status:** Approved
**Execution:** Follow steps sequentially. Do not skip verification.

---

## Summary

Add 2 new promo codes (KRESSA, DSCORD), update 4 existing codes to show character rewards instead of gems, and fix the copy-code UX so the mode button and total counter reflect the last copied code's value.

---

## Files to Modify

| File | Changes |
|------|---------|
| `index.html` | Update `promoCodes` array + `cards[0].codes` array (same data), add 2 IDs to promo card HTML |
| `script.js` | Add `lastCopiedCode` global, modify `updateAllPageTotals`, `showCodeRewards`, `copyCode` |
| `guide/code/index.html` | Update text counts + code list |

---

## Step 1: `index.html` — Update `promoCodes` array (line ~643)

### Update existing entries (change rewards from gems to hero shards):

| Current | New |
|---------|-----|
| `{"code":"LUCAN4","gems":300,"tickets":0}` | `{"code":"LUCAN4","gems":0,"tickets":0,"reward":"1 x Lucan"}` |
| `{"code":"THULA4","gems":300,"tickets":0}` | `{"code":"THULA4","gems":0,"tickets":0,"reward":"1 x Thula"}` |
| `{"code":"KREGG4","gems":300,"tickets":0}` | `{"code":"KREGG4","gems":0,"tickets":0,"reward":"1 x Kregg"}` |
| `{"code":"ANISS4","gems":300,"tickets":0}` | `{"code":"ANISS4","gems":0,"tickets":0,"reward":"1 x Anissa"}` |

### Add new entries (after `SURV3Y`, before `MOSTV4` — newest first):

```json
{"code":"DSCORD","gems":1000,"tickets":0},
{"code":"KRESSA","gems":0,"tickets":0,"reward":"1 x Kregg, 1 x Anissa"}
```

### Summary of code counts after changes:

- Active: 26 (was 24)
- Expired: 8 (unchanged)
- Total: 34

---

## Step 2: `index.html` — Same changes to `cards[0].codes` array (line ~438)

The `cards[0].codes` array is an exact duplicate of `promoCodes`. Apply identical changes. Note: JS only reads `REWARDS.promoCodes`, but update both for data consistency.

---

## Step 3: `index.html` — Add 2 HTML IDs for container toggling

### Add `id="code-gems-display"` to the gems `<p>` (line ~1046):

```html
<!-- Before: -->
<p class="gem-card__gems">

<!-- After: -->
<p id="code-gems-display" class="gem-card__gems">
```

### Add `id="code-tickets-display"` to the tickets `<span>` (line ~1019):

```html
<!-- Before: -->
<span><svg class="gem-text--cyan"...> <span id="code-total-tickets">0</span> Tickets</span>

<!-- After: -->
<span id="code-tickets-display"><svg class="gem-text--cyan"...> <span id="code-total-tickets">0</span> Tickets</span>
```

These IDs let `showCodeRewards` toggle visibility cleanly between gems+tickets display vs. reward text.

---

## Step 4: `script.js` — Add `lastCopiedCode` global

After `loadAllConfigs()` declaration (near top of file), initialize:

```javascript
let lastCopiedCode = null;
```

### Persistence

`lastCopiedCode` persists via `localStorage` key `gem_copiedCode`:
- On copy: `localStorage.setItem('gem_copiedCode', codeString)` — stores only the code string (e.g., `"DSCORD"`)
- On page load in `loadPageState()`: read string, look up in `REWARDS.promoCodes` by `.code` match
- If persisted code is expired or not found: fall back to `null` (first active code used)
- Existing `gem_` prefix convention (`gem_modes`, `gem_chartFilter`, etc.)

---

## Step 5: `script.js` — Modify `updateAllPageTotals`

### 5a: Calculate dynamic code value for total + mode button

In the total calculation, replace:

```javascript
const t=selectedModes.reduce((e,t)=>e+getModeTotal(t),0)
```

With:

```javascript
const codeDynamic=lastCopiedCode?(lastCopiedCode.gems||0):REWARDS.categories.code.total;const t=selectedModes.reduce((e,t)=>e+("code"===t?codeDynamic:getModeTotal(t)),0)
```

### 5b: Use dynamic value for 'code' mode button

In the mode button loop, replace:

```javascript
["event","pvp","login","code"].forEach(t=>{const o=document.querySelector(`.gem-mode-btn--${t}`),a="pvp"===t?getModeTotal("pvp"):Math.round(getModeTotal(t));
```

With:

```javascript
["event","pvp","login","code"].forEach(t=>{const o=document.querySelector(`.gem-mode-btn--${t}`),a="pvp"===t?getModeTotal("pvp"):"code"===t?codeDynamic:Math.round(getModeTotal(t));
```

### 5c: Use lastCopiedCode or first active for card display

Replace the end of the function:

```javascript
// Current:
const n=REWARDS&&REWARDS.promoCodes?REWARDS.promoCodes[0]:null;n&&showCodeRewards(n,e)

// New:
const n=lastCopiedCode||(REWARDS&&REWARDS.promoCodes?REWARDS.promoCodes.find(c=>!c.expired)||REWARDS.promoCodes[0]:null);n&&showCodeRewards(n,e)
```

This fixes the bug where an expired code (SURV3Y) was shown on initial load.

---

## Step 6: `script.js` — Fix `showCodeRewards`

Replace the entire function body. Current logic:

```javascript
function showCodeRewards(e,t){
  const o=document.getElementById("code-total-gems"),
  a=document.getElementById("code-total-tickets");
  if(e.reward){
    const o=document.getElementById("code-total-reward");
    return void(o&&(t?o.textContent=e.reward:(o.textContent=e.reward,o.classList.remove("hidden"))))
  }
  o&&(t?o.textContent=e.gems.toLocaleString():animateValue(o,e.gems,400)),
  a&&(t?a.textContent=(e.tickets||0).toLocaleString():animateValue(a,e.tickets||0,400))
}
```

Problems:
- When `e.reward` is set, gems/tickets containers remain visible with stale values
- No `hidden` class added to `#code-total-gems` or `#code-total-tickets`

New logic:

1. Get refs: `#code-gems-display`, `#code-tickets-display`, `#code-total-reward`, `#code-total-gems`, `#code-total-tickets`
2. Hide all containers first (add `hidden` class to gems, tickets, reward)
3. If `e.reward`: show `#code-total-reward` with text, return
4. Otherwise: show gems + tickets containers, animate/set gems and tickets values

---

## Step 7: `script.js` — Fix `copyCode`

Replace the end of the function:

```javascript
// Current:
n&&showCodeRewards(n)

// New:
if(n){lastCopiedCode=n;updateAllPageTotals()}
```

Keep all existing logic before this line unchanged (clipboard write, toast, "copied" class).

Rationale: `updateAllPageTotals()` handles everything — mode buttons, total counter, and card display. Setting `lastCopiedCode` before the call ensures the right code is used throughout.

---

## Step 8a: `index.html` — Update FAQPage structured data (line ~830)

Two entries in the JSON-LD FAQPage schema need updating:

### Q1 answer (weekly total):

```json
// Before:
"text": "Players can earn approximately 4,043 gems per week from all sources: events (500), PvP (varies by league and rank, ~1,850 with default Elite II rank 13 settings), login rewards (1,393), and promo codes (300)."

// After:
"text": "Players can earn approximately 3,743+ gems per week from all sources: events (500), PvP (varies by league and rank, ~1,850 with default Elite II rank 13 settings), login rewards (1,393), and promo codes (variable, including gems, hero shards, and Hero Shop Tickets)."
```

### Q3 answer (active codes count):

```json
// Before:
"text": "There are 24 active promo codes with rewards including gems and Hero Shop Tickets. Generate a verification code in your game settings (top left LVL), then redeem at redeem.invincible.ubisoft.barcelona."

// After:
"text": "There are 26 active promo codes with rewards including gems, hero shards, and Hero Shop Tickets. Generate a verification code in your game settings (top left LVL), then redeem at redeem.invincible.ubisoft.barcelona."
```

---

## Step 8b: `guide/code/index.html` — Update text and code list

### Meta description (line 6):

```
"24 active codes worth 300 gems each"
→
"26 active codes — gems, tickets & character rewards"
```

### `<title>` (line 21):

```
"26 Active Codes"
→
"28 Active Codes"
```

### Card tab badge (line 84):

```
24 ACTIVE
→
26 ACTIVE
```

### Subtitle (line 91):

```
"24 active codes worth 300 gems each"
→
"26 active codes — gems, tickets & hero shards"
```

### `<title>` (line 21):

Already says "26 Active Codes" — no change needed (pre-existing error corrects itself when count becomes 26)

### Card tab badge (line 84):

```
24 ACTIVE
→
26 ACTIVE
```

### Subtitle (line 91):

```
"24 active codes + 8 expired"
→
"26 active codes + 8 expired"
```

### Last updated (line 94):

```
"May 12, 2026"
→
"May 20, 2026"
```

### Active code list (line 96 inline spans):

Add `<span>` elements for DSCORD and KRESSA in alphabetical position among the existing span list:

```html
<span class="gem-text--code text-sm font-bold tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10">DSCORD</span>
<span class="gem-text--code text-sm font-bold tracking-widest bg-white/5 px-3 py-1.5 rounded border border-white/10">KRESSA</span>
```

### Paragraph (line 110):

```
"The 24 codes listed above"
→
"The 26 codes listed above"
```

### Paragraph (line 130):

```
"With 24 active codes available"
→
"With 26 active codes available"
```

---

## Step 9: Verify

1. `npm run build` — ensure minification succeeds
2. Open `index.html` in browser
3. **Load test:** Card shows first active code (MOSTV4, 300 gems), mode button "Code" shows 300
4. **Copy gem code:** Copy DSCORD → mode button shows 1000, total increases by 700, card shows "1000 GEMS"
5. **Copy character code:** Copy ANISS4 → mode button shows 0, total decreases by 1000, card shows "1 x Anissa" with no "0 GEMS" visible
6. **Toggle mode filter:** Click Event → cards filter, click All → back, code value preserved
7. **Guide page:** Open `guide/code/index.html` — 26 active codes listed, text updated
8. **Charts:** Click "Show Charts" — code segment still uses 300 (static, not dynamic)

---

## Non-Goals

- `getModeTotal('code')` is NOT modified — charts keep showing static 300
- `modeTotals` is NOT used for any meaningful purpose (it's dead code)
- `cards[0].codes` is updated for consistency but functionally unused
- No new data structure changes — the existing `reward` string field is sufficient
- No structural HTML changes beyond adding 2 IDs

---

## Code Reward Summary

| Code | Action | Reward |
|------|--------|--------|
| DSCORD | Add | 1000 Gems |
| KRESSA | Add | 1 x Kregg, 1 x Anissa |
| ANISS4 | Update | 300 gems → 1 x Anissa |
| KREGG4 | Update | 300 gems → 1 x Kregg |
| LUCAN4 | Update | 300 gems → 1 x Lucan |
| THULA4 | Update | 300 gems → 1 x Thula |
