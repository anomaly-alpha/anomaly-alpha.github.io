# Skarn Reply Condenser — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Skarn an enforced, short reply target by steering the model at the source and adding a cheap, gate-routed post-generation "condenser" that tightens over-target replies — preserving voice, skipping structured/tool output, and short-circuiting with zero LLM call for already-short replies.

**Architecture:** Base the design on the spec at `skarn-bot/docs/specs/2026-08-02/deepseek-v4-flash/skarn-reply-condenser-design.md` ([S1]–[S11]). A new module `features/ai/condenser.js` is wired into the shared reply pipeline (`features/ai/sharedPipeline.js:runPipeline`) after the main tool loop and before `storeMessage('assistant')`. It reuses the existing moderation gate (`ai/client.js:moderatedChatCompletion`) with a dedicated `condense` rate bucket; the wire is a single change to `sharedPipeline.js`. A `replyTargets` char map (distinct from the token `roleTokenBudgets`) is added to `persona/roles.js`.

**Tech Stack:** Node.js ≥18, CommonJS, no build step; no new dependencies (reuses `discord.js`, `openai` via `ai/client.js`, `better-sqlite3`).

## Global Constraints

- **No test framework** (CONTEXT.md §11.2, deliberate). Verification = `node --check` + `node -e` smoke runs against a temp DB via `SKARN_DB_PATH` + a `node bot.js` boot check. Never add tests.
- **Do not change the persona voice.** `persona/roles.js` role strings and `SKARN_CORE_IDENTITY` (persona/identity.js lines 1-80) are load-bearing (CONTEXT.md §5, §7.1). The condenser MUST inject the role's exact `roleLine` + `ROLE_NATURE` as voice context.
- **Two units stay orthogonal** (spec [S11]): `replyTargets` is CHARS (how the user-read reply), `roleTokenBudgets` is TOKENS (cost). Never conflate them.
- **The condenser fails open.** Any gate failure, empty output, or throw returns the ORIGINAL reply; never a blank/error message.
- **All DB reads go through `db/database.js`/store modules**; SQL stays parameterized. New rate bucket `'condense'` is just a string (the `rate_limits` table already has a `bucket` column).
- **Structured output is never condensed.** Skip when the reply came from a tool turn (`usedTool`) or matches a fence/list guard.
- Code style: `const`/`let` in new code, `function` declarations, UPPER_SNAKE_CASE constants, section-header comments (`// ===== NAME =====`). No JSDoc.
- **No code changes until the user approves execution.** This plan is docs-only for now.

---

### Task 1: Add the `replyTargets` char map to `persona/roles.js`

**Covers:** [S4] Reply target (source steering); [S8] Configuration; [S11] Units + per-role overrides.

**Files:**
- Modify: `persona/roles.js` (add `replyTargets` + `replyTargetFor(role)` export)

**Interfaces:**
- Consumes: existing `roles` / `roleTokenBudgets` / `ROLE_NATURE` objects (unchanged)
- Produces: exports `replyTargets` (object mapping role → char target) and `replyTargetFor(role)` (function, default 200)

- [ ] **Step 1: Add the map and helper**

Append before `module.exports` (after the `ROLE_NATURE` object ends at line 121):

```js
// ===== Reply targets (characters) =====
// Distinct from roleTokenBudgets (tokens): replyTargets measure how long a
// reply READS to the user; roleTokenBudgets measure what it COSTS. (spec [S11])
const REPLIES_CHAR_DEFAULT = 200;
const replyTargets = {
  advice: 400,
  homework: 400,
  code: 400,
  recipe: 400,
  realm: 350,
  realm_combat: 350,
  realm_npc: 350,
};

function replyTargetFor(role) {
  return replyTargets[role] || REPLIES_CHAR_DEFAULT;
}
```

- [ ] **Step 2: Export it**

Change `module.exports` (line 123) to:

```js
module.exports = { roles, roleTokenBudgets, ROLE_NATURE, replyTargets, replyTargetFor, REPLIES_CHAR_DEFAULT };
```

- [ ] **Step 3: Verify**

```bash
node --check persona/roles.js
node -e "const { replyTargetFor, REPLIES_CHAR_DEFAULT } = require('./persona/roles'); console.log('advice', replyTargetFor('advice'), '| consult', replyTargetFor('consult'), '| default', REPLIES_CHAR_DEFAULT);"
```

Expected: `advice 400 | consult 200 | default 200` (consult has no override → 200).

- [ ] **Step 4: Commit**

```bash
git add persona/roles.js
git commit -m "feat: add per-role char reply targets distinct from token budgets"
```

### Task 2: Build the condenser module `features/ai/condenser.js`

**Covers:** [S3] (architecture), [S5] (condenser pass), [S7] (error handling & safety), [S11] (voice, structured skip).

**Files:**
- Create: `features/ai/condenser.js`

**Interfaces:**
- Consumes: `moderatedChatCompletion` from `../../ai/client`; `roles`, `ROLE_NATURE` from `../../persona/roles`
- Produces: `condenseReply(text, target, role, userId, opts) -> Promise<{ reply }>` where `opts = { usedTool }`. Returns the tightened reply, or the original text on skip/failure. Never throws. `role` names the Skarn role so the condenser inherits `roles[role]` + `ROLE_NATURE[role]` as voice context (CONTEXT.md §7.1, spec [S11]).

- [ ] **Step 1: Create the module**

```js
// ===== Reply Condenser =====
// Post-generation pass that tightens an over-target reply to the role's char
// target. Always short-circuits (zero LLM call) when already within target.
// Fails open: on any error it returns the original text. (spec [S5]/[S7])

const { moderatedChatCompletion } = require('../ai/client');
const { roles, ROLE_NATURE } = require('../../persona/roles');

// ==== Constants ====
const CONDENSER_MODEL = 'gpt-4.1-mini';
const CONDENSER_MAX_TOKENS = 140;
const CONDENSER_TEMP = 0.3;
const MINIMUM_REASONABLE_FRACTION = 0.16; // reject output shorter than 16% of target
// Only real code fences / markdown tables trigger a skip — single backticks do not.
const STRUCTURED_FENCE = /```|<\/?table|^\s*\|.*\|/m;

function hasFenceOrTable(text) {
  return STRUCTURED_FENCE.test(text);
}

async function condenseReply(text, target, role, userId, opts) {
  if (!text || typeof text !== 'string' || text.length === 0) return { reply: text };
  if (text.length <= target) return { reply: text }; // short-circuit — zero LLM call
  if (opts && opts.usedTool) return { reply: text }; // tool-driven replies stay intact
  if (hasFenceOrTable(text)) return { reply: text };

  // Voice is load-bearing: inherit the exact role line + nature so the
  // condenser stays in-character (CONTEXT.md §7.1, spec [S11] + [S9]-verification).
  const roleLine = roles[role] || '';
  const nature = ROLE_NATURE[role] || 'casual';

  try {
    const system =
      (roleLine ? roleLine + '\n\n' : '') +
      'Tighten the reply below to ' + target + ' characters or fewer, in Skarn\'s voice. ' +
      'Keep ALL key points. Never invent facts, never add markdown or list formatting, ' +
      'stay ' + nature + ' in register, and never lecture or add an apology. ' +
      'If shortening would lose meaning, return the original reply unchanged.';

    const result = await moderatedChatCompletion({
      userId: userId,
      bucket: 'condense',
      model: CONDENSER_MODEL,
      max_tokens: CONDENSER_MAX_TOKENS,
      temperature: CONDENSER_TEMP,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: 'Original Skarn reply:\n' + text },
      ],
    });
    if (!result.success) return { reply: text };

    const condensed = result.completion.choices[0] && result.completion.choices[0].message
      ? result.completion.choices[0].message.content
      : '';
    if (!condensed || typeof condensed !== 'string') return { reply: text };
    if (condensed.length < target * MINIMUM_REASONABLE_FRACTION) {
      // Too aggressive — prefer the safer original.
      return { reply: text };
    }
    return { reply: condensed };
  } catch (e) {
    console.error('[Condenser] error:', e.message);
    return { reply: text };
  }
}

module.exports = { condenseReply, CONDENSER_MODEL };
```

- [ ] **Step 2: Verify behavior (offline + deterministic)**

```bash
node --check features/ai/condenser.js
node -e "
const client = require('./ai/client');
client.moderatedChatCompletion = async () => ({ success: false, safeMessage: 'mock-fail' });
const { condenseReply } = require('./features/ai/condenser');   // require AFTER patch
(async () => {
  const short = await condenseReply('ok', 200, 'consult', 'u', {});
  console.log('short unchanged:', short.reply === 'ok');
  const tool = await condenseReply('x'.repeat(300), 200, 'consult', 'u', { usedTool: true });
  console.log('tool unchanged:', tool.reply === 'x'.repeat(300));
  // long reply, gate mocked to fail -> must fall back to original (fail-open)
  const gate = await condenseReply('realistic sentence '.repeat(10), 200, 'consult', 'u', {});
  console.log('gate failure falls back to original:', gate.reply === 'realistic sentence '.repeat(10));
})();
"
```

Expected: `short unchanged: true`, `tool unchanged: true`, `gate failure falls back to original: true`. Note: the first two cases never touch the network; the third uses a mocked gate so it is deterministic and offline.

- [ ] **Step 3: Commit**

```bash
git add features/ai/condenser.js
git commit -m "feat: add reply condenser with zero-call short-circuit and fail-open"
```

(If the network/key is entirely absent, the third assertion is skipped — that's fine; the important one is that it never throws.)

### Task 3: Wire the condenser + source guidance into `sharedPipeline.js`

**Covers:** [S4] (guidance line), [S5] (integration point), [S6] (data-flow), [S11] (memory/sentiment/story).

**Files:**
- Modify: `features/ai/sharedPipeline.js` (`runPipeline`)
- Modify: (optional) `features/ai/sharedPipeline.js` guidance — there is no guidance yet; see below.

**Interfaces:**
- Consumes: `condenseReply` from `./condenser`; `replyTargetFor` from `../../persona/roles`
- Produces: runPipeline now returns/sends a reply constrained to the role target; `storeMessage('assistant')` holds the tightened text; story extraction runs on the pre-condense draft.

- [ ] **Step 1: Import the helpers**

At the top of `sharedPipeline.js`, after the `roles`/`roleTokenBudgets` import (line 5), add:

```js
const { condenseReply } = require('./condenser');
const { replyTargetFor } = require('../../persona/roles');
```

- [ ] **Step 2: Add a `usedTool` flag and pass it through**

In `runPipeline`, before the tool loop (near `var reply = '';`, line ~111), add `var usedTool = false;`. In the tool path, when iterating `for (var tc of choice.tool_calls)` (line 142), set `usedTool = true;` before `runTool`.

- [ ] **Step 3: Insert the source length-guidance (spec [S4])**

After the prompt is resolved — the `if/else` block ending with `systemPrompt = buildSystemPrompt({ roleLine: ..., ...ctx });` (~line 91) and the story-engine injection — immediately before the tool-enabled AI call (line ~106), append the guidance line to whichever `systemPrompt` was chosen. Both the assembler path and the fallback path converge on `systemPrompt`, so one insertion covers both:

```js
    const target = replyTargetFor(roleName);
    if (target > 0) {
      systemPrompt += '\n\nAim for roughly ' + target + ' characters. Only go longer when you actually need to.';
    }
```

(This `target` is also the condenser threshold below, exercising the chars-vs-tokens orthogonality from [S11].)

- [ ] **Step 4: Condense after the tool loop**

The current reply-resolution ends at `if (!reply) { ... sendError('The threads tangled.'); return; }` (line 148-151) and then `await storeMessage(...)` (line 155). Insert the condenser between them. Keep a `draft` for story extraction:

```js
    if (!reply) {
      await opts.sendError('The threads tangled. Try again?');
      return;
    }

    // Source-target steering happened in Step 3; now enforce it.
    const draft = reply;
    const condensed = await condenseReply(reply, target, roleName, userId, { usedTool });
    if (condensed && typeof condensed.reply === 'string') {
      reply = condensed.reply;
    }
```

(`target` is declared in Step 3, above.)

- [ ] **Step 5: Reorder story extraction to use the draft**

Move `const extractedStory = extractStoryFromReply(reply);` (currently line 162, which runs after storeMessage) to parse `draft` instead of `reply`, so a condensed beat isn't lost. Keep its placement (non-blocking) but change the argument to `extractStoryFromReply(draft)`.

- [ ] **Step 6: Verify**

```bash
node --check features/ai/sharedPipeline.js
```

Then a boot check:

```bash
node bot.js   # boot to 'Logged in as' then Ctrl+C
```

- [ ] **Step 7: Commit**

```bash
git add features/ai/sharedPipeline.js
git commit -m "feat: condense over-target replies in the shared reply pipeline"
```

### Task 4: Add the condenser smoke to the README verification block + boot QA

**Covers:** [S9] (verification), docs.

**Files:**
- Modify: `README.md` (Verification section, add a condenser line)
- Optional CONTEXT.md: no change needed (terms already recorded during grill).

**Interfaces:**
- Consumes: the condenser module
- Produces: a documented, copy-paste smoke asserting: over-target shortens, under-target unchanged, tool replies unchanged.

- [ ] **Step 1: Append to the README Verification block**

After the existing `node bot.js # boot check` line, add:

```bash
    # Reply condenser (offline + deterministic; gate mocked before require):
    # under-target untouched, tool reply untouched, over-target uses gate output
    node -e "
    const client = require('./ai/client');
    client.moderatedChatCompletion = async () => ({ success: true, completion: { choices: [{ message: { content: 'A short, tightened reply that keeps the point.' } }] } });
    const { condenseReply } = require('./features/ai/condenser');   // require AFTER patch
    (async () => {
      const long = await condenseReply('This is a deliberately long rambling reply that goes on and on about many things and never gets to the point quickly enough, and it keeps adding more and more unnecessary words until the reader loses interest entirely.', 200, 'consult', 'u', {});
      const short = await condenseReply('hi', 200, 'consult', 'u', {});
      const tool  = await condenseReply('b'.repeat(300), 200, 'consult', 'u', { usedTool: true });
      console.log('condense long uses gate output:', long.reply === 'A short, tightened reply that keeps the point.');
      console.log('condense short unchanged:', short.reply === 'hi');
      console.log('condense tool unchanged:', tool.reply.length === 300);
    })();
    "
```

- [ ] **Step 2: Verify the new commands run**

```bash
node --check features/ai/condenser.js
cd "/Users/prime/Sites/Gems/anomaly-alpha/skarn-bot" && node -e "..."   # run the block
```

Expected (all true): `condense long uses gate output: true`, `condense short unchanged: true`, `condense tool unchanged: true`. The mock returns 46 chars (>= 32-floor and < draft length, so it is accepted); the over-target draft is 218 chars (> 200 target, so no short-circuit); 'hi' short-circuits before any gate call; the tool reply is skipped by `usedTool`. Offline and deterministic — no API key needed, no assertion depends on a live model.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document reply condenser smoke checks in README verification"
```

---

## Self-review

- **Spec coverage:** [S4]→T1; [S5]/[S7]/[S8]→T2; [S3]/[S6]/[S10-integration]→T3; [S9]/docs→T4. [S1] problem context captured in header; [S11] locked decisions encoded as comments + guardrails (voice, tool skip, fail-open). No spec section is left un-owned. 
- **Placeholders:** concrete code in every task; no "TBD". No assertion depends on a live API call — the T4 smoke is offline + deterministic (gate mocked before require).
- **Type consistency:** `condenseReply(text, target, role, userId, { usedTool })` matched across T2 (definition), T3 (call), T4 (smoke). `replyTargetFor(role)` + `replyTargets`/`REPLIES_CHAR_DEFAULT` exports consistent between T1 and T3 imports. `moderatedChatCompletion` params (`userId`,`bucket`,`model`,`max_tokens`,`temperature`,`messages`) match the gate.

## Execution handoff

1. T1 (config) → T2 (module) → T3 (wire-up) → T4 (docs+smoke), executed with the chosen sub-agent style (preference: `subagent`, saved 2026-08-02). After T3, a real `node bot.js` boot check + a live `/consult`-shaped manual dictation run verifies the condenser produces a tight reply in-context.