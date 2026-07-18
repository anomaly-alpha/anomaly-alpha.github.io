---
feature: skarn-persona-system
status: delivered
specs:
  - skarn-bot/docs/specs/2026-07-18-skarn-persona-design.md
plans:
  - skarn-bot/docs/plans/2026-07-18-skarn-persona-implementation.md
branch: main
commits: bd0706d..04e76bc
---

# Skarn Persona System — Final Report

## What Was Built

Skarn now has a consistent persona — the Warmaster of the Abyss, a 10,000-year-old retired demon who serves Anomaly Alpha as a Discord bot. Every AI interaction routes through a single `buildSystemPrompt()` function that assembles the core identity, a command-specific role line, channel mood context, and user memory into a unified system prompt.

The system includes persistent user memory (SQLite-backed, per-guild), channel mood awareness (4 states: Dormant, Attentive, Charged, Weathering), rate limiting (10 AI calls per 10 minutes per user), and 4 new commands (`/etch`, `/forget`, `/consult`, `/vein`). All 19 existing AI commands were migrated to use the persona system with shared client, rate limiting, and in-persona error handling.

## Architecture

```
skarn-bot/
├── persona/
│   ├── identity.js          ← SKARN_CORE_IDENTITY + buildSystemPrompt()
│   └── roles.js             ← Role lines and token budgets for all 21 commands
├── db/
│   ├── skarn-schema.sql     ← user_memory + channel_state tables
│   └── database.js          ← SQLite helpers
├── ai/
│   └── client.js            ← Shared OpenAI singleton
├── lib/
│   └── rateLimit.js         ← Per-user token bucket (10 calls/10min)
├── features/
│   ├── channelState/
│   │   ├── sentimentBuffer.js  ← Ephemeral in-memory rolling buffer
│   │   ├── stateTracker.js     ← State machine (Charged/Weathering detection)
│   │   └── stateDecay.js       ← Charged→Attentive (30min), Dormant (6h)
│   ├── etch/                ← /etch command + handler
│   ├── forget/              ← /forget command + handler
│   ├── consult/             ← /consult command + handler
│   ├── vein/                ← /vein command + handler
│   └── mentionRouter/       ← @mention detection + 15s cooldown
└── commands/                ← All commands (existing + new wrappers)
```

### Design Decisions

**Single prompt assembly:** All 21 AI commands use `buildSystemPrompt()` — no exceptions. This prevents tone drift across commands. Commands that don't need state or memory pass empty strings.

**Per-channel cooldown for @mentions:** Users legitimately talk in multiple channels. A global cooldown would be overly restrictive.

**Ephemeral sentiment buffer:** Message text is not persisted to SQLite. The buffer is lost on restart, which is intentional — Weathering re-derives from live conversation within minutes.

**Dormant only via decay pass:** The message handler never sets Dormant — arriving traffic can never itself be "Dormant." This prevents the message that ends a silence from incorrectly flipping the state.

**Commands stay in commands/:** New commands use thin wrappers in `commands/` that re-export from `features/`. This avoids changing the existing command loading mechanism in `bot.js`.

## Usage

### New Commands

| Command | Description |
|---------|-------------|
| `/etch <fact>` | Tell Skarn something to remember (max 300 chars) |
| `/forget` | Delete all remembered facts about you |
| `/consult <message>` | Speak with Skarn (in-character) |
| `/vein [channel] [timeframe] [focus]` | Summarize channel conversation |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL` | `gpt-3.5-turbo` | AI model to use (can upgrade to `gpt-4o-mini` or `gpt-4o`) |

### Deprecated Commands

- `/ask` → Use `/consult` instead
- `/summarize` → Use `/vein` instead

## Verification

All modules load correctly. Database operations (add/get/delete memory, get/update channel state) pass. Sentiment analysis produces correct comparative scores. `buildSystemPrompt()` correctly assembles identity + role + state + memory.

Manual testing checklist (from spec):
- `/etch` → `/forget` → `/consult` memory flow
- Persona voice across commands (no "As an AI" phrasing)
- Charged state triggers after 8+ messages in 5 minutes
- Weathering state triggers on negative sentiment (comparative score)
- @mention cooldown (15s per user per channel)
- `/vein` permission check (refuses inaccessible channels)
- Rate limiter (11th call blocked within 10 minutes)

## Journey Log

- [bug fix] v1 state tracker had a double `updateChannelState` call that silently undid the Charged window reset — fixed by computing count once and writing once per call
- [bug fix] v1 computed Dormant on message arrival, causing the message ending a silence to flip to Dormant instead of Attentive — fixed by removing Dormant from message handler entirely
- [grilling] Decided all 19 migrated commands get both stateLine and memoryLine for full persona consistency
- [grilling] Skipped deprecated command cleanup step — `rest.put()` already replaces all commands on deploy

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `skarn-bot/docs/specs/2026-07-18-skarn-persona-design.md` | Design spec v2 | Canonical, grilled |
| `skarn-bot/docs/plans/2026-07-18-skarn-persona-implementation.md` | Implementation plan v3 | Canonical, grilled |
