# Unify Prompt Assembly Path + Model Default Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the thin `assembler.js`/`retriever.js` prompt path so every live conversational path builds its system prompt through `buildSystemPrompt()` fed by `buildContext()`, fix the model default (`gpt-3.5-turbo` → `gpt-5.4-mini`), and clean up the dead code the 2026-08-08 persona analysis flagged.

**Architecture:** The primary path (`features/ai/sharedPipeline.js`) currently prefers the thin `assembler.js` result (8 lines, no `SKARN_RULES`/`safetyLine`/untrusted-wrapping) and only uses the full `buildContext()`+`buildSystemPrompt()` bundle as a fallback. Per the spec's confirmed root cause, this is drift, not design. We remove the branch so `buildContext()` → `buildSystemPrompt()` is the single prompt source; the analyzer (`analyzer.js`) survives only to feed model routing (`selectModel`) and memory-extraction enrichment (`extractMemory`) — never prompt content. The old 3-stage `preprocessing/pipeline.js` is trimmed to an analyzer-only `runMessageAnalysis()` with an explicit cost gate mirroring `isFullTier` (promptContext.js:28) so short/banter messages skip the analyzer call entirely.

**Tech Stack:** Node.js, better-sqlite3, OpenAI via `ai/client.js` gate. No new dependencies, no schema change, no test framework (smokes only, per project convention).

## Global Constraints

- No test framework — verification is `node --check` + `npm run smoke` (smokes only, per project convention).
- Node cwd is `skarn-bot/` for every command; git root is the repo root with `skarn-bot/`-prefixed commit paths.
- Every DB-touching smoke MUST set `SKARN_DB_PATH=$(mktemp -d)/<name>.db` — never the live `data/skarn.db`. `npm run smoke` handles this per-suite.
- Every AI call MUST go through `moderatedChatCompletion` from `ai/client.js` — do not touch the raw OpenAI client (audit: `npm run audit:gate` must stay green).
- JS conventions: `function` declarations, camelCase, UPPER_SNAKE_CASE constants, section-header comments only. No JSDoc.
- Conventional commits (`fix:` / `feat:` / `docs:` / `test:`), one commit per task.
- Never stage `.mimocode/mimocode.json`.
- The analyzer's output must NEVER flow into the system prompt — it feeds `selectModel` (complexity score) and `extractMemory` (topics/entities hints) only. `buildContext()` + `buildSystemPrompt()` is the single prompt source.
- `npm run audit:docs` (scripts/audit-docs.js) must stay green after every task.

---

### Task 1: Unify the primary prompt path (retire the thin assembly path)

**Covers:** [5.1], [5.2], [5.5]

**Files:**
- Modify: `features/ai/sharedPipeline.js`
- Modify: `features/preprocessing/pipeline.js`
- Delete: `features/preprocessing/assembler.js`
- Delete: `features/preprocessing/retriever.js`

**Interfaces:**
- Consumes: `buildContext` (`features/promptContext.js`), `buildSystemPrompt` (`persona/identity.js`), `analyzeMessage` (`features/preprocessing/analyzer.js`), `selectModel`/`checkKnowledgeMatch` (`features/intelligence/modelRouter.js`), `extractMemory` (`features/memory/memoryExtractor.js`)
- Produces: `runMessageAnalysis(userId, guildId, channelId, messageText, roleNature)` from `features/preprocessing/pipeline.js` — returns the analysis object or `null`; sharedPipeline.js no longer references `assembler`/`retriever` or a "preprocessing pipeline result"

- [ ] **Step 1: Trim `features/preprocessing/pipeline.js` to analyzer-only with the cost gate.** Replace the entire file content:
```js
// ===== Message Analysis for Routing =====
// Former 3-stage pipeline (analyzer → retriever → assembler) trimmed to the
// analyzer step only. The analyzer's output informs model routing and memory
// extraction — it never feeds prompt assembly (buildContext/buildSystemPrompt
// are the single prompt source). The cost gate mirrors isFullTier
// (promptContext.js:28) so short/banter messages skip the analyzer call.
var { analyzeMessage } = require('./analyzer');

function shouldAnalyze(messageText) {
  return messageText && (messageText.length >= 50 || messageText.indexOf('?') !== -1);
}

async function runMessageAnalysis(userId, guildId, channelId, messageText, roleNature) {
  if (!shouldAnalyze(messageText)) return null;
  var analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  if (!analysis) {
    // One retry with 100ms backoff
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
    analysis = await analyzeMessage(userId, guildId, channelId, messageText, roleNature);
  }
  return analysis || null;
}

module.exports = { runMessageAnalysis, shouldAnalyze };
```

- [ ] **Step 2: Rewire `features/ai/sharedPipeline.js`.** Replace the preprocessing block (currently lines 68-92) — the `var pipelineResult;` declaration and the `runPreprocessing(...)` + branch — with:
```js
    const { runMessageAnalysis } = require('../preprocessing/pipeline');

    var systemPrompt;
    var contextualMessage;
    var analysis = await runMessageAnalysis(userId, guildId, channelId, message, 'casual');

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
(Keep `var pipelineResult` removed entirely — it no longer exists. Do NOT move the `runMessageAnalysis` require to the top of the file; the inline-require pattern is already used at that spot and keeps the diff minimal.)

- [ ] **Step 3: Update the two downstream analyzer consumers in sharedPipeline.js.**
  - Line ~126 (`selectModel` call): `model: selectModel(message, hasKnowledgeMatch, pipelineResult ? pipelineResult.analysis.complexityScore : undefined)` → `model: selectModel(message, hasKnowledgeMatch, analysis ? analysis.complexityScore : undefined)`
  - Line ~234 (`extractMemory` call): `extractMemory(userId, guildId, message, reply, pipelineResult ? pipelineResult.analysis : null)` → `extractMemory(userId, guildId, message, reply, analysis)`

- [ ] **Step 4: Delete the thin-path files.**
```bash
git rm features/preprocessing/assembler.js features/preprocessing/retriever.js
```

- [ ] **Step 5: Verify.** From `skarn-bot/`:
```bash
node --check features/preprocessing/pipeline.js
node --check features/ai/sharedPipeline.js
SKARN_DB_PATH=$(mktemp -d)/boot.db node -e "require('./features/preprocessing/pipeline'); console.log('pipeline loads')"
SKARN_DB_PATH=$(mktemp -d)/gate.db node -e "var p=require('./features/preprocessing/pipeline'); console.log('gate short:', p.shouldAnalyze('hey whats up'), '| gate long:', p.shouldAnalyze('i cant decide between two jobs, what would you advise?'))"
npm run audit:gate
npm run audit:docs
npm run smoke
```
Expected: `pipeline loads`; `gate short: false | gate long: true`; both audits OK; all 10 smoke suites PASS.
Also confirm no surviving *references* to the deleted modules: `rg -n "assembler|retriever" features/ai/sharedPipeline.js` must return nothing (the new `pipeline.js` comment intentionally mentions the retired stages — that's fine); `git status` must show the two deletions staged.

- [ ] **Step 6: Commit.**
```bash
git add skarn-bot/features/preprocessing/pipeline.js skarn-bot/features/preprocessing/assembler.js skarn-bot/features/preprocessing/retriever.js skarn-bot/features/ai/sharedPipeline.js
git commit -m "fix(ai): unify prompt assembly on buildSystemPrompt, retire thin path"
```
Commit path prefix is `skarn-bot/` — stage with `git -C <repo-root>` semantics (paths relative to repo root).

---

### Task 2: Persona guardrail smoke — primary-path regression test

**Covers:** [5.3], [7.1], [7.3]

**Files:**
- Modify: `scripts/smokes/08-persona-invariants.js`

**Interfaces:**
- Consumes: `buildContext` (`features/promptContext.js`), `buildSystemPrompt` (`persona/identity.js`), `roles` (`persona/roles.js`), the seeded temp DB (schema auto-created on `db/database` require)
- Produces: smoke assertions proving a primary-path prompt (built exactly as sharedPipeline now builds it) contains `SKARN_RULES`, `safetyLine`, `<untrusted_data>` wrapping, and a wisdom-layer line (`socraticLine`) when triggered

- [ ] **Step 1: Append to `scripts/smokes/08-persona-invariants.js`** (keep all existing assertions; add after the existing philosopher-name check):
```js
// ===== PRIMARY-PATH PROMPT GUARDRAILS (regression for the 2026-08-08 drift) =====
// sharedPipeline.js now ALWAYS builds the prompt via buildContext + buildSystemPrompt.
// Replicate that exact construction here and assert the guardrails that the old
// thin assembler path silently dropped: SKARN_RULES, safetyLine, untrusted-data
// wrapping, and at least one wisdom-layer line.
const { buildContext } = require('../../features/promptContext');
const { roles } = require('../../persona/roles');

// A ≥50-char message with a socratic trigger: passes the analyzer gate (Task 1)
// and promotes to full tier via getSocraticQuestion (promptContext.js:30-33).
const socraticMsg = 'i cant decide between two jobs, what would you advise?';
const ctx = buildContext('uPrimary', 'gPrimary', 'cPrimary', {
  roleNature: 'casual',
  userContent: socraticMsg,
  interactionCount: 0,
});
const primaryPrompt = buildSystemPrompt({ roleLine: roles.consult, ...ctx });

assert('primary path prompt includes SKARN_RULES', primaryPrompt.includes('Discord TOS compliance'));
assert('primary path prompt includes safetyLine', !!ctx.safetyLine && primaryPrompt.includes(ctx.safetyLine));
assert('primary path prompt includes untrusted_data wrapping', primaryPrompt.includes('<untrusted_data>'));
assert('primary path prompt includes socratic wisdom line', !!ctx.socraticLine && primaryPrompt.includes(ctx.socraticLine));
assert('primary path prompt ends with SKARN_FOOTER', primaryPrompt.trim().endsWith('That\'s why you\'re here.'));
```
Note: `buildContext` reads many DB-backed getters against the fresh temp DB. All of them must tolerate empty tables (the fallback path has always run against real fresh-guild DBs). If any getter throws on the empty temp DB, seed the minimal rows it needs (e.g. `user_relationship`, `guild_mood`) the same way the existing assertions already seed `user_relationship`.

- [ ] **Step 2: Run the suite.** From `skarn-bot/`:
```bash
npm run smoke
```
Expected: `[smoke] PASS 08-persona-invariants.js` and all other suites pass. If `buildContext` throws on the empty DB, fix by seeding (see Step 1 note) — do not weaken the assertions.

- [ ] **Step 3: Commit.**
```bash
git add skarn-bot/scripts/smokes/08-persona-invariants.js
git commit -m "test(persona): assert guardrails on primary-path prompt"
```

---

### Task 3: Dead code cleanup + wire formatKnowledge

**Covers:** [5.4] (+ Anomaly decision: wire `formatKnowledge` in)

**Files:**
- Modify: `features/promptContext.js`
- Modify: `features/intelligence/knowledgeGraph.js`
- Modify: `db/conversation.js`
- Delete: `features/conversation/contextAssembler.js`

**Interfaces:**
- Consumes: `formatKnowledge` (`features/intelligence/knowledgeGraph.js`) — reads `getMemoryByType` (`db/database` facade)
- Produces: `knowledgeLine` now includes extracted projects/events (not just interests); `getRecentMessages` removed from the `db/database` facade surface; `contextAssembler.js` gone

- [ ] **Step 1: Wire `formatKnowledge` into `features/promptContext.js`.** Add the import at the top (with the other requires):
```js
const { formatKnowledge } = require('./intelligence/knowledgeGraph');
```
Replace the `extractedEntries`/`knowledgeLine` block (currently lines 43-46):
```js
  const factEntries = memory.filter(function(m) { return m.source === 'etch'; });
  const memoryLine = factEntries.length > 0 ? 'What Skarn remembers about this person: ' + factEntries.map(function(m) { return m.content; }).join('; ') : '';
  const knowledgeLine = formatKnowledge(userId, guildId);
```
(`const memory = getMemoryEntries(...)` and `factEntries` stay — only `extractedEntries` and the inline interest-only `knowledgeLine` are replaced. `formatKnowledge` returns `''` when nothing is stored, matching the old empty-string contract.)

- [ ] **Step 2: Trim `features/intelligence/knowledgeGraph.js`.** Delete `runKnowledgeDecay()` (zero callers; the scheduler calls `decayMemoryEntries()` directly at `features/scheduler/index.js:68`) and update the export:
```js
module.exports = { formatKnowledge };
```
Keep `formatKnowledge` as-is — its `getMemoryByType` reads already work through the facade.

- [ ] **Step 3: Delete `getRecentMessages` from `db/conversation.js`.** Remove the function (lines 66-74) and its export entry (line 240). Nothing else references it (verified: definition + export only; the facade `db/database.js` Object.assigns the conversation module, so removing the export automatically removes it from the facade).

- [ ] **Step 4: Delete the deprecated shim.**
```bash
git rm features/conversation/contextAssembler.js
```

- [ ] **Step 5: Verify.** From `skarn-bot/`:
```bash
node --check features/promptContext.js
node --check features/intelligence/knowledgeGraph.js
node --check db/conversation.js
SKARN_DB_PATH=$(mktemp -d)/cleanup.db node -e "
var { db } = require('./db/database');
var { addMemoryEntry } = require('./db/database');
addMemoryEntry('u1','g1','extracted','interest','chess',0.6,null);
addMemoryEntry('u1','g1','extracted','project','build a game',0.7,'mentioned');
var { buildContext } = require('./features/promptContext');
var ctx = buildContext('u1','g1','c1',{roleNature:'casual',userContent:'tell me about chess and my game',interactionCount:0});
console.log('knowledgeLine:', JSON.stringify(ctx.knowledgeLine));
if (!ctx.knowledgeLine.includes('build a game')) { console.error('FAIL: project missing'); process.exit(1); }
console.log('OK: projects surface in knowledgeLine');
"
rg -n "getRecentMessages|contextAssembler|runKnowledgeDecay" --glob '*.js' . ; echo "rg exit: $?"
npm run smoke
```
Expected: `knowledgeLine` contains `build a game`; `rg` finds only the `runMessageAnalysis`-adjacent matches or nothing (exit 1 with no lines = clean); all smoke suites PASS.

- [ ] **Step 6: Commit.**
```bash
git add skarn-bot/features/promptContext.js skarn-bot/features/intelligence/knowledgeGraph.js skarn-bot/db/conversation.js skarn-bot/features/conversation/contextAssembler.js
git commit -m "fix(ai): wire formatKnowledge into context, delete dead code"
```

---

### Task 4: Model default upgrade

**Covers:** [6.1], [6.2]

**Files:**
- Modify: `features/intelligence/modelRouter.js`

**Interfaces:**
- Consumes: `process.env.AI_MODEL` / `process.env.AI_MODEL_COMPLEX` (unchanged)
- Produces: code-level fallback default `gpt-5.4-mini` (was `gpt-3.5-turbo`) at all four return sites; `AI_MODEL_COMPLEX` still falls back to `AI_MODEL` when unset

- [ ] **Step 1: Replace all four `'gpt-3.5-turbo'` literals in `features/intelligence/modelRouter.js` (lines 4, 7, 11, 13) with `'gpt-5.4-mini'`.** The function keeps its exact shape:
```js
function selectModel(userMessage, hasKnowledgeMatch, complexityScore) {
  if (hasKnowledgeMatch) return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-5.4-mini';
  if (userMessage && userMessage.length > 100 &&
      (userMessage.includes('?') || userMessage.toLowerCase().includes('explain'))) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-5.4-mini';
  }
  if (typeof complexityScore === 'number' && complexityScore > 0.7) {
    return process.env.AI_MODEL_COMPLEX || process.env.AI_MODEL || 'gpt-5.4-mini';
  }
  return process.env.AI_MODEL || 'gpt-5.4-mini';
}
```
Do NOT change the `AI_MODEL_COMPLEX` tiering strategy (spec 6.2 second half) — that's an open follow-up, not blocking this spec.

- [ ] **Step 2: Verify.**
```bash
node --check features/intelligence/modelRouter.js
node -e "var m=require('./features/intelligence/modelRouter'); delete process.env.AI_MODEL; delete process.env.AI_MODEL_COMPLEX; var a=m.selectModel('hi',false,0.2); var b=m.selectModel('x',true,0.2); console.log('default:',a,'| complex:',b); if(a!=='gpt-5.4-mini'||b!=='gpt-5.4-mini'){process.exit(1)} console.log('OK')"
npm run smoke
```
Expected: `default: gpt-5.4-mini | complex: gpt-5.4-mini` then `OK`; all smoke suites PASS.

- [ ] **Step 3: Commit.**
```bash
git add skarn-bot/features/intelligence/modelRouter.js
git commit -m "fix(models): default AI_MODEL to gpt-5.4-mini"
```

---

### Task 5: Sync CONTEXT.md with the unified architecture

**Covers:** [docs updates per lifecycle convention]

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: the state of Tasks 1-4 (files deleted, exports changed, default model updated)
- Produces: CONTEXT.md accurately reflects the single prompt-assembly path, the wired `formatKnowledge`, the removed exports, and the new model default

- [ ] **Step 1: Update the stale claims in `CONTEXT.md`.**
  1. §10 env-variable table, `AI_MODEL` row: `Default` column `gpt-3.5-turbo` → `gpt-5.4-mini`.
  2. §6.1 conversation-graph row: remove `; getRecentMessages now has zero callers` and replace with `; getRecentMessages removed 2026-08-08 (dead)`.
  3. §6.2 / §9: the `decayKnowledge()` historical note is fine as history — do NOT rewrite it, but add a one-line note near §6.2 or the memory-systems section: `> **Resolved (2026-08-08):** the thin prompt-assembly path (assembler.js/retriever.js) was retired — buildContext()+buildSystemPrompt() is the single prompt source for every live conversational path; formatKnowledge is wired into promptContext.js so extracted projects/events reach context; AI_MODEL code default is gpt-5.4-mini.` (Pick the closest existing section; do not create a new top-level section.)
  4. §5 persona section: confirm no claim says the assembler path is primary — if any, update it.

- [ ] **Step 2: Verify.**
```bash
node --check 2>/dev/null; rg -n "gpt-3.5-turbo|getRecentMessages now has zero callers" CONTEXT.md ; echo "rg exit: $?"
npm run audit:docs
npm run smoke
```
Expected: `rg` finds no stale strings (exit 1, no lines); `audit:docs` PASSes all 4 checks; smokes pass.

- [ ] **Step 3: Commit.**
```bash
git add skarn-bot/CONTEXT.md
git commit -m "docs(context): record unified prompt-assembly path and model default"
```
