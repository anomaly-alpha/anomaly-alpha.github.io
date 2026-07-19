# [S1] Problem: Memory Fragmentation

Two memory stores in skarn-bot have fragmented write/read paths, causing data inconsistency:

## [S2] Bug 1: user_memory ↔ memory_entries

- **Write path:** `/etch` command and `etch.handler.js` write to `memory_entries` via `addMemoryEntry()`
- **Read path:** 19 command files (joke, roast, compliment, insult, pickup, song, story, fortune, homework, recipe, code, debate, meme, aitrivia, adventure, charades, wouldyourather, unpopularopinion, improv) read from `user_memory` via `getUserMemory()` using `m.fact_text`
- **Shadow read:** `promptContext.js` reads from `memory_entries` for AI context assembly — so the AI DOES see etch facts, creating a confusing split where creative commands ignore etched data but the AI persona sees it
- `addUserMemory()` — dead export, never called anywhere
- `deleteUserMemory()` — dead export, never called anywhere
- `getUserMemory()` — STILL called by 19 command files. Reads from the stale `user_memory` table.
- `deleteUserMemoryEntries()` — called by `/forget`, correctly deletes from `memory_entries`

## [S3] Bug 2: knowledge_graph ↔ memory_entries

- **Write path:** `knowledgeGraph.js` writes extracted entities (interests) to `memory_entries` via `addMemoryEntry()` with `source='extracted'`
- **Read path:** `modelRouter.js` reads from `knowledge_graph` via `getKnowledge()` to check entity matches for complex model routing
- `knowledgeGraph.js` NO LONGER writes to `knowledge_graph` table — the table has stale data only
- `getKnowledge()` in `database.js` — still reads from `knowledge_graph`
- `addKnowledge()` in `database.js` — dead export, never called anywhere

## [S4] Solution overview

1. Create a `getUserFacts()` helper in `db/database.js` that queries `memory_entries` with the correct source/type filter, returning rows with `content` key (matching what the new table returns)
2. Redirect all 19 command files to use `getUserFacts()` → `m.content` instead of `getUserMemory()` → `m.fact_text`
3. Update `modelRouter.js` to read from `memory_entries` instead of `knowledge_graph`
4. Run a one-time backfill migration script to copy `memory_entries(source='etch')` into `user_memory` for rollback safety
5. Clean up dead exports from `database.js`: `getUserMemory`, `addUserMemory`, `deleteUserMemory`, `getKnowledge`, `addKnowledge`
6. Keep `user_memory` and `knowledge_graph` tables in schema (safe to drop in a future pass)

## [S5] New functions

### `getUserFacts(userId, guildId, limit = 5)`

```js
function getUserFacts(userId, guildId, limit = 5) {
  return db.prepare(
    "SELECT content, confidence FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'etch' AND type = 'fact' ORDER BY updated_at DESC LIMIT ?"
  ).all(userId, guildId, limit);
}
```

Returns `[{ content, confidence }]` — commands access `m.content` instead of old table's `m.fact_text`.

### `getExtractedEntities(userId, guildId, limit = 20)`

```js
function getExtractedEntities(userId, guildId, limit = 20) {
  return db.prepare(
    "SELECT content, confidence, type FROM memory_entries WHERE user_id = ? AND guild_id = ? AND source = 'extracted' ORDER BY confidence DESC, last_seen_at DESC LIMIT ?"
  ).all(userId, guildId, limit);
}
```

Returns `[{ content, confidence, type }]` — used by `modelRouter.js` to check knowledge matches.

## [S6] Files modified

| File | Change |
|------|--------|
| `db/database.js` | Add `getUserFacts()`, `getExtractedEntities()`. Remove dead exports: `getUserMemory`, `addUserMemory`, `deleteUserMemory`, `getKnowledge`, `addKnowledge` |
| `features/intelligence/modelRouter.js` | Replace `getKnowledge()` call with `getExtractedEntities()` from memory_entries |
| 19 command files in `commands/` | Replace `getUserMemory` → `getUserFacts`, `m.fact_text` → `m.content` |
| `scripts/backfill-memory.js` | Create: one-time migration script |

## [S7] Commands affected (19 files)

Each of these has the same two-line edit:

| File | Import change | Usage change |
|------|--------------|--------------|
| `commands/joke.js` | `getUserMemory` → `getUserFacts` | `m.fact_text` → `m.content` |
| `commands/roast.js` | same | same |
| `commands/compliment.js` | same | same |
| `commands/insult.js` | same | same |
| `commands/pickup.js` | same | same |
| `commands/song.js` | same | same |
| `commands/story.js` | same | same |
| `commands/fortune.js` | same | same |
| `commands/homework.js` | same | same |
| `commands/recipe.js` | same | same |
| `commands/code.js` | same | same |
| `commands/debate.js` | same | same |
| `commands/meme.js` | same | same |
| `commands/aitrivia.js` | same | same |
| `commands/adventure.js` | same | same |
| `commands/charades.js` | same | same |
| `commands/wouldyourather.js` | same | same |
| `commands/unpopularopinion.js` | same | same |
| `commands/improv.js` | same | same |

## [S8] Backfill script

`scripts/backfill-memory.js` — one-time migration that copies all non-duplicate `memory_entries(source='etch')` into the `user_memory` table:

```js
// Run once: node scripts/backfill-memory.js
const { db } = require('../db/database');

const rows = db.prepare(
  "SELECT user_id, guild_id, content, updated_at FROM memory_entries WHERE source = 'etch' AND type = 'fact' ORDER BY updated_at ASC"
).all();

let count = 0;
for (const row of rows) {
  const existing = db.prepare(
    'SELECT id FROM user_memory WHERE user_id = ? AND guild_id = ? AND fact_text = ?'
  ).get(row.user_id, row.guild_id, row.content);
  if (!existing) {
    db.prepare(
      'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
    ).run(row.user_id, row.guild_id, row.content, row.updated_at);
    count++;
  }
}
console.log(`Backfilled ${count} entries into user_memory`);
```

## [S9] Out of scope

- Dropping `user_memory` or `knowledge_graph` tables from schema (future cleanup)
- Dropping `user_memory` table's indexes (safe for now)
- Renaming `memory_entries` → `user_memory` (would break too many things)
- Adding any new commands or features
- Changing `/forget` behavior (already correctly targets `memory_entries`)
- Updating `relationshipTracker.js` (imports `getUserMemory` but never uses it — dead import only)

## [S10] Verification

1. Run `node scripts/backfill-memory.js` — should print backfill count (0 or more)
2. Run `/etch I like pizza` — should write to `memory_entries` (no change in behavior)
3. Run `/joke` — should see etch facts in the AI prompt (previously would see nothing from fresh etches)
4. Run `/code` — same as above, should use etch facts
5. Check `modelRouter` behavior — messages with keywords matching extracted entities should route to complex model
6. Verify no crashes on any affected command with the new `m.content` property access
7. Run `node -e "require('./db/database')"` — should load without errors after removing dead exports
