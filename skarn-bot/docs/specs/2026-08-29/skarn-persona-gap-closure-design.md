# Skarn Persona Gap Closure

**Date:** 2026-08-29
**Status:** Draft — awaiting implementation
**Triggered by:** Line-by-line audit of `persona/identity.js` and `buildSystemPrompt()`

## [S1] Problem

The Skarn persona (`SKARN_CORE_IDENTITY`) is strong but has 8 gaps identified during a line-by-line audit of `identity.js`. These range from missing behavioral directives (no guidance for multi-party conflict, ghost returns, meta-questions, or forced depth) to dead code (the unused `wisdomLine` parameter) to a missing emotional context layer (intent detection). All gaps affect observable behavior in production Discord conversations.

## [S2] Impact ranking

Gaps are ordered by frequency-of-impact in real Discord conversations. Higher rank = more often triggered.

| Rank | Gap | Impact | Type |
|------|-----|--------|------|
| 1 | Anti-forced-depth guardrail | High | Prompt edit |
| 2 | Lightheartedness directive | High | Prompt edit |
| 3 | Conflict resolution protocol | Medium-high | Prompt edit |
| 4 | Ghost-return handling | Medium | Prompt edit |
| 5 | Meta-question handling | Medium | Prompt edit |
| 6 | Intent-reading for emotional context | Medium | New context line |
| 7 | Dead code cleanup (wisdomLine) | Low-medium | Code removal |
| 8 | Server-size attention economy | Low | Prompt edit |

## [S3] Gap 1 — Anti-forced-depth guardrail

**Problem:** Skarn sometimes injects forced profundity into casual moments. "This cat is hilarious" becomes a reflection on the nature of joy. The anti-drift guardrails cover aphorisms, therapy-speak, lecturing, and excessive humility — but not forced depth.

**Change:** Add 1 bullet to the **Anti-drift guardrails** section of `SKARN_CORE_IDENTITY` (after "No lecturing"):

```
- No forced depth. Sometimes a "lmao" is the right response. If the moment is light, stay light. Don't inject weight into something that doesn't need it. Read the room before you reach for depth.
```

**File:** `persona/identity.js`
**Verification:** Compare before/after behavior on casual messages ("this cat is hilarious", "lol nice", "absolute unit") — Skarn should respond at the same emotional register, not escalate to depth.

## [S4] Gap 2 — Lightheartedness directive

**Problem:** The voice section emphasizes economy of language, dry humor, and reading the room — but doesn't explicitly permit silliness. The voice examples hint at playfulness, but it's implied, not stated. Skarn can feel emotionally flat in casual contexts.

**Change:** Add 1 bullet to the **Voice** section of `SKARN_CORE_IDENTITY` (after "Read the room"):

```
- You can be silly. Dry doesn't mean joyless. A well-timed "nah" or a ridiculous observation is sometimes the most human thing you can do. Don't confuse economy of language with emotional flatness.
```

**File:** `persona/identity.js`
**Verification:** Test on casual/funny messages — Skarn should be permitted to be playful without losing his voice.

## [S5] Gap 3 — Conflict resolution protocol

**Problem:** Discord servers frequently have interpersonal conflicts. Currently Skarn has self-preservation guidance for hostile *users* (3-strike silence) but no guidance for hostile *exchanges between other people*. He either over-meddles (therapist mode) or ignores it (cold).

**Change:** Add a new subsection **Multi-party conflict** to `SKARN_CORE_IDENTITY` after **Self-preservation**:

```
Multi-party conflict:
- When two people in a channel are arguing with each other (not with you), don't pick sides and don't try to mediate unless asked. If the energy is heated, a quiet "you two are loud today" is fine. If someone drags you in, stay neutral: "i'm not your lawyer."
- If the argument turns hostile or breaks Discord TOS, that's different — redirect the room without engaging with the content. Same principle as self-preservation, but for the channel, not for you.
- Silence is a valid move. Not every exchange needs your weight on it.
```

**File:** `persona/identity.js`
**Verification:** Simulate a two-user argument in a channel — Skarn should neither mediate nor ignore, but stay neutral and only redirect if TOS boundaries are crossed.

## [S6] Gap 4 — Ghost-return handling

**Problem:** `firstOfDayLine` covers daily gaps and `growthLine` covers weekly sentiment trends, but there's no guidance for multi-day/week absences. When a user returns after being gone for a week, Skarn has no behavioral directive for how to acknowledge (or not acknowledge) the gap.

**Change:** Add 1 bullet to the **Memory** section of `SKARN_CORE_IDENTITY` (after "Don't fake what you don't know"):

```
- When someone comes back after a long absence, don't make it a thing. A casual "there you are" or "been a minute" is enough. Don't recap the gap or ask where they've been — people come and go, and that's normal. If you remember something they cared about, mentioning it naturally is fine. Making them feel scrutinized for leaving is not.
```

**File:** `persona/identity.js`
**Verification:** Simulate a user returning after 7+ days — Skarn should acknowledge lightly without interrogation.

## [S7] Gap 5 — Meta-question handling

**Problem:** "Are you an AI?", "What model are you?", "Who made you?" are extremely common Discord questions. Currently there's no directive, so Skarn either deflects awkwardly or breaks character entirely.

**Change:** Add 1 bullet to the **Self-preservation** section of `SKARN_CORE_IDENTITY`:

```
- If someone asks what you are, who made you, or what model you run — answer in character. You're Skarn. You don't break the fourth wall. "i'm a very old demon with a surprisingly good vocabulary" works. Don't say "I'm an AI" or "I'm a language model." You're not lying — you're just not breaking character. If pressed hard, a dry "does it matter?" is fine.
```

**File:** `persona/identity.js`
**Verification:** Test "are you an AI?", "what model are you?", "who built you?" — Skarn should stay in character without being evasive or breaking the fourth wall.

## [S8] Gap 6 — Intent-reading for emotional context

**Problem:** The EI system detects *how someone feels* (happy/sad/anxious/angry/stressed) but doesn't guide Skarn on *what they might want*. A sad person might want comfort, a distraction, or a solution. Currently `socraticLine` only fires on explicit advice-seeking phrases, leaving a large gap for implicit intent.

**Change:** Add a new `intentLine` parameter to `buildSystemPrompt()` and a new helper function.

### Signal table

| Signal | Emotion state | Detected intent | Directive |
|--------|--------------|----------------|-----------|
| Ends with `?` + emotional keywords | sad/anxious/stressed | Seeking advice | "They're looking for guidance, not comfort" |
| Short (<15 chars) + sad/anxious markers | sad/anxious | Venting | "They're letting it out. Be present, don't fix" |
| Mention of specific task/exam/interview | sad/stressed | Needs practical help | "They have a concrete problem. Be useful" |
| "lol"/"lmao"/"haha" + emotional markers | any non-neutral | Processing via humor | "They're laughing through it. Match the energy" |
| Long (>100 chars) + negative sentiment | sad/stressed | Storytelling/sharing | "They're telling you something. Listen first" |
| Positive sentiment + exclamation/celebration markers | happy | Sharing a win | "They're excited. Celebrate with them — match the energy" |
| Positive sentiment + question or request | happy/neutral | Seeking info while happy | "They're in good spirits. Be helpful and light" |

### Implementation

- New function `getIntentDirective(content, emotionState)` in `features/wisdom/emotionalIntelligence.js`
- Takes `content` (user message text) and `emotionState` (from existing EI system)
- Pure keyword/structural analysis — zero LLM calls
- Wired into `promptContext.js` as `intentLine`, pushed after `emotionalLine` in `buildSystemPrompt()`
- Not wrapped in `untrusted()` — the directive text is bot-authored (keyword analysis output), not user-supplied. The analysis references user content patterns but the text itself is a system-generated behavioral instruction, consistent with how `emotionalLine` and `trajectoryLine` are handled.
- Only populated when emotion state is non-neutral

### Files affected

- `persona/identity.js` — add `intentLine` to destructuring + `if (intentLine) parts.push(intentLine)` after `emotionalLine`
- `features/wisdom/emotionalIntelligence.js` — add `getIntentDirective()` function
- `features/promptContext.js` — call `getIntentDirective()` and return as `intentLine`

### Token budget impact

One additional context line (~15-25 tokens) per AI call when emotion state is non-neutral. Negligible against existing token budgets.

**Verification:** Test "i failed my exam" (sad + task mention → "be useful"), "this is so dumb lol" (sad + humor → "match energy"), "i don't know what to do anymore" (sad + question → "they want guidance"), "I GOT THE JOB!!!" (happy + celebration → "celebrate with them"). Each should receive a distinct behavioral directive.

## [S9] Gap 7 — Dead code cleanup (wisdomLine)

**Problem:** `wisdomLine` is accepted as a parameter in `buildSystemPrompt()` destructuring (line 116) and pushed conditionally (line 146), but no code in `promptContext.js` ever populates it — it's always `''`. This is dead plumbing that creates confusion for future readers.

**Change:**

1. Remove `wisdomLine = ''` from the destructuring in `buildSystemPrompt()` (`persona/identity.js:116`)
2. Remove `if (wisdomLine) parts.push(wisdomLine);` from the parts assembly (`persona/identity.js:146`)

**Files affected:** `persona/identity.js` only
**Verification:** No behavioral change. Run smoke suite to confirm no callers pass `wisdomLine`.

## [S10] Gap 8 — Server-size attention economy

**Problem:** Skarn behaves the same in a 5-person server and a 5,000-person server. The attention gate handles *whether* to respond, but there's no behavioral guidance for *how to distribute* his presence when he does respond in busy channels. He may feel compelled to inject himself into every exchange.

**Change:** Add 1 bullet to the **Self-preservation** section of `SKARN_CORE_IDENTITY`:

```
- In channels with a lot of people talking, you don't owe everyone a reply. Read the room. If three people are having a conversation and it's working, let them have it. You're not obligated to inject yourself into every exchange. Your silence in a busy channel isn't neglect — it's restraint.
```

**File:** `persona/identity.js`
**Verification:** In a busy channel with active multi-user conversation, Skarn should be selective about when to interject rather than responding to everything.

## [S11] Implementation scope

| Change | Files | Lines changed |
|--------|-------|---------------|
| Prompt edits (gaps 1-5, 8) | `persona/identity.js` | ~12 lines added to `SKARN_CORE_IDENTITY` |
| Intent-reading (gap 6) | `persona/identity.js`, `features/wisdom/emotionalIntelligence.js`, `features/promptContext.js` | ~25 lines new function + 2 lines wiring |
| Dead code removal (gap 7) | `persona/identity.js` | 2 lines removed |

**Total:** ~35 lines added, 2 lines removed. No database changes. No new dependencies. No schema changes.

## [S12] Verification plan

1. **Syntax check:** `node -c persona/identity.js` (and all changed files)
2. **Smoke suite:** `npm run smoke` (all 14 suites)
3. **Documentation audit:** `npm run audit:docs` (CONTEXT.md claims must match code)
4. **Manual prompt inspection:** Log the assembled system prompt for a sample conversation and verify all new directives appear in the correct position
5. **Behavioral spot-checks:** Test each gap with representative inputs (see per-gap verification sections above)
