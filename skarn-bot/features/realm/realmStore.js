const { db } = require('../../db/database');

// ===== Characters =====

function getCharacter(userId, guildId) {
  return db.prepare(
    'SELECT * FROM realm_characters WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
}

function saveCharacter(userId, guildId, data) {
  const now = Date.now();
  const existing = getCharacter(userId, guildId);
  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    db.prepare(
      `UPDATE realm_characters SET ${sets}, updated_at = ? WHERE user_id = ? AND guild_id = ?`
    ).run(...Object.values(data), now, userId, guildId);
  } else {
    const cols = ['user_id', 'guild_id', 'created_at', 'updated_at', ...Object.keys(data)];
    const placeholders = cols.map(() => '?').join(', ');
    const vals = [userId, guildId, now, now, ...Object.values(data)];
    db.prepare(
      `INSERT INTO realm_characters (${cols.join(', ')}) VALUES (${placeholders})`
    ).run(...vals);
  }
}

function deleteCharacterCascade(userId, guildId) {
  const tables = [
    'realm_inventory',
    'realm_quests',
    'realm_npc_memory',
    'realm_discovered_locations',
    'realm_kill_log',
  ];
  const del = db.transaction(() => {
    for (const table of tables) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND guild_id = ?`).run(userId, guildId);
    }
    db.prepare('DELETE FROM realm_characters WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
  });
  del();
}

// ===== Inventory =====

function getInventory(userId, guildId) {
  return db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC'
  ).all(userId, guildId);
}

function addItem(userId, guildId, itemId, name, type, description = '', rarity = 'common', stats = null, value = 0) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO realm_inventory (user_id, guild_id, item_id, name, type, description, rarity, stats, value, equipped, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(userId, guildId, itemId, name, type, description, rarity, stats ? JSON.stringify(stats) : null, value, now);
}

function removeItem(userId, guildId, itemId) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?'
  ).get(userId, guildId, itemId);
  if (!existing) return false;
  db.prepare('DELETE FROM realm_inventory WHERE id = ?').run(existing.id);
  return true;
}

function equipItem(userId, guildId, itemId) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?'
  ).get(userId, guildId, itemId);
  if (!existing) return false;
  if (existing.type === 'weapon' || existing.type === 'armor') {
    db.prepare(
      'UPDATE realm_inventory SET equipped = 0 WHERE user_id = ? AND guild_id = ? AND type = ?'
    ).run(userId, guildId, existing.type);
  }
  db.prepare('UPDATE realm_inventory SET equipped = 1 WHERE id = ?').run(existing.id);
  return true;
}

function unequipItem(userId, guildId, itemId) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?'
  ).get(userId, guildId, itemId);
  if (!existing) return false;
  db.prepare('UPDATE realm_inventory SET equipped = 0 WHERE id = ?').run(existing.id);
  return true;
}

// ===== Quests =====

function getActiveQuests(userId, guildId) {
  return db.prepare(
    'SELECT * FROM realm_quests WHERE user_id = ? AND guild_id = ? AND status = ?'
  ).all(userId, guildId, 'active');
}

function addQuest(userId, guildId, questId, title, description = '', giverNpc = '', objectives = [], rewards = null) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO realm_quests (user_id, guild_id, quest_id, title, description, giver_npc, objectives, rewards, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, questId, title, description, giverNpc, JSON.stringify(objectives), rewards ? JSON.stringify(rewards) : null, 'active', now, now);
}

function updateQuest(userId, guildId, questId, patch) {
  const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
  const values = Object.values(patch);
  values.push(userId, guildId, questId);
  db.prepare(
    `UPDATE realm_quests SET ${sets}, updated_at = ? WHERE user_id = ? AND guild_id = ? AND quest_id = ?`
  ).run(...values, Date.now());
}

function completeQuest(userId, guildId, questId) {
  updateQuest(userId, guildId, questId, {
    status: 'completed',
  });
}

// ===== NPC Memory =====

function addNpcMemory(userId, guildId, npcId, interactionType, summary, sentiment = 0) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO realm_npc_memory (npc_id, user_id, guild_id, interaction_type, summary, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(npcId, userId, guildId, interactionType, summary, sentiment, now);
}

function getNpcMemories(userId, guildId, npcId) {
  return db.prepare(
    'SELECT * FROM realm_npc_memory WHERE npc_id = ? AND user_id = ? AND guild_id = ? ORDER BY created_at DESC'
  ).all(npcId, userId, guildId);
}

function getNpcMemory(userId, guildId, npcId, limit = 5) {
  return db.prepare(
    'SELECT * FROM realm_npc_memory WHERE npc_id = ? AND user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(npcId, userId, guildId, limit);
}

function getNpcRelationship(userId, guildId, npcId) {
  const memories = getNpcMemory(userId, guildId, npcId, 5);
  if (memories.length === 0) return 'neutral';
  const avg = memories.reduce((sum, m) => sum + m.sentiment, 0) / memories.length;
  if (avg >= 2) return 'friendly';
  if (avg <= -2) return 'hostile';
  return 'neutral';
}

function getNpcSentiment(userId, guildId, npcId) {
  const row = db.prepare(
    'SELECT sentiment FROM realm_npc_memory WHERE npc_id = ? AND user_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(npcId, userId, guildId);
  return row ? row.sentiment : 0;
}

// ===== Discovered Locations =====

function discoveredLocation(userId, guildId, locationId) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO realm_discovered_locations (user_id, guild_id, location_id, discovered_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, locationId, now);
}

function getDiscoveredLocations(userId, guildId) {
  return db.prepare(
    'SELECT location_id FROM realm_discovered_locations WHERE user_id = ? AND guild_id = ?'
  ).all(userId, guildId);
}

// ===== Kill Log =====

function logKill(userId, guildId, enemyName, enemyLevel, location, xpEarned, goldEarned) {
  const now = Date.now();
  db.prepare(
    'INSERT INTO realm_kill_log (user_id, guild_id, enemy_name, enemy_level, location, xp_earned, gold_earned, killed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, enemyName, enemyLevel, location, xpEarned, goldEarned, now);
}

function getKillStats(userId, guildId) {
  return db.prepare(
    'SELECT enemy_name, COUNT(*) as kills, SUM(xp_earned) as total_xp, SUM(gold_earned) as total_gold FROM realm_kill_log WHERE user_id = ? AND guild_id = ? GROUP BY enemy_name ORDER BY kills DESC'
  ).all(userId, guildId);
}

// ===== World State =====

function getWorldState(key, guildId) {
  const row = db.prepare(
    'SELECT value FROM realm_world_state WHERE key = ? AND guild_id = ?'
  ).get(key, guildId);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setWorldState(key, guildId, value) {
  const now = Date.now();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(
    'INSERT OR REPLACE INTO realm_world_state (key, guild_id, value, updated_at) VALUES (?, ?, ?, ?)'
  ).run(key, guildId, serialized, now);
}

// ===== Leaderboard =====

function getLeaderboard(guildId, limit = 10) {
  return db.prepare(
    'SELECT user_id, name, level, xp FROM realm_characters WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT ?'
  ).all(guildId, limit);
}

module.exports = {
  getCharacter,
  saveCharacter,
  deleteCharacterCascade,
  getInventory,
  addItem,
  removeItem,
  equipItem,
  unequipItem,
  getActiveQuests,
  addQuest,
  updateQuest,
  completeQuest,
  addNpcMemory,
  getNpcMemories,
  getNpcMemory,
  getNpcRelationship,
  getNpcSentiment,
  discoveredLocation,
  getDiscoveredLocations,
  logKill,
  getKillStats,
  getWorldState,
  setWorldState,
  getLeaderboard,
};
