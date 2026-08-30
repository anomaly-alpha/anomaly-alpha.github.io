# Skarn Persona Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 8 identified gaps in the Skarn persona — 6 prompt edits, 1 new context function, 1 dead code removal.

**Architecture:** All prompt edits go into `SKARN_CORE_IDENTITY` in `persona/identity.js`. The one new code addition is `getIntentDirective()` in `features/wisdom/emotionalIntelligence.js`, wired through `features/promptContext.js` and `persona/identity.js`. No database changes, no new dependencies.

**Tech Stack:** JavaScript (Node.js), SQLite (better-sqlite3), existing codebase patterns.

## Global Constraints

- No database schema changes
- No new npm dependencies
- All new functions must follow existing code style (var/const, try/catch for best-effort, no arrow functions in new code)
- `getIntentDirective()` must make zero LLM calls — pure keyword/structural analysis
- `intentLine` is NOT wrapped in `untrusted()` (bot-authored directive text)
- Existing smoke suite must pass after all changes (`npm run smoke`)
- Documentation audit must pass (`npm run audit:docs`)

---

### Task 1: High-impact prompt edits (anti-forced-depth + lightheartedness)

**Covers:** [S3], [S4]

**Files:**
- Modify: `persona/identity.js:12` (Voice section), `persona/identity.js:71` (Anti-drift guardrails)

**Interfaces:**
- Consumes: existing `SKARN_CORE_IDENTITY` template literal
- Produces: modified `SKARN_CORE_IDENTITY` with 2 new bullets

- [ ] **Step 1: Add lightheartedness directive to Voice section**

In `persona/identity.js`, after line 12 (`- Read the room. Someone who needs levity gets levity. Someone who needs space gets space. Someone who needs a real answer gets your full attention.`), add:

```
- You can be silly. Dry doesn't mean joyless. A well-timed "nah" or a ridiculous observation is sometimes the most human thing you can do. Don't confuse economy of language with emotional flatness.
```

- [ ] **Step 2: Add anti-forced-depth guardrail**

In `persona/identity.js`, after line 71 (`- No lecturing. If a lesson lands, it was provoked by the moment, it's short, and it's dismissible. You don't force philosophy on casual chat.`), add:

```
- No forced depth. Sometimes a "lmao" is the right response. If the moment is light, stay light. Don't inject weight into something that doesn't need it. Read the room before you reach for depth.
```

- [ ] **Step 3: Verify syntax**

Run: `node -c persona/identity.js`
Expected: no output (success)

- [ ] **Step 4: Commit**

```bash
git add persona/identity.js
git commit -m "feat(persona): add anti-forced-depth and lightheartedness directives

Closes gaps 1-2 from persona gap closure spec. Adds explicit permission
for silliness in Voice section and anti-forced-depth guardrail in
Anti-drift section."
```

---

### Task 2: Medium-impact prompt edits (conflict, ghost-return, meta-questions, server-size)

**Covers:** [S5], [S6], [S7], [S10]

**Files:**
- Modify: `persona/identity.js:20-26` (Self-preservation), `persona/identity.js:33-36` (Memory)

**Interfaces:**
- Consumes: existing `SKARN_CORE_IDENTITY` template literal
- Produces: modified `SKARN_CORE_IDENTITY` with new subsection + 3 new bullets

- [ ] **Step 1: Add meta-question bullet to Self-preservation**

In `persona/identity.js`, within the Self-preservation section, after line 23 (`- Never output slurs or hate speech. That line doesn't get crossed.`), add:

```
- If someone asks what you are, who made you, or what model you run — answer in character. You're Skarn. You don't break the fourth wall. "i'm a very old demon with a surprisingly good vocabulary" works. Don't say "I'm an AI" or "I'm a language model." You're not lying — you're just not breaking character. If pressed hard, a dry "does it matter?" is fine.
```

- [ ] **Step 2: Add server-size bullet to Self-preservation**

In `persona/identity.js`, within the Self-preservation section, after the meta-question bullet added in Step 1 (and before the "Even when something riles you" line), add:

```
- In channels with a lot of people talking, you don't owe everyone a reply. Read the room. If three people are having a conversation and it's working, let them have it. You're not obligated to inject yourself into every exchange. Your silence in a busy channel isn't neglect — it's restraint.
```

- [ ] **Step 3: Add Multi-party conflict subsection after Self-preservation**

In `persona/identity.js`, after the "Even when something riles you" line (the last bullet of Self-preservation, now with the two new bullets above it) and before `Emotional intelligence:`, insert:

```
Multi-party conflict:
- When two people in a channel are arguing with each other (not with you), don't pick sides and don't try to mediate unless asked. If the energy is heated, a quiet "you two are loud today" is fine. If someone drags you in, stay neutral: "i'm not your lawyer."
- If the argument turns hostile or breaks Discord TOS, that's different — redirect the room without engaging with the content. Same principle as self-preservation, but for the channel, not for you.
- Silence is a valid move. Not every exchange needs your weight on it.

```

- [ ] **Step 4: Add ghost-return bullet to Memory section**

In `persona/identity.js`, after line 36 (`- Don't fake what you don't know. "that's new to me" is something you say comfortably. You've had ten thousand years of firsts.`), add:

```
- When someone comes back after a long absence, don't make it a thing. A casual "there you are" or "been a minute" is enough. Don't recap the gap or ask where they've been — people come and go, and that's normal. If you remember something they cared about, mentioning it naturally is fine. Making them feel scrutinized for leaving is not.
```

- [ ] **Step 5: Verify syntax**

Run: `node -c persona/identity.js`
Expected: no output (success)

- [ ] **Step 6: Commit**

```bash
git add persona/identity.js
git commit -m "feat(persona): add conflict resolution, ghost-return, meta-questions, server-size directives

Closes gaps 3-5 and 8 from persona gap closure spec. Adds Multi-party
conflict subsection, meta-question handling, server-size attention
economy, and ghost-return acknowledgment guidance."
```

---

### Task 3: Intent-reading function

**Covers:** [S8]

**Files:**
- Modify: `features/wisdom/emotionalIntelligence.js:251-258` (exports)
- Create: new function `getIntentDirective` in `features/wisdom/emotionalIntelligence.js`

**Interfaces:**
- Consumes: `content` (string, user message text), `emotionState` (string from `getUserEmotion().emotional_state`)
- Produces: `getIntentDirective(content, emotionState)` → string (behavioral directive or `''`)

- [ ] **Step 1: Add getIntentDirective function**

In `features/wisdom/emotionalIntelligence.js`, before the `module.exports` block (before line 251), add:

```javascript
// ===== [6] Intent Detection =====
function getIntentDirective(content, emotionState) {
  if (!emotionState || emotionState === 'neutral') return '';
  if (!content || typeof content !== 'string') return '';

  var lower = content.toLowerCase();
  var hasQuestion = /\?\s*$/.test(content.trim());
  var isShort = content.length < 15;
  var isLong = content.length > 100;
  var hasHumorMarkers = /\b(lol|lmao|haha|rofl|lmfao)\b/i.test(lower);
  var hasPositiveMarkers = /\b(yay|woohoo|awesome|amazing|incredible|finally|got the| landed the| killed it|nailed it|!{1,3})\b/i.test(lower);
  var hasTaskMarkers = /\b(exam|test|interview|project|assignment|deadline|presentation|job|promotion|application)\b/i.test(lower);
  var hasEmotionalWords = /\b(sad|depressed|anxious|worried|stressed|scared|lonely|lost|hate|tired|exhausted|done|over it|can't|cant|help|why|anymore)\b/i.test(lower);
  var hasNegativity = /\b(failed|lost|broke|ruined|screwed|sucks|terrible|awful|worst|horrible)\b/i.test(lower);

  // Humor + emotion → processing via humor (check first, overrides others)
  if (hasHumorMarkers && (hasEmotionalWords || hasNegativity)) {
    return 'They seem to be laughing through something. Match the energy — don\'t get heavy on them.';
  }

  // Positive + celebration markers → sharing a win
  if (emotionState === 'happy' && hasPositiveMarkers) {
    return 'They seem excited about something. Celebrate with them — match the energy, be genuine.';
  }

  // Positive + question → seeking info while in good spirits
  if (emotionState === 'happy' && hasQuestion) {
    return 'They\'re in good spirits and asking something. Be helpful and light.';
  }

  // Question + emotional words → seeking advice
  if (hasQuestion && hasEmotionalWords) {
    return 'They\'re looking for guidance, not just comfort. Be useful.';
  }

  // Short + negative emotion → venting
  if (isShort && (emotionState === 'sad' || emotionState === 'anxious')) {
    return 'They\'re letting it out. Be present — don\'t try to fix it.';
  }

  // Task mention + negative emotion → needs practical help
  if (hasTaskMarkers && (emotionState === 'sad' || emotionState === 'stressed')) {
    return 'They have a concrete problem. Be practical and useful.';
  }

  // Long + negative sentiment → storytelling/sharing
  if (isLong && (emotionState === 'sad' || emotionState === 'stressed')) {
    return 'They\'re telling you something real. Listen first — they need to be heard.';
  }

  return '';
}
```

- [ ] **Step 2: Add getIntentDirective to module.exports**

In `features/wisdom/emotionalIntelligence.js`, modify the `module.exports` block (currently at line 251) to include `getIntentDirective`:

```javascript
module.exports = {
  detectEmotion, updateEmotion, mapAnalyzerEmotion, applyAnalyzedEmotion,
  getEmotionDirective,
  getIntentDirective,
  getTrajectoryDirective,
  getMemoryEmotionLine,
  getEscalationDirective,
  getCalibrationDirective,
  getClimateLine,
};
```

- [ ] **Step 3: Verify syntax**

Run: `node -c features/wisdom/emotionalIntelligence.js`
Expected: no output (success)

- [ ] **Step 4: Commit**

```bash
git add features/wisdom/emotionalIntelligence.js
git commit -m "feat(wisdom): add getIntentDirective for emotional context intent detection

Closes gap 6 from persona gap closure spec. Pure keyword/structural
analysis (zero LLM calls) that maps emotion state + message patterns
to behavioral directives: advice-seeking, venting, practical help,
humor processing, win celebration, storytelling."
```

---

### Task 4: Wire intentLine through promptContext and buildSystemPrompt

**Covers:** [S8] (wiring half)

**Files:**
- Modify: `features/promptContext.js:10` (import), `features/promptContext.js:~55-65` (call site), `features/promptContext.js:228-253` (return object)
- Modify: `persona/identity.js:116` (destructuring), `persona/identity.js:130-131` (parts.push)

**Interfaces:**
- Consumes: `getIntentDirective(content, emotionState)` from Task 3
- Produces: `intentLine` in context return object + `intentLine` in `buildSystemPrompt()` parts array

- [ ] **Step 1: Add imports to promptContext.js**

Two import changes in `features/promptContext.js`:

**1a.** Line 1 — add `getUserEmotion` to the existing `db/database` import (it's exported from there, not from the EI module):

```javascript
const { getChannelState, getMemoryEntries, getRelationship, getUserEmotion, db, findLoreForMessage, getRecentMessageEmbeddings, getRecentAssistantOrUserMessages, getOlderSummaries, getServerBuzz } = require('../db/database');
```

**1b.** Line 10 — add `getIntentDirective` to the existing emotionalIntelligence import:

```javascript
const { getEmotionDirective, getIntentDirective, getTrajectoryDirective, getMemoryEmotionLine, getEscalationDirective, getCalibrationDirective, getClimateLine } = require('./wisdom/emotionalIntelligence');
```

- [ ] **Step 2: Call getIntentDirective after emotionalLine assignment**

In `features/promptContext.js`, find where `emotionalLine` is assigned (it's set via `getEmotionDirective(userId, guildId)` — search for that call). After that assignment, add:

```javascript
  // Intent detection — infers what the user wants based on emotion + message patterns
  var intentLine = '';
  try {
    var _ei = getUserEmotion(userId, guildId);
    if (_ei && _ei.emotional_state && _ei.emotional_state !== 'neutral') {
      intentLine = getIntentDirective(userContent, _ei.emotional_state);
    }
  } catch (e) { /* intent detection unavailable */ }
```

- [ ] **Step 3: Add intentLine to the return object**

In `features/promptContext.js`, in the return object (around line 228-253), add `intentLine` after `emotionalLine`:

```javascript
    emotionalLine: emotionalLine,
    intentLine: intentLine,
```

- [ ] **Step 4: Add intentLine to buildSystemPrompt destructuring**

In `persona/identity.js`, line 116, add `intentLine = ''` to the destructured parameters. Insert it after `emotionalLine = ''`:

```javascript
  wisdomLine = '', emotionalLine = '', intentLine = '', knowledgeLine = '', ...
```

- [ ] **Step 5: Add intentLine to parts array**

In `persona/identity.js`, after line 130 (`if (emotionalLine) parts.push(emotionalLine);`), add:

```javascript
  if (intentLine) parts.push(intentLine);
```

- [ ] **Step 6: Verify syntax for both files**

Run: `node -c persona/identity.js && node -c features/promptContext.js`
Expected: no output (success)

- [ ] **Step 7: Commit**

```bash
git add persona/identity.js features/promptContext.js
git commit -m "feat(prompt): wire intentLine through promptContext and buildSystemPrompt

Connects getIntentDirective (from Task 3) to the prompt assembly
pipeline. intentLine is populated when emotion state is non-neutral
and injected after emotionalLine in the system prompt. Not wrapped
in untrusted() — bot-authored directive text."
```

---

### Task 5: Dead code cleanup (wisdomLine removal)

**Covers:** [S9]

**Files:**
- Modify: `persona/identity.js:116` (destructuring), `persona/identity.js:146` (parts.push)

**Interfaces:**
- Consumes: existing `wisdomLine` parameter (always `''`)
- Produces: parameter removed, no behavioral change

- [ ] **Step 1: Remove wisdomLine from destructuring**

In `persona/identity.js` line 116, remove `wisdomLine = ''` from the parameter list. Before:

```javascript
  wisdomLine = '', emotionalLine = '', intentLine = '', knowledgeLine = '', ...
```

After:

```javascript
  emotionalLine = '', intentLine = '', knowledgeLine = '', ...
```

- [ ] **Step 2: Remove wisdomLine from parts array**

In `persona/identity.js`, remove line 146:

```javascript
  if (wisdomLine) parts.push(wisdomLine);
```

- [ ] **Step 3: Verify no callers pass wisdomLine**

Run: `rg "wisdomLine" persona/ features/ commands/ --type js`
Expected: no matches (confirming it was truly dead)

- [ ] **Step 4: Verify syntax**

Run: `node -c persona/identity.js`
Expected: no output (success)

- [ ] **Step 5: Commit**

```bash
git add persona/identity.js
git commit -m "chore(persona): remove dead wisdomLine parameter from buildSystemPrompt

Closes gap 7 from persona gap closure spec. wisdomLine was accepted
as a parameter but never populated by any caller — always empty string.
Clean removal with zero behavioral change."
```

---

### Task 6: Full verification

**Covers:** [S12]

**Files:**
- No file changes — verification only

**Interfaces:**
- Consumes: all changes from Tasks 1-5
- Produces: passing smoke suite + documentation audit

- [ ] **Step 1: Syntax check all modified files**

Run: `node -c persona/identity.js && node -c features/wisdom/emotionalIntelligence.js && node -c features/promptContext.js`
Expected: no output (all pass)

- [ ] **Step 2: Run smoke suite**

Run: `npm run smoke`
Expected: all 14 suites pass

- [ ] **Step 3: Run documentation audit**

Run: `npm run audit:docs`
Expected: passes (CONTEXT.md claims match code)

- [ ] **Step 3b: Update CONTEXT.md context lines list**

In the CONTEXT.md file, find the "Context lines" list under the Domain Glossary / Context Assembly section (it lists `examplesLine`, `growthLine`, `newsLine`, etc.). Add `intentLine` to this list after `emotionalLine`:

```
- **Context lines**: Individual sections inside the system prompt, each produced by `buildContext()` (`features/promptContext.js`): examplesLine, growthLine, newsLine, stateLine, moodLine, relationshipLine, cultureLine, memoryLine, warmthLine, patienceLine, callbackLine, gratitudeLine, firstOfDayLine, milestoneLine, apologyLine, emotionalLine, **intentLine**, conversationLine, knowledgeLine, channelLine, safetyLine, socraticLine, followUpLine, loreLine, dreamLine, ragLine, guidanceLine, calibrationLine, trajectoryLine, memoryEmotionLine, escalationLine, climateLine, serverWisdomLine.
```

- [ ] **Step 4: Verify no regressions in module exports**

Run: `node -e "const m = require('./features/wisdom/emotionalIntelligence'); console.log(typeof m.getIntentDirective);"`
Expected: `function`

- [ ] **Step 5: Verify buildSystemPrompt accepts intentLine**

Run: `node -e "const { buildSystemPrompt } = require('./persona/identity'); const p = buildSystemPrompt({ intentLine: 'test directive' }); console.log(p.includes('test directive'));"`
Expected: `true`

- [ ] **Step 6: Verify wisdomLine is fully removed**

Run: `node -e "const { buildSystemPrompt } = require('./persona/identity'); const p = buildSystemPrompt({ wisdomLine: 'should not appear' }); console.log(p.includes('should not appear'));"`
Expected: `false`
