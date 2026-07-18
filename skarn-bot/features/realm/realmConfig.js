// ===== Race Bonuses =====

const RACE_BONUSES = {
  human:      { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
  elf:        { dex: 3, int: 2 },
  dwarf:      { con: 3, str: 2 },
  demon:      { str: 3, cha: 2, wis: -1 },
  tiefling:   { cha: 3, int: 2 },
  dragonborn: { str: 2, con: 2, cha: 1 },
};

// ===== Class Stats =====

const CLASS_STATS = {
  warrior: {
    base: { str: 12, dex: 8, con: 10, int: 6, wis: 7, cha: 7 },
    primary: 'str',
    secondary: 'con',
  },
  mage: {
    base: { str: 6, dex: 7, con: 7, int: 12, wis: 10, cha: 8 },
    primary: 'int',
    secondary: 'wis',
  },
  rogue: {
    base: { str: 8, dex: 12, con: 8, int: 7, wis: 7, cha: 8 },
    primary: 'dex',
    secondary: 'cha',
  },
  cleric: {
    base: { str: 8, dex: 7, con: 10, int: 7, wis: 12, cha: 6 },
    primary: 'wis',
    secondary: 'con',
  },
  ranger: {
    base: { str: 9, dex: 11, con: 9, int: 7, wis: 9, cha: 5 },
    primary: 'dex',
    secondary: 'wis',
  },
  warlock: {
    base: { str: 7, dex: 8, con: 7, int: 10, wis: 8, cha: 10 },
    primary: 'int',
    secondary: 'cha',
  },
};

// ===== Locations =====

const LOCATIONS = {
  abyssal_gate: {
    name: 'Abyssal Gate',
    description: 'A shattered portal wreathed in ash where the veil between realms is thinnest.',
    connections: ['shadow_market', 'dragon_maw'],
    dangerLevel: 4,
    npcPool: ['gatekeeper', 'lost_soul'],
  },
  shadow_market: {
    name: 'Shadow Market',
    description: 'A labyrinthine bazaar lit by flickering soul-lanterns and hushed bargains.',
    connections: ['abyssal_gate', 'cursed_library', 'whispering_woods'],
    dangerLevel: 2,
    npcPool: ['merchant', 'thief'],
  },
  cursed_library: {
    name: 'Cursed Library',
    description: 'Towering shelves of forbidden tomes that whisper back when read aloud.',
    connections: ['shadow_market', 'ruined_temple'],
    dangerLevel: 3,
    npcPool: ['librarian', 'shade'],
  },
  bone_arena: {
    name: 'Bone Arena',
    description: 'A colosseum of calcified remains where combatants duel for glory and coin.',
    connections: ['obsidian_mines', 'dragon_maw'],
    dangerLevel: 5,
    npcPool: ['champion', 'bookie'],
  },
  whispering_woods: {
    name: 'Whispering Woods',
    description: 'An ancient forest whose trees murmur secrets to those who listen.',
    connections: ['shadow_market', 'ruined_temple', 'obsidian_mines'],
    dangerLevel: 2,
    npcPool: ['hermit', 'sprite'],
  },
  obsidian_mines: {
    name: 'Obsidian Mines',
    description: 'Deep shafts carved into volcanic glass, glittering with rare ore deposits.',
    connections: ['bone_arena', 'whispering_woods'],
    dangerLevel: 3,
    npcPool: ['miner', 'elemental'],
  },
  ruined_temple: {
    name: 'Ruined Temple',
    description: 'The husk of a once-sacred place, now haunted by echoes of old prayers.',
    connections: ['whispering_woods', 'dragon_maw'],
    dangerLevel: 3,
    npcPool: ['priest', 'wraith'],
  },
  dragon_maw: {
    name: "Dragon's Maw",
    description: 'A scorched canyon shaped like the open jaws of a primordial wyrm.',
    connections: ['obsidian_mines', 'ruined_temple'],
    dangerLevel: 5,
    npcPool: ['dragonkin', 'hoarder'],
  },
};

// ===== Item Templates =====

const ITEM_TEMPLATES = {
  weapons: {
    common: [
      { name: 'Rusty Sword', weaponBonus: 1, value: 25 },
      { name: 'Wooden Club', weaponBonus: 2, value: 20 },
    ],
    uncommon: [
      { name: 'Iron Blade', weaponBonus: 4, value: 100 },
      { name: 'War Hammer', weaponBonus: 5, value: 120 },
    ],
    rare: [
      { name: 'Shadow Fang', weaponBonus: 8, value: 300 },
      { name: 'Obsidian Edge', weaponBonus: 9, value: 350 },
    ],
    epic: [
      { name: 'Void Cleaver', weaponBonus: 14, value: 750 },
      { name: "Serpent's Kiss", weaponBonus: 15, value: 800 },
    ],
    legendary: [
      { name: "Dragonrend", weaponBonus: 22, value: 2000 },
      { name: 'Soulrender', weaponBonus: 25, value: 2500 },
    ],
  },
  armor: {
    common: [
      { name: 'Leather Vest', defense: 1, value: 20 },
      { name: 'Cloth Robe', defense: 2, value: 15 },
    ],
    uncommon: [
      { name: 'Chain Mail', defense: 4, value: 90 },
      { name: 'Iron Plate', defense: 5, value: 110 },
    ],
    rare: [
      { name: 'Shadow Cloak', defense: 7, value: 280 },
      { name: 'Obsidian Mantle', defense: 8, value: 320 },
    ],
    epic: [
      { name: 'Void Shroud', defense: 12, value: 700 },
      { name: 'Dragon Scale Mail', defense: 14, value: 850 },
    ],
    legendary: [
      { name: 'Aegis of Ruin', defense: 20, value: 2000 },
      { name: "Wyrmguard Plate", defense: 24, value: 2800 },
    ],
  },
  consumables: {
    common: [
      { name: 'Healing Salve', healAmount: 10, value: 15 },
    ],
    uncommon: [
      { name: 'Health Potion', healAmount: 30, value: 60 },
    ],
    rare: [
      { name: 'Greater Health Potion', healAmount: 70, value: 200 },
    ],
    epic: [
      { name: 'Elixir of Fortitude', healAmount: 150, value: 500 },
    ],
    legendary: [
      { name: 'Phoenix Tear', healAmount: 500, value: 1500 },
    ],
  },
};

// ===== Rarity Weights (for rollRarity) =====

const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 30,
  rare: 13,
  epic: 5,
  legendary: 2,
};

// ===== Enemy Scaling =====

const ENEMY_SCALING = {
  baseHp: 20,
  hpPerLevel: 8,
  baseAttack: 5,
  attackPerLevel: 3,
  baseDefense: 2,
  defensePerLevel: 2,
  xpPerLevel: 15,
  goldPerLevel: 10,
};

// ===== Rate Limit =====

const REALM_RATE_LIMIT = {
  windowMs: 30 * 60 * 1000,
  maxCalls: 30,
};

const REALM_DAILY_CALL_LIMIT = parseInt(process.env.REALM_DAILY_CALL_LIMIT, 10) || 1000;

// ===== Functions =====

function xpForLevel(level) {
  return level * 100 + 50;
}

function hpForLevel(con, level) {
  return 20 + (con * 5) + (level * 3);
}

function rollRarity() {
  const entries = Object.entries(RARITY_WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

module.exports = {
  RACE_BONUSES,
  CLASS_STATS,
  LOCATIONS,
  ITEM_TEMPLATES,
  RARITY_WEIGHTS,
  ENEMY_SCALING,
  REALM_RATE_LIMIT,
  REALM_DAILY_CALL_LIMIT,
  xpForLevel,
  hpForLevel,
  rollRarity,
};
