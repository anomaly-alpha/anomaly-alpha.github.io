# Skarn Bot — Domain Glossary & Decisions Record

## 1. Purpose of this file

This file serves two roles: a **domain glossary** defining every table, subsystem, and concept in the Skarn bot codebase, and a **decisions record** documenting architectural conventions, scoping rules, and design rationale. The glossary is maintained by auditing code and docs; the decisions record captures conventions that are not always explicit in the code itself. Drift between docs and code is flagged inline rather than silently corrected.

## 2. Core architectural pattern

The codebase follows a **vertical slice architecture**: each feature lives in `features/<name>/` and owns its commands, handler, and data. For example, `features/etch/etch.handler.js` handles the `/etch` command and writes to `memory_entries`. A command's Discord.js integration (the `.js` file in `commands/`) is a thin wrapper that delegates to its feature handler.

Two modules serve as shared layers that cut across all features:

- **`buildSystemPrompt()`** (`persona/identity.js`): The single function that assembles `SKARN_CORE_IDENTITY` + the command's role line (from `persona/roles.js`) + dynamic context lines (from `features/promptContext.js`) into the system prompt for every AI call. No command builds its own system prompt (except legacy commands `/ask` and `/summarize` — see drift note below).
- **Activation registry** (`features/activation/activationRegistry.js`): A central mapping of keyword phrases to command handlers, built at startup by scanning every command file's `activation` export. Provides text-based command invocation (e.g. `skarn weather`) as an alternative to slash commands. Two routing types: `'command'` (runs the slash handler directly) and `'ai'` (routes to the AI mention handler with an injected directive).

> **Drift**: `/ask` (`commands/ask.js`) and `/summarize` (`commands/summarize.js`) are marked deprecated in README.md but remain fully implemented. Both bypass `buildSystemPrompt()`, the persona system, and the shared AI client (`ai/client.js`) — each has its own inline system prompt and creates its own OpenAI instance. Both hardcode `model: 'gpt-3.5-turbo'` rather than using `selectModel()` from the model router. `/summarize` even uses its own rate limiting path. These commands are orthogonal to the vertical-slice pattern described here.

## 3. Scoping conventions

Every persistent table has a well-defined scope — the columns that form its primary key or unique constraint. This makes ownership and cleanup predictable. The following table covers every table in `db/skarn-schema.sql` and the subsystems they support:

| Subsystem | Scope | Key | Reason |
|---|---|---|---|
| `memory_entries` | per-user-per-guild | `(user_id, guild_id, type, content)` UNIQUE | Memory is personal to a user within a server |
| `channel_state` | per-channel | `channel_id` PRIMARY KEY | Channel mood is a conversation-scoped concept |
| `user_relationship` / familiarity | per-user-per-guild | `(user_id, guild_id)` PRIMARY KEY | Relationship is personal per server |
| `conversation_threads` + messages | per-thread | `thread_id` PRIMARY KEY | Threaded conversation has its own identity |
| `guild_config` | per-guild | `(guild_id, key)` PRIMARY KEY | Settings are server-level |
| `guild_mood` | per-guild | `guild_id` PRIMARY KEY | Mood aggregates at server level |
| `server_culture` | per-guild-per-channel | `(guild_id, channel_id, ngram)` PRIMARY KEY | Language patterns are channel-specific |
| Realm tables (`realm_characters`, inventory, quests, etc.) | per-user-per-guild | `(user_id, guild_id)` on `realm_characters` | Game state is personal per server |
| `knowledge_graph` | per-user-per-guild | `(user_id, guild_id, entity_type, entity_name)` UNIQUE | Extracted knowledge is personal per server |
| `user_preferences` | per-user-per-guild | `(user_id, guild_id)` PRIMARY KEY | Preferences are per-server |
| `attention_state` | per-user-per-guild-per-channel | `(user_id, guild_id, channel_id)` PRIMARY KEY | Attention tracking is channel-specific |
| `cooldowns` (generic) | per-key | `key` PRIMARY KEY | Generic cooldown by arbitrary key |
| `follow_ups` | per-user | `(user_id, status, due_after)` INDEX | Follow-ups belong to a user |
| `user_profile` | per-user-per-guild | `(user_id, guild_id)` PRIMARY KEY | Profile is personal per server |
| `user_emotional_context` | per-user-per-guild | `(user_id, guild_id)` PRIMARY KEY | Emotional state is personal per server |
| `rate_limits` | per-user | `(user_id, timestamp)` INDEX | Rate limiting is per-user |
| `mention_cooldowns` | per-user-per-channel | `(user_id, channel_id)` PRIMARY KEY | Mention throttle is per-conversation |
| `interjection_cooldowns` | per-channel | `channel_id` PRIMARY KEY | Interjection is per-conversation |
| `active_listen_cooldowns` | per-channel | `channel_id` PRIMARY KEY | Active listening is per-conversation |
| `sentiment_buffers` | per-channel | `channel_id` PRIMARY KEY | Sentiment is per-conversation |

**Scoping rule**: the majority of tables are scoped by `(user_id, guild_id)` — data belongs to a user within a specific server. Exceptions are channel-scoped concepts (`channel_state`, `sentiment_buffers`, cooldown tables) and guild-scoped config (`guild_config`, `guild_mood`). No table is truly global (all users, all guilds) except ephemeral key-value stores (`app_state`, `app_flags`) and the shared knowledge base (`knowledge_base`). This uniformity means bulk cleanup by user or by guild follows a predictable pattern.

> **Drift — `user_memory` table is dead**: The `user_memory` table (schema lines 2–8) and its exports `getUserMemory()`, `addUserMemory()`, `deleteUserMemory()` in `database.js` are never called. All etch data is written to and read from `memory_entries`. The `user_memory` table, its indexes, and its helper functions are dead code.
>
> **Drift — `knowledge_graph` is NOT dead**: The documentation previously stated that `memory_entries` "replaces the previous `user_memory` + `knowledge_graph` separation." This is incorrect — `knowledge_graph` (schema lines 234–245) is still actively written by `features/intelligence/knowledgeGraph.js` and queried via `database.js` `getKnowledge()`. Only `user_memory` was replaced.
>
> **Drift — "All state in SQLite" is not absolute**: Two modules maintain in-memory cooldown Maps: `features/discordNative/reactionSystem.js` (line 6) and `commands/search.js` (line 13). These are ephemeral (not durable state), but the rule as stated is contradicted by a literal reading.
>
> **Drift — No Confidant Mode table**: "Confidant Mode" appears in spec documents but has no table or module in the codebase.

## 4. Rate limiting and cost control

Rather than one global rate limiter, the bot uses **separate buckets per concern**, each with its own table (or in-memory Map) and ceiling:

| Bucket | Table / Mechanism | Window | Ceiling | Why separate |
|---|---|---|---|---|
| General AI calls | `rate_limits` | 10-minute sliding window | 10 per window | Prevents one user from exhausting the AI budget |
| Hourly AI cap | `ai_usage` | 1-hour rolling | 50 per hour | Guards against excessive per-user spend |
| @mention responses | `mention_cooldowns` | 1 second | 1 per user per channel | Prevents ping-pong loops |
| Random interjections | `interjection_cooldowns` | 5 minutes | 1 per channel | Avoids spammy presence |
| Active listening cues | `active_listen_cooldowns` | 5 minutes | 1 per channel | Same spacing principle |
| Reaction emoji | In-memory `Map` in `reactionSystem.js` | ~60 seconds | 1 per channel | Ephemeral — no durability needed |

**Design rationale**: each major feature that triggers an AI call or outbound Discord action gets its own rate limit bucket. This prevents one feature's traffic (e.g. reaction spam) from starving another (e.g. AI replies). The general `rate_limits` table is the shared admission gate for all AI-bound calls; the per-feature cooldowns are lighter-weight checks that run before that gate is consulted. A consequence: adding a new feature that makes AI calls or sends outbound messages should always include a new cooldown table or check — reusing an existing bucket risks cascading throttles.

> **Drift**: The reaction cooldown (`reactionSystem.js`) and search cooldown (`commands/search.js`) are in-memory Maps, not SQLite-backed. These are the two exceptions to the "all state in SQLite" convention.

## 5. Persona and role conventions

- **`SKARN_CORE_IDENTITY`** (`persona/identity.js` lines 1–51): The invariant core persona — a multi-paragraph character definition that every AI call starts with. Never modified at runtime. Defines Skarn's voice (casual Discord native), familiarity scale, emotional intelligence heuristics, and self-preservation rules.
- **`roles.js`** (`persona/roles.js`): Exports three parallel objects: `roles` (27 role instruction strings), `roleTokenBudgets` (100–1000 token budgets per role), and `ROLE_NATURE` (classification: casual / moderate / serious). Every AI command has exactly one role in `roles`; no command inlines its own role string (except deprecated `/ask` and `/summarize`).
- **`roleTokenBudgets`**: Assigns a max token ceiling per role. Range: 100 (roast, compliment, insult, pickup, meme) to 1000 (realm). This controls how much the AI is allowed to generate per invocation. These budgets are consumed by each feature's OpenAI call independently — there is no shared token tracking across calls.
- **`ROLE_NATURE` classification**: Three categories — `casual` (banter, jokes, insults), `moderate` (storytelling, adventure, debate), `serious` (homework, code, recipe). Drives context-assembly tiering in `buildContext()`: `isFullTier` is based on message length and question detection, not directly on `ROLE_NATURE`. The nature value is passed as `opts.roleNature` but is not used to toggle tiering — it is available for features to read.
- **Temperature conventions**: Temperature is set per-call in each feature's OpenAI invocation, not derived from `ROLE_NATURE` or centralized in `roles.js`. A loose pattern is visible across the codebase: factual tasks (homework, code, vein, summarizer, knowledgeGraph) use 0.2–0.3; general conversation (consult, mentionRouter, search, interjectionEngine) uses 0.8–0.85; creative tasks (joke, insult, pickup, meme, wouldyourather, unpopularopinion) use 0.95–1.0. The shared AI client (`ai/client.js`) provides only the OpenAI singleton — it sets no default temperature or model.
- **`ROLE_NATURE` duplication pattern**: `roles`, `roleTokenBudgets`, and `ROLE_NATURE` are three separate objects that duplicate the same set of keys. Adding a new role requires editing all three. Keys can drift out of sync — for example, `search` and `realm_npc` appear in `roles` and `roleTokenBudgets` but are absent from `ROLE_NATURE`, meaning they have no nature classification assigned.

> **Drift — token budget drift**: `roleTokenBudgets.consult` is 400 in `roles.js`, while spec documents (e.g. `2026-07-18-persona-depth.md`) describe a 900-token budget for the consult role. The `roles.js` values should be treated as the source of truth — verify spec numbers against the code before trusting them.
>
> **Drift — socratic/advice tier not implemented**: `socraticLine` is accepted as a parameter by `buildSystemPrompt()` (`identity.js` line 58) but is **never populated** by `buildContext()` (`promptContext.js` returns no `socraticLine` in its result object at lines 108–117). The Advice tier described in ADR-001 (tiered-context-assembly) does not exist in the current codebase — no socratic directive is injected into any system prompt.
>
> **Drift — historical function names**: The existing glossary previously described `buildContext()` as "merging the previous `collectContext()` and `assembleContext()`" — those functions no longer exist anywhere in the codebase. The historical note cannot be verified by reading current code.

## Domain Glossary

### Persona

- **Skarn**: The Warmaster of the Abyss, a 10,000-year-old retired demon who serves Anomaly Alpha as a Discord bot.
- **buildSystemPrompt()**: Single function in `persona/identity.js` that assembles core identity + role line + all context lines into a unified system prompt for every AI call.
- **Role line**: Command-specific instruction from `persona/roles.js`. Every AI command has exactly one role line. No command inlines its own role string.

### Memory Systems

- **memory_entries**: The unified persistent memory table. Replaces the previous `user_memory` + `knowledge_graph` separation. All user-specific memory lives here with a `source` discriminator.
- **source='etch'**: User-intended facts via `/etch` command. Confidence is always 1.0. **Exempt from confidence decay** — these are permanent until the user runs `/forget`.
- **source='extracted'**: Entities auto-extracted from conversations by the knowledge graph. Confidence starts at 0.5 and can increase with reinforcement or decay with inactivity. Subject to decay (0.95× after 30 days, pruned below 0.2).
- **source='conversation'**: Memory derived from conversation history summaries (future use). Not yet implemented.
- **Conversation graph**: The threaded conversation history stored in `conversation_threads` + `conversation_messages` + `conversation_summaries`. This is distinct from memory_entries — it stores raw messages, not extracted knowledge.

### State Persistence

- **All state in SQLite**: No in-memory Maps, Sets, or JSON files may hold state that could be lost on restart. Every cooldown, flag, chain, and buffer persists to SQLite.
- **rate_limits**: Rolling window table for per-user API call rate limiting. Stores individual timestamps for the 10-minute sliding window.
- **mention_cooldowns**: Per-user-per-channel cooldown for @mention responses (1s TTL).
- **interjection_cooldowns**: Per-channel cooldown for random interjections (5min TTL).
- **active_listen_cooldowns**: Per-channel cooldown for active listening cues (5min TTL).
- **sentiment_buffers**: Per-channel rolling window of last 5 message texts, used for Weathering state detection. Persisted in SQLite despite being ephemeral in nature.
- **app_flags**: Generic key-value store for ephemeral-until-expiry flags (apology flags, milestones, first-of-day, etc.).
- **app_state**: Generic key-value store for bot-level persistent state (no expiry).
- **guild_config**: Per-guild key-value settings. Replaces `data/config.json`.
- **user_levels**: Per-guild-per-user XP and level. Replaces `data/levels.json`.

### Context Assembly

- **buildContext()**: Single function in `features/promptContext.js` that produces all context lines for the AI system prompt. Merges the previous `collectContext()` (directive lines) and `assembleContext()` (conversation content) into one unified output.
- **Context lines**: Individual sections inside the system prompt: stateLine, moodLine, relationshipLine, cultureLine, memoryLine, warmthLine, patienceLine, callbackLine, gratitudeLine, firstOfDayLine, milestoneLine, apologyLine, emotionalLine, conversationLine, knowledgeLine, socraticLine.

### Intelligence Systems

- **Knowledge graph**: The `features/intelligence/knowledgeGraph.js` module that extracts structured entities from conversations using AI. Writes to `memory_entries` with `source='extracted'`.
- **Knowledge base**: The general-purpose knowledge store (`knowledge_base` + `knowledge_fts` tables). Contains seeded Wikipedia topics and user-taught facts via `/learn`. Completely separate from per-user memory.
- **Model router**: Selects between `AI_MODEL` and `AI_MODEL_COMPLEX` based on message length, question detection, and knowledge graph match.
- **Response learner**: Tracks before/after sentiment shifts per response to classify as hit/miss/neutral in `response_learning` table.

### Wisdom Systems

- **Emotional intelligence**: Keyword + sentiment-based emotion detection (happy/sad/anxious/angry/stressed). State stored in `user_emotional_context`. Generates tone directives for the AI system prompt.
- **Story engine**: Topic-triggered story retrieval (war/loss/change/tech/time/power). Hybrid model: stories are AI-generated on first use, stored in `skarn_stories`, referenced on subsequent related topics.
- **Socratic questioning**: Keyword-triggered (`should I`, `what should`, etc.) module that adds a questioning directive to the system prompt for advice-seeking users.

### Relationship & Server Awareness

- **Familiarity**: 0-100 score in `user_relationship`. Gained per interaction type (message=0.5, AI=1, mention=2, etch=1). Capped at +3/day for message-based gains. Decays 1/day of inactivity.
- **Channel state**: Per-channel mood machine (Dormant/Attentive/Charged/Weathering). Dormant is only ever set by the decay pass, never by incoming messages.
- **Server culture**: Bigram-based channel language tracking. N-grams stored in `server_culture` table with frequency counters.

### User Preferences

- **proactive_opt_in**: The column (DEFAULT 0) controlling whether users receive proactive messages (check-ins, follow-ups). 0 = opted out by default (no proactive messages), 1 = opted in. Renamed from `proactive_opt_out` which had inverted semantics.
- **Mention cooldown**: 1-second cooldown per user per channel for @mentions. Silently ignores rapid mentions.
- **Proactive cap**: 1 proactive message per user per day maximum.

### Command Activation

- **Activation phrase**: A keyword that triggers a command when typed in chat (e.g., `skarn weather`, `skarn joke`). Every command has an optional activation phrase registered in the activation registry, providing a text-based alternative to slash commands.
- **Activation registry**: Central module (`features/activation/activationRegistry.js`) that maps keyword phrases to commands. Built at startup by scanning each command file's `activation` export. Two routing types: `'command'` (runs the slash command handler) and `'ai'` (routes to the AI mention handler with an injected directive).
- **Fast-path skippers**: The four built-in keyword handlers (`skarn opt in`, `skarn opt out`, `skarn chat mode`, `skarn status`) that run inline before the activation registry and return immediately without AI.
- **Activation phrase wins**: A registered activation phrase always takes priority over the @mention AI handler and AI channel auto-respond for messages it matches.
