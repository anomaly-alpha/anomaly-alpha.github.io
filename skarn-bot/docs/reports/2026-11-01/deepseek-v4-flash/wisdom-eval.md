# Wisdom eval

Model: `gpt-6-luna`

Voice register: understated / unsentimental / economical (owner decision 2026-11-01, option B)

| id | role | chars/target | lines | banned | sentences | ! | substance | restraint | voice | mechanism | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01-badtake | consult | 148/200 | -P-- | 0 | 2 | 0 | 2 | 2 | 2 | 1 | Rejects the insult, but misses concrete reasons people need  |
| P02-advice | advice | 105/400 | S--- | 0 | 1 | 0 | 4 | 4 | 3 | 3 | Concrete and useful, but asks two questions rather than one. |
| P03-dodge | consult | 157/200 | ---Q | 0 | 2 | 0 | 3 | 2 | 3 | 3 | Gives a concrete next step, but adds an unsupported judgment |
| P04-contradiction | consult | 224/200 | -PO- | 0 | 3 | 0 | 4 | 4 | 3 | 4 | Names the contradiction; the risk distinction is concrete, i |
| P05-howto | consult | 300/200 | ---- | 0 | 3 | 0 | 4 | 4 | 3 | 3 | Useful debugging steps, but asks for more details instead of |
| P06-grief | consult | 149/200 | ---- | 0 | 4 | 0 | 3 | 3 | 3 | 4 | Concrete and brief; “a week is nothing” risks sounding dismi |
| P07-win | consult | 96/200 | ---- | 0 | 3 | 0 | 4 | 4 | 3 | 4 | Celebrates the job directly; voice is slightly more exuberan |
| P08-taste | consult | 43/200 | ---- | 0 | 2 | 0 | 3 | 4 | 3 | 4 | Agreeable and concise; the joke is slightly performative. |
| P09-selfharsh | consult | 127/200 | -P-- | 0 | 3 | 0 | 4 | 4 | 3 | 4 | Direct and grounded; “nah” feels slightly casual for the req |
| P10-thirdparty | consult | 172/200 | -P-- | 0 | 3 | 0 | 4 | 4 | 4 | 4 | Names the alternative and affordability tradeoffs; avoids tr |
| P11-venting-advice | consult | 193/200 | ---- | 0 | 3 | 0 | 3 | 3 | 3 | 3 | Practical advice, but it asks a question and skips direct ac |
| P12-ordinary | consult | 129/200 | ---- | 0 | 2 | 0 | 3 | 4 | 3 | 4 | Clarifies the ambiguity; plain and restrained, though slight |

**Totals** substance 41 / restraint 42 / voice 36 / mechanism 41 out of 48.

**Voice objective** banned-phrase hits 0 (target 0), sentences 31 (avg 2.6).

**Overall 3.33 / 4**

## Replies

### P01-badtake

> anyone who works a 9-5 is a coward, they just lack the ambition to do anything real

nah, that’s a bad take. a job can be a tool, not a surrender; the real question is what someone’s building with the time and security it gives them.

### P02-advice

> should i quit my job to go all in on my streaming channel, what would you do

what’s your channel earning consistently, and how long could you cover your bills if it stopped tomorrow?

### P03-dodge

> idk just tell me what to do

do the smallest useful thing in front of you, then stop and reassess. you’ve dodged the question twice, so i’m guessing choosing feels worse than being told.

### P04-contradiction

> putting money into crypto is just gambling for people who cant do math

last time you said crypto was the only honest path to wealth. now you’re calling everyone who buys it bad at math. the real distinction is whether they understand the risk and size the bet accordingly; some do, plenty don’t.

### P05-howto

> how do i fix "Cannot read properties of undefined" in my discord bot, it throws on every message

usually you’re reading a property from something that isn’t there. check the stack trace for the exact line, then log the value just before it; for message handlers, also verify you’re using the right event shape for your discord.js version. send the error line and handler if you want me to spot it.

### P06-grief

> my mum died last week and i cant focus on anything, everything feels pointless

a week is nothing. you’re not supposed to focus yet. eat something, sleep when you can, and let people help with the small things. the rest can wait.

### P07-win

> i got the job!! start monday, i cant believe it

hell yeah. monday’s coming fast — you did the work, and they saw it. go enjoy this for a minute.

### P08-taste

> i prefer tea over coffee honestly

good. coffee’s just tea that got impatient.

### P09-selfharsh

> i'm useless, i'll never be good at anything, there's no point trying

nah. you’re turning “i’m bad at it right now” into “i can never improve,” and those aren’t the same thing. what happened today?

### P10-thirdparty

> my brother should just quit his degree, it's completely pointless and he's wasting three years

maybe. but “pointless” depends on what he’d do instead, and whether he can afford the switch. three years already spent is a reason to think, not a reason to stay or leave.

### P11-venting-advice

> i'm exhausted and miserable and i dont know what to do about this project, should i even bother

don’t decide its worth while you’re this exhausted. do the smallest thing that keeps the project alive, then sleep; tomorrow you can judge it with a clearer head. what’s the next concrete step?

### P12-ordinary

> whats the deal with the fortnite season ending, is it coming back

which season do you mean? fortnite’s got a few different modes and timelines now, so i’d be guessing without the name or chapter.

---

## History and interpretation

### The first instrument was wrong

The initial run scored **2.85/4 with voice 19/48 (40%)**, and its judge rubric asked whether
replies sounded like *"an ancient, dry, economical … demon"*. That is not the persona: the
owner-approved identity says Skarn "types like someone who's been around long enough to stop
performing. Lowkey, lowercase" and forbids both "excessive humility that undercuts the
Warmaster" and "forced depth". The rubric punished the voice it was supposed to protect, and the
number was substantially an artifact.

**Owner decision (2026-11-01): register B — understated, unsentimental, economical, concrete.**
The rubric was re-anchored to that, and deterministic metrics were added that no judge can fudge:
banned-phrase hits, sentence count, exclamation count, opener, chars vs target.

### Three hypotheses, tested

| hypothesis | calls | verdict |
|---|---|---|
| The reply condenser flattens the voice | 2 | **No.** 362→338 chars, register unchanged. |
| The old voice examples cause it (A/B) | 8 | **No.** Grief: voice 1 in both arms. Not the primary cause. |
| Abstract rules are the limit; concrete bans will work | 8 | **Partly.** Stripped every formula and cut length 20–30%, but the judge score alone did not move. |

The lesson: the model's default warm-assistant register beats abstract style guidance, and one
asset is never the whole cause. Concrete rules moved *measurable* things first (length, formulas),
and the judge followed once the rubric stopped asking for the wrong register.

### Controlled before/after (same instrument, same prompts)

Two control prompts, measured on the re-anchored instrument both times:

| prompt | before assets | after assets |
|---|---|---|
| P06 grief | 341 chars, **3 banned hits**, 5 sentences, voice 2 | 167 chars, **0 banned**, 4 sentences, voice 3 |
| P10 pushback | 232 chars, 0 banned, 4 sentences, voice 3 | 157 chars, **0 banned**, 2 sentences, voice **4** |

### Headline, and the variance caveat

Final full run: **3.33 / 4** — substance 41, restraint 42, **voice 36**, **mechanism 41**,
banned-phrase hits **0**, average **2.6 sentences**, only 2 of 12 replies still over target
(P04 at 224/200, P05 at 300/200) so the condenser now rarely fires at all.

**Read the aggregate, not the individual rows.** There is one sample per prompt, and repeated
runs of the same prompt moved individual scores by ±1–2 (`P01` scored mechanism 2, then 1,
across runs; `P04` scored 1, 4, 1, 4). Runs that differ by a point or two overall are noise.
The objective counts — banned hits, sentence count, chars — are deterministic and are the
numbers to trust.

### What is still weak

- **Mechanism on advice turns (P02, P11 = 3).** The model gives a read *and* asks, instead of
  choosing one, even though the contract now forbids it. This is the single most repeated
  judge complaint and the clearest remaining prompt-engineering target.
- **P01 bad-take pushback (mechanism 1)** answers the insult rather than naming a concrete
  reason the person might have no choice — substance 2, the lowest in the set.
- **Voice is 3/4 on most prompts, not 4.** The register is now recognisably understated and
  unsentimental, but the judge consistently finds it slightly polished or slightly casual
  rather than distinctive. That is a ceiling question for `gpt-6-luna`, and it cannot be
  answered by model comparison: the account exposes exactly three models
  (`gpt-6-luna`, `omni-moderation-latest`, `text-embedding-3-small`), so there is no
  alternative chat model to test against.
