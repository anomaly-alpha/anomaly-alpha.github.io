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

-- ===== Conversation Graph =====

CREATE TABLE IF NOT EXISTS conversation_threads (
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  topic_summary TEXT,
  topic_tags TEXT DEFAULT '[]',
  sentiment_start REAL,
  sentiment_end REAL,
  message_count INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  archived_at INTEGER,
  PRIMARY KEY (thread_id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sentiment REAL,
  topics TEXT DEFAULT '[]',
  is_question INTEGER DEFAULT 0,
  tokens_est INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id)
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  covers_from INTEGER NOT NULL,
  covers_to INTEGER NOT NULL,
  message_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES conversation_threads(thread_id)
);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  top_topics TEXT DEFAULT '[]',
  peak_hours TEXT DEFAULT '[]',
  avg_message_length REAL DEFAULT 0,
  humor_match REAL DEFAULT 0,
  prefers_long_responses INTEGER DEFAULT 0,
  sentiment_trend REAL DEFAULT 0,
  last_deep_conversation_at INTEGER,
  engagement_score REAL DEFAULT 0,
  last_profile_update_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_thread ON conversation_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_msg_user ON conversation_messages(user_id, guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_thread_user ON conversation_threads(user_id, guild_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_conv_summary_thread ON conversation_summaries(thread_id);

-- ===== Full-Text Search =====

CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(
  content,
  thread_id UNINDEXED,
  user_id UNINDEXED,
  guild_id UNINDEXED,
  role UNINDEXED
);

-- ===== Knowledge Graph =====

CREATE TABLE IF NOT EXISTS knowledge_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  context TEXT,
  confidence REAL DEFAULT 0.5,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, entity_type, entity_name)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  proactive_opt_out INTEGER DEFAULT 1,
  proactive_opt_in INTEGER DEFAULT 0,
  preferred_tone TEXT DEFAULT 'match',
  max_response_length TEXT DEFAULT 'auto',
  allow_nickname INTEGER DEFAULT 0,
  nickname TEXT,
  timezone TEXT,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  context TEXT,
  created_at INTEGER NOT NULL,
  due_after INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at INTEGER
);

CREATE TABLE IF NOT EXISTS relationship_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  milestone_type TEXT NOT NULL,
  milestone_name TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  context TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_graph(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id, status, due_after);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON relationship_milestones(user_id, guild_id);

-- ===== Response Learning =====

CREATE TABLE IF NOT EXISTS response_learning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  before_sentiment REAL NOT NULL,
  after_sentiment REAL NOT NULL,
  diff REAL NOT NULL,
  classification TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_response_learning_user ON response_learning(user_id, guild_id, created_at);

-- ===== Knowledge Base =====

CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  source TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  tags TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  topic,
  summary
);

-- ===== User Emotional Context =====

CREATE TABLE IF NOT EXISTS user_emotional_context (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  emotional_state TEXT NOT NULL DEFAULT 'neutral',
  topics_emotional TEXT DEFAULT '{}',
  last_mood_check INTEGER NOT NULL,
  PRIMARY KEY (user_id, guild_id)
);

-- ===== Skarn Stories =====

CREATE TABLE IF NOT EXISTS skarn_stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  story_text TEXT NOT NULL,
  source TEXT,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skarn_stories_topic ON skarn_stories(topic);

-- ===== Unified Memory =====

CREATE TABLE IF NOT EXISTS memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('etch', 'extracted', 'conversation')),
  type TEXT NOT NULL CHECK(type IN ('fact', 'interest', 'project', 'event', 'preference')),
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  context TEXT,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, guild_id, type, content)
);

CREATE INDEX IF NOT EXISTS idx_memory_user ON memory_entries(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_memory_decay ON memory_entries(last_seen_at, confidence);

-- ===== Rate Limits =====

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON rate_limits(user_id, timestamp);

-- ===== Cooldowns =====

CREATE TABLE IF NOT EXISTS mention_cooldowns (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS interjection_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS active_listen_cooldowns (
  channel_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

-- ===== Sentiment Buffers =====

CREATE TABLE IF NOT EXISTS sentiment_buffers (
  channel_id TEXT PRIMARY KEY,
  messages TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- ===== Banter Chains =====

CREATE TABLE IF NOT EXISTS banter_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  chain_data TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_banter_user ON banter_chains(user_id, guild_id, channel_id);

-- ===== Callbacks =====

CREATE TABLE IF NOT EXISTS callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  user_id TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_callbacks_cleanup ON callbacks(channel_id, created_at);

-- ===== Guild Config =====

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

-- ===== User Levels =====

CREATE TABLE IF NOT EXISTS user_levels (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- ===== Friends =====

CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  power TEXT,
  note TEXT
);

-- ===== AI Usage =====

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_type)
);

-- ===== App Flags (ephemeral key-value with optional TTL) =====

CREATE TABLE IF NOT EXISTS app_flags (
  flag_key TEXT PRIMARY KEY,
  flag_value TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_app_flags_expire ON app_flags(expires_at);

-- ===== App State (persistent bot-level key-value) =====

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
