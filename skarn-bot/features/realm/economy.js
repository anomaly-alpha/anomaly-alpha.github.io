const { getCharacter, saveCharacter, getInventory, addItem, removeItem, db } = require('./realmStore');

// ===== In-Memory Trade Store =====

const activeTrades = new Map();

const TRADE_TIMEOUT = 5 * 60 * 1000;

// ===== canTrade =====

function canTrade(userId, partnerId) {
  if (userId === partnerId) {
    return { ok: false, error: 'Cannot trade with yourself' };
  }

  for (const [, trade] of activeTrades) {
    if (trade.initiator === userId || trade.partner === userId) {
      return { ok: false, error: 'Already in a trade' };
    }
    if (trade.initiator === partnerId || trade.partner === partnerId) {
      return { ok: false, error: 'That player is already in a trade' };
    }
  }

  return { ok: true };
}

// ===== startTrade =====

function startTrade(userId, guildId, partnerId) {
  const check = canTrade(userId, partnerId);
  if (!check.ok) return check;

  const tradeId = `${userId}:${partnerId}:${Date.now()}`;
  const trade = {
    id: tradeId,
    initiator: userId,
    partner: partnerId,
    guildId,
    initiatorOffer: { items: [], gold: 0 },
    partnerOffer: { items: [], gold: 0 },
    initiatorConfirmed: false,
    partnerConfirmed: false,
    startedAt: Date.now(),
    lastActionAt: Date.now(),
  };

  activeTrades.set(tradeId, trade);

  return {
    ok: true,
    tradeId,
    initiator: userId,
    partner: partnerId,
  };
}

// ===== addToTrade =====

function addToTrade(userId, itemId, gold) {
  const trade = findTradeByUser(userId);
  if (!trade) {
    return { ok: false, error: 'No active trade' };
  }

  trade.lastActionAt = Date.now();
  const isInitiator = trade.initiator === userId;
  const offer = isInitiator ? trade.initiatorOffer : trade.partnerOffer;

  if (itemId) {
    const inventory = getInventory(userId, trade.guildId);
    const item = inventory.find(i => i.item_id === itemId);
    if (!item) return { ok: false, error: 'Item not found' };
    if (item.equipped) return { ok: false, error: 'Cannot trade equipped items' };

    offer.items.push({
      itemId: item.item_id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      value: item.value,
    });

    trade.initiatorConfirmed = false;
    trade.partnerConfirmed = false;

    return { ok: true, added: item.name };
  }

  if (gold && gold > 0) {
    const char = getCharacter(userId, trade.guildId);
    if (!char) return { ok: false, error: 'No character found' };
    if (char.gold < gold) return { ok: false, error: 'Not enough gold' };

    offer.gold += gold;
    trade.initiatorConfirmed = false;
    trade.partnerConfirmed = false;

    return { ok: true, added: `${gold} gold` };
  }

  return { ok: false, error: 'Specify an item or gold amount' };
}

// ===== confirmTrade =====

function confirmTrade(userId) {
  const trade = findTradeByUser(userId);
  if (!trade) return { ok: false, error: 'No active trade' };

  trade.lastActionAt = Date.now();
  const isInitiator = trade.initiator === userId;

  if (isInitiator) {
    trade.initiatorConfirmed = true;
  } else {
    trade.partnerConfirmed = true;
  }

  if (trade.initiatorConfirmed && trade.partnerConfirmed) {
    return executeTrade(trade);
  }

  return { ok: true, confirmed: true, pending: true };
}

// ===== executeTrade =====

function executeTrade(trade) {
  const { initiator, partner, guildId, initiatorOffer, partnerOffer } = trade;

  const initChar = getCharacter(initiator, guildId);
  const partChar = getCharacter(partner, guildId);
  if (!initChar || !partChar) {
    return { ok: false, error: 'A player no longer exists' };
  }

  if (initChar.gold < initiatorOffer.gold) {
    return { ok: false, error: 'Initiator no longer has enough gold' };
  }
  if (partChar.gold < partnerOffer.gold) {
    return { ok: false, error: 'Partner no longer has enough gold' };
  }

  for (const item of initiatorOffer.items) {
    const inventory = getInventory(initiator, guildId);
    const invItem = inventory.find(i => i.item_id === item.itemId);
    if (!invItem) return { ok: false, error: `Initiator missing ${item.name}` };
    if (invItem.equipped) return { ok: false, error: `${item.name} is equipped` };
  }

  for (const item of partnerOffer.items) {
    const inventory = getInventory(partner, guildId);
    const invItem = inventory.find(i => i.item_id === item.itemId);
    if (!invItem) return { ok: false, error: `Partner missing ${item.name}` };
    if (invItem.equipped) return { ok: false, error: `${item.name} is equipped` };
  }

  const atomicTrade = db.transaction(() => {
    for (const item of initiatorOffer.items) {
      const invItem = getInventory(initiator, guildId).find(i => i.item_id === item.itemId);
      removeItem(initiator, guildId, item.itemId);
      addItem(partner, guildId, invItem.item_id, invItem.name, invItem.type, invItem.description, invItem.rarity, invItem.stats ? JSON.parse(invItem.stats) : null, invItem.value);
    }

    for (const item of partnerOffer.items) {
      const invItem = getInventory(partner, guildId).find(i => i.item_id === item.itemId);
      removeItem(partner, guildId, item.itemId);
      addItem(initiator, guildId, invItem.item_id, invItem.name, invItem.type, invItem.description, invItem.rarity, invItem.stats ? JSON.parse(invItem.stats) : null, invItem.value);
    }

    const initiatorGoldDelta = partnerOffer.gold - initiatorOffer.gold;
    const partnerGoldDelta = initiatorOffer.gold - partnerOffer.gold;

    if (initiatorGoldDelta !== 0) {
      saveCharacter(initiator, guildId, { gold: initChar.gold + initiatorGoldDelta });
    }
    if (partnerGoldDelta !== 0) {
      saveCharacter(partner, guildId, { gold: partChar.gold + partnerGoldDelta });
    }
  });

  atomicTrade();

  activeTrades.delete(trade.id);

  return {
    ok: true,
    completed: true,
    initiatorItems: initiatorOffer.items.map(i => i.name),
    initiatorGold: initiatorOffer.gold,
    partnerItems: partnerOffer.items.map(i => i.name),
    partnerGold: partnerOffer.gold,
  };
}

// ===== cancelTrade =====

function cancelTrade(userId) {
  const trade = findTradeByUser(userId);
  if (!trade) return { ok: false, error: 'No active trade' };

  activeTrades.delete(trade.id);

  return { ok: true, cancelled: true };
}

// ===== sellToMerchant =====

function sellToMerchant(userId, guildId, itemId, relationship) {
  const char = getCharacter(userId, guildId);
  if (!char) return { ok: false, error: 'No character found' };

  if (relationship === 'hostile') {
    return { ok: false, error: 'The merchant refuses to trade with you' };
  }

  const inventory = getInventory(userId, guildId);
  const item = inventory.find(i => i.item_id === itemId);
  if (!item) return { ok: false, error: 'Item not found' };
  if (item.equipped) return { ok: false, error: 'Cannot sell equipped items' };

  const baseValue = item.value || 10;
  const multiplier = relationship === 'friendly' ? 1.1 : 1.0;
  const goldEarned = Math.floor(baseValue * multiplier);

  removeItem(userId, guildId, itemId);
  saveCharacter(userId, guildId, { gold: char.gold + goldEarned });

  return {
    ok: true,
    sold: item.name,
    goldEarned,
    discount: relationship === 'friendly' ? '10% bonus' : null,
  };
}

// ===== handleTradeTimeout =====

function handleTradeTimeout(userId) {
  const trade = findTradeByUser(userId);
  if (!trade) return null;

  const elapsed = Date.now() - trade.startedAt;
  if (elapsed >= TRADE_TIMEOUT) {
    activeTrades.delete(trade.id);
    return { timedOut: true, tradeId: trade.id };
  }

  return null;
}

// ===== findTradeByUser =====

function findTradeByUser(userId) {
  for (const [, trade] of activeTrades) {
    if (trade.initiator === userId || trade.partner === userId) {
      return trade;
    }
  }
  return null;
}

// ===== getTradeState =====

function getTradeState(userId) {
  const trade = findTradeByUser(userId);
  if (!trade) return null;

  const isInitiator = trade.initiator === userId;
  const myOffer = isInitiator ? trade.initiatorOffer : trade.partnerOffer;
  const theirOffer = isInitiator ? trade.partnerOffer : trade.initiatorOffer;
  const myConfirmed = isInitiator ? trade.initiatorConfirmed : trade.partnerConfirmed;
  const theirConfirmed = isInitiator ? trade.partnerConfirmed : trade.initiatorConfirmed;

  return {
    tradeId: trade.id,
    partner: isInitiator ? trade.partner : trade.initiator,
    myOffer,
    theirOffer,
    myConfirmed,
    theirConfirmed,
    startedAt: trade.startedAt,
  };
}

module.exports = {
  canTrade,
  startTrade,
  addToTrade,
  confirmTrade,
  cancelTrade,
  sellToMerchant,
  handleTradeTimeout,
  getTradeState,
  activeTrades,
  TRADE_TIMEOUT,
};
