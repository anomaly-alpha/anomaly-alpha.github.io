# Skarn Musings — Design Spec

**Status:** Brainstormed (2026-08-05, Q1–Q5 resolved, awaiting grill)

**Model:** deepseek-v4-flash-free

## [S1] Problem

Skarn is a 10,000-year-old retired demon warmaster with a rich persona (wisdom layer, 6
moods, 20 canonical lore stories, memory of his server). Today he only speaks when spoken
to (mention / slash / activation phrase) or in short reactive bursts (interjections,
callback lines, check-ins). Nothing lets him simply *reflect aloud* — a standalone,
persona-voiced observation that a server member might stumble on while scrolling. The
persona deserves ambient life, not just request-response.

Constraints discovered in research:

- **Anti-lecture guard** (`persona/identity.js:67-72`) explicitly bans "unsolicited
  lecturing". A musing must read as a quiet observation, never advice or moralizing.
- **Zero new spam surface**: interjections already fire at up to 10%/message in
  banter channels. A musing feature must not compound that; it must be rare.
- **Cost discipline**: every AI call is rate-limited and budgeted. Musings add AI
  spend, so they must be sparse (per-guild, ~1/2 days) and use the shared admission
  gate (`moderatedChatCompletion`).
- **Opt-in hygiene**: proactive messages are gated by `canInteract()` /
  `shouldCheckIn()`. Musings are guild-scoped ambient speech, so the gate is the
  guild's `aiChannels` config (the set of channels where Skarn is "present").

## [S2] Solution overview

Add a **dedicated musing engine** (`features/presence/musingEngine.js`) — a vertical
slice mirroring `interjectionEngine` — that periodically (per-guild, weighted-random
~1 per 2 days) generates and posts a short, in-persona reflection to a random channel
from the guild's `aiChannels` list.

Key properties:

- **Timer-driven**, not message-driven. A scheduler tick checks each guild's
  `next_musing_at`; when due, it fires and draws the next time.
- **AI-generated per musing** (fresh `moderatedChatCompletion` call with a new
  `musing` role line), not a curated pool.
- **Grounded, not generic**: each musing pairs one real recent event (a news
  headline from the news cache) with one real memory from Skarn's story archive
  (`skarn_stories`), and ends with a quiet open question — a door the user is
  invited to walk through (see [S6]).
- **Sparse and organic**: weighted random interval centered on 48h, clamped to
  [24h, 96h]; a fire also schedules the next, so bursts are impossible.
- **Inherits all existing gates**: `isSleepTime()`, `aiChannels` config, admission
  gate + rate limits on the AI call.
- **Quiet-channel gate**: musings only land in channels that are *idle* — state
  `Dormant`/`Attentive` (never `Charged`/`Weathering`) AND no user message in the
  last `MUSING_QUIET_MS` (30 min). A musing never interrupts a live talk.

## [S3] Anti-interruption guard (grill Q: musing during active conversation)

The mustiking target **must not be a channel where anyone is mid-conversation**.
`Attentive` alone is insufficient: `stateTracker.js:47-56` sets `Attentive` for
*any* user traffic (only ≥8 msgs/5min escalates to `Charged`, and `Dormant`
requires 6h of decay). The reliable signal is `channel_state.last_message_at`
(written on every user message, `stateTracker.js:60`; bot messages are ignored
at `:25`).

**Gate**: candidate channel qualifies only when ALL hold:
1. `getChannelState(channelId, guildId).current_state ∈ {'Dormant','Attentive'}`
2. `now - last_message_at >= MUSING_QUIET_MS` (constant, default 30 min)
3. text-capable, client can send (see [S5])

If the guild's quiet candidate set is empty → skip this tick and reschedule the
normal draw (no musing is better than a rude one). No fallback to non-quiet
channels, ever.

## [S4] Scheduling & cadence

Per-guild calendar state lives in `app_state`:

| Key | Value | Purpose |
|---|---|---|
| `musing_next:{guildId}` | `Date.now()` timestamp of next allowed fire | The entire cooldown — no new table |

- **Tick**: a `setInterval` registered in `features/scheduler/index.js`
  (10-minute cadence, wrapped in the existing `safeRun` helper).
- **Draw**: when `now >= next_musing_at`, fire one musing, then compute the next
  window: `next = now + 48h * (0.5 + Math.random())` (i.e. uniform 24–72h, mean
  48h) plus a 15% chance to skip this draw entirely (elongates, keeps it
  unpredictable). Clamp: minimum 24h (never denser than 1/day per guild).
- **First-time guilds**: no `musing_next` row → initialize to `now + 24h` so the
  feature starts quiet, then behaves normally.
- **Guild enumeration**: iterate `client.guilds.cache.values()` like
  `proactive/scheduler.js:23`. Skip guilds with no `aiChannels` configured.
- **Quiet-candidate check inside the tick**: a due guild still fires nothing if
  its quiet candidate set (per [S3]) is empty — it reschedules instead.
- **No per-channel cooldown needed**: the per-guild next-fire timestamp is the
  gate. A channel may receive at most one musing per fire cycle by construction.

## [S5] Channel targeting

- Source: `getGuildConfig(guildId, 'aiChannels')` (same accessor
  `bot.js:232/253/331` and `warmthManager.js:15-17` use).
- Empty / unset list → skip guild entirely (no message, no reschedule churn —
  just leave the row; it fires when channels get configured).
- Candidate set: aiChannels entries that also pass the [S3] quiet gate (state
  Dormant/Attentive + ≥ `MUSING_QUIET_MS` idle) AND are usable — present in
  `guild.channels.cache`, `isTextBased()`, and where the client can send
  (`permissionsFor(client.user.id)?.has('SendMessages')`).
- Selection: uniform random among the quiet, usable candidate set.
- If the candidate set is empty (all busy / all dead) → skip the fire and
  reschedule the next draw; never fall back to a non-quiet channel.

## [S6] Content generation & persona

A musing is **grounded, not generic**: it pairs one real recent event with one
real memory from Skarn's history, then asks the model to speak the thread between
them — ending with a quiet hook that invites a mortal to ask.

### [S6.1] Recent-event seed (the "search")

- Pull from the existing news cache (`getRecentNews(category?)` in
  `features/news/newsFetcher.js` — daily_news, up to 200 fresh articles across 5
  categories: tech/gaming/world/science/business) — NOT a live network fetch.
- Selection: among headlines published in the last `NEWS_SEED_MS` (48h), prefer
  categories weighted toward world/business/science/tech (skip pure gaming spam
  at the top when alternatives exist); pick one uniformly.
- If no recent headline exists (cache empty/stale), fall back to the newest
  headline regardless of age; if still none, skip the fire (no seed → no musing;
  weak seed would produce a weak musing).

### [S6.2] History memory (the "ground")

- Map the headline to Skarn's archive via `findStoryTopic(headline)` +
  `getExistingStory(topic)` (`features/wisdom/storyEngine.js`) — canonical >
  auto_lore > AI-generated, exactly the existing lore system. This pulls a REAL
  memory from his 10,000 years that thematically echoes today's event
  (war/humans/loss/technology/time/power/regret/dreams…).
- If `findStoryTopic` returns null (no keyword match), fall back to a uniformly
  random `skarn_stories` canonical/auto_lore entry. `getExistingStory` already
  increments usage stats, so the archive self-tunes toward variety.

### [S6.3] Composition

- **New role line**: add `roles.musing` in `persona/roles.js` (+
  `ROLE_NATURE.musing = 'casual'` if the convention requires; token budget
  `roleTokenBudgets.musing = 180`). Maps to the wisdom voice with a *hook* —
  example intent:
  > "Skarn notices a recent event (headline below) and it brushes against one of
  > his memories (story below). Speak a short reflection — a single breath in his
  > voice. Not an essay, not advice, no 'remember to', no lecturing (the guard in
  > the identity still stands). Let the recent and the ancient touch. End with one
  > quiet line that leaves a mortal wondering — a door left open for a question.
  > Three sentences max."
- **System prompt**: `buildSystemPrompt({ roleLine, ...ctx })` exactly like
  `interjectionEngine.js:38-42` — identity + safety line + role line, reuse all
  anti-drift guards. Optionally append `ctx.loreLine`/`ctx.dreamLine` so the
  musing can stand on even more of his own voice (already surfaced infra).
- **Context**: `buildContext(...)` like the interjection engine; full context on a
  48h cadence is acceptable spend.
- **User prompt** (the assembled seed):
  ```
  Recent event: <headline> — <snippet>
  Memory from my years: <story_text>
  ```
- **Call**: `moderatedChatCompletion({ model: AI_MODEL, messages, max_tokens: 120,
  temperature: 0.9, userId: 'musing:' + guildId })`. Do NOT pass `null`: the
  admission gate feeds `userId` into `isSilenced()` (`ai/client.js:49`) and
  `canCall()` (`:52`); a null id would pollute `rate_limits.user_id` and
  false-match strike lookups. The pseudo-user key also gives each guild its own
  rate bucket for free (bounded to the 48h cadence anyway).
- **Post**: `channel.send({ content: musing, allowedMentions: { parse: [] } })`.

### [S6.4] Hook-to-conversation

The role line ends the musing with a door (a dangling observation, a "wonder I
can't shake", a question left in the air) — never a directive. If a member then
asks Skarn about it (mention/slash/AI channel), the normal pipeline answers using
the same `loreLine`/memory context — musings deliberately *want* follow-up; the
anti-lecture rule keeps them from *demanding* it.

## [S7] Gating & safety

Order of checks in the tick (cheap → expensive):

1. `isSleepTime()` → skip (mirror interjection `bot.js:381`).
2. Guild has a `musing_next` row and `now >= next` → else skip.
3. Guild has ≥1 usable `aiChannels` channel → else skip.
4. Guild has ≥1 channel passing the [S3] quiet guard → else skip + reschedule.
5. **15% skip-draw** (elongation) → if hit, reschedule and return.
6. AI call via `moderatedChatCompletion` (shared admission gate).
7. On `!result.success` or crisis → reschedule normally, log `[Musing]`, no
   fallback static lines (a musing is ambient; a canned line would read as spam).
8. `channel.send` wrapped in try/catch → reschedule regardless of send failure
   (never crash the tick; the `safeRun` wrapper is the last line of defense).

No per-user opt-in: musings are guild-ambient (like the digests and lore jobs), and
the channel set is already admin-controlled via `/aichat`.

## [S8] Persistence

- `app_state` rows (`musing_next:{guildId}`) — read/write via existing
  `getAppState` / `setAppState` (`db/ops.js:84-89`, re-exported by `db/database.js`).
- No schema change, no migration, no new table.

## [S9] Interfaces

Consumes:

- `db/database.js`: `getAppState`, `setAppState`, `getGuildConfig`
- `persona/identity.js`: `buildSystemPrompt`
- `persona/roles.js`: `roles`, `roleTokenBudgets` (new `musing` entry)
- `features/promptContext.js`: `buildContext`
- `features/news/newsFetcher.js`: `getRecentNews` (recent-event seed)
- `features/wisdom/storyEngine.js`: `findStoryTopic`, `getExistingStory` (history ground)
- `ai/client.js`: `moderatedChatCompletion`
- Sleep: a **local `isSleepTime()` helper inside musingEngine** reading
  `SLEEP_START` / `SLEEP_END` / `SLEEP_TIMEZONE` env vars, mirroring
  `bot.js:75-81`. Do NOT import from bot.js — scheduler → bot.js would be a
  circular require (bot.js requires the scheduler).

Produces:

- `features/presence/musingEngine.js` exporting `startMusingScheduler(client)` and
  (for smokes) `maybeMuse(guild, client)`
- `features/scheduler/index.js`: one new `setInterval(safeRun(...), 10 * 60 * 1000)`
  registration + initial call

## [S10] Edge cases

| Case | Behavior |
|---|---|
| Guild with no `aiChannels` | Skipped; no reschedule needed (row left until channels appear) |
| All configured channels unusable (deleted/left) | Skip fire, reschedule; next draw may pick different channels |
| All configured channels busy (state Charged/Weathering OR last message < 30 min) | Quiet gate ([S3]) rejects all → skip fire, reschedule the normal draw. No musing while anyone talks |
| Channel goes quiet *after* the draw but before send | Harmless: last message < 30 min at send time → treat as busy (re-check at send) and reschedule |
| AI call fails / blocked by rate limit | Reschedule, log, no fallback text |
| Crisis moderation response | Same as failure — reschedule, no fallback |
| News cache empty / stale | No seed → skip fire; no weak musing about nothing (reschedule) |
| History lookup misses (`findStoryTopic` null, storyEngine returns null) | Fall back to a uniformly random `skarn_stories` row; if archive is empty, skip fire |
| Sleep mode active | Entire tick skipped; next fire naturally defers |
| Fresh restart | `musing_next` persists in `app_state`; no duplication (check `now >= next` before fire) |
| Bot restarts mid-interval | Timestamp survives; fire at most once per window (guard by `>=` not `>` on equal ms) |

## [S11] Verification

Project convention: no test framework; `node --check` + `node -e` smokes with
`SKARN_DB_PATH=$(mktemp -d)/...`.

1. `node --check features/presence/musingEngine.js`
2. Draw-function smoke: seed `musing_next` in the past, call `maybeMuse` with a
   stubbed `moderatedChatCompletion` + stubbed channel, assert: one `channel.send`,
   `musing_next` advanced, and the new value is ≥ 24h in the future.
3. Quiet-gate smoke: seed a channel with `current_state='Charged'` +
   `last_message_at = now` → `maybeMuse` does NOT send; seed idle
   (`Dormant` + last message > 30 min ago) → sends.
4. Guards smoke: guild with no aiChannels → no send; sleep → no send.
5. Seed smoke: stub `getRecentNews` (one headline) + `getExistingStory` (one
   memory) + a stubbed `moderatedChatCompletion`; assert the assembled user
   prompt contains BOTH the news seed and the history text, and one
   `channel.send`.
6. No-seed smoke: `getRecentNews` returns empty → `maybeMuse` skips without an
   AI call (no weak seed fires).
7. Full-boot smoke: `SKARN_DB_PATH=$(mktemp -d)/smoke.db node -e
   "require('./features/scheduler')"` — expect clean load (existing log lines only).

## [S12] Docs updates

- `skarn-bot/CONTEXT.md`: add musing engine to the proactive/presence glossary +
  §2 architecture note (new ambient-speech subsystem).
- `persona/roles.js` conventions note if `musing` needs `ROLE_NATURE`.
- README command/presence list if it enumerates ambient behaviors.
