# writeEmotionState Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated 12-line emotion-write block shared by `updateEmotion()` and `applyAnalyzedEmotion()` in `features/wisdom/emotionalIntelligence.js` into a single `writeEmotionState()` helper — the review-deferred refactor (Task 2 quality review, Minor #5: "extract a small writeEmotionState helper as a follow-up when Task 3 lands"). Pure refactor: **zero behavior change** — every existing smoke must stay green.

**Architecture:** The block is byte-identical in both functions (verified `emotionalIntelligence.js:38-49` vs `:62-73`): compute `weight` from `EMOTION_WEIGHTS`, compute `sentiment` (`intensity > 0 ? intensity * weight : analyzeSentiment(text)`), `setUserEmotion`, `logEmotionHistory`, then the best-effort `tone_subtext` memory write (with a lazy `addMemoryEntry` require). The helper takes the **inputs** (`emotion`, `intensity`, `subtext`, `text`) and computes `weight`/`sentiment` internally — so the sentiment *formula* lives in one place too, not just the DB calls (this is the drift-risk the reviewer flagged). Signature: `writeEmotionState(userId, guildId, emotion, intensity, subtext, text)`.

**Tech Stack:** Node.js, existing better-sqlite3 facade (`db/database.js`). No new dependencies, no schema change, no test framework (smokes only). Single file + one smoke-adjacent check.

## Global Constraints

- No test framework — verification is `node --check` + `npm run smoke` (smokes only, per project convention).
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`.
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only. No JSDoc. Match the file's `const`/`let` style (this file mixes `var` in legacy directive bodies; new code uses `const`).
- Conventional commits (`refactor:` here), one commit per task.
- Never stage `.mimocode/mimocode.json`.
- **Zero behavior change** — the refactor must be indistinguishable to every caller and every smoke.
- `npm run smoke` (14 suites) and `npm run audit:docs` (4/4) must stay green.

---

### Task 1: Extract `writeEmotionState` in emotionalIntelligence.js

**Covers:** the entire refactor (single task — the change is one file, one helper, two call sites).

**Files:**
- Modify: `features/wisdom/emotionalIntelligence.js`

**Interfaces:**
- Consumes: `EMOTION_WEIGHTS` (module-level, line 5), `analyzeSentiment` (line 1), `setUserEmotion`/`logEmotionHistory` (line 2), `addMemoryEntry` (promote the lazy require from inside the block to the top-level line-2 require)
- Produces: `writeEmotionState(userId, guildId, emotion, intensity, subtext, text)` — module-private (NOT exported; no external caller exists); `updateEmotion` and `applyAnalyzedEmotion` both delegate to it

- [ ] **Step 1: Promote `addMemoryEntry` to the top-level require** — line 2 currently:
```js
const { getUserEmotion, setUserEmotion, logEmotionHistory, getEmotionTrend, getMemoryEntries, getSentimentTrend, getServerClimate } = require('../../db/database');
```
→ add `addMemoryEntry` to the destructure. (The lazy `const { addMemoryEntry } = require('../../db/database');` inside both functions' blocks is then removed — the facade is already loaded at module top, so hoisting it is safe and matches the file's other top-level requires.)

- [ ] **Step 2: Add the `writeEmotionState` helper** — place it AFTER `applyAnalyzedEmotion` (line 76) and BEFORE the `// ===== [1] Emotional Trajectory =====` section header (line 78):
```js
// Shared emotion-write block (setUserEmotion + logEmotionHistory + best-effort
// tone_subtext memory). Extracted 2026-08-08 from updateEmotion/applyAnalyzedEmotion
// so the sentiment formula and memory args live in exactly one place.
function writeEmotionState(userId, guildId, emotion, intensity, subtext, text) {
  const weight = EMOTION_WEIGHTS[emotion] || 0;
  const sentiment = intensity > 0 ? intensity * weight : analyzeSentiment(text);
  setUserEmotion(userId, guildId, emotion);
  logEmotionHistory(userId, guildId, emotion, sentiment);

  // Store subtext in memory if non-empty (so Skarn can reference it later)
  if (subtext && subtext.length > 3) {
    try {
      addMemoryEntry(userId, guildId || 'dm', 'extracted', 'preference', 'tone_subtext: ' + subtext, 0.4, text.slice(0, 100));
    } catch (e) { /* best-effort */ }
  }

  return emotion;
}
```
(Plain synchronous function — no `async` needed since it contains no `await`; the callers remain `async` and simply call it. The `tone_subtext` args are byte-identical to the current blocks: type `'preference'`, source `'extracted'`, confidence 0.4, content slice 100, `guildId || 'dm'`.)

- [ ] **Step 3: Rewrite `updateEmotion`** (lines 38-49) to delegate. Replace the `const weight = ...; const sentiment = ...; setUserEmotion(...); logEmotionHistory(...); if (subtext ...) { ... }` block with:
```js
  return writeEmotionState(userId, guildId, emotion, intensity, subtext, text);
```
(The function's `try/catch` around `analyzeTone` stays; the `return emotion` becomes `return writeEmotionState(...)` — the helper returns `emotion`.)

- [ ] **Step 4: Rewrite `applyAnalyzedEmotion`** (lines 62-73) to delegate. Replace the same block (after the `const subtext = ...` line) with:
```js
  return writeEmotionState(userId, guildId, emotion, intensity, subtext, text);
```
(The function keeps its `if (!analysis) return 'neutral'` guard and the `mapAnalyzerEmotion`/`intensity`/`subtext` derivation; the `weight`/`sentiment`/DB-write block is replaced by the delegation. `return emotion;` at the end becomes the delegation return — the helper returns `emotion`.)

- [ ] **Step 5: Verify.**
```bash
node --check features/wisdom/emotionalIntelligence.js
rg -n "writeEmotionState" features/wisdom/emotionalIntelligence.js
SKARN_DB_PATH=$(mktemp -d)/ei.db node scripts/smokes/08-persona-invariants.js
SKARN_DB_PATH=$(mktemp -d)/emotion.db node scripts/smokes/13-emotion-reuse.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; `writeEmotionState` defined once + called twice (updateEmotion + applyAnalyzedEmotion); smoke 08 (18 assertions incl. mapping) and smoke 13 (4 assertions — mapped state + tone_subtext write) both pass standalone; `npm run smoke` all 14 suites pass; audits green. **Behavioral equivalence proof:** smoke 13 exercises `applyAnalyzedEmotion` → now delegates to `writeEmotionState` → its assertions (emotional_state === 'stressed' + tone_subtext memory row) must still pass, proving the extracted block writes identically.

- [ ] **Step 6: Commit.**
```bash
git add skarn-bot/features/wisdom/emotionalIntelligence.js
git commit -m "refactor(ai): extract shared writeEmotionState helper"
```

---

## Out of scope

- Exports: `writeEmotionState` stays module-private — no caller outside this file exists.
- No other deduplication: `detectEmotion`'s tiny `analyzeTone` wrapper is a different concern (different return shape) — untouched.
- Docs: no CONTEXT.md/README change (no behavior or interface change — the export surface is unchanged).
- The `tone_subtext` schema/type/confidence constants stay as-is (changing them would be a behavior change, out of scope).
