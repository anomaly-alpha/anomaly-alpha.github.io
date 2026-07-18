const { getInventory, equipItem } = require('./realmStore');
const { ITEM_TEMPLATES, rollRarity } = require('./realmConfig');

// ===== Item Types =====

const ITEM_TYPES = ['weapon', 'armor', 'consumable'];

// Map item type to ITEM_TEMPLATES key (pluralization is inconsistent)
const TYPE_TO_TEMPLATE_KEY = {
  weapon: 'weapons',
  armor: 'armor',
  consumable: 'consumables',
};

// ===== Rarity Prefixes (AI-style name generation) =====

const RARITY_PREFIXES = {
  common: ['Worn', 'Tattered', 'Rusty', 'Crude', 'Simple'],
  uncommon: ['Sturdy', 'Fine', 'Sharp', 'Tempered', 'Hardened'],
  rare: ['Enchanted', 'Shadowy', 'Obsidian', 'Spectral', 'Blessed'],
  epic: ['Void-Touched', 'Dread', 'Cursed', 'Infernal', 'Astral'],
  legendary: ['Mythic', 'Ancient', 'Primordial', 'Divine', 'Eternal'],
};

// ===== RARITY_BONUS — stat multiplier per rarity =====

const RARITY_MULTIPLIER = {
  common: 1,
  uncommon: 1.3,
  rare: 1.7,
  epic: 2.2,
  legendary: 3.0,
};

// ===== generateLoot =====

function generateLoot(dangerLevel, luck) {
  const luckBonus = Math.floor((luck || 10) / 10);

  // Adjusted rarity roll: luck slightly improves rare+ chances
  let rarity = rollRarity();
  if (luckBonus > 0 && rarity === 'common') {
    const rerollChance = Math.min(luckBonus * 0.05, 0.3);
    if (Math.random() < rerollChance) {
      rarity = rollRarity();
    }
  }

  // Pick item type: weapons 35%, armor 35%, consumables 30%
  const typeRoll = Math.random() * 100;
  let type;
  if (typeRoll < 35) type = 'weapon';
  else if (typeRoll < 70) type = 'armor';
  else type = 'consumable';

  const templates = ITEM_TEMPLATES[TYPE_TO_TEMPLATE_KEY[type]]?.[rarity];
  if (!templates || templates.length === 0) {
    return null;
  }

  const template = templates[Math.floor(Math.random() * templates.length)];
  const mult = RARITY_MULTIPLIER[rarity] || 1;

  // Build stat block
  const stats = {};
  if (type === 'weapon') {
    stats.weaponBonus = Math.ceil((template.weaponBonus || 1) * mult * (1 + dangerLevel * 0.1));
  } else if (type === 'armor') {
    stats.defense = Math.ceil((template.defense || 1) * mult * (1 + dangerLevel * 0.1));
  } else if (type === 'consumable') {
    stats.healAmount = Math.ceil((template.healAmount || 10) * mult);
  }

  // Generate AI-style name with rarity prefix
  const prefixes = RARITY_PREFIXES[rarity] || [''];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const name = `${prefix} ${template.name}`;

  const itemId = `${type}_${rarity}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    itemId,
    name: name.trim(),
    type,
    description: `${rarity} ${type} (danger ${dangerLevel})`,
    rarity,
    stats,
    value: Math.ceil((template.value || 10) * mult),
    equipped: 0,
  };
}

// ===== equipBest =====

function equipBest(userId, guildId) {
  const inventory = getInventory(userId, guildId);
  const unequipped = inventory.filter(i => !i.equipped);

  // Find best weapon by weaponBonus
  let bestWeapon = null;
  let bestWeaponBonus = -1;
  // Find best armor by defense
  let bestArmor = null;
  let bestArmorDef = -1;

  for (const item of unequipped) {
    if (item.type === 'weapon') {
      let bonus = 0;
      try { bonus = JSON.parse(item.stats || '{}').weaponBonus || 0; } catch { bonus = 0; }
      if (bonus > bestWeaponBonus) {
        bestWeaponBonus = bonus;
        bestWeapon = item;
      }
    } else if (item.type === 'armor') {
      let def = 0;
      try { def = JSON.parse(item.stats || '{}').defense || 0; } catch { def = 0; }
      if (def > bestArmorDef) {
        bestArmorDef = def;
        bestArmor = item;
      }
    }
  }

  const equipped = [];
  if (bestWeapon) {
    equipItem(userId, guildId, bestWeapon.item_id);
    equipped.push(bestWeapon);
  }
  if (bestArmor) {
    equipItem(userId, guildId, bestArmor.item_id);
    equipped.push(bestArmor);
  }

  return equipped;
}

// ===== getEquipped =====

function getEquipped(userId, guildId) {
  const inventory = getInventory(userId, guildId);
  return inventory.filter(i => i.equipped);
}

// ===== paginateItems =====

function paginateItems(items, page, perPage = 25) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * perPage;
  const end = start + perPage;

  return {
    items: items.slice(start, end),
    page: safePage,
    totalPages,
    totalItems: items.length,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

module.exports = {
  generateLoot,
  equipBest,
  getEquipped,
  paginateItems,
  RARITY_MULTIPLIER,
};
