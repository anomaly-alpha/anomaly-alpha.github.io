# Skarn — P1-6: Resolve Doc/Code Drift (ARCHITECTURE.md, CONTEXT.md, Realm Model Claim) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the documentation into agreement with the current code on the four documented drifts the 2026-08-04 review flagged, after first **re-verifying each claim against the live tree** (docs work must never guess — every edit is gated on a grep/node check first). This plan is docs-only: zero code changes.

**Background (audit 2026-08-04, `skarn-bot/docs/reports/2026-08-04/deepseek-v4-flash-free/skarn-review.md` §3.3/§4.1/§5):** CONTEXT.md is the project's authoritative living spec (it explicitly documents drifts "inline rather than silently corrected"). The following are known drift candidates:

| # | Claim location | Claim | Reality (verified 2026-08-04) |
|---|---|---|---|
| 1 | `CONTEXT.md:444`, `docs/ARCHITECTURE.md:236,253`, realm spec | Realm `aiDriver.js` "hardcodes `model: 'gpt-5.4-mini'` and ignores the model router" | **False** — `aiDriver.js:3` imports `selectModel`, `:26` calls it (`selectModel(message)`); routes through `modelRouter.js` like everything else |
| 2 | `docs/ARCHITECTURE.md:218-220` | Advice tier "not implemented / never populated / dead surface area" | **False** — `promptContext.js:30-33` populates `socraticLine` via `getSocraticQuestion()` and promotes to full tier (live since 2026-08-01) |
| 3 | `docs/ARCHITECTURE.md:123,195` | Rate limit "10 calls per 10 minutes" | **False** — `lib/rateLimit.js:13` `RATE_LIMIT_MAX_CALLS = 50` |
| 4 | `docs/ARCHITECTURE.md:154,203,276` (+ `:194`, `:254`) | `hostileDetector.js` exists; slur-filter Gate 2 active; `isSilenced(guildId)` dropped-param bug listed; "3 strikes in 1h"; "bot-wide 10/10 limit" | **False** — `hostileDetector.js` deleted; Gate 2 deleted (CONTEXT.md §13; **Gate 3 = OpenAI moderation is retained** at `:204` — do not touch); gates.js trimmed; strikes are 3 in 10 min; limit is 50/10min |

**Also verified as NON-drift (do NOT "fix"):** `ROLE_NATURE` key alignment is **perfect** — all three registries (`roles`, `roleTokenBudgets`, `ROLE_NATURE`) share the identical **37-key** set (**not 38**; verified by node run this plan's author — see Task 4 correction). `search` and `realm_npc` are both present in `ROLE_NATURE`. The review's §11.3 note is stale — but CONTEXT.md §11.3 is itself stale (claims the keys are absent), so it gets a "resolved" callout (Task 4), not "no edit".

**Architecture:** A small `scripts/audit-docs.js` that re-verifies the drift claims statically at plan time (and can be re-run later), then targeted edits to `docs/ARCHITECTURE.md` and `CONTEXT.md`. The plan's policy: **CONTEXT.md is authoritative; ARCHITECTURE.md is a derived overview** — where they conflict, fix ARCHITECTURE.md and add a "derived overview — see CONTEXT.md" header note.

> **Independent review applied (2026-08-04):** verified against the live tree — (a) `ROLE_NATURE` counts are `37/37/37`, not 38; (b) the realm driver's context-builder is `buildRealmContext` (`aiDriver.js:7`), **not** `buildContextPrompt` — both the stale docs and this plan's original replacement text used the wrong name; (c) `docs/ARCHITECTURE.md:204` (Gate 3 = OpenAI moderation) is **retained** — only `:203` (Gate 2 DB patterns) is dead; do NOT delete the Gate-3 row; (d) two additional stale rows were found: `:194` ("3 strikes in 1h" — actually 3 in 10 min) and `:254` ("bot-wide 10/10 limit" — actually 50/10min); (e) CONTEXT.md §11.3's "search/realm_npc absent" claim is stale — both are present.

**Tech Stack:** Node.js ≥18, CommonJS. No new dependencies.

## Global Constraints

- **Docs-only.** No `.js` file changes. Every edit is gated on a re-verification step (grep or node) performed immediately before it.
- **Never rewrite history-flavored passages.** The plan fixes claims about the *current* tree; the "Resolved (2026-08-01)" callout pattern in CONTEXT.md is the house style — use it rather than deleting old notes.
- **Never add tests** (CONTEXT.md §11.2). Verification = the audit script + `node --check` on any touched markdown-adjacent tooling + a final grep diff.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Write `scripts/audit-docs.js` — the re-verification harness

**Covers:** the plan's "verify before edit" discipline; review §4.8 (make CONTEXT.md the sole living spec).

**Files:**
- Add: `scripts/audit-docs.js`

**Interfaces:**
- Consumes: file reads of `features/realm/aiDriver.js`, `features/promptContext.js`, `lib/rateLimit.js`, `features/activation/activationRegistry.js`, `persona/roles.js`, `features/safety/`
- Produces: prints PASS/FAIL per drift claim; exit non-zero on any claim that regressed (i.e. the code reverted to the documented-but-wrong behavior).

- [ ] **Step 1: Write the audit script**

```js
// ===== AUDIT: DOC/CODE DRIFT GUARD =====
// Re-verifies the four drift claims fixed by plan P1-6 (2026-08-04).
// If any PASS line flips to FAIL, the code drifted from the docs again.
const fs = require('fs');

function read(rel) { return fs.readFileSync(require('path').join(__dirname, '..', rel), 'utf8'); }
function check(label, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + label);
  if (!cond) process.exitCode = 1;
}

// 1. Realm driver routes through the model router (NOT a hardcoded model)
const aiDriver = read('features/realm/aiDriver.js');
check('realm driver uses selectModel', /selectModel\s*\(/.test(aiDriver));

// 2. Socratic/Advice tier is populated (NOT dead surface)
const promptCtx = read('features/promptContext.js');
check('socraticLine populated', /getSocraticQuestion\s*\(/.test(promptCtx) && /isFullTier\s*=\s*true/.test(promptCtx));

// 3. Rate limit ceiling is 50 (NOT 10)
const rateLimit = read('lib/rateLimit.js');
check('RATE_LIMIT_MAX_CALLS = 50', /RATE_LIMIT_MAX_CALLS\s*=\s*50/.test(rateLimit));

// 4. hostileDetector.js is gone (Gates 2-3 deleted)
const fs2 = require('fs');
check('hostileDetector.js deleted', !fs2.existsSync(require('path').join(__dirname, '..', 'features/safety/hostileDetector.js')));
const slurFilter = read('features/safety/slurFilter.js');
check('slur filter has no slur_filter table refs', !/slur_filter/.test(slurFilter.replace(/CONTEXT.md|docs\//g, '')) || true); // informational
```

> **Executor note:** Step 1 is a *harness sketch* — the four checks are the contract; tune the regexes to the real files if a check is brittle. The goal is a repeatable `npm run audit:docs` that flips FAIL if the code re-drifts (e.g. someone re-hardcodes a model or re-adds hostileDetector). Item 4's last line is intentionally loose — drop it if it produces noise.

- [ ] **Step 2: Wire `npm run audit:docs` + verify**

```json
    "audit:docs": "node scripts/audit-docs.js"
```

```bash
npm run audit:docs
```
Expected: four `PASS` lines, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-docs.js package.json
git commit -m "feat: add doc/code drift audit script"
```

### Task 2: Fix ARCHITECTURE.md (the four stale claims)

**Covers:** review §3.3/§5 drift table rows 1–4.

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Realm driver model claim** — `docs/ARCHITECTURE.md:236,253`

Change the two `hardcoded gpt-5.4-mini / ignores the model router` claims to (note: the function is `buildRealmContext`, NOT `buildContextPrompt` — the stale docs used the wrong name):

```
- **Separate AI driver** — `aiDriver.js` has its own `buildRealmContext()`, passes `bucket: 'realm'` to the central gate, uses 30-second timeouts, and routes model choice through `selectModel()` (`modelRouter.js`) like the rest of the bot (was previously documented as hardcoded `gpt-5.4-mini` — corrected 2026-08-04).
```

- [ ] **Step 2: Advice tier claim** — `docs/ARCHITECTURE.md:218-220`

Replace the "not implemented / dead surface area" paragraph with:

```
The Advice tier is implemented (2026-08-01): `buildContext()` (`features/promptContext.js:30-33`) calls `getSocraticQuestion()` (`features/wisdom/socraticEngine.js`, 18 trigger phrasings) and promotes the message to full tier. See CONTEXT.md §5 (socraticLine).
```

- [ ] **Step 3: Rate limit claims** — `docs/ARCHITECTURE.md:123,195,254`

Change the "10 calls per 10 minutes" text to "50 calls per 10 minutes (`RATE_LIMIT_MAX_CALLS`, `lib/rateLimit.js:13`)" at `:123` and `:195`, and **`docs/ARCHITECTURE.md:254`** ("bot-wide 10/10 limit") to "bot-wide 50/10-min limit".

- [ ] **Step 4: Stale safety rows** — `docs/ARCHITECTURE.md:154,194,203,276` (note: `:204` Gate 3 is RETAINED — do not delete it)

- `:154` "Hostile detector / `hostileDetector.js`" row → replace with "Hostile content | `features/safety/slurFilter.js` | 10 regex patterns, 3 strikes in 10-min window → 10-min silence (input-only; enforced centrally in `moderatedChatCompletion()`)".
- `:194` "3 strikes in 1h" → "3 strikes in 10 min (slurFilter.js `STRIKE_LIMIT=3`, 10-min window)".
- `:203` "Slur filter Gate 2 (SQLite pattern matching)" row → replace with "Slur filter Gate 1 | System prompt safety line + OpenAI moderation (fail-closed) | Gate 2 DB patterns deleted 2026-08-01 (CONTEXT.md §13)". **Keep `:204` (Gate 3 = OpenAI moderation) — it is retained and accurate.**
- `:276` drop the resolved "`isSilenced()` guildId parameter silently dropped" row (or mark it "(fixed 2026-08-01)" — prefer deletion per dead-docs hygiene).

- [ ] **Step 4b (second-pass additions) — four more stale rows:**

- `:205` "Unified strike system… extensions add **+2 min**" → drop the "+2 min per hostile message during silence" extension — it was removed as dead code (commit `5d43fca`, CONTEXT.md §13). Replace with "3 strikes in 10-min window → 10-min silence; input-only strikes; de-escalation lines are static (no AI call)".
- `:206` realm rate limit "**30 calls/30min/user (in-memory)**" → the realm bucket is **SQLite-backed** (`app_flags` + `realm_world_state` via `realmRateLimit.js`), not in-memory. Correct the label.
- `:254` "bot-wide **10/10 limit**" AND the "in-memory" Realm label in the same row → "bot-wide 50/10-min limit"; realm bucket is SQLite-backed.
- `:255` "…use in-memory Maps, **consistent with the main bot's cooldown pattern**" → the main-bot cooldowns are SQLite since 2026-08-01, so the "consistent with cooldown pattern" framing is stale. Reword to "intentionally volatile live-game sessions (combat/trade/tetris), per CONTEXT.md §2" (CONTEXT.md §2 explicitly lists these as the remaining intentional in-memory state).

> **Second-pass note:** all plan-cited line numbers verified current (no shift). The 4 additions above came from the reviewer's grep of ARCHITECTURE.md — apply them in the same commit as Step 4.

- [ ] **Step 5: Add the derived-overview header note**

At the top of `docs/ARCHITECTURE.md`, after the title:

```
> **Derived overview (2026-08-04):** this file is a high-level diagram, not the spec.
> When it disagrees with `CONTEXT.md`, CONTEXT.md wins — and file a correction here.
> Drift fixes tracked by `npm run audit:docs` (scripts/audit-docs.js).
```

- [ ] **Step 6: Verify + commit**

```bash
npm run audit:docs   # still four PASS
grep -n "gpt-5.4-mini\|not implemented\|10 calls per 10" docs/ARCHITECTURE.md   # expect: only the corrected explanatory note or nothing
git add docs/ARCHITECTURE.md
git commit -m "docs: fix ARCHITECTURE.md drift (realm model, advice tier, rate limit, safety gates)"
```

### Task 3: Fix CONTEXT.md Realm-model claim

**Covers:** review §4.1 (resolve the Realm-driver model question).

**Files:**
- Modify: `CONTEXT.md`

- [ ] **Step 1: Fix `CONTEXT.md:444`**

Replace "hardcodes `model: 'gpt-5.4-mini'`, and ignores the model router" with:

"routes model choice through `selectModel()` (`modelRouter.js`; documented earlier as hardcoding `gpt-5.4-mini` — corrected 2026-08-04, see `docs/specs/2026-07-18/deepseek-v4-flash/realm-of-skarn-final.md` for the original intent)."

- [ ] **Step 2: Verify + commit**

```bash
grep -n "gpt-5.4-mini" CONTEXT.md   # expect: only the corrected note
git add CONTEXT.md
git commit -m "docs: correct realm AI driver model claim in CONTEXT.md"
```

### Task 4: Add the drift record to CONTEXT.md (including the §11.3 ROLE_NATURE correction)

**Covers:** the plan's "single living spec" policy; corrects CONTEXT.md's own stale §11.3.

- [ ] **Step 1: Add the 2026-08-04 resolution callout** to the §2 or §5 drift callout if missing:

```
> **Resolved (2026-08-04):** ARCHITECTURE.md's stale claims (realm hardcoded model, Advice tier dead, 10/10 rate limit, hostileDetector + slur Gate 2) were corrected; `npm run audit:docs` (scripts/audit-docs.js) now guards them. ROLE_NATURE key alignment verified clean — 37/37/37 keys, `search` + `realm_npc` present.
```

- [ ] **Step 2: Fix CONTEXT.md §11.3 AND §5:79 (both stale)** — the lines claiming `search`/`realm_npc` are absent from `ROLE_NATURE` contradict the code (both present; §5:79 repeats the same stale claim the reviewer found). Mark both resolved rather than deleting:

```
3. **`ROLE_NATURE` duplication — three files historically, now partially fixed** — ... **Resolved 2026-08-04:** all three registries share the identical 37-key set; `search` and `realm_npc` are present in `ROLE_NATURE`. No guard yet prevents future drift (a startup assertion is a suggested follow-up).
```

And in §5, the `ROLE_NATURE` duplication bullet: append "**Resolved 2026-08-04:** `search` + `realm_npc` confirmed present in `ROLE_NATURE` — 37/37/37 keys aligned (see §11.3)."

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: record 2026-08-04 doc-drift resolution + audit guard; fix §11.3"
```

---

## Self-review

- **Spec coverage:** Review §3.3 (drift) → T2/T3; §4.1 (Realm model question) → T3; §4.8 (CONTEXT.md as sole spec) → T2 Step 5 + T4. All drift rows owned.
- **Independent review applied (2026-08-04):** ROLE_NATURE is **37/37/37** (not 38); realm driver context-builder is `buildRealmContext` (not `buildContextPrompt` — fixed in both the docs and this plan's replacement text); ARCH:204 (Gate 3) is retained (only Gate 2 was deleted); two extra stale rows added (`:194` 1h→10min, `:254` 10/10→50/10); CONTEXT §11.3 marked resolved (its "absent" claim is stale). Every edit in T2/T3 is gated on a re-verification command in the same task.
- **Second-pass review applied (2026-08-04):** all plan-cited ARCHITECTURE.md line numbers verified current (no shift); the audit-docs.js regexes match the real code (incl. `isFullTier = true` at `promptContext.js:32`). **Four more stale rows added to Task 2 Step 4b:** `:205` (removed "+2 min" strike extension), `:206` + `:254` (realm bucket is SQLite-backed via `app_flags`/`realm_world_state`, not "in-memory"), `:255` (main-bot cooldown-pattern framing stale — reworded per CONTEXT.md §2). **CONTEXT.md §5:79** (duplicate of the §11.3 stale ROLE_NATURE claim) added to Task 4.
- **Honest scope:** this is docs-only; it deliberately does NOT change the realm driver (that's a code decision for later, if the original hardcoded-model intent is wanted back — see the spec reference in T3 Step 1).

## Execution handoff

1. T1 (audit script) → T2 (ARCHITECTURE.md) → T3 (CONTEXT.md) → T4 (drift record). Execute with `subagent` style.
2. Acceptance: `npm run audit:docs` four PASS + exit 0; greps show no residual stale claims; `git log` shows 4 docs commits. Record any file:line offsets that shifted between plan-writing and execution (the executor must re-grep each target line before editing).