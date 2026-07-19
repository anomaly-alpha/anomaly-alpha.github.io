// One-time migration: copies memory_entries(source='etch') into user_memory.
// This ensures no data loss during the transition.
// Run: node scripts/backfill-memory.js
const { db } = require('../db/database');

function backfill() {
  const rows = db.prepare(
    "SELECT user_id, guild_id, content, updated_at FROM memory_entries WHERE source = 'etch' AND type = 'fact' ORDER BY updated_at ASC"
  ).all();

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = db.prepare(
      'SELECT id FROM user_memory WHERE user_id = ? AND guild_id = ? AND fact_text = ?'
    ).get(row.user_id, row.guild_id, row.content);

    if (!existing) {
      db.prepare(
        'INSERT INTO user_memory (user_id, guild_id, fact_text, created_at) VALUES (?, ?, ?, ?)'
      ).run(row.user_id, row.guild_id, row.content, row.updated_at);
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log('Backfill complete: ' + inserted + ' inserted, ' + skipped + ' skipped');
}

backfill();
