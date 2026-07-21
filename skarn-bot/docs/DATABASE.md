# Skarn Bot — Database Reference

## Overview

All persistent state lives in a single SQLite file at `data/skarn.db` (auto-created). The schema is `db/skarn-schema.sql`, run on every startup via `CREATE TABLE IF NOT EXISTS`. Migration strategy: additive only (new columns added via `ALTER TABLE ... ADD COLUMN` in try/catch blocks in `db/database.js`).

## Table Reference

### Persona & Context

#### `channel_state`
Per-channel mood machine (Dormant / Attentive / Charged / Weathering).

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | TEXT PK | Discord channel ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `current_state` | TEXT DEFAULT 'Attentive' | Current mood state |
| `last_message_at` | INTEGER | Timestamp of last message |
| `last_transition_at` | INTEGER | Timestamp of last state change |
| `recent_message_count` | INTEGER DEFAULT 0 | Message count in current window |
| `count_window_started_at` | INTEGER | Start of current counting window |

State transitions: message arrival → Attentive/Charged/Weathering; `runDecayPass()` → Attentive (30min idle) or Dormant (6h idle). Dormant is **only** set by decay, never by message handler.

#### `guild_mood`
Per-guild Skarn mood (neutral / tired / amused / focused / refreshed).

| Column | Type | Description |
|--------|------|-------------|
| `guild_id` | TEXT PK | Discord guild ID |
| `current_mood` | TEXT DEFAULT 'neutral' | Current mood |
| `last_activity_at` | INTEGER | Timestamp of last activity |
| `last_mood_shift_at` | INTEGER | Timestamp of last mood change |

Evaluated every 10min during decay cycle based on aggregate user_relationship stats.

#### `server_culture`
Per-channel bigram frequency tracking.

| Column | Type | Description |
|--------|------|-------------|
| `guild_id` | TEXT | Discord guild ID |
| `channel_id` | TEXT | Discord channel ID |
| `ngram` | TEXT | The tracked bigram |
| `frequency` | INTEGER DEFAULT 1 | Number of occurrences |
| `first_seen_at` | INTEGER | First occurrence timestamp |
| `last_seen_at` | INTEGER | Most recent occurrence timestamp |
| **PK** | | `(guild_id, channel_id, ngram)` |

### Relationship & Users

#### `user_relationship`
Per-user-per-guild familiarity, tags, banter level.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `guild_id` | TEXT | Discord guild ID |
| `familiarity` | REAL DEFAULT 0 | 0–100 score, gained per interaction, decays -1/day |
| `banter_level` | TEXT DEFAULT 'match' | initiate / match / avoid |
| `interaction_count` | INTEGER DEFAULT 0 | Total AI interactions |
| `last_interaction_at` | INTEGER | Timestamp of last interaction |
| `tags` | TEXT DEFAULT '[]' | JSON array: newcomer, regular, veteran, joker, serious |
| `preferred_tone` | TEXT DEFAULT 'neutral' | User's preferred interaction tone |
| **PK** | | `(user_id, guild_id)` |

Familiarity gains: message=+0.5 (capped +3/day), AI command=+1, mention=+2, etch=+1.

#### `user_preferences`
Per-user-per-guild opt-ins and preferences.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `guild_id` | TEXT | Discord guild ID |
| `proactive_opt_out` | INTEGER DEFAULT 1 | Legacy (inverted) |
| `proactive_opt_in` | INTEGER DEFAULT 0 | 1 = receives proactive messages/check-ins |
| `preferred_tone` | TEXT DEFAULT 'match' | Desired interaction tone |
| `max_response_length` | TEXT DEFAULT 'auto' | Desired response length |
| `allow_nickname` | INTEGER DEFAULT 0 | Allow Skarn to use nickname |
| `nickname` | TEXT | Custom nickname |
| `timezone` | TEXT | User timezone (stored but currently unused) |
| **PK** | | `(user_id, guild_id)` |

All features gated on `proactive_opt_in = 1`. Default is 0 (opted out).

#### `user_profile`
Derived profile from conversation analysis.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `guild_id` | TEXT | Discord guild ID |
| `top_topics` | TEXT DEFAULT '[]' | Most discussed topics (JSON) |
| `peak_hours` | TEXT DEFAULT '[]' | Active hours (JSON) |
| `avg_message_length` | REAL DEFAULT 0 | Average message character length |
| `humor_match` | REAL DEFAULT 0 | Humor alignment score |
| `prefers_long_responses` | INTEGER DEFAULT 0 | Preference flag |
| `sentiment_trend` | REAL DEFAULT 0 | Rolling sentiment direction |
| `last_deep_conversation_at` | INTEGER | Timestamp of last substantive exchange |
| `engagement_score` | REAL DEFAULT 0 | 0–1 engagement metric |
| `last_profile_update_at` | INTEGER NOT NULL | Last profile refresh timestamp |
| **PK** | | `(user_id, guild_id)` |

Updated daily by `profileUpdater.js`.

#### `user_emotional_context`
Per-user emotion state (advisory — drives tone, not gating).

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `guild_id` | TEXT | Discord guild ID |
| `emotional_state` | TEXT DEFAULT 'neutral' | happy / sad / anxious / angry / stressed / neutral |
| `topics_emotional` | TEXT DEFAULT '{}' | Topic-emotion associations (JSON) |
| `last_mood_check` | INTEGER NOT NULL | Timestamp of last emotion detection |
| **PK** | | `(user_id, guild_id)` |

### Memory & Knowledge

#### `memory_entries`
Unified per-user memory, discriminated by `source`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `source` | TEXT NOT NULL | `'etch'` (user-intended), `'extracted'` (auto), `'conversation'` (future) |
| `type` | TEXT NOT NULL | `'fact'`, `'interest'`, `'project'`, `'event'`, `'preference'` |
| `content` | TEXT NOT NULL | The memory content |
| `confidence` | REAL DEFAULT 0.5 | Confidence score (0–1); etched facts = 1.0 |
| `context` | TEXT | Optional context JSON |
| `first_seen_at` | INTEGER NOT NULL | First occurrence timestamp |
| `last_seen_at` | INTEGER NOT NULL | Most recent occurrence timestamp |
| `updated_at` | INTEGER NOT NULL | Last update timestamp |
| **UNIQUE** | | `(user_id, guild_id, type, content)` |

- `source='etch'`: confidence always 1.0, exempt from decay. Set via `/etch` command.
- `source='extracted'`: confidence starts at 0.5, decays 0.95× after 30 days, pruned below 0.2.
- `source='conversation'`: reserved for future conversation-derived memory.

#### `knowledge_base`
Global knowledge store (all users, all guilds). Seeded Wikipedia topics + user-taught facts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `topic` | TEXT NOT NULL UNIQUE | Knowledge topic |
| `summary` | TEXT NOT NULL | Knowledge summary |
| `source` | TEXT | `'wikipedia'`, `'user_taught'`, etc. |
| `confidence` | REAL DEFAULT 0.5 | Confidence score |
| `tags` | TEXT DEFAULT '[]' | Categorization tags |
| `created_at` | INTEGER NOT NULL | Creation timestamp |
| `updated_at` | INTEGER NOT NULL | Update timestamp |

FTS5 index: `knowledge_fts(topic, summary)` for full-text search.

#### `skarn_stories`
AI-generated stories from Skarn's past, keyed by topic.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `topic` | TEXT NOT NULL | Story topic (war, loss, change, tech, time, power) |
| `story_text` | TEXT NOT NULL | The story content |
| `source` | TEXT | Origin of the story |
| `used_count` | INTEGER DEFAULT 0 | Number of times referenced |
| `created_at` | INTEGER NOT NULL | Creation timestamp |
| `last_used_at` | INTEGER | Most recent reference timestamp |

Triggered by keywords in user messages. Stories are AI-generated on first use, stored for later reference.

### Conversation History

#### `conversation_threads`
Threaded conversation groupings.

| Column | Type | Description |
|--------|------|-------------|
| `thread_id` | TEXT PK | Unique thread identifier |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `channel_id` | TEXT NOT NULL | Discord channel ID |
| `thread_type` | TEXT NOT NULL | `'channel'`, `'consult'`, `'dm'`, `'interjection'` |
| `topic_summary` | TEXT | AI-generated summary |
| `topic_tags` | TEXT DEFAULT '[]' | Topic tags (JSON) |
| `sentiment_start` | REAL | Sentiment at thread start |
| `sentiment_end` | REAL | Sentiment at thread end |
| `message_count` | INTEGER DEFAULT 0 | Messages in thread |
| `started_at` | INTEGER NOT NULL | Thread creation |
| `last_active_at` | INTEGER NOT NULL | Most recent activity |
| `archived_at` | INTEGER | Archive timestamp (NULL = active) |

Threads auto-archive after 30 min of inactivity (24h for DMs).

#### `conversation_messages`
Individual messages within threads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Message ID |
| `thread_id` | TEXT NOT NULL FK | Parent thread |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `channel_id` | TEXT NOT NULL | Discord channel ID |
| `role` | TEXT NOT NULL | `'user'` or `'assistant'` |
| `content` | TEXT NOT NULL | Message content |
| `sentiment` | REAL | Sentiment score |
| `topics` | TEXT DEFAULT '[]' | Extracted topics (JSON) |
| `is_question` | INTEGER DEFAULT 0 | Whether message is a question |
| `tokens_est` | INTEGER | Estimated token count |
| `created_at` | INTEGER NOT NULL | Message timestamp |

FTS5 index: `conversation_fts(content, thread_id, user_id, guild_id, role)`.
Messages older than 90 days are pruned daily.

#### `conversation_summaries`
Periodic summaries of completed conversation threads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Summary ID |
| `thread_id` | TEXT NOT NULL FK | Parent thread |
| `summary_text` | TEXT NOT NULL | AI-generated summary |
| `covers_from` | INTEGER NOT NULL | Start of covered period |
| `covers_to` | INTEGER NOT NULL | End of covered period |
| `message_count` | INTEGER NOT NULL | Number of messages summarized |
| `created_at` | INTEGER NOT NULL | Summary creation timestamp |

### Response Learning

#### `response_learning`
Tracks before/after sentiment for AI responses.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `before_sentiment` | REAL NOT NULL | User message sentiment |
| `after_sentiment` | REAL NOT NULL | AI response sentiment |
| `diff` | REAL NOT NULL | Sentiment change |
| `classification` | TEXT NOT NULL | `'hit'`, `'miss'`, `'neutral'` |
| `created_at` | INTEGER NOT NULL | Timestamp |

### Rate Limiting & Cooldowns

#### `rate_limits`
Per-user rolling window for AI calls.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `timestamp` | INTEGER NOT NULL | Call timestamp |

10 calls per 10-minute rolling window.

#### `mention_cooldowns`
Per-user-per-channel @mention throttle.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `channel_id` | TEXT | Discord channel ID |
| `expires_at` | INTEGER NOT NULL | Cooldown expiry |
| **PK** | | `(user_id, channel_id)` |

1-second TTL.

#### `interjection_cooldowns`
Per-channel interjection throttle.

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | TEXT PK | Discord channel ID |
| `expires_at` | INTEGER NOT NULL | Cooldown expiry |

5-minute TTL.

#### `active_listen_cooldowns`
Per-channel active listening throttle.

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | TEXT PK | Discord channel ID |
| `expires_at` | INTEGER NOT NULL | Cooldown expiry |

5-minute TTL.

#### `ai_usage`
Hourly per-user AI call counter.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT NOT NULL | Discord user ID |
| `stat_type` | TEXT NOT NULL | Usage category |
| `count` | INTEGER DEFAULT 0 | Call count |
| **PK** | | `(user_id, stat_type)` |

50 calls per hour ceiling.

#### `cooldowns`
Generic key-value cooldowns (XP, generic throttles).

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | Cooldown key |
| `expires_at` | INTEGER NOT NULL | Expiry timestamp |

### Ephemeral State

#### `sentiment_buffers`
Per-channel rolling window of last 5 message texts.

| Column | Type | Description |
|--------|------|-------------|
| `channel_id` | TEXT PK | Discord channel ID |
| `messages` | TEXT NOT NULL DEFAULT '[]' | JSON array of recent message texts |
| `updated_at` | INTEGER NOT NULL | Last update timestamp |

Used for Weathering state detection. Pruned after 1 hour of inactivity.

#### `app_flags`
Generic key-value flags with optional TTL.

| Column | Type | Description |
|--------|------|-------------|
| `flag_key` | TEXT PK | Flag name |
| `flag_value` | TEXT | Flag value |
| `created_at` | INTEGER NOT NULL | Creation timestamp |
| `expires_at` | INTEGER | TTL expiry (NULL = no expiry) |

Used for: first-of-day tracking, apology flags, warmth sentiment buffers, milestone flags, strike tracking, follow-ups.

#### `app_state`
Persistent bot-level key-value (no expiry).

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT PK | State key |
| `value` | TEXT NOT NULL | State value |
| `updated_at` | INTEGER NOT NULL | Last update |

### In-Session Humor State

#### `banter_chains`
Persistent banter chain tracking (count is in-memory only).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `channel_id` | TEXT NOT NULL | Discord channel ID |
| `chain_data` | TEXT NOT NULL | JSON data (last_active timestamp) |
| `started_at` | INTEGER NOT NULL | Chain start |
| `last_active_at` | INTEGER NOT NULL | Most recent activity |

Note: the chain **count** is stored only in the in-memory Map in `comedyTiming.js` and resets on bot restart. SQLite tracks the last-active timestamp for pruning.

#### `callbacks`
Persistent in-session callback entries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `channel_id` | TEXT NOT NULL | Discord channel ID |
| `user_id` | TEXT | Discord user ID (nullable) |
| `message` | TEXT NOT NULL | Sampled message text |
| `created_at` | INTEGER NOT NULL | Creation timestamp |

Pruned after 1 hour.

### Guild Configuration

#### `guild_config`
Per-guild key-value settings.

| Column | Type | Description |
|--------|------|-------------|
| `guild_id` | TEXT | Discord guild ID |
| `key` | TEXT | Setting name |
| `value` | TEXT | JSON or string value |
| **PK** | | `(guild_id, key)` |

Known keys: `aiChannels` (array of channel IDs), `ignoredUsers` (array), `welcomeChannel`, `autoRole`, `logChannel`, `logMessages`, and any admin-configured settings.

### Game Systems

#### `realm_characters`
Player characters in the Realm of Skarn RPG.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | TEXT | Discord user ID |
| `guild_id` | TEXT | Discord guild ID |
| `name` | TEXT | Character name |
| `race` | TEXT | Character race |
| `class` | TEXT | Character class |
| `backstory` | TEXT | Character backstory |
| `level` | INTEGER DEFAULT 1 | Character level |
| `xp` | INTEGER DEFAULT 0 | Experience points |
| `hp_current` / `hp_max` | INTEGER | Hit points |
| `strength`–`luck` | INTEGER | 7 D&D-style attributes |
| `gold` | INTEGER DEFAULT 50 | Currency |
| `current_location` | TEXT DEFAULT 'abyssal_gate' | In-game location |
| `created_at` / `updated_at` | INTEGER | Timestamps |
| **PK** | | `(user_id, guild_id)` |

Additional realm tables: `realm_inventory`, `realm_quests`, `realm_npc_memory`, `realm_discovered_locations`, `realm_kill_log`, `realm_world_state`.

#### `realm_inventory`
Per-character inventory items.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `item_id` | TEXT NOT NULL | Unique item identifier |
| `name` | TEXT NOT NULL | Item display name (e.g. "Shadow Fang") |
| `type` | TEXT NOT NULL | `weapon`, `armor`, `consumable` |
| `description` | TEXT | Item description |
| `rarity` | TEXT DEFAULT 'common' | `common`, `uncommon`, `rare`, `epic`, `legendary` |
| `stats` | TEXT | JSON: `{weaponBonus, defense, healAmount}` |
| `value` | INTEGER DEFAULT 0 | Gold value |
| `equipped` | INTEGER DEFAULT 0 | Boolean: currently equipped |
| `created_at` | INTEGER NOT NULL | Acquisition timestamp |

Index: `idx_realm_inventory_user(user_id, guild_id)`.

#### `realm_quests`
Active and completed quests per character.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `quest_id` | TEXT NOT NULL | Unique quest identifier |
| `title` | TEXT NOT NULL | Quest title |
| `description` | TEXT | Quest description |
| `giver_npc` | TEXT | NPC who gave the quest |
| `objectives` | TEXT NOT NULL | JSON array: `[{type, target, count, current}]` |
| `rewards` | TEXT | JSON reward data |
| `status` | TEXT DEFAULT 'active' | `active`, `completed` |
| `chain_next` | TEXT | Next quest in chain (optional) |
| `created_at` / `updated_at` | INTEGER | Timestamps |

Max 3 active quests per character. Quest types: `kill`, `fetch`, `explore`, `escort`, `puzzle`, `boss`.
Index: `idx_realm_quests_user(user_id, guild_id)`.

#### `realm_npc_memory`
Persistent per-NPC interaction history for relationship tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `npc_id` | TEXT NOT NULL | NPC identifier (e.g. `gatekeeper`, `merchant`) |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `interaction_type` | TEXT NOT NULL | `dialogue`, `trade`, `combat` |
| `summary` | TEXT NOT NULL | Interaction summary |
| `sentiment` | INTEGER DEFAULT 0 | -3 (hostile) to +2 (friendly) |
| `created_at` | INTEGER NOT NULL | Interaction timestamp |

NPC relationship derived from average sentiment: ≥2 = friendly, ≤-2 = hostile, else neutral.
Index: `idx_realm_npc_memory_user(npc_id, user_id, guild_id)`.

#### `realm_discovered_locations`
Locations the player has visited.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `location_id` | TEXT NOT NULL | Location identifier (e.g. `shadow_market`) |
| `discovered_at` | INTEGER NOT NULL | Discovery timestamp |
| **UNIQUE** | | `(user_id, guild_id, location_id)` |

8 discoverable locations: abyssal_gate, shadow_market, cursed_library, whispering_woods, ruined_temple, obsidian_mines, bone_arena, dragon_maw.

#### `realm_kill_log`
Combat kill records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK AUTO | Row ID |
| `user_id` | TEXT NOT NULL | Discord user ID |
| `guild_id` | TEXT NOT NULL | Discord guild ID |
| `enemy_name` | TEXT NOT NULL | Enemy display name |
| `enemy_level` | INTEGER NOT NULL | Enemy level |
| `location` | TEXT NOT NULL | Location where killed |
| `xp_earned` | INTEGER NOT NULL | XP awarded |
| `gold_earned` | INTEGER NOT NULL | Gold awarded |
| `killed_at` | INTEGER NOT NULL | Kill timestamp |

Index: `idx_realm_kill_log_user(user_id, guild_id)`.

#### `realm_world_state`
Per-guild key-value state for Realm-level persistence.

| Column | Type | Description |
|--------|------|-------------|
| `key` | TEXT | State key (e.g. `daily_ai_calls`) |
| `guild_id` | TEXT | Discord guild ID |
| `value` | TEXT NOT NULL | JSON or string value |
| `updated_at` | INTEGER NOT NULL | Last update timestamp |
| **PK** | | `(key, guild_id)` |

Used for: daily AI call counters, world events, realm-level configuration.

### Utility Tables

| Table | Purpose |
|-------|---------|
| `friends` | Cross-server friend codes (migrated from JSON) |
| `reminders` | User reminder system |
| `giveaways` | Server giveaway system |
| `reaction_roles` | Reaction-role message bindings |
| `user_levels` | Per-guild XP/leveling |
| `follow_ups` | AI follow-up detection and dispatch |
| `relationship_milestones` | Notable relationship achievements |
| `daily_news` | Fetched news articles for news digest feature |
| `attention_state` | Per-user-per-guild-per-channel attention tracking for AI auto-respond |

## Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_memory_user` | `memory_entries` | `(user_id, guild_id)` | User memory lookups |
| `idx_memory_decay` | `memory_entries` | `(last_seen_at, confidence)` | Decay pass efficiency |
| `idx_rate_limits_user` | `rate_limits` | `(user_id, timestamp)` | Rate limit queries |
| `idx_conv_msg_thread` | `conversation_messages` | `(thread_id, created_at)` | Thread message retrieval |
| `idx_conv_msg_user` | `conversation_messages` | `(user_id, guild_id, created_at)` | User conversation history |
| `idx_conv_thread_user` | `conversation_threads` | `(user_id, guild_id, archived_at)` | Active thread lookups |
| `idx_conv_summary_thread` | `conversation_summaries` | `(thread_id)` | Summary retrieval |
| `idx_user_relationship_guild` | `user_relationship` | `(guild_id, familiarity)` | Guild aggregate queries |
| `idx_followups_user` | `follow_ups` | `(user_id, status, due_after)` | Follow-up dispatch |
| `idx_milestones_user` | `relationship_milestones` | `(user_id, guild_id)` | Milestone lookups |
| `idx_response_learning_user` | `response_learning` | `(user_id, guild_id, created_at)` | Learning queries |
| `idx_skarn_stories_topic` | `skarn_stories` | `(topic)` | Story lookup by topic |
| `idx_banter_user` | `banter_chains` | `(user_id, guild_id, channel_id)` | Chain pruning |
| `idx_callbacks_cleanup` | `callbacks` | `(channel_id, created_at)` | Callback pruning |
| `idx_app_flags_expire` | `app_flags` | `(expires_at)` | Flag cleanup |
| `idx_daily_news_fetched` | `daily_news` | `(fetched_at)` | News retrieval |
| `idx_daily_news_category` | `daily_news` | `(category)` | Category filtering |
| `idx_realm_inventory_user` | `realm_inventory` | `(user_id, guild_id)` | Character inventory lookups |
| `idx_realm_quests_user` | `realm_quests` | `(user_id, guild_id)` | Character quest queries |
| `idx_realm_npc_memory_user` | `realm_npc_memory` | `(npc_id, user_id, guild_id)` | NPC memory lookups |
| `idx_realm_kill_log_user` | `realm_kill_log` | `(user_id, guild_id)` | Kill stats queries |

## Maintenance Jobs

| Job | Interval | Action |
|-----|----------|--------|
| State decay | 10min | Dormant/Attentive transitions, relationship decay, memory decay, cooldown cleanup |
| Daily maintenance | 24h | Profile updates, thread summarization, message pruning (90d) |
| News fetch | 1h | Fetch articles into `daily_news` |
| Daily digest | 6pm | Post news digest to configured channels |
| Proactive scheduler | 5min | Check follow-ups, absence detection |

## Scoping Rule

Every row belongs to exactly one scope, identifiable from the PK:
- **`(user_id, guild_id)`** — per-user per-server (most tables)
- **`channel_id`** — per-channel (state, buffers, cooldowns)
- **`guild_id`** — per-server (mood, config)
- **None** — global (knowledge_base, friends, app_state)
