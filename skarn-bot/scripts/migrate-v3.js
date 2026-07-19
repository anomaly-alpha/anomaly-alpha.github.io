// scripts/migrate-v3.js
// Run: node scripts/migrate-v3.js
const db = require('../db/database');
const fs = require('fs');
const path = require('path');

console.log('Running Phase 2 migration...');

// Create tables (idempotent - schema already creates them on startup)
// This script handles data migration from JSON files

// Migrate reminders from JSON
const remindersPath = path.join(__dirname, '..', 'data', 'reminders.json');
if (fs.existsSync(remindersPath)) {
  try {
    const reminders = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
    if (Array.isArray(reminders) && reminders.length > 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO reminders (id, user_id, channel_id, guild_id, message, remind_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const tx = db.transaction(function(rows) {
        for (const r of rows) {
          insert.run(r.id, r.userId || r.user_id, r.channelId || r.channel_id, r.guildId || r.guild_id, r.message, r.remindAt || r.remind_at, r.createdAt || r.created_at || Date.now());
        }
      });
      tx(reminders);
      console.log('Migrated ' + reminders.length + ' reminders');
    }
  } catch (e) { console.error('Reminder migration error:', e.message); }
}

// Check friends consistency
const friendsPath = path.join(__dirname, '..', 'data', 'friends.json');
if (fs.existsSync(friendsPath)) {
  try {
    const jsonFriends = JSON.parse(fs.readFileSync(friendsPath, 'utf8'));
    const sqliteCount = db.prepare('SELECT COUNT(*) as c FROM friends').get().c;
    console.log('Friends: ' + (jsonFriends.length || 0) + ' in JSON, ' + sqliteCount + ' in SQLite');
    if (sqliteCount === 0 && jsonFriends.length > 0) {
      console.log('WARN: friends.json has data but friends table is empty. Use /addfriend to re-add.');
    }
  } catch (e) { /* ignore */ }
}

console.log('Phase 2 migration complete.');
