# Skarn Bot — Architecture

## System Overview

Skarn is a Discord.js v14 bot with an LLM-powered AI persona ("Skarn, the Warmaster of the Abyss"). It runs on Node.js, stores state in SQLite, and calls OpenAI for every AI feature. The bot has ~75 slash commands spanning AI conversation, games, server management, fun, and utilities.

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

```
User message
    │
    ▼
buildContext(userId, guildId, channelId)
    │  Reads from SQLite: channel state, guild mood, relationship,
    │  server culture, memory entries, conversation history,
    │  user profile, emotional context, knowledge base, news
    │
    ▼
buildSystemPrompt({ roleLine, ...all context lines })
    │  Assembles SKARN_CORE_IDENTITY + role instruction + 13+ context lines
    │
    ▼
OpenAI API (model from modelRouter.js)
    │  Temperature: 0.8 (consult) / 0.85 (mention) / varies by command
    │  Token budget: from roleTokenBudgets[role], modified by deadpan escalation
    │
    ▼
postProcess(reply, roleNature)
    │  Probabilistic: lowercase, period stripping, abbreviations, emoji
    │
    ▼
simulateTyping() → estimateDelay() → message.reply()
```

## Persona Layer Architecture

The persona system is assembled from 5 layers, fused into a single system prompt:

```
Layer 1: Identity         persona/identity.js     SKARN_CORE_IDENTITY (invariant)
Layer 2: Role             persona/roles.js         Per-command role instruction
Layer 3: Context          features/promptContext.js 13 dynamic lines from 7 subsystems
Layer 4: Post-processing  features/discordNative/postProcess.js  Probabilistic text transform
Layer 5: Behaviors        features/{warmth,humor,etiquette,wisdom}/  Memory, timing, warmth
```

Every AI call goes through all 5 layers.

## Vertical Slice Architecture

Each feature owns its own subdirectory in `features/`:

```
features/<name>/
├── <name>.command.js       — Slash command definition (thin)
├── <name>.handler.js       — Business logic (AI calls, DB writes, etc.)
commands/<name>.js          — Thin wrapper: re-exports command + handler
```

The `commands/` directory contains thin wrappers only. `bot.js` loads all 75 command files.

## Key Modules

### Persona
| Module | File | Responsibility |
|--------|------|----------------|
| Core identity | `persona/identity.js` | `SKARN_CORE_IDENTITY` + `buildSystemPrompt()` |
| Role registry | `persona/roles.js` | 27 role lines, token budgets, nature classification |

### Context Assembly
| Module | File | Responsibility |
|--------|------|----------------|
| Context collector | `features/promptContext.js` | Fetches all dynamic context from 7 subsystems |
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
| AI client | `ai/client.js` | Singleton OpenAI instance |
| Mention router | `features/mentionRouter/` | @mention handling, AI call dispatch |
| Consult handler | `features/consult/` | `/consult` command handler |
| Model router | `features/intelligence/modelRouter.js` | Selects AI_MODEL vs AI_MODEL_COMPLEX |
| Knowledge graph | `features/intelligence/knowledgeGraph.js` | Entity extraction from conversations |
| Rate limiter | `lib/rateLimit.js` | 10 calls per 10 minutes per user (SQLite-backed) |
| AI stats | `lib/aiStats.js` | Hourly per-user cap (50/hr) |
| Gates | `lib/gates.js` | Hostile user check, activation gates |

### Realm of Skarn (RPG)
| Module | File | Responsibility |
|--------|------|----------------|
| Command router | `features/realm/realmCommand.js` | 11 subcommands (create/explore/combat/inventory/etc.) |
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
| Typing sim | `features/discordNative/typingSim.js` | Realistic typing delay |
| Context injector | `features/discordNative/contextInjector.js` | Last-5-messages context |
| Attention gate | `features/discordNative/attentionGate.js` | Probability-based auto-respond gate |
| Activation registry | `features/activation/activationRegistry.js` | Text command routing ("skarn weather") |
| Proactive scheduler | `features/proactive/scheduler.js` | Follow-ups, absence check-ins |
| Interjection engine | `features/presence/interjectionEngine.js` | AI-driven proactive interjections |
| Hostile detector | `features/safety/hostileDetector.js` | 3-strike silence for hostile users |

### Data Layer
| Module | File | Responsibility |
|--------|------|----------------|
| Database | `db/database.js` | 60+ exported functions, all SQLite access |
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
| Hostile content | 10 regex patterns, 3 strikes in 1h → silence | Blocks AI calls for hostile users |
| Rate limit | 10 calls per 10 min per user (SQLite) | Prevents abuse across all AI commands |
| Hourly cap | 50 per hour per user | Controls cost |
| Mention cooldown | 1s per user per channel (SQLite) | Prevents ping-pong loops |
| Sleep mode | Configurable UTC hours; skips AI responses | Reduces cost during quiet hours |
| Reaction-only | 10% chance → only emoji reaction, no AI text | Reduces cost for casual messages |
| Opt-in required | `proactive_opt_in` column defaults to 0 | Users must opt in for proactive messages |
| Role line safety | Explicit bans in role lines (gore, romance) | Content safety baked into system prompt |
| Slur filter Gate 1 | System prompt instruction (safetyLine) + identity edit | Reduces likelihood of AI-generated slurs |
| Slur filter Gate 2 | SQLite pattern matching (exact/substring/regex) with 5-min cache | Catches known slurs deterministically |
| Slur filter Gate 3 | OpenAI Moderation API | Catches novel slurs and context-dependent hate speech |
| Unified strike system | 3 strikes in 10 min -> 10 min silence; extensions add +2 min | Combined hostile input + flagged output safety |
| Realm rate limit | 30 calls/30min/user (in-memory) + 1000/day/guild | Separate cap for RPG subsystem |
| Realm combat timeout | 5-minute in-memory timer, 10% gold penalty | Prevents abandoned combat resource leaks |
| Realm trade timeout | 5-minute in-memory timer, automatic cancellation | Prevents abandoned trade negotiation |

## Tiered Context Assembly (ADR-001)

The persona system uses a **tiered `buildContext()`** function in `features/promptContext.js`:

| Tier | Trigger | Content | Token cost |
|------|---------|---------|------------|
| **Lightweight** | Messages < 50 chars, no `?` | All directive lines + last 3 messages | ~1,000 |
| **Full** | Messages ≥ 50 chars or contains `?` | All directive lines + 15 messages + 2 summaries + profile + knowledge + server buzz | ~3,000 |
| **Advice** (not implemented) | Matches "should I"/"what should" | Full + socratic directive | ~3,100 |

The Advice tier is documented in ADR-001 and the `socraticLine` parameter is accepted by `buildSystemPrompt()` (in `persona/identity.js`) but **never populated** — `promptContext.js` returns no `socraticLine`. The feature is unimplemented dead surface area.

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
    ├─► Exploration: aiDriver.js → OpenAI (hardcoded gpt-5.4-mini) → parseChoices() → buttons
    │     All AI generation uses realm's own buildContextPrompt(), NOT promptContext.js
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
- **Separate AI driver** — `aiDriver.js` ignores the persona system's `promptContext.js`, has its own `buildContextPrompt()`, hardcodes `model: 'gpt-5.4-mini'`, and uses 30-second timeouts
- **Separate rate limiting** — 30 calls/30min/user (in-memory) + 1000 calls/day/guild (SQLite), completely independent from the bot-wide 10/10 limit
- **In-memory state for active systems** — combat (5-min timeout) and trades (5-min timeout) use in-memory Maps, consistent with the main bot's cooldown pattern
- **Atomic trades** — item/gold transfers wrapped in `db.transaction()` for consistency
- **`awaitMessages` in character creation** — 5-step wizard uses `interaction.channel.awaitMessages()` which requires the user to type in the same channel; times out after 60s

## Database Design

All state lives in SQLite (`data/skarn.db`). No external database. Key patterns:
- **Per-user-per-guild** scoping for most tables `(user_id, guild_id)` PK
- **Ephemeral flags** via `app_flags` with optional TTL (SETs auto-clean via `pruneExpiredFlags()`)
- **FTS5** on conversation messages and knowledge base for full-text search
- **No migrations** — schema is `CREATE TABLE IF NOT EXISTS` on every startup; column additions use try/catch for idempotency

See `docs/DATABASE.md` for the full table reference.

## Known Active Bugs

| Bug | Location | Impact |
|-----|----------|--------|
| Duplicate ROLE_NATURE (fixed 2026-07-20) | `postProcess.js` vs `roles.js` | Drift risk — `search` was missing from canonical source |
| Deadpan escalation (fixed 2026-07-20) | `comedyTiming.js` | `extendBanterChain()` wrote to SQLite only, never updated in-memory Map |
| `clearFlags()` is a no-op | `etiquetteEngine.js` line 44 | Called every 10min decay cycle, does nothing |
| `isSilenced()` guildId parameter silently dropped | `gates.js` vs `hostileDetector.js` | Misleading signature, no actual bug |
| Duplicate `canCall()`/`recordCall()` | `lib/rateLimit.js` and `database.js` | Two implementations of same rate limit logic |
| `mentionRouter.js` / `consult.handler.js` near-duplicate | Both handlers | ~180 lines of nearly identical AI call logic |
| Database god module | `db/database.js` (870 lines) | 60+ functions, violates vertical-slice separation |
| Callback sampling is random | `callbackEngine.js` | 10% random, not gated by sentiment or reactions (per spec) |

## Environment Variables

See `.env.example` for required vars. Key notes:
- `OPENAI_API_KEY` is **required** for all AI features (not in `.env.example` — add manually)
- `AI_MODEL` defaults to `gpt-3.5-turbo`; `AI_MODEL_COMPLEX` falls back to `AI_MODEL`
- `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` enable Google search; without them, search uses a DDG fallback
- Sleep defaults to 1:00–7:00 UTC; set both to 0 to disable
