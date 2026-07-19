# Skarn Bot — Domain Glossary

## Persona

- **Skarn**: The Warmaster of the Abyss, a 10,000-year-old retired demon who serves Anomaly Alpha as a Discord bot.
- **buildSystemPrompt()**: Single function in `persona/identity.js` that assembles core identity + role line + all context lines into a unified system prompt for every AI call.
- **Role line**: Command-specific instruction from `persona/roles.js`. Every AI command has exactly one role line. No command inlines its own role string.

## Memory Systems

- **memory_entries**: The unified persistent memory table. Replaces the previous `user_memory` + `knowledge_graph` separation. All user-specific memory lives here with a `source` discriminator.
- **source='etch'**: User-intended facts via `/etch` command. Confidence is always 1.0. **Exempt from confidence decay** — these are permanent until the user runs `/forget`.
- **source='extracted'**: Entities auto-extracted from conversations by the knowledge graph. Confidence starts at 0.5 and can increase with reinforcement or decay with inactivity. Subject to decay (0.95× after 30 days, pruned below 0.2).
- **source='conversation'**: Memory derived from conversation history summaries (future use). Not yet implemented.
- **Conversation graph**: The threaded conversation history stored in `conversation_threads` + `conversation_messages` + `conversation_summaries`. This is distinct from memory_entries — it stores raw messages, not extracted knowledge.

## State Persistence

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

## Context Assembly

- **buildContext()**: Single function in `features/promptContext.js` that produces all context lines for the AI system prompt. Merges the previous `collectContext()` (directive lines) and `assembleContext()` (conversation content) into one unified output.
- **Context lines**: Individual sections inside the system prompt: stateLine, moodLine, relationshipLine, cultureLine, memoryLine, warmthLine, patienceLine, callbackLine, gratitudeLine, firstOfDayLine, milestoneLine, apologyLine, emotionalLine, conversationLine, knowledgeLine, socraticLine.

## Intelligence Systems

- **Knowledge graph**: The `features/intelligence/knowledgeGraph.js` module that extracts structured entities from conversations using AI. Writes to `memory_entries` with `source='extracted'`.
- **Knowledge base**: The general-purpose knowledge store (`knowledge_base` + `knowledge_fts` tables). Contains seeded Wikipedia topics and user-taught facts via `/learn`. Completely separate from per-user memory.
- **Model router**: Selects between `AI_MODEL` and `AI_MODEL_COMPLEX` based on message length, question detection, and knowledge graph match.
- **Response learner**: Tracks before/after sentiment shifts per response to classify as hit/miss/neutral in `response_learning` table.

## Wisdom Systems

- **Emotional intelligence**: Keyword + sentiment-based emotion detection (happy/sad/anxious/angry/stressed). State stored in `user_emotional_context`. Generates tone directives for the AI system prompt.
- **Story engine**: Topic-triggered story retrieval (war/loss/change/tech/time/power). Hybrid model: stories are AI-generated on first use, stored in `skarn_stories`, referenced on subsequent related topics.
- **Socratic questioning**: Keyword-triggered (`should I`, `what should`, etc.) module that adds a questioning directive to the system prompt for advice-seeking users.

## Relationship & Server Awareness

- **Familiarity**: 0-100 score in `user_relationship`. Gained per interaction type (message=0.5, AI=1, mention=2, etch=1). Capped at +3/day for message-based gains. Decays 1/day of inactivity.
- **Channel state**: Per-channel mood machine (Dormant/Attentive/Charged/Weathering). Dormant is only ever set by the decay pass, never by incoming messages.
- **Server culture**: Bigram-based channel language tracking. N-grams stored in `server_culture` table with frequency counters.

## User Preferences

- **proactive_opt_in**: The column (DEFAULT 0) controlling whether users receive proactive messages (check-ins, follow-ups). 0 = opted out by default (no proactive messages), 1 = opted in. Renamed from `proactive_opt_out` which had inverted semantics.
- **Mention cooldown**: 1-second cooldown per user per channel for @mentions. Silently ignores rapid mentions.
- **Proactive cap**: 1 proactive message per user per day maximum.

## Command Activation

- **Activation phrase**: A keyword that triggers a command when typed in chat (e.g., `skarn weather`, `skarn joke`). Every command has an optional activation phrase registered in the activation registry, providing a text-based alternative to slash commands.
- **Activation registry**: Central module (`features/activation/activationRegistry.js`) that maps keyword phrases to commands. Built at startup by scanning each command file's `activation` export. Two routing types: `'command'` (runs the slash command handler) and `'ai'` (routes to the AI mention handler with an injected directive).
- **Fast-path skippers**: The four built-in keyword handlers (`skarn opt in`, `skarn opt out`, `skarn chat mode`, `skarn status`) that run inline before the activation registry and return immediately without AI.
- **Activation phrase wins**: A registered activation phrase always takes priority over the @mention AI handler and AI channel auto-respond for messages it matches.
