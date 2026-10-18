// Versioned migrations — user_version = number of applied migrations.
// Every migration must be idempotent (runs inside a transaction).

const MIGRATIONS = [
  {
    version: 1,
    name: 'add_reminder_giveaway_indexes',
    up(db) {
      db.prepare('CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, delivered)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_giveaways_ends ON giveaways(ends_at, ended)').run();
    },
  },
  {
    version: 2,
    name: 'add_daily_news_published_at',
    up(db) {
      db.prepare('DELETE FROM daily_news').run(); // stale search-era cache; repopulated by next fetch (grill Q2)
      // Column-existence check: on a FRESH DB the schema.sql already created
      // published_at (database.js:19 exec's schema.sql before migrations run),
      // so an unconditional ALTER would throw "duplicate column name".
      const cols = db.prepare('PRAGMA table_info(daily_news)').all().map(c => c.name);
      if (cols.indexOf('published_at') === -1) {
        db.prepare('ALTER TABLE daily_news ADD COLUMN published_at INTEGER').run();
      }
    },
  },
  {
    version: 3,
    name: 'drop_mention_cooldowns',
    up(db) {
      db.prepare('DROP TABLE IF EXISTS mention_cooldowns').run(); // orphaned 2026-08-08: helpers removed, zero references remain
    },
  },
  {
    version: 4,
    name: 'add_rolling_message_archive',
    up(db) {
      db.prepare("CREATE TABLE IF NOT EXISTS message_activity_archive (event_id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, user_id TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('created', 'edited', 'deleted')), content_before TEXT, content_after TEXT, event_at INTEGER NOT NULL, source_created_at INTEGER NOT NULL)").run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_message_activity_archive_retention ON message_activity_archive(guild_id, event_at)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_message_activity_archive_message ON message_activity_archive(guild_id, message_id, event_at)').run();
    },
  },
  {
    version: 5,
    name: 'add_channel_context_storage',
    up(db) {
      db.prepare('CREATE TABLE IF NOT EXISTS channel_context_messages (message_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, captured_at INTEGER NOT NULL, reference_message_id TEXT, related_user_id TEXT, is_skarn INTEGER NOT NULL DEFAULT 0 CHECK (is_skarn IN (0, 1)))').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_channel_context_messages_window ON channel_context_messages(guild_id, channel_id, created_at)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_channel_context_messages_author ON channel_context_messages(guild_id, author_id, created_at)').run();
      db.prepare(`CREATE TABLE IF NOT EXISTS channel_context_summary_segments (segment_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL, summary_text TEXT NOT NULL, covers_from INTEGER NOT NULL, covers_to INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, source_author_ids TEXT NOT NULL CHECK (json_valid(source_author_ids) AND json_type(source_author_ids) = 'array'), source_message_ids TEXT NOT NULL CHECK (json_valid(source_message_ids) AND json_type(source_message_ids) = 'array'), CHECK (covers_to >= covers_from))`).run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_channel_context_summary_segments_window ON channel_context_summary_segments(guild_id, channel_id, covers_from, covers_to)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_channel_context_summary_segments_author ON channel_context_summary_segments(guild_id, channel_id, updated_at)').run();
    },
  },
  {
    version: 6,
    name: 'mark_skarn_messages_in_channel_context',
    up(db) {
      const columns = db.prepare('PRAGMA table_info(channel_context_messages)').all().map(column => column.name);
      if (!columns.includes('is_skarn')) db.prepare('ALTER TABLE channel_context_messages ADD COLUMN is_skarn INTEGER NOT NULL DEFAULT 0 CHECK (is_skarn IN (0, 1))').run();
    },
  },
  {
    version: 7,
    name: 'attribute_shared_skarn_replies_for_forget',
    up(db) {
      const columns = db.prepare('PRAGMA table_info(channel_context_messages)').all().map(column => column.name);
      if (!columns.includes('related_user_id')) db.prepare('ALTER TABLE channel_context_messages ADD COLUMN related_user_id TEXT').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_channel_context_messages_related_user ON channel_context_messages(guild_id, related_user_id, created_at)').run();
    },
  },
];

function runMigrations(db) {
  const current = db.pragma('user_version', { simple: true });
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    const tx = db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    });
    tx();
    console.log(`[DB] Migration ${m.version} (${m.name}) applied`);
  }
}

module.exports = { MIGRATIONS, runMigrations };
