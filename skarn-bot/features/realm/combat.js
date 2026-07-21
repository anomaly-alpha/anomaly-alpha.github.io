const { getCharacter, saveCharacter, getInventory, logKill } = require('./realmStore');
const { ENEMY_SCALING, CLASS_STATS } = require('./realmConfig');
const { generateCombatNarration } = require('./aiDriver');
const { canCall, recordCall, canGuildCall, incrementGuildDaily } = require('./realmRateLimit');
const { logSignal } = require('../serverMemory/signalCapture');

// ===== In-Memory Combat Store =====

const activeCombats = new Map();

// ===== Danger Level Scaling =====

const DANGER_NAMES = {
  1: ['Feral Rat', 'Lost Puppy', 'Angry Squirrel', 'Dust Bunny'],
  2: ['Cave Bat', 'Giant Spider', 'Rogue Goblin', 'Stone Serpent'],
  3: ['Skeleton', 'Orc Scout', 'Cursed Spirit', 'Shadow Stalker'],
  4: ['Bone Knight', 'Void Wraith', 'Dark Shaman', 'Abyssal Horror'],
  5: ['Dragon Whelp', 'Lich', 'Demon Lord', 'Ancient Guardian'],
};

// ===== rollEnemy =====

function rollEnemy(dangerLevel) {
  const dl = Math.max(1, Math.min(5, dangerLevel));
  const level = Math.max(1, Math.floor(Math.random() * dl * 2) + 1);
  const hp = ENEMY_SCALING.baseHp + (level * ENEMY_SCALING.hpPerLevel);
  const attack = ENEMY_SCALING.baseAttack + (level * ENEMY_SCALING.attackPerLevel);
  const defense = ENEMY_SCALING.baseDefense + (level * ENEMY_SCALING.defensePerLevel);

  const namePool = DANGER_NAMES[dl] || DANGER_NAMES[1];
  const name = namePool[Math.floor(Math.random() * namePool.length)];

  return {
    name,
    level,
    hp,
    maxHp: hp,
    attack,
    defense,
    xpReward: level * ENEMY_SCALING.xpPerLevel,
    goldReward: level * ENEMY_SCALING.goldPerLevel,
    dangerLevel: dl,
  };
}

// ===== startCombat =====

function startCombat(userId, guildId, enemy, locationId) {
  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  const combatId = `${userId}:${guildId}`;
  const combat = {
    id: combatId,
    userId,
    guildId,
    enemy,
    locationId,
    round: 0,
    isDefending: false,
    startedAt: Date.now(),
    lastActionAt: Date.now(),
    history: [],
    timeout: null,
  };

  const timeout = setTimeout(() => {
    handleTimeout(userId, guildId);
    activeCombats.delete(combatId);
  }, 5 * 60 * 1000);
  combat.timeout = timeout;

  activeCombats.set(combatId, combat);

  return {
    combatId,
    enemy,
    playerHp: char.hp_current,
    playerMaxHp: char.hp_max,
  };
}

// ===== processCombatRound =====

async function processCombatRound(userId, guildId, playerAction, isDefending) {
  const combatId = `${userId}:${guildId}`;
  const combat = activeCombats.get(combatId);
  if (!combat) return { error: 'No active combat' };

  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  combat.round++;
  combat.lastActionAt = Date.now();
  combat.isDefending = isDefending;

  const action = playerAction.toLowerCase();
  let playerDamage = 0;
  let enemyDamage = 0;
  let fleeAttempt = false;
  let fleeSuccess = false;
  let isCrit = false;

  // Get equipped weapon bonus
  const inventory = getInventory(userId, guildId);
  const equippedWeapon = inventory.find(i => i.type === 'weapon' && i.equipped);
  let weaponBonus = 0;
  if (equippedWeapon) {
    try {
      const stats = JSON.parse(equippedWeapon.stats);
      weaponBonus = stats.weaponBonus || 0;
    } catch {
      weaponBonus = 0;
    }
  }

  // Get primary stat
  const classData = CLASS_STATS[char.class];
  const statMap = {
    str: 'strength', dex: 'dexterity', con: 'constitution',
    int: 'intelligence', wis: 'wisdom', cha: 'charisma',
  };
  const primaryStatKey = statMap[classData.primary];
  const primaryStat = char[primaryStatKey] || 10;

  // Player action
  if (action.includes('flee') || action.includes('escape') || action.includes('run')) {
    fleeAttempt = true;
    const playerSpeed = char.dexterity || 10;
    const enemySpeed = combat.enemy.level * 2 + 5;
    const speedDiff = (playerSpeed - enemySpeed) / 10;
    let fleeChance = 0.4 + (speedDiff * 0.05);
    fleeChance = Math.max(0.1, Math.min(0.9, fleeChance));
    fleeSuccess = Math.random() < fleeChance;
  } else if (action.includes('attack') || action.includes('strike') || action.includes('hit')) {
    // Player attack
    const base = primaryStat + weaponBonus;
    const critChance = (char.luck || 10) / 100;
    isCrit = Math.random() < critChance;
    const multiplier = isCrit ? 2 : 1;
    playerDamage = Math.max(1, Math.floor(base * multiplier) - combat.enemy.defense);
  } else if (action.includes('defend') || action.includes('block') || action.includes('shield')) {
    // Defend action — no damage, but enemy damage halved
    isDefending = true;
    combat.isDefending = true;
  } else {
    // Default attack for any other action
    const base = primaryStat + weaponBonus;
    const critChance = (char.luck || 10) / 100;
    isCrit = Math.random() < critChance;
    const multiplier = isCrit ? 2 : 1;
    playerDamage = Math.max(1, Math.floor(base * multiplier) - combat.enemy.defense);
  }

  // Enemy attack (if player didn't flee successfully)
  if (!fleeSuccess) {
    const enemyBase = combat.enemy.attack;
    const defenseMultiplier = combat.isDefending ? 2 : 1;
    const playerDefense = getArmorDefense(inventory);
    enemyDamage = Math.max(1, enemyBase - Math.floor(playerDefense * defenseMultiplier));
  }

  // Apply damage to enemy
  if (playerDamage > 0) {
    combat.enemy.hp -= playerDamage;
    combat.enemy.hp = Math.max(0, combat.enemy.hp);
  }

  // Apply damage to player
  let newHp = char.hp_current;
  if (enemyDamage > 0) {
    newHp = Math.max(0, char.hp_current - enemyDamage);
  }

  // Persist player HP
  saveCharacter(userId, guildId, { hp_current: newHp });

  // Build round result
  const roundResult = {
    round: combat.round,
    action: playerAction,
    playerDamage,
    enemyDamage,
    isCrit,
    isDefending: combat.isDefending,
    fleeAttempt,
    fleeSuccess,
    playerHp: newHp,
    playerMaxHp: char.hp_max,
    enemyHp: combat.enemy.hp,
    enemyMaxHp: combat.enemy.maxHp,
    enemyName: combat.enemy.name,
  };

  combat.history.push(roundResult);

  // Clear timeout on round actions
  if (combat.timeout) clearTimeout(combat.timeout);

  // Check outcomes
  let outcome = null;
  let xpGained = 0;
  let goldGained = 0;

  if (fleeSuccess) {
    outcome = 'flee';
  } else if (combat.enemy.hp <= 0) {
    outcome = 'victory';
    xpGained = combat.enemy.xpReward;
    goldGained = combat.enemy.goldReward;

    // Log kill
    logKill(userId, guildId, combat.enemy.name, combat.enemy.level, combat.locationId, xpGained, goldGained);
    logSignal(guildId, null, 'realm_milestone', combat.enemy.name + ' defeated', userId);

    // Award gold
    saveCharacter(userId, guildId, { gold: char.gold + goldGained });

    // Clear combat
    activeCombats.delete(combatId);
  } else if (newHp <= 0) {
    outcome = 'defeat';

    // Defeat penalty: lose 50% gold
    const goldPenalty = Math.floor(char.gold * 0.5);
    const newGold = char.gold - goldPenalty;
    saveCharacter(userId, guildId, { gold: newGold, hp_current: 1 });

    // Clear combat
    activeCombats.delete(combatId);

    roundResult.goldPenalty = goldPenalty;
    roundResult.goldLost = goldPenalty;
  }

  // Generate AI narration (rate-limited)
  let narration = null;
  if (canCall(userId) && canGuildCall(guildId)) {
    try {
      narration = await generateCombatNarration(
        char,
        combat.enemy,
        [playerAction, ...combat.history.slice(-3)]
      );
      // Filter out meta-text the AI sometimes generates
      if (narration && /warmaster|didn't respond|apolog|sorry|can't|unable|error|failed/i.test(narration)) {
        narration = null;
      }
      recordCall(userId);
      incrementGuildDaily(guildId);
    } catch {
      narration = null;
    }
  }

  return {
    ...roundResult,
    outcome,
    xpGained,
    goldGained,
    narration,
  };
}

// ===== getArmorDefense =====

function getArmorDefense(inventory) {
  const equippedArmor = inventory.find(i => i.type === 'armor' && i.equipped);
  if (!equippedArmor) return 0;
  try {
    const stats = JSON.parse(equippedArmor.stats);
    return stats.defense || 0;
  } catch {
    return 0;
  }
}

// ===== handleTimeout =====

function handleTimeout(userId, guildId) {
  const combatId = `${userId}:${guildId}`;
  const combat = activeCombats.get(combatId);
  if (!combat) return { error: 'No active combat' };

  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  // Apply 10% gold penalty, no XP/loot
  const goldPenalty = Math.floor(char.gold * 0.1);
  const newGold = char.gold - goldPenalty;
  saveCharacter(userId, guildId, { gold: newGold });

  // Clear combat
  activeCombats.delete(combatId);

  return {
    outcome: 'timeout',
    goldPenalty,
    goldLost: goldPenalty,
    playerHp: char.hp_current,
    roundsElapsed: combat.round,
  };
}

// ===== getCombatState =====

function getCombatState(userId, guildId) {
  const combatId = `${userId}:${guildId}`;
  const combat = activeCombats.get(combatId);
  if (!combat) return null;

  return {
    combatId: combat.id,
    enemy: combat.enemy,
    locationId: combat.locationId,
    round: combat.round,
    isDefending: combat.isDefending,
    startedAt: combat.startedAt,
    lastActionAt: combat.lastActionAt,
    historyLength: combat.history.length,
  };
}

// ===== clearCombat =====

function clearCombat(userId, guildId) {
  const combatId = `${userId}:${guildId}`;
  const combat = activeCombats.get(combatId);
  if (combat && combat.timeout) clearTimeout(combat.timeout);
  const deleted = activeCombats.delete(combatId);
  return deleted;
}

module.exports = {
  rollEnemy,
  startCombat,
  processCombatRound,
  handleTimeout,
  getCombatState,
  clearCombat,
};
