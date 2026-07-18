-- New tables only. Existing JSON data (config, levels, friends) untouched.
CREATE TABLE IF NOT EXISTS user_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  fact_text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_state (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'Attentive',
  last_message_at INTEGER NOT NULL,
  last_transition_at INTEGER NOT NULL,
  recent_message_count INTEGER NOT NULL DEFAULT 0,
  count_window_started_at INTEGER NOT NULL DEFAULT 0
);

-- ===== Realm of Skarn =====

CREATE TABLE IF NOT EXISTS realm_characters (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT 'Adventurer',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next INTEGER NOT NULL DEFAULT 100,
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  attack INTEGER NOT NULL DEFAULT 10,
  defense INTEGER NOT NULL DEFAULT 5,
  gold INTEGER NOT NULL DEFAULT 0,
  region TEXT NOT NULL DEFAULT 'hub',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS realm_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'misc',
  quantity INTEGER NOT NULL DEFAULT 1,
  equipped INTEGER NOT NULL DEFAULT 0,
  stats TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, item_name)
);

CREATE TABLE IF NOT EXISTS realm_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  quest_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  objectives TEXT NOT NULL DEFAULT '[]',
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_gold INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE(user_id, guild_id, quest_name)
);

CREATE TABLE IF NOT EXISTS realm_npc_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  npc_name TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  relationship INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, npc_name)
);

CREATE TABLE IF NOT EXISTS realm_discovered_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  discovered_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, location_name)
);

CREATE TABLE IF NOT EXISTS realm_kill_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  creature_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'unknown',
  killed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS realm_world_state (
  key TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_realm_inventory_user ON realm_inventory(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_quests_user ON realm_quests(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_npc_memory_user ON realm_npc_memory(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_kill_log_user ON realm_kill_log(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_discovered_locations_user ON realm_discovered_locations(user_id, guild_id);
