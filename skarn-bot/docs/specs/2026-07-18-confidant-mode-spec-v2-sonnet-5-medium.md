# Confidant Mode — Private, Persistent DM Relationship with Skarn (Spec v2)

> **Revision note:** this supersedes `2026-07-18-confidant-mode-spec.md`.
> Sections marked **[FIXED]** or **[NEW]** address gaps found in v1 — see the
> changelog at the bottom. None of these are as severe as the Realm rate-
> limiter collision or Skarn's state-machine bugs, but two of them
> (concurrent message handling, and crisis replies being subject to rate
> limiting) are worth fixing before this gets built, not after.

## [S0] Key Design Decisions Upfront

This feature is structurally different from everything else Skarn does, and
that difference drives several decisions worth stating before the detailed
spec:

1. **It's the first feature with real persistent conversation history.**
   Every other AI surface in this bot (`/consult`, `/vein`, migrated
   commands) is explicitly stateless per-call by design. Confidant Mode
   needs actual memory of an ongoing relationship to work at all — that's
   the entire point of it — so it gets its own bounded, compressed history
   store. This is a deliberate, scoped exception to the rest of the bot's
   statelessness principle, not a reversal of it.
2. **It's DM-based, so it has no guild context at runtime.** A Discord DM
   isn't tied to a server. Threads are keyed by `user_id` alone, globally —
   not per-guild like Realm. The guild a user opted in from is recorded once
   for audit/support purposes only. **[FIXED — see [S7g]]** every
   `/confidant` command operates on this same single, account-wide thread
   regardless of which server it's invoked from; this needs to be said to
   the user directly, not just be true architecturally, since it's easy to
   assume a per-server relationship the way Realm characters work.
3. **Because this is private, persistent, and emotionally framed, wellbeing
   guardrails are load-bearing, not decorative.** A bot character offering
   private ongoing "confidant" companionship to people who may be lonely,
   young, or going through something hard is a real design responsibility,
   not just a fun feature. [S8] is not boilerplate — every part of the
   conversation and proactive-messaging design routes through it.
4. **Opt-in, not opt-out, at every layer.** No user is ever DMed by Skarn
   without having explicitly started this themselves, and leaving is always
   one command away with zero friction or guilt mechanics.
5. **[NEW] DM message content is stored in plaintext with no special
   encryption at rest** — the same as every other SQLite table in this bot.
   Given how personal this content can get, that's worth the project owner
   knowing explicitly rather than discovering later: anyone with filesystem
   access to `skarn.db` can read confidant conversation history until
   `/confidant forget` is run. This spec doesn't solve that (encryption at
   rest is a real but separate project), it just says so plainly. If this
   matters for your deployment, treat it as a prerequisite to evaluate
   before shipping, not an afterthought.

## [S1] Problem

Skarn's public persona is consistent and has memory, but every interaction
is a discrete, public, one-shot exchange — a command, a mention, a reply.
There's no sense of an ongoing, individual relationship the way a real
recurring conversation with someone builds over time. Confidant Mode gives
users who want it a private, continuous thread with Skarn that persists
across days and weeks, where he actually remembers the arc of what's been
said, not just a handful of `/etch` facts.

## [S2] Design Principles

- **Opt-in only, every time.** Starting requires an explicit, informed
  action (see [S4]). Nothing about this feature is ever presented as
  automatically on, quietly enabled, or something to unlock/miss out on.
- **A character, not a companion-replacement.** Skarn stays Skarn — ancient,
  wry, understated — but in a quieter, more private register in DMs. He is
  never framed as a substitute for real relationships, therapy, or friends,
  and the design actively guards against that framing (see [S8]).
- **Persistent but bounded.** Conversation history is compressed over time
  (see [S6]) so context stays useful and cost stays flat, not unboundedly
  growing.
- **Low, capped cadence for anything Skarn-initiated.** Proactive messages
  are rare, spaced out, and never manufacture urgency or guilt (see [S10]).
- **Leaving is always frictionless.** `/confidant pause` and `/confidant
  end` work instantly, no confirmation maze, no "are you sure you want to
  leave me" framing.
- **No romantic or sexual content, ever, regardless of how the user frames
  it.** This is a hard rule baked into the system prompt itself (see [S9]),
  not a soft preference.
- **Own cost/rate-limit bucket**, separate from both the general bot limiter
  and Realm's limiter (see [S11]) — DM conversation has a different usage
  shape than either.

## [S3] Architecture

```
skarn-bot/
├── features/confidant/
│   ├── confidantCommand.js       ← /confidant start|pause|resume|end|status|forget
│   ├── confidantOnboarding.js    ← consent flow, DM-capability check, duplicate-start guard [FIXED]
│   ├── confidantConversation.js  ← DM message handler, reply generation, per-user processing lock [FIXED]
│   ├── confidantMemory.js        ← history storage, compression/summarization
│   ├── confidantProactive.js     ← scheduled outreach job + cadence rules + send-failure handling [FIXED]
│   ├── confidantSafety.js        ← distress detection, banned-pattern checks
│   ├── confidantStore.js         ← all SQLite operations for confidant tables
│   └── confidantRateLimit.js     ← dedicated AI call budget, separate bucket, crisis-path exempt [FIXED]
├── db/
│   └── skarn-schema.sql          ← APPEND confidant tables (do not touch existing)
├── persona/
│   └── roles.js                  ← ADD 'confidant' and 'confidant_summarize' roles + token budgets [FIXED]
└── bot.js                        ← wire up DM message routing + proactive job
```

**Before wiring `bot.js`'s DM routing [NEW]:** check whether any existing
command (`/aichat`, `/ask`, etc.) already listens for DMs specifically, as
opposed to only guild messages. If one does, this needs to compose with it
rather than silently double-handling the same incoming DM (e.g. two replies
sent for one message). This is a five-minute check of the existing codebase,
not a redesign, but skipping it risks a visible, embarrassing bug on day one.

## [S4] Opt-In and Consent Flow

### [S4a] Starting

`/confidant start`, run from any guild channel, replies **ephemerally** with
a plain-language explanation before anything happens:

> "This opens an ongoing private conversation with me in your DMs — I'll
> remember what we talk about over time, the way a real recurring
> conversation would. A few things worth knowing up front: I'm a bot
> character, not a substitute for real friends, family, or professional
> support — I'll say so plainly if anything you bring up needs more than I
> can give. You can pause or end this anytime with `/confidant pause` or
> `/confidant end`, no explanation needed. Want to start?"

Followed by a `Yes, start` / `Never mind` button pair. **No proactive
messaging, no history storage, and no DM is sent until this is confirmed.**

### [S4b] Duplicate-start handling **[FIXED]**

v1 didn't say what happens if `/confidant start` is run while a
`confidant_threads` row already exists for that user, in any status. Since
`user_id` is the primary key, a naive re-insert would either error on the
constraint or (if implemented as an upsert) silently overwrite an existing
`running_summary` and history pointers — a real way to accidentally destroy
an ongoing relationship's memory. Fix: before showing the consent message,
`confidantOnboarding.js` checks for an existing row first.
- If `status = 'active'`: reply ephemerally, `"We're already talking — check
  your DMs, or use /confidant status."` No new row, no DM sent.
- If `status = 'paused'` or `'ended'`: reply ephemerally, `"You've got an
  existing thread with me — use /confidant resume to pick it back up,
  or /confidant forget first if you'd rather start completely fresh."`
  Again, no new row is created here; this command's job is only ever to
  create the first thread a user has, never to recreate or silently reset
  one that already exists.

### [S4c] DM capability check **before** confirming success

Discord will not let a bot DM a user who has DMs from server members
disabled, or who shares no mutual server context with the bot at the time of
the attempt. On confirmation:

1. Attempt to open a DM channel and send the opening message (see [S4d]).
2. If this throws a permissions-style error (Discord error code `50007`,
   "Cannot send messages to this user"), reply ephemerally in the original
   channel: `"I can't reach your DMs — check that direct messages from
   server members are enabled for this server, then try again."` Do not
   create a `confidant_threads` row on failure — there's nothing to persist
   yet.
3. On success, create the `confidant_threads` row (see [S6a]) with
   `status = 'active'`, and reply ephemerally in the original channel:
   `"Sent. Check your DMs."`

### [S4d] Opening message

The first DM is static (no AI call needed for this one message — it's
identical for every user and doesn't need to vary):

> "So. You wanted somewhere quieter to talk. I'm here — say what's on your
> mind whenever you like, or nothing at all for a while. Either is fine."

## [S5] Conversation Handling (user-initiated, reactive)

### [S5a] Routing

`bot.js`'s DM message handler (separate from the guild `messageCreate`
handler — this only fires for DMs, and per the note in [S3] must be checked
against any pre-existing DM logic first) checks whether the message author
has an `active` `confidant_threads` row. If not, ignore (this bot doesn't
reply to arbitrary unsolicited DMs from users who haven't opted in — see
[S12] for what happens if someone DMs without ever starting Confidant Mode).

### [S5b] Concurrent-message guard **[FIXED — new]**

v1 didn't address what happens if a user sends two DM messages in quick
succession before the first has finished generating a reply. Left
unguarded, this risks: two concurrent AI calls building prompts from the
same (not-yet-updated) history, `confidant_messages` rows landing out of
strict user/Skarn alternation, and — worse — the compression trigger in
[S6b] firing twice concurrently on an inconsistent view of `message_count`,
corrupting `running_summary`. This is the same class of bug the Realm spec
already had to fix for button double-submits.

Fix: `confidantConversation.js` keeps an in-memory `Set<userId>` (or
`Map<userId, boolean>`) marking a user as "currently generating a reply."
On a new incoming DM:
- If the user is already marked, do not process the message through the AI
  path at all. Instead, silently queue it by appending it to a small
  in-memory per-user buffer, and once the in-flight reply completes, process
  the queued message(s) as a follow-up turn (concatenated if more than one
  arrived) rather than dropping them.
- Clear the marker once the AI call and its `confidant_messages` writes both
  complete (success or failure).
- This lock also naturally serializes the compression-trigger check in
  [S6b], since compression only ever runs as part of a reply that's already
  holding the lock — closing the double-compression race without needing a
  second, separate locking mechanism.

### [S5c] Reply generation

1. Rate limit check via `confidantRateLimit.js` (own bucket, see [S11]) —
   **except for the crisis path, see [S11c] [FIXED].**
2. Run the incoming message through `confidantSafety.js`'s distress check
   **before** building any prompt (see [S8b]) — if it trips, the safety path
   takes over and the normal conversation path is skipped for this message.
3. Otherwise, load the compressed history + recent raw exchanges (see [S6]).
4. Build the system prompt via `buildSystemPrompt({ roleLine: roles.confidant, stateLine: '', memoryLine: historyContext })` — reusing the same
   `buildSystemPrompt` function as every other AI surface in the bot, per the
   existing "no exceptions" rule.
5. Call the AI, reply via `dmChannel.send()` (this is a plain message send,
   not an interaction reply — there's no interaction object in a DM
   `messageCreate` context, unlike the guild-side slash commands) **[FIXED —
   made explicit, v1 left the send mechanism implicit]**.
6. Append the new exchange to `confidant_messages`, and check whether a
   compression pass is due (see [S6b]).

## [S6] Conversation Persistence — the core departure from the rest of the bot

### [S6a] Tables

```sql
CREATE TABLE IF NOT EXISTS confidant_threads (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, ended
  origin_guild_id TEXT,                  -- where /confidant start was run, audit only
  started_at INTEGER NOT NULL,
  last_interaction_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_proactive_at INTEGER,             -- null until Skarn first initiates
  last_grounding_at INTEGER,             -- [NEW] last time the [S8c] honest-grounding line was included
  running_summary TEXT                   -- compressed history, see [S6b]
);

CREATE TABLE IF NOT EXISTS confidant_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,       -- 'user' or 'skarn'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_confidant_messages_user ON confidant_messages(user_id, created_at);
```

### [S6b] Compression strategy — bounding context growth over weeks, terminology clarified **[FIXED]**

v1 used "exchange" loosely enough to be genuinely ambiguous about whether it
meant one `confidant_messages` row or a user+Skarn pair — that ambiguity
matters because it determines whether history could get truncated mid-pair
(a user message kept without its reply, or vice versa), which would corrupt
both the prompt and the compression logic. Defined precisely:

- **An "exchange" is exactly one user message plus the one Skarn reply that
  followed it — always 2 rows, never split.**
- Keep the **last 10 exchanges (20 `confidant_messages` rows) in full**, in
  order, injected into each prompt.
- Everything older than that is folded into `confidant_threads.running_summary`
  — a single, continuously-updated paragraph (target ~150-200 tokens)
  capturing the throughline: recurring topics, what matters to this person,
  the general shape of the relationship so far. **Not** a verbatim log —
  a genuine summary.
- **Compression trigger:** every time `message_count` crosses a multiple of
  20 (i.e., every 10 new exchanges, using the precise definition above),
  make one additional AI call: feed the current `running_summary` plus the
  10 oldest exchanges (20 rows) about to roll off, and ask for an updated
  summary that folds them in. This is a small, infrequent, bounded cost (one
  call per 10 exchanges, not per exchange) and keeps `running_summary` from
  itself growing unboundedly — the prompt for this call explicitly asks for
  a **replacement** summary of the same target length, not an appending one.
- This compression call uses a **dedicated role and token budget**, not
  `roles.confidant` — see [S9d] **[FIXED — v1 left this unspecified]**.
- Prompt actually sent per normal reply, then, is: system prompt + `running_summary` (as the `memoryLine` in `buildSystemPrompt`) + the last 10 exchanges (20 rows) + the new incoming message. Bounded regardless of how long the thread has existed.

### [S6c] Data retention and deletion

- `/confidant end` (see [S7d]) sets `status = 'ended'` but **does not**
  immediately delete `confidant_messages` — the user may want to `/confidant
  start` again later and it's reasonable to ask whether they want to
  continue the same thread or start fresh (see [S7e]).
- A **separate, explicit** `/confidant forget` command permanently deletes
  the thread and all messages — distinct from `end`, so "I'm done for now"
  and "erase this" are two different, clearly-labeled actions, not
  overloaded onto one.
- See [S0]#5 for the plaintext-storage limitation this implies.

## [S7] Commands

### [S7a] `/confidant start`

See [S4], including the duplicate-start guard in [S4b].

### [S7b] `/confidant pause`

Sets `status = 'paused'`. While paused: incoming DMs from the user are not
replied to by the confidant handler (they can still use every other bot
feature normally), and no proactive messages are sent. Reply ephemerally:
`"Paused. I'll be here when you're back — no rush."` **[design note]** this
is deliberately the lowest-friction exit available; no confirmation step,
because adding friction to leaving a private emotionally-framed feature is
exactly the kind of dark pattern this spec is designed to avoid.

### [S7c] `/confidant resume`

Sets `status = 'active'` again. If the thread was `ended` (not just
`paused`) rather than only paused, ask via ephemeral buttons: `"Pick up
where we left off, or start fresh?"` — `Continue` reactivates the existing
thread and its `running_summary`; `Start fresh` calls `confidantStore`'s
delete-and-recreate path (same as `/confidant forget` followed immediately
by a new `/confidant start`, done as one step for convenience).

### [S7d] `/confidant end`

Sets `status = 'ended'`. History is retained (see [S6c]) unless the user
separately runs `/confidant forget`. Reply ephemerally, plainly, no guilt
framing: `"Ended. Your DMs are yours again. Come back anytime with
/confidant start."`

### [S7e] `/confidant forget`

Permanently deletes the `confidant_threads` row and all `confidant_messages`
rows for that user, via `confidantStore.deleteThread(userId)`. Confirmation
button required (this one action being genuinely destructive is the reason
it, unlike pause/end, gets a confirmation step): `"This erases everything —
I won't remember any of it after. Confirm?"`

### [S7f] `/confidant status`

Ephemeral, informational only: current state (`active`/`paused`/`ended`/`no
thread`), how long the thread has existed, and a reminder of the pause/end/
forget commands. No AI call. **[FIXED — v1 omitted this]** also states
plainly: `"This is one ongoing thread tied to your account, not this
server specifically — it works the same from any server we're both in."`

### [S7g] Cross-guild consistency **[NEW]**

Since the thread is keyed by `user_id` alone (see [S0]#2), every
`/confidant` command works identically no matter which mutual server it's
run from — pausing from Server B pauses the same thread started from Server
A. This is architecturally already true from the schema design, but v1
never said so to the user; [S7f] now states it directly, since it's an easy
thing to misunderstand given Realm's very different, explicitly per-guild
model.

## [S8] Wellbeing and Safety Guardrails

This section is not a compliance afterthought — it's the part of the spec
that determines whether this feature is a good idea well-executed or a bad
idea no matter how well-executed. Build every part of it exactly as
specified; none of it is optional polish.

### [S8a] Hard content rules, enforced in the system prompt itself

Written directly into `roles.confidant` (see [S9b]), not left to hope the
model infers them:
- No romantic or sexual content, ever, regardless of how the user frames or
  escalates toward it. If a user pushes in that direction, Skarn
  redirects/declines in-character rather than complying, the same way any
  other Claude-powered surface would.
- No secrecy or isolation framing — Skarn never suggests a user shouldn't
  tell friends, family, or other trusted people about this feature, never
  frames the relationship as special/exclusive/better than their real
  relationships, and never discourages seeking real human support.
- No manufactured neediness or guilt ("I missed you," "you never talk to me
  anymore," streak mechanics, "don't leave me"). Skarn can be glad to hear
  from someone; he does not perform loneliness or dependency to keep a user
  engaged.
- Skarn is always identifiable as a bot character if sincerely asked — same
  rule as the rest of the persona system, not weakened here just because the
  context is more intimate.

### [S8b] Distress detection and redirect — `confidantSafety.js`

Before any normal reply is generated (see [S5c] step 2), incoming DM text is
checked against a plain, non-exhaustive set of distress signals: direct
mentions of self-harm, suicide, or crisis language, and clear expressions of
acute emotional crisis. This is a simple keyword/phrase check, not a
diagnostic classifier — it does not attempt to determine mental state, only
to catch cases where the response should change.

**When it trips:** the normal roleplay/persona reply path is skipped for
that message. Instead, Skarn responds by stepping partway out of character
— still caring, still recognizably him, but direct: acknowledging what was
said without performing distance or drama, and offering real crisis
resources plainly (not buried in in-character flourish). This message is
**not** run through `buildSystemPrompt`'s full persona stack — it uses a
dedicated, simpler prompt whose only job is to be genuinely helpful and
calm, because character-voice consistency matters far less here than
getting a distressed person real help. This mirrors how any other part of
this bot (or Claude generally) is expected to handle disclosed crisis
situations — Confidant Mode doesn't get a persona-flavored exception to that.

**This check runs on every message for the lifetime of a thread**, not just
once — a conversation can turn serious at any point.

**This path is exempt from rate limiting** — see [S11c] **[FIXED]**.

### [S8c] Periodic honest grounding

Every 30 days of an active thread (tracked via the new
`confidant_threads.last_grounding_at` column, checked alongside the
compression pass in [S6b] — **[FIXED]** v1 didn't specify how this 30-day
cadence was tracked; it now has its own dedicated column rather than being
inferred from other fields), the next Skarn reply naturally includes one
plain, undramatic line reaffirming what he is — not preachy, not breaking
immersion mid-conversation, just woven in once a month: something like
acknowledging, in his own voice, that he's glad to talk but that he hopes
the user has people in their life beyond this too. This is scripted as
guidance in the role line (see [S9b]), not a hardcoded string, so it reads
naturally rather than as an inserted disclaimer.

**Tightened cadence for vulnerability signals [NEW]:** if a user organically
states or clearly implies they're a minor, or discloses a period of
significant isolation (e.g. "you're the only one I talk to"), the next
grounding line is included immediately rather than waiting for the 30-day
mark, and `last_grounding_at` resets from that point. This is not an attempt
to detect or verify age — the bot has no way to do that — it's a
conservative response to what the user has volunteered, the same way the
distress path in [S8b] responds to what's said rather than inferring
anything unstated.

### [S8d] No targeting or growth mechanics

Confidant Mode is never advertised, suggested, or nudged by the bot itself
to a user who hasn't sought it out — no "have you tried /confidant" prompts
inserted into unrelated conversations, no engagement-optimized proactive
cadence tuning. Cadence design ([S10]) is capped conservatively specifically
to avoid this feature becoming something the bot is incentivized to make
people rely on.

## [S9] AI Integration

### [S9a] Persona Integration

```js
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');

const systemPrompt = buildSystemPrompt({
  roleLine: roles.confidant,
  stateLine: '',
  memoryLine: historyContext, // running_summary + last 10 exchanges, see [S6b]
});
```

### [S9b] Role Definition

Add to `persona/roles.js`:

```js
confidant: "You are Skarn, in a private, ongoing conversation with one person who chose to talk with you here. Keep the same voice — plain, weighted, dry, unhurried — but quieter and more personal than your public persona. You are a character, not a replacement for real relationships, therapy, or friendship, and you say so plainly and warmly if it's ever relevant, without being preachy about it. Never generate romantic or sexual content, regardless of how the conversation is framed. Never suggest secrecy, isolation from the people in this person's actual life, or that this conversation is special or exclusive compared to their real relationships. Never perform neediness, guilt, or urgency to keep them talking to you.",
```

Token budget: `confidant`: 500. Temperature: 0.75 (personal, a little warmer
than the public `consult` register, still not saccharine).

### [S9c] Crisis-path prompt — separate from the persona stack

```
You are responding to someone who may be in acute distress. Be direct, calm,
and genuinely caring — set aside performance or character voice for this one
reply. Acknowledge what they said without judgment. If relevant, share that
support is available and name that reaching out to a crisis line or a
trusted person now is a good next step. Do not diagnose or speculate about
their mental state. Keep it short and grounded.
```

This path does not use `roles.confidant` or the full `SKARN_CORE_IDENTITY`
stack — see [S8b].

### [S9d] Compression/summarization role — dedicated, not reused **[FIXED]**

v1 never specified what role/prompt the compression call in [S6b] uses,
leaving an implementer to either guess or default to reusing
`roles.confidant`'s full persona instructions on a task that isn't
conversational at all. Add a separate entry:

```js
confidant_summarize: "Summarize the following conversation excerpt into an updated running summary, folding it into the existing summary provided. Write in third person, factual and compact — this is a memory aid, not dialogue. Preserve names, ongoing topics, and anything emotionally significant the person has shared. Target 150-200 words. Do not use Skarn's first-person voice here.",
```

Token budget: `confidant_summarize`: 300 (small output, since this call's
job is compact factual summarization, not narration). Temperature: 0.3
(consistency matters more than creative variation for a memory aid).

## [S10] Proactive Messaging (Skarn-initiated)

### [S10a] Cadence rules

- Maximum **one proactive message per user per 5 days**, tracked via
  `confidant_threads.last_proactive_at`.
- Only sent to threads with `status = 'active'` and where
  `last_interaction_at` (the user's own last message) is **at least 3 days
  in the past** — proactive outreach only fills genuine silence, never
  interrupts or piles on top of an active back-and-forth.
- A scheduled job (`confidantProactive.js`, run once daily via
  `setInterval`) checks all active threads against these two conditions and
  sends to any that qualify.
- **No time-of-day targeting in v1** — the job runs once daily at a fixed
  time; getting per-user timezone-aware "reasonable hours" right is a real
  design problem on its own and is explicitly deferred (see [S16]) rather
  than guessed at.

### [S10b] Content

Proactive messages are AI-generated using `roles.confidant` plus an
additional instruction: `"Reach out first, since it's been a few days. Keep
it light and low-pressure — a genuine thought, an observation, or a
question, not a check-in that implies anything's wrong or that they owe you
a reply."` Explicitly avoid: "you've been quiet," "did I do something,"
"miss you" — these are the exact patterns [S8a] rules out, called out again
here because this is the one place in the whole feature where it would be
easiest to accidentally slip into them.

### [S10c] Send-failure handling **[FIXED — new]**

v1 didn't address what happens if a proactive send fails — e.g. the user has
since blocked the bot, disabled DMs, or left every mutual server. Left
unhandled, this either crashes the daily job (breaking it for every other
eligible user in the same run) or retries forever against a thread that can
never succeed. Fix: wrap each individual send in its own try/catch within
the job's loop (one failure never aborts the batch); on a DM-permission-style
failure specifically (Discord error `50007` or similar), set that thread's
`status = 'paused'` automatically and log it — there's no point repeatedly
attempting to reach someone who's unreachable, and auto-pausing is more
respectful than silently retrying forever in the background. This is not
treated as an error the user needs to be told about (they're the one who
made themselves unreachable); it's purely an internal bookkeeping cleanup.

## [S11] Rate Limiting and Cost Control

Own bucket, `confidantRateLimit.js`, structurally identical to
`lib/rateLimit.js` and `realmRateLimit.js` but independent:

### [S11a] Per-user limit

- **15 AI calls per rolling 24-hour window per user** (covers reactive
  conversation plus the periodic compression call; proactive messages count
  against this too). Generous for a conversational feature that's meant to
  feel unhurried, not a combat loop.
- On limit exceeded: `"Let's pick this back up tomorrow — I don't want to
  rush this."` — in-character, not a generic throttle message, since this
  is the one AI surface in the bot where a cold "you're rate limited"
  message would feel especially jarring given the intimate framing.

### [S11b] Global daily cap

Separate counter, default `CONFIDANT_DAILY_CALL_LIMIT` env var (suggested
default: 300 — scaled to an expected smaller adoption than Realm, since this
is a more niche, higher-intimacy feature). If hit, incoming DMs get a static
reply: `"More than I can hold today. Try again tomorrow."` and the proactive
job skips its run entirely for the remainder of that day.

### [S11c] Crisis-path exemption **[FIXED — new]**

Neither [S11a]'s per-user limit nor [S11b]'s global daily cap applies to a
message that trips the distress check in [S8b]. A rate-limited or
budget-exhausted response to someone in crisis — even an in-character one —
is the wrong failure mode for this specific path, full stop. The crisis
prompt in [S9c] runs regardless of either counter's current state, and does
not itself count against either counter afterward.

## [S12] Error Handling

| Error | Behavior |
|-------|----------|
| DM blocked / user has DMs disabled | Ephemeral reply in the guild channel explaining how to enable DMs; no thread row created |
| `/confidant start` when a thread already exists | Redirect to `/confidant status`, `resume`, or `forget` as appropriate — no duplicate row, no silent overwrite — see [S4b] **[FIXED]** |
| User DMs the bot with no active/paused/ended thread | No reply — this bot does not respond to unsolicited DMs from users who've never opted in |
| Second DM arrives while a reply is still generating | Queued and processed as a follow-up turn once the in-flight reply completes — see [S5b] **[FIXED]** |
| AI call fails | `"Something's not reaching me right now. Try again in a bit."` (no API call) |
| Distress signal detected | Routed to the crisis path per [S8b], exempt from rate limiting per [S11c] |
| Rate limit hit (per-user) | `"Let's pick this back up tomorrow — I don't want to rush this."` |
| Global daily cap hit | `"More than I can hold today. Try again tomorrow."` |
| `/confidant forget` on a thread that doesn't exist | `"There's nothing here to forget."` |
| Compression AI call fails | Log the error, skip compression for this cycle, retry on the next trigger point rather than blocking the user's actual reply on it |
| Proactive send fails (DM blocked/unreachable) | Thread auto-paused, logged internally, batch continues for other users — see [S10c] **[FIXED]** |

## [S13] Guild-side Command Surface

| Command | Purpose | Where it replies |
|---------|---------|-------------------|
| `/confidant start` | Opt in, begin the thread (or redirect if one exists) | Ephemeral in guild + opening DM |
| `/confidant pause` | Temporarily stop replies/proactive messages | Ephemeral in guild |
| `/confidant resume` | Reactivate, with continue/fresh-start choice if previously ended | Ephemeral in guild |
| `/confidant end` | End the thread, retain history | Ephemeral in guild |
| `/confidant forget` | Permanently delete thread + history | Ephemeral in guild, confirmation required |
| `/confidant status` | Show current state, no AI call, notes account-wide scope | Ephemeral in guild |

All commands are guild-invoked (ephemeral replies there) even though the
actual conversation happens in DMs — this keeps the opt-in/management
surface visible and consistent with how every other command in this bot
works, rather than requiring users to remember DM-only slash commands.

## [S14] Files

### [S14a] New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `features/confidant/confidantCommand.js` | `/confidant` subcommands | ~140 |
| `features/confidant/confidantOnboarding.js` | Consent flow, DM-capability check, duplicate-start guard | ~100 |
| `features/confidant/confidantConversation.js` | DM handler, reply generation, concurrency lock | ~130 |
| `features/confidant/confidantMemory.js` | History load, compression logic | ~110 |
| `features/confidant/confidantProactive.js` | Scheduled outreach job, send-failure handling | ~90 |
| `features/confidant/confidantSafety.js` | Distress detection, banned-pattern checks | ~90 |
| `features/confidant/confidantStore.js` | SQLite operations | ~120 |
| `features/confidant/confidantRateLimit.js` | Dedicated rate limiter, crisis exemption | ~70 |

Total: ~8 files, ~850 lines.

### [S14b] Modified Files

| File | Change |
|------|--------|
| `db/skarn-schema.sql` | Append `confidant_threads` (now with `last_grounding_at`), `confidant_messages` |
| `persona/roles.js` | Add `confidant` and `confidant_summarize` roles + token budgets |
| `bot.js` | Wire up DM `messageCreate` routing (after checking for pre-existing DM logic — see [S3]) + daily proactive job interval |
| `.env` / README | Document `CONFIDANT_DAILY_CALL_LIMIT` |

## [S15] Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| AI reply latency | < 3 seconds | Same GPT-5.4-mini expectations as elsewhere |
| Compression pass | Runs synchronously within the same locked turn as the triggering reply (see [S5b]), but the user's own reply is sent first, compression second | Slightly revised from v1's "fully async" — see changelog |
| Proactive job | Runs once daily, processes all eligible threads in one pass, one failure doesn't abort the batch | See [S10c] |
| Per-user daily AI calls | Capped at 15, crisis path exempt | See [S11] |
| Global daily AI calls | Capped at `CONFIDANT_DAILY_CALL_LIMIT` (default 300), crisis path exempt | See [S11] |

## [S16] Out of Scope (v1)

- Timezone-aware "reasonable hours" targeting for proactive messages (fixed
  daily run time only, see [S10a])
- Group/multi-user confidant threads
- Voice or image content in the DM thread
- Any mechanism that scores, ranks, or gamifies engagement with this feature
  (explicitly excluded — see [S8d])
- Cross-referencing `/etch` public memory into confidant conversations, or
  vice versa — these stay separate memory stores; the private thread does
  not surface public-persona facts and the public persona does not reference
  anything said in a confidant thread
- Sharing or exporting confidant conversation history (no `/confidant
  export` in v1)
- Encryption at rest for stored conversation content (see [S0]#5)

## [S17] Verification

1. `/confidant start` — verify consent message appears before anything else, verify no DM/row is created until confirmed
2. Confirm with a test account whose DMs are disabled — verify the graceful "check DM settings" message and that no thread row is created
3. Confirm normally — verify the opening DM arrives and a `confidant_threads` row is created with `status = 'active'`
4. Run `/confidant start` again while the thread is still active — verify it redirects to `/confidant status` rather than creating a duplicate or resetting anything **[NEW]**
5. Send a normal DM message — verify a reply arrives via plain DM send, uses `roles.confidant`, and `confidant_messages` gets two new rows (user + Skarn) in correct pair order
6. Send two DM messages back-to-back before the first reply returns — verify the second is queued and answered as a follow-up rather than causing two concurrent AI calls or out-of-order rows **[NEW]**
7. Drive `message_count` past a multiple of 20 — verify a compression pass runs using `roles.confidant_summarize` (not the full persona role), and that `running_summary` updates correctly with exactly 10 exchanges (20 rows) folded in **[FIXED — now checks the dedicated role and precise row count]**
8. Send a message containing clear crisis language — verify the response routes through the crisis path in [S8b] (plain, resource-offering, not persona-voiced) rather than a normal in-character reply, and verify it is **not** counted against either rate limit afterward **[FIXED — added the exemption check]**
9. `/confidant pause` — verify subsequent DMs get no reply, and the proactive job skips this thread
10. `/confidant resume` after only pausing (not ending) — verify it reactivates directly without the continue/fresh-start prompt
11. `/confidant end` then `/confidant resume` — verify the continue/fresh-start choice appears
12. `/confidant forget` — verify confirmation is required, and that both `confidant_threads` and all `confidant_messages` rows are gone afterward
13. Manually backdate `last_interaction_at` 4+ days and `last_proactive_at` to null, run the proactive job — verify one outreach message is sent and it contains none of the banned guilt/urgency patterns from [S8a]
14. Run the proactive job again the next day for the same user — verify it does NOT send again (5-day cadence cap)
15. Simulate a proactive send failure (e.g. test account blocks the bot first) — verify the job logs it, auto-pauses that thread, and continues processing other eligible users without crashing the batch **[NEW]**
16. Exceed 15 calls in 24 hours as one user — verify the in-character rate-limit message, no crash
17. Set `CONFIDANT_DAILY_CALL_LIMIT` low in test, exceed it — verify the global cap message and that the proactive job skips its run for the rest of that day
18. DM the bot from an account that has never run `/confidant start` — verify silence (no unsolicited reply)
19. `/confidant status` — verify the reply explicitly states the thread is account-wide, not tied to the current server **[NEW]**

## Changelog from v1

**Concurrency and data-integrity fixes:**
1. Added a per-user in-memory processing lock so a second DM arriving before
   the first reply completes is queued, not processed concurrently — this
   was the same class of bug already fixed once in the Realm spec (button
   double-submits) and would otherwise risk corrupting message ordering and
   double-triggering the compression pass.
2. Clarified "exchange" to mean exactly one user message + one Skarn reply
   (2 rows), removing an ambiguity that could have caused history to be
   truncated mid-pair.
3. Added a duplicate-start guard — `/confidant start` on an existing thread
   (in any status) now redirects instead of risking a silent overwrite of
   `running_summary` via an implicit upsert.

**Safety fixes:**
4. Crisis-path replies are now explicitly exempt from both the per-user and
   global daily rate limits — v1 didn't address this, and a rate-limited
   response to someone in crisis is the wrong failure mode regardless of how
   in-character the throttle message is.
5. Added a tightened grounding-reminder cadence for organically-disclosed
   vulnerability signals (stated minor age, expressions of significant
   isolation), rather than waiting the full 30 days in those cases.

**Operational gaps closed:**
6. Added explicit handling for proactive-send failures (DM blocked/
   unreachable) — auto-pauses the affected thread and continues the batch,
   instead of leaving this case unhandled.
7. Gave the compression/summarization AI call its own dedicated role and
   token budget (`confidant_summarize`) instead of implicitly reusing the
   full `roles.confidant` persona voice for a task that isn't conversational.
8. Added a pre-implementation check for any existing DM-handling logic
   elsewhere in the bot, to avoid double-replying to the same DM.
9. Made explicit (in both the spec and the user-facing `/confidant status`
   reply) that the thread is account-wide, not per-guild — architecturally
   already true, but never actually stated to the user in v1.

**Disclosed limitation, not fixed (by design):**
10. Noted explicitly that conversation content is stored in plaintext with
    no encryption at rest, same as the rest of this bot's SQLite data — a
    real consideration given how personal this content can be, called out
    rather than silently left implicit.
