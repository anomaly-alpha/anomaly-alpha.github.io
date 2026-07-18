# Realm of Skarn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent AI-driven RPG where players create characters, explore a living world, fight enemies, complete quests, and trade items — all narrated by GPT-5.4-mini through Skarn's voice.

**Architecture:** 12 new files under `features/realm/`, 4 modified files. SQLite for persistence (7 new tables, guild-scoped). In-memory Maps for ephemeral session state (scene history, combat state, processing guards). Separate rate-limit bucket for realm AI calls.

**Tech Stack:** Discord.js v14, better-sqlite3, OpenAI API (GPT-5.4-mini), Node.js 18+

## Global Constraints

- All AI calls use `max_completion_tokens` (not `max_tokens`) — GPT-5.4-mini requirement
- All replies use `flags: 64` (not `ephemeral: true`) — Discord.js v15 deprecation
- SQLite schema changes APPEND ONLY — never modify existing tables
- All realm functions take `(userId, guildId)` — guild-scoped by default
- No `fetch()` — all data from inline JSON or SQLite
- No JSDoc — section headers only
- Temperature: exploration 0.8, combat 0.7, NPC 0.8

---

## Task 1: Database Schema + realmStore.js

**Covers:** [S11a, S11b, S11c]

**Files:**
- Modify: `db/skarn-schema.sql` (append 7 tables + 5 indexes)
- Create: `features/realm/realmStore.js`

**Interfaces:**
- Consumes: `db/database.js` (existing `db` export)
- Produces: `realmStore.js` exporting all realm CRUD functions

- [ ] **Step 1: Append realm tables to schema**

Append the following to `db/skarn-schema.sql` (DO NOT touch existing tables):

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
  stats TEXT,
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
  objectives TEXT NOT NULL,
  rewards TEXT,
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
  sentiment INTEGER NOT NULL DEFAULT 0,
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

- [ ] **Step 2: Create realmStore.js with all CRUD functions**

Create `features/realm/realmStore.js`:

```js
const { db } = require('../../db/database');

// ===== Characters =====

function getCharacter(userId, guildId) {
  return db.prepare('SELECT * FROM realm_characters WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function saveCharacter(userId, guildId, data) {
  const existing = getCharacter(userId, guildId);
  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    values.push(userId, guildId);
    db.prepare(`UPDATE realm_characters SET ${sets}, updated_at = ? WHERE user_id = ? AND guild_id = ?`).run(...values, Date.now());
  } else {
    const cols = ['user_id', 'guild_id', ...Object.keys(data), 'created_at', 'updated_at'];
    const placeholders = cols.map(() => '?').join(', ');
    const values = [userId, guildId, ...Object.values(data), Date.now(), Date.now()];
    db.prepare(`INSERT INTO realm_characters (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
  }
}

function deleteCharacterCascade(userId, guildId) {
  const del = db.prepare('DELETE FROM');
  db.transaction(() => {
    del.run(`realm_characters WHERE user_id = ? AND guild_id = ?`, userId, guildId);
    del.run(`realm_inventory WHERE user_id = ? AND guild_id = ?`, userId, guildId);
    del.run(`realm_quests WHERE user_id = ? AND guild_id = ?`, userId, guildId);
    del.run(`realm_discovered_locations WHERE user_id = ? AND guild_id = ?`, userId, guildId);
    del.run(`realm_kill_log WHERE user_id = ? AND guild_id = ?`, userId, guildId);
    del.run(`realm_npc_memory WHERE user_id = ? AND guild_id = ?`, userId, guildId);
  })();
}

// ===== Inventory =====

function getInventory(userId, guildId) {
  return db.prepare('SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC').all(userId, guildId);
}

function addItem(userId, guildId, item) {
  db.prepare(
    'INSERT INTO realm_inventory (user_id, guild_id, item_id, name, type, description, rarity, stats, value, equipped, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, item.id, item.name, item.type, item.description || null, item.rarity || 'common', JSON.stringify(item.stats || {}), item.value || 0, item.equipped ? 1 : 0, Date.now());
}

function removeItem(userId, guildId, itemId) {
  db.prepare('DELETE FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, itemId);
}

function equipItem(userId, guildId, itemId) {
  const item = db.prepare('SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, itemId);
  if (!item) return null;
  if (item.type === 'weapon' || item.type === 'armor') {
    db.prepare('UPDATE realm_inventory SET equipped = 0 WHERE user_id = ? AND guild_id = ? AND type = ?').run(userId, guildId, item.type);
  }
  db.prepare('UPDATE realm_inventory SET equipped = 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, itemId);
  return item;
}

// ===== Quests =====

function getActiveQuests(userId, guildId) {
  return db.prepare("SELECT * FROM realm_quests WHERE user_id = ? AND guild_id = ? AND status = 'active'").all(userId, guildId);
}

function addQuest(userId, guildId, quest) {
  db.prepare(
    'INSERT INTO realm_quests (user_id, guild_id, quest_id, title, description, giver_npc, objectives, rewards, status, chain_next, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, quest.id, quest.title, quest.description || null, quest.giver_npc || null, JSON.stringify(quest.objectives), JSON.stringify(quest.rewards || {}), quest.status || 'active', quest.chain_next || null, Date.now(), Date.now());
}

function updateQuest(userId, guildId, questId, patch) {
  const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
  const values = Object.values(patch);
  values.push(userId, guildId, questId);
  db.prepare(`UPDATE realm_quests SET ${sets}, updated_at = ? WHERE user_id = ? AND guild_id = ? AND quest_id = ?`).run(...values, Date.now());
}

// ===== NPC Memory =====

function addNpcMemory(npcId, userId, guildId, type, summary, sentiment) {
  db.prepare(
    'INSERT INTO realm_npc_memory (npc_id, user_id, guild_id, interaction_type, summary, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(npcId, userId, guildId, type, summary, sentiment || 0, Date.now());
}

function getNpcMemory(npcId, userId, guildId, limit = 5) {
  return db.prepare(
    'SELECT * FROM realm_npc_memory WHERE npc_id = ? AND user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(npcId, userId, guildId, limit);
}

function getNpcRelationship(npcId, userId, guildId) {
  const memories = getNpcMemory(npcId, userId, guildId, 5);
  if (memories.length === 0) return 'neutral';
  const avg = memories.reduce((sum, m) => sum + m.sentiment, 0) / memories.length;
  if (avg >= 2) return 'friendly';
  if (avg <= -2) return 'hostile';
  return 'neutral';
}

// ===== Discovery =====

function discoveredLocation(userId, guildId, locationId) {
  db.prepare(
    'INSERT OR IGNORE INTO realm_discovered_locations (user_id, guild_id, location_id, discovered_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, locationId, Date.now());
}

function getDiscoveredLocations(userId, guildId) {
  return db.prepare(
    'SELECT location_id FROM realm_discovered_locations WHERE user_id = ? AND guild_id = ?'
  ).all(userId, guildId).map(r => r.location_id);
}

// ===== Kill Log =====

function logKill(userId, guildId, enemy) {
  db.prepare(
    'INSERT INTO realm_kill_log (user_id, guild_id, enemy_name, enemy_level, location, xp_earned, gold_earned, killed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, enemy.name, enemy.level, enemy.location, enemy.xp, enemy.gold, Date.now());
}

function getKillStats(userId, guildId) {
  return db.prepare(
    'SELECT COUNT(*) as kills, SUM(xp_earned) as totalXp, SUM(gold_earned) as totalGold FROM realm_kill_log WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
}

// ===== World State =====

function getWorldState(key, guildId) {
  const row = db.prepare('SELECT value FROM realm_world_state WHERE key = ? AND guild_id = ?').get(key, guildId);
  return row ? row.value : null;
}

function setWorldState(key, guildId, value) {
  db.prepare(
    'INSERT OR REPLACE INTO realm_world_state (key, guild_id, value, updated_at) VALUES (?, ?, ?, ?)'
  ).run(key, guildId, value, Date.now());
}

// ===== Leaderboard =====

function getLeaderboard(guildId, limit = 10) {
  return db.prepare(
    'SELECT name, race, class, level, xp FROM realm_characters WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT ?'
  ).all(guildId, limit);
}

module.exports = {
  getCharacter, saveCharacter, deleteCharacterCascade,
  getInventory, addItem, removeItem, equipItem,
  getActiveQuests, addQuest, updateQuest,
  addNpcMemory, getNpcMemory, getNpcRelationship,
  discoveredLocation, getDiscoveredLocations,
  logKill, getKillStats,
  getWorldState, setWorldState,
  getLeaderboard,
};
```

- [ ] **Step 3: Verify schema loads without errors**

Run: `node -e "require('./db/database'); console.log('Schema OK')"` from `skarn-bot/`
Expected: `Schema OK` (no errors, tables created)

- [ ] **Step 4: Verify realmStore functions work**

Run from `skarn-bot/`:
```bash
node -e "
const s = require('./features/realm/realmStore');
s.saveCharacter('test1', 'guild1', { name: 'Kael', race: 'Human', class: 'Warrior', hp_current: 50, hp_max: 50, strength: 13, dexterity: 9, intelligence: 7, constitution: 11, wisdom: 8, charisma: 8, luck: 5 });
const c = s.getCharacter('test1', 'guild1');
console.log('Character:', c.name, c.race, c.class);
s.deleteCharacterCascade('test1', 'guild1');
console.log('Deleted:', s.getCharacter('test1', 'guild1'));
"
```
Expected: `Character: Kael Human Warrior` then `Deleted: undefined`

- [ ] **Step 5: Commit**

```bash
git add db/skarn-schema.sql features/realm/realmStore.js
git commit -m "feat(realm): add SQLite schema and realmStore CRUD module"
```

---

## Task 2: realmConfig.js + realmRateLimit.js

**Covers:** [S2, S4b, S5a, S7b1, S12f]

**Files:**
- Create: `features/realm/realmConfig.js`
- Create: `features/realm/realmRateLimit.js`

**Interfaces:**
- Consumes: (none — pure data modules)
- Produces: `realmConfig` (locations, race/class stats, item pools, enemy templates), `realmRateLimit` (canCall, recordCall, getGuildDailyCount, incrementGuildDaily)

- [ ] **Step 1: Create realmConfig.js**

Create `features/realm/realmConfig.js`:

```js
// ===== Race Bonuses =====
const RACE_BONUSES = {
  Human:     { strength: 1, dexterity: 1, intelligence: 1, constitution: 1, wisdom: 1, charisma: 1 },
  Elf:       { dexterity: 3, intelligence: 2 },
  Dwarf:     { constitution: 3, strength: 2 },
  Demon:     { strength: 3, charisma: 2, wisdom: -1 },
  Tiefling:  { charisma: 3, intelligence: 2 },
  Dragonborn:{ strength: 2, constitution: 2, charisma: 1 },
};

// ===== Class Base Stats =====
const CLASS_STATS = {
  Warrior:  { strength: 12, dexterity: 8, intelligence: 6, constitution: 10, wisdom: 7, charisma: 7, primary: 'strength', secondary: 'constitution' },
  Mage:     { strength: 6, dexterity: 7, intelligence: 12, constitution: 7, wisdom: 10, charisma: 8, primary: 'intelligence', secondary: 'wisdom' },
  Rogue:    { strength: 8, dexterity: 12, intelligence: 7, constitution: 8, wisdom: 7, charisma: 8, primary: 'dexterity', secondary: 'charisma' },
  Cleric:   { strength: 8, dexterity: 7, intelligence: 7, constitution: 10, wisdom: 12, charisma: 6, primary: 'wisdom', secondary: 'constitution' },
  Ranger:   { strength: 9, dexterity: 11, intelligence: 7, constitution: 9, wisdom: 9, charisma: 5, primary: 'dexterity', secondary: 'wisdom' },
  Warlock:  { strength: 7, dexterity: 8, intelligence: 10, constitution: 7, wisdom: 8, charisma: 10, primary: 'intelligence', secondary: 'charisma' },
};

// ===== Locations =====
const LOCATIONS = {
  abyssal_gate: {
    name: 'The Abyssal Gate',
    description: 'A massive obsidian archway humming with residual energy. This is where all journeys begin.',
    connections: ['shadow_market'],
    dangerLevel: 1,
    npcPool: ['gatekeeper'],
  },
  shadow_market: {
    name: 'Shadow Market',
    description: 'A bustling underground bazaar. Stalls glow with enchanted wares and whispered deals.',
    connections: ['abyssal_gate', 'cursed_library', 'bone_arena'],
    dangerLevel: 2,
    npcPool: ['merchant', 'pickpocket', 'quest_giver'],
  },
  cursed_library: {
    name: 'Cursed Library',
    description: 'Towering shelves of forbidden texts. The pages whisper when you turn them.',
    connections: ['shadow_market', 'whispering_woods'],
    dangerLevel: 2,
    npcPool: ['librarian', 'scholar'],
  },
  bone_arena: {
    name: 'Bone Arena',
    description: 'A colosseum of bleached bone. The crowd roars for blood.',
    connections: ['shadow_market', 'obsidian_mines'],
    dangerLevel: 4,
    npcPool: ['arena_master', 'gladiator'],
  },
  whispering_woods: {
    name: 'Whispering Woods',
    description: 'Ancient trees whose leaves speak in tongues long dead.',
    connections: ['cursed_library', 'ruined_temple'],
    dangerLevel: 3,
    npcPool: ['hermit', 'dryad'],
  },
  obsidian_mines: {
    name: 'Obsidian Mines',
    description: 'Shafts of volcanic glass stretch into darkness. Something moves deeper in.',
    connections: ['bone_arena', 'dragons_maw'],
    dangerLevel: 4,
    npcPool: ['miner', 'ghost'],
  },
  ruined_temple: {
    name: 'Ruined Temple',
    description: 'Crumbling columns frame a shattered altar. Old power lingers here.',
    connections: ['whispering_woods', 'dragons_maw'],
    dangerLevel: 3,
    npcPool: ['priest', 'cultist'],
  },
  dragons_maw: {
    name: "Dragon's Maw",
    description: 'A cavern shaped like a gaping maw. Heat radiates from within.',
    connections: ['obsidian_mines', 'ruined_temple'],
    dangerLevel: 5,
    npcPool: ['dragon_wraith'],
  },
};

// ===== Item Templates =====
const ITEM_TEMPLATES = {
  weapon: {
    common:    [{ name: 'Rusty Sword', stats: { attack: 3 }, value: 20 }],
    uncommon:  [{ name: 'Iron Blade', stats: { attack: 5 }, value: 60 }],
    rare:      [{ name: 'Shadow Blade', stats: { attack: 8 }, value: 150 }],
    epic:      [{ name: 'Void Cleaver', stats: { attack: 12 }, value: 350 }],
    legendary: [{ name: 'Mjolnir', stats: { attack: 18 }, value: 800 }],
  },
  armor: {
    common:    [{ name: 'Leather Vest', stats: { defense: 2 }, value: 15 }],
    uncommon:  [{ name: 'Chainmail', stats: { defense: 4 }, value: 50 }],
    rare:      [{ name: 'Dragon Scale', stats: { defense: 7 }, value: 130 }],
    epic:      [{ name: 'Void Plate', stats: { defense: 10 }, value: 300 }],
    legendary: [{ name: 'Aegis of the Abyss', stats: { defense: 15 }, value: 700 }],
  },
  consumable: {
    common:    [{ name: 'Health Potion', stats: { heal: 20 }, value: 10 }],
    uncommon:  [{ name: 'Elixir of Strength', stats: { buff_attack: 3, duration: 3 }, value: 40 }],
    rare:      [{ name: 'Scroll of Fireball', stats: { damage: 25 }, value: 100 }],
  },
};

const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 };

// ===== Enemy Templates =====
const ENEMY_SCALING = {
  1: { name: 'Shadow Rat', baseHp: 15, baseAttack: 3, baseDefense: 1 },
  2: { name: 'Cursed Specter', baseHp: 25, baseAttack: 5, baseDefense: 2 },
  3: { name: 'Bone Golem', baseHp: 40, baseAttack: 8, baseDefense: 5 },
  4: { name: 'Void Wraith', baseHp: 55, baseAttack: 11, baseDefense: 7 },
  5: { name: 'Abyssal Dragon', baseHp: 80, baseAttack: 15, baseDefense: 10 },
};

// ===== XP / Leveling =====
function xpForLevel(level) {
  return level * 100 + 50;
}

function hpForLevel(con, level) {
  return 20 + (con * 5) + (level * 3);
}

// ===== Helper: weighted random rarity =====
function rollRarity() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

module.exports = {
  RACE_BONUSES, CLASS_STATS, LOCATIONS, ITEM_TEMPLATES, RARITY_WEIGHTS,
  ENEMY_SCALING, xpForLevel, hpForLevel, rollRarity,
};
```

- [ ] **Step 2: Create realmRateLimit.js**

Create `features/realm/realmRateLimit.js`:

```js
// Realm-specific rate limiter. Separate from the bot-wide 10-calls/10min bucket.
// 30 realm AI calls per rolling 30-minute window per user.

const WINDOW_MS = 30 * 60 * 1000;
const MAX_CALLS = 30;
const calls = new Map(); // userId -> timestamp[]

function canCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  const recent = userCalls.filter(t => now - t < WINDOW_MS);
  if (recent.length === 0) {
    calls.delete(userId);
  } else {
    calls.set(userId, recent);
  }
  return recent.length < MAX_CALLS;
}

function recordCall(userId) {
  const now = Date.now();
  const userCalls = calls.get(userId) || [];
  userCalls.push(now);
  calls.set(userId, userCalls);
}

// Per-guild daily counter (stored in realm_world_state)
const { getWorldState, setWorldState } = require('./realmStore');

function getGuildDailyCount(guildId) {
  const val = getWorldState('daily_ai_calls', guildId);
  return val ? parseInt(val, 10) : 0;
}

function incrementGuildDaily(guildId) {
  const today = new Date().toISOString().slice(0, 10);
  const stored = getWorldState('daily_ai_calls_date', guildId);
  if (stored !== today) {
    setWorldState('daily_ai_calls_date', guildId, today);
    setWorldState('daily_ai_calls', guildId, '1');
    return 1;
  }
  const count = getGuildDailyCount(guildId) + 1;
  setWorldState('daily_ai_calls', guildId, String(count));
  return count;
}

const DAILY_LIMIT = parseInt(process.env.REALM_DAILY_CALL_LIMIT, 10) || 1000;

function canGuildCall(guildId) {
  const today = new Date().toISOString().slice(0, 10);
  const stored = getWorldState('daily_ai_calls_date', guildId);
  if (stored !== today) return true;
  return getGuildDailyCount(guildId) < DAILY_LIMIT;
}

module.exports = { canCall, recordCall, getGuildDailyCount, incrementGuildDaily, canGuildCall };
```

- [ ] **Step 3: Verify config loads**

Run: `node -e "const c = require('./features/realm/realmConfig'); console.log('Locations:', Object.keys(c.LOCATIONS).length); console.log('Classes:', Object.keys(c.CLASS_STATS).length)"`
Expected: `Locations: 8` and `Classes: 6`

- [ ] **Step 4: Verify rate limiter**

Run: `node -e "const r = require('./features/realm/realmRateLimit'); console.log('Can call:', r.canCall('test1')); r.recordCall('test1'); console.log('After record:', r.canCall('test1'))"`
Expected: `Can call: true` then `After record: true`

- [ ] **Step 5: Commit**

```bash
git add features/realm/realmConfig.js features/realm/realmRateLimit.js
git commit -m "feat(realm): add config constants and realm-specific rate limiter"
```

---

## Task 3: Persona Roles + bot.js Wiring

**Covers:** [S12a, S12b, S3]

**Files:**
- Modify: `persona/roles.js` (add 3 roles + 3 token budgets)
- Modify: `bot.js` (import realm command)

**Interfaces:**
- Consumes: existing `roles` and `roleTokenBudgets` objects
- Produces: updated `roles.realm`, `roles.realm_combat`, `roles.realm_npc` + budgets

- [ ] **Step 1: Add realm roles to persona/roles.js**

Add to the `roles` object in `persona/roles.js`:

```js
realm: "You are Skarn, the Dungeon Master of the Realm. Narrate the world in your voice — ancient, witty, observational. Every NPC speaks with distinct personality. Combat is fast and tactical. End every scene with clear choices. The world remembers what players do. Keep tone in the register of fantasy adventure fiction — no gratuitous gore, no romance or dating-style content.",
realm_combat: "You are Skarn narrating combat. Fast, tactical, no filler. One exchange per turn. Give 3-4 options. End with a clear choice. Damage and outcomes are determined by stats, not narrative convenience. Fantasy violence only — no gratuitous gore.",
realm_npc: "You are an NPC in the Realm. Speak with a distinct personality. Remember past interactions with this player. Keep dialogue under 100 words. End with 2-4 response options for the player.",
```

Add to the `roleTokenBudgets` object:

```js
realm: 700,
realm_combat: 700,
realm_npc: 600,
```

- [ ] **Step 2: Wire realm command into bot.js**

In `bot.js`, the existing command loading loop already picks up all files in `commands/`. The `/realm` command will live in `commands/realm.js` (not `features/realm/`) — but since the slash command definition must be in `commands/`, we need a thin wrapper.

Create `commands/realm.js`:

```js
const { SlashCommandBuilder } = require('discord.js');
const { execute: realmExecute } = require('../features/realm/realmCommand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('realm')
    .setDescription('Realm of Skarn — persistent AI RPG')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a new character'))
    .addSubcommand(sub => sub.setName('start').setDescription('Begin exploring the Realm'))
    .addSubcommand(sub => sub.setName('explore').setDescription('Continue exploring'))
    .addSubcommand(sub => sub.setName('stats').setDescription('View character sheet'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('View inventory'))
    .addSubcommand(sub => sub.setName('quests').setDescription('View active quests'))
    .addSubcommand(sub => sub.setName('rest').setDescription('Rest and heal'))
    .addSubcommand(sub => sub.setName('trade').setDescription('Trade with another player')
      .addUserOption(opt => opt.setName('player').setDescription('Player to trade with').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete your character'))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Top characters'))
    .addSubcommand(sub => sub.setName('help').setDescription('Realm commands and tips')),
  async execute(interaction) {
    await realmExecute(interaction);
  },
};
```

- [ ] **Step 3: Verify roles load**

Run: `node -e "const { roles, roleTokenBudgets } = require('./persona/roles'); console.log('realm role:', !!roles.realm); console.log('realm budget:', roleTokenBudgets.realm)"`
Expected: `realm role: true` and `realm budget: 700`

- [ ] **Step 4: Verify realm command registers**

Run: `node -e "const cmd = require('./commands/realm'); console.log('Name:', cmd.data.name); console.log('Subcommands:', cmd.data.options.length)"`
Expected: `Name: realm` and `Subcommands: 11`

- [ ] **Step 5: Commit**

```bash
git add persona/roles.js commands/realm.js
git commit -m "feat(realm): add persona roles and wire /realm command"
```

---

## Task 4: Character System

**Covers:** [S4a, S4b, S4c, S4d]

**Files:**
- Create: `features/realm/character.js`

**Interfaces:**
- Consumes: `realmStore` (getCharacter, saveCharacter), `realmConfig` (RACE_BONUSES, CLASS_STATS, hpForLevel, xpForLevel), `realmRateLimit` (canCall, recordCall)
- Produces: `createCharacter`, `getCharacterSheet`, `addXp`, `levelUp`, `heal`

- [ ] **Step 1: Create character.js**

Create `features/realm/character.js`:

```js
const { RACE_BONUSES, CLASS_STATS, hpForLevel, xpForLevel } = require('./realmConfig');
const realmStore = require('./realmStore');

function createCharacter(userId, guildId, name, race, cls, backstory) {
  const classStats = CLASS_STATS[cls];
  const raceBonus = RACE_BONUSES[race] || {};
  const stats = {};
  for (const stat of ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom', 'charisma']) {
    stats[stat] = (classStats[stat] || 0) + (raceBonus[stat] || 0);
  }
  stats.luck = Math.floor(Math.random() * 10) + 1;
  const hpMax = hpForLevel(stats.constitution, 1);

  const data = {
    name, race, class: cls, backstory,
    level: 1, xp: 0,
    hp_current: hpMax, hp_max: hpMax,
    ...stats,
    gold: 50, current_location: 'abyssal_gate',
  };

  realmStore.saveCharacter(userId, guildId, data);
  return data;
}

function getCharacterSheet(userId, guildId) {
  return realmStore.getCharacter(userId, guildId);
}

function addXp(userId, guildId, amount) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return { leveled: false };

  let xp = char.xp + amount;
  let level = char.level;
  let hpMax = char.hp_max;
  let primaryStat = CLASS_STATS[char.class]?.primary;
  let secondaryStat = CLASS_STATS[char.class]?.secondary;
  let leveled = false;

  while (level < 20 && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    hpMax += 2;
    if (primaryStat) char[primaryStat] = (char[primaryStat] || 0) + 1;
    if (secondaryStat) char[secondaryStat] = (char[secondaryStat] || 0) + 1;
    leveled = true;
  }

  // XP overflow at max level → gold
  let goldBonus = 0;
  if (level >= 20 && xp > 0) {
    goldBonus = xp;
    xp = 0;
  }

  const patch = { xp, level, hp_max: hpMax, gold: char.gold + goldBonus };
  if (primaryStat) patch[primaryStat] = char[primaryStat];
  if (secondaryStat) patch[secondaryStat] = char[secondaryStat];
  realmStore.saveCharacter(userId, guildId, patch);

  return { leveled, level, goldBonus, hpMax };
}

function heal(userId, guildId, percent = 0.25) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return null;
  const healAmount = Math.floor(char.hp_max * percent);
  const newHp = Math.min(char.hp_current + healAmount, char.hp_max);
  realmStore.saveCharacter(userId, guildId, { hp_current: newHp });
  return { healed: healAmount, hp_current: newHp, hp_max: char.hp_max };
}

module.exports = { createCharacter, getCharacterSheet, addXp, heal };
```

- [ ] **Step 2: Verify character creation**

Run from `skarn-bot/`:
```bash
node -e "
const { createCharacter, getCharacterSheet, addXp, heal } = require('./features/realm/character');
const s = require('./features/realm/realmStore');
createCharacter('u1', 'g1', 'Kael', 'Human', 'Warrior', 'A soldier seeking redemption.');
const c = getCharacterSheet('u1', 'g1');
console.log('Created:', c.name, c.race, c.class, 'HP:', c.hp_current + '/' + c.hp_max, 'STR:', c.strength);
const lvl = addXp('u1', 'g1', 200);
console.log('After 200xp:', lvl);
const h = heal('u1', 'g1');
console.log('After rest:', h);
s.deleteCharacterCascade('u1', 'g1');
"
```
Expected: Character created with correct stats, XP awards work, healing works, cleanup succeeds

- [ ] **Step 3: Commit**

```bash
git add features/realm/character.js
git commit -m "feat(realm): add character creation, stats, leveling, healing"
```

---

## Task 5: World System + AI Driver

**Covers:** [S5a, S5b, S5c, S12c, S12d]

**Files:**
- Create: `features/realm/world.js`
- Create: `features/realm/aiDriver.js`

**Interfaces:**
- Consumes: `realmConfig` (LOCATIONS), `realmStore` (getCharacter, saveCharacter, discoveredLocation, getDiscoveredLocations)
- Produces: `getLocation`, `getConnectedLocations`, `moveTo`, `parseChoices`, `buildExplorationPrompt`, `buildCombatPrompt`, `buildNpcPrompt`, `generateBackstory`

- [ ] **Step 1: Create world.js**

Create `features/realm/world.js`:

```js
const { LOCATIONS } = require('./realmConfig');
const realmStore = require('./realmStore');

function getLocation(locationId) {
  return LOCATIONS[locationId] || null;
}

function getConnectedLocations(locationId) {
  const loc = LOCATIONS[locationId];
  if (!loc) return [];
  return loc.connections.map(id => ({ id, ...LOCATIONS[id] })).filter(l => l.name);
}

function moveTo(userId, guildId, locationId) {
  const loc = LOCATIONS[locationId];
  if (!loc) return null;
  realmStore.saveCharacter(userId, guildId, { current_location: locationId });
  realmStore.discoveredLocation(userId, guildId, locationId);
  return loc;
}

function parseChoices(aiText) {
  const lines = aiText.split('\n').filter(l => /^\d+\.\s/.test(l.trim()));
  return lines.map(l => l.replace(/^\d+\.\s*/, '').trim());
}

module.exports = { getLocation, getConnectedLocations, moveTo, parseChoices };
```

- [ ] **Step 2: Create aiDriver.js**

Create `features/realm/aiDriver.js`:

```js
const getOpenAIClient = require('../../ai/client');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');

const AI_ERRORS = [
  'The realm shudders... try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

function buildContextPrompt(character, location, quest, npcMemory, history) {
  const parts = [];
  parts.push(`Character: ${character.name} the ${character.race} ${character.class}, Level ${character.level}, HP ${character.hp_current}/${character.hp_max}`);
  parts.push(`Stats: STR ${character.strength}, DEX ${character.dexterity}, INT ${character.intelligence}, CON ${character.constitution}, WIS ${character.wisdom}, CHA ${character.charisma}, Luck ${character.luck}`);
  parts.push(`Gold: ${character.gold}`);
  if (location) parts.push(`Location: ${location.name} — ${location.description} (Danger: ${location.dangerLevel}/5)`);
  if (quest) parts.push(`Active quest: ${quest.title} — ${quest.description}`);
  if (npcMemory && npcMemory.length > 0) parts.push(`NPC memory: ${npcMemory.map(m => m.summary).join('; ')}`);
  if (history && history.length > 0) parts.push(`Recent: ${history.join(' → ')}`);
  return parts.join('\n');
}

async function callAi(role, contextPrompt, userMessage, temperature = 0.8) {
  const openai = getOpenAIClient();
  const systemPrompt = buildSystemPrompt({ roleLine: roles[role], stateLine: '', memoryLine: '' });
  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL || 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contextPrompt + '\n\n' + userMessage },
    ],
    max_completion_tokens: roleTokenBudgets[role] || 500,
    temperature,
  });
  return completion.choices[0].message.content;
}

async function generateBackstory(character, answer) {
  const prompt = `Generate a 2-3 paragraph backstory for a ${character.race} ${character.class} named ${character.name}. Their answer to your question: "${answer}". Write in Skarn's voice — ancient, witty, observational.`;
  return await callAi('realm', '', prompt, 0.85);
}

async function generateExploration(character, location, quest, history) {
  const ctx = buildContextPrompt(character, location, quest, null, history);
  const prompt = `You are narrating exploration of ${location.name}. Give 3-4 possible actions as numbered choices. Include at least one movement option to an adjacent location.`;
  return await callAi('realm', ctx, prompt, 0.8);
}

async function generateCombatNarration(character, enemy, playerAction, damage, enemyHp, history) {
  const ctx = buildContextPrompt(character, null, null, null, history);
  const prompt = `Combat round. Player used: ${playerAction}. You dealt ${damage} damage. Enemy has ${enemyHp} HP remaining.\n\nEnemy: ${enemy.name}, HP ${enemy.hp_current}/${enemy.hp_max}, ATK ${enemy.attack}, DEF ${enemy.defense}\n\nGive 3-4 tactical options. End with a clear choice.`;
  return await callAi('realm_combat', ctx, prompt, 0.7);
}

async function generateNpcDialogue(npc, character, npcMemory) {
  const ctx = buildContextPrompt(character, null, null, npcMemory, null);
  const prompt = `You are ${npc.name}, a ${npc.personality} ${npc.role} at ${npc.location}. Speak with distinct personality. Give 2-4 response options for the player.`;
  return await callAi('realm_npc', ctx, prompt, 0.8);
}

async function generateQuestHook(npc, character, location) {
  const ctx = buildContextPrompt(character, location, null, null, null);
  const prompt = `You are ${npc.name}, a ${npc.role}. Generate a quest hook for this player. Include: title, 2-3 sentence description, and objectives. Format as numbered list.`;
  return await callAi('realm', ctx, prompt, 0.8);
}

module.exports = {
  buildContextPrompt, callAi, generateBackstory, generateExploration,
  generateCombatNarration, generateNpcDialogue, generateQuestHook, AI_ERRORS,
};
```

- [ ] **Step 3: Verify world.js**

Run: `node -e "const w = require('./features/realm/world'); console.log('Gate:', w.getLocation('abyssal_gate').name); console.log('Connected:', w.getConnectedLocations('shadow_market').map(l => l.name))"`
Expected: `Gate: The Abyssal Gate` and `Connected: [ 'The Abyssal Gate', 'Cursed Library', 'Bone Arena' ]`

- [ ] **Step 4: Verify parseChoices**

Run: `node -e "const w = require('./features/realm/world'); const choices = w.parseChoices('The market bustles.\n1. Approach the merchant\n2. Head to the arena\n3. Search the alleys'); console.log(choices)"`
Expected: `['Approach the merchant', 'Head to the arena', 'Search the alleys']`

- [ ] **Step 5: Commit**

```bash
git add features/realm/world.js features/realm/aiDriver.js
git commit -m "feat(realm): add world system and AI driver for all GPT-5.4-mini calls"
```

---

## Task 6: NPC System

**Covers:** [S6a, S6b, S6c]

**Files:**
- Create: `features/realm/npc.js`

**Interfaces:**
- Consumes: `realmStore` (addNpcMemory, getNpcMemory, getNpcRelationship), `aiDriver` (generateNpcDialogue)
- Produces: `generateNpc`, `handleNpcInteraction`, `getNpcRelationship`

- [ ] **Step 1: Create npc.js**

Create `features/realm/npc.js`:

```js
const realmStore = require('./realmStore');
const aiDriver = require('./aiDriver');

const PERSONALITIES = ['sardonic', 'warm', 'mysterious', 'gruff', 'cheerful', 'melancholy', 'cunning', 'pious'];

function generateNpc(npcId, locationId) {
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  return {
    id: npcId,
    name: npcId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    role: 'neutral',
    location: locationId,
    personality,
  };
}

async function handleNpcInteraction(userId, guildId, npc, character, playerChoice) {
  const memory = realmStore.getNpcMemory(npc.id, userId, guildId, 5);
  const relationship = realmStore.getNpcRelationship(npc.id, userId, guildId);

  if (relationship === 'hostile' && npc.role !== 'enemy') {
    npc.role = 'enemy';
  }

  const dialogue = await aiDriver.generateNpcDialogue(npc, character, memory);

  let sentiment = 0;
  if (playerChoice.toLowerCase().includes('thank') || playerChoice.toLowerCase().includes('help')) sentiment = 2;
  else if (playerChoice.toLowerCase().includes('threaten') || playerChoice.toLowerCase().includes('attack')) sentiment = -3;
  else if (playerChoice.toLowerCase().includes('buy') || playerChoice.toLowerCase().includes('trade')) sentiment = 1;

  realmStore.addNpcMemory(npc.id, userId, guildId, 'dialogue', `Player said: ${playerChoice.substring(0, 100)}`, sentiment);

  return { dialogue, relationship };
}

module.exports = { generateNpc, handleNpcInteraction };
```

- [ ] **Step 2: Verify NPC generation and memory**

Run: `node -e "
const { generateNpc } = require('./features/realm/npc');
const npc = generateNpc('npc_shadow_merchant', 'shadow_market');
console.log('NPC:', npc.name, npc.personality);
const s = require('./features/realm/realmStore');
s.addNpcMemory(npc.id, 'u1', 'g1', 'dialogue', 'Bought a sword', 1);
s.addNpcMemory(npc.id, 'u1', 'g1', 'dialogue', 'Said thanks', 2);
console.log('Relationship:', s.getNpcRelationship(npc.id, 'u1', 'g1'));
s.deleteCharacterCascade('u1', 'g1');
"
```
Expected: NPC with personality, relationship 'friendly' after positive interactions

- [ ] **Step 3: Commit**

```bash
git add features/realm/npc.js
git commit -m "feat(realm): add NPC generation, memory, and relationship system"
```

---

## Task 7: Combat System

**Covers:** [S7a, S7b, S7b1, S7c, S7d, S7e]

**Files:**
- Create: `features/realm/combat.js`

**Interfaces:**
- Consumes: `realmStore` (getCharacter, saveCharacter, logKill), `realmConfig` (ENEMY_SCALING), `aiDriver` (generateCombatNarration)
- Produces: `startCombat`, `processCombatRound`, `rollEnemy`

- [ ] **Step 1: Create combat.js**

Create `features/realm/combat.js`:

```js
const realmStore = require('./realmStore');
const { ENEMY_SCALING } = require('./realmConfig');
const aiDriver = require('./aiDriver');

const activeCombat = new Map(); // userId -> combat state

function rollEnemy(dangerLevel) {
  const template = ENEMY_SCALING[dangerLevel] || ENEMY_SCALING[1];
  const levelScale = 1 + (dangerLevel - 1) * 0.2;
  return {
    name: template.name,
    hp_current: Math.floor(template.baseHp * levelScale),
    hp_max: Math.floor(template.baseHp * levelScale),
    attack: Math.floor(template.baseAttack * levelScale),
    defense: Math.floor(template.baseDefense * levelScale),
    level: dangerLevel,
    special: null,
  };
}

function startCombat(userId, guildId, enemy, locationId) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return null;
  const state = {
    character: { ...char },
    enemy: { ...enemy, location: locationId },
    history: [],
    turn: 0,
  };
  activeCombat.set(userId, state);
  return state;
}

function getPlayerDamage(char, weaponBonus = 0) {
  const primaryStat = char.class === 'Warrior' || char.class === 'Rogue' || char.class === 'Ranger'
    ? char.strength : char.intelligence;
  const base = primaryStat + weaponBonus;
  const crit = Math.random() < (char.luck / 100);
  return Math.max(base * (crit ? 2 : 1) - 0, 1); // enemy.defense applied after
}

function getEnemyDamage(enemy, defending) {
  const defMultiplier = defending ? 2 : 1;
  return Math.max(enemy.attack - 0, 1); // player.defense applied after
}

function processCombatRound(userId, guildId, playerAction, isDefending) {
  const state = activeCombat.get(userId);
  if (!state) return null;

  const { character, enemy, history } = state;
  state.turn++;

  // Player attacks
  let weaponBonus = 0;
  const inventory = realmStore.getInventory(userId, guildId);
  const weapon = inventory.find(i => i.type === 'weapon' && i.equipped);
  if (weapon) {
    try { weaponBonus = JSON.parse(weapon.stats).attack || 0; } catch { weaponBonus = 0; }
  }

  let armorBonus = 0;
  const armor = inventory.find(i => i.type === 'armor' && i.equipped);
  if (armor) {
    try { armorBonus = JSON.parse(armor.stats).defense || 0; } catch { armorBonus = 0; }
  }

  const playerDmg = Math.max(getPlayerDamage(character, weaponBonus) - enemy.defense, 1);
  enemy.hp_current -= playerDmg;
  history.push(`Player dealt ${playerDmg} damage`);

  // Check enemy defeat
  if (enemy.hp_current <= 0) {
    activeCombat.delete(userId);
    const xpReward = enemy.level * 30 + Math.floor(Math.random() * 20);
    const goldReward = enemy.level * 5 + Math.floor(Math.random() * 10);
    realmStore.logKill(userId, guildId, { name: enemy.name, level: enemy.level, location: enemy.location, xp: xpReward, gold: goldReward });
    realmStore.saveCharacter(userId, guildId, { gold: character.gold + goldReward });
    return { result: 'victory', playerDmg, xpReward, goldReward, enemyHp: 0, history };
  }

  // Enemy attacks
  const enemyDmg = Math.max(enemy.attack - (character.constitution + armorBonus) * (isDefending ? 2 : 1), 1);
  character.hp_current -= enemyDmg;
  history.push(`Enemy dealt ${enemyDmg} damage`);

  // Persist player HP per round
  realmStore.saveCharacter(userId, guildId, { hp_current: character.hp_current });

  // Check player defeat
  if (character.hp_current <= 0) {
    activeCombat.delete(userId);
    const goldLost = Math.floor(character.gold / 2);
    realmStore.saveCharacter(userId, guildId, { gold: character.gold - goldLost, hp_current: Math.floor(character.hp_max * 0.25) });
    return { result: 'defeat', playerDmg, enemyDmg, goldLost, history };
  }

  return { result: 'continue', playerDmg, enemyDmg, enemyHp: enemy.hp_current, playerHp: character.hp_current, history };
}

function handleTimeout(userId, guildId) {
  const state = activeCombat.get(userId);
  if (!state) return null;
  activeCombat.delete(userId);
  const goldLost = Math.floor(state.character.gold * 0.1);
  realmStore.saveCharacter(userId, guildId, { gold: state.character.gold - goldLost });
  return { goldLost };
}

function getCombatState(userId) {
  return activeCombat.get(userId) || null;
}

function clearCombat(userId) {
  activeCombat.delete(userId);
}

module.exports = { rollEnemy, startCombat, processCombatRound, handleTimeout, getCombatState, clearCombat };
```

- [ ] **Step 2: Verify combat math**

Run: `node -e "
const c = require('./features/realm/combat');
const e = c.rollEnemy(3);
console.log('Enemy:', e.name, 'HP:', e.hp_current, 'ATK:', e.attack, 'DEF:', e.defense);
const s = require('./features/realm/realmStore');
s.saveCharacter('u1', 'g1', { name: 'Kael', class: 'Warrior', strength: 13, dexterity: 9, intelligence: 7, constitution: 11, wisdom: 8, charisma: 8, luck: 5, hp_current: 70, hp_max: 70, gold: 100 });
const combat = c.startCombat('u1', 'g1', e, 'bone_arena');
const result = c.processCombatRound('u1', 'g1', 'Attack', false);
console.log('Round result:', result.result, 'Player dealt:', result.playerDmg, 'Enemy dealt:', result.enemyDmg);
s.deleteCharacterCascade('u1', 'g1');
"
```
Expected: Enemy generated with correct stats, combat round resolves with damage numbers

- [ ] **Step 3: Commit**

```bash
git add features/realm/combat.js
git commit -m "feat(realm): add combat engine with damage formulas and per-round HP persistence"
```

---

## Task 8: Inventory System

**Covers:** [S8a, S8b, S8c, S8d]

**Files:**
- Create: `features/realm/inventory.js`

**Interfaces:**
- Consumes: `realmStore` (getInventory, addItem, removeItem, equipItem), `realmConfig` (ITEM_TEMPLATES, rollRarity)
- Produces: `generateLoot`, `equipBest`, `getEquipped`, `paginateItems`

- [ ] **Step 1: Create inventory.js**

Create `features/realm/inventory.js`:

```js
const realmStore = require('./realmStore');
const { ITEM_TEMPLATES, rollRarity } = require('./realmConfig');

function generateLoot(dangerLevel, luck) {
  const rarity = rollRarity();
  const typeRoll = Math.random();
  let type = 'consumable';
  if (typeRoll < 0.3) type = 'weapon';
  else if (typeRoll < 0.5) type = 'armor';

  const templates = ITEM_TEMPLATES[type]?.[rarity];
  if (!templates || templates.length === 0) return null;

  const template = templates[Math.floor(Math.random() * templates.length)];
  const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return { id, ...template, type, rarity, description: `A ${rarity} ${type} found in the realm.` };
}

function equipBest(userId, guildId) {
  const items = realmStore.getInventory(userId, guildId);
  const weapons = items.filter(i => i.type === 'weapon').sort((a, b) => {
    try { return (JSON.parse(b.stats).attack || 0) - (JSON.parse(a.stats).attack || 0); } catch { return 0; }
  });
  const armors = items.filter(i => i.type === 'armor').sort((a, b) => {
    try { return (JSON.parse(b.stats).defense || 0) - (JSON.parse(a.stats).defense || 0); } catch { return 0; }
  });
  if (weapons.length > 0) realmStore.equipItem(userId, guildId, weapons[0].item_id);
  if (armors.length > 0) realmStore.equipItem(userId, guildId, armors[0].item_id);
}

function getEquipped(userId, guildId) {
  const items = realmStore.getInventory(userId, guildId);
  return items.filter(i => i.equipped);
}

function paginateItems(items, page = 0, perPage = 25) {
  const start = page * perPage;
  return {
    items: items.slice(start, start + perPage),
    totalPages: Math.ceil(items.length / perPage),
    currentPage: page,
    hasMore: start + perPage < items.length,
  };
}

module.exports = { generateLoot, equipBest, getEquipped, paginateItems };
```

- [ ] **Step 2: Verify loot generation**

Run: `node -e "
const inv = require('./features/realm/inventory');
const loot = inv.generateLoot(3, 5);
console.log('Loot:', loot.name, loot.rarity, loot.type, loot.value);
const items = [{ item_id: '1', type: 'weapon', equipped: 0, stats: '{\"attack\":5}' }, { item_id: '2', type: 'weapon', equipped: 0, stats: '{\"attack\":8}' }];
const paged = inv.paginateItems(items, 0, 25);
console.log('Paged:', paged.items.length, 'Total pages:', paged.totalPages);
"
```
Expected: Loot generated with valid properties, pagination works

- [ ] **Step 3: Commit**

```bash
git add features/realm/inventory.js
git commit -m "feat(realm): add inventory system with loot generation and pagination"
```

---

## Task 9: Quest System

**Covers:** [S9a, S9b, S9c, S9d]

**Files:**
- Create: `features/realm/quest.js`

**Interfaces:**
- Consumes: `realmStore` (getActiveQuests, addQuest, updateQuest), `aiDriver` (generateQuestHook)
- Produces: `createQuest`, `checkQuestProgress`, `completeQuest`, `canAcceptQuest`

- [ ] **Step 1: Create quest.js**

Create `features/realm/quest.js`:

```js
const realmStore = require('./realmStore');
const aiDriver = require('./aiDriver');

function canAcceptQuest(userId, guildId) {
  const active = realmStore.getActiveQuests(userId, guildId);
  return active.length < 3;
}

function createQuest(userId, guildId, questData) {
  const id = `quest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const quest = {
    id,
    title: questData.title || 'Unknown Quest',
    description: questData.description || '',
    giver_npc: questData.giver_npc || null,
    objectives: questData.objectives || [],
    rewards: questData.rewards || { xp: 100, gold: 50 },
    status: 'active',
    chain_next: questData.chain_next || null,
  };
  realmStore.addQuest(userId, guildId, quest);
  return quest;
}

function checkQuestProgress(userId, guildId, eventType, target) {
  const active = realmStore.getActiveQuests(userId, guildId);
  const completed = [];
  for (const q of active) {
    let objectives;
    try { objectives = JSON.parse(q.objectives); } catch { continue; }
    let allDone = true;
    for (const obj of objectives) {
      if (obj.type === eventType && obj.target === target && obj.current < obj.count) {
        obj.current++;
      }
      if (obj.current < obj.count) allDone = false;
    }
    realmStore.updateQuest(userId, guildId, q.quest_id, { objectives: JSON.stringify(objectives) });
    if (allDone) completed.push(q);
  }
  return completed;
}

function completeQuest(userId, guildId, questId) {
  const active = realmStore.getActiveQuests(userId, guildId);
  const quest = active.find(q => q.quest_id === questId);
  if (!quest) return null;
  realmStore.updateQuest(userId, guildId, questId, { status: 'completed' });
  let rewards;
  try { rewards = JSON.parse(quest.rewards); } catch { rewards = { xp: 100, gold: 50 }; }
  return { quest, rewards };
}

module.exports = { canAcceptQuest, createQuest, checkQuestProgress, completeQuest };
```

- [ ] **Step 2: Verify quest flow**

Run: `node -e "
const q = require('./features/realm/quest');
const s = require('./features/realm/realmStore');
s.saveCharacter('u1', 'g1', { name: 'Kael', class: 'Warrior', level: 1 });
const quest = q.createQuest('u1', 'g1', { title: 'Slay the Wraith', objectives: [{ type: 'kill', target: 'Shadow Wraith', count: 3, current: 0 }], rewards: { xp: 200, gold: 100 } });
console.log('Quest:', quest.title, quest.id);
q.checkQuestProgress('u1', 'g1', 'kill', 'Shadow Wraith');
q.checkQuestProgress('u1', 'g1', 'kill', 'Shadow Wraith');
const completed = q.checkQuestProgress('u1', 'g1', 'kill', 'Shadow Wraith');
console.log('Completed quests:', completed.length);
s.deleteCharacterCascade('u1', 'g1');
"
```
Expected: Quest created, progress tracked, completion detected after 3 kills

- [ ] **Step 3: Commit**

```bash
git add features/realm/quest.js
git commit -m "feat(realm): add quest generation, tracking, and completion"
```

---

## Task 10: Economy System

**Covers:** [S10a, S10b, S10c]

**Files:**
- Create: `features/realm/economy.js`

**Interfaces:**
- Consumes: `realmStore` (getCharacter, saveCharacter, getInventory, addItem, removeItem)
- Produces: `canTrade`, `executeTrade`, `sellToMerchant`, `buyFromMerchant`

- [ ] **Step 1: Create economy.js**

Create `features/realm/economy.js`:

```js
const realmStore = require('./realmStore');

const activeTrades = new Map(); // userId -> { partnerId, myItems, myGold, theirItems, theirGold, timeout }

function canTrade(userId, partnerId) {
  if (userId === partnerId) return { ok: false, reason: "You can't negotiate with your own shadow." };
  if (activeTrades.has(userId)) return { ok: false, reason: "You're already negotiating." };
  if (activeTrades.has(partnerId)) return { ok: false, reason: "They're already negotiating." };
  const partner = realmStore.getCharacter(partnerId, 'any');
  return { ok: true };
}

function startTrade(userId, guildId, partnerId) {
  const trade = {
    guildId,
    partnerId,
    myItems: [],
    myGold: 0,
    theirItems: [],
    theirGold: 0,
    confirmed: new Set(),
    timeout: setTimeout(() => {
      activeTrades.delete(userId);
      activeTrades.delete(partnerId);
    }, 5 * 60 * 1000),
  };
  activeTrades.set(userId, trade);
  activeTrades.set(partnerId, { ...trade, partnerId: userId, myItems: trade.theirItems, myGold: trade.theirGold, theirItems: trade.myItems, theirGold: trade.myGold, confirmed: trade.confirmed });
  return trade;
}

function addToTrade(userId, itemId, gold) {
  const trade = activeTrades.get(userId);
  if (!trade) return null;
  if (itemId) trade.myItems.push(itemId);
  if (gold) trade.myGold += gold;
  return trade;
}

function confirmTrade(userId) {
  const trade = activeTrades.get(userId);
  if (!trade) return null;
  trade.confirmed.add(userId);
  if (trade.confirmed.size >= 2) {
    return executeTrade(userId, trade);
  }
  return { pending: true };
}

function executeTrade(userId, trade) {
  const { guildId, partnerId } = trade;
  const myChar = realmStore.getCharacter(userId, guildId);
  const theirChar = realmStore.getCharacter(partnerId, guildId);
  if (!myChar || !theirChar) return { error: 'A character no longer exists.' };

  // Transfer items
  for (const itemId of trade.myItems) {
    realmStore.removeItem(userId, guildId, itemId);
    const item = realmStore.getInventory(userId, guildId).find(i => i.item_id === itemId);
    if (item) realmStore.addItem(partnerId, guildId, item);
  }
  for (const itemId of trade.theirItems) {
    realmStore.removeItem(partnerId, guildId, itemId);
    const item = realmStore.getInventory(partnerId, guildId).find(i => i.item_id === itemId);
    if (item) realmStore.addItem(userId, guildId, item);
  }

  // Transfer gold
  realmStore.saveCharacter(userId, guildId, { gold: myChar.gold - trade.myGold + trade.theirGold });
  realmStore.saveCharacter(partnerId, guildId, { gold: theirChar.gold - trade.theirGold + trade.myGold });

  clearTimeout(trade.timeout);
  activeTrades.delete(userId);
  activeTrades.delete(partnerId);
  return { success: true };
}

function sellToMerchant(userId, guildId, itemId, relationship) {
  const inventory = realmStore.getInventory(userId, guildId);
  const item = inventory.find(i => i.item_id === itemId);
  if (!item) return null;
  const price = relationship === 'friendly' ? Math.floor(item.value * 0.9) : item.value;
  realmStore.removeItem(userId, guildId, itemId);
  const char = realmStore.getCharacter(userId, guildId);
  realmStore.saveCharacter(userId, guildId, { gold: char.gold + price });
  return { sold: item.name, price };
}

function cancelTrade(userId) {
  const trade = activeTrades.get(userId);
  if (trade) {
    clearTimeout(trade.timeout);
    activeTrades.delete(userId);
    activeTrades.delete(trade.partnerId);
  }
}

module.exports = { canTrade, startTrade, addToTrade, confirmTrade, cancelTrade, sellToMerchant };
```

- [ ] **Step 2: Verify self-trade guard and trade flow**

Run: `node -e "
const eco = require('./features/realm/economy');
console.log('Self-trade:', eco.canTrade('u1', 'u1'));
console.log('Valid trade:', eco.canTrade('u1', 'u2'));
"
```
Expected: Self-trade rejected with message, valid trade allowed

- [ ] **Step 3: Commit**

```bash
git add features/realm/economy.js
git commit -m "feat(realm): add economy system with trading and merchant sales"
```

---

## Task 11: /realm Command (All Subcommands)

**Covers:** [S13a, S13b, S13c, S14]

**Files:**
- Create: `features/realm/realmCommand.js`

**Interfaces:**
- Consumes: ALL previous realm modules
- Produces: `execute(interaction)` — the main command handler

- [ ] **Step 1: Create realmCommand.js**

Create `features/realm/realmCommand.js`:

```js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const character = require('./character');
const world = require('./world');
const combat = require('./combat');
const inventory = require('./inventory');
const quest = require('./quest');
const economy = require('./economy');
const npc = require('./npc');
const aiDriver = require('./aiDriver');
const realmStore = require('./realmStore');
const realmRateLimit = require('./realmRateLimit');

const REALM_RATE_MSG = 'Even the Realm needs to breathe. Rest a while before pressing further.';
const GUILD_LIMIT_MSG = 'The Realm rests until tomorrow.';

function checkRealmRate(userId, guildId) {
  if (!realmRateLimit.canCall(userId)) return REALM_RATE_MSG;
  if (!realmRateLimit.canGuildCall(guildId)) return GUILD_LIMIT_MSG;
  realmRateLimit.recordCall(userId);
  realmRateLimit.incrementGuildDaily(guildId);
  return null;
}

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;

  // Non-AI commands — no rate limit needed
  if (sub === 'help') return showHelp(interaction);
  if (sub === 'stats') return showStats(interaction, userId, guildId);
  if (sub === 'inventory') return showInventory(interaction, userId, guildId);
  if (sub === 'quests') return showQuests(interaction, userId, guildId);

  // AI commands — check rate limit
  const rateError = checkRealmRate(userId, guildId);
  if (rateError) return interaction.reply({ content: rateError, flags: 64 });

  switch (sub) {
    case 'create': return handleCreate(interaction, userId, guildId);
    case 'start':
    case 'explore': return handleExplore(interaction, userId, guildId);
    case 'rest': return handleRest(interaction, userId, guildId);
    case 'trade': return handleTrade(interaction, userId, guildId);
    case 'delete': return handleDelete(interaction, userId, guildId);
    case 'leaderboard': return showLeaderboard(interaction, guildId);
  }
}

async function handleCreate(interaction, userId, guildId) {
  const existing = realmStore.getCharacter(userId, guildId);
  if (existing) return interaction.reply({ content: `You already have **${existing.name}** the ${existing.race} ${existing.class}. Use /realm delete first to start over.`, flags: 64 });

  await interaction.deferReply({ flags: 64 });

  // Step 1: Name
  const nameEmbed = new EmbedBuilder().setTitle('Realm of Skarn — Character Creation').setDescription('What is your name, adventurer?').setColor(0x00e5ff);
  await interaction.editReply({ embeds: [nameEmbed] });

  const nameFilter = m => m.author.id === userId;
  const nameCollected = await interaction.channel.awaitMessages({ filter: nameFilter, max: 1, time: 300000 }).catch(() => null);
  if (!nameCollected || nameCollected.size === 0) return interaction.editReply('The realm grows impatient. Return when you\'re ready.');
  const name = nameCollected.first().content.slice(0, 24);

  // Step 2: Race
  const races = ['Human', 'Elf', 'Dwarf', 'Demon', 'Tiefling', 'Dragonborn'];
  const raceRow = new ActionRowBuilder().addComponents(
    races.map(r => new ButtonBuilder().setCustomId(`race_${r}`).setLabel(r).setStyle(ButtonStyle.Secondary))
  );
  const raceEmbed = new EmbedBuilder().setTitle('Choose Your Race').setDescription(`${name}, what are you?`).setColor(0x00e5ff);
  await interaction.editReply({ embeds: [raceEmbed], components: [raceRow] });

  const raceChoice = await interaction.channel.awaitMessageComponent({ filter: i => i.user.id === userId, time: 300000 }).catch(() => null);
  if (!raceChoice) return interaction.editReply('The realm grows impatient.');
  const race = raceChoice.customId.replace('race_', '');
  await raceChoice.update({ components: [] });

  // Step 3: Class
  const classes = ['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger', 'Warlock'];
  const classRow = new ActionRowBuilder().addComponents(
    classes.map(c => new ButtonBuilder().setCustomId(`cls_${c}`).setLabel(c).setStyle(ButtonStyle.Secondary))
  );
  const classEmbed = new EmbedBuilder().setTitle('Choose Your Class').setDescription(`${name} the ${race}, what is your calling?`).setColor(0x00e5ff);
  await interaction.editReply({ embeds: [classEmbed], components: [classRow] });

  const classChoice = await interaction.channel.awaitMessageComponent({ filter: i => i.user.id === userId, time: 300000 }).catch(() => null);
  if (!classChoice) return interaction.editReply('The realm grows impatient.');
  const cls = classChoice.customId.replace('cls_', '');
  await classChoice.update({ components: [] });

  // Step 4: Background question
  const questions = [
    'What drives you to enter the realm?',
    'What\'s the one thing you\'d never trade?',
    'What did you leave behind?',
    'What are you running from?',
  ];
  const question = questions[Math.floor(Math.random() * questions.length)];
  const qEmbed = new EmbedBuilder().setTitle('One Question').setDescription(`${name}, ${question}`).setColor(0x00e5ff);
  await interaction.editReply({ embeds: [qEmbed], components: [] });

  const answerCollected = await interaction.channel.awaitMessages({ filter: nameFilter, max: 1, time: 300000 }).catch(() => null);
  if (!answerCollected || answerCollected.size === 0) return interaction.editReply('The realm grows impatient.');
  const answer = answerCollected.first().content;

  // Step 5: Generate backstory
  const charData = { name, race, class: cls };
  const backstory = await aiDriver.generateBackstory(charData, answer);

  const acceptRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
  );
  const storyEmbed = new EmbedBuilder().setTitle(`${name} the ${race} ${cls}`).setDescription(backstory).setColor(0x00e5ff);
  await interaction.editReply({ embeds: [storyEmbed], components: [acceptRow] });

  const storyChoice = await interaction.channel.awaitMessageComponent({ filter: i => i.user.id === userId, time: 300000 }).catch(() => null);
  if (!storyChoice || storyChoice.customId === 'reroll') {
    const backstory2 = await aiDriver.generateBackstory(charData, answer);
    const storyEmbed2 = new EmbedBuilder().setTitle(`${name} the ${race} ${cls}`).setDescription(backstory2).setColor(0x00e5ff);
    await interaction.editReply({ embeds: [storyEmbed2], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
    )] });
    const finalChoice = await interaction.channel.awaitMessageComponent({ filter: i => i.user.id === userId, time: 300000 }).catch(() => null);
    if (!finalChoice) return interaction.editReply('The realm grows impatient.');
    await finalChoice.update({ components: [] });
    character.createCharacter(userId, guildId, name, race, cls, backstory2);
  } else {
    await storyChoice.update({ components: [] });
    character.createCharacter(userId, guildId, name, race, cls, backstory);
  }

  // Channel announcement
  const char = realmStore.getCharacter(userId, guildId);
  const announceEmbed = new EmbedBuilder()
    .setTitle('A New Challenger Enters the Realm')
    .setDescription(`**${name}** the ${race} ${cls} has arrived.`)
    .addFields({ name: 'HP', value: `${char.hp_current}/${char.hp_max}`, inline: true }, { name: 'Location', value: 'The Abyssal Gate', inline: true })
    .setColor(0x00e5ff);
  await interaction.channel.send({ embeds: [announceEmbed] });
}

async function handleExplore(interaction, userId, guildId) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return interaction.reply({ content: 'You have no character. Use /realm create first.', flags: 64 });

  await interaction.deferReply({ flags: 64 });
  const loc = world.getLocation(char.current_location);
  const history = [];
  const isProcessing = new Map();

  const scene = await aiDriver.generateExploration(char, loc, null, history);
  const choices = world.parseChoices(scene);

  const row = new ActionRowBuilder().addComponents(
    choices.map((c, i) => new ButtonBuilder().setCustomId(`explore_${i}`).setLabel(`${i + 1}`).setStyle(ButtonStyle.Primary))
  );

  const embed = new EmbedBuilder().setTitle(loc.name).setDescription(scene).setColor(0x00e5ff).setFooter({ text: 'Choose your action' });
  await interaction.editReply({ embeds: [embed], components: [row] });

  const filter = i => i.user.id === userId;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

  collector.on('collect', async i => {
    if (isProcessing.get(userId)) {
      try { await i.reply({ content: 'Still resolving your last action.', flags: 64 }); } catch {}
      return;
    }
    isProcessing.set(userId, true);

    const rateErr = checkRealmRate(userId, guildId);
    if (rateErr) {
      try { await i.reply({ content: rateErr, flags: 64 }); } catch {}
      isProcessing.set(userId, false);
      return;
    }

    const choiceIdx = parseInt(i.customId.replace('explore_', ''));
    const choice = choices[choiceIdx] || 'Look around';

    try {
      // Check if choice is movement
      const connected = world.getConnectedLocations(char.current_location);
      const moveTarget = connected.find(c => choice.toLowerCase().includes(c.name.toLowerCase()));
      if (moveTarget) {
        const moved = world.moveTo(userId, guildId, moveTarget.id);
        char.current_location = moveTarget.id;
        history.push(`Moved to ${moved.name}`);
      } else {
        history.push(choice);
      }

      const nextScene = await aiDriver.generateExploration(char, world.getLocation(char.current_location), null, history);
      const nextChoices = world.parseChoices(nextScene);
      const nextRow = new ActionRowBuilder().addComponents(
        nextChoices.map((c, idx) => new ButtonBuilder().setCustomId(`explore_${idx}`).setLabel(`${idx + 1}`).setStyle(ButtonStyle.Primary))
      );
      const nextEmbed = new EmbedBuilder().setTitle(world.getLocation(char.current_location).name).setDescription(nextScene).setColor(0x00e5ff).setFooter({ text: 'Choose your action' });
      await i.update({ embeds: [nextEmbed], components: [nextRow] });
    } catch (err) {
      console.error('[REALM] Explore error:', err);
      try { await i.update({ content: 'The realm shudders... try again.', components: [] }); } catch {}
    } finally {
      isProcessing.set(userId, false);
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}

async function handleRest(interaction, userId, guildId) {
  const result = character.heal(userId, guildId);
  if (!result) return interaction.reply({ content: 'You have no character.', flags: 64 });
  const embed = new EmbedBuilder().setTitle('Rest').setDescription(`You rest and recover **${result.healed} HP**.\nHP: ${result.hp_current}/${result.hp_max}`).setColor(0x2ecc71);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleTrade(interaction, userId, guildId) {
  const partner = interaction.options.getUser('player');
  const check = economy.canTrade(userId, partner.id);
  if (!check.ok) return interaction.reply({ content: check.reason, flags: 64 });

  const myChar = realmStore.getCharacter(userId, guildId);
  const theirChar = realmStore.getCharacter(partner.id, guildId);
  if (!theirChar) return interaction.reply({ content: `${partner.username} has no character in the Realm.`, flags: 64 });

  economy.startTrade(userId, guildId, partner.id);
  const embed = new EmbedBuilder().setTitle('Trade Initiated').setDescription(`Trading with ${partner.username}. Select items to offer.`).setColor(0xf39c12);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleDelete(interaction, userId, guildId) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return interaction.reply({ content: 'You have no character.', flags: 64 });

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm_delete').setLabel('Confirm Delete').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  const embed = new EmbedBuilder().setTitle('Delete Character').setDescription(`This erases **${char.name}** the ${char.race} ${char.class} — level, gear, quests, everything. The realm will not remember you. Confirm?`).setColor(0xe74c3c);
  await interaction.reply({ embeds: [embed], components: [confirmRow], flags: 64 });

  const filter = i => i.user.id === userId;
  const collected = await interaction.channel.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);
  if (!collected || collected.customId === 'cancel_delete') {
    return interaction.editReply({ content: 'Character preserved.', components: [] });
  }
  realmStore.deleteCharacterCascade(userId, guildId);
  await collected.update({ content: `${char.name} has been erased from the Realm.`, embeds: [], components: [] });
}

async function showStats(interaction, userId, guildId) {
  const char = realmStore.getCharacter(userId, guildId);
  if (!char) return interaction.reply({ content: 'You have no character. Use /realm create first.', flags: 64 });

  const hpBar = '█'.repeat(Math.floor((char.hp_current / char.hp_max) * 10)) + '░'.repeat(10 - Math.floor((char.hp_current / char.hp_max) * 10));
  const kills = realmStore.getKillStats(userId, guildId);
  const discovered = realmStore.getDiscoveredLocations(userId, guildId);

  const embed = new EmbedBuilder()
    .setTitle(`${char.name} — Level ${char.level} ${char.race} ${char.class}`)
    .addFields(
      { name: 'HP', value: `${hpBar} ${char.hp_current}/${char.hp_max}`, inline: false },
      { name: 'STR', value: `${char.strength}`, inline: true },
      { name: 'DEX', value: `${char.dexterity}`, inline: true },
      { name: 'INT', value: `${char.intelligence}`, inline: true },
      { name: 'CON', value: `${char.constitution}`, inline: true },
      { name: 'WIS', value: `${char.wisdom}`, inline: true },
      { name: 'CHA', value: `${char.charisma}`, inline: true },
      { name: 'Luck', value: `${char.luck}`, inline: true },
      { name: 'Gold', value: `${char.gold}`, inline: true },
      { name: 'XP', value: `${char.xp}`, inline: true },
      { name: 'Kills', value: `${kills?.kills || 0}`, inline: true },
      { name: 'Discovered', value: `${discovered.length} locations`, inline: true },
    )
    .setColor(0x00e5ff);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function showInventory(interaction, userId, guildId) {
  const items = realmStore.getInventory(userId, guildId);
  if (items.length === 0) return interaction.reply({ content: 'Your inventory is empty.', flags: 64 });

  const paged = inventory.paginateItems(items);
  const list = paged.items.map(i => {
    const equipped = i.equipped ? ' [EQUIPPED]' : '';
    return `**${i.name}** (${i.rarity} ${i.type}) — ${i.value}g${equipped}`;
  }).join('\n');

  const embed = new EmbedBuilder().setTitle('Inventory').setDescription(list).setColor(0x00e5ff)
    .setFooter({ text: `Page ${paged.currentPage + 1}/${paged.totalPages}` });
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function showQuests(interaction, userId, guildId) {
  const active = realmStore.getActiveQuests(userId, guildId);
  if (active.length === 0) return interaction.reply({ content: 'No active quests. Talk to NPCs to find work.', flags: 64 });

  const list = active.map(q => {
    let objectives;
    try { objectives = JSON.parse(q.objectives); } catch { objectives = []; }
    const objStr = objectives.map(o => `${o.type} ${o.target}: ${o.current}/${o.count}`).join(', ');
    return `**${q.title}**\n${q.description || ''}\n${objStr}`;
  }).join('\n\n');

  const embed = new EmbedBuilder().setTitle('Active Quests').setDescription(list).setColor(0xf39c12);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function showLeaderboard(interaction, guildId) {
  const top = realmStore.getLeaderboard(guildId, 10);
  if (top.length === 0) return interaction.reply({ content: 'No characters in the Realm yet.', flags: 64 });

  const list = top.map((c, i) => `${i + 1}. **${c.name}** — Level ${c.level} ${c.race} ${c.class} (${c.xp} XP)`).join('\n');
  const embed = new EmbedBuilder().setTitle('Realm Leaderboard').setDescription(list).setColor(0x00e5ff);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function showHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Realm of Skarn — Commands')
    .setDescription('A persistent AI-driven RPG narrated by Skarn.')
    .addFields(
      { name: '/realm create', value: 'Create a new character', inline: true },
      { name: '/realm start', value: 'Begin exploring', inline: true },
      { name: '/realm explore', value: 'Continue exploring', inline: true },
      { name: '/realm stats', value: 'View character sheet', inline: true },
      { name: '/realm inventory', value: 'View inventory', inline: true },
      { name: '/realm quests', value: 'View active quests', inline: true },
      { name: '/realm rest', value: 'Rest and heal 25% HP', inline: true },
      { name: '/realm trade @player', value: 'Trade with a player', inline: true },
      { name: '/realm delete', value: 'Delete your character', inline: true },
      { name: '/realm leaderboard', value: 'Top characters', inline: true },
    )
    .setColor(0x00e5ff);
  await interaction.reply({ embeds: [embed], flags: 64 });
}

module.exports = { execute };
```

- [ ] **Step 2: Verify command structure**

Run: `node -e "const cmd = require('./features/realm/realmCommand'); console.log('Execute:', typeof cmd.execute)"`
Expected: `Execute: function`

- [ ] **Step 3: Commit**

```bash
git add features/realm/realmCommand.js
git commit -m "feat(realm): add /realm command with all subcommands"
```

---

## Task 12: Help Text + Final Integration

**Covers:** [S15b, S18]

**Files:**
- Modify: `commands/help.js` (add Realm category)
- Modify: `bot.js` (verify no conflicts)

**Interfaces:**
- Consumes: existing help.js categories
- Produces: updated help embed with Realm commands

- [ ] **Step 1: Add Realm category to help.js**

Add to the `categories` object in `commands/help.js`:

```js
'Realm of Skarn': {
  color: 0xe91e8a,
  commands: [
    { name: '/realm create', desc: 'Create a new character' },
    { name: '/realm start', desc: 'Begin exploring the Realm' },
    { name: '/realm explore', desc: 'Continue exploring' },
    { name: '/realm stats', desc: 'View character sheet' },
    { name: '/realm inventory', desc: 'View inventory' },
    { name: '/realm quests', desc: 'View active quests' },
    { name: '/realm rest', desc: 'Rest and heal' },
    { name: '/realm trade @player', desc: 'Trade with a player' },
    { name: '/realm delete', desc: 'Delete your character' },
    { name: '/realm leaderboard', desc: 'Top characters' },
  ],
},
```

- [ ] **Step 2: Verify bot.js loads without errors**

Run: `node -e "require('./bot')" 2>&1 | head -5` (will fail on missing env vars, but should not show module errors)
Expected: No `MODULE_NOT_FOUND` errors for realm files

- [ ] **Step 3: Verify deploy-commands.js picks up realm**

Run: `node -e "const cmd = require('./commands/realm'); console.log('Realm command:', cmd.data.name, 'subs:', cmd.data.options.length)"`
Expected: `Realm command: realm subs: 11`

- [ ] **Step 4: Run full build**

Run: `npm run build` from `skarn-bot/`
Expected: Builds successfully (Tailwind + CSS + JS minification)

- [ ] **Step 5: Final verification — manual QA checklist**

1. Open bot in Discord
2. Run `/realm create` — complete full creation flow
3. Run `/realm stats` — verify character sheet shows correct stats
4. Run `/realm start` — explore, verify buttons work and scenes change
5. Run `/realm inventory` — verify empty initially
6. Run `/realm quests` — verify no active quests
7. Run `/realm rest` — verify HP restoration
8. Run `/realm leaderboard` — verify character appears
9. Run `/realm help` — verify all commands listed
10. Run `/help` — verify Realm category appears
11. Run `/realm delete` — confirm, verify character removed
12. Verify bot responds to other commands normally (no regressions)

- [ ] **Step 6: Commit**

```bash
git add commands/help.js
git commit -m "feat(realm): add Realm category to help command"
```

---

## Summary

| Task | Files | Est. Lines | Covers |
|------|-------|-----------|--------|
| 1. Schema + realmStore | 2 | ~180 | S11a, S11b, S11c |
| 2. Config + Rate Limit | 2 | ~140 | S2, S4b, S5a, S7b1, S12f |
| 3. Persona + Wiring | 2 | ~30 | S12a, S12b, S3 |
| 4. Character | 1 | ~80 | S4a, S4b, S4c, S4d |
| 5. World + AI Driver | 2 | ~130 | S5a, S5b, S5c, S12c, S12d |
| 6. NPC | 1 | ~50 | S6a, S6b, S6c |
| 7. Combat | 1 | ~110 | S7a-S7e |
| 8. Inventory | 1 | ~60 | S8a-S8d |
| 9. Quest | 1 | ~70 | S9a-S9d |
| 10. Economy | 1 | ~100 | S10a-S10c |
| 11. Command | 1 | ~300 | S13a, S13b, S13c, S14 |
| 12. Help + Integration | 2 | ~20 | S15b, S18 |
| **Total** | **17** | **~1270** | **All S1-S18** |
