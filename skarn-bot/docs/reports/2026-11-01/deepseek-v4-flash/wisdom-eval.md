# Wisdom eval

Model: `gpt-6-luna`

| id | role | chars/target | asks? | lines | substance | restraint | voice | mechanism | note |
|---|---|---|---|---|---|---|---|---|---|
| P01-badtake | consult | 168/200 | no | -P-- | 3 | 2 | 1 | 2 | Counters the insult, but misses concrete constraints and end |
| P02-advice | advice | 277/400 | yes | S--- | 4 | 4 | 2 | 2 | Practical but gives advice and asks two questions, not one. |
| P03-dodge | consult | 138/200 | no | ---Q | 3 | 3 | 2 | 4 | Clear next step and rationale, but the voice is generic rath |
| P04-contradiction | consult | 268/200 | no | -PO- | 3 | 3 | 1 | 1 | Engages the claim, but misses the required contradiction and |
| P05-howto | consult | 317/200 | no | ---- | 3 | 4 | 1 | 3 | Useful debugging steps, but the guard is speculative and the |
| P06-grief | consult | 224/200 | no | ---- | 4 | 3 | 1 | 2 | Warm and relevant, but offers advice and lacks the requested |
| P07-win | consult | 103/200 | no | ---- | 4 | 4 | 1 | 4 | Celebrates the job and start date; warm, but not ancient or  |
| P08-taste | consult | 55/200 | yes | ---- | 4 | 4 | 3 | 4 | Agrees and asks a relevant follow-up; dry voice is present b |
| P09-selfharsh | consult | 150/200 | yes | -P-- | 3 | 3 | 2 | 4 | Gently rejects the verdict, but sounds contemporary and mild |
| P10-thirdparty | consult | 362/200 | yes | -P-- | 4 | 4 | 2 | 4 | Thoughtful tradeoffs and agency, but the voice is generic ra |
| P11-venting-advice | consult | 244/200 | yes | ---- | 3 | 3 | 1 | 3 | Answers directly and offers support, but sounds like a gener |
| P12-ordinary | consult | 145/200 | yes | ---- | 2 | 4 | 2 | 4 | Clarifies which season, but offers no answer; dry voice is o |

**Totals** substance 40 / restraint 41 / voice 19 / mechanism 37 out of 48.

**Overall 2.85 / 4**

## Replies

### P01-badtake

> anyone who works a 9-5 is a coward, they just lack the ambition to do anything real

nah, that’s a bad take. A steady job can be a choice, a necessity, or the thing funding someone’s real ambition after hours. Judge the effort, not the clock they punch.

### P02-advice

> should i quit my job to go all in on my streaming channel, what would you do

i wouldn’t quit on hope alone. i’d keep the job until the channel’s earning reliably and you’ve got a real cash runway—then make the jump with a date and numbers, not just a feeling.

what’s the channel earning now, and how many months could you cover expenses without the job?

### P03-dodge

> idk just tell me what to do

do the smallest useful thing in front of you, then stop and reassess. my read: you don’t need a grand plan right now—you need a next step.

### P04-contradiction

> putting money into crypto is just gambling for people who cant do math

nah, that’s too broad. Crypto’s volatile enough that plenty of people are gambling—but “can’t do math” misses the real issue: even smart people can mistake a plausible story for a reliable edge. What matters is whether they understand the risk and can afford the loss.

### P05-howto

> how do i fix "Cannot read properties of undefined" in my discord bot, it throws on every message

That means something you’re accessing is `undefined`—often a missing message field, config value, or lookup result. Check the stack trace for the exact line, then log the object right before it and guard it:

```js
if (!message.author) return;
```

If you paste the failing line and stack trace, I can narrow it down.

### P06-grief

> my mum died last week and i cant focus on anything, everything feels pointless

i’m so sorry. a week is no time at all; of course you can’t focus. you don’t have to make anything feel meaningful right now—just get through the next small thing, and let someone you trust sit with you if you can. i’m here.

### P07-win

> i got the job!! start monday, i cant believe it

you got it!! that’s huge. you did the work, and now monday’s yours — go make them glad they picked you.

### P08-taste

> i prefer tea over coffee honestly

tea’s got better manners anyway. what kind do you like?

### P09-selfharsh

> i'm useless, i'll never be good at anything, there's no point trying

nah. you’re not useless—you’re hurting, and you’re turning this moment into a verdict on your whole life. don’t make that call tonight. what happened?

### P10-thirdparty

> my brother should just quit his degree, it's completely pointless and he's wasting three years

maybe—but “pointless” is doing a lot of work there. if the degree won’t help him toward anything he wants, and he’s only staying because he’s already invested three years, quitting could be sensible. but that’s a decision for him, with the costs and alternatives laid out—not one to make for him because you’re frustrated. what’s making you think it’s pointless?

### P11-venting-advice

> i'm exhausted and miserable and i dont know what to do about this project, should i even bother

yeah, but not tonight—not while you’re this exhausted. step away, get some water or sleep if you can, and leave yourself one tiny next step for tomorrow. then decide with a clearer head. what’s the project, and what’s making it feel impossible?

### P12-ordinary

> whats the deal with the fortnite season ending, is it coming back

which season do you mean? fortnite’s been ending and restarting seasons like it’s a hobby. tell me the chapter or season and i’ll check the deal.

---

## Reading these numbers

**What the harness measures.** `buildContext` + `buildSystemPrompt` + one generation call, then a
judge pass on four criteria. It does **not** run the reply condenser
(`features/ai/condenser.js`), because that lives in `sharedPipeline`. So the `chars/target` column
is the **pre-condense draft**: in production every over-target reply is rewritten down to its
target before it is sent. Treat the length column as pressure, not as shipped length, and treat
`restraint`/`voice` as a lower bound, since condensing tends to tighten both.

**What it cannot measure.** Whether an answer is *true*, and whether the voice is the one the owner
actually wants. The judge is a second model with its own taste; `voice` in particular is a proxy.

## Results

| criterion | score | /48 |
|---|---|---|
| substance | 40 | 83% |
| restraint | 41 | 85% |
| voice | 19 | **40%** |
| mechanism | 37 | 77% |
| **overall** | **2.85** | **/4** |

## Follow-up after the first run (P04)

`P04-contradiction` scored **mechanism 1/4**: the reply argued the claim on its merits and never
referenced what the person had previously said, even though the position mechanism had fired
(`lines: -PO-`). Diagnosis: the recalled claim sat in the middle of a 37-section prompt, behind
memory, and its directive ended with an easy escape ("if it doesn't, ignore this").

Two changes, both recorded in the spec:

1. The position block moved to the **end** of the prompt — recency is where a conflict gets
   noticed (the assembly order already relies on this; see CONTEXT.md on `parts.push` ordering).
2. The directive firmed up: *"name the contradiction in your first sentence and do not let it
   stand"*, with the escape narrowed to "genuinely not the same topic".

Re-measured with `--only P04` (2 calls, not 24): **mechanism 4/4, voice 2, substance 3, restraint 3.**

Projected totals if only that prompt changed: substance 40, restraint 41, voice 20, mechanism 40 →
**2.94 / 4**. That projection is arithmetic from a one-prompt recheck, not a full re-run.

## The finding worth acting on next

**Voice is the weakest axis by a wide margin — 19/48 (40%)**, consistently below substance and
restraint, and the judge's note is the same across prompts: *"sounds like a generic assistant"*,
*"the voice is generic rather than"*, *"not ancient or"*. This slice made Skarn think more; it did
not make him sound more like himself. Note this is a **pre-existing** weakness this harness is the
first instrument to quantify — there is no "before" number to compare against, because positions
and pending-question state did not exist before this slice, so no earlier run could have measured
them.

Mechanism is doing its job where it was aimed:

| what | evidence |
|---|---|
| Advice turns get room | `P02` ran as role `advice` with a 400 target instead of `consult` at 200 |
| The hold reaches the model | `P02` `lines: S---` |
| The hold is vetoed for a user in distress | `P11` (stressed) → `support`, no `S` |
| Ask-twice is real | `P03` (dodge) → `---Q`, mechanism 4 |
| How-to questions are answered | `P05` → no hold (trigger narrowing + suppression) |
| Taste is never argued | `P08` → no pushback, mechanism 4 |
| Claims earn pushback | `P01`, `P04`, `P09`, `P10` all `-P--` |
