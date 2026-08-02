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
