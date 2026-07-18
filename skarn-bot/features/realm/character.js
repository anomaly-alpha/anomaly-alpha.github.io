const { getCharacter, saveCharacter, getDiscoveredLocations, getInventory, getKillStats } = require('./realmStore');
const { RACE_BONUSES, CLASS_STATS, xpForLevel, hpForLevel } = require('./realmConfig');

const STAT_MAP = {
  str: 'strength', dex: 'dexterity', con: 'constitution',
  int: 'intelligence', wis: 'wisdom', cha: 'charisma',
};

const MAX_LEVEL = 20;

function createCharacter(userId, guildId, name, race, cls, backstory) {
  const raceKey = race.toLowerCase();
  const classKey = cls.toLowerCase();
  const raceBonus = RACE_BONUSES[raceKey];
  const classData = CLASS_STATS[classKey];
  if (!raceBonus || !classData) {
    return { error: `Invalid race '${race}' or class '${cls}'` };
  }

  const stats = {};
  for (const stat of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
    stats[stat] = classData.base[stat] + (raceBonus[stat] || 0);
  }
  stats.luck = Math.floor(Math.random() * 10) + 1;

  const hpMax = hpForLevel(stats.con, 1);

  const data = {
    name,
    race: raceKey,
    class: classKey,
    backstory: backstory || '',
    level: 1,
    xp: 0,
    hp_current: hpMax,
    hp_max: hpMax,
    strength: stats.str,
    dexterity: stats.dex,
    intelligence: stats.int,
    constitution: stats.con,
    wisdom: stats.wis,
    charisma: stats.cha,
    luck: stats.luck,
    gold: 50,
    current_location: 'abyssal_gate',
  };

  saveCharacter(userId, guildId, data);

  return {
    name,
    race: raceKey,
    class: classKey,
    level: 1,
    xp: 0,
    hp: { current: hpMax, max: hpMax },
    stats,
    gold: 50,
    current_location: 'abyssal_gate',
  };
}

function getCharacterSheet(userId, guildId) {
  const char = getCharacter(userId, guildId);
  if (!char) return null;

  const locations = getDiscoveredLocations(userId, guildId);
  const inventory = getInventory(userId, guildId);
  const kills = getKillStats(userId, guildId);
  const totalKills = kills.reduce((sum, k) => sum + k.kills, 0);

  return {
    name: char.name,
    race: char.race,
    class: char.class,
    backstory: char.backstory,
    level: char.level,
    xp: char.xp,
    hp: { current: char.hp_current, max: char.hp_max },
    stats: {
      str: char.strength,
      dex: char.dexterity,
      con: char.constitution,
      int: char.intelligence,
      wis: char.wisdom,
      cha: char.charisma,
      luck: char.luck,
    },
    gold: char.gold,
    current_location: char.current_location,
    kills: totalKills,
    locations_discovered: locations.length,
    inventory,
  };
}

function addXp(userId, guildId, amount) {
  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  let xp = char.xp + amount;
  let level = char.level;
  let goldGained = 0;
  let leveledUp = false;

  while (level < MAX_LEVEL) {
    const needed = xpForLevel(level);
    if (xp < needed) break;
    xp -= needed;
    level++;
    leveledUp = true;
  }

  if (level >= MAX_LEVEL && xp > 0) {
    goldGained = xp;
    xp = 0;
  }

  const levelsGained = level - char.level;

  const classData = CLASS_STATS[char.class];
  let finalHpMax, finalHpCurrent;

  if (levelsGained > 0) {
    const hpIncrease = levelsGained * 2;
    finalHpMax = char.hp_max + hpIncrease;
    finalHpCurrent = char.hp_current + hpIncrease;
  } else {
    finalHpMax = hpForLevel(char.constitution, level);
    finalHpCurrent = char.hp_current;
  }

  const patch = {
    level,
    xp,
    hp_max: finalHpMax,
    hp_current: finalHpCurrent,
  };
  if (levelsGained > 0) {
    patch.constitution = char.constitution + levelsGained;
    patch[STAT_MAP[classData.primary]] = char[STAT_MAP[classData.primary]] + levelsGained;
    if (classData.secondary !== 'con') {
      patch[STAT_MAP[classData.secondary]] = char[STAT_MAP[classData.secondary]] + levelsGained;
    }
  }
  if (goldGained > 0) patch.gold = char.gold + goldGained;

  saveCharacter(userId, guildId, patch);

  return {
    xpGained: amount,
    level,
    leveledUp,
    xp,
    hp: { current: finalHpCurrent, max: finalHpMax },
    goldGained,
  };
}

function heal(userId, guildId, percent = 0.25) {
  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  const amount = Math.floor(char.hp_max * percent);
  const healed = Math.min(amount, char.hp_max - char.hp_current);
  const newHp = char.hp_current + healed;

  saveCharacter(userId, guildId, { hp_current: newHp });

  return {
    healed,
    hp: { current: newHp, max: char.hp_max },
  };
}

module.exports = {
  createCharacter,
  getCharacterSheet,
  addXp,
  heal,
  MAX_LEVEL,
};
