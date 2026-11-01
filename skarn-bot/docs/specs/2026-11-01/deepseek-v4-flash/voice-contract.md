# Spec — Voice: making the register survive contact with the model

Date: 2026-11-01
Slice: three (lore → wisdom & pushback → **voice** → tools)
Decisions: taken in the grill rounds of 2026-11-01; results in
`docs/reports/2026-11-01/deepseek-v4-flash/wisdom-eval.md`.

## 1. The problem

The wisdom slice moved mechanism scores but left **voice at 19/48 (40%)** on the first eval,
with the judge repeating *"sounds like a generic assistant"*. Investigating it produced three
findings, two of which were wrong:

| hypothesis | tests | verdict |
|---|---|---|
| The reply condenser flattens the register | 2 | **No.** 362→338 chars, register unchanged. |
| The old voice examples cause it | 8 (A/B) | **No.** Grief scored voice 1 with examples on *and* off. |
| Abstract rules are the ceiling; concrete bans will work | 8 | **Partly.** Removed every formula and cut length 20–30%; the judge score alone did not move. |

Two root causes, both real:

**1.1 The measurement was wrong.** The original rubric asked whether replies sounded like
*"an ancient, dry, economical … demon"*. That is **not** the persona. The owner-approved identity
says Skarn "types like someone who's been around long enough to stop performing. Lowkey,
lowercase", and it forbids both "excessive humility that undercuts the Warmaster" and "forced
depth". The rubric punished the voice it existed to protect, so the 40% was largely an artifact.

**1.2 The examples taught the opposite of the persona.** `persona/examples.js` contained lines
like *"that's real"*, *"i'm here"*, *"you earned this win"* and *"being scared and doing it anyway
— that's the definition of courage"* — therapy-speak and fortune-cookie aphorisms, both explicitly
forbidden by `SKARN_CORE_IDENTITY`. Few-shot examples outrank instructions, so the model was
faithfully imitating the wrong voice. The set also **never demonstrated disagreement**, which is
part of why pushback read as canned even after the wisdom slice gave it a mechanism.

## 2. Decisions

| # | Decision |
|---|---|
| V1 | **Register B**: understated, unsentimental, economical, concrete — an old being who stopped performing. Not "ancient fantasy diction". |
| V2 | Re-anchor the judge rubric to V1 **and** add deterministic metrics no judge can fudge: banned-phrase hits, sentence count, exclamation count, opener, chars vs target. |
| V3 | Win voice with **assets**, not a model swap — the account exposes only `gpt-6-luna`, `omni-moderation-latest` and `text-embedding-3-small`, so no alternative chat model exists to test. |
| V4 | Ship a **contract** (concrete bans) *and* **rewritten examples**. Neither alone was sufficient. |

## 3. Design

### 3.1 `persona/voice-contract.js`

Pushed into every system prompt immediately after `SKARN_RULES`, in the static cacheable prefix —
no parameter, no call site, same wiring as the lore bible.

Rules: lowercase by default · no exclamation marks · at most one em dash · banned openers
(sympathy/acknowledgement formulas) · banned phrases · never summarise feelings back · two
sentences is a long answer · grade certainty · one read **or** one question · never two questions.

**Single source of truth.** `BANNED_OPENERS` and `BANNED_PHRASES` are exported lists; the contract
text is *generated* from them, `scripts/wisdom-eval.js` scores against them, and
`scripts/smokes/29-voice-contract.js` checks the examples against them. Editing a list updates the
instruction and both checkers together, so the rule and its enforcement cannot drift.

The two-question rule was added after the eval showed the model producing a read *and* two trailing
questions on every advice prompt — the worst of both, since it neither withholds nor helps.

### 3.2 `persona/examples.js`

Five dialogues rewritten in register B, teaching: dry care, grief without a comfort formula,
rejection without hollow reassurance, **disagreement** ("maybe. but 'pointless' is doing a lot of
work there"), and learning without a lecture.

Deliberately **most turns end on a flat statement, not a question**. An earlier draft ended nearly
every Skarn turn by asking something, and the evals showed the model learning exactly that —
appending question clusters to every reply. `buildExamplesLine(true)` keeps the separate warm
opener for a stranger's first interaction, where warmth outranks economy.

### 3.3 Instrument

- Judge rubric re-anchored to V1, with an explicit instruction to penalise sympathy formulas,
  reassurance formulas, motivational filler, therapy phrasing, and "ancient wizard" diction.
- Deterministic columns added to the report: `banned`, `sentences`, `!`, plus banned-hit and
  sentence totals.
- `--dry` runs the whole routing check with **zero** API calls; `--only <id>` rechecks one prompt
  for 2 calls instead of 24. Both exist because tuning against a judge is expensive and most
  questions are deterministic.

## 4. Results

Controlled before/after, same instrument, same prompts:

| prompt | before assets | after assets |
|---|---|---|
| P06 grief | 341 chars, **3 banned hits**, 5 sentences, voice 2 | 167 chars, **0 banned**, 4 sentences, voice 3 |
| P10 pushback | 232 chars, 0 banned, 4 sentences, voice 3 | 157 chars, **0 banned**, 2 sentences, voice **4** |

Full run: **3.33 / 4** — substance 41, restraint 42, **voice 36** (from 19), **mechanism 41**
(from 37), banned-phrase hits **0**, average 2.6 sentences. Only 2 of 12 replies still exceed
their target, so the condenser now rarely fires — the previous behaviour was to rewrite most
substantive replies.

**Caveat to carry forward:** one sample per prompt. Repeated runs of the same prompt moved
individual scores by ±1–2. Trust the aggregate and the deterministic counts, not a single row.

## 5. What is still weak

- **Advice turns still do read + question** (P02, P11 mechanism 3) despite the contract. The most
  repeated judge complaint and the clearest remaining target.
- **Bad-take pushback** (P01) answers the insult instead of naming a concrete reason someone might
  have no choice — substance 2, lowest in the set.
- **Voice is 3/4, not 4, on most prompts** — recognisably understated now, still slightly polished
  or slightly casual. Whether that is a `gpt-6-luna` ceiling is unanswerable without a second
  chat model.

## 6. Non-goals

- No model/provider change.
- No post-generation rewrite pass (a "voice filter" was considered and rejected: it risks sounding
  mechanical, and the contract already achieves the measurable wins pre-generation).
- No change to the condenser.
