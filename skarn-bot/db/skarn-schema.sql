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

CREATE TABLE IF NOT EXISTS realm_world_state (
  key TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (key, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_realm_inventory_user ON realm_inventory(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_quests_user ON realm_quests(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_npc_memory_user ON realm_npc_memory(npc_id, user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_realm_kill_log_user ON realm_kill_log(user_id, guild_id);

-- ===== Persona Depth System =====

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

CREATE TABLE IF NOT EXISTS guild_mood (
  guild_id TEXT PRIMARY KEY,
  current_mood TEXT NOT NULL DEFAULT 'neutral',
  last_activity_at INTEGER NOT NULL,
  last_mood_shift_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS server_culture (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  ngram TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, channel_id, ngram)
);

CREATE INDEX IF NOT EXISTS idx_user_relationship_guild ON user_relationship(guild_id, familiarity);
