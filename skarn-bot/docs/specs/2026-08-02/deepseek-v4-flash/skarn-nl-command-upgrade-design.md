# Skarn — Natural-Language Command Upgrade (design spec)

**Date:** 2026-08-02
**Model:** deepseek-v4-flash
**Status:** Grilled (2026-08-02, Q1–Q5 resolved) — pending implementation plan

## [S1] Problem

Today only **9 commands** are reachable through the AI tool loop (`etch_memory`, `get_memory`,
`search_web`, `set_reminder`, `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats`).
The remaining ~70 commands in `commands/` are reachable only via slash commands or exact-prefix
activation phrases (`skarn level`) — none can be invoked by *fuzzy natural language*. A user cannot
say "what's my level?", "set the welcome channel to #general", or "show the leaderboard" and get
real execution.

Separately, Skarn's news awareness is **intent-gated** (`features/promptContext.js:67-74`):
headlines are injected into the AI context only when the user's message already looks news-related
(`NEWS_INTENT_RE`). Skarn cannot naturally weave current events into conversation, and has no
ambient sense of "what's happening in the world right now."

**Success criteria:** every user-facing command is invocable by natural language; Skarn carries
always-on awareness of current news events into his AI replies.

## [S2] Solution overview

Three pillars:

1. **`run_command` AI tool** — a single new function-calling tool. The model picks a command from
   an enum plus a natural-language `args` string; `runTool` dispatches to the command's real code
   path through a pseudo-message.
2. **Pseudo-message dispatch** — execute unmodified command handlers from inside the tool loop.
   Requires: plumbing the real Discord message (or interaction) into the tool context, a message
   facade for the consult path, and adding `activation` + `handleActivation` + `parseArgs` to the
   ~10 commands that lack a text path.
3. **Always-on news awareness** — replace the intent-gated `newsLine` with a compact always-present
   headline line in `buildContext()`.

Architecture rationale: one generic tool (≈10 tools total) instead of ~70 individual schemas, which
would add ~3,000–7,000 tokens of schema to **every** turn-1 AI call and degrade model tool-selection
accuracy. The generic tool reuses the existing activation registry
(`features/activation/activationRegistry.js`), which already carries `phrase`, `type`, `guildOnly`,
`requiredPermissions`, and `parseArgs` per command.

## [S3] The `run_command` tool

Schema (added to `features/tools/toolDefinitions.js`):

```json
{
  "type": "function",
  "function": {
    "name": "run_command",
    "description": "Run any Skarn command by name. Use when the user asks for a command result — level, leaderboard, avatar, poll, setwelcome, embed, etc.",
    "parameters": {
      "type": "object",
      "properties": {
        "command": { "type": "string", "description": "The command to run — enum built dynamically from the activation registry", "enum": ["<dynamic>"] },
        "args": { "type": "string", "description": "Natural-language arguments for the command, e.g. a user mention, a channel mention, a question, or options. Omit when the command takes none." }
      },
      "required": ["command"]
    }
  }
}
```

**Enum composition rule (dynamic — grill Q1):** the `run_command` enum is built at runtime from
`activationRegistry.getAll()`, not hardcoded. A command is included iff it:
1. has an `activation` entry of `type: 'command'` (per [S6], every executable command gets one),
2. is deterministic/action (real code execution, not model-answered),
3. is **not** already covered by a dedicated tool — explicit exclusion list: `dice`, `coinflip`,
   `stats`, `weather`, `news`, `etch`, `remind`, `memory`, `search` (dedicated tools:
   `roll_dice`, `flip_coin`, `get_user_stats`, `get_weather`, `get_news`, `etch_memory`,
   `set_reminder`, `get_memory`, `search_web`).

Implementation: `toolDefinitions.js` exposes `getTools()` (replacing the static `tools` export);
`sharedPipeline.js` calls it per pipeline run (registry iteration is trivial, ~80 entries).
`getAll()` is safe to call after `scanCommands()` runs at `bot.js:90` — the same pattern
`helpPages.js:118` already uses. Each enum member's description comes from the activation's
`description` field. A newly-activated command appears in the tool automatically — zero drift.

**What is intentionally NOT in the enum, and why each is still NL-invocable:**

- **AI-driven commands** (roast, joke, code, recipe, 8ball, advice, homework, story, compare,
  compliment, insult, pickup, meme, song, debate, wouldyourather, unpopularopinion, charades,
  improv, vein, vibe, daily, fortune, translate-AI mode, weather-report mode, etc.): the model
  already performs these in character when spoken — speaking the request *is* the invocation, no
  code execution needed. Known fidelity tradeoff: invoked via mention they run in the consult
  role/voice (temp 0.85), not the command's specialized role line or temperature. Accepted for this
  upgrade; reversible later via persona-directive routing if exact role fidelity is wanted.
- **Interactive multi-turn systems** (`realm`, `tetris`, `adventure`, `aitrivia`, `trivia`)
  **(grill Q3):** their handlers are built around `interaction.reply/editReply` + button/modal
  flows, which a single tool call cannot create. The model knows they exist and **guides the user to
  the slash command in character**; `adventure` additionally gets organic in-chat roleplay since it
  is AI-driven. No game-system refactor (out of scope; a message-based launch rewrite of 5
  subsystems is a separate project).

## [S4] Command classification (source of truth)

| Class | Count (approx) | Mechanism | In enum? |
|---|---|---|---|
| Already tooled | 9 | dedicated tools | no |
| Executable + has activation | ~33 | `run_command` → existing `handleActivation` | yes |
| Executable, needs activation added | ~10 (embed, find, hello, poll, lorebook, omen, chronicle, ticket, etc.) | `run_command` → new `handleActivation` | yes |
| Admin/config (subset of above) | ~14 (setwelcome, setlog, setautorole, setlevelrole, setnewschannel, reactionrole, giveaway, ticket, weathertrack, lorebook, levelroles, aichat, aistats, preferences) | `run_command` + permission gate [S6] | yes |
| AI-driven | ~35 | model answers in character | no |
| Interactive multi-turn | 5 | model guides to slash | no |
| HYB (news/weather/history/translate) | 4 | dedicated tools (news/weather) or deterministic activation path | news/weather: no; history/translate: yes (deterministic path only) |

## [S5] Pseudo-message dispatch

**Plumbing:** `runTool` currently receives `{ guildId, channelId, userId }` only
(`features/tools/toolRunner.js:152`) — no Discord message/member, so no permission checks and no
way for command handlers to reply. Change:

1. `features/mentionRouter/mentionRouter.js` passes the **real Discord message** through the pipeline
   opts (`opts.sourceMessage = message`) in the `runPipeline` call.
2. `features/consult/consult.handler.js` passes the **interaction** (`opts.sourceInteraction`).
3. `features/ai/sharedPipeline.js` forwards both into the `runTool` context
   (`{ guildId, channelId, userId, sourceMessage, sourceInteraction }`).

**Facade (`features/tools/messageAdapter.js`):** build a message-like object for command handlers.

- **Mention path:** the real message already exposes everything handlers touch (`author`, `guild`,
  `member`, `channel`, `mentions`, `reply()`, `content`). The adapter wraps it with a **rewritten
  `content`** reflecting the activation phrase + args (so handlers that re-parse `content` see a
  canonical invocation), and nothing else changes.
- **Consult path:** synthesize a facade from the interaction — `author`/`user` = `interaction.user`,
  `member` = `interaction.member`, `guild` = `interaction.guild`, `channel` = `interaction.channel`,
  `mentions` = parsed from the args string (`<@!?(\d+)>`, `<#(\d+)>`, `<@&(\d+)>`), `reply(payload)`
  → `interaction.followUp(payload)`, `content` = canonical invocation.
- **Capture (grill Q2):** the facade's `reply(payload)` sends the payload **and** records its text
  (`content` if present; else embed title/description/fields flattened cheaply) on the facade.
  `run_command` returns the captured text as the tool result, so the model relays the real output —
  including usage hints like "Please mention a channel" — instead of a blind confirmation.
- **DM / no-guild:** `guildId === 'dm'` or missing member → `guild`/`member` are `null`; any
  `guildOnly` command or command whose `requiredPermissions` are non-empty fails closed (see [S6]).

**Dispatch (`features/tools/toolRunner.js`, new `run_command` case):**

1. Resolve the command module from `commands/<name>.js`; if missing or its `activation.type` is
   `'ai'` → graceful error result (`Unknown command: X`).
2. **Permission gate** [S6]: check `guildOnly` + `requiredPermissions`; fail with a graceful error
   result (never throw).
3. Build the invocation string `activation.phrase + ' ' + args` and run `parseArgs` (existing or new)
   to produce structured `args`.
4. **Preferred dispatch:** if the command exports a pure `getXResponse(args, message)`-style
   function, call it, send the returned payload via `message.channel.send(payload)` (or
   `reply(payload)` for the mention path), and return a **text summary** of the result to the model
   (title/values extracted where cheap).
5. **Fallback dispatch:** otherwise call `handleActivation(message, args)` (command replies itself
   through the capturing facade) and return the **captured reply text** as the tool result.
6. Wrap the whole case in try/catch; any thrown error becomes a graceful tool-result error string
   (e.g. missing required args, handler error), so the pipeline never sees an uncaught throw.

**Recursion guard:** `run_command` only ever reaches the *deterministic* path of a command (its
activation handler). HYB commands' activation handlers are deterministic (e.g. `skarn news` posts
raw headlines; the AI-commentary mode is a slash-only option). No tool dispatch may trigger a nested
AI call. Enforced by construction: dispatch goes through `handleActivation`/`getXResponse`, never
`execute(interaction)`.

## [S6] Activation completion + permission gating

**Work:** add `activation` (+ `handleActivation` + `parseArgs`) to the ~10 commands lacking a text
path (embed, find, hello, poll, lorebook, omen, chronicle, ticket, etc.).
`parseArgs` for new activations must parse *natural language* and degrade gracefully: on unparseable
or missing input, return `{}` so the handler replies with a usage hint (which surfaces as a graceful
tool result → model relays politely). Follow the existing pattern (`commands/level.js:54-65`,
`commands/setwelcome.js:35-42`).

**Permission gate (runner-level, primary):** before dispatch, check in order —
1. `guildOnly` (from activation) with no guild/member → fail closed;
2. every permission in `activation.requiredPermissions` must be present on
   `message.member.permissions` (or `interaction.member.permissions`) → else graceful denial result,
   e.g. `You need Administrator permission for "setwelcome".`;
3. handler-level checks inside commands stay as **defense-in-depth** (setwelcome already
   self-checks `Administrator`).

`guild_config`-backed gates (e.g. aichat requiring the AI-chat channel setting) run inside handlers
and surface as graceful errors unchanged.

## [S7] Reply UX — the double-reply rule

A dispatched command posts its own message (embed/poll/giveaway panel); the pipeline then also sends
the model's final reply. Rule **(grill Q5): instruction + condenser override**:

1. The `run_command` tool result ends with the instruction
   `Reply with at most one short in-character line — the command result is already posted above.`
2. **Hard override:** when `run_command` was the only tool used in the turn and it captured
   non-empty reply text, `sharedPipeline` passes a tight reply target (≈80 chars) into
   `condenseReply` for that turn, so the final line is length-capped even if the model writes more.

For commands that return data to the model instead of posting output (e.g. a `getXResponse` path
that yields plain text), the model may relay the summary more fully.

Interactions with existing machinery:
- `maxTurns = 3` (sharedPipeline.js:120) comfortably covers turn 1 (run_command) → turn 2 (final
  reply). Multiple tool calls in one turn are already supported (`for (var tc of choice.tool_calls)`).
- The reply condenser already skips tool-driven replies (`condenseReply(..., { usedTool })`,
  condenser spec [S5]) — the confirmation line is not over-condensed.
- The command's `message.reply()` lands mid-pipeline (before typing-sim + delay + final send);
  ordering is natural: result first, commentary after.

## [S8] Always-on news awareness

Replace the intent-gated block in `features/promptContext.js:65-74` with an always-on compact line.
**Selection (grill Q4): one per top-3 categories** — the newest article of each of the 5 categories
(`getRecentNews(1, category)` per category), then keep the 3 most recent overall; format
`[cat] headline`, no snippets:

```js
var newsLine = '';
const CATS = ['tech', 'world', 'science', 'business', 'gaming'];
const perCat = CATS.map(function(c) { return getRecentNews(1, c)[0]; }).filter(Boolean);
const top3 = perCat.sort(function(a, b) { return b.published_at - a.published_at; }).slice(0, 3);
if (top3.length > 0) {
  newsLine = 'Happening now: ' + top3.map(function(n) {
    return '[' + (n.category || 'mixed') + '] ' + n.headline;
  }).join(' | ');
}
```

- Diversified awareness: tech feeds post most frequently, so a naive "newest 3" would crowd out
  world/science/business; one-per-category keeps the line representative of *events happening*.
  Cost: 5 tiny indexed SQLite queries per `buildContext` — negligible.
- The `get_news` tool and the 18:00 UTC digest are unchanged (deep-dive and push surfaces).
- "Events" = news events per the news cache (user decision); no Discord scheduled-event API work.

**Cost:** `buildContext` runs on mention + consult + interjection paths
(`features/promptContext.js:21`, `features/ai/sharedPipeline.js:84`,
`features/presence/interjectionEngine.js:38`). ~3 headlines × ~10 words ≈ **50 extra tokens per AI
call**. Accepted for always-on awareness (user decision); if it must ever shrink, re-gate with a
cheaper intent test than today's regex.

## [S9] Docs & glossary

1. `docs/NL-TOOLS.md` — bump "9 tools" → "10 tools"; new section: **"Any command, spoken"** — list
   the enum classes, example phrasings ("what's my level", "set the welcome channel to #general",
   "run a poll: pizza or sushi", "show the leaderboard"), and the interactive-games note (realm,
   tetris, adventure, trivia → slash command).
2. `CONTEXT.md` — update the **AI tool system** entry (§2): 10 tools including `run_command`, with
   the enum rule and dispatch architecture; update the **News cache** entry with always-on
   awareness; add a decisions record entry for the run_command architecture choice (generic tool vs
   per-command schemas).
3. `README.md` — extend the Verification section with a `run_command` smoke (temp-DB
   `node -e` that builds a facade message and asserts `runTool` returns a graceful result for a
   known command and a denial for an admin command without permissions).

## [S10] Error handling & scope guardrails

| Case | Behavior |
|---|---|
| Unknown command name (model hallucination) | graceful tool result: `Unknown command: <name>.` → model corrects/asks |
| Missing/invalid args | `parseArgs` → `{}` → handler usage hint → graceful result |
| Permission denied | graceful denial result; model relays in character; no execution |
| DM + guildOnly | fail closed, graceful result |
| Handler throws (DB locked, etc.) | try/catch in `run_command` → graceful error result, never out of `runTool` |
| AI-driven command in enum by mistake | excluded by construction: only `type:'command'` activations are enum-able |
| Nested AI from a tool | impossible by construction: dispatch never calls `execute(interaction)` |

Out of scope: Discord scheduled-event API; per-command individual tool schemas; persona-directive
routing for AI-driven commands; changes to the interactive game systems.

## [S11] Verification

No test framework (project rule, CONTEXT.md §11.2). Verification plan:

1. `node --check` on every touched file.
2. Temp-DB smokes (`SKARN_DB_PATH=$(mktemp -d)/nl.db`): `runTool` with a `run_command` call for
   (a) a data command (`level`) → graceful result; (b) an admin command without permissions →
   denial; (c) unknown command → graceful error; (d) a command with `getXResponse` → payload sent +
   summary returned.
3. `node bot.js` boot check against a temp DB (validates activation completion doesn't break
   `scanCommands`).
4. `node -e` smoke: after a fetch, `buildContext` returns a non-empty `newsLine` (one per top-3
   categories, `[cat] headline` format) with no news-looking input.
5. Manual Discord QA after deploy: "what's my level", "set the welcome channel to #welcome",
   "run a poll", "show me the leaderboard", "ping", "what's happening in the world" (ambient news
   line visible in a non-news conversation).
