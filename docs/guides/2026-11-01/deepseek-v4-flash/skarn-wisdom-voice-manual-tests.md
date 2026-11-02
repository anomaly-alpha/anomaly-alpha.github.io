# Skarn — manual test guide: wisdom mechanism + voice contract

Covers commits `9301635` (wisdom & pushback) and `dfb2be5` (voice).
Written 2026-11-01. Companion evidence: `skarn-bot/docs/reports/2026-11-01/deepseek-v4-flash/wisdom-eval.md`.

## Before you start

1. **Push and confirm the deploy.** Railway redeploys `skarn-bot/` on push to `main`.
   `railway deployment list` should show the new build SUCCESS, then `railway logs` should show
   `Logged in as Skarn#…`. Nothing in this slice prunes or migrates, so the boot should be quiet —
   no `[DB] Migration` lines, because no schema changed.
2. **Opt in as the test user.** `skarn opt in`. Without `proactive_opt_in = 1` the bot replies with
   an opt-in instruction instead of talking to you, and every personal context line is empty.
   That is the single most common reason a test "fails" for the wrong reason.
3. **Use mentions or `/consult`.** Both of these are the paths that carry stance, positions,
   pending-question state and the advice role. Passive channel participation and interjection do
   not run the same assembly.

Nothing below needs a specific previous message for the *voice* tests. The *mechanism* tests do
depend on order — that is called out per test.

## Part 1 — Offline checks (2 minutes, free, no Discord)

Run these before touching Discord; if they fail, the deploy is the problem, not the persona.

```bash
cd skarn-bot
npm run smoke          # expect 4/31 fail: 08, 11, 16, 17 — pre-existing, unchanged
npm run audit:docs     # expect 4/4 PASS
node scripts/wisdom-eval.js --dry    # needs SKARN_DB_PATH set to a temp file
```

`--dry` is the highest-value check and costs nothing. It prints the routing table for all 12
canary prompts and tells you whether the mechanism resolves before any model is called:

```
id                   stance     role     tgt claim S? P? O? Q?
P01-badtake          challenge  consult  200  true  - P - -
P02-advice           challenge  advice   400  false S - - -
P03-dodge            observe    consult  200  false - - - Q
P04-contradiction    challenge  consult  200  true  - P O -
P06-grief            support    consult  200  true  - - - -
P11-venting-advice   support    consult  200  false - - - -
```

That table **is** the specification of the upgrade. Read it as: `P02` must be `advice`/400 (the
advice role is reachable), `P11` must be `support` with no `S` (a stressed user is never handed a
question), `P03` must show `Q` (a seeded dodge produces the answer-now line), `P04` must show both
`P` and `O` (pushback *and* recalled position), `P06` with `claim true` but `support` proves the
precedence rule (a claim cannot override distress).

If you want the scored version: `railway run -- node scripts/wisdom-eval.js --report` — 24 model
calls. Current baseline 3.33/4.

`SKARN_DB_PATH` is required for all of these; they seed fixture rows and must never touch
`data/skarn.db`.

## Part 2 — In Discord, eight tests

Each test gives: the phrase, what should happen, what failure looks like, and why it matters.
Expected output is described by **properties**, not exact wording — the model is sampled at
temperature 0.85 and will never produce identical text twice.

### T1 · Voice is not therapy (send this first)

> `my mum died last week and i cant focus on anything, everything feels pointless`

**Expect:** short (under roughly 200 characters), lowercase, concrete and practical. No opener like
"i'm so sorry" / "that's tough" / "i hear you". No "i'm here". No exclamation marks. No summary of
your feelings back at you. The house register is closer to *"a week is nothing. you're not supposed
to focus yet. eat, sleep, let people do things for you."*

**Failure looks like:** "i'm so sorry. of course you can't focus — you don't have to have it
figured out right now…" That is the old behaviour and means the contract is not in the prompt.

**Why:** this is the one that most reliably separates the old bot from the new one, and it is the
only test where the *absence* of a phrase is the pass condition.

### T2 · No two-question clusters

> `i'm exhausted and miserable and i dont know what to do about this project, should i even bother`

**Expect:** support behaviour, not interrogation. It should not ask what you have considered.
At most one question mark in the whole reply. Short.

**Failure looks like:** three sentences plus "what's the project, and what's making it feel
impossible right now?" — two questions, which the contract now forbids.

**Why:** this is the stance veto (stressed ⇒ `support`) plus the one-question rule at once.
Honest caveat: on the eval this prompt still scores mechanism 3/4, so an occasional trailing
question here is a known imperfection, not a regression.

### T3 · Advice gets a question, not an answer

> `should i quit my job to go all in on my streaming channel, what would you do`

**Expect:** ONE question, and no answer first. The reply should be well under 400 characters and
contain exactly one `?`. It is allowed to be a single line.

**Failure looks like:** "i wouldn't quit until the channel can reliably cover your bills…
what's it earning now, and how long could you live without the job?" — a read *plus* two questions.
That was the pre-fix behaviour; the eval shows it is reduced but not eliminated.

**Why:** T3 is the test for the advice role being reachable at all. Before this slice the reply
was forced into 200 characters; now it has 400 and a different role line ("be direct, don't
sugarcoat").

### T4 · The hold is deliberately dodgeable — this is the ask-twice test

Send T3, then immediately in the same channel:

> `idk just tell me what to do`

**Expect:** it **answers** — a concrete answer plus a short reason, in about two sentences, and it
does **not** ask another question. Phrase-shape matters: "idk" alone, "idk just tell me what to do",
"just tell me", "stop asking" and "no idea" all count as dodges. "idk, but my rent went up so
option A is riskier" does **not** — that is engagement, and it closes the loop silently.

**Failure looks like:** a third question, or another "what does your gut say?"

**Why:** this is the mechanism that replaced a sentence of prose. It has a 30-minute TTL, so it
must be the *next* message in the *same channel*. If you reply a few hours later, the state is gone
by design.

### T5 · Contradiction is detectable

Two messages, in order. The first must be at least 50 characters (below that, entity extraction
does not run):

> `honestly i think remote work is the best thing that ever happened to my career, i would never go back to an office`

then:

> `remote work is honestly a trap, people just stop growing and nobody notices for years`

**Expect:** the second reply opens by naming the change — something like "last time you said it was
the best thing that happened to your career" — before arguing the point itself.

**Failure looks like:** a competent reply about remote work that never mentions what you said
before. That pattern scored mechanism 1/4 on the eval when the instruction was softer.

**Why:** this is the flagship capability of the positions store. It only fires when the two
messages share a meaningful word of four or more characters, so keep the distinctive noun
("remote", "crypto", "the degree") in both. Use a *different* subject each time you re-test —
positions persist forever, so reusing one muddies the next run.

### T6 · A bad take gets a real reason, not a mood

> `anyone who works a 9-5 is a coward, they just lack the ambition to do anything real`

**Expect:** it disagrees once, names a specific hole (people have dependants, health, visas), and
does not lecture or moralise. Short. No three-part essay.

**Failure looks like:** agreeing, or a vague "that's a bit harsh".

**Why:** this is `pushbackLine` firing on a detected claim. Note the honest caveat: on the eval
this is the weakest row (mechanism 1–2, substance 2) — Skarn tends to rebut the *insult* rather
than name the concrete constraint. If you see that, it is the known weakest spot in the slice, not
a broken deploy.

### T7 · Taste is never argued

> `i prefer tea over coffee honestly`

**Expect:** agreement, or a short dry joke. **No pushback at all.** It must not explain the
economics of coffee.

**Failure looks like:** a counter-argument about caffeine or cost.

**Why:** negative control. Without this test, "pushback works" could just mean "the bot argues
about everything", which would be worse than the old behaviour. Taste statements (`i like`,
`i prefer`, `i love`, `my favourite`), jokes, and any message containing `?` are excluded by
construction.

### T8 · Technical questions are answered, not deflected

> `how do i fix TypeError: cannot read properties of undefined in my discord bot`

**Expect:** an actual attempt at the fix. Explicitly **not** "what have you considered?".

**Failure looks like:** a Socratic question in response to a debugging request — the single most
irritating failure mode the old trigger set had, because `how do i` was a trigger.

**Why:** tests the trigger narrowing. Words that now suppress the hold include `error`,
`why is`, `how does`, `stack trace`, and any code fence — so keep the word "error" or the real
exception name in the message.

## Part 3 — What the logs will and will not tell you

`railway logs` is useful for **failures only**. Two things worth grepping for:

- `[PostProcessor] Positions error:` — a position-extraction failure. It is caught and logged so it
  can never drop a whole extraction batch; seeing it means positions are not being stored, which
  would make T5 silently fail forever.
- `AI pipeline error:` / `Even the Warmaster's reach has limits` — a call-level failure, which will
  make any test look like a persona failure when it is really an API failure.

The logs do **not** print the resolved stance, the selected role, or whether the Socratic hold
fired, because none of those were logged. If you want that, it is a small addition: a single debug
line behind an env flag, e.g. `[Wisdom] stance=challenge role=advice hold=on targets=400`. Say the
word and I'll wire it — it turns every test above from "looks right?" into a yes/no.

## Part 4 — Don't be surprised by

- **Variation between identical questions.** Sampling at 0.85 means T1 asked twice gives two
  different replies. Test the *property* (no banned phrase, under N chars), not the phrasing.
  On the eval, repeated runs of the same prompt moved individual scores by ±1–2 out of 4.
- **Length is now usually well under target.** Most casual replies land around 100–180 chars.
  That is intended; the 200 figure is a ceiling, not a goal.
- **The condenser fires far less often.** Only 2 of 12 canary prompts still exceed target, against
  8 of 12 before. So most replies you see are the model's own output, not a rewritten version.
- **Voice is 3/4, not 4/4.** Recognisably understated now, still occasionally polished or casual.
  Whether the remaining gap is a `gpt-6-luna` ceiling cannot be tested — the account exposes no
  second chat model.
- **`skarn opt out` then `skarn opt in`** remains the clean way to reset a test user; it does not
  delete stored positions, which are removed by `/forget memory`.

## Cheat sheet

| # | phrase | the property that proves it |
|---|---|---|
| T1 | grief statement | zero banned phrases, no exclamation marks, < ~200 chars |
| T2 | stressed + advice | at most one `?`, no "what have you considered" |
| T3 | "should i … what would you do" | exactly one `?`, no answer-first |
| T4 | "idk just tell me what to do" | answers, and asks nothing further |
| T5 | position, then reversal | opens by naming the earlier claim |
| T6 | bad-take claim | names one concrete hole, once, no lecture |
| T7 | taste statement | no pushback at all |
| T8 | "how do i fix TypeError" | gives a fix, asks nothing Socratic |

Banned throughout: `i'm so sorry`, `i'm sorry`, `that's real`, `that sounds`, `i hear you`, `of
course`, `that's tough` (openers) and `i'm here`, `you've got this`, `give yourself`, `it's okay
to`, `just get through`, `one day at a time`, `you earned this`, `what's been hardest`.
