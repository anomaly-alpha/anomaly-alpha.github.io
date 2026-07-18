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
    const values = Object.values(data);
    values.push(userId, guildId);
    db.prepare(
      `UPDATE realm_characters SET ${sets}, updated_at = ? WHERE user_id = ? AND guild_id = ?`
    ).run(...values, now);
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
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ?'
  ).all(userId, guildId);
}

function addItem(userId, guildId, itemName, itemType = 'misc', quantity = 1, stats = {}) {
  const now = Date.now();
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_name = ?'
  ).get(userId, guildId, itemName);
  if (existing) {
    db.prepare(
      'UPDATE realm_inventory SET quantity = quantity + ? WHERE id = ?'
    ).run(quantity, existing.id);
  } else {
    db.prepare(
      'INSERT INTO realm_inventory (user_id, guild_id, item_name, item_type, quantity, equipped, stats, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(userId, guildId, itemName, itemType, quantity, JSON.stringify(stats), now);
  }
}

function removeItem(userId, guildId, itemName, quantity = 1) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_name = ?'
  ).get(userId, guildId, itemName);
  if (!existing) return false;
  if (existing.quantity <= quantity) {
    db.prepare('DELETE FROM realm_inventory WHERE id = ?').run(existing.id);
  } else {
    db.prepare('UPDATE realm_inventory SET quantity = quantity - ? WHERE id = ?').run(quantity, existing.id);
  }
  return true;
}

function equipItem(userId, guildId, itemName) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_name = ?'
  ).get(userId, guildId, itemName);
  if (!existing) return false;
  db.prepare('UPDATE realm_inventory SET equipped = 1 WHERE id = ?').run(existing.id);
  return true;
}

function unequipItem(userId, guildId, itemName) {
  const existing = db.prepare(
    'SELECT * FROM realm_inventory WHERE user_id = ? AND guild_id = ? AND item_name = ?'
  ).get(userId, guildId, itemName);
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

function addQuest(userId, guildId, questName, description = '', objectives = [], rewardXp = 0, rewardGold = 0) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO realm_quests (user_id, guild_id, quest_name, description, status, objectives, reward_xp, reward_gold, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, questName, description, 'active', JSON.stringify(objectives), rewardXp, rewardGold, now);
}

function updateQuest(userId, guildId, questName, patch) {
  const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
  const values = Object.values(patch);
  values.push(userId, guildId, questName);
  db.prepare(
    `UPDATE realm_quests SET ${sets} WHERE user_id = ? AND guild_id = ? AND quest_name = ?`
  ).run(...values);
}

function completeQuest(userId, guildId, questName) {
  updateQuest(userId, guildId, questName, {
    status: 'completed',
    completed_at: Date.now(),
  });
}

// ===== NPC Memory =====

function addNpcMemory(userId, guildId, npcName, memoryText, relationship = 0) {
  const now = Date.now();
  db.prepare(
    'INSERT OR REPLACE INTO realm_npc_memory (user_id, guild_id, npc_name, memory_text, relationship, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, guildId, npcName, memoryText, relationship, now);
}

function getNpcMemory(userId, guildId, npcName) {
  return db.prepare(
    'SELECT * FROM realm_npc_memory WHERE user_id = ? AND guild_id = ? AND npc_name = ?'
  ).get(userId, guildId, npcName);
}

function getNpcRelationship(userId, guildId, npcName) {
  const row = db.prepare(
    'SELECT relationship FROM realm_npc_memory WHERE user_id = ? AND guild_id = ? AND npc_name = ?'
  ).get(userId, guildId, npcName);
  return row ? row.relationship : 0;
}

// ===== Discovered Locations =====

function discoveredLocation(userId, guildId, locationName) {
  const now = Date.now();
  db.prepare(
    'INSERT OR IGNORE INTO realm_discovered_locations (user_id, guild_id, location_name, discovered_at) VALUES (?, ?, ?, ?)'
  ).run(userId, guildId, locationName, now);
}

function getDiscoveredLocations(userId, guildId) {
  return db.prepare(
    'SELECT location_name FROM realm_discovered_locations WHERE user_id = ? AND guild_id = ?'
  ).all(userId, guildId);
}

// ===== Kill Log =====

function logKill(userId, guildId, creatureName, region = 'unknown') {
  const now = Date.now();
  db.prepare(
    'INSERT INTO realm_kill_log (user_id, guild_id, creature_name, region, killed_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, guildId, creatureName, region, now);
}

function getKillStats(userId, guildId) {
  return db.prepare(
    'SELECT creature_name, COUNT(*) as kills FROM realm_kill_log WHERE user_id = ? AND guild_id = ? GROUP BY creature_name ORDER BY kills DESC'
  ).all(userId, guildId);
}

// ===== World State =====

function getWorldState(guildId, key) {
  const row = db.prepare(
    'SELECT value FROM realm_world_state WHERE guild_id = ? AND key = ?'
  ).get(guildId, key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setWorldState(guildId, key, value) {
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
  getNpcMemory,
  getNpcRelationship,
  discoveredLocation,
  getDiscoveredLocations,
  logKill,
  getKillStats,
  getWorldState,
  setWorldState,
  getLeaderboard,
};
