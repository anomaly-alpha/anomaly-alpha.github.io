# Codes Audit — 2026-10-31

**Date:** 2026-10-31
**Model:** deepseek-v4.1-flash
**Scope:** `data/codes.json` accuracy against external code lists
**Verdict:** 3 codes are almost certainly mislabelled **expired**; 6 more need verification; 3 known codes are untracked.
**Status:** Findings 1, 3 and 4 **applied** on 2026-10-31 (see §9). Finding 2 remains open — awaiting in-game verification.

---

## 1. Method and limitations

Cross-referenced our 51-entry dataset against two independent, freshly-fetched competitor lists:

| Source | Declared freshness | Active | Expired tracked |
|---|---|---|---|
| `data/codes.json` (ours) | `updated 2026-10-31` | **32** | 19 |
| VG247 | page updated **2026-10-16** | 27 | 21 |
| gacha.gg | "Last checked **2026-10-30**" | 27 | 11 |

**Limits of this audit.** No external list is authoritative — all three are maintained by third parties or by us, and code sites are notorious for never pruning. This audit can prove **disagreement**, not truth. Where sources conflict, only an in-game redemption attempt resolves it.

One caveat specific to gacha.gg: its page claims a 30 Oct check, but most individual codes are stamped **"24 Aug"**, and its 3 disputed codes carry that Aug stamp. Its 11-entry expired list is a strict subset of VG247's 21. That pattern reads as **aggressive pruning**, not fresh per-code verification — so its agreement is weaker evidence than it appears.

---

## 2. Finding 1 — three codes likely mislabelled EXPIRED (high priority)

We list these as expired since **2026-07-29**. Both external sources list them as **working**.

| Code | Reward | Our status | VG247 (Oct 16) | gacha.gg (Oct 30) | Our `dateAdded` |
|---|---|---|---|---|---|
| `THKMRK` | 1× Omni-Man | EXPIRED | ACTIVE | ACTIVE | 2026-03-01 |
| `LUCAN4` | 1× Lucan | EXPIRED | ACTIVE | ACTIVE | 2026-04-01 |
| `THULA4` | 1× Thula | EXPIRED | ACTIVE | ACTIVE | 2026-04-01 |

### Why this looks like our error

1. **All three share the exact same expiry date — 2026-07-29** — along with four other codes in one batch: `JUL4TH`, `IGTG33`, `FRIEND`, `KRESSA`. Batch operations are where systematic errors happen.
2. **All three are hero-granting codes**, a class that has demonstrably persisted: `SPRACE` (Space Racer), `THAEDS` (Thaedus), `TECHJK` (Tech Jacket), `DINOSR` (Dinosaurus), `INVCBL` (Invincible), `ANISS4` (Anissa), `KREGG4` (Kregg), `RAID02` (Bulletproof + Powerplex) are all still active from comparable or earlier dates.
3. **`KREGG4` — same type, added 2026-04-01 — was verified working and reactivated today** (`reactivated: true`, `reactivatedDate: 2026-10-31`). The adjacent case in the same batch family was found live.

### Why it matters

These are not gem codes. `THKMRK` grants a **free Omni-Man**. Telling users it expired when it works is the most costly error class on this site: a user who would have redeemed a hero does not try.

### Secondary defect

`THKMRK`'s reward payload is the literal string **`"No rewards tracked"`**. That is placeholder text, not data, and it renders into the reward column. It is the only entry in the dataset with a placeholder value.

---

## 3. Finding 2 — six "active" codes where one source disagrees (medium priority)

We mark these active. VG247 lists them expired. gacha.gg lists them **nowhere** (neither active nor expired).

| Code | Our status | VG247 | gacha.gg | Note |
|---|---|---|---|---|
| `KREGG4` | ACTIVE | EXPIRED | absent | **Deliberately reactivated today** — likely VG247 is stale |
| `UPDAT3` | ACTIVE | EXPIRED | absent | |
| `BULL3T` | ACTIVE | EXPIRED | absent | |
| `RAID26` | ACTIVE | EXPIRED | absent | |
| `RAID02` | ACTIVE | EXPIRED | absent | |
| `SUMMER` | ACTIVE | EXPIRED | absent | |

**Assessment: lower risk than Finding 1.** Our data (`2026-10-31`) is 15 days newer than VG247's (`2026-10-16`), and `KREGG4` carries an explicit human reactivation decision from today. gacha.gg's silence is not evidence of expiry — it prunes.

But listing a dead code as active is the **worse user-facing error** (the user tries, fails, and bounces). Worth a verification pass.

---

## 4. Finding 3 — three known codes we do not track at all (low priority)

`YEAR26`, `BBEAST`, `PATCH3` — both sources classify all three as **expired**.

We track neither, active nor expired. The guide's stated value proposition includes preserving expired codes "for historical reference," so this is a completeness gap. Cheap to close; low traffic value.

---

## 5. Finding 4 — two codes we lead on (expected, not a defect)

`SAVE37` (added 2026-10-24) and `TRICKY` (added 2026-10-31) appear in **neither** competitor list. These are our newest additions; competitors have not caught up. This is the pipeline working correctly.

---

## 6. Verified as NOT a bug

I initially flagged the pinning logic as suspicious — `KREGG4` is pinned at list position #3 despite `dateAdded 2026-04-01`, so 11 newer codes list beneath it. On inspection the generator is **correct**:

```js
const newestPinned = pinned.length ? Math.max(...pinned.map(addedDate)) : null;
const stalePins = newestPinned ? active.filter(c => c.position === undefined && addedDate(c) > newestPinned) : [];
```

`Math.max` returns the newest pinned date (`TRICKY`, 2026-10-31), and no code is newer than that — so no warning fires, correctly. Pinning a reactivated code above newer ones is intentional editorial behaviour, matching the commit `95369fe feat(seo): pin newest codes and tag KREGG4 as reactivated`. **No change needed.**

---

## 7. Recommended actions

1. **Verify `THKMRK`, `LUCAN4`, `THULA4` in-game** — attempt redemption on a live account. This is the only way to resolve Finding 1. (~2 minutes each.)
2. **Correct the three that work** — set `expired: false`, clear `expiredDate`. Hero codes carry high perceived value; a false expiry is a real user cost.
3. **Replace `THKMRK`'s placeholder reward** `"No rewards tracked"` with its actual reward.
4. **Verify the six in Finding 2**, prioritising `RAID26` and `RAID02` (gear/hero rewards).
5. **Add `YEAR26`, `BBEAST`, `PATCH3`** as expired entries to complete the historical record.
6. **Re-run `npm run update-codes`** and `npm run build` after each data change, then confirm the active/expired counts update in `guide/code/index.html` via the markers.

After any change: run `npm run build`, `npm run test:structured-data`, and `npm run test:ads-fallback`.

---

## 8. What this audit does not cover

- **Code reward accuracy.** Whether `AALIEN` actually grants 250 gems + 1 Allen the Alien was not verified — only presence/status.
- **Expiry dates.** No source publishes reliable expiry dates; ours are internally generated.
- **Codes not on either competitor list.** Any code absent from all three datasets is invisible to this method. The Reddit community sheet (`r/invinciblegtg`) and the official Discord are the likely sources for those.
- **GSC demand signal.** Code strings do not appear as search queries — users search "invincible gtg codes", not `THKMRK`. So the SEO impact of Finding 1 is indirect (accuracy/trust), not direct lost impressions.

---

## 9. Resolution applied (2026-10-31)

A third corroborating source surfaced during implementation: the **r/invinciblegtg "Active Code List"** thread lists **`THKMRK`** among its current active codes — independent community confirmation on top of VG247 and gacha.gg.

### Data changes to `data/codes.json`

| Change | Detail |
|---|---|
| `THKMRK` | `expired: true → false`, `expiredDate` cleared, reward `"No rewards tracked"` → `"1 x Omni-Man"` |
| `LUCAN4` | `expired: true → false`, `expiredDate` cleared |
| `THULA4` | `expired: true → false`, `expiredDate` cleared |
| `YEAR26`, `BBEAST`, `PATCH3` | Added as `expired: true` |

Totals: **51 → 54 entries; 32 → 35 active; expired stays 19** (3 moved out to active, 3 moved in from untracked).

The three added codes carry **no `reward`, `expiredDate`, or `dateAdded`** — no source publishes them, and inventing values would have been worse than leaving them absent. Only existence and expired status are recorded.

### Supporting code change

`scripts/generate-codes.js` sorted expired codes with `new Date(b.expiredDate) - new Date(a.expiredDate)`. With a missing `expiredDate`, `new Date(undefined)` yields `Invalid Date`, whose arithmetic is `NaN`, leaving `Array.sort` non-deterministic. The comparator now treats a missing date as `-Infinity` so undated codes sort last, deterministically.

### Two further defects found and fixed while verifying the rebuild

1. **The promo table was stale by exactly the three flipped codes.** It is **hand-maintained**, not marker-generated — `generate-codes.js` only owns the `GUIDE_CODES_*` regions, descriptions and counts. The table had 17 named rows + "15 more" = 32. Three hero rows (`THKMRK`, `LUCAN4`, `THULA4`) were added; it now reconciles exactly: **20 named + "15 more" = 35**.
2. **A false numeric claim in the page prose.** `guide/code/index.html` stated "The 20 active gem-only codes total 6,650 gems". The dataset actually contains **21 gem-only active codes totalling 6,900 gems**. Corrected. This error pre-dated today's changes — the three flipped codes carry `gems: 0`, so they never affected the gem-only set.

### Verification

- `npm run build` → 35 active / 19 expired, idempotency check passed
- No stale `32 active` references anywhere on the site
- Flipped codes present in the active chip region and absent from the expired region; added codes the inverse
- `npm run test:structured-data` (14 pages) and `npm run test:ads-fallback` pass

### Still open

**Finding 2** — `KREGG4`, `UPDAT3`, `BULL3T`, `RAID26`, `RAID02`, `SUMMER` are still marked active with only VG247 disputing. `KREGG4` carries an explicit reactivation decision from today and is low risk; the other five need an in-game check.

**`AALIEN` reward mismatch (new, needs a decision).** Our data: `gems: 300`, no reward. VG247, gacha.gg and MMO Culture all independently state **250 GDA Gems + 1 Allen the Alien**. Three sources agreeing against us makes our value the likely error. Not changed here because correcting it alters gem totals that feed the homepage calculator, and it would move the gem-only figures again (to 20 codes / 6,600 gems). Worth verifying before editing.

---

## 10. Systemic finding — 17 active codes carry a `gems: 300` placeholder

Fixing `AALIEN` exposed a much larger pattern. **18 active codes shared an identical `gems: 300` with no `reward` field.** The identical value across 18 unrelated codes is a default, not real data.

`AALIEN` was corrected on request (now `gems: 250`, `reward: "1 x Allen the Alien"`). **17 remain**, representing **5,100 phantom gems**:

| Code | Ours | Actual reward (VG247 + gacha.gg + MMO Culture) |
|---|---|---|
| `BANTV4` | 300 gems | 8 Hero Dossiers |
| `CONQST` | 300 gems | 1 Conquest |
| `FRATV4` | 300 gems | 4 Equipment Tickets |
| `HEHTV4` | 300 gems | 1,500 DNA Sequencers |
| `IGTTV4` | 300 gems | 200 Molecular + 20 Special Molecular |
| `INVTV4` | 300 gems | 600 GDA Gems |
| `JOTTV4` | 300 gems | 4 Equipment Tickets |
| `KABTV4` | 300 gems | 8 Hero Dossiers |
| `KIGTV4` | 300 gems | 1 Hero Dossier (all heroes) + 3 Dossiers |
| `LEXTV4` | 300 gems | 200 Molecular + 20 Special Molecular |
| `MOSTV4` | 300 gems | 1,500 DNA Sequencers |
| `NOLAN4` | 300 gems | 1 Nolan |
| `PDCAST` | 300 gems | 600 GDA Gems |
| `SAMTV4` | 300 gems | 1 Doc Seismic + 1 General Kregg |
| `SHUTV4` | 300 gems | 1 Capevincible + 1 Conquest |
| `SUBTV4` | 300 gems | 1,500 DNA Sequencers |
| `TUTTV4` | 300 gems | 600 GDA Gems |

**Two of these contradict the site's own hand-maintained table:** it lists `CONQST` as "1x Conquest" and `NOLAN4` as "1x Nolan", while `codes.json` says 300 gems and no reward. The page and its own data source disagree.

### Scope of impact — narrower than it first appears

`script.js` computes the code contribution as:

```js
const t = lastCopiedCode ? lastCopiedCode.gems || 0 : REWARDS.categories.code.total;
```

So the **headline weekly "Codes 300" tile is `REWARDS.categories.code.total`** — a fixed editorial value in `index.html`'s `rewards-config`, not a sum over `__PROMO_CODES`. **The site's headline gem figure is therefore not inflated by the placeholders.**

The real effects are per-code: when a user copies `CONQST`, the calculator adds **300 gems** instead of showing "1 Conquest", and `showCodeRewards()` displays the wrong reward. Accuracy damage, not total inflation.

### Resolution (2026-10-31) — schema extended, all 17 corrected

The 17 were corrected and the schema extended so this class of error cannot recur.

**Schema additions to `codes.json`:**

```json
{
  "code": "KIGTV4",
  "gems": 0,
  "tickets": 0,
  "rewards": [
    { "kind": "dossier", "qty": 1, "label": "Hero Dossier (all heroes)" },
    { "kind": "dossier", "qty": 3 }
  ],
  "tier": "MEDIUM",
  "dateAdded": "2026-04-01"
}
```

- **`rewards[]`** — array of `{ kind, qty }` with an optional `label`/`hero`/`gear` refinement. Controlled vocabulary in `scripts/generate-codes.js`: `hero`, `dossier`, `gold_dossier`, `equipment_ticket`, `dna_sequencer`, `molecular`, `special_molecular`, `gear_piece`.
- **`tier`** — explicit `HIGH` | `MEDIUM` for every active code, replacing inference.

**Generator changes (`scripts/generate-codes.js`):**

1. `formatReward(c)` resolves a display string from `rewards[]` → `reward` → `gems` → `tickets`.
2. **Build-time validation** throws if any active code has no reachable reward at all, or lacks a valid `tier`. Tested by injecting an empty code — build fails with `Error: active codes missing a reward: CONQST`.
   **Honest limit:** this does *not* catch a `gems: 300` placeholder, because a gem value is itself a describable reward. Tested: injecting `gems: 300` on an item code passes validation. A second, softer guard therefore lists every gem-only active code on each build (`Note: 6 active codes are gem-only (no item reward) — confirm each is intended: SAVE37(500), …`), so a future placeholder appears in build output next to the legitimate ones instead of hiding. It is a review aid, not an enforcement.
3. **The promo table is now generated** from a new `GUIDE_CODES_TABLE_START/END` marker pair instead of being hand-maintained. It previously hid all 15 placeholders behind a single false `"15 more | 300 gems each"` row — the reason the error went unnoticed. All 35 codes now render individually.
4. The emitted bundle and the `index.html` inline embed both serialize the **derived** reward.

**Correction of all 17:** 14 now carry `rewards[]` with `gems: 0`; `INVTV4`, `PDCAST`, `TUTTV4` are genuine gem codes and were set to `gems: 600`. Total gems granted by active codes is **4,250 across 9 codes** (previously overstated as 20 codes / 6,600). The page prose in `guide/code/index.html` was updated to match.

### A bug this nearly shipped

`script.js`'s reward modal branches on `e.reward` (singular). Codes modelled only with `rewards[]` therefore fell through to the gem/ticket counters and would have displayed **"0 Gems, 0 Tickets"** for 14 codes — worse than the placeholder it replaced. Caught by exercising the real modal in a browser, not by reading the code. Fixed by deriving `reward` at build time in both serializers. Verified: `CONQST` now renders "1 x Conquest" in the live modal.

### Verification

- `npm run build` idempotent across both `guide/code/index.html` and `index.html`
- 35 active / 19 expired; 0 codes on a `gems: 300` placeholder; 0 codes rendering nothing
- Generated table reconciles to 35 rows; 0 rows showing a bare "300 Gems"
- Browser-confirmed: total 4,250 gems, tier distribution HIGH 25 / MEDIUM 10
- `test:structured-data` (14 pages), `test:ads-fallback`, `test:creators` (70/70) all pass

### Follow-up worth considering

`THKMRK`, `LUCAN4` and `THULA4` are now active but carry old `dateAdded` values (2026-03-01 / 2026-04-01), so newest-first ordering buries them at positions 24, 28 and 32 of 35. `KREGG4` was handled by pinning (`position: 3`) when it was reactivated. If these three are worth surfacing, pin them the same way — that is an editorial call, not a data-accuracy fix, so it was left alone.

### Schema limitation exposed

`codes.json` models only `gems` and `tickets`. Rewards such as *8 Hero Dossiers*, *1,500 DNA Sequencers*, or *200 Molecular Enhancements* have no field. That is the root cause: the 300-gem default was likely used because there was nowhere to put the real reward. A `rewardKind`/`rewardQty` field, or a free-text `reward` used consistently, would fix the class of error rather than the instance.
