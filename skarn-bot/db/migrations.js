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
