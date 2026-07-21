# Skarn Persona Deepening — Combined Spec

> **Order:** Wire socratic first (trivial), then lore (moderate), then growth (moderate), then follow-ups (small).

### Database — No new tables

All four features reuse existing storage:

- **Socratic**: No storage needed
- **Lore**: `skarn_stories` table with `source = 'canonical'` discriminator (existing table, new source value)
- **Growth**: `user_profile` table with two new columns (`weekly_sentiment_history`, `weekly_topic_history`) added via `ALTER TABLE ADD COLUMN` try/catch
- **Follow-ups**: Existing `follow_ups` table, unchanged

## [S1] Socratic Questioning (3 lines)

### Problem
`features/wisdom/socraticEngine.js` exists with a working `getSocraticQuestion()` function that detects advice-seeking patterns ("should I", "what should", "need advice") and returns a questioning directive. But it's **never called** — `promptContext.js` doesn't import it, `buildSystemPrompt()` receives `socraticLine = ''` every time. Dead code.

### Solution
Three lines in `features/promptContext.js`:

1. Add import: `const { getSocraticQuestion } = require('./wisdom/socraticEngine');`
2. After the full tier block, add: `const socraticLine = getSocraticQuestion(userContent);`
3. Add `socraticLine: socraticLine` to the returned object.

No other changes. The engine, triggers, and directive text are already written.

## [S2] Canonical Lore System

### Problem
The existing `storyEngine.js` keyword-triggers stories about war/loss/change/tech/time/power. But stories are AI-generated on first use and stored — they have no canonical basis. Skarn's identity promises "10,000 years of wisdom" but his memories are procedurally generated, giving him no consistent backstory.

### Database
The existing `skarn_stories` table is reused:

```sql
CREATE TABLE IF NOT EXISTS skarn_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  story_text TEXT NOT NULL,
  source TEXT,               -- 'canonical' for curated lore, NULL/undefined for AI-generated
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
```

~20 curated stories seeded on startup via `addStory(topic, text)` with an extra `source = 'canonical'` parameter. Seed data lives in `db/skarn-stories-seed.js` (a JS module exporting an array — avoids committing a slur-like file to the public repo). Covers:
- **Origin**: Orphan demon, survival, being noticed
- **War years**: Specific battles, enemies, losses, comrades
- **Warmaster**: Promotion, commanding legions, the weight of the title
- **Retirement**: The transition, learning to care, joining Discord

### Integration with existing story engine
In `features/wisdom/storyEngine.js` `getExistingStory()`, add a `source = 'canonical'` filter: query canonical stories first, fall back to AI-generated (`source IS NULL`). The existing story injection path in `consult.handler.js` and `mentionRouter.js` handles the rest — no new context line needed. Lore is injected as `[Skarn recalls: "..."]` via the same mechanism already in place.

### Files changed
| File | Change |
|------|--------|
| `db/skarn-stories-seed.js` | **New** — 20 curated lore stories as a JS module |
| `db/database.js` | Add `seedSkarnLore()` helper; extend `addStory()` to accept `source` param |
| `features/wisdom/storyEngine.js` | Prefer `source = 'canonical'` stories in `getExistingStory()` |
| `bot.js` | Call `seedSkarnLore()` on startup |

### Non-goals
- No `/lore` command (stories are ambient, not on-demand)
- No AI generation of lore (all curated, canonical)
- No per-user lore tracking (same stories for everyone)

## [S3] Growth Arc Tracking

### Problem
Skarn's Identity says: "Watching humans build, fail, laugh, cry, try again — it got to you. You're still dry. Still witty. But you care now." But there's no system that tracks how a *user* changes over time. Skarn meets you the same way every session regardless of whether you're happier, sadder, more confident, or completely different from last month.

### Solution
A new module `features/wisdom/growthTracker.js` that tracks per-user trajectory over weekly windows.

**Storage**: Extends `user_profile` with two new columns (added via `ALTER TABLE ADD COLUMN` try/catch in `database.js`):
- `weekly_sentiment_history TEXT DEFAULT '[]'` — JSON array of last 4 weekly averages
- `weekly_topic_history TEXT DEFAULT '[]'` — JSON array of last 4 topic profiles

**What's computed weekly** (from existing data):
- Sentiment trend over 1-week windows (from existing `response_learning` and `warmthManager` data)
- Topic evolution (from existing `user_profile.top_topics`)
- Interaction depth (short messages vs long messages ratio)
- Confidence indicators (questions asked vs statements made ratio)

**Detection** (evaluated weekly on the decay cycle):
- **Swing**: Sentiment shifted >0.3 between windows → "You seem different lately"
- **Growth**: User asks fewer questions, makes more statements → "You're figuring things out"
- **Deepening**: Messages getting longer, more personal → "You're opening up more"
- **Fatigue**: Messages getting shorter, more negative → "Rough stretch?"

**Prompt line**: Generated by `getGrowthLine(userId, guildId)` and injected as a new context line `growthLine` in `promptContext.js`. Only fires when notable change is detected (maybe 1 in 20 interactions). Subtle — one line, not a paragraph.

```
[growth detected] Line: "You seem more settled than when we first talked. Good."
[no growth] Line: "" (empty, omitted)
```

### Files changed
| File | Change |
|------|--------|
| `features/wisdom/growthTracker.js` | **New** — trajectory analysis, growth line generation |
| `features/promptContext.js` | Add `growthLine` import and injection |
| `persona/identity.js` | Add `growthLine` to `buildSystemPrompt()` signature |
| `features/channelState/stateDecay.js` | Add weekly evaluation call |

### Non-goals
- No permanent history beyond 4 weeks (rolling window)
- No per-user dashboard or stats display
- No AI analysis (all heuristic-based)

## [S4] Proactive Follow-ups

### Problem
The existing `features/intelligence/followUpEngine.js` detects time-bound statements ("I have a test next week", "I'll know by Friday") and unanswered questions. It stores them in `follow_ups` table and dispatches reminders. But it's only called from `consult.handler.js` and never feeds back into the conversation context. Skarn doesn't naturally ask "How did that test go?" unless the user explicitly reminds him.

### Solution
Feed pending follow-ups into the prompt context as a new `followUpLine`:

In `promptContext.js`, query the `follow_ups` table for pending items for this user. If any exist (with `due_after` passed but not yet sent), inject:

```
You were curious about something they said earlier: [topic]. Ask naturally if it fits.
```

The existing follow-up engine handles dispatch (reminders via DMs). This adds a gentler, in-conversation path — Skarn remembers mid-chat instead of sending a separate reminder.

### Files changed
| File | Change |
|------|--------|
| `features/promptContext.js` | Query pending follow-ups, inject `followUpLine` |
| `persona/identity.js` | Add `followUpLine` to `buildSystemPrompt()` signature |

### Non-goals
- No new follow-up detection logic (uses existing `followUpEngine.js`)
- No DM reminders removed (both paths coexist)

## [S5] Integration Summary

### promptContext.js — new lines

The `buildContext()` return object adds 3 new lines (lore uses the existing story injection path, no new context line needed):

```js
return {
  // ... existing 15 lines ...
  socraticLine: socraticLine,     // advice detection
  growthLine: growthLine,         // user trajectory
  followUpLine: followUpLine,     // pending follow-ups
  safetyLine: safetyLine,         // existing from slur filter
};
```

### identity.js — buildSystemPrompt() signature

Adds 3 new optional params: `socraticLine`, `growthLine`, `followUpLine`.

### Implementation order

| Phase | Feature | Effort | Impact |
|-------|---------|--------|--------|
| 1 | Socratic questioning | ~2 min, 3 lines | Immediate — Skarn stops giving advice, starts asking questions |
| 2 | Canonical lore | ~1 hr, 4 files | Deep — Skarn has consistent memories (uses existing story engine path) |
| 3 | Growth tracking | ~1 hr, 3 files | Subtle — Skarn notices you changed |
| 4 | Proactive follow-ups | ~15 min, 2 files | Natural — Skarn remembers mid-conversation |

### Verification

**Socratic**: User says "should I quit my job" → Skarn asks "What's making you consider leaving?" instead of "Here's what I think."

**Lore**: User mentions "war" → Skarn references a specific battle from the lore table, not a procedurally generated story.

**Growth**: Same user talks to Skarn weekly for a month → Skarn eventually says "You seem different than when we first talked."

**Follow-ups**: User says "I have a test Friday" → next conversation, Skarn naturally asks "How did that test go?"
