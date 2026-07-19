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

> **Drift — `user_memory` table is stale (write path dead, read path alive)**: The `user_memory` table (schema lines 2–8) is stale — nothing writes to it (`addUserMemory()` is a dead export), but `getUserMemory()` is still actively called by 19 command files, reading stale data. The drift was previously stated as "table is dead" — that is only correct about writes. See §6.2 for the full fragmentation picture.
>
> **Drift — `knowledge_graph` is NOT dead on reads, but IS dead on writes**: The documentation previously stated that `memory_entries` "replaces the previous `user_memory` + `knowledge_graph` separation." This is incorrect — `knowledge_graph` (schema lines 234–245) is still actively **read** by `modelRouter.js` via `getKnowledge()`, but it is NOT actively written (`addKnowledge()` is never called). Knowledge graph extraction (`knowledgeGraph.js`) writes to `memory_entries` instead. Only `user_memory`'s write path was replaced. See §6.2 for the full fragmentation picture.
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

## 6. Memory systems — what's separate and why

The codebase maintains **7 distinct memory stores**, each with a different scope, write path, and read path. This separation is deliberate in some cases and accidental (fragmentation) in others.

### 6.1 The seven stores

| # | Store | Tables | Written by | Read by | Scope | Purpose |
|---|-------|--------|------------|---------|-------|---------|
| 1 | **Legacy user memory** | `user_memory` | **Nothing (stale)** | 19 command files via `getUserMemory()` + `relationshipTracker.js` for baseline familiarity | Per-user-per-guild | Pre-unification memory. Reads still happen; writes were migrated to `memory_entries`. **Active fragmentation.** |
| 2 | **Unified memory entries** | `memory_entries` | `etch.handler.js` (source='etch'), `knowledgeGraph.js` (source='extracted') | `promptContext.js` via `getMemoryEntries()` for AI context, `knowledgeGraph.js` via `getMemoryByType()` for formatKnowledge | Per-user-per-guild per-type-per-content | The current write target for all persistent memory. Replaced `user_memory` on the write path only. |
| 3 | **Legacy knowledge graph** | `knowledge_graph` | `addKnowledge()` — **dead export, never called** | `modelRouter.js` via `getKnowledge()` → `checkKnowledgeMatch()` for model selection | Per-user-per-guild per-entity | Currently stale — nothing writes new entities. Knowledge extraction (`knowledgeGraph.js`) writes to `memory_entries` instead. |
| 4 | **Conversation graph** | `conversation_threads`, `conversation_messages`, `conversation_summaries`, `conversation_fts` | `database.js` — `insertMessage()`, `createThread()`, `insertSummary()` + FTS5 index | Feature handlers via `getRecentMessages()`, `getThreadMessages()`, `getOlderSummaries()`, `searchConversations()` | Per-thread, indexed by user/guild/channel | Full conversation history with full-text search. Separate from extracted memory. |
| 5 | **Realm NPC memory** | `realm_npc_memory` | Realm system NPC interaction handlers | Realm system only | Per-NPC-per-user-per-guild | In-fiction NPC memory. Never bleeds to persona or system prompt. |
| 6 | **Emotional context** | `user_emotional_context` | `emotionalIntelligence.js` via `setUserEmotion()` | `getEmotionDirective()` for tone guidance in system prompt | Per-user-per-guild | Per-user emotion state. Advisory only — drives tone, not gating. |
| 7 | **Knowledge base** | `knowledge_base`, `knowledge_fts` | `knowledgeSeeder.js`, `/learn` command via `addKnowledgeBase()` | `searchKnowledgeBase()`, knowledge commands | Global (all users) | Seeded Wikipedia topics + user-taught facts. Completely separate from per-user memory. |

### 6.2 Fragmentation state

The migration from separate stores (`user_memory` + `knowledge_graph`) to a unified store (`memory_entries`) was **partially executed**:

- **Write path migrated**: both `/etch` and knowledge graph extraction write to `memory_entries`. `addUserMemory()` and `addKnowledge()` are dead exports.
- **Read path NOT migrated**: 19 commands still call `getUserMemory()` (reads from `user_memory`), and `modelRouter.js` calls `getKnowledge()` (reads from `knowledge_graph`). These read stale data.
- **Impact**: Users who `/etch` facts will not see them reflected in commands that read `user_memory` — their etch data lives in `memory_entries` but is invisible to the 19 commands. The AI context system (`promptContext.js`) correctly reads from `memory_entries` and will surface the data during AI conversation.

> **Drift — CONTEXT.md previously claimed `user_memory` table is dead**: That note was partially correct about writes (nothing writes to it) but wrong about reads — `getUserMemory()` is still actively called by 19 command files and `relationshipTracker.js`. The table has **stale data** rather than being fully dead.

> **Drift — CONTEXT.md previously claimed `knowledge_graph` is still active**: Only on the read side. `getKnowledge()` is called by `modelRouter.js`, but `addKnowledge()` is never called. Knowledge graph extraction (`knowledgeGraph.js`) writes to `memory_entries`, not `knowledge_graph`. The table is stale.

### 6.3 Design rule: no store merging

The 7 stores listed above are intentionally kept separate:

- **Memory vs conversation graph**: `memory_entries` stores extracted/persistent facts; `conversation_*` stores raw message history. They serve different purposes (fact retrieval vs. conversation context) and have different query patterns (fact lookups vs. time-ordered message history with FTS).
- **Per-user memory vs. global knowledge base**: `memory_entries` is scoped `(user_id, guild_id)`; `knowledge_base` is global. They have no overlap in content or access patterns.
- **NPC memory vs. persona memory**: `realm_npc_memory` lives inside the Realm game system and is never injected into Skarn's general system prompt. It is consumed only by Realm NPC interactions.
- **Emotional context vs. memory**: `user_emotional_context` tracks transient emotional state. It is overwritten on each mood check, not accumulated. It is not a memory store in the archival sense.
- **Fragmentation is NOT a design choice**: The `user_memory`/`memory_entries`/`knowledge_graph` split is an artifact of an incomplete migration. These should be consolidated — the stores serve the same logical purpose.

## 7. Guardrails that are load-bearing, not decorative

The following guardrails actively shape bot behavior. Each is documented here with its mechanism, file path, and why removing it would change observable behavior.

### 7.1 Content-safety in role lines

**File**: `persona/roles.js`

The `realm` role line restricts to "fantasy adventure fiction" with explicit bans: "no gratuitous gore, no romance or dating-style content." The `realm_combat` role likewise permits "fantasy violence only — no gratuitous gore." These are not advisory — the role lines are injected into the system prompt of every Realm AI call. Removing them would allow the AI to generate content outside these bounds.

Other role lines also encode implicit safety: `roast` says "never cruel — target the bit, not the person's real vulnerabilities"; `insult` says "clearly playful, never mean-spirited or targeting protected traits"; `homework`/`recipe`/`code` say "be accurate and clear first, in-voice second."

### 7.2 Hostile content detection (3-strike + silence)

**File**: `features/safety/hostileDetector.js`

11 regex patterns match hostile language (`shut up`, `stupid bot`, `f*ck you`, `you're useless`, `bad bot`, `worthless`, `kill yourself`, `go die`, etc.). Strikes are tracked per-user in a 1-hour sliding window via `app_flags`. At 3 strikes, `isSilenced()` returns `true`, and the user is blocked from AI interactions until the window expires. The silence is enforced via `lib/gates.js` `checkHostile()` which is called in the command execution path.

Removing this guardrail would allow hostile users to continue consuming AI resources and potentially trigger negative feedback loops in the persona system.

### 7.3 Emotion detection (advisory, not gating)

**File**: `features/wisdom/emotionalIntelligence.js`

Keyword + sentiment-based emotion detection maps user text to happy/sad/anxious/angry/stressed states. Stored in `user_emotional_context`. `getEmotionDirective()` returns a tone guidance string injected into the AI system prompt (e.g., "They seem frustrated. Don't match the anger. Be steady and let them vent.").

This is advisory — it does not block or gate AI responses. Removal would make Skarn's tone less responsive to user emotional state but would not break functionality.

### 7.4 Reaction-only mode (10% chance)

**File**: `features/authenticity/reactionController.js`

`shouldReactOnly()` returns true with 10% probability for casual intents (`casual`, `sharing`, `banter`, `greeting`). When true, the bot sends only an emoji reaction instead of an AI-generated text reply. This reduces AI call costs for low-stakes messages and adds a natural "busy" behavior.

Without it, every casual message would trigger an AI call, increasing cost and making the bot feel overly responsive.

### 7.5 Sleep mode

**File**: `bot.js` lines 64–74

`isSleepTime()` checks the current hour against `SLEEP_START`/`SLEEP_END` config (default: 1 AM – 7 AM UTC). During sleep hours, the bot skips mention handling and interjections. Controlled by environment variables, defaults to active.

Removal would cause the bot to respond 24/7, increasing cost for servers with low nighttime activity and potentially disrupting users who expect quiet hours.

### 7.6 State decay (Dormant from decay only)

**File**: `features/channelState/stateDecay.js`

The decay pass runs on a timer and is the **only** code path that sets a channel to `Dormant`. Channels with no messages for 6+ hours transition from their current state to `Dormant`. Charged/Weathering states revert to Attentive after 30 minutes of no activity.

This invariant is explicit in the code comments: "this is the ONLY place Dormant is ever assigned" (`stateDecay.js` line 18). Removing the decay pass would leave channels stuck in whatever state they last reached, and no channel would ever return to Dormant.

### 7.7 Attention gate (probability-based)

**File**: `features/discordNative/attentionGate.js`

`shouldRespond()` uses a stacking probability model: recency boost (2 min), channel warmth (30 s), question detection (+0.6), message count escalation (0–1.0), channel activity decay, sentiment boost (+0.4 for angry/stressed/sad), and a fallback AI YES/NO call. It also respects user opt-in: only opted-in users receive proactive messages.

This is the primary gate for non-reply, non-mention AI responses. Disabling it would make the bot respond to every message in monitored channels, dramatically increasing AI call volume.

## 8. Known trade-offs, accepted deliberately

The following architectural trade-offs are consciously accepted rather than accidental. Each is documented with the rationale and the condition under which it should be revisited.

| Trade-off | Why accepted | What would change this |
|-----------|-------------|----------------------|
| `user_memory` ↔ `memory_entries` ↔ `knowledge_graph` fragmentation (3 tables, 2 stale, 2 dead import paths) | Partial migration — etch and knowledge extraction moved to `memory_entries` but 19 commands still read from `user_memory` and `modelRouter.js` reads from `knowledge_graph`. Fixing requires updating 19 command files to call `getMemoryEntries()` and redirecting `modelRouter.js` to use `getMemoryByType()`. | When the 19 command files and `modelRouter.js` are migrated to `memory_entries` as their read source. |
| In-memory Maps for reaction and search cooldowns (`reactionSystem.js` line 6, `search.js` line 13) | These are ephemeral cooldowns — losing them on restart has no consequence (no user-facing data loss). SQLite-backed cooldowns exist for longer-lived throttles (mention, interjection, active listen). | If cooldown data must survive restart (e.g., to prevent abuse across bot restarts) or if the in-memory approach misses multi-instance deployments. |
| Plaintext conversation storage (`conversation_messages.content`) | No threat model assumes database compromise. The bot operates in trusted server environments. | If the bot is deployed to environments requiring encryption-at-rest or if compliance (GDPR data minimization) demands it. |
| No timezone-aware scheduling (UTC only) | Simplicity — `SLEEP_TIMEZONE` is an integer UTC offset applied arithmetically. No DST, no per-user timezone support (except `user_preferences.timezone` which is stored but unused). | If per-user scheduling (reminders, follow-ups at user-local times) becomes a requirement. |
| `roleTokenBudgets.consult` = 400 | Original budget set before context injection was added to the system prompt. The effective budget is shared between the role response and the growing context lines. | If user feedback consistently shows truncated consult responses, or when token-use monitoring confirms the budget is regularly exceeded. |
| `socraticLine` accepted by `buildSystemPrompt()` but never populated by `buildContext()` | The Advice tier described in ADR-001 was never implemented. The parameter exists as dead surface area in the API. | If the Advice tier is implemented (detecting advice-seeking patterns = "should I", "what should" and injecting a socratic directive). |
| 19 commands read from `user_memory` (stale) instead of `memory_entries` (current) | Historical — the migration of the read path was not completed when the write path was migrated. The 19 command files embed `getUserMemory()` calls in their handler logic. | When all 19 command files are updated to call `getMemoryEntries()` instead and the `user_memory` table is either removed or populated from `memory_entries`. |

## 9. Cross-cutting bugs already found and fixed once

The following bugs have been found, fixed, and could recur. They are documented here with their root cause and the invariant that prevents recurrence.

### 9.1 Double-write races on in-memory-then-persisted state machines

**Root cause**: Several state machines read from a fast in-memory cache, mutate, then persist to SQLite. If two events arrive concurrently for the same entity (e.g., two messages from the same user in the same channel), both read the same baseline, compute their delta, and write — the second write overwrites the first's delta.

**Fix**: Serialize state transitions per key via SQLite transaction or compare-and-swap (`UPDATE ... WHERE last_seen_at = ?`).

**Invariant**: Any state machine that is read-mutate-write should either (a) use a SQLite transaction, (b) use a conditional update that verifies the baseline hasn't changed, or (c) be scoped such that concurrent writes for the same key are impossible by design.

**What to watch for**: `database.js` dynamic update functions (`updateChannelState`, `updateRelationshipField`, `upsertUserProfile`, `upsertAttentionState`) all read-then-write without transactions. Adding new read-mutate-write paths should include serialization.

### 9.2 Concurrent-message double-processing

**Root cause**: The `messageCreate` handler (`bot.js` line 277) fires multiple state-tracking functions via `Promise.allSettled`. If the same message triggers both the mention handler and an interjection or reaction path, the AI invocation logic is entered twice for the same message content.

**Fix**: Add a processed-message dedup set (volatile, last N message IDs) at the top of `messageCreate`.

**Invariant**: Every inbound message should be processed at most once by any AI-invocation path. A message-ID dedup set (or recent-message cache) prevents re-entry.

**What to watch for**: If AI responses start doubling for the same user message, check whether the dedup was removed or the set size was reduced.

### 9.3 State computed on message arrival should never represent silence (Dormant)

**Root cause**: Early versions of the channel state machine set `Dormant` when a message arrived after a long gap. This created an incorrect cycle: message → set Dormant → decay pass sees Dormant and does nothing → next message also sees Dormant. Dormant should represent "no messages at all," not "messages arrived after silence."

**Fix**: `Dormant` is now only assigned by `stateDecay.js` (`runDecayPass`), never by `stateTracker.js` or any message handler.

**Invariant**: No code path outside `runDecayPass()` in `stateDecay.js` may set a channel state to `Dormant`. All message-triggered state transitions must go to Attentive or Charged, never directly to Dormant.

### 9.4 SQLite prepared statement `.apply()` vs `.run(...vals)` spread

**Root cause**: Dynamic SQL generation in `database.js` builds prepared statements at runtime with spread arguments: `.run(...values, userId, gid, channelId)`. The spread passed an array to `.run()`, but better-sqlite3's `.run()` expects positional arguments, not an array. Older code used `.apply(stmt, vals)` which worked but was fragile.

**Fix**: Converted all dynamic SQL call sites to use `.run(...vals)` spread consistently.

**Invariant**: Every place in `database.js` that builds a dynamic `UPDATE ... SET` query must use `.run(...values, ...keys)` spread arguments, not `.apply()`. The 5 dynamic query builders (`updateChannelState`, `updateRelationshipField`, `upsertUserProfile`, `upsertAttentionState` update, `upsertAttentionState` insert) all follow the spread pattern.

### 9.5 Dead code in gates.js (signature mismatch)

**File**: `lib/gates.js` line 16, `features/safety/hostileDetector.js` line 47

**Root cause**: `gates.js` `checkHostile(userId, guildId)` accepts a `guildId` parameter and passes it to `isSilenced(userId, guildId)`, but `isSilenced()` in `hostileDetector.js` only takes a single `userId` parameter — the `guildId` is silently dropped. The function still works correctly because the strike tracking is per-user (not per-guild), but the signature is misleading.

**Fix**: Either remove the `guildId` parameter from `checkHostile()` or add guild-scoped strike tracking to `hostileDetector.js`.

**Invariant**: Any gate function in `lib/gates.js` must match the parameter signature of the underlying check function. Mismatched parameters that are silently dropped should be removed or implemented.

### 9.6 `user_memory` ↔ `memory_entries` fragmentation (currently active)

**File**: `db/database.js` lines 31–45 (user_memory reads) vs. `features/etch/etch.handler.js` line 11 (memory_entries writes)

**Root cause**: When `memory_entries` was created as the unified memory table, the write path was migrated (`/etch` → `addMemoryEntry()`) but the read path was not — 19 command files still call `getUserMemory()` which reads from the stale `user_memory` table. Additionally, `modelRouter.js` calls `getKnowledge()` which reads from the stale `knowledge_graph` table, while knowledge extraction (`knowledgeGraph.js`) writes to `memory_entries`.

**Status**: **Active** — not yet fixed. This is the only bug on this list that is currently live.

**Impact**: User etch data is written to `memory_entries` but the 19 commands that read memory for AI context use `user_memory`, which has no new data. The AI context system (`promptContext.js`) correctly reads from `memory_entries`, so the fragmentation only affects the 19 standalone commands, not the AI conversation flow.

**Fix needed**: Update all 19 command files to replace `getUserMemory(...)` with `getMemoryEntries(...)`, and update `modelRouter.js` to use `getMemoryByType()` from `memory_entries` instead of `getKnowledge()` from `knowledge_graph`.

## 10. Environment variables in use

The following environment variables are consumed by the codebase. Variables are listed with their requirement level, code-level default (if any), and what they control.

| Variable | Required | Default | Controls |
|----------|----------|---------|----------|
| `DISCORD_TOKEN` | Yes | — | Discord bot authentication (`bot.js` line 471: `client.login()`) |
| `CLIENT_ID` | Yes | — | Discord application ID (used in slash command registration) |
| `OPENAI_API_KEY` | For AI | — | OpenAI API key for all AI calls (`ai/client.js` line 7) |
| `GOOGLE_CSE_KEY` | For `/search` | — | Google Custom Search Engine API key (`features/search/searchEngine.js` line 18) |
| `GOOGLE_CSE_CX` | For `/search` | — | Google Custom Search Engine CX (search engine ID, `features/search/searchEngine.js` line 19) |
| `SLEEP_START` | No | `1` | Sleep mode start hour (UTC+offset). Set with `SLEEP_END=0` to disable sleep. (`bot.js` line 64) |
| `SLEEP_END` | No | `7` | Sleep mode end hour (UTC+offset) (`bot.js` line 65) |
| `SLEEP_TIMEZONE` | No | `0` | UTC offset applied arithmetically to sleep hours. Integer, not DST-aware. (`bot.js` line 66) |
| `AI_MODEL` | No | `gpt-3.5-turbo` | Default OpenAI model for all AI calls (`features/intelligence/modelRouter.js` line 9) |
| `AI_MODEL_COMPLEX` | No | falls back to `AI_MODEL` | Model used for long/question/complex queries and knowledge-matched queries (`modelRouter.js` lines 4, 7) |

> **Note**: `AI_MODEL` and `AI_MODEL_COMPLEX` are **not present in `.env.example`** — they must be added manually or by copying from this table. They are consumed only by `features/intelligence/modelRouter.js`; the deprecated `/ask` and `/summarize` commands hardcode `gpt-3.5-turbo` and ignore both variables.
>
> **Note**: `SLEEP_START` / `SLEEP_END` defaults (1 and 7) match `.env.example`. The actual deployment (`.env`) sets both to `0` to disable sleep. This is an environment-specific choice, not a code default mismatch.

## 11. Open questions / not yet decided

The following architectural and configuration decisions are unresolved. Each is documented with the observed code behaviour and the question that needs a deliberate answer.

1. **`user_memory` ↔ `memory_entries` fragmentation (most critical)** — The write path was migrated to `memory_entries` (`etch.handler.js`), but 19 command files still read from `user_memory` via `getUserMemory()`. The AI context system reads correctly from `memory_entries`, so the bug only affects standalone commands. This is the most impactful unresolved fragmentation because users who `/etch` facts will not see them reflected in commands that query `user_memory`. The fix is mechanical (replace 19 call sites + redirect `modelRouter.js`) but requires a coordinated change across multiple files.

2. **`knowledge_graph` ↔ `memory_entries` fragmentation** — `knowledgeGraph.js` writes extracted entities to `memory_entries` (source='extracted'), but `modelRouter.js` reads from `knowledge_graph` via `getKnowledge()` to check for knowledge matches. This is a second fragmentation bug: extracted entities are never seen by the model router, which uses `checkKnowledgeMatch()` to decide whether to use the complex model. The read path (`modelRouter.js`) and write path (`knowledgeGraph.js`) are operating on different tables.

3. **`roleTokenBudgets.consult` = 400 (spec called for 900, never increased)** — The budget was set before context injection was added to the system prompt. Spec documents (e.g., `2026-07-18-persona-depth.md`) describe a 900-token budget. The effective budget is shared between the role response and the growing context lines. No token-usage monitoring exists to confirm whether the current budget is regularly exceeded.

4. **No test framework configured** — 6 test files exist in `tests/` but no test runner is configured in `package.json`. There is no `npm test` script, no test framework dependency, and no CI pipeline. The tests cannot be executed without manual setup. This creates a documentation-vs-reality gap: the presence of test files suggests a testing story that does not exist.

5. **`ROLE_NATURE` duplication — three files, must stay in sync** — `roles`, `roleTokenBudgets`, and `ROLE_NATURE` are three separate objects in `persona/roles.js` that duplicate the same set of role keys. Adding a new role requires editing all three. Keys can drift out of sync — `search` and `realm_npc` appear in `roles` and `roleTokenBudgets` but are absent from `ROLE_NATURE`, meaning they have no nature classification assigned. No guard (test, lint rule, or code generation) prevents further drift.

6. **In-memory cooldown Maps — exceptions to the "all state in SQLite" rule** — `features/discordNative/reactionSystem.js` (line 6) and `commands/search.js` (line 13) maintain ephemeral cooldowns in in-memory `Map` objects rather than SQLite tables. These are explicitly accepted trade-offs (lost on restart with no user-facing impact), but they contradict the documented "all state in SQLite" convention and would need redesign for multi-instance deployments.

7. **`socraticLine` in `buildSystemPrompt()` signature but never populated by `buildContext()`** — `socraticLine` is accepted as a parameter by `buildSystemPrompt()` (`persona/identity.js` line 58) but is **never** generated by `buildContext()` (`features/promptContext.js` returns no `socraticLine` in its result). The Advice tier described in ADR-001 (tiered-context-assembly with socratic questioning for advice-seeking patterns like "should I", "what should") has no corresponding implementation. The parameter is dead surface area in the API.

---

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

- **All state in SQLite**: Nearly all state persists to SQLite. Two exceptions exist: `features/discordNative/reactionSystem.js` and `commands/search.js` maintain ephemeral cooldowns in in-memory Maps (accepted trade-off — they are non-critical and losing them on restart is harmless). See §3 drift and §8.
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

- **buildContext()**: Single function in `features/promptContext.js` that produces all context lines for the AI system prompt. Returns an object with context lines (e.g., stateLine, moodLine, relationshipLine, memoryLine, conversationLine, emotionalLine, knowledgeLine) for injection into the system prompt.
- **Context lines**: Individual sections inside the system prompt: stateLine, moodLine, relationshipLine, cultureLine, memoryLine, warmthLine, patienceLine, callbackLine, gratitudeLine, firstOfDayLine, milestoneLine, apologyLine, emotionalLine, conversationLine, knowledgeLine, socraticLine.

### Intelligence Systems

- **Knowledge graph**: The `features/intelligence/knowledgeGraph.js` module that extracts structured entities from conversations using AI. Writes to `memory_entries` with `source='extracted'`.
- **Knowledge base**: The general-purpose knowledge store (`knowledge_base` + `knowledge_fts` tables). Contains seeded Wikipedia topics and user-taught facts via `/learn`. Completely separate from per-user memory.
- **Model router**: Selects between `AI_MODEL` and `AI_MODEL_COMPLEX` based on message length, question detection, and knowledge graph match.
- **Response learner**: Tracks before/after sentiment shifts per response to classify as hit/miss/neutral in `response_learning` table.

### Wisdom Systems

- **Emotional intelligence**: Keyword + sentiment-based emotion detection (happy/sad/anxious/angry/stressed). State stored in `user_emotional_context`. Generates tone directives for the AI system prompt.
- **Story engine**: Topic-triggered story retrieval (war/loss/change/tech/time/power). Hybrid model: stories are AI-generated on first use, stored in `skarn_stories`, referenced on subsequent related topics.
- **Socratic questioning**: Intended feature (ADR-001 Advice tier) — `socraticLine` is accepted as a parameter by `buildSystemPrompt()` but is never populated by `buildContext()`. Not currently implemented in the codebase.

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
