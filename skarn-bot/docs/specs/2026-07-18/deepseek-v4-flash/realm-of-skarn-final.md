# Realm of Skarn — Persistent AI-Driven RPG

## [S1] Problem

Skarn has 60+ commands but the game/entertainment layer is shallow — one-shot interactions with no persistence, no progression, and no shared world. GPT-5.4-mini can generate entire worlds: NPCs with personality, branching narratives, combat encounters, item descriptions. The bot needs a flagship feature that leverages this capability — a persistent RPG where players create characters, explore a living world, fight enemies, complete quests, and shape a shared realm that remembers them.

## [S2] Design Principles

- **AI-first worldbuilding**: GPT-5.4-mini generates everything — NPCs, dialogue, combat narration, item descriptions, quest hooks. No hand-written content beyond the skeleton.
- **Persistent by default**: Characters, inventory, quest progress, NPC relationships, and discovered locations survive bot restarts via SQLite.
- **Async multiplayer**: Players share a world but explore solo. They can see each other's discoveries, trade items, and encounter each other's traces — but no real-time co-op.
- **Hybrid UI**: Exploration and minor actions use ephemeral replies with buttons. Major story moments (boss fights, quest completions, level-ups) post to channel.
- **Skarn as Dungeon Master**: The AI narrates through Skarn's voice — ancient, witty, observational. Not a generic DM. The world feels like HIS realm.
- **Tone guardrail**: Fantasy violence only (combat narration stays in the same register as typical PG-13 fantasy media) — no gratuitous gore, no romance/dating mechanics, no real-world violence framing. This is a hard constraint on what `aiDriver.js` prompts should produce, written directly into the role lines.
- **YAGNI ruthlessly**: Ship the core loop first. Factions, trading, and advanced systems can layer on later.

## [S3] Architecture

```
skarn-bot/
├── features/realm/
│   ├── realmCommand.js          ← /realm slash command (subcommands: create, start, explore, stats, inventory, quest, rest, trade)
│   ├── character.js             ← Character CRUD, stat generation, leveling
│   ├── world.js                 ← Location registry, connections, discovery tracking
│   ├── npc.js                   ← NPC generation, memory, faction ties, hostility thresholds
│   ├── combat.js                ← AI-narrated combat engine
│   ├── inventory.js             ← Item management, equipment, shops
│   ├── quest.js                 ← Quest generation, tracking, completion
│   ├── economy.js               ← Currency, trading between players
│   ├── aiDriver.js              ← All GPT-5.4-mini calls for realm (DM prompts, NPC dialogue, combat narration)
│   ├── realmStore.js            ← SQLite operations for all realm tables
│   ├── realmConfig.js           ← Constants: starting stats, location templates, item pools
│   └── realmRateLimit.js        ← Realm-specific AI call budget, separate bucket from the global limiter
├── db/
│   └── skarn-schema.sql         ← APPEND new realm tables (do not touch existing)
├── persona/
│   └── roles.js                 ← ADD 'realm' role + token budget
└── bot.js                       ← Import realm command
```

## [S4] Character System

### [S4a] Creation Flow (AI-guided, ephemeral)

`/realm create` starts a multi-step ephemeral conversation:

1. **Name** — text input (max 24 chars, alphanumeric + spaces)
2. **Race** — button selection: Human, Elf, Dwarf, Demon, Tiefling, Dragonborn
3. **Class** — button selection: Warrior, Mage, Rogue, Cleric, Ranger, Warlock
4. **Background question** — AI asks ONE question to shape backstory (e.g. "What drives you to enter the realm?" or "What's the one thing you'd never trade?")
5. **Backstory** — AI generates a 2-3 paragraph backstory based on race + class + answer. Player can Accept or Reroll (regenerate).

Each step uses button interactions with a 5-minute timeout per step. If expired, the creation is abandoned with an in-character Skarn line ("The realm grows impatient. Return when you're ready.").

**Reroll cost:** cap backstory reroll at 2 attempts per creation session, counted against the realm-specific rate limit — unbounded free rerolls are an easy way to quietly burn AI budget with no gameplay value.

### [S4b] Stat Generation

Stats auto-generated from race + class combination. No manual point-buy.

| Stat | Derived From |
|------|-------------|
| HP | 20 + (CON × 5) + (level × 3) |
| Attack | STR or DEX (class-dependent) + weapon bonus |
| Defense | CON + armor bonus |
| Magic | INT or WIS (class-dependent) + staff bonus |
| Speed | DEX modifier |
| Luck | Random 1-10 at creation, can increase via items |

Race bonuses:

| Race | Bonus |
|------|-------|
| Human | +1 to all stats |
| Elf | +3 DEX, +2 INT |
| Dwarf | +3 CON, +2 STR |
| Demon | +3 STR, +2 CHA, -1 WIS |
| Tiefling | +3 CHA, +2 INT |
| Dragonborn | +2 STR, +2 CON, +1 CHA |

Class base stats (before race bonuses):

| Class | STR | DEX | INT | CON | WIS | CHA | Primary | Secondary |
|-------|-----|-----|-----|-----|-----|-----|---------|-----------|
| Warrior | 12 | 8 | 6 | 10 | 7 | 7 | STR | CON |
| Mage | 6 | 7 | 12 | 7 | 10 | 8 | INT | WIS |
| Rogue | 8 | 12 | 7 | 8 | 7 | 8 | DEX | CHA |
| Cleric | 8 | 7 | 7 | 10 | 12 | 6 | WIS | CON |
| Ranger | 9 | 11 | 7 | 9 | 9 | 5 | DEX | WIS |
| Warlock | 7 | 8 | 10 | 7 | 8 | 10 | INT | CHA |

Class determines available abilities (e.g. Warrior: Shield Bash, Battle Cry; Mage: Fireball, Frost Shield; etc.). Abilities are defined in `realmConfig.js`.

### [S4c] Leveling

- XP earned from: combat (enemy-dependent), quest completion, exploration (new locations)
- XP formula: `XP needed = level × 100 + 50`
- On level up: +2 HP, +1 to primary stat, +1 to secondary stat
- Level up posts to channel (major event): embed with new stats, Skarn narration
- Max level: 20 (at which point the character is "realm-famous")
- **XP overflow at max level:** once level 20 is reached, further XP earned converts to gold at a fixed rate (1 XP = 1 gold) rather than silently discarding it.

### [S4d] Character Sheet Display

`/realm stats` — ephemeral embed showing:
- Name, Race, Class, Level
- HP bar (current/max)
- All 6 stats with modifiers
- Active equipment
- Gold amount
- Quests completed count
- Locations discovered count

## [S5] World System

### [S5a] Location Skeleton

The world is a graph of named locations connected by paths. v1 ships with 8 core locations forming a connected map:

```
                  [The Abyssal Gate]
                         |
                  [Shadow Market]
                    /         \
        [Cursed Library]   [Bone Arena]
              |                |
        [Whispering Woods] [Obsidian Mines]
              \                /
           [Ruined Temple] — [Dragon's Maw]
```

Each location has:
- `name` — display name
- `description` — 1-2 sentence base description (hand-written skeleton)
- `connections` — array of location IDs it links to
- `dangerLevel` — 1-5 (determines enemy difficulty)
- `npcPool` — array of possible NPC templates for this location
- `discoveredBy` — array of user IDs who've found it (scoped per-guild)

### [S5b] Exploration

`/realm explore` — the core loop:

1. Player is at their current location
2. AI generates 3-4 possible actions based on location + character state + history:
   - Move to adjacent location
   - Interact with NPC (if present)
   - Search for items/enemies
   - Use class ability (context-dependent)
3. Player clicks a button to choose
4. AI narrates the result, updates world state
5. Loop continues

Exploration is ephemeral. The current scene, choices, and recent history are kept in an in-memory Map (keyed by userId), lost on restart — but the character's location and inventory persist in SQLite. On restart, `/realm explore` resumes from last saved location with a fresh scene.

**Double-submit guard:** button interactions can arrive faster than a single AI round-trip resolves. Before processing a button click, check (and set) a per-user `isProcessing` boolean in the same in-memory Map used for scene state; if already `true`, ignore the second interaction with a quiet ephemeral "Still resolving your last action." rather than double-applying damage, XP, or item grants. Clear the flag once the AI call and SQLite write both complete (success or failure).

### [S5c] Discovery

New locations can be discovered through:
- Exploration rolls (AI decides "you notice a hidden path...")
- Quest rewards ("the quest reveals a secret passage to...")
- Item use (a key opens a locked door)

Discovered locations are saved to the `realm_discovered_locations` table. Each player has their own discovery graph — finding a location doesn't reveal it for everyone.

**Note:** A rumor system (e.g. an NPC occasionally hinting at a location another player has found) is a reasonable v2 idea but needs its own design pass. Discovery is private to the discovering player in v1.

## [S6] NPC System

### [S6a] NPC Generation

NPCs are AI-generated with a structured template:

```js
{
  id: "npc_shadow_merchant",
  name: "Vex",              // AI-generated
  role: "merchant",         // merchant, quest_giver, enemy, ally, neutral
  location: "shadow_market",
  personality: "sardonic",  // AI-chosen from a pool
  memory: [],               // interactions with players
  inventory: [],            // items for sale
  dialogueHistory: {}       // userId -> last 3 exchanges (for continuity)
}
```

### [S6b] NPC Memory and Relationship State

Each NPC remembers the last 5 interactions per player (stored in `realm_npc_memory` table). This allows:
- NPCs to reference past trades ("Ah, the one who bought the cursed dagger. Still alive, I see.")
- Relationships to evolve (friendly → neutral → hostile based on player actions)
- Quests to chain ("Since you helped me before, I have another task...")

**Relationship computation:**

Each `realm_npc_memory` row stores a `sentiment` value from -5 to +5 for that single interaction. Relationship state is the **running average of the last 5 sentiment values** for that NPC+player pair:
- Average ≥ +2 → `friendly`
- Average between -1 and +1 → `neutral`
- Average ≤ -2 → `hostile`

**Gameplay consequences:**
- `friendly` — merchant discount (10% off, see [S10c]); quest-giver NPCs are more likely to offer chained quests.
- `neutral` — default behavior, no modifier.
- `hostile` — merchant refuses to trade ("Not with you."); quest-giver NPCs won't offer new quests; and critically, a `hostile` NPC with `role: enemy`-eligible becomes a **combat encounter trigger** the next time the player interacts with them at their location — this is the concrete mechanic behind "player provokes an NPC" in [S7a].

### [S6c] NPC Dialogue

When a player interacts with an NPC:
1. Load NPC template + memory for this player
2. Build AI prompt: NPC personality + location + recent history + memory
3. AI generates dialogue with 2-4 response options for the player
4. Player chooses, NPC responds, memory updated

NPC dialogue uses the `realm_npc` role with a token budget of 600.

## [S7] Combat System

### [S7a] Encounter Triggers

Combat starts when:
- Player chooses "search for enemies" during exploration
- Player enters a dangerous location (dangerLevel ≥ 3)
- Quest requires combat
- Player provokes an NPC — concretely, an NPC relationship has crossed the `hostile` threshold defined in [S6b]

### [S7b] Combat Flow (AI-narrated)

1. **AI generates enemy** — name, description, stats (HP, attack, defense, special ability)
2. **Round starts** — AI describes the scene, gives 3-4 tactical options:
   - Attack (basic)
   - Use ability (class-specific)
   - Defend (reduce incoming damage by 50%)
   - Flee (success chance: player Speed vs enemy Speed, 60%+ base)
   - Use item (if applicable)
3. **Player chooses** — button click
4. **Code calculates outcome** using the formulas below, then AI narrates the result
5. **Enemy attacks** — code calculates damage, AI narrates the enemy action
6. **Repeat** until HP ≤ 0 (defeat) or enemy HP ≤ 0 (victory)
7. **Victory** — AI narrates the kill, code awards XP + gold + potential item drop
8. **Defeat** — AI narrates the fall, player respawns at last safe location with half gold

### [S7b1] Damage Formulas

Damage is calculated by code, not the AI. The AI narrates but does NOT decide outcomes.

**Player attacks enemy:**
```
base_damage = primary_stat + weapon_bonus
crit_chance = luck / 100
is_crit = random() < crit_chance
damage = base_damage × (is_crit ? 2 : 1) - enemy.defense
final_damage = max(damage, 1)  // minimum 1 damage
```

**Enemy attacks player:**
```
base_damage = enemy.attack
defending = player chose Defend
damage = base_damage - (player.defense × (defending ? 2 : 1))
final_damage = max(damage, 1)
```

**Flee check:**
```
flee_chance = 0.4 + (player.speed - enemy.speed) * 0.05
flee_chance = clamp(flee_chance, 0.1, 0.9)
```

The AI receives the calculated outcome ("You deal 7 damage, enemy has 12 HP remaining") and narrates it. The AI does NOT calculate damage — it only describes what happens.

### [S7c] Combat AI Prompt Structure

```
You are Skarn, narrating a combat encounter in the Realm.

Player: {name} the {race} {class}, Level {level}, HP {current}/{max}
Stats: STR {x}, DEX {x}, INT {x}, CON {x}, WIS {x}, CHA {x}
Equipment: {weapon}, {armor}
Abilities: {class_abilities}

Enemy: {name}, HP {current}/{max}, Attack {x}, Defense {x}, Special: {ability}

Recent history: {last_3_exchanges}

Give 3-4 tactical options. End each narration with a clear choice.
Keep combat fast — one exchange per turn, no filler.
```

Token budget for combat: 700. Temperature: 0.7 — narration should vary round to round, but stay tactically coherent given the damage numbers are fixed by code, not the AI.

### [S7d] Combat Persistence — per-round HP writes

- Enemy HP and combat scene state are tracked in an in-memory Map during active combat.
- **Player HP is written to `realm_characters.hp_current` in SQLite after every single exchange**, not only at final resolution. This prevents a mid-fight bot restart from silently reverting a losing player's HP to their pre-fight value — a free reset with no in-fiction consequence.
- If the bot restarts mid-combat, the player resumes at whatever HP they were actually at when the round last resolved. The enemy (having no persisted state) is simply gone — narrated on next `/realm explore` as "the creature slipped away in the chaos," not a clean escape.
- Combat results (final XP, gold, items) are still persisted to SQLite immediately on resolution.

### [S7e] Closing the defeat-avoidance exploit

- **Voluntary Flee (the "Flee" button, resolved via the flee-chance roll in [S7b1])** remains penalty-free on success — this is a real tactical choice the player made and rolled for.
- **Interaction timeout with a still-living enemy** (collector expires without a Flee attempt) now applies a flat penalty: lose 10% of current gold (minimum 0) and the enemy is *not* defeated (no XP/loot). This is deliberately smaller than the 50% defeat penalty (timing out isn't as bad as actually losing) but large enough that it's never a strictly better option than playing the fight out or attempting a real flee.

## [S8] Inventory System

### [S8a] Item Types

| Type | Examples | Effect |
|------|----------|--------|
| Weapon | Rusty Sword, Shadow Blade, Mjolnir | +Attack |
| Armor | Leather Vest, Dragon Scale, Void Plate | +Defense |
| Consumable | Health Potion, Elixir of Strength, Scroll of Fireball | One-use buff or heal |
| Quest | Ancient Key, Sealed Letter, Crystal Shard | Required for quests |
| Material | Iron Ore, Moonstone, Dragon Scale (crafting) | Used in crafting (v2) |
| Misc | Broken Compass, Faded Map, Strange Coin | Flavor or trade value |

### [S8b] Item Structure

```js
{
  id: "item_shadow_blade",
  name: "Shadow Blade",
  type: "weapon",
  description: "A blade forged in the Abyss. It drinks light.",  // AI-generated
  rarity: "rare",          // common, uncommon, rare, epic, legendary
  stats: { attack: 8 },
  value: 150,              // gold value
  owner: "user_id",        // null if in world/loot
  location: null,          // null if carried
}
```

### [S8c] Inventory Commands

- `/realm inventory` — ephemeral list of carried items with equip/use buttons
- `/realm equip <item>` — equip a weapon or armor piece
- `/realm use <item>` — consume a consumable
- `/realm drop <item>` — drop an item at current location (visible to other players)

**Discord select-menu limit:** Discord string select menus cap out at 25 options. If a player's inventory exceeds 25 items, `/realm inventory` and the trade item-picker must paginate (e.g. a "next page" button cycling through batches of 25) rather than silently truncating or erroring.

### [S8d] Loot Drops

After combat, AI decides loot based on:
- Enemy difficulty (dangerLevel × level)
- Player Luck stat
- Location type (mines yield materials, libraries yield scrolls)
- Rarity weighted random: common 50%, uncommon 30%, rare 15%, epic 4%, legendary 1%

Item names and descriptions are AI-generated. Stats follow templates based on rarity and type.

## [S9] Quest System

### [S9a] Quest Generation

Quests are AI-generated with a structured template:

```js
{
  id: "quest_001",
  title: "The Whispering Stones",
  giver: "npc_elder",        // NPC who gives the quest
  location: "ruined_temple",
  description: "AI-generated 2-3 sentence hook",
  objectives: [
    { type: "kill", target: "Shadow Wraith", count: 3, current: 0 },
    { type: "fetch", target: "Ancient Scroll", count: 1, current: 0 },
  ],
  rewards: { xp: 200, gold: 100, items: ["item_ancient_scroll"] },
  status: "active",          // available, active, completed, failed
  chain: "quest_002",        // next quest in chain (if any)
}
```

### [S9b] Quest Types

| Type | Description |
|------|-------------|
| Kill | Defeat N enemies of a type |
| Fetch | Find and return an item |
| Explore | Discover a specific location |
| Escort | Guide an NPC to a location (narrative only, no real escort mechanic) |
| Puzzle | Solve an AI-generated riddle or puzzle |
| Boss | Defeat a unique boss enemy |

### [S9c] Quest Flow

1. Player interacts with NPC at a location
2. AI generates quest hook based on NPC role + location + player history
3. Player accepts via button
4. Objectives tracked in `realm_quests` table
5. As player explores, objectives auto-complete when conditions are met
6. Return to quest giver for rewards (AI narrates completion)
7. If quest has a chain, next quest unlocks

### [S9d] Active Quest Limit

Max 3 active quests per player. Quest log displayed via `/realm quests`.

## [S10] Economy System

### [S10a] Currency

Gold is the primary currency. Earned from:
- Combat victories (enemy level × 5-15)
- Quest rewards
- Selling items to merchants
- Exploration finds

Lost from:
- Defeat (half gold dropped)
- Interaction timeout mid-combat (10% of current gold — see [S7e])
- Purchasing from merchants
- Repair costs (v2)

### [S10b] Trading

Player-to-player trading via `/realm trade @player`:
1. Initiator runs `/realm trade @player` — target must have a character and must not be the initiator themselves
2. Initiator selects items + gold to offer (ephemeral multi-select, paginated per [S8c] if over 25 items)
3. Target receives an ephemeral embed showing the offer, selects their items + gold
4. Both players see a final confirmation embed with both sides listed
5. Both click "Confirm Trade" button (within 5 minutes)
6. Trade executes atomically in one SQLite transaction — both inventories updated, items transferred
7. If either player declines or timeout expires, trade is cancelled with in-character message

Only one active trade per player at a time. Running `/realm trade` while already in a trade returns "You're already negotiating."

### [S10c] Shops

NPC merchants at specific locations sell items. Stock is AI-generated based on:
- Location type (Shadow Market sells rare items, Bone Arena sells weapons)
- Merchant personality (sardonic merchant prices higher)
- Player relationship: `friendly` → 10% discount; `hostile` → refuses to trade at all

Shop inventory refreshes every 24 hours (AI-regenerated).

## [S11] Persistence Layer

### [S11a] New SQLite Tables — guild-scoped

All realm tables are guild-scoped. A player who plays Realm in two different Discord servers gets two separate characters, inventories, and quest logs. This is consistent with how the rest of this bot's persona features (`user_memory`, `channel_state`) are already guild-scoped, and matches the async-multiplayer, shared-world design intent — a single server's realm is its own self-contained world state.

Append to `db/skarn-schema.sql` — DO NOT modify existing tables.

```sql
-- Realm of Skarn tables
CREATE TABLE IF NOT EXISTS realm_characters (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  race TEXT NOT NULL,
  class TEXT NOT NULL,
  backstory TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  hp_current INTEGER NOT NULL,
  hp_max INTEGER NOT NULL,
  strength INTEGER NOT NULL,
  dexterity INTEGER NOT NULL,
  intelligence INTEGER NOT NULL,
  constitution INTEGER NOT NULL,
  wisdom INTEGER NOT NULL,
  charisma INTEGER NOT NULL,
  luck INTEGER NOT NULL,
  gold INTEGER NOT NULL DEFAULT 50,
  current_location TEXT NOT NULL DEFAULT 'abyssal_gate',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS realm_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  stats TEXT,           -- JSON string
  value INTEGER NOT NULL DEFAULT 0,
  equipped INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realm_inventory_user ON realm_inventory(user_id, guild_id);

CREATE TABLE IF NOT EXISTS realm_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  giver_npc TEXT,
  objectives TEXT NOT NULL,   -- JSON string
  rewards TEXT,               -- JSON string
  status TEXT NOT NULL DEFAULT 'active',
  chain_next TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realm_quests_user ON realm_quests(user_id, guild_id);

CREATE TABLE IF NOT EXISTS realm_npc_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  npc_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  sentiment INTEGER NOT NULL DEFAULT 0,  -- -5 to +5
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realm_npc_memory_lookup ON realm_npc_memory(npc_id, user_id, guild_id);

CREATE TABLE IF NOT EXISTS realm_discovered_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  discovered_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, location_id)
);

CREATE TABLE IF NOT EXISTS realm_kill_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  enemy_name TEXT NOT NULL,
  enemy_level INTEGER NOT NULL,
  location TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  gold_earned INTEGER NOT NULL,
  killed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_realm_kill_log_user ON realm_kill_log(user_id, guild_id);

CREATE TABLE IF NOT EXISTS realm_world_state (
  key TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, guild_id)
);
```

### [S11b] JSON-Serialized Fields

Several columns store JSON strings for flexibility:
- `realm_inventory.stats` — `{"attack": 8, "defense": 0}`
- `realm_quests.objectives` — `[{"type":"kill","target":"Wraith","count":3,"current":1}]`
- `realm_quests.rewards` — `{"xp":200,"gold":100,"items":["item_001"]}`

Parse with `JSON.parse()`, serialize with `JSON.stringify()`. No nested queries needed.

### [S11c] realmStore.js

Single data-access module. All SQLite operations for realm go through here. No other file imports `db` directly for realm tables. Every function takes `guildId` alongside `userId`.

Key functions:
- `getCharacter(userId, guildId)` / `saveCharacter(userId, guildId, data)`
- `deleteCharacterCascade(userId, guildId)` — deletes the character row AND all associated rows in `realm_inventory`, `realm_quests`, `realm_discovered_locations`, `realm_kill_log`, and `realm_npc_memory` for that user+guild in one transaction.
- `getInventory(userId, guildId)` / `addItem(userId, guildId, item)` / `removeItem(userId, guildId, itemId)` / `equipItem(userId, guildId, itemId)`
- `getActiveQuests(userId, guildId)` / `addQuest(userId, guildId, quest)` / `updateQuest(userId, guildId, questId, patch)`
- `addNpcMemory(npcId, userId, guildId, type, summary, sentiment)` / `getNpcMemory(npcId, userId, guildId, limit)` / `getNpcRelationship(npcId, userId, guildId)` — returns the computed `friendly`/`neutral`/`hostile` state per [S6b]
- `discoveredLocation(userId, guildId, locationId)` / `getDiscoveredLocations(userId, guildId)`
- `logKill(userId, guildId, enemy)` / `getKillStats(userId, guildId)`
- `getWorldState(key, guildId)` / `setWorldState(key, guildId, value)`
- `getLeaderboard(guildId, limit)` — top characters by level, guild-scoped

## [S12] AI Integration

### [S12a] Persona Integration

The `realm` role integrates with the existing persona system via `buildSystemPrompt()`:

```js
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');

const systemPrompt = buildSystemPrompt({
  roleLine: roles.realm,
  stateLine: '',   // realm doesn't use channel state
  memoryLine: '',  // realm uses NPC memory, not user_memory
});
```

The `realm` role must be added to `persona/roles.js` AFTER the persona upgrade is deployed. If deploying simultaneously, add the role in the same commit.

### [S12b] Role Definition

Add to `persona/roles.js`:

```js
realm: "You are Skarn, the Dungeon Master of the Realm. Narrate the world in your voice — ancient, witty, observational. Every NPC speaks with distinct personality. Combat is fast and tactical. End every scene with clear choices. The world remembers what players do. Keep tone in the register of fantasy adventure fiction — no gratuitous gore, no romance or dating-style content.",
realm_combat: "You are Skarn narrating combat. Fast, tactical, no filler. One exchange per turn. Give 3-4 options. End with a clear choice. Damage and outcomes are determined by stats, not narrative convenience. Fantasy violence only — no gratuitous gore.",
realm_npc: "You are an NPC in the Realm. Speak with a distinct personality. Remember past interactions with this player. Keep dialogue under 100 words. End with 2-4 response options for the player.",
```

Token budgets:
- `realm`: 700 (exploration narration + choices)
- `realm_combat`: 700 (combat narration + tactical options)
- `realm_npc`: 600 (dialogue + response options)

Temperatures: `realm` (exploration) 0.8, `realm_combat` 0.7 (see [S7c]), `realm_npc` 0.8. Higher temperature is fine for narration/dialogue flavor since none of it drives numeric outcomes — those are always code-calculated per [S7b1].

### [S12c] Context Window Management

GPT-5.4-mini has a finite context. Every realm AI call sends:

1. **System prompt**: `SKARN_CORE_IDENTITY` + realm role line
2. **Character state**: name, race, class, level, HP, stats, equipment (structured, ~100 tokens)
3. **Location**: current location description + danger level (~50 tokens)
4. **Active quest**: title + current objective (~30 tokens)
5. **NPC memory** (if NPC interaction): last 3 exchanges (~150 tokens)
6. **Recent history**: last 3 player choices + outcomes (~200 tokens)

Total context per call: ~530 tokens. Well within budget for GPT-5.4-mini.

### [S12d] Structured AI Output

AI responses for realm should follow patterns (not strict JSON — natural language with structure):

**Exploration**: Narrative paragraph + numbered choices
```
The Shadow Market bustles with... 

1. Approach the merchant with the glowing wares
2. Head north toward the Cursed Library
3. Search the alley behind the stalls
4. Check your inventory
```

**Combat**: Scene + tactical options
```
A Shadow Wraith materializes from the gloom...

1. Strike with your weapon
2. Cast a spell
3. Defend and wait for an opening
4. Attempt to flee
```

**NPC dialogue**: NPC speech + response options
```
"The blade you seek? Ha. Everyone seeks something in this place."

1. "What do you know about it?"
2. "I'm not here for blades. I'm here for answers."
3. Show him the Ancient Key
4. Leave
```

Parse player choice by matching the number (1-4) from the AI's output. If AI doesn't number choices correctly, fall back to position-based matching.

**Variable option counts:** if the AI returns fewer options than the maximum (e.g. 2 instead of 4), render only as many buttons as options were actually parsed. Don't pad with placeholder buttons, and don't assume exactly 4 when parsing — count the numbered lines actually present in the response first, then build the button row to match.

### [S12e] AI Cost Controls (per-session)

Each realm action is one AI call. To control costs:
- Exploration: one call per player choice (not per scene)
- Combat: one call per exchange (player action + enemy response)
- NPC dialogue: one call per player choice
- Quest generation: one call per quest offered
- Character creation: 2-3 calls (background question + backstory generation), capped at 2 backstory rerolls per [S4a]

Average session (30 min exploration): ~15-20 AI calls. Comparable to existing adventure command usage.

### [S12f] Rate limiting and daily budget

**Realm gets its own rate-limit bucket, separate from the bot-wide 10-calls-per-10-minutes limiter** used by `/consult`, `/roast`, and the other persona commands. Reusing the same bucket would mean a single Realm session (~15-20 calls in 30 minutes) exhausts a budget sized for occasional one-shot command usage within the first few minutes, effectively breaking the feature for anyone actively playing it.

Create `features/realm/realmRateLimit.js`, structurally identical to `lib/rateLimit.js` but with its own independent `Map` and its own ceiling: **30 realm AI calls per rolling 30-minute window per user** — generous enough to cover a full active session (per [S12e]'s ~15-20 call estimate, with headroom) while still bounding a single user's worst-case spend.

On limit exceeded during active play, reply in-character and distinct from the general bot's rate-limit message: `"Even the Realm needs to breathe. Rest a while before pressing further."` — a static string, no AI call.

**Per-guild daily ceiling:** independently of the per-user limiter, add a simple daily counter per guild (reset at UTC midnight, stored in `realm_world_state` under a `daily_ai_calls` key) capped at a configurable `REALM_DAILY_CALL_LIMIT` env var (suggested default: 1000). If the ceiling is hit, Realm AI actions across the whole guild return a static message ("The Realm rests until tomorrow.") until the daily counter resets — non-AI actions (checking `/realm stats`, `/realm inventory`) remain available regardless.

## [S13] Command Interface

### [S13a] /realm Subcommands

| Subcommand | Description | Permission |
|------------|-------------|------------|
| `/realm create` | Create a new character | Everyone |
| `/realm start` | Begin/continue exploring | Everyone (requires character) |
| `/realm explore` | Continue exploration from current location | Everyone (requires character) |
| `/realm stats` | View character sheet | Everyone |
| `/realm inventory` | View and manage inventory | Everyone |
| `/realm quests` | View active and completed quests | Everyone |
| `/realm rest` | Rest at current location (heal 25% HP) | Everyone |
| `/realm trade @player` | Initiate player trade | Everyone |
| `/realm delete` | Delete character (with confirmation) | Everyone |
| `/realm leaderboard` | Top characters by level, this guild only | Everyone |
| `/realm help` | Show realm commands and tips | Everyone |

### [S13b] Interaction Flow

```
User: /realm start
Bot: [ephemeral] Welcome back, Kael. You stand in the Shadow Market...
      The air smells of ozone and old coins.
      1. Browse the merchant stalls
      2. Head toward the Bone Arena
      3. Check the quest board
      4. View your stats

User: [clicks button 1]
Bot: [ephemeral] Vex, the sardonic merchant, eyes your purse...
      1. "Show me your wares."
      2. "I'm looking for information, not trinkets."
      3. Walk away
```

Major events post to channel (non-ephemeral):
- Character creation complete
- Level up
- Boss defeat
- Quest completion
- Legendary item found
- Character death

### [S13c] `/realm delete` — cascade

1. Player runs `/realm delete`.
2. Bot replies ephemeral with a confirmation button: "This erases Kael the Dwarf Warrior — level, gear, quests, everything. The realm will not remember you. Confirm?"
3. On confirmation, call `deleteCharacterCascade(userId, guildId)` (see [S11c]), which removes the row from `realm_characters` plus all matching rows in `realm_inventory`, `realm_quests`, `realm_discovered_locations`, `realm_kill_log`, and `realm_npc_memory` for that user+guild, in a single SQLite transaction.
4. `realm_kill_log` entries are also deleted — a deleted character shouldn't leave ghost stats behind.

## [S14] Error Handling

| Error | Behavior |
|-------|----------|
| No character exists | Prompt to `/realm create` |
| AI call fails | "The realm shudders... try again." (no API call for error) |
| Interaction expires (exploration, non-combat) | Scene lost, player can `/realm explore` to resume from saved location |
| Interaction expires (mid-combat) | 10% current-gold penalty applies, enemy not defeated — see [S7e] |
| Database write fails | Log error, reply "Something went wrong. Your progress may not have saved." |
| Invalid choice (AI didn't number options) | Fall back to position-based matching (1st button = 1st option) |
| Player at max quests | "Your journal is full. Complete a quest before taking another." |
| Trade partner offline | "They've stepped beyond the veil. Try again later." |
| Trade with self | "You can't negotiate with your own shadow." — rejected before any state changes |
| Character deleted mid-session | "Your character no longer exists. The realm has forgotten you." |
| Realm rate limit hit (per-user) | "Even the Realm needs to breathe. Rest a while before pressing further." |
| Realm daily guild budget exhausted | "The Realm rests until tomorrow." Non-AI actions still work. |
| Double-submitted button mid-resolution | "Still resolving your last action." — silently ignored otherwise |

## [S15] Files

### [S15a] New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `features/realm/realmCommand.js` | /realm slash command + subcommands | ~150 |
| `features/realm/character.js` | Character CRUD, stat gen, leveling | ~120 |
| `features/realm/world.js` | Location registry, connections, discovery | ~80 |
| `features/realm/npc.js` | NPC generation, memory, dialogue, relationship thresholds | ~120 |
| `features/realm/combat.js` | Combat engine, enemy generation, per-round HP writes | ~140 |
| `features/realm/inventory.js` | Item management, equipment, shops, pagination | ~110 |
| `features/realm/quest.js` | Quest generation, tracking, completion | ~100 |
| `features/realm/economy.js` | Currency, trading, self-trade guard | ~90 |
| `features/realm/aiDriver.js` | All GPT-5.4-mini calls for realm | ~150 |
| `features/realm/realmStore.js` | SQLite operations, cascade delete, leaderboard | ~180 |
| `features/realm/realmConfig.js` | Constants, templates, stat tables | ~80 |
| `features/realm/realmRateLimit.js` | Realm-specific AI call budget (per-user + per-guild daily) | ~60 |

Total: ~12 files, ~1380 lines.

### [S15b] Modified Files

| File | Change |
|------|--------|
| `db/skarn-schema.sql` | Append realm tables, all guild-scoped, with indexes (DO NOT touch existing) |
| `persona/roles.js` | Add `realm`, `realm_combat`, `realm_npc` roles + token budgets |
| `bot.js` | Import and register realm command |
| `commands/help.js` | Add realm commands to help text |
| `.env` / README | Document `REALM_DAILY_CALL_LIMIT` |

## [S16] Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| AI response latency | < 3 seconds | GPT-5.4-mini typical; `deferReply()` covers spikes |
| Exploration turn | < 5 seconds total | AI call + SQLite write + embed build |
| Character creation | < 15 seconds total | 3-4 AI calls across steps |
| SQLite write | < 50ms | Local file, no network |
| Concurrent players | 20+ per guild | In-memory Maps bounded; SQLite handles concurrent writes; double-submit guard per [S5b] prevents same-user races |
| Daily AI budget | ~500 calls/guild typical, hard-capped at `REALM_DAILY_CALL_LIMIT` (default 1000) | 20 players × 25 calls/session avg, with headroom to the cap |

### [S16a] Observability

- Log every AI call: userId, guildId, role, token count, latency (ms) — to `console.log` with `[REALM]` prefix
- Log combat outcomes: player, enemy, result (win/loss/timeout-penalty), XP/gold awarded
- Log trade completions: both players, items transferred, gold exchanged
- Log errors with full context: function name, userId, guildId, error message
- Log when the per-guild daily AI budget is hit — this is an operational signal worth seeing
- No user message content logged (privacy — only metadata)

## [S17] Out of Scope (v1)

- Crafting system
- Guilds / factions with political mechanics
- Real-time multiplayer (party system)
- PvP combat
- Character appearance customization
- Pet/companion system
- Housing / base building
- Seasonal events
- Voice channel integration
- Rumor system for discovered locations (cut — needs its own design pass)

## [S18] Verification

1. `/realm create` — complete character creation flow, verify character saved to SQLite with correct `(user_id, guild_id)` key
2. `/realm start` — explore from starting location, verify 3-4 choices appear (and that fewer AI-returned options render fewer buttons, not padded ones)
3. `/realm explore` — make choices, verify world state updates and inventory changes
4. `/realm stats` — verify stats match character creation
5. `/realm inventory` — verify items from exploration/combat appear; verify pagination kicks in past 25 items
6. Combat encounter — verify HP tracking, damage calculation, XP/gold awards, and that player HP is persisted after each round (kill the bot process mid-fight and confirm HP on restart matches the last resolved round, not pre-fight HP)
7. Combat timeout — let a fight's interaction collector expire without fleeing; verify the 10% gold penalty applies and no XP/loot is granted
8. `/realm quests` — verify quest acceptance, objective tracking, completion
9. Level up — verify stat increases, channel notification; verify XP earned past level 20 converts to gold instead of vanishing
10. `/realm rest` — verify HP restoration
11. `/realm trade @player` — verify item transfer between characters; verify `/realm trade @self` is rejected
12. Bot restart — verify character, inventory, quests, location all persist
13. `/realm leaderboard` — verify ranking by level, and that it only shows characters from the current guild
14. `/realm delete` — verify character AND all associated rows (inventory, quests, discovered locations, kill log, NPC memory) are removed, with confirmation prompt
15. AI failure — verify graceful error message, no crash
16. Interaction timeout (non-combat) — verify scene lost gracefully, resume works
17. Realm rate limit — play past 30 calls in 30 minutes as one user, verify the Realm-specific throttle message appears (not the general bot rate-limit message)
18. Per-guild daily budget — set `REALM_DAILY_CALL_LIMIT` low in a test environment, exceed it, verify AI actions are blocked guild-wide while `/realm stats`/`/realm inventory` still work
19. NPC hostility — drive an NPC relationship to the `hostile` threshold, verify the merchant refuses trade and the next interaction triggers combat rather than dialogue
20. Double-submit — rapidly double-click an exploration/combat button, verify only one action resolves and the second click gets the "still resolving" message, with no duplicated damage/XP/items
