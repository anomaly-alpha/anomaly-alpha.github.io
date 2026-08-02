# Skarn Natural-Language Tool Invocation — Design Spec

- **Date:** 2026-08-02
- **Status:** DESIGN — not implemented. No code changes yet (user: "review your spec for gaps save to file then run grill").
- **Audience:** agentic implementers + reviewers; meant to be grille-checked against skarn-bot docs before planning.
- **Related:** `CONTEXT.md` §2 (vertical slices, activation registry), §4 (rate buckets), §5 (role conventions, reply condenser); `skarn-bot/docs/specs/2026-08-02/deepseek-v4-flash/skarn-reply-condenser-design.md` (condenser, `usedTool` flag, [S5.2]).

---

## [S1] Problem

Skarn can already be asked to *do things* two ways: exact activation phrases (`skarn weather` → runs the command handler via the activation registry) and slash commands. But natural-language requests like `skarn what is the weather in Tokyo` or `skarn can you roll the dice for me` match **neither** — they fall through to the AI mention handler (`bot.js:286` `\bskarn\b` → `handleMention`), where the model answers **from memory alone** with no live data, no real randomness, and no access to server state.

The plumbing for fixing this already exists and is live: `features/ai/sharedPipeline.js:runPipeline` offers the model `tools` + `tool_choice: 'auto'` on turn 1 of every mention/consult, and `features/tools/toolRunner.js` executes whatever the model calls, feeding the result back for the final in-character reply. Today the model has exactly **4 tools** (`toolDefinitions.js`): `etch_memory`, `get_memory`, `search_web`, `set_reminder`. There is no weather tool, no news tool, no RNG tool, no stats tool — so the LLM's tool-calling capability is under-utilized exactly where the user feels it ("he knows when we are asking for one of his tools").

**Success criteria:**
1. `skarn what is the weather in <place>` triggers `get_weather`, returns live wttr.in data narrated in Skarn's voice.
2. `skarn can you roll the dice for me` triggers `roll_dice` with a real roll (not a model guess).
3. Tool failures degrade to a natural in-character "couldn't fetch" reply — never an error thrown into the pipeline.
4. The reply condenser leaves tool-driven replies uncondensed (consistent with condenser spec [S5.2]).
5. Exact activation phrases (`skarn weather`) keep working unchanged — the tool loop is an addition, not a replacement.

## [S2] Scope

- **In scope (V0):** extend `features/tools/toolDefinitions.js` (schemas) and `features/tools/toolRunner.js` (execution) with 5 new tools: `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats`. Plus shared-helper extraction in `commands/stats.js` (`getStatsData`), `commands/dice.js` (`getDiceResponse` export), `commands/coinflip.js` (`getCoinflipResponse` export) so the tools share one source of truth with the commands (grill Q3/Q4). No changes to `sharedPipeline.js`, `bot.js`, the mention router, or the activation registry.
- **Out of scope (V0):**
  - AI-content commands (translate, 8ball, joke, fortune, advice, compliment, roast…) — the model generates these in-line already; a tool would only add a wasted round-trip.
  - Knowledge-base tool — `kbLine` is already injected into the system prompt (`promptContext.js:46,237`); a lookup tool would be redundant.
  - Realm commands — stateful game UI, wrong shape for chat tool calls.
  - Fuzzy activation-registry phrases and any intent-classifier pre-pass (approaches B/C rejected in brainstorming).
  - Changing the pipeline's `maxTurns = 3` or turn-1-only tool offering.

## [S3] Architecture overview

Five files change, all inside existing vertical slices:

1. **`toolDefinitions.js`** — append 5 JSON-schema function definitions to the exported `tools` array. The `description` field is the call-accuracy lever: each one includes example phrasings so the model recognizes fuzzy requests.
2. **`toolRunner.js`** — append 5 `case` arms to the existing `switch (name)`. Each arm returns the existing `{ role: 'tool', tool_call_id, content }` shape. Fail-open: wrap external calls in try/catch and return a readable failure string, never throw.
3. **`commands/stats.js`** — extract `getStatsData(userId, guildId)`; `execute()` and `getStatsResponse()` now consume it (kills the existing query duplication).
4. **`commands/dice.js`** / **`commands/coinflip.js`** — export the existing pure response helpers (`getDiceResponse`, `getCoinflipResponse`); behavior unchanged.

**Data flow** (unchanged pipeline): `@Skarn <fuzzy request>` → `bot.js:293`/`286` → `handleMention` → `runPipeline` → turn-1 model call with tools → model emits `tool_calls` → `runTool` executes → tool result message appended → turn-2 model narrates in-character → reply. Exact `skarn weather` still hits the activation registry fast-path at `bot.js:258` and never reaches the pipeline.

**Cost note:** each tool call consumes one extra AI round-trip (1 tool + 1 narration = 2 calls, within `maxTurns = 3`). Every call is already rate-limited per call by `moderatedChatCompletion`. Weather/news fetches themselves are free (wttr.in has no key; news reads the cache, triggering an on-demand fetch only when empty).

## [S4] Tool schemas (added to `toolDefinitions.js`)

| Tool | Params (schema) | Description highlights (call-accuracy lever) |
|---|---|---|
| `get_weather` | `location` (string, required) | "Fetch current weather + 3-day forecast for a place. Use when the user asks about weather, temperature, conditions, or forecast — e.g. 'what's the weather in Tokyo', 'is it raining in Paris'. If no location given, ask which place." |
| `get_news` | — (no params) | "Fetch today's headlines. Use when the user asks what's in the news, 'any headlines', or 'what's happening'. If the cache is empty, triggers a fresh fetch before answering." |
| `roll_dice` | `sides` (integer, optional, 2–100, default 6) | "Roll a real die. Use for 'roll a d20', 'roll for initiative', 'roll the dice for me'. Returns the actual roll — do not invent one." |
| `flip_coin` | — (no params) | "Flip a real coin. Use for 'flip a coin', 'heads or tails'. Returns an actual result — do not invent one." |
| `get_user_stats` | — (no params) | "Fetch the requesting user's conversation stats (message count, questions, threads, top topics, engagement). Use when someone asks 'what are my stats', 'how many messages have I sent'." |

**Security note:** `get_user_stats` takes **no** `userId` param — the runner always uses `context.userId` (the requester). The model cannot attempt to read another user's stats because the schema offers no target to pass (privacy by omission).

## [S5] Tool execution (added to `toolRunner.js`)

All arms receive `context = { guildId, channelId, userId }` (existing signature).

1. **`get_weather`** — `const { fetchWeather } = require('../../lib/weatherScheduler')`. Call `fetchWeather(location)` (wttr.in, `lib/weatherScheduler.js:17`). On success, format a **compact plain-text** summary for the model: location, `current.temp_C`/`temp_F`, `weatherDesc[0].value`, humidity, wind (`windspeedKmph`/`winddir16Point`), plus 3-day forecast (`data.weather.slice(0,3)` mintemp/maxtemp + condition — mirror `buildRawEmbed`'s field logic but as text). On throw → `"Weather service unreachable for \"<location>\". Try a city name, e.g. 'Tokyo'."` (fail-open).
2. **`get_news`** — `const { getRecentNews, fetchNews } = require('../news/newsFetcher')`. Read `getRecentNews(10)`; **if empty, `await fetchNews()` once, then re-read** (on-demand refresh, locked in grill — the hourly scheduler may not have populated the cache yet). Still empty → `"No news cached yet — check back in a bit."` Else top 5 as `• <headline> — <snippet>` lines (mirror `commands/news.js` raw mode, which slices headline to 100 / snippet to 150 chars).
3. **`roll_dice`** — `const { getDiceResponse } = require('../../commands/dice')` — the command's pure response helper, **exported** so the tool and the command share one source of truth (locked in grill: extract helpers everywhere). `sides = parsed.sides` clamped to 2–100 (default 6) → `getDiceResponse({ sides })`.
4. **`flip_coin`** — `const { getCoinflipResponse } = require('../../commands/coinflip')` — same shared-helper pattern (`commands/coinflip.js:3`).
5. **`get_user_stats`** — `const { getStatsData } = require('../../commands/stats')` — a **new extracted shared getter** (locked in grill: stats.js already duplicates its queries twice; a third copy would drift). `getStatsData(userId, guildId)` returns the plain numbers (total messages, questions, threads from `conversation_messages`/`conversation_threads`; profile fields from `user_profile`), and `execute()`/`getStatsResponse()`/the tool **all** consume it. Tool formats a short text block (no EmbedBuilder — the model narrates). No guild (`context.guildId` null) → `"Stats need a server."`

**Return shape** (all arms): `{ role: 'tool', tool_call_id, content: <string> }` — identical to existing arms.

## [S6] Integration with existing systems

- **Reply condenser:** `sharedPipeline.js:165` passes `usedTool` into `condenseReply`. Per condenser spec [S5.2], `usedTool = true` skips condensation — tool-driven replies (weather numbers, news headlines, roll results) are returned untouched. No condenser change needed; this is the correct interaction.
- **Rate limits:** each tool executes inside `runPipeline`, whose AI calls already pass `moderatedChatCompletion` (bucket `'chat'`). External fetches (wttr.in) are ungated and free — no new bucket needed (CONTEXT.md §4 separate-buckets rule applies to AI calls; the weather fetch is a plain HTTP call, same as the existing `search_web` DDG fallback).
- **Activation registry:** untouched. `skarn weather`, `skarn dice`, `skarn news`, `skarn stats` keep their deterministic fast-path; the tools serve the fuzzy cases.
- **`get_news` cache dependency:** news is scheduler-populated (`features/news/newsFetcher.js`, hourly); the tool triggers an on-demand `fetchNews()` when the cache is empty (locked in grill), so first-ask works regardless of scheduler timing. Only if the on-demand fetch also returns nothing does the tool fail open.
- **Shared helpers (locked in grill):** `commands/dice.js` exports `getDiceResponse`, `commands/coinflip.js` exports `getCoinflipResponse`, `commands/stats.js` gains `getStatsData(userId, guildId)` — all consumed by both the command and the tool. One source of truth, no drift. (The activation/slash scanners only read `data`/`activation` exports, so adding exports is harmless.)

## [S7] Error handling & safety

- Every new arm wraps its external work in try/catch; failures return a readable fail-open string to the model (which narrates it naturally). Never throw out of `runTool` — the existing `default` arm pattern already guarantees a tool-shaped response.
- `get_weather` requires `location`; if the model omits it the schema `required` enforces a model-side correction, and a defensive `!location` check returns a fail-open hint (mirrors `search_web`'s `missing query` handling).
- `get_user_stats` takes no `userId` param at all — only `context.userId` is ever queried (privacy by omission; grill Q5).
- The tool loop is bounded by `maxTurns = 3` and turn-1-only tool offering (unchanged); no new unbounded loop risk.
- No user-facing error strings are introduced; the pipeline's existing `AI_ERRORS` path is unaffected.

## [S8] Configuration

None. The existing tool loop has no master switch (the 4 current tools are always offered); adding 5 more keeps that behavior. Constants mirror existing project style (UPPER_SNAKE_CASE inline): `DICE_MIN = 2`, `DICE_MAX = 100`, `DICE_DEFAULT = 6`, `NEWS_LIMIT = 10`, `NEWS_TOP = 5`. No config file, no env vars.

## [S9] Verification (project convention: no test framework — node -e smokes)

The project is deliberately test-free (CONTEXT.md §11.2). Verify via `node --check` + `node -e` smoke with a `SKARN_DB_PATH` temp DB:

- `node --check` on all changed files (`toolDefinitions.js`, `toolRunner.js`, `commands/stats.js`, `commands/dice.js`, `commands/coinflip.js`).
- **Runner smoke (offline-deterministic):** call `runTool` directly with a canned `tool_call` for each new tool:
  - `get_weather` with a **stubbed `fetchWeather`** (monkey-patch `lib/weatherScheduler` before require — per the known destructure-at-require constraint) returning canned wttr.in JSON → asserts temp/condition/wind present.
  - `get_weather` with stub throwing → asserts the fail-open string, no throw.
  - `get_news` with empty cache → triggers on-demand fetch, asserts headline lines after; with fetch also returning nothing → fail-open string.
  - `roll_dice`/`flip_coin` → shape + value range (sides clamp 2–100).
  - `get_user_stats` with temp DB rows → counts present (via the shared `getStatsData`).
- **Shared-helper regression smoke:** `commands/stats.js` `execute()`/`getStatsResponse()` still render the same fields after refactoring to `getStatsData`; `commands/dice.js`/`coinflip.js` exports exist and produce the same strings as before.
- **Boot check:** `node bot.js` boots (then exits) without load errors.
- **Live check (manual, noted not automated):** model call-choice on fuzzy phrasings is only verifiable in a running bot — `@Skarn what is the weather in Tokyo`, `@Skarn can you roll the dice for me`. Document as a manual QA step.

## [S10] Non-goals / deferred

- Fuzzy activation-registry phrases and intent-classifier pre-passes (rejected in brainstorming; approach A chosen).
- Embed short-circuit output for tool calls (option A2 — model narrates instead of emitting `/weather`-style embeds).
- Tools for AI-content commands, knowledge base, and realm (see [S2]).
- Expanding the pipeline's `maxTurns` / multi-turn tool chaining.
- Tool call-count telemetry or per-guild tool enable/disable (no config surface in V0).

---

## [S11] Resolved decisions (brainstorming + grill-with-docs, 2026-08-02)

Locked during brainstorming and the grilling session; do not silently reverse them (re-grill first if a later pass conflicts):

| Decision | Locked answer |
|---|---|
| Scope | **Broad tool-ify pass** — audit-style, but gated by the data/state criterion. |
| Selection rule | A command becomes a tool only when the model **cannot** produce the output itself (live data, DB state, real RNG). AI-content commands excluded. |
| Mechanism | **Approach A** — extend the existing `toolDefinitions.js`/`toolRunner.js` loop. No pipeline/bot.js/registry changes. |
| Tool batch | `get_weather`, `get_news`, `roll_dice`, `flip_coin`, `get_user_stats` (5 new; 9 total). |
| Terminology | **AI tool** ≠ **activation phrase**: tools are model-decided and fuzzy; activation phrases are exact-prefix and deterministic. Both documented in CONTEXT.md §2. |
| Condenser interaction | Tool-driven replies stay **uncondensed** (existing `usedTool` rule, `condenser.js:26`). Weather/news narration may run long — revisit only if live use shows rambling. |
| Stats sharing | Extract `getStatsData(userId, guildId)` in `commands/stats.js`; slash handler, activation handler, and the tool all call it. |
| RNG sharing | Extract helpers **everywhere**: `getDiceResponse`/`getCoinflipResponse` exported from their command files; tool imports them. |
| Stats schema | `get_user_stats` takes **no** `userId` param — privacy by omission; the runner always uses `context.userId`. |
| News freshness | `get_news` triggers an on-demand `fetchNews()` when the cache is empty, then re-reads; only a doubly-empty fetch fails open. |
| Token cost | All 9 tool schemas ship on every mention turn 1 (always-on, matching today's 4); no keyword gate. |
| Call accuracy | Tool `description` fields carry example phrasings; model call-choice verified live, runner verified offline. |

---

## Source anchors (for downstream plan `Covers:`)

Consumed by `compose:plan`. Section IDs `[S1]`–`[S11]` are stable — do not renumber on later rewordings.
