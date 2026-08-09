# Skarn Bot — Architecture

> **Derived overview (2026-08-08):** this file is a high-level diagram, not the spec.
> When it disagrees with `CONTEXT.md`, CONTEXT.md wins — and file a correction here.
> Drift fixes tracked by `npm run audit:docs` (scripts/audit-docs.js).

## System Overview

Skarn is a Discord.js v14 bot with an LLM-powered AI persona ("Skarn, the Warmaster of the Abyss"). It runs on Node.js, stores state in SQLite, and calls OpenAI for every AI feature. The bot has 78 slash commands spanning AI conversation, games, server management, fun, and utilities.

## High-Level Data Flow

```
Discord Gateway
      │
      ▼
  bot.js (messageCreate / interactionCreate)
      │
      ├─► State tracking (non-blocking, Promise.allSettled)
      │     ├─ channelState/stateTracker.js     — per-channel mood machine
      │     ├─ relationship/relationshipTracker.js — familiarity + tags
      │     ├─ culture/cultureTracker.js         — n-gram language tracking
      │     ├─ warmth/warmthManager.js           — sentiment tracking
      │     ├─ humor/callbackEngine.js           — in-session funny moments
      │     ├─ humor/comedyTiming.js             — banter chains + timing
      │     └─ humor/comedyTiming.recordSetup()  — punchline setup detection
      │
      ├─► Fast-path skippers (skarn opt in/out, skarn chat mode, skarn status)
      │
      ├─► Activation registry (text commands like "skarn weather")
      │
      ├─► @mention handler → mentionRouter.js
      │
      ├─► Passive reactions → reactionSystem.js
      │
      ├─► AI channel auto-respond → attentionGate.js → mentionRouter.js
      │
      ├─► Passive interjections → interjectionEngine.js
      │
      └─► XP gain
```

## AI Call Flow (every `/consult` or `@Skarn` mention)

Both handlers delegate to the shared pipeline `runPipeline()` (`features/ai/sharedPipeline.js:46`):

```
User message
    │
    ▼
runMessageAnalysis()  — preprocessing/pipeline.js (analyzer + shouldAnalyze gate)
    │  Analyzer output informs model routing + memory extraction
    ▼
buildContext(userId, guildId, channelId)      — features/promptContext.js
    │  Returns 32 context lines from ~12+ modules: channel state, guild mood,
    │  relationship, server culture, memory entries, conversation history,
    │  user profile, emotional context, knowledge base, news, lorebook, RAG,
    │  socratic guidance, safety line, server wisdom, etc.
    ▼
buildSystemPrompt({ roleLine, ...context lines })   — persona/identity.js
    │  Assembles SKARN_CORE_IDENTITY + role instruction + context lines
    ▼
Tool loop (turn 1: getTools() + tool_choice 'auto')  — features/tools/*
    │  Model may call a tool (run_command, get_weather, …); runTool() executes
    │  it and feeds the result back for the final in-character reply
    ▼
OpenAI API (moderatedChatCompletion, model from modelRouter.js)
    │  Temperature: 0.8 (consult) / 0.85 (mention) / varies by command
    │  Token budget: from roleTokenBudgets[role], modified by deadpan escalation
    ▼
condenseReply()  — features/ai/condenser.js
    │  Tightens over-target replies to the role's character reply target
    ▼
storeMessage('assistant') → trackResponse → extractMemory (non-blocking)
    │
    ▼
startTypingKeepalive(channel) → getTypingDelay(reply.length) → splitMessage/maybeBurst → send
    │  Typing indicator kept alive for the whole thinking duration; one
    │  length-scaled pre-send pause (0.5–4 s); long replies split via
    │  splitMessage + maybeBurst (postProcess() is /search-only — see below)
```

## Persona Layer Architecture

The persona system is assembled from 5 layers, fused into a single system prompt:

```
Layer 1: Identity         persona/identity.js     SKARN_CORE_IDENTITY (invariant)
Layer 2: Role             persona/roles.js         Per-command role instruction
Layer 3: Context          features/promptContext.js 32 context lines from ~12+ modules
Layer 4: Post-processing  features/discordNative/postProcess.js  Probabilistic text transform
Layer 5: Behaviors        features/{warmth,humor,etiquette,wisdom}/  Memory, timing, warmth
```

Layers 1–2 (identity + role) apply to every AI call. Layers 3–4 are **not universal**: the realm `aiDriver.js`, `musingEngine.js`, `presenceCycler.js`, `preprocessing/analyzer.js`, `condenser.js`, and `intelligence/toneAnalyzer.js` build their own context or output path and bypass `promptContext.js` / `postProcess.js`. Layer 4's `postProcess()` is a `/search`-only flavor pass (`commands/search.js:77`, `features/search/search.handler.js:74`); consult/mention use `splitMessage`/`maybeBurst` from the same module instead.

## Vertical Slice Architecture

Each feature owns its own subdirectory in `features/`:

```
features/<name>/
├── <name>.command.js       — Slash command definition (thin)
├── <name>.handler.js       — Business logic (AI calls, DB writes, etc.)
commands/<name>.js          — Thin wrapper: re-exports command + handler
```

The `commands/` directory contains thin wrappers only. `bot.js` loads all 78 command files.

## Key Modules

### Persona
| Module | File | Responsibility |
|--------|------|----------------|
| Core identity | `persona/identity.js` | `SKARN_CORE_IDENTITY` + `buildSystemPrompt()` |
| Role registry | `persona/roles.js` | 39 role lines, 39 token budgets, 39 nature classifications (roles/roleTokenBudgets/ROLE_NATURE keys aligned) |

### Context Assembly
| Module | File | Responsibility |
|--------|------|----------------|
| Context collector | `features/promptContext.js` | Fetches all dynamic context — `buildContext()` returns 32 context lines from ~12+ modules (channel state, mood, relationship, culture, memory, warmth, humor, etiquette, emotion, news, knowledge, lorebook, RAG, etc.) |
| Channel state | `features/channelState/` | Dormant/Attentive/Charged/Weathering state machine |
| Relationship | `features/relationship/` | Familiarity, tags, banter level per user |
| Mood | `features/mood/` | Per-guild mood (neutral/tired/amused/focused/refreshed) |
| Culture | `features/culture/` | N-gram language tracking per channel |
| Warmth | `features/warmth/` | Sentiment-aware warmth, patience, active listening |
| Humor | `features/humor/` | Callback engine, comedy timing, banter chains |
| Etiquette | `features/etiquette/` | Gratitude, first-of-day, milestones, apologies |
| Wisdom | `features/wisdom/` | Emotional intelligence, story engine |

### AI Orchestration
| Module | File | Responsibility |
|--------|------|----------------|
| Shared pipeline | `features/ai/sharedPipeline.js` | `runPipeline()` (:46) — single consult/mention AI flow: analysis → `buildContext()` → `buildSystemPrompt()` → tool loop → `condenseReply()` → `storeMessage()` → typing → `splitMessage`/`maybeBurst` |
| AI client | `ai/client.js` | Singleton OpenAI instance + `moderatedChatCompletion()` (central admission gate: `isSilenced()` + rate-limit reserve) |
| Mention router | `features/mentionRouter/` | @mention handling, delegates to `runPipeline()` |
| Consult handler | `features/consult/` | `/consult` command handler, delegates to `runPipeline()` |
| Model router | `features/intelligence/modelRouter.js` | Selects AI_MODEL vs AI_MODEL_COMPLEX |
| Knowledge graph | `features/intelligence/knowledgeGraph.js` | Entity extraction from conversations |
| Message analysis | `features/preprocessing/pipeline.js` | `runMessageAnalysis()` + `shouldAnalyze()` gate (analyzer-only; retriever/assembler trimmed) |
| Reply condenser | `features/ai/condenser.js` | Tightens over-target replies to the role's character reply target (skips structured content) |
| AI tools | `features/tools/` | `toolDefinitions.js` (getTools), `toolRunner.js` (runTool), `messageAdapter.js` (pseudo-message facade) — model-decided function calls on turn 1 of the pipeline |
| Presence cycler | `features/presence/presenceCycler.js` | Rotating `client.setActivity` phrases, batch AI-generated pool (300) with 24h regen throttle |
| Musing engine | `features/presence/musingEngine.js` | Ambient reflections (~1/guild/2 days, quiet channels) + `/musing` command path |
| Rate limiter | `lib/rateLimit.js` | 50 calls per 10 minutes per user (`RATE_LIMIT_MAX_CALLS`, `lib/rateLimit.js:13`); `canCall()`/`recordCall()` single implementation (db/database.js is a re-export facade) |
| AI stats | `lib/aiStats.js` | Hourly per-user cap (50/hr) |
| Gates | `lib/gates.js` | `ensureAiConfigured()` only — hostile user checks live in `features/safety/slurFilter.js` (`isHostile`/`recordStrike`/`isSilenced`, enforced centrally in `moderatedChatCompletion()`) |

### Realm of Skarn (RPG)
| Module | File | Responsibility |
|--------|------|----------------|
| Command router | `features/realm/realmCommand.js` (router) + `features/realm/handlers/` (per-subcommand UI handlers) | 11 subcommands (create/explore/combat/inventory/etc.) |
| AI driver | `features/realm/aiDriver.js` | Separate AI context builder, 5 generators (backstory, exploration, combat narration, NPC dialogue, quest hooks) |
| Character | `features/realm/character.js` | Character creation, XP/leveling, healing |
| Combat | `features/realm/combat.js` | Turn-based combat engine (attack/defend/flee), enemy rolling |
| World | `features/realm/world.js` | 8-location graph navigation, AI text parsing |
| NPC | `features/realm/npc.js` | 16 NPC templates, interaction handler with memory |
| Inventory | `features/realm/inventory.js` | Loot generation, auto-equip best, pagination |
| Quest | `features/realm/quest.js` | Quest creation, progress tracking, auto-completion |
| Economy | `features/realm/economy.js` | Player trading (in-memory + atomic SQLite), merchant sales |
| Config | `features/realm/realmConfig.js` | Races, classes, locations, item templates, enemy scaling |
| Store | `features/realm/realmStore.js` | Realm-specific DB access layer (separate from database.js) |
| Rate limit | `features/realm/realmRateLimit.js` | 30 calls/30min/user + 1000/day/guild (independent from bot-wide limiter)

### Discord Integration
| Module | File | Responsibility |
|--------|------|----------------|
| Post-processor | `features/discordNative/postProcess.js` | Lowercase, emoji, abbreviation injection |
| Reaction system | `features/discordNative/reactionSystem.js` | Passive emoji reactions (3% chance) |
| Typing sim | `features/discordNative/typingSim.js` | `startTypingKeepalive()` + `getTypingDelay()` (single length-scaled pre-send pause; `typingController.js` deleted) |
| Context injector | `features/discordNative/contextInjector.js` | **Zero callers** — conversation context comes from `getRecentAssistantOrUserMessages()`/`getServerBuzz()` in `promptContext.js` instead |
| Attention gate | `features/discordNative/attentionGate.js` | Probability-based auto-respond gate |
| Activation registry | `features/activation/activationRegistry.js` | Text command routing ("skarn weather") |
| Proactive scheduler | `features/proactive/scheduler.js` | Follow-ups, absence check-ins |
| Interjection engine | `features/presence/interjectionEngine.js` | AI-driven proactive interjections |
| Hostile content | `features/safety/slurFilter.js` | 10 regex patterns, 3 strikes in 10-min window → 10-min silence (input-only; enforced centrally in `moderatedChatCompletion()`) |

### Data Layer
| Module | File | Responsibility |
|--------|------|----------------|
| Database | `db/` | Facade `db/database.js` + domain modules (`memory`, `conversation`, `relationship`, `channel`, `ops`, `humor`, `stories`) + `db/db.js` connection |
| Schema | `db/skarn-schema.sql` | 30+ tables (run on startup via CREATE IF NOT EXISTS) |

## State Machine: Channel Mood

```
                  ┌──────────┐
      6h idle     │          │      messages arrive
   ┌──────────────►  Dormant ◄──────────────────────┐
   │              │          │                      │
   │              └─────┬────┘                      │
   │                    │ messages arrive            │
   │                    ▼                            │
   │              ┌──────────┐    8 msgs / 5 min    │
   │              │ Attentive ├────────────────────► │
   │              │          │                      │
   │              └─────┬────┘◄─────────────────────┘
   │                    │      30 min idle
   │         ┌──────────▼──────────┐
   │         │  Charged  │  Weathering │
   │         │ (heated)  │ (negative   │
   │         │           │  sentiment) │
   │         └─────┬─────┴──────┬─────┘
   │               │            │
   │               └─── 30 min idle ──┘
   │                     (both → Attentive)
   └────────────────── (6h from any state) ──┘
```

Dormant is **only** set by `stateDecay.js` `runDecayPass()` — never by message arrival.

## Guardrails

| Guardrail | Mechanism | Effect |
|-----------|-----------|--------|
| Hostile content | 10 regex patterns, 3 strikes in 10 min → silence | Blocks AI calls for hostile users |
| Rate limit | 50 calls per 10 min per user (SQLite, `RATE_LIMIT_MAX_CALLS`) | Prevents abuse across all AI commands |
| Hourly cap | 50 per hour per user | Controls cost |
| Per-guild AI spend budget | `GUILD_AI_DAILY_LIMIT` (default 2000/day) on chat buckets (chat/musing/interjection), enforced in `moderatedChatCompletion()` after moderation; DMs share a `'dm'` pseudo-guild bucket; support calls unbudgeted | One busy server can't exhaust the shared wallet |
| Mention cooldown | `checkMentionCooldown`/`setMentionCooldown` removed 2026-08-08 (dead); `mention_cooldowns` table dropped 2026-08-08 | Mention path uses `canInteract`/`canRespond`/`isHostile`/`isSilenced` instead |
| Sleep mode | Configurable UTC hours; skips AI responses | Reduces cost during quiet hours |
| Reaction-only | 10% chance → only emoji reaction, no AI text | Reduces cost for casual messages |
| Opt-in required | `proactive_opt_in` column defaults to 0 | Users must opt in for proactive messages |
| Role line safety | Explicit bans in role lines (gore, romance) | Content safety baked into system prompt |
| Slur filter Gate 1 | System prompt instruction (safetyLine) + identity edit | Reduces likelihood of AI-generated slurs |
| Slur filter Gate 2 | **Deleted 2026-08-01** — DB pattern matching removed (`slur_filter` table, cache, CRUD helpers) | No longer applies (CONTEXT.md §13) |
| Slur filter Gate 3 | OpenAI Moderation API (fail-closed, centralized in `moderatedChatCompletion()`) | Catches novel slurs and context-dependent hate speech |
| Unified strike system | 3 strikes in 10-min window → 10-min silence; input-only strikes; de-escalation lines are static (no AI call) | Combined hostile input + flagged output safety |
| Realm rate limit | 30 calls/30min/user (SQLite via `app_flags`) + 1000/day/guild (`realm_world_state`) | Separate cap for RPG subsystem |
| Realm combat timeout | 5-minute in-memory timer, 10% gold penalty | Prevents abandoned combat resource leaks |
| Realm trade timeout | 5-minute in-memory timer, automatic cancellation | Prevents abandoned trade negotiation |

## Tiered Context Assembly (ADR-001)

The persona system uses a **tiered `buildContext()`** function in `features/promptContext.js`:

| Tier | Trigger | Content | Token cost |
|------|---------|---------|------------|
| **Lightweight** | Messages < 50 chars, no `?` | All directive lines + last 3 messages | ~1,000 |
| **Full** | Messages ≥ 50 chars or contains `?` | All directive lines + 15 messages + 2 summaries + profile + knowledge + server buzz | ~3,000 |
| **Advice** (implemented 2026-08-01) | Matches "should I"/"what should" | Full + socratic directive | ~3,100 |

The Advice tier is implemented (2026-08-01): `buildContext()` (`features/promptContext.js:30-33`) calls `getSocraticQuestion()` (`features/wisdom/socraticEngine.js`, 18 trigger phrasings) and promotes the message to full tier. See CONTEXT.md §5 (socraticLine).

## Realm of Skarn — RPG Architecture

The Realm is a self-contained text RPG with its own subsystem, separate from the main persona system.

### Realm AI Call Flow

```
Player action (button click / slash command)
    │
    ▼
realmCommand.js router
    │
    ├─► Character creation: 5-step wizard (name → race → class → background → AI backstory)
    │
    ├─► Exploration: aiDriver.js → OpenAI (model via selectModel) → parseChoices() → buttons
    │     All AI generation uses realm's own buildRealmContext() (NOT promptContext.js)
    │
    ├─► Combat: damage calculated by code, AI narrates only
    │     HP persists per-round → prevents mid-fight restart exploit
    │     In-memory combat store with 5-minute timeout
    │
    ├─► NPC interaction: NPC template → AI dialogue generation → sentiment tracking → NPC memory
    │
    ├─► Quest: auto-creates from NPC quest hooks, auto-progress from exploration events
    │
    └─► Trading: in-memory trade negotiation → SQLite transaction → atomic execution
```

### Realm Key Design Decisions

- **Damage by code, narration by AI** — combat outcomes are deterministic, AI only adds flavor text (invariant in `combat.js:134-152`)
- **Separate AI driver** — `aiDriver.js` has its own `buildRealmContext()`, passes `bucket: 'realm'` to the central gate, uses 30-second timeouts, and routes model choice through `selectModel()` (`modelRouter.js`) like the rest of the bot (was previously documented as hardcoded `gpt-5.4-mini` — corrected 2026-08-04).
- **Separate rate limiting** — 30 calls/30min/user (SQLite via `app_flags`) + 1000 calls/day/guild (`realm_world_state`), completely independent from the bot-wide 50/10-min limit (`RATE_LIMIT_MAX_CALLS`)
- **In-memory state for active systems** — combat (5-min timeout) and trades (5-min timeout) use in-memory Maps, intentionally volatile live-game sessions (combat/trade/tetris) per CONTEXT.md §2
- **Atomic trades** — item/gold transfers wrapped in `db.transaction()` for consistency
- **`awaitMessages` in character creation** — 5-step wizard uses `interaction.channel.awaitMessages()` which requires the user to type in the same channel; times out after 60s

## Database Design

All state lives in SQLite (`data/skarn.db`). No external database. Key patterns:
- **Per-user-per-guild** scoping for most tables `(user_id, guild_id)` PK
- **Ephemeral flags** via `app_flags` with optional TTL (SETs auto-clean via `pruneExpiredFlags()`)
- **FTS5** on conversation messages and knowledge base for full-text search
- **Versioned migrations** — `db/migrations.js` runs at startup (`db/db.js:41`), tracked via SQLite `user_version` (3 migrations). Base schema is still `CREATE TABLE IF NOT EXISTS` on every startup (`db/skarn-schema.sql`); column additions use try/catch for idempotency

See `docs/DATABASE.md` for the full table reference.

## Known Active Bugs

| Bug | Location | Impact |
|-----|----------|--------|
| Duplicate ROLE_NATURE (fixed 2026-07-20) | `postProcess.js` vs `roles.js` | Drift risk — `search` was missing from canonical source |
| Deadpan escalation (fixed 2026-07-20) | `comedyTiming.js` | `extendBanterChain()` wrote to SQLite only, never updated in-memory Map |
| `clearFlags()` was a no-op (fixed 2026-08-01) | `etiquetteEngine.js` (was line 44) | Removed entirely — TTL-based `app_flags` cleanup handles all flag expiry |
| Duplicate `canCall()`/`recordCall()` (fixed 2026-08-01) | `lib/rateLimit.js` and `database.js` | `lib/rateLimit.js` is now the single implementation (atomic reserve); `db/database.js` is a re-export facade |
| `mentionRouter.js` / `consult.handler.js` near-duplicate (fixed 2026-08-01) | Both handlers | Both delegate to `runPipeline()` (`features/ai/sharedPipeline.js`); only the defer/edit and canInteract/canRespond differences remain |
| Database god module (fixed 2026-08-04) | `db/database.js` → `db/` domain modules | `db/database.js` is now a facade over `db/{db,memory,conversation,relationship,channel,ops,humor,stories}.js`; 111 exports preserved, zero call-site changes |
| Callback sampling is random | `callbackEngine.js` | 10% random, not gated by sentiment or reactions (per spec) |

## Environment Variables

See `.env.example` for required vars. Key notes:
- `OPENAI_API_KEY` is **required** for all AI features (not in `.env.example` — add manually)
- `AI_MODEL` defaults to `gpt-5.4-mini`; `AI_MODEL_COMPLEX` falls back to `AI_MODEL`
- `TAVILY_API_KEY` enables web search via the Tavily API (single provider since 2026-08-02; free tier 1,000 credits/mo, basic search = 1 credit)
- Sleep defaults to 1:00–7:00 UTC; set both to 0 to disable
