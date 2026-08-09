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
