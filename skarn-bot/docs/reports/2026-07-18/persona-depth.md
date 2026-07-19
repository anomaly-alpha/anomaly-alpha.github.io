---
feature: persona-depth
status: delivered
specs:
  - skarn-bot/docs/specs/2026-07-18-persona-depth.md
plans:
  - skarn-bot/docs/plans/2026-07-18-persona-depth.md
commits: (uncommitted)
---

# Skarn Persona Depth — Final Report

## What Was Built

Four new subsystems that give Skarn deeper conversational intelligence: relationship tracking (familiarity, tags, banter level per user), per-guild mood states, an AI-driven interjection engine that replaces the old static keyword triggers, and server culture memory via n-gram analysis. A new `promptContext.js` consolidates all context fetching so handlers are cleaner.

## Architecture

```
skarn-bot/
├── features/
│   ├── promptContext.js               ← Single context collector for all handlers
│   ├── relationship/
│   │   └── relationshipTracker.js     ← Familiarity, tags, decay
│   ├── mood/
│   │   └── moodManager.js             ← Per-guild mood evaluation
│   ├── presence/
│   │   └── interjectionEngine.js      ← AI-driven proactive replies
│   └── culture/
│       └── cultureTracker.js          ← N-gram frequency tracking
├── commands/
│   └── relation.js                    ← /relation command
├── db/
│   ├── skarn-schema.sql              ← +3 new tables
│   └── database.js                   ← +6 new helper functions
└── features/
    ├── channelState/stateDecay.js     ← +decay + flush calls
    ├── consult/consult.handler.js     ← Uses promptContext
    ├── mentionRouter/mentionRouter.js ← Uses promptContext
    └── discordNative/postProcess.js   ← +maybeBurst export
```

### Design Decisions

- **Mood derived from relationships**: Instead of adding separate per-guild stats tracking, mood is evaluated from aggregate `user_relationship` data. This keeps the schema lean.
- **All interjections are AI-generated**: The old 15-keyword static pool is replaced. AI generates every interjection, with the keyword pool as fallback only (on rate limit or AI failure).
- **N-grams only, not raw text**: Respects the existing design decision to never persist message content. Only bigram frequencies are stored.
- **`promptContext.js` as single entry point**: Reduces handler imports from 11+ to 4, making future context additions trivial.

## Usage

**No new visible commands** except `/relation` — ephemeral reply showing how Skarn sees the user (familiarity/100, tags, banter level).

**Passive changes:**
- Relationship tracking happens on every message (+0.5) and AI command (+1). Familiarity decays -1/day.
- Tags auto-assign: newcomer, regular, veteran, joker, serious
- Mood shifts per guild based on aggregate interaction patterns (tired, amused, focused, refreshed, neutral)
- Skarn occasionally interjects in channels (5% base, up to 10% for regulars with banter, AI-generated)
- N-grams accumulate per channel, flushed to SQLite every 10 minutes

## Verification

All 6 new modules load correctly. DB helper functions verified. Integration points confirmed:
- `bot.js`: imports relationship tracker, culture tracker, interjection engine — all wired in `messageCreate`
- `promptContext.js`: imports all 4 new modules + existing channelState and db
- `stateDecay.js`: wired with runDecay() and flushCulture()
- `consult.handler.js` and `mentionRouter.js`: refactored to use `collectContext()` from `promptContext.js`
- `postProcess.js`: exports `maybeBurst` for multi-message delays

## Source Materials

| File | Role |
|------|------|
| `docs/specs/2026-07-18-persona-depth.md` | Full spec across 4 phases |
| `docs/plans/2026-07-18-persona-depth.md` | Implementation plan (7 tasks, grilled) |
