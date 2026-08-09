# skarn-llm-stack-reduction-design.md — 5-LLM Stack Reduction (Reuse Analyzer Emotion)

**Status:** Draft
**Date:** 2026-08-08
**Origin:** 2026-08-08 persona analysis, Strategic #10 — "Reduce the per-message LLM stack: reuse the analyzer's emotion output instead of a separate tone call (or cache tone per user+channel), and make condenser/postProcessor conditional on length already gated."
**Type:** Cost/latency optimization (LLM-call reduction), not a persona or content change.

---

## [S1] Problem

A substantive @mention or `/consult` fires up to **5 LLM calls** per message (report §1, verified):

1. **analyzer** (`features/preprocessing/analyzer.js`, gpt-4.1-mini, 300 tok) — now cost-gated by `shouldAnalyze` (≥50 chars or `?`, `features/preprocessing/pipeline.js`). Already emits `emotion` + `toneToMatch` (`analyzer.js:50-51`) — **consumed by nobody** (verified: only `complexityScore`/`topics`/`entities` are read by sharedPipeline/postProcessor).
2. **tone** (`features/intelligence/toneAnalyzer.js`, gpt-5.4-mini via `analyzeTone`) — fired by `updateEmotion` at `sharedPipeline.js:65` on EVERY message ≥3 chars, computing the same emotion plus `intensity`/`subtext`/`pacing`. **The redundant call.**
3. **main** chat call (gpt-5.4-mini).
4. **condenser** (gpt-4.1-mini, `features/ai/condenser.js`) — already short-circuits with zero LLM call when reply ≤ target (`condenser.js:22`).
5. **postProcessor** (gpt-4.1-mini, `features/preprocessing/postProcessor.js`) — already gated by `userMessage.length >= 50` (`memoryExtractor.js:4`).

**Latent race:** `updateEmotion` is fire-and-forget (`.catch(function(){})`, `sharedPipeline.js:65`) and runs BEFORE the analyzer, yet `buildContext` reads `getEmotionDirective` right after — so the prompt's emotional line reflects the PREVIOUS message's stored emotion, not the current one.

**Impact:** one full gpt-5.4-mini call per substantive message is pure redundancy; the analyzer already classifies emotion on the same message. Condenser/postProcessor are already optimally gated — no further work there.

## [S2] Solution overview

On analyzed messages (≥50 chars or `?`), source the emotion (plus `intensity`/`subtext`/`pacing`) from the analyzer's single existing call and skip the separate tone call — cutting the stack 5 → 4 LLM calls on the substantive path. The tone call remains as the fallback for short un-analyzed messages. The emotion write moves to AFTER the analyzer and is awaited, fixing the latent fire-and-forget race so the prompt reflects the current message's emotion.

Decisions (grilled with Anomaly, 2026-08-08):
- **Reuse analyzer emotion** — analyzed messages use the analyzer's emotion; no tone call.
- **Extend the analyzer prompt** — add `intensity`/`subtext`/`pacing` to the analyzer's JSON schema so nothing the tone call provided is lost (same single call, ~40 extra output tokens, 300-token cap retained).
- **Map at the storage boundary** — analyzer's `curious→neutral`, `frustrated→stressed`, `playful→happy`; the rest pass through. EI's six-state directive table + weights unchanged.
- **Tone as short-message fallback** — un-analyzed messages (<50 chars, no `?`) keep the existing `updateEmotion` → `analyzeTone` path; `detectEmotion` (attention gate) unchanged.
- **Move + await the emotion write** — fixes the latent race; the emotional line reflects the current message.

## [S3] Extend the analyzer prompt + parser — `features/preprocessing/analyzer.js`

Add three fields to `ANALYSIS_PROMPT`'s JSON schema (after `complexity_score`):
```
  "intensity": 0.5,
  "subtext": "string or null",
  "pacing": "calm|urgent|resigned|energetic|flat"
```
And parse them in `analyzeMessage`'s result object (with the existing defaults pattern):
```js
      intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 0,
      subtext: parsed.subtext || '',
      pacing: parsed.pacing || 'calm',
```
`max_tokens: 300` stays (the three fields add ~40 tokens to the 300-cap output; the prompt itself grows by ~2 lines of schema). `emotion`/`toneToMatch` fields remain (still emitted; `emotion` now consumed via S4, `toneToMatch` still unused but harmless). **Stale-comment cleanup (self-review finding):** `analyzer.js:63` still has `raw: messageText` with the comment `// original user message for the assembler` — the assembler is deleted (2026-08-08) and `raw` is consumed by nothing (the unified path builds `contextualMessage` from `ctx.conversationLine`). Verify with `rg -n "\.raw"` that nothing reads it, then remove the `raw` field and its stale comment.

## [S4] Emotion mapping helper + analyzed-emotion writer — `features/wisdom/emotionalIntelligence.js`

Add two exports:

```js
// Analyzer emotion vocabulary → EI six-state model (grilled Q3). EI's
// directive table + weights stay authoritative; the analyzer's extra states
// are normalized at the storage boundary.
function mapAnalyzerEmotion(analyzerEmotion) {
  var map = { curious: 'neutral', frustrated: 'stressed', playful: 'happy' };
  return map[analyzerEmotion] || analyzerEmotion || 'neutral';
}

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
Note: `applyAnalyzedEmotion` is declared `async` for signature parity with `updateEmotion` but contains no `await` — it's effectively synchronous (DB writes only). The `pacing` field is parsed but not yet consumed (available for future prompt tuning; matching the tone call's current behavior where pacing is also unused).

## [S5] Reorder + await the emotion write — `features/ai/sharedPipeline.js`

Current (lines 59-79): `storeMessage` → `updateEmotion(...).catch(...)` (fire-and-forget, BEFORE analyzer) → `runMessageAnalysis` → `buildContext` → `buildSystemPrompt`.

New order:
```js
  await storeMessage(userId, guildId, channelId, 'user', message, { threadType: threadType });

  const rel = getRelationship(userId, guildId);
  const interactionCount = rel ? rel.interaction_count : 0;

  try {
    const { runMessageAnalysis } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var analysis = await runMessageAnalysis(userId, guildId, channelId, message, 'casual');

    // Emotion write — AFTER the analyzer, awaited (grilled Q4): the prompt's
    // emotional line now reflects THIS message. Analyzed path uses the analyzer
    // result (no tone LLM call, stack 5→4); short/failed path falls back to tone.
    if (analysis) {
      await applyAnalyzedEmotion(userId, guildId, message, analysis);
    } else {
      await updateEmotion(userId, guildId, message);
    }

    const ctx = buildContext(userId, guildId, channelId, {
      roleNature: 'casual',
      userContent: message,
      interactionCount,
    });
    systemPrompt = buildSystemPrompt({ roleLine: roles[roleName] || roles.consult, ...ctx });
    contextualMessage = ctx.conversationLine
      ? `Conversation context:\n${ctx.conversationLine}\n\nCurrent message: ${message}`
      : message;
```
Remove the old `updateEmotion(userId, guildId, message).catch(function() {});` at line 65. Import `applyAnalyzedEmotion` alongside `updateEmotion` (line 23). `analysis` is `null` for short messages OR analyzer failure — both fall back to `updateEmotion` (which still catches its own errors internally). The `.catch(function(){})` is no longer needed because both branches are awaited inside the existing try — but the outer try/catch at `sharedPipeline.js:235` already handles failures, so an emotion-write throw won't break the reply (it'd hit the catch and flagForApology — verify this is acceptable: an emotion-write failure should NOT trigger the apology path; see S6).

## [S6] Error handling

- **Emotion-write failure must not trigger the apology path.** `applyAnalyzedEmotion` does DB writes (setUserEmotion/logEmotionHistory/addMemoryEntry) which can throw (e.g. `memory_entries` CHECK on a bad subtext). The outer `try/catch` in `runPipeline` (`sharedPipeline.js:235-242`) currently flags for apology on ANY error. **Fix:** wrap the emotion-write block in its own try/catch that logs and continues:
```js
    try {
      if (analysis) {
        await applyAnalyzedEmotion(userId, guildId, message, analysis);
      } else {
        await updateEmotion(userId, guildId, message);
      }
    } catch (e) { /* emotion tracking is advisory — never block the reply */ }
```
This preserves the current behavior where `updateEmotion`'s internal catch + the `.catch(function(){})` meant an emotion failure never surfaced to the reply path.
- **Analyzer failure** → `analysis` null → `updateEmotion` fallback (tone call) — unchanged behavior.
- **`pacing` unused** — parsed, stored on the result, consumed by nobody today (matches the tone call's current state where pacing is also unused). No dangling reference.
- **`toneToMatch` still unused** — unchanged from today; not part of this task.

## [S7] Testing / validation

- **Extend `scripts/smokes/08-persona-invariants.js`** with a mapping assertion (pure function, no LLM/DB):
```js
const { mapAnalyzerEmotion } = require('../../features/wisdom/emotionalIntelligence');
assert('analyzer emotion mapping: curious→neutral', mapAnalyzerEmotion('curious') === 'neutral');
assert('analyzer emotion mapping: frustrated→stressed', mapAnalyzerEmotion('frustrated') === 'stressed');
assert('analyzer emotion mapping: playful→happy', mapAnalyzerEmotion('playful') === 'happy');
assert('analyzer emotion mapping: happy passes through', mapAnalyzerEmotion('happy') === 'happy');
```
- **New smoke `scripts/smokes/13-emotion-reuse.js`** (temp DB): seed nothing; call `applyAnalyzedEmotion('u1','g1','this is a longer message that exceeds fifty characters for the smoke test here', { emotion: 'frustrated', intensity: 0.7, subtext: 'test subtext' })` and assert `getUserEmotion('u1','g1').emotional_state === 'stressed'` (mapped) and that a `tone_subtext:` memory entry exists. Also assert `mapAnalyzerEmotion('neutral') === 'neutral'`.
- **Existing smokes** must stay green: `npm run smoke` (14 suites now), `npm run audit:docs` (4/4), `npm run audit:gate` (OK — no new direct OpenAI calls; `applyAnalyzedEmotion` adds none, the tone call is REMOVED from the analyzed path).
- **Cost regression proof:** `rg -n "analyzeTone" features/ --glob '*.js'` should show it only in `emotionalIntelligence.js` (fallback path) + `toneAnalyzer.js` itself + `attentionGate.js` (detectEmotion) — NOT reachable from the analyzed branch of sharedPipeline.

## [S8] Docs updates

- **CONTEXT.md §5** (persona conventions, emotional intelligence section): update the emotion-detection description — analyzed messages source emotion from the analyzer (no separate tone call); short messages still use the tone analyzer; the write is awaited so the directive reflects the current message.
- **CONTEXT.md §10** env table: no change (no new env vars).
- **CONTEXT.md glossary** "Emotional intelligence" entry: note the analyzer-sourced path.
- **README.md**: no change (no user-facing behavior change).
- **docs/ARCHITECTURE.md**: if it describes the 5-call stack or the tone call, update to 4 calls on the analyzed path (check first — the AI Call Flow section may list tone).

## [S9] Acceptance criteria

- [ ] Analyzer emits + parses `intensity`/`subtext`/`pacing` (max_tokens still 300).
- [ ] `mapAnalyzerEmotion` maps curious→neutral, frustrated→stressed, playful→happy; else passes through; EI directive table + weights unchanged.
- [ ] `applyAnalyzedEmotion` writes setUserEmotion + logEmotionHistory + tone_subtext memory from the analyzer result (no LLM call).
- [ ] sharedPipeline: emotion write moved AFTER `runMessageAnalysis`, awaited; analyzed path → `applyAnalyzedEmotion`, null-analysis path → `updateEmotion`; emotion-write failures caught locally (no apology trigger, reply unaffected).
- [ ] `analyzeTone` reachable only via the fallback path + attention gate (not the analyzed branch).
- [ ] Smoke: mapping assertions + 13-emotion-reuse suite (mapped state + tone_subtext written); `npm run smoke` 14 suites; `audit:docs` 4/4; `audit:gate` OK.
- [ ] CONTEXT.md §5 + glossary updated.

## [S10] Out of scope / follow-ups

- The condenser/postProcessor length gates are already optimal — no change (the report's wording "make condenser/postProcessor conditional on length already gated" is satisfied by prior work).
- Per-user+channel tone cache — superseded by the reuse approach on analyzed messages; the fallback path keeps the existing 5-min identical-text cache.
- Batching the analyzer+main calls into one LLM call (a larger restructure) — not attempted; this task only removes the redundant tone call.
- `toneToMatch` / `pacing` consumption in the prompt — future tuning, not this task.
- The remaining stack is 4 calls (analyzer, main, condenser-when-over-target, postProcessor-when-long) — further reduction is a separate pass.
