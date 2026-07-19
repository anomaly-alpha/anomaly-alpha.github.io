/**
 * Skarn Bot v2 Data Migration
 * Run ONCE during the v2 upgrade deployment.
 * Before: bot is stopped
 * After: all old data copied to new tables, old tables ready to drop
 * Usage: node scripts/migrate-v2.js
 */

const path = require('path');
const fs = require('fs');

// Load database
const db = require('../db/database');

// ===== 1. user_memory --> memory_entries (source='etch') =====
console.log('[Migrate] Migrating user_memory --> memory_entries...');
const oldFacts = db.db.prepare('SELECT * FROM user_memory').all();
let count = 0;
for (const f of oldFacts) {
  try {
    db.db.prepare(
      `INSERT OR IGNORE INTO memory_entries
       (user_id, guild_id, source, type, content, confidence, first_seen_at, last_seen_at, updated_at)
       VALUES (?, ?, 'etch', 'fact', ?, 1.0, ?, ?, ?)`
    ).run(f.user_id, f.guild_id, f.fact_text, f.created_at, f.created_at, f.created_at);
    count++;
  } catch (e) {
    console.error('[Migrate] Failed to migrate fact ' + f.id + ':', e.message);
  }
}
console.log('[Migrate] Migrated ' + count + ' / ' + oldFacts.length + ' etch facts');

// ===== 2. knowledge_graph --> memory_entries (source='extracted') =====
console.log('[Migrate] Migrating knowledge_graph --> memory_entries...');
const oldEntities = db.db.prepare('SELECT * FROM knowledge_graph').all();
let entityCount = 0;
for (const e of oldEntities) {
  try {
    db.db.prepare(
      `INSERT OR IGNORE INTO memory_entries
       (user_id, guild_id, source, type, content, confidence, context, first_seen_at, last_seen_at, updated_at)
       VALUES (?, ?, 'extracted', ?, ?, ?, ?, ?, ?, ?)`
    ).run(e.user_id, e.guild_id, e.entity_type, e.entity_name, e.confidence,
      e.context, e.first_seen_at, e.last_seen_at, e.last_seen_at);
    entityCount++;
  } catch (err) {
    console.error('[Migrate] Failed to migrate entity ' + e.id + ':', err.message);
  }
}
console.log('[Migrate] Migrated ' + entityCount + ' / ' + oldEntities.length + ' entities');

// ===== 3. user_preferences: proactive_opt_out --> proactive_opt_in =====
console.log('[Migrate] Adding proactive_opt_in column...');
try {
  db.db.prepare('ALTER TABLE user_preferences ADD COLUMN proactive_opt_in INTEGER DEFAULT 0').run();
  console.log('[Migrate] Column added (or already exists)');
} catch (e) {
  if (!e.message.includes('duplicate column')) {
    console.error('[Migrate] ALTER TABLE failed:', e.message);
  } else {
    console.log('[Migrate] Column already exists, skipping');
  }
}
console.log('[Migrate] Flipping proactive_opt_out --> proactive_opt_in...');
db.db.prepare(
  'UPDATE user_preferences SET proactive_opt_in = CASE WHEN proactive_opt_out = 0 THEN 1 ELSE 0 END'
).run();
console.log('[Migrate] Preferences migrated');

// ===== 4. data/config.json --> guild_config =====
console.log('[Migrate] Migrating config.json --> guild_config...');
const configPath = path.join(__dirname, '..', 'data', 'config.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let configCount = 0;
  for (const [guildId, settings] of Object.entries(config)) {
    for (const [key, value] of Object.entries(settings)) {
      try {
        const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        db.db.prepare('INSERT OR REPLACE INTO guild_config (guild_id, key, value) VALUES (?, ?, ?)')
          .run(guildId, key, strVal);
        configCount++;
      } catch (e) {
        console.error('[Migrate] Failed to migrate config ' + guildId + '.' + key + ':', e.message);
      }
    }
  }
  console.log('[Migrate] Migrated ' + configCount + ' config entries');
} else {
  console.log('[Migrate] No config.json found, skipping');
}

// ===== 5. data/levels.json --> user_levels =====
console.log('[Migrate] Migrating levels.json --> user_levels...');
const levelsPath = path.join(__dirname, '..', 'data', 'levels.json');
if (fs.existsSync(levelsPath)) {
  const levels = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
  let levelCount = 0;
  for (const [guildId, users] of Object.entries(levels)) {
    for (const [userId, data] of Object.entries(users)) {
      try {
        db.db.prepare('INSERT OR REPLACE INTO user_levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)')
          .run(guildId, userId, data.xp || 0, data.level || 0);
        levelCount++;
      } catch (e) {
        console.error('[Migrate] Failed to migrate level ' + guildId + '/' + userId + ':', e.message);
      }
    }
  }
  console.log('[Migrate] Migrated ' + levelCount + ' level entries');
} else {
  console.log('[Migrate] No levels.json found, skipping');
}

// ===== 6. data/friends.json --> friends =====
console.log('[Migrate] Migrating friends.json --> friends...');
const friendsPath = path.join(__dirname, '..', 'data', 'friends.json');
if (fs.existsSync(friendsPath)) {
  const friendsData = JSON.parse(fs.readFileSync(friendsPath, 'utf8'));
  let friendCount = 0;
  for (const f of friendsData) {
    try {
      db.db.prepare('INSERT OR IGNORE INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)')
        .run(f.code, f.name, f.power || '', f.note || null);
      friendCount++;
    } catch (e) {
      console.error('[Migrate] Failed to migrate friend ' + f.code + ':', e.message);
    }
  }
  console.log('[Migrate] Migrated ' + friendCount + ' friends');
} else {
  console.log('[Migrate] No friends.json found, skipping');
}

// ===== 7. data/ai-stats.json --> ai_usage =====
console.log('[Migrate] Migrating ai-stats.json --> ai_usage...');
const statsPath = path.join(__dirname, '..', 'data', 'ai-stats.json');
if (fs.existsSync(statsPath)) {
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  let statsCount = 0;
  if (stats.messageCount) {
    for (const [userId, cnt] of Object.entries(stats.messageCount)) {
      db.db.prepare('INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, ?)')
        .run(userId, 'messages_sent', cnt);
      statsCount++;
    }
  }
  if (stats.responseCount) {
    for (const [userId, cnt] of Object.entries(stats.responseCount)) {
      db.db.prepare('INSERT OR REPLACE INTO ai_usage (user_id, stat_type, count) VALUES (?, ?, ?)')
        .run(userId, 'responses_received', cnt);
      statsCount++;
    }
  }
  console.log('[Migrate] Migrated ' + statsCount + ' AI usage stats');
} else {
  console.log('[Migrate] No ai-stats.json found, skipping');
}

console.log('[Migrate] Migration complete.');
console.log('[Migrate] You may now: (1) drop old tables, (2) remove JSON files, (3) restart bot');
