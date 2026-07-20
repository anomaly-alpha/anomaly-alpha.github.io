# Skarn Persona Depth — Full Personality System

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/persona-depth.md)

> Phase 1: Relationship | Phase 2: Mood | Phase 3: Presence | Phase 4: Culture

## [S1] Problem

The Discord-native persona upgrade (v1) handles *how* Skarn says things (lowercase, abbreviations, emoji, message splitting) but not *what* he says at a deeper level. Every user gets the same Skarn regardless of history. His mood doesn't change. He never speaks unprompted. He has no awareness of the server's culture or inside jokes.

## [S2] Design Principles

- **Relationship-grounded**: Skarn's tone adapts to his history with each user. Newcomers get a different Skarn than regulars.
- **Mood is quiet, not loud**: Skarn's mood colors responses subtly — it doesn't hijack conversations. Most users won't notice it consciously, only that Skarn sometimes seems "off" or "on."
- **Presence without spam**: Proactive interjection is rare (1-3%) and only for users with established relationships.
- **Server culture is learned, not seeded**: Culture data accumulates naturally. No manual seeding.

## [S3] Architecture Overview

```
Phase 1 — features/relationship/
  ├── relationshipTracker.js    ← familiarity, banter level, tag detection
  └── relationshipDb.js         ← SQLite schema + queries

Phase 2 — features/mood/
  ├── moodManager.js            ← mood state machine + transitions
  └── moodLines.js              ← mood-to-prompt-line mapping

Phase 3 — features/presence/
  ├── interjectionEngine.js     ← proactive reply logic (replaces existing keyword+random)
  └── burstPattern.js           ← multi-message timing + splitting

Phase 4 — features/culture/
  └── cultureTracker.js         ← n-gram tracking, culture line injection
```

## [S4] Phase 1: Relationship System

### New DB Table

Appended to `db/skarn-schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_relationship (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  familiarity REAL NOT NULL DEFAULT 0,
  banter_level TEXT NOT NULL DEFAULT 'match',
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_interaction_at INTEGER NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  preferred_tone TEXT NOT NULL DEFAULT 'neutral',
  PRIMARY KEY (user_id, guild_id)
);
```

### Familiarity Mechanics

| Action | Familiarity Change |
|--------|-------------------|
| User sends message (in any channel Skarn sees) | +0.5 (capped at +3/day) |
| User runs an AI command (/consult, /joke, etc.) | +1 |
| User @mentions Skarn | +2 |
| Daily decay (if no interaction in 24h) | -1 (cap at 0) |
| `/etch` a fact | +1 |
| 7+ consecutive days with interaction | +5 bonus |

### Tag Detection

Tags are recalculated weekly (not on every message). Thresholds:

| Tag | Condition |
|-----|-----------|
| `newcomer` | Familiarity < 10 OR interaction_count < 5 |
| `regular` | 10+ interactions in past 7 days |
| `veteran` | Familiarity > 50 AND 30+ interactions total |
| `joker` | Average sentiment of user's messages > 0.5 AND variance > 0.4 |
| `serious` | Average sentiment of user's messages between -0.2 and 0.2 AND variance < 0.3 |
| `joker_serious` | meets both joker and serious criteria (user switches modes) |
| `quiet` | Average < 2 messages per day in channels Skarn sees |
| `debater` | User has used /debate 3+ times |

### Relationship Line

Injected into `buildSystemPrompt()` as a new parameter `relationshipLine`:

Low familiarity (< 15):
```
"You don't know this person well yet. Keep it lighter, feel them out."
```

Medium familiarity (15-50):
```
"This is a familiar face in the server. Comfortable but casual."
```

High familiarity (50-80):
```
"This one's been around. Known them a while. Banter level: {banter_level}. Tags: {tags}"
```

Max familiarity (80+):
```
"An old regular. You're comfortable with them. Banter level: {banter_level}. Tags: {tags}"
```

### Banter Level

Auto-assigned based on user's historical interaction style:
- `initiate`: user frequently starts banter → Skarn starts jokes with them
- `match`: user responds to banter but doesn't start it → Skarn matches their energy
- `avoid`: user is consistently serious → Skarn keeps it straight

### Gap Fix: Familiarity Baseline on Deploy

When the relationship system starts, scan `user_memory` for existing users. Users with 1+ stored facts get familiarity = 15. Users with 5+ facts get familiarity = 25.

### Gap Fix: Token Budget

`roleTokenBudgets.consult` stays at 900 — the relationship line adds ~30-60 tokens, which fits within the current budget. If mood and culture lines are added later (Phase 2-4), increase to 1000.

## [S5] Phase 2: Mood & Presence

### Mood Model

Skarn has a per-guild persistent mood with 5 states:

| Mood | Trigger | Duration | Effect |
|------|---------|----------|--------|
| `refreshed` | Bot just woke up / no activity for 2+ hours | 30 min | Slightly more energetic responses, more emoji |
| `neutral` | Default | Indefinite | Baseline persona |
| `tired` | High interaction volume (>50 AI calls in 2h) | 1 hour | Shorter responses, less banter initiation |
| `amused` | User banter detected (high variance sentiment) | 30 min | More jokes, more emoji, more abbreviations |
| `focused` | Mostly serious queries in last 30 min | 30 min | Straightforward, fewer jokes, more direct answers |

### Mood Transitions

Mood is evaluated on a 10-minute cycle (piggyback on the existing `runDecayPass` interval):

```js
function evaluateMood(guildId) {
  const stats = getRecentStats(guildId); // last 2 hours of interactions
  if (stats.aiCalls > 50) return 'tired';
  if (stats.banterRatio > 0.6) return 'amused';
  if (stats.seriousRatio > 0.7) return 'focused';
  if (hoursSinceActivity > 2) return 'refreshed';
  return 'neutral';
}
```

### Mood Line

Injected into `buildSystemPrompt()` as `moodLine`:

```js
const MOOD_LINES = {
  refreshed: "You're feeling alert and present. The static is clear today.",
  neutral: '',  // No line — neutral is the default, no need to state it
  tired: "You've been busy. Responses are a bit shorter today. You're present but conserving energy.",
  amused: "Something about the conversation today has you amused. You're playing along.",
  focused: "The conversation has been substantive. You're keeping it direct and grounded.",
};
```

### Design Decision: Per-Guild Mood

Mood is per-guild (not global, not per-channel). A busy guild with lots of banter shouldn't make Skarn tired in a quiet guild. Stored in a new `guild_mood` SQLite table.

### Gap Fix: Mood Persistence

Mood persists in SQLite (table: `guild_mood`). On bot restart, mood loads from last saved state. If last activity was > 2 hours ago, mood resets to `refreshed`.

## [S6] Phase 3: Natural Presence Patterns

### Gap Fix: Overlap with Existing Random Sayings

The existing `bot.js` has:
1. Keyword triggers (15% chance): "bruh" → "bruh moment 😔"
2. Random chance (3%): picks from a pool of sayings

Phase 3 **replaces** both of these with a unified interjection system that's relationship-aware and less random.

### Unified Interjection Engine

Replaces the existing keyword trigger block and random saying block in `bot.js`:

```js
// OLD — remove:
// if (Math.random() < 0.15) { for (keyword ...) }
// if (Math.random() < 0.03) { random sayings }

// NEW:
maybeInterject(message, client);
```

**Interjection chances:**

| Condition | Chance | Example |
|-----------|--------|---------|
| Message contains "skarn" keyword | 100% | (already handled by mention router) |
| User has `regular`+ tag AND message is banter-y | 10% | "lmao fr" |
| User has `veteran` tag AND message is question-like | 8% | Jumps in before being asked |
| Message contains a keyword from the existing pool | 3% | "bruh", "lol", "gg" (same pool, but now rate-limited) |
| Neither of the above | 0.5% | True random |

**Rate limit:** Max 1 interjection per 5 minutes per channel (prevents spam).

### Multi-Message Bursts

When a casual response is 200-400 chars, Skarn has a 15% chance to split it into 2 messages with a 2-4s gap between them:

```
Skarn: i mean that's one way to look at it
[3s pause]
Skarn: not the way i'd look at it but you do you
```

This replaces (or runs after) the existing 400-char `splitMessage`. It's a *stylistic* split, not a length-necessitated one.

Implementation: After `splitMessage(reply, 400)` produces chunks, if length between 200-400 and there's a natural sentence break, insert a 2-4s delay between follow-ups instead of sending them instantly.

## [S7] Phase 4: Server Culture Memory

### Gap Fix: No Message Text Persistence

The existing system does not persist message text (intentional, per original persona spec). Phase 4 respects this — it tracks **n-gram frequency** only, not full messages.

### What's Tracked

In-memory per channel (like the sentiment buffer), periodically flushed to SQLite:

```sql
CREATE TABLE IF NOT EXISTS server_culture (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  ngram TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, channel_id, ngram)
);
```

**Tracked n-grams:**
- 2-grams (bigrams) that appear 5+ times in a day
- 3-grams that appear 3+ times in a day
- Filtered: stop words removed, no single characters
- Capped at 50 entries per channel (LRU eviction)

### Culture Line

Injected into `buildSystemPrompt()` as `cultureLine` — but only when there's something noteworthy:

```js
function getCultureLine(guildId, channelId) {
  const top = getTopNGrams(guildId, channelId, 3);
  if (top.length === 0) return '';
  return `The culture here: "${top.join('", "')}". Reference naturally if relevant.`;
}
```

Example: If a channel frequently says "that's what she said", the culture line becomes:
```
The culture here: "that's what she said". Reference naturally if relevant.
```

### Gap Fix: Server Culture Persists Across Restarts

The n-gram data is flushed to SQLite every 10 minutes (on the decay pass cycle). On restart, the top 50 n-grams per channel are loaded back into memory. This way culture survives restarts without needing to store raw messages.

## [S8] Integration

### buildSystemPrompt() Signature Update

```js
function buildSystemPrompt({ roleLine, stateLine, moodLine, relationshipLine, cultureLine, memoryLine })
```

All new lines are optional (empty string default). No change to existing callers.

### bot.js Changes

- Add `updateRelationship` call in `messageCreate` (after state tracking)
- Add `evaluateMood` call on the existing 10-minute interval
- Replace keyword triggers + random sayings with `maybeInterject`
- Add `updateCulture` call in `messageCreate` (n-gram tracking)

### New Tables Summary

| Table | Phase | Purpose |
|-------|-------|---------|
| `user_relationship` | P1 | Per-user familiarity, banter level, tags |
| `guild_mood` | P2 | Per-guild Skarn mood |
| `server_culture` | P4 | Per-channel n-gram frequency |

### No New Commands

All 4 phases are passive/background. No new slash commands.

### Gap Fix: `/relation` Command

Cheatsheet command so users can see how Skarn sees them:

- `/relation` — ephemeral reply: "I'd say we're {familiarity}/100. Feels like you're one of the {tags}. Banter? {banter_level}."
- No AI call, static response from relationship data.
- `command/relation.js` (thin wrapper)

## [S9] Out of Scope

- Per-user mood (too complex, mood is per-guild)
- Skarn initiating DMs with users (intrusive)
- Sentiment analysis on DMs (privacy)
- Manual relationship overrides (admin commands)
- Server culture learned from other bots' messages
- Multi-guild culture cross-pollination

## [S10] Verification

1. Deploy, send messages as a new user → Skarn's tone should be more reserved
2. Interact 20+ times as the same user → Skarn should feel progressively more familiar
3. Run `/relation` → should show increasing familiarity over time
4. In a busy guild, cause 50+ AI calls in 2h → Skarn's responses should shorten
5. Send several banter messages → Skarn should match energy
6. Send several serious queries → Skarn should get more direct
7. Say "skarn" in a message → still works (existing keyword routing)
8. Check that existing keyword triggers (bruh, lol, gg) still fire but through the new interjection system
9. Wait for bot restart → mood should load from last saved state
10. Check that culture n-grams survive a restart (flush → reload cycle)
