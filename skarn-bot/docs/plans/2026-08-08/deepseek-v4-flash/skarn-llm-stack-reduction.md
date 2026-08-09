# 5-LLM Stack Reduction (Reuse Analyzer Emotion) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant gpt-5.4-mini tone call from the substantive chat path by sourcing emotion/intensity/subtext/pacing from the analyzer's existing gpt-4.1-mini call — cutting the per-message stack 5 → 4 LLM calls — and fix the latent fire-and-forget emotion race so the prompt's emotional line reflects the current message.

**Architecture:** The analyzer (`features/preprocessing/analyzer.js`) already emits `emotion` (consumed by nobody today) on every analyzed message (≥50 chars or `?`). Extend its JSON schema with `intensity`/`subtext`/`pacing` so the tone call's output richness is preserved from the existing single call. A new `mapAnalyzerEmotion()` normalizes the analyzer's vocabulary (`curious→neutral`, `frustrated→stressed`, `playful→happy`) to EI's six-state model at the storage boundary. A new `applyAnalyzedEmotion()` writes emotion + intensity + subtext with the same side effects as `updateEmotion` (setUserEmotion, logEmotionHistory, tone_subtext memory) but from the analyzer result — no LLM call. `sharedPipeline.js` moves the emotion write to AFTER `runMessageAnalysis`, awaits it, and chooses `applyAnalyzedEmotion` (analyzed) vs `updateEmotion` (short-message/analyzer-failure fallback, which keeps the tone call). Emotion-write failures are silently swallowed (never block the reply, never trigger the apology path). The tone call remains live only for the short-message fallback and the attention gate's `detectEmotion`.

**Tech Stack:** Node.js, better-sqlite3, existing OpenAI gate (`ai/client.js`). No new dependencies, no schema change, no test framework (smokes only).

## Global Constraints

- No test framework — verification is `node --check` + `npm run smoke` (smokes only, per project convention).
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`.
- Every AI call MUST go through `moderatedChatCompletion` from `ai/client.js` — `npm run audit:gate` must stay green.
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only. No JSDoc. Match each file's existing style (`var` in analyzer/sharedPipeline, `const` in emotionalIntelligence).
- Conventional commits (`feat:` / `test:` / `docs:`), one commit per task.
- Never stage `.mimocode/mimocode.json`.
- The tone LLM call (`analyzeTone`) must be reachable ONLY from the fallback path (`updateEmotion`) and the attention gate (`detectEmotion`) — NEVER from the analyzed branch of sharedPipeline.
- The analyzer's `max_tokens` stays 300.
- Emotion-write failures are silent-swallowed — never block the reply, never trigger the apology path.
- `npm run audit:docs` must stay green after every task.

---

### Task 1: Extend the analyzer prompt + parser, remove stale `raw` field

**Covers:** [S3]

**Files:**
- Modify: `features/preprocessing/analyzer.js`

**Interfaces:**
- Consumes: nothing new (same `moderatedChatCompletion` call, same 300-token cap)
- Produces: `analyzeMessage` result gains `intensity` (number 0-1), `subtext` (string), `pacing` (calm|urgent|resigned|energetic|flat) — consumed by Task 2's `applyAnalyzedEmotion`; `emotion` field stays (now consumed by Task 2); `raw` field removed

- [ ] **Step 1: Read `features/preprocessing/analyzer.js`** to confirm current `ANALYSIS_PROMPT` schema and the `analyzeMessage` parse block.

- [ ] **Step 2: Extend `ANALYSIS_PROMPT`** — add three fields to the JSON schema (after `complexity_score`), plus the subtext guidance line (grilled S1):
```
  "complexity_score": 0.5,
  "intensity": 0.5,
  "subtext": "string or null — one short sentence on what they might really feel beneath the surface, or \"\" if surface-level only",
  "pacing": "calm|urgent|resigned|energetic|flat"
```
(The guidance line mirrors the tone prompt's phrasing — no few-shot examples.)

- [ ] **Step 3: Parse the new fields** in `analyzeMessage`'s return object (with the existing defaults pattern):
```js
      intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 0,
      subtext: parsed.subtext || '',
      pacing: parsed.pacing || 'calm',
```

- [ ] **Step 4: Remove the stale `raw` field and its comment** — `analyzer.js:63` currently has `raw: messageText, // original user message for the assembler`. The assembler is deleted (2026-08-08) and nothing reads `.raw` (verified: `rg -n "\.raw\b" features/ --glob '*.js'` returns nothing). Remove the `raw` line entirely.

- [ ] **Step 5: Verify.**
```bash
node --check features/preprocessing/analyzer.js
rg -n "raw:" features/preprocessing/analyzer.js ; echo "rg exit: $? (expect 1 = gone)"
rg -n "\.raw\b" features/ --glob '*.js' ; echo "rg exit: $? (expect 1 = nothing reads it)"
SKARN_DB_PATH=$(mktemp -d)/analyzer.db node -e "var a=require('./features/preprocessing/analyzer'); console.log('analyzer loads'); console.log('has intensity in prompt:', a && typeof a === 'object')"
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; `raw` gone from the file and nothing reads `.raw`; module loads; `npm run smoke` all 13 suites pass (no analyzer-prompt consumer asserts the old field set); both audits green.

- [ ] **Step 6: Commit.**
```bash
git add skarn-bot/features/preprocessing/analyzer.js
git commit -m "feat(ai): analyzer emits intensity/subtext/pacing, drop stale raw field"
```

---

### Task 2: Add `mapAnalyzerEmotion` + `applyAnalyzedEmotion` to emotionalIntelligence.js

**Covers:** [S4]

**Files:**
- Modify: `features/wisdom/emotionalIntelligence.js`
- Modify: `scripts/smokes/08-persona-invariants.js`

**Interfaces:**
- Consumes: `EMOTION_WEIGHTS` (module-level, `emotionalIntelligence.js:5`), `analyzeSentiment` (already imported), `setUserEmotion`/`logEmotionHistory`/`addMemoryEntry` (db facade, already imported or via inline require)
- Produces: `mapAnalyzerEmotion(analyzerEmotion)` → EI six-state string; `applyAnalyzedEmotion(userId, guildId, text, analysis)` → mapped emotion (async signature, effectively synchronous) — consumed by Task 3

- [ ] **Step 1: Add `mapAnalyzerEmotion`** near the top of the emotion section (after the `EMOTION_WEIGHTS` const):
```js
// Analyzer emotion vocabulary → EI six-state model (grilled Q3). EI's
// directive table + weights stay authoritative; the analyzer's extra states
// are normalized at the storage boundary.
function mapAnalyzerEmotion(analyzerEmotion) {
  var map = { curious: 'neutral', frustrated: 'stressed', playful: 'happy' };
  return map[analyzerEmotion] || analyzerEmotion || 'neutral';
}
```

- [ ] **Step 2: Add `applyAnalyzedEmotion`** (near `updateEmotion`, mirroring its side effects exactly):
```js
// Write emotion from the analyzer result (no LLM call) — same side effects as
// updateEmotion: setUserEmotion + logEmotionHistory + tone_subtext memory.
async function applyAnalyzedEmotion(userId, guildId, text, analysis) {
  var emotion = mapAnalyzerEmotion(analysis.emotion);
  var intensity = typeof analysis.intensity === 'number' ? analysis.intensity : 0;
  var subtext = analysis.subtext || '';
  var weight = EMOTION_WEIGHTS[emotion] || 0;
  var sentiment = intensity > 0 ? intensity * weight : analyzeSentiment(text);
  setUserEmotion(userId, guildId, emotion);
  logEmotionHistory(userId, guildId, emotion, sentiment);
  if (subtext && subtext.length > 3) {
    try {
      const { addMemoryEntry } = require('../../db/database');
      addMemoryEntry(userId, guildId || 'dm', 'extracted', 'preference', 'tone_subtext: ' + subtext, 0.4, text.slice(0, 100));
    } catch (e) { /* best-effort */ }
  }
  return emotion;
}
```
Match the file's `const` style. Note: `async` but no `await` inside — signature parity with `updateEmotion`.

- [ ] **Step 3: Export both** — add `mapAnalyzerEmotion, applyAnalyzedEmotion` to `module.exports` (the file exports `detectEmotion, updateEmotion` plus the directive getters; find the export line and add both).

- [ ] **Step 4: Add mapping assertions to `scripts/smokes/08-persona-invariants.js`** (after the existing emotion assertions; it already imports from emotionalIntelligence):
```js
const { mapAnalyzerEmotion } = require('../../features/wisdom/emotionalIntelligence');
assert('analyzer emotion mapping: curious→neutral', mapAnalyzerEmotion('curious') === 'neutral');
assert('analyzer emotion mapping: frustrated→stressed', mapAnalyzerEmotion('frustrated') === 'stressed');
assert('analyzer emotion mapping: playful→happy', mapAnalyzerEmotion('playful') === 'happy');
assert('analyzer emotion mapping: happy passes through', mapAnalyzerEmotion('happy') === 'happy');
assert('analyzer emotion mapping: neutral passes through', mapAnalyzerEmotion('neutral') === 'neutral');
```

- [ ] **Step 5: Verify.**
```bash
node --check features/wisdom/emotionalIntelligence.js
node --check scripts/smokes/08-persona-invariants.js
SKARN_DB_PATH=$(mktemp -d)/ei.db node scripts/smokes/08-persona-invariants.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; smoke 08 prints the new mapping assertions `true` (plus all existing) and exits 0; `npm run smoke` all 13 suites pass; audits green. (The full 14-suite count lands after Task 4 adds smoke 13.)

- [ ] **Step 6: Commit.**
```bash
git add skarn-bot/features/wisdom/emotionalIntelligence.js skarn-bot/scripts/smokes/08-persona-invariants.js
git commit -m "feat(ai): map analyzer emotion, write emotion from analyzer result"
```

---

### Task 3: Reorder + await the emotion write in sharedPipeline.js

**Covers:** [S5], [S6]

**Files:**
- Modify: `features/ai/sharedPipeline.js`

**Interfaces:**
- Consumes: `applyAnalyzedEmotion` (Task 2), existing `updateEmotion`, `runMessageAnalysis` (already imported), `buildContext` (already imported)
- Produces: emotion written AFTER the analyzer, awaited; analyzed path → `applyAnalyzedEmotion` (no tone LLM call), null-analysis path → `updateEmotion` (tone fallback); write failures silent-swallowed

- [ ] **Step 1: Update the import** — `features/ai/sharedPipeline.js:23` currently: `const { updateEmotion } = require('../wisdom/emotionalIntelligence');` → `const { updateEmotion, applyAnalyzedEmotion } = require('../wisdom/emotionalIntelligence');`

- [ ] **Step 2: Remove the old fire-and-forget write** — delete `updateEmotion(userId, guildId, message).catch(function() {});` (currently line 65).

- [ ] **Step 3: Insert the new emotion-write block** AFTER `var analysis = await runMessageAnalysis(...)` and BEFORE `const ctx = buildContext(...)`:
```js
    // Emotion write — AFTER the analyzer, awaited (grilled Q4): the prompt's
    // emotional line now reflects THIS message. Analyzed path uses the analyzer
    // result (no tone LLM call, stack 5→4); short/failed path falls back to tone.
    // Silent-swallow (grilled S2): emotion tracking is advisory — a write failure
    // logs and continues; it must never block the reply or trigger the apology path.
    try {
      if (analysis) {
        await applyAnalyzedEmotion(userId, guildId, message, analysis);
      } else {
        await updateEmotion(userId, guildId, message);
      }
    } catch (e) { /* emotion tracking is advisory — never block the reply */ }
```
Place it after the `analysis = await runMessageAnalysis(...)` line (which already exists) and before the `buildContext` call.

- [ ] **Step 4: Verify.**
```bash
node --check features/ai/sharedPipeline.js
rg -n "updateEmotion|applyAnalyzedEmotion" features/ai/sharedPipeline.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; the `rg` shows `applyAnalyzedEmotion` in the import + the analyzed branch, `updateEmotion` in the import + the fallback branch; `npm run smoke` all 13 suites pass (existing smokes exercise the pipeline); audits green. Confirm the emotion block sits after `runMessageAnalysis` and before `buildContext` (`sed -n '68,100p' features/ai/sharedPipeline.js`).

- [ ] **Step 5: Commit.**
```bash
git add skarn-bot/features/ai/sharedPipeline.js
git commit -m "feat(ai): source emotion from analyzer, await write, fix race"
```

---

### Task 4: New smoke — emotion reuse proof

**Covers:** [S7]

**Files:**
- Create: `scripts/smokes/13-emotion-reuse.js`

**Interfaces:**
- Consumes: `applyAnalyzedEmotion`, `mapAnalyzerEmotion` (Task 2), `getUserEmotion` (db facade), temp DB
- Produces: runtime proof that the analyzed path writes the mapped emotion state + `tone_subtext` memory (no LLM — `applyAnalyzedEmotion` makes no gate calls by construction; structural proof per grilled S3)

- [ ] **Step 1: Create `scripts/smokes/13-emotion-reuse.js`** (project smoke convention — `assert(label, cond)` setting `process.exitCode = 1`; the runner auto-discovers it, making 14 suites):
```js
// ===== EMOTION REUSE (analyzer-sourced) =====
// Guards Strategic #10: analyzed messages write emotion from the analyzer
// result (no separate tone LLM call). Proves the mapped state lands in
// user_emotional_context and the tone_subtext memory entry is written.
const { getUserEmotion } = require('../../db/database');
const { mapAnalyzerEmotion, applyAnalyzedEmotion } = require('../../features/wisdom/emotionalIntelligence');

function assert(label, cond) {
  console.log(label + ':', cond);
  if (!cond) process.exitCode = 1;
}

assert('mapping: neutral passes through', mapAnalyzerEmotion('neutral') === 'neutral');
assert('mapping: frustrated→stressed', mapAnalyzerEmotion('frustrated') === 'stressed');

(async function() {
  await applyAnalyzedEmotion('u1', 'g1', 'this is a longer message that exceeds fifty characters for the smoke test here', {
    emotion: 'frustrated', intensity: 0.7, subtext: 'test subtext for the smoke', pacing: 'urgent',
  });
  const emo = getUserEmotion('u1', 'g1');
  assert('emotion written (mapped frustrated→stressed)', emo && emo.emotional_state === 'stressed');

  const { getMemoryEntries } = require('../../db/database');
  const mems = getMemoryEntries('u1', 'g1', 5);
  assert('tone_subtext memory written', mems.some(function(m) {
    return m.type === 'preference' && m.content.indexOf('tone_subtext: test subtext for the smoke') === 0;
  }));
})().catch(function(e) { console.error('smoke error:', e.message); process.exitCode = 1; });
```
(The IIFE keeps the async flow; the runner awaits the process exit. `getUserEmotion` returns the row or undefined — the `emo &&` guard covers a missing row.)

- [ ] **Step 2: Verify.**
```bash
node --check scripts/smokes/13-emotion-reuse.js
SKARN_DB_PATH=$(mktemp -d)/emotion.db node scripts/smokes/13-emotion-reuse.js
npm run smoke
npm run audit:docs
npm run audit:gate
```
Expected: syntax OK; smoke 13 prints 4× `true` and exits 0; `npm run smoke` reports `all 14 suites passed` (00-trivial … 13-emotion-reuse); audits green.

- [ ] **Step 3: Commit.**
```bash
git add skarn-bot/scripts/smokes/13-emotion-reuse.js
git commit -m "test(ai): prove emotion written from analyzer result"
```

---

### Task 5: Docs — CONTEXT.md emotion path

**Covers:** [S8]

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: the shipped functions (Task 2) + new pipeline flow (Task 3)
- Produces: CONTEXT.md §5 + glossary describe the analyzer-sourced emotion path

- [ ] **Step 1: Find the emotional-intelligence descriptions in CONTEXT.md** — §5 persona conventions (the `emotionalIntelligence` / emotion-detection text) and the glossary "Emotional intelligence" entry.

- [ ] **Step 2: Update §5** — the emotion-detection description should note: analyzed messages (≥50 chars or `?`) source emotion/intensity/subtext from the analyzer (no separate tone LLM call — Strategic #10, 2026-08-08); short messages still use the tone analyzer (`analyzeTone`); the emotion write is awaited after analysis so the prompt's directive reflects the current message.

- [ ] **Step 3: Update the glossary "Emotional intelligence" entry** — one line noting the analyzer-sourced path (emotion mapped at the boundary via `mapAnalyzerEmotion`; tone analyzer retained as the short-message fallback and for the attention gate).

- [ ] **Step 4: Verify.**
```bash
rg -n "analyzer-sourced|mapAnalyzerEmotion|Strategic #10|emotion.*analyzer" CONTEXT.md
npm run smoke
npm run audit:docs
```
Expected: CONTEXT.md mentions the analyzer-sourced emotion path; `npm run smoke` all 14 suites pass; `audit:docs` 4/4.

- [ ] **Step 5: Commit.**
```bash
git add skarn-bot/CONTEXT.md
git commit -m "docs(context): document analyzer-sourced emotion path"
```
