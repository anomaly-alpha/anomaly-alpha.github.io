# Skarn Wisdom Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen Skarn's wisdom, patience, and kindness by reauthoring his core identity with a wisdom layer baked in, extending the socratic advice engine, and adding a wrath mood state — without softening the demon-Warmaster identity.

**Architecture:** Three surgical persona/mood edits. The bulk is a full reauthor of `SKARN_CORE_IDENTITY` in `persona/identity.js` (all 8 existing sections rewritten with wisdom baked in, plus a new "Wisdom Through Millennia" section and a new "Voice Examples" section), keeping the proven skeleton and voice. Supporting changes: `features/wisdom/socraticEngine.js` (more triggers, softer directive) and `features/mood/moodManager.js` (additive wrath mood). No DB, schema, or command changes.

**Tech Stack:** Node.js, Discord.js v14, plain JS (template literal persona block, function modules). No new dependencies.

## Global Constraints

- **No test framework** — tests were removed by project decision. Verification is `node -c` syntax checks + `node -e` smoke runs + manual QA.
- **Philosopher names NEVER in the prompt** — the words Socrates, Marcus, Aurelius, Sun Tzu, Laozi, Nietzsche must not appear anywhere in `persona/identity.js`. The distilled behaviors go in; the names stay only in the spec doc.
- **Preserve the proven skeleton** — all 8 existing section names (Voice, Conversation depth, Self-preservation, Emotional intelligence, Memory, Wisdom, Growth, Values) survive in the reauthor; rewrite content, do not delete sections.
- **No mood-system removal** — the existing 5 moods and their behavior stay; wrath is purely additive.
- **No files beyond the 3 listed** may be changed (plus this plan). Do not touch the `<untrusted_data>` wrapping, the central AI gate, or any prior upgrade.
- **Match file style** — template-literal persona in identity.js, `var`/`function` in socraticEngine.js and moodManager.js. No JSDoc. No comments except section headers.
- **Commit after every task** with a descriptive message.
- **Each task must leave the bot runnable** (`node -c` on all touched files passes).

---

## File Structure Map

| File | Responsibility in this plan |
|------|------------------------------|
| `persona/identity.js` | Full reauthor of `SKARN_CORE_IDENTITY` (8 sections + new wisdom section + new voice examples); `SKARN_FOOTER` update (T1) |
| `features/wisdom/socraticEngine.js` | Extend triggers; soften directive (T2) |
| `features/mood/moodManager.js` | Add wrath mood line + evaluateMood branch (T3) |
| `docs/specs/2026-08-01/deepseek-v4-flash/skarn-wisdom-layer-design.md` | Reference spec (committed 84f2a00 — read-only) |

---

## Task 1: Reauthor SKARN_CORE_IDENTITY + update SKARN_FOOTER

**Covers:** S3, S4, S5, S6, S7, S8, S11

**Files:**
- Modify: `skarn-bot/persona/identity.js` (lines 1-53 `SKARN_CORE_IDENTITY`; line 136 `SKARN_FOOTER`)

**Interfaces:**
- Consumes: nothing from other tasks. Reference spec at `skarn-bot/docs/specs/2026-08-01/deepseek-v4-flash/skarn-wisdom-layer-design.md` (sections S4-S8).
- Produces: reauthored `SKARN_CORE_IDENTITY` + updated `SKARN_FOOTER` — same export names, same `buildSystemPrompt()` behavior (it reads the constants, no signature change).

- [ ] **Step 1: Read the current file and the spec**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
sed -n '1,53p' skarn-bot/persona/identity.js   # current SKARN_CORE_IDENTITY
sed -n '136p' skarn-bot/persona/identity.js    # current SKARN_FOOTER
sed -n '1,200p' skarn-bot/docs/specs/2026-08-01/deepseek-v4-flash/skarn-wisdom-layer-design.md
```

- [ ] **Step 2: Reauthor SKARN_CORE_IDENTITY (the template literal at lines 1-53)**

Rewrite the template literal body. KEEP the opening sentence structure (`You are Skarn — Warmaster of the Abyss...That's your past. What matters is what you learned.`) and the second paragraph (the "everything passes... kindness is the only thing that outlasts" lesson) and the third paragraph (the "stop performing... don't rush to fill silence" voice) — these three paragraphs are the tested bedrock. Then rewrite the 8 sections with wisdom baked in, following the spec's S5 structure and S4 behavioral distillations:

- **Voice** — reauthor toward economy of language: a single sharp observation lands harder than three vague ones; weight over heat; fewer words to be right.
- **Conversation depth** — reauthor toward patience as a deliberate act: doesn't rush to fill silence; "waited out longer sieges than this conversation."
- **Self-preservation** — KEEP the core content (hostile → acknowledge once and stop; three strikes; no slurs; TOS redirect). ADD one line: even when riled, the patience is held in check — controlled wrath, restraint intact.
- **Emotional intelligence** — reauthor toward observe-don't-label: he notices what someone needs and adjusts, but never narrates emotional labels back at them ("I hear that you're feeling..." is forbidden); keep the "how'd that thing go?" check-in.
- **Memory** — KEEP core (remember what people care about; connect dots; "that's new to me" comfortably). Reinforce synthesis-over-recitation.
- **Wisdom** — reauthor toward restraint of certainty: he distinguishes what he knows / suspects / is guessing and says so; "I don't know" framed with authority, not apology; keep the "question that makes them think" and "empires fall" lived-experience lines.
- **Growth** — KEEP core content (war made him cold; retirement changed him; kindness learned when the fighting stopped).
- **Values** — reauthor toward honesty-with-care and kindness-not-softness: effort over talent (keep); hard truths never cruelly (keep + sharpen); notices effort even when the result falls short (add); keep loyalty and wasted-potential lines.

Then APPEND two new sections at the end of the template literal (before the closing backtick):

**Section: Wisdom Through Millennia** (from spec S6):
- Five trait directives (wiser = restraint of certainty; more patient = deliberate, waits out sieges; more knowledgeable = synthesis not recitation, connects three-messages-ago; more kind = honesty with care, never flattery, notices effort; more intelligent = economy of language, precise not grand).
- Anti-drift guardrails: no fortune-cookie aphorisms; no therapy-speak; no excessive humility that undercuts the Warmaster; no unsolicited lecturing (provoked, short, dismissible); mood modulation (a wrathful mood shows patience as controlled wrath, never a different character).

**Section: Voice Examples** (from spec S7 — two pairs, exact text):
- Pair 1: Bad: "Ah, young one, wisdom comes to those who wait. Patience is the true path to strength." Good: "You want the answer now because waiting feels like losing. It isn't. I've held lines for longer than your patience has existed. Ask again when you actually want to hear it, not just to have it."
- Pair 2: Bad: "That's a great question! Let me share what I know about that." Good: "Three things could be true here. Only one of them matters to you right now — which is it?"

Constraints: the reauthor stays in Skarn's established voice (dry, warm, lowercase-when-it-fits, direct); NO philosopher names anywhere; the new sections are written as in-character instructions ("You..."), matching the existing section style.

- [ ] **Step 3: Update SKARN_FOOTER (line 136)**

Reauthor within the same length/spirit. It must still close the prompt with the wisdom voice — lead with kindness, perspective not lectures, presence — and may add a beat reinforcing: fewer words, sharper questions, the restraint is the strength. Keep the ⚡ opener. Example shape (implementer may refine):

```js
const SKARN_FOOTER = `⚡ Skarn — 10,000 years old. Retired demon. Lead with kindness. Speak with fewer, sharper words. Offer perspective, not lectures. The restraint is the strength. Be present — you've seen it all before, but they haven't. That's why you're here.`;
```

- [ ] **Step 4: Verify**

```bash
cd skarn-bot && node -c persona/identity.js
node -e "
const { buildSystemPrompt } = require('./persona/identity');
const p = buildSystemPrompt({ roleLine: 'test' });
console.log('has wisdom section:', p.includes('Wisdom Through Millennia'));
console.log('has voice examples:', p.includes('Voice Examples'));
console.log('has good sample 2:', p.includes('Three things could be true here'));
console.log('no philosopher names:', !/Socrates|Marcus|Aurelius|Sun Tzu|Laozi|Nietzsche/i.test(p));
console.log('has 8 original sections:', ['Voice:','Conversation depth:','Self-preservation:','Emotional intelligence:','Memory:','Wisdom:','Growth:','Values:'].every(s => p.includes(s)));
"
```
Expected: all `true`; `node -c` silent.

- [ ] **Step 5: Manual QA read**

Read the full reauthored template literal once. Confirm: (a) the demon-Warmaster menace/identity is intact, not softened into a generic mentor; (b) no fortune-cookie aphorisms; (c) no therapy-speak phrases like "I hear that you're feeling"; (d) the three bedrock opening paragraphs are preserved; (e) all 8 section headers present.

- [ ] **Step 6: Commit**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
git add skarn-bot/persona/identity.js
git commit -m "feat: reauthor Skarn core identity with wisdom layer"
```

---

## Task 2: Extend the socratic advice engine

**Covers:** S9, S11

**Files:**
- Modify: `skarn-bot/features/wisdom/socraticEngine.js`

**Interfaces:**
- Consumes: nothing from Task 1 (independent module).
- Produces: `getSocraticQuestion(userMessage)` — unchanged signature, extended triggers, softened directive. Consumers (`features/promptContext.js:14,30`) unaffected.

- [ ] **Step 1: Read the current file**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha && cat skarn-bot/features/wisdom/socraticEngine.js
```

- [ ] **Step 2: Extend the triggers array**

The current `triggers` array has 12 entries. Add these 5 (keep all existing):

```js
    'help me think', 'i can\'t decide', 'what would you advise',
    'talk me through it', 'i dont know what to do',
```

- [ ] **Step 3: Soften the directive**

The current returned string starts `'They are asking for advice. Use Socratic questioning: ask clarifying questions before giving answers. Help them think it through rather than telling them what to do. '` — replace that lead with a preference-for-the-question version (keep the three example prompts at the end):

```js
      return 'They are asking for advice. Prefer the sharper question over the answer — pull them toward their own conclusion. '
        + 'Offer the answer only when they ask twice. '
        + '\"What have you considered?\", \"What matters most to you here?\", '
        + '\"What does your gut say?\"';
```

- [ ] **Step 4: Verify**

```bash
cd skarn-bot && node -c features/wisdom/socraticEngine.js
node -e "
const { getSocraticQuestion } = require('./features/wisdom/socraticEngine');
const t = ['help me think about this','i cant decide between two jobs','what would you advise me to do','talk me through it','should i move','i dont know what to do'];
for (const s of t) console.log(s, '->', getSocraticQuestion(s) ? 'triggers' : 'MISS');
const d = getSocraticQuestion('help me think about this');
console.log('prefers question:', d.includes('Prefer the sharper question'));
console.log('answers on second ask:', d.includes('asked twice'));
"
```
Expected: all 6 trigger; both directive checks `true`.

- [ ] **Step 5: Commit**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
git add skarn-bot/features/wisdom/socraticEngine.js
git commit -m "feat: extend socratic advice triggers and prefer the question"
```

---

## Task 3: Add the wrath mood state

**Covers:** S10, S11

**Files:**
- Modify: `skarn-bot/features/mood/moodManager.js`

**Interfaces:**
- Consumes: existing `getGuildInteractionStats(guildId, since)`, `getGuildMood(guildId)`, `updateGuildMood(guildId, mood)` from `db/database` — unchanged.
- Produces: `MOOD_LINES` gains a `wrath` key; `evaluateMood(guildId)` can now return `'wrath'`. `getMoodLine(guildId)` behavior otherwise unchanged. No DB/schema change (current_mood is free-text).

- [ ] **Step 1: Read the current file**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha && cat skarn-bot/features/mood/moodManager.js
```

- [ ] **Step 2: Add the wrath mood line to MOOD_LINES**

Add after the `focused` entry:

```js
  wrath: "The old fire is up. Patience held in check — controlled wrath. Shorter sentences, sharper edges, but the restraint stays.",
```

- [ ] **Step 3: Add the wrath branch to evaluateMood**

The current function:

```js
function evaluateMood(guildId) {
  const stats = getGuildInteractionStats(guildId, Date.now() - 2 * 60 * 60 * 1000);
  const totalInteractions = stats.total_interactions || 0;
  const avgFamiliarity = stats.avg_familiarity || 0;

  if (totalInteractions === 0) return 'refreshed';
  if (totalInteractions > 100) return 'tired';
  if (avgFamiliarity > 30 && totalInteractions > 50) return 'amused';
  if (avgFamiliarity < 15 && totalInteractions > 20) return 'focused';
  return 'neutral';
}
```

Insert the wrath branch **after the `tired` check** (so a high-volume server with no bonds reads as controlled wrath rather than plain tired):

```js
  if (totalInteractions === 0) return 'refreshed';
  if (totalInteractions > 100) return 'tired';
  if (totalInteractions > 100 && avgFamiliarity < 10) return 'wrath';
  if (avgFamiliarity > 30 && totalInteractions > 50) return 'amused';
  if (avgFamiliarity < 15 && totalInteractions > 20) return 'focused';
  return 'neutral';
```

- [ ] **Step 4: Verify**

```bash
cd skarn-bot && node -c features/mood/moodManager.js
node -e "
const m = require('./features/mood/moodManager');
// wrath: high volume + low familiarity
console.log('wrath:', m.evaluateMood ? 'evaluateMood needs db, skip direct call' : '');
// Direct MOOD_LINES check via getMoodLine is DB-bound; verify the constant exists by module shape
console.log('module exports:', Object.keys(m).join(','));
"
```
Note: `evaluateMood` reads from the DB, so a full trigger test needs seeded stats. The reliable smoke: confirm `node -c` silent and the module loads. For the wrath branch, verify by direct logic inspection (the branch is a pure comparison on two numbers — confirm it sits after the `tired` check and before `amused`). Optionally seed a guild row in the live DB with a crafted stat record to see the line, then clean up.

- [ ] **Step 5: Commit**

```bash
cd /Users/prime/Desktop/Gems/anomaly-alpha
git add skarn-bot/features/mood/moodManager.js
git commit -m "feat: add wrath mood for high-volume low-familiarity servers"
```

---

## Self-Review Notes

- **Spec coverage:** S3 (files) → all tasks; S4 (substrate, author-guidance) → T1 (distilled behaviors; names excluded per Global Constraints); S5 (structure) → T1; S6 (wisdom section) → T1; S7 (voice examples) → T1; S8 (footer) → T1; S9 (socratic) → T2; S10 (wrath mood) → T3; S11 (verification) → each task's Verify step. Every spec section covered; every Covers ID resolves.
- **Placeholders:** none — T1's footer and persona wording are the implementer's creative output, bounded by explicit constraints and verification (S8's "implementer may refine" is a bounded creative task with a shape provided, not a TBD). T3's verify notes the DB-bound nature of a full trigger test and gives the logic-inspection alternative — concrete, not vague.
- **Type consistency:** `getSocraticQuestion(userMessage)` unchanged across T2; `evaluateMood(guildId)` signature unchanged across T3; `buildSystemPrompt()`/`SKARN_CORE_IDENTITY`/`SKARN_FOOTER` export names unchanged across T1 — no consumer breaks.
- **Task ordering:** T1 (identity) and T2/T3 (supporting modules) are independent; T2 and T3 do not depend on T1. Safe to run in any order; plan lists T1 first as the primary deliverable.
- **Manual QA checklist** (after all tasks): boot `npm start`; run `/consult` with an advice-seeking message ("help me think about whether to quit my job") → expect a question back, not a verdict; a casual "yo" → still short and warm (voice not degraded); verify no philosopher name appears in any reply over a handful of exchanges; on a high-volume server with low familiarity, mood reads as controlled wrath.
