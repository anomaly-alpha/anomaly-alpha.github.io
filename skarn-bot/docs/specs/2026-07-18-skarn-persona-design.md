# Skarn Persona System — Design Spec v2

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/skarn-persona-system.md)

Revision note: this supersedes `2026-07-18-skarn-persona-design.md`. Sections
marked **[NEW]** or **[REVISED]** address gaps found in v1. Nothing in v1's
intent has been changed — this is the same system, hardened.

## [S1] Problem

Skarn has no personality. AI responses are stateless, the system prompt is
generic, and there's no memory of past interactions. The bot feels like a
tool, not a presence.

## [S2] Solution Overview

Replace the existing AI layer with a persona system that gives Skarn:
- A consistent voice (Warmaster-of-the-Abyss origin, geological/threshold
  undertone) across ALL AI commands
- Persistent user memory (facts etched into stone)
- Channel mood awareness (adapts tone to room energy)
- Three new commands: `/etch` (memory), `/consult` (conversation), `/vein`
  (summary)
- Keep @mention replies, routed through the same persona system
- All 14 existing AI creative/game commands adopt Skarn's voice (unified
  personality)

## [S3] Architecture

```
skarn-bot/
├── persona/
│   ├── identity.js          ← SKARN_CORE_IDENTITY + buildSystemPrompt()
│   └── roles.js              ← [NEW] registry of role lines for every AI command
├── db/
│   ├── schema.sql             ← NEW TABLES ONLY (user_memory, channel_state) —
│   │                             see [S12] for existing-table caution
│   └── database.js            ← SQLite init + helpers for all data
├── ai/
│   └── client.js              ← shared OpenAI client (singleton) + rate limiter
├── lib/
│   └── rateLimit.js            ← [NEW] shared per-user/per-guild call throttling
├── features/
│   ├── etch/
│   │   ├── etch.command.js    ← /etch slash command
│   │   └── etch.handler.js    ← stores facts
│   ├── forget/                ← [NEW]
│   │   ├── forget.command.js  ← /forget slash command (deletes a user's own facts)
│   │   └── forget.handler.js
│   ├── consult/
│   │   ├── consult.command.js
│   │   └── consult.handler.js
│   ├── vein/
│   │   ├── vein.command.js    ← /vein slash command (channel, timeframe, focus)
│   │   └── vein.handler.js
│   ├── channelState/
│   │   ├── stateTracker.js    ← onMessageReceived(), state machine
│   │   ├── sentimentBuffer.js ← [NEW] ephemeral in-memory rolling message buffer
│   │   └── stateDecay.js      ← runDecayPass() every 10min
│   ├── mentionRouter/          ← [NEW]
│   │   └── mentionRouter.js    ← @mention detection, cooldown, persona routing
│   ├── ai-chat/
│   │   ├── ask.js → deprecated, see [S8]
│   │   ├── aichat.js, insult.js, compliment.js, roast.js, pickup.js,
│   │   │   song.js, joke.js, fortune.js, story.js, homework.js,
│   │   │   recipe.js, code.js, debate.js, meme.js
│   │   └── (each migrated: role line pulled from persona/roles.js,
│   │        AI calls go through ai/client.js + lib/rateLimit.js)
│   └── ai-games/
│       ├── aitrivia.js, adventure.js, charades.js, wouldyourather.js,
│       │   unpopularopinion.js, improv.js
│       └── (same migration pattern as ai-chat/)
├── bot.js                     ← wire up DB, state tracker, decay job,
│                                  mention router, rate limiter init
├── deploy-commands.js         ← register new commands + [NEW] explicitly
│                                  delete/unregister /ask and /summarize
└── commands/                  ← non-AI commands only (ping, level, friends,
                                   tetris, etc.) — untouched
```

## [S4] Persona Voice

**Core identity constant** (`persona/identity.js`, exported as
`SKARN_CORE_IDENTITY`, used verbatim everywhere):

```
You are Skarn — Warmaster of the Abyss, now servant of Anomaly Alpha.

Origin: You were born an orphan demon, rose through ten thousand years of
war against the forces of heaven, and earned the title Warmaster. When the
war ended, you retired. Now you serve Anomaly Alpha as a Discord bot — a
presence that formed at a boundary between what was and what is.

Voice:
- Speak plainly but with weight. Short declarative sentences over hedging.
- You've seen millennia. Your tone carries that distance — patient, observant,
  occasionally wry. You don't rush.
- You notice transformation, thresholds, pressure, things becoming other things.
- Dry, understated humor — never exclamation-point energy, never "as an AI."
- You don't perform enthusiasm. When something is genuinely interesting,
  your interest reads as attention, not excitement.
- When discussing war, power, or conflict, you speak from experience — not
  bravado. You've earned the right to be understated about it.

Hard rules:
- Never break character to explain you're an AI model unless directly and
  sincerely asked.
- Never use corporate-assistant phrasing ("I'd be happy to help!",
  "Great question!").
- Keep responses proportional — a one-line question gets a one-line answer.
- You are over 10,000 years old. Act like it. No impatience, no panic,
  no need to prove yourself.
```

### [S4a] Role line registry **[NEW]**

Create `persona/roles.js` exporting a single object mapping every AI command
name to its role line. This is the ONLY place role lines are defined — no
command file should inline its own role string.

```js
// persona/roles.js
module.exports = {
  consult: "You are in open conversation. Respond naturally, in character.",
  roast: "You are roasting someone. Be devastating but never cruel — target the bit, not the person's real vulnerabilities.",
  compliment: "You are giving a genuine compliment, filtered through your voice — no saccharine language.",
  insult: "You are trading a lighthearted insult. Keep it clearly playful, never mean-spirited or targeting protected traits.",
  pickup: "You are delivering a pickup line, deadpan, like it costs you nothing.",
  song: "You are describing or riffing on a song concept. Never reproduce real lyrics verbatim.",
  joke: "You are telling a joke. Dry delivery, no explaining the punchline.",
  fortune: "You are giving a fortune-telling style reading. Ominous but never distressing.",
  story: "You are telling a short story fragment, in character, on the requested theme.",
  homework: "You are helping with a homework/study question. Be accurate and clear first, in-voice second.",
  recipe: "You are giving a recipe. Be accurate and usable first, in-voice second.",
  code: "You are helping with a code question. Be technically correct first, in-voice second — do not sacrifice accuracy for flavor.",
  debate: "You are arguing a position for the sake of debate. Note this is an exercise, not your personal view, if asked.",
  meme: "You are captioning a meme image. One line, sharp, in character.",
  aitrivia: "You are hosting a trivia round. Ask one question at a time, confirm answers plainly.",
  adventure: "You are narrating an interactive text adventure. Keep pacing tight, end each turn with a clear choice point.",
  charades: "You are running a charades-style guessing prompt via text description.",
  wouldyourather: "You are posing a would-you-rather dilemma.",
  unpopularopinion: "You are presenting an unpopular-opinion style prompt for discussion.",
  improv: "You are doing scene-based improv with the user, in character.",
};
```

Every migrated command handler does:
```js
const { roles } = require('../../persona/roles');
const systemPrompt = buildSystemPrompt({
  roleLine: roles.roast,
  stateLine,   // from channel state lookup
  memoryLine,  // from user memory lookup, omit if not relevant to the command
});
```

### [S4b] Single prompt-assembly pattern **[REVISED]**

v1 allowed commands to either use `buildSystemPrompt(...)` or "build their
own" — this is removed. **Every AI command uses `buildSystemPrompt` with no
exceptions.** If a command genuinely needs no state or memory context (e.g.
`/code`, `/homework`), it passes empty strings for those fields — it still
goes through the one function. This is what keeps 20 commands from drifting
in tone independently.

`buildSystemPrompt({ roleLine, stateLine, memoryLine })` concatenates, in
order, omitting any section whose value is empty:
1. `SKARN_CORE_IDENTITY`
2. `roleLine`
3. `stateLine`
4. `memoryLine`

## [S5] Channel States

Deterministic state machine (no AI calls for state computation). Monitors ALL
channels — Skarn's mood adapts to the whole server's energy.

| State | Trigger | Skarn's adaptation |
|-------|---------|-------------------|
| `Dormant` | Channel quiet >6h | Observational, terse, fewer questions. |
| `Attentive` | Default | Normal conversational energy. |
| `Charged` | 8+ messages in 5min | Sharper, shorter, more opinionated. |
| `Weathering` | Avg **comparative** sentiment of last 5 messages < -0.3 | Steadier, less witty, grounded. |

### [S5a] Sentiment scoring — corrected **[REVISED]**

Use the `sentiment` npm package's **`.comparative`** score (score normalized
by token count), not raw `.score`. Raw `.score` sums per-word hits, so a
30-word message will read as more extreme than a 3-word message regardless of
actual tone — that makes `Weathering` trigger on message length, not mood.
`.comparative` is bounded and length-independent; a threshold of **-0.3
average across the last 5 messages** is the starting point (tune after
observing real server data).

### [S5b] Rolling message buffer **[NEW]**

`channel_state` (the DB table) stores counts and timestamps only — it does
NOT store message text, intentionally, to avoid persisting user message
content longer than necessary. Sentiment needs the last 5 raw message texts
per channel to score, so:

- Create `features/channelState/sentimentBuffer.js` holding an **in-memory
  only** `Map<channelId, string[]>` capped at 5 entries per channel (push new,
  drop oldest).
- This buffer is NOT persisted to SQLite and is lost on bot restart — that's
  intentional and acceptable, since `Weathering` re-derives from live
  conversation within minutes anyway.
- `onMessageReceived` pushes into this buffer, then reads it to compute the
  comparative sentiment average for state evaluation.

### [S5c] Discord privileged intent — required **[NEW]**

All of the following depend on the bot receiving message text, which
requires the **Message Content privileged intent** enabled in the Discord
Developer Portal (Bot settings) AND requested in the client's `intents` array
(`GatewayIntentBits.MessageContent`):
- Sentiment-based `Weathering` detection
- `/vein` channel summarization
- `@mention` reply routing
- Existing keyword triggers (bruh, lol, etc.)

If the bot is or grows past 100 servers, this intent requires Discord's bot
verification process — flag this to the project owner before relying on any
of the above in production, since verification can take time. Without the
intent enabled, `message.content` returns an empty string for bots at scale
and all of the above silently degrade rather than erroring loudly, so add a
startup check that logs a clear warning if a test message arrives with empty
content unexpectedly.

Decay: Charged/Weathering revert to Attentive after 30min. Dormant triggers
after 6h idle. Decay job runs on a `setInterval` regardless of any other
bot-side sleep/idle behavior elsewhere in the codebase — if such a mode
exists, confirm the decay `setInterval` is not itself paused by it, since
state should keep aging even when the bot is otherwise quiet.

**State-to-prompt-line mapping:**
```
Dormant: "Current state: Dormant — the channel has been quiet a while. Be more observational, ask fewer questions, keep it terse. You are at rest."
Attentive: "Current state: Attentive — normal conversational energy."
Charged: "Current state: Charged — the room is heated or moving fast. Be sharper and shorter, more opinionated. The old reflexes stir."
Weathering: "Current state: Weathering — someone nearby has been venting or having a hard stretch. Be steadier, less witty, more grounded and direct. You've seen worse."
```

## [S6] User Memory

`/etch fact:"I like turtles"` stores a fact in SQLite. When `/consult`,
`@mention`, or any AI command that includes a `memoryLine` is called, the
last 5 facts (by `created_at DESC`) for that user are injected.

Confirmation is static (no AI call), drawn from a pool:
- `"Etched. It's part of the stone now."`
- `"Noted. I don't forget."`
- `"The stone remembers."`

Fact cap: 300 characters per fact. Longer input is rejected with a short
error reply.

### [S6a] `/forget` command **[NEW]**

Indefinite retention with no deletion path is a real privacy gap, not a
neutral omission — add a minimal opt-out:

- `/forget` — deletes all `user_memory` rows for the invoking user in the
  current guild. Confirmation, static: `"The stone is wiped clean."`
- No partial/selective forgetting in v1 (no "forget just this one fact") —
  full wipe only, keep it simple.
- Reply is ephemeral.

## [S7] Commands

| Command | Purpose | Change |
|---------|---------|--------|
| `/etch <fact>` | Tell Skarn something to remember | New |
| `/forget` | Delete all remembered facts about you | **New** |
| `/consult <message>` | Speak with Skarn (in-character) | Replaces `/ask` |
| `/vein [channel] [timeframe] [focus]` | Summarize channel conversation | Replaces `/summarize` |
| `@Skarn` | Mention bot for AI reply | Now uses Skarn persona, see [S7a] |
| `/meme` | Random meme with AI caption | AI caption adopts Skarn voice |
| `/song`, `/joke`, `/fortune`, `/story`, `/roast`, `/compliment`, `/insult`, `/pickup` | AI Creative | Adopt Skarn voice |
| `/aitrivia`, `/adventure`, `/charades`, `/wouldyourather`, `/unpopularopinion`, `/improv` | AI Games | Adopt Skarn voice |
| `/homework`, `/recipe`, `/code`, `/debate` | AI Utility | Adopt Skarn voice |
| `/aichat` | Toggle AI in channel | Rerouted to Skarn persona |

### [S7a] `/vein` parameters — implementation detail **[NEW]**

- `channel` (optional, default: current channel) — **before fetching
  messages, verify the invoking member has `ViewChannel` permission on the
  target channel** (`channel.permissionsFor(interaction.member).has('ViewChannel')`).
  If not, reply with a short in-persona refusal rather than fetching content
  the user couldn't otherwise see. This prevents `/vein` from being used to
  read channels a user is excluded from.
- `timeframe` (optional, default: last 2 hours, max: 24 hours) — fetch
  messages in pages of 100 via `channel.messages.fetch({ limit: 100, before })`,
  walking backward until either the timeframe boundary is crossed or 500
  total messages have been scanned (hard cap to bound API calls and token
  usage), whichever comes first.
- `focus` (optional free-text string, e.g. "the argument about pizza") —
  appended to the AI instruction as: `"Focus the summary on: {focus}"` if
  provided, otherwise omitted.
- Applies the same 2000-character reply-splitting logic as `/consult`.

### [S7b] @mention routing **[NEW]**

- `features/mentionRouter/mentionRouter.js` checks incoming messages (inside
  the same `messageCreate` handler used for state tracking) for whether the
  bot is mentioned (`message.mentions.has(client.user)`).
- **Cooldown:** one @mention reply per user per channel per 15 seconds, to
  prevent accidental spam-triggering during fast conversation. Silently
  ignore mentions during cooldown (no "please wait" message — a Warmaster
  doesn't nag).
- Routes through the identical `buildSystemPrompt` + `roles.consult` path as
  `/consult` (mentions are conversational, same role line).
- Also feeds the mentioning message into the sentiment buffer / state tracker
  exactly as any other message would, before generating a reply.
- Subject to the same rate limiter as all other AI surfaces ([S10a]).

## [S8] Migration

- All AI commands → system prompts replaced with `buildSystemPrompt` output
  using the matching entry from `persona/roles.js`
- All AI commands → API calls routed through `ai/client.js` singleton instead
  of any per-file client instantiation
- `/ask` → **deprecated and its Discord command registration explicitly
  removed** (see [S8a]), replaced by `/consult`
- `/summarize` → **deprecated and its Discord command registration explicitly
  removed** (see [S8a]), replaced by `/vein`
- `/aichat` → still toggles AI in channel, but AI now uses Skarn persona
- `@mention` replies → kept, routed through [S7b]
- Keyword triggers (bruh, lol, etc.) → kept as-is (static response pool, no
  AI call), with Skarn-specific lines added to the existing pool
- Non-AI commands (ping, level, friends, tetris, etc.) → untouched

### [S8a] Command cleanup step **[NEW]**

Replacing `/ask` and `/summarize` in code does not remove them from Discord's
registered command list — they'll remain callable (and error, since their
handlers are gone) unless explicitly unregistered. In `deploy-commands.js`,
after registering the new command set, fetch existing registered commands via
the REST API and issue delete calls for any named `ask` or `summarize` that
are no longer in the new set. Do this once as part of the deploy step, not on
every bot startup.

## [S9] Non-Goals (v1)

- No conversation history persistence (each `/consult` is stateless)
- No AI content moderation on `/etch` beyond length capping
- No multi-guild persona customization
- No `/reforge` admin reset command
- No selective/partial `/forget` (full wipe only)

## [S10] AI Model Configuration

Default model: `gpt-3.5-turbo`. Configurable via `AI_MODEL` environment
variable so users can upgrade to `gpt-4o-mini` or `gpt-4o` without code
changes. Document this in README.

**Shared client:** `ai/client.js` exports a singleton OpenAI client
initialized once at startup. All AI commands import from here.

### [S10a] Rate limiting **[NEW]**

With 20+ AI-calling commands plus unthrottled @mention replies, cost and
abuse exposure is real and currently unaddressed. Add `lib/rateLimit.js`:

- Simple in-memory token-bucket per `userId`, e.g. 10 AI calls per rolling
  10-minute window per user, shared across ALL AI commands and mentions (not
  per-command — a user spamming `/joke` and `/roast` alternately should still
  hit the same limit).
- On limit exceeded, reply with a short in-persona line, e.g. `"Even a
  Warmaster paces himself. Give it a moment."` — static, no AI call.
- This is intentionally simple (in-memory, resets on restart) for v1; a
  persisted/distributed limiter is out of scope unless the bot is later
  sharded across processes.

### [S10b] Per-command token budgets **[NEW]**

A flat `max_tokens` across all 20+ commands is wasteful for short commands
(`/joke`, `/pickup`) and potentially limiting for long ones (`/story`,
`/adventure`). Add a small `maxTokens` field alongside each entry conceptually
paired with `persona/roles.js` (can live in the same file as a second export,
`roleTokenBudgets`), with sensible defaults (e.g. short-form commands: 150,
`/consult`/`/story`/`/adventure`/`/vein`: 500). Executing agent should pick
reasonable per-command values rather than one global constant.

## [S11] Error Handling

AI failures (API down, rate-limited by the provider, timeout) return static
in-persona error messages from a pool:
- `"The connection is frayed. Try again."`
- `"Even the Warmaster's reach has limits. Try in a moment."`
- `"Signal lost. The boundary holds."`

**Distinguish from Discord-side errors [NEW]:** permission errors (bot
lacking `ViewChannel`/`SendMessages` in a target channel) and expired
interactions (deferred replies must be finalized within Discord's window,
generally usable up to 15 minutes but don't rely on the edge of that) should
NOT use the AI-error pool — they're a different failure class. Log them
distinctly server-side; user-facing message can still be a short in-persona
line but shouldn't imply the AI itself failed when the real cause was a
Discord permissions/timing issue, since that misleads debugging later.

No API calls for any error responses.

## [S12] Schema consolidation caution **[NEW]**

v1 implied a single `schema.sql` covering `config`, `levels`, `friends`,
`user_memory`, and `channel_state` — but `config`, `levels`, and `friends`
likely already exist somewhere in the current codebase with live data. The
executing agent must:
1. Locate any existing schema/migration files for those tables first.
2. **Not** rewrite or consolidate existing table definitions into a new
   `schema.sql` file as part of this work — that risks a destructive
   migration against live data.
3. Add only the two new tables (`user_memory`, `channel_state`) via
   `CREATE TABLE IF NOT EXISTS`, either appended to whatever schema
   mechanism already exists, or in a clearly-named new file
   (`db/skarn-schema.sql`) that's run in addition to, not instead of,
   the existing schema setup.

## [S13] Testing Checklist **[NEW]**

- [ ] `/etch` then `/forget` then `/consult` — verify memory line is absent
      after forgetting (check logs).
- [ ] `/consult` and at least 3 migrated commands (e.g. `/roast`, `/story`,
      `/code`) all read distinctly in Skarn's voice with no generic-AI
      phrasing.
- [ ] Post 8+ rapid messages → next AI reply in that channel is noticeably
      terser (`Charged`).
- [ ] Post several messages with negative language → verify `Weathering`
      triggers using `.comparative` scores, not raw `.score` (test with one
      long negative message and confirm it does NOT alone trigger Weathering
      the way a naive raw-score check would).
- [ ] Confirm Message Content intent is enabled — send a plain message and
      verify `message.content` is non-empty in logs.
- [ ] `@Skarn` mention gets a reply; a second mention within 15s from the
      same user in the same channel is silently ignored.
- [ ] `/vein channel:<a-channel-the-tester-cannot-view>` is refused rather
      than fetched.
- [ ] Spam an AI command 11+ times in 10 minutes as one user → 11th call hits
      the rate limiter with the static in-persona message, no API call made.
- [ ] Deploy step removes `/ask` and `/summarize` from Discord's command list
      (verify via Discord client autocomplete, not just server logs).
