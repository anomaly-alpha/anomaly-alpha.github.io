# Chronicle & Omen — Server Memory and Prophecy Features

## [S0] Key Design Decisions Upfront

1. **These are two features that share one underlying idea: Skarn chronicling
   his own realm's history and casting prophecies about it**, not two unrelated
   commands bundled for convenience. Unlike the original design (server-activity
   digest), Chronicle and Omen are anchored to the Realm of Skarn subsystem —
   Realm milestones (boss defeats, quest completions, character progression)
   are the primary narrative material. Non-Realm signals (reaction spikes,
   level-ups) are secondary texture. Chronicle reads like Skarn's war journal;
   Omen reads like a demon lord's portents about his domain. They also share
   one piece of infrastructure — a lightweight, low-volume "signal capture"
   log — rather than each building its own.
2. **Neither feature logs full chat history.** Given the plaintext-storage
   concern already flagged elsewhere in this project's design history, both
   features deliberately capture only short, specific, capped excerpts tied
   to clear trigger conditions (a reaction spike, a mood-state transition, a
   milestone event) — never a running log of everything said.
3. **Omen is explicitly a flavor mechanic, not a prediction claim.** It
   works by retrospective pattern-matching (does something that happened
   loosely resemble an old cryptic line?), never by anything resembling real
   forecasting. This is a design note worth being deliberate about: the fun
   comes from Skarn *noticing a coincidence after the fact* and narrating it
   well, the same way a fortune teller's "predictions" work in fiction —
   there's no claim of real predictive power anywhere in this spec, and none
   should be implied to users either.
4. **Both features need a "don't embarrass or target someone" guardrail
   more than almost anything else built so far**, because both are public,
   both surface things Skarn "noticed" about real people without being
   asked to, and neither has the opt-in gate Confidant Mode or Derived
   Memory have. That asymmetry is handled explicitly in [S6] and [S11]
   rather than assumed to be fine by default.

## [S1] Problem

Skarn has plenty of memory systems now, but all of them are either
individual (`/etch`, Derived Memory, Confidant) or fictional (Realm). Nothing
reflects the Realm of Skarn as a *living world with a history* — the boss
the party spent three days grinding down, the quest chain that reshaped the
Crimson Tower, the character who reached level 20 and retired a legend.
Chronicle gives the Realm a periodic, narrated sense of its own recent past,
woven from its own events. Omen gives Skarn a way to drop demon-lord
prophecies about his domain — something cryptic now that pays off later when
Realm events loosely match the portent.

## [S2] Design Principles

- **Celebrate, never expose.** Both features surface things that happened
  without anyone explicitly asking Skarn to remember them — that's a real
  responsibility. Neither ever rehashes an argument, references someone's
  hard moment, or singles a person out unflatteringly.
- **Signals, not surveillance.** Capture is narrow and trigger-based, not a
  standing log of channel activity.
- **Vague enough to be fun, never specific enough to be a claim.** Omens
  never name a real person or make a statement that could read as a threat,
  prediction about someone's real life, or something someone might take
  literally.
- **Low cadence, high payoff.** Both post rarely. The value is in restraint
  — a chronicle every week and an omen every few days feels like Skarn is
  paying attention; either running more often would feel like noise.
- **Full opt-out available**, same as every other feature that references
  users without an explicit per-instance ask.

## [S3] Architecture

```
skarn-bot/
├── features/realm/
│   ├── aiDriver.js               ← REWRITE: use shared AI client + persona contexts
│   ├── npc.js                    ← MODIFY: inject realm_omens flavor into dialogue
│   ├── combat.js                 ← MODIFY: add logSignal() on boss defeat
│   ├── quest.js                  ← MODIFY: add logSignal() on quest complete
│   ├── character.js              ← MODIFY: add logSignal() on level-up detection
│   └── realmCommand.js           ← stays the same — calls into character.js
├── features/serverMemory/
│   ├── signalCapture.js         ← shared: reactionAdd listener, milestone hooks
│   ├── signalStore.js           ← SQLite ops for server_signals (shared table)
│   ├── chronicle/
│   │   ├── chronicleCommand.js  ← /chronicle, /chronicle generate|history|setchannel|optout
│   │   ├── chronicleJob.js      ← weekly generation job
│   │   └── chronicleStore.js    ← SQLite ops for chronicle_entries
│   └── omen/
│       ├── omenCommand.js       ← /omen, /omen fulfill|history|setchannel|frequency
│       ├── omenJob.js           ← scheduled posting + callback-matching job
│       └── omenStore.js         ← SQLite ops for server_omens
├── db/
│   └── skarn-schema.sql         ← APPEND server_signals, chronicle_entries, server_omens, memory_optout, realm_omens
├── persona/
│   └── roles.js                 ← ADD 'chronicle', 'omen', 'omen_fulfill' roles + token budgets
└── bot.js                       ← Wire up listeners, daily jobs
```

**Reuses, doesn't duplicate:** `embeddings.js` from Derived Memory is reused
as-is for Omen's callback-matching ([S8b]) — no second embeddings wrapper.

## [S3a] Prerequisite: Realm re-integration

Before any signal capture or Chronicle/Omen work begins, the Realm subsystem
must be re-integrated into the main persona system. Currently the Realm has
its own AI driver (`aiDriver.js` with hardcoded `model: 'gpt-5.4-mini'`), its
own context builder (`buildContextPrompt()` separate from
`buildSystemPrompt()`), and its own OpenAI client. This disconnected
architecture means Chronicle/Omen signals from Realm milestones would be
generated by a subsystem that doesn't share Skarn's persona.

Re-integration scope:
- Replace `aiDriver.js`'s `callAi()` with the shared `ai/client.js` client.
  Realm calls bypass the general rate limiter (10/10 min sliding window) since
  they use their own separate limits — the shared client accepts an
  `opts.skipRateLimit` flag or similar mechanism to support this.
- Replace `buildContextPrompt()` with `buildSystemPrompt()` from
  `persona/identity.js`. Realm-specific context (character stats, location,
  active quests, NPC memory) is injected as additional context lines via the
  existing `buildContext()` pattern — a `realmContextLine` or similar
  parameter added to `buildSystemPrompt()`'s signature, populated by a new
  function `buildRealmContext()` in `promptContext.js` or inline in the
  Realm driver.
- Use `selectModel()` from the model router instead of the hardcoded model
- Maintain the 30-second timeout from the existing Realm AI driver — the
  shared client must accept an optional `timeout` override for this
- **Keep Realm's separate rate limits** (30 calls/30 min per user + 1000/day
  per guild) — the game subsystem has a different usage profile from general
  conversation, and merging would exhaust the general budget

This is Phase 0 of the implementation plan and must complete before
Phase 1 (signal capture).

## [S4] Signal Capture — the shared substrate

`signalCapture.js` is the one piece of new passive infrastructure both
features draw on. It writes short rows to a single shared table,
`server_signals`, on these triggers only. **Signals are typed by priority:**

| Priority | Signal type | Trigger | What's stored |
|---|---|---|---|
| **High** | `realm_milestone` | Boss defeat, quest chain completion, character reaching max level, character level-up | User, character name, description (unless opted out — see [S6]) |
| Medium | `reaction_spike` | A message crosses 5+ total reactions | First 200 chars of message content, channel, author (unless opted out) |
| Low | `mood_shift` | Channel state transitions to `Charged` (existing stateTracker) | Channel, timestamp, no message content — aggregate only |

`realm_milestone` covers all Realm-internal progression events (boss defeats,
quest completions, character level-ups). Non-Realm signals (reaction_spike,
mood_shift) provide secondary texture around these events.

**Explicit exclusion [design note]:** `reaction_spike` capture is **skipped
entirely** for any message sent while that channel's mood state is
`Weathering` (per the existing channel-state system). A message getting
supportive reactions during someone's hard moment is exactly the kind of
thing that should never become "content" for a weekly digest, even with
good intentions — see [S2].

Rows in `server_signals` are auto-deleted after 30 days regardless of
whether they were consumed into a Chronicle entry or matched to an Omen —
bounded retention, consistent with not wanting to build an indefinite raw
log of server activity.

## [S5] Chronicle

### [S5a] Generation

`chronicleJob.js` runs daily, and for each guild where **7+ days have
passed since the last chronicle** (or none exists yet) AND **at least 3
`server_signals` rows exist in that window** (a quiet week produces no
chronicle rather than a thin, obviously-padded one — silence is a better
outcome than filler), it:

1. Loads that guild's `server_signals` rows from the period, sorted by
   priority (Realm milestones first, then other signals).
2. Builds a prompt using `roles.chronicle`, feeding Realm milestones as the
   narrative anchor and non-Realm signals as secondary texture. The prompt
   asks for a short (2-4 paragraph) entry in Skarn's voice — framed as a
   Warmaster's war journal entry about his realm, not a server activity digest.
3. Posts the result to the guild's configured chronicle channel (see
   [S5c]), and stores it in `chronicle_entries`.

### [S5b] Role and guardrails

```js
chronicle: "You are Skarn, the Warmaster of the Abyss, writing in your war journal — recounting this week in your realm. Narrate the notable events as a demon lord chronicling his domain: with the weight of 10,000 years behind you and a hint of myth-making. Never mock, embarrass, or rehash conflict — celebrate what happened rather than calling anyone out. If someone is named, it should read as recognition, not exposure. If nothing especially notable happened, a short, understated entry is better than an invented one.",
```

Token budget: `chronicle`: 500. Temperature: 0.8 (this is the one place in
the bot where more narrative flourish is actively good — a chronicle should
read like a chronicle, not a status report).

### [S5c] Commands

| Command | Purpose | Permission |
|---|---|---|
| `/chronicle` | Show the most recent entry (no AI call — reads stored data) | Everyone |
| `/chronicle history` | Paginated browse of past entries | Everyone |
| `/chronicle generate` | Force an out-of-cycle regeneration, capped at once per 24h per guild | `ManageGuild` |
| `/chronicle setchannel` | Configure the posting channel | `ManageGuild` |
| `/chronicle optout` | Exclude yourself from being named in future chronicles (see [S6]) | Everyone, self only |

Omens default to this channel unless a separate omen channel is configured
via `/omen setchannel`.

**Channel storage:** Both chronicle and omen channels are stored in the
existing `guild_config` table (keys: `chronicle_channel`, `omen_channel`).
No new table needed.

## [S6] Opt-Out — shared between Chronicle and Omen

`memory_optout` table (shared, distinct from Derived Memory's existing
`user_memory_prefs` — this one specifically covers "being referenced in
server-facing narrative content," a different consent question than "should
Skarn extract facts about me"):

```sql
CREATE TABLE IF NOT EXISTS memory_optout (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  chronicle_optout INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);
```

When a user has opted out: `signalCapture.js` still may capture the
*signal* (a reaction spike still indicates something happened), but strips
or anonymizes the identifying detail before it's ever eligible for use in a
chronicle prompt — decided per signal type based on whether an anonymized
version is even meaningful:

- **realm_milestones**: skip entirely for opted-out users
  (nothing useful to say anonymously — "somebody defeated a boss" or
  "someone leveled up" is too generic to add narrative value)
- **reaction_spike**: fine to anonymize since the
  content itself, not the individual, is the interesting part

## [S7] Omen

### [S7a] Posting cadence

`omenJob.js` runs daily and, for each guild, posts a new omen if **no omen
has posted in the last 4-7 days** (randomized within that range per guild,
re-rolled after each post — deliberately irregular, not clockwork, matching
the "cryptic" framing rather than a predictable weekly feature). Capped at
**max 10 unresolved (unfulfilled) omens tracked per guild at once** — if
already at the cap, skip posting until an old one is fulfilled or expires.

### [S7b] Content

```js
omen: "You are Skarn, the Warmaster of the Abyss, speaking a single cryptic line — a prophecy or portent about your own domain. It should feel like it comes from a demon lord who has seen 10,000 years of his realm's history: vague enough to mean many things, specific enough to be memorable. Never name or clearly identify a real person, and never say anything that could read as a threat, a prediction about someone's real life, or something someone might take as literal advice. Keep it to one or two sentences.",
```

Token budget: `omen`: 100. Temperature: 0.9 (this is the one place in the
bot where maximum variety is the whole point — no two omens should feel
templated).

Each generated omen is embedded (via the reused `embeddings.js`) and stored
in `server_omens` alongside its text, ready for callback-matching.

### [S7c] Callback matching — the payoff mechanism

As part of the same daily job, for every **unresolved** omen older than 24
hours (give it at least a day before checking, no same-day coincidences),
compute similarity between the omen's stored embedding and the embeddings
of any `server_signals` rows logged since the omen was posted. Embeddings
for signals are computed on-the-fly during this pass (not stored in
`server_signals`) — the job iterates new signals, calls `embeddings.js` for
each, and compares against stored omen embeddings. If any signal's
similarity clears **0.7** (a looser bar than Derived Memory's 0.75,
deliberately — a generous, forgiving match makes for a better payoff here
than a strict one; false positives cost nothing since this is flavor, not a
factual claim):

1. Mark the omen `fulfilled`.
2. Generate a short callback line via `roles.omen_fulfill` referencing the
   original omen and (vaguely, per the same no-naming rule) what happened,
   and post it to the omen channel.

Unresolved omens that reach **30 days old with no match** simply expire —
deleted quietly, no callback, no announcement.

### [S7d] Manual fulfillment

`/omen fulfill <short description>` — any user can point Skarn at something
that happened and ask him to connect it to an active omen. If there's a
plausible unresolved omen (same embedding-similarity check, run on-demand
against the user's description instead of a stored signal), Skarn narrates
the connection via `roles.omen_fulfill` and marks it fulfilled. If nothing
matches well enough, a short in-character non-answer: `"That's not the
thread I meant."` — capped at **5 uses per guild per day** (own small
counter, not the general rate limiter) since this is a community game
mechanic, not a core AI surface, and shouldn't need heavy cost accounting.

### [S7e] Commands

| Command | Purpose | Permission |
|---|---|---|
| `/omen` | Show currently unresolved omens for this guild (no AI call) | Everyone |
| `/omen fulfill <description>` | Attempt to connect something to an active omen | Everyone, capped per [S7d] |
| `/omen history` | Browse past fulfilled omens and their callbacks | Everyone |
| `/omen setchannel` | Configure posting channel | `ManageGuild` |
| `/omen frequency <min-days> <max-days>` | Adjust the posting interval within sane bounds (e.g. 2-14 days) | `ManageGuild` |

**Channel default:** If no omen channel is set, omens post to the chronicle
channel. If neither is set, both commands return "No channel configured."
`/omen setchannel` overrides independently — an admin can use the same channel
for both or separate them.

**Channel storage:** Both channels use the existing `guild_config` table
(`omen_channel` key). No new table needed — see [S5c].

### [S7f] Realm effects (bidirectional)

When an omen is fulfilled against a `realm_milestone` signal (as opposed to a
non-Realm signal like a reaction spike), the callback does one extra thing:
it writes a short note into a new `realm_omens` table recording the fulfilled
omen and its callback text. This table is referenced by the Realm subsystem:

- **NPC dialogue**: When a player talks to an NPC, the Realm AI may weave the
  fulfilled prophecy into conversation ("The Warmaster's portent spoke of
  this... the frost in the Crimson Tower was foretold").
- **Quest flavor**: Active quest descriptions may briefly reference recent
  prophecies that touched the quest's domain.

This is deliberately lightweight — no forced events, no stat changes, no
boss respawns. The omen fulfillment *colors* the Realm without *controlling*
it. The AI simply has one more fact to draw on when narrating.

```sql
CREATE TABLE IF NOT EXISTS realm_omens (
  omen_id INTEGER PRIMARY KEY,
  fulfilled_at INTEGER NOT NULL,
  callback_text TEXT NOT NULL
);
```

If an omen is fulfilled against a non-Realm signal (reaction_spike or
mood_shift), no realm effect is written — the payoff is just the callback
post.

## [S8] Persistence

```sql
CREATE TABLE IF NOT EXISTS server_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT,
  signal_type TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  source_user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_server_signals_guild ON server_signals(guild_id, created_at);

CREATE TABLE IF NOT EXISTS chronicle_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  content TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chronicle_guild ON chronicle_entries(guild_id, created_at);

CREATE TABLE IF NOT EXISTS server_omens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  omen_text TEXT NOT NULL,
  embedding TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved', -- unresolved, fulfilled, expired
  fulfillment_text TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_server_omens_guild ON server_omens(guild_id, status);

CREATE TABLE IF NOT EXISTS realm_omens (
  omen_id INTEGER PRIMARY KEY,
  guild_id TEXT NOT NULL,
  fulfilled_at INTEGER NOT NULL,
  callback_text TEXT NOT NULL
);
```

## [S9] Cost Control

Both features are inherently low-frequency, so neither needs a heavy
dedicated rate-limit bucket, but each has one deliberate cap:

- Chronicle: natural cadence is 1 AI call/guild/week; `/chronicle generate`
  is capped at once per 24h per guild to prevent an admin (or anyone who
  compromises admin access) from spamming regenerations.
- Omen: natural cadence is 1 AI call/guild/every 4-7 days; `/omen fulfill`
  is capped at 5 calls/guild/day per [S7d]. Callback-matching itself uses
  only embeddings calls (cheap, not chat completions), run once daily
  alongside the posting check.

Neither needs a `*_DAILY_CALL_LIMIT` env var on the scale of Realm's or
Confidant's — the natural cadence already bounds cost tightly. If either
feature is later extended to run more frequently, revisit this.

## [S10] Error Handling

| Case | Behavior |
|---|---|
| Chronicle job finds fewer than 3 signals for a guild | Skip silently, no thin/padded entry generated |
| Chronicle AI call fails | Logged, skipped for this cycle, retried next week's natural run (not retried same-day) |
| Omen job hits the 10-unresolved cap | Skip posting until one resolves or expires |
| Omen AI call fails | Logged, skipped for this cycle |
| `/omen fulfill` with no plausible match | `"That's not the thread I meant."` — no AI call wasted narrating a non-match |
| `/chronicle`/`/omen` run with no channel configured | `"No chronicle channel set — an admin can run /chronicle setchannel."` (or omen equivalent) |
| User opted out via `/chronicle optout` triggers a signal | Captured but anonymized/dropped per [S6], not an error, just handled quietly |

## [S11] Files

### [S11a] New Files

| File | Purpose | Est. Lines |
|---|---|---|
| `features/serverMemory/signalCapture.js` | Shared reaction/milestone listeners | ~100 |
| `features/serverMemory/signalStore.js` | SQLite ops for `server_signals` | ~70 |
| `features/serverMemory/chronicle/chronicleCommand.js` | `/chronicle` subcommands | ~110 |
| `features/serverMemory/chronicle/chronicleJob.js` | Weekly generation job | ~80 |
| `features/serverMemory/chronicle/chronicleStore.js` | SQLite ops for `chronicle_entries` | ~60 |
| `features/serverMemory/omen/omenCommand.js` | `/omen` subcommands | ~110 |
| `features/serverMemory/omen/omenJob.js` | Posting + callback-matching job | ~100 |
| `features/serverMemory/omen/omenStore.js` | SQLite ops for `server_omens` | ~70 |

Total: ~8 files, ~700 lines.

### [S11b] Modified Files

| File | Change |
|---|---|
| `features/realm/aiDriver.js` | **Rewrite**: use shared `ai/client.js`, `buildSystemPrompt()` from persona, `selectModel()` from model router |
| `features/realm/npc.js` | Reference `realm_omens` table for NPCs to mention fulfilled prophecies |
| `features/realm/combat.js` | Add `logSignal()` on boss defeat milestone |
| `features/realm/quest.js` | Add `logSignal()` on quest completion milestone |
| `features/realm/character.js` | Add `logSignal()` on character level-up (inside `addXp()`) |
| `db/skarn-schema.sql` | Append `server_signals`, `chronicle_entries`, `server_omens`, `memory_optout`, `realm_omens` |
| `persona/roles.js` | Add `chronicle`, `omen`, `omen_fulfill` roles + token budgets |
| `bot.js` | Wire up `signalCapture.js` listeners, `chronicleJob`/`omenJob` daily intervals |
| `guild_config` (existing) | Add keys `chronicle_channel`, `omen_channel` for per-guild channel config |

## [S12] Out of Scope (v1)

- Cross-guild chronicles or omens (per-guild only, consistent with the rest
  of the bot)
- Any UI for editing a chronicle entry after it's posted
- Confidant Mode integration for Omen or Chronicle (Confidant stays fully
  walled off, consistent with its existing separation from every other
  memory system)
- User-configurable chronicle length/tone
- Any mechanism claiming or implying real predictive accuracy for Omen —
  explicitly not a goal, see [S0]#3
- Forced Realm events (stat changes, boss respawns, item grants) from Omen
  fulfillment — Realm effects are purely narrative coloring per [S7f], not
  mechanical consequences

## [S13] Verification

1. Generate 3+ qualifying signals in a test guild (reaction spikes, a
   level-up), wait for the daily job — verify a chronicle posts with content
   plausibly derived from those signals, in Skarn's voice
2. Generate fewer than 3 signals in a week — verify no chronicle posts that
   week (silent skip, not a thin entry)
3. Trigger a reaction spike on a message sent while the channel is in
   `Weathering` state — verify no signal is captured for it
4. `/chronicle optout`, then trigger a character level-up for that user — verify the
   resulting chronicle does not reference that milestone (opted-out realm_milestone
   events are skipped entirely, not anonymized)
5. `/chronicle generate` twice within 24h as an admin — verify the second
   call is rejected with the cooldown message
6. Let an omen post, then manually create a `server_signals` row with
   content designed to loosely match it, run the daily job — verify the
   omen is marked `fulfilled` and a callback posts
7. Let an omen sit 30+ days with no matching signal — verify it expires
   silently, no callback, no announcement
8. `/omen fulfill` with a description that has no plausible match — verify
   the non-answer response, no AI narration wasted
9. Call `/omen fulfill` 6 times in one day in the same guild — verify the
   6th is rejected by the daily cap
10. Reach the 10-unresolved-omens cap for a guild — verify the daily job
    skips posting a new one until the count drops
11. Generate 5+ omens and check their text for any that name a specific
    real user — verify none do (spot-check the role-line guardrail is
    holding, since this is prompt-enforced rather than code-enforced)
12. Fulfill an omen against a `realm_milestone` signal — verify a row is
    written to `realm_omens` and that a subsequent Realm NPC interaction
    can reference the prophecy flavor
13. Fulfill an omen against a non-Realm signal (reaction spike) — verify
    no row is written to `realm_omens` (bidirectional effect is Realm-only)
