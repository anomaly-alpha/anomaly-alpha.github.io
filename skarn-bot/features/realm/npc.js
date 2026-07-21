const realmStore = require('./realmStore');
const aiDriver = require('./aiDriver');

// ===== NPC Templates =====

const PERSONALITIES = ['sardonic', 'warm', 'mysterious', 'gruff', 'cheerful', 'melancholy', 'cunning', 'pious'];

const NPC_TEMPLATES = {
  gatekeeper:    { name: 'The Gatekeeper',   role: 'quest_giver',  baseSentiment: 0 },
  lost_soul:     { name: 'Lost Soul',         role: 'neutral',      baseSentiment: -1 },
  merchant:      { name: 'Shadow Merchant',   role: 'merchant',     baseSentiment: 0 },
  thief:         { name: 'Whisper Thief',     role: 'neutral',      baseSentiment: -1 },
  librarian:     { name: 'Cursed Librarian',  role: 'quest_giver',  baseSentiment: 0 },
  shade:         { name: 'Shade',             role: 'neutral',      baseSentiment: -1 },
  champion:      { name: 'Bone Champion',     role: 'combat_npc',   baseSentiment: 0 },
  bookie:        { name: 'Arena Bookie',      role: 'merchant',     baseSentiment: 1 },
  hermit:        { name: 'Woodland Hermit',   role: 'quest_giver',  baseSentiment: 1 },
  sprite:        { name: 'Whisper Sprite',    role: 'neutral',      baseSentiment: 1 },
  miner:         { name: 'Obsidian Miner',    role: 'merchant',     baseSentiment: 0 },
  elemental:     { name: 'Fire Elemental',    role: 'neutral',      baseSentiment: -2 },
  priest:        { name: 'Ruined Priest',     role: 'quest_giver',  baseSentiment: 1 },
  wraith:        { name: 'Temple Wraith',     role: 'enemy',        baseSentiment: -3 },
  dragonkin:     { name: 'Dragonkin',         role: 'neutral',      baseSentiment: -2 },
  hoarder:       { name: 'Hoarder',           role: 'merchant',     baseSentiment: -1 },
};

// ===== NPC Generation =====

function generateNpc(npcId, locationId) {
  const template = NPC_TEMPLATES[npcId];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  return {
    id: npcId,
    name: template ? template.name : npcId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    role: template ? template.role : 'neutral',
    location: locationId,
    personality,
    baseSentiment: template ? template.baseSentiment : 0,
  };
}

// ===== NPC Relationship =====

function getNpcRelationship(npcId, userId, guildId) {
  return realmStore.getNpcRelationship(userId, guildId, npcId);
}

// ===== NPC Interaction =====

async function handleNpcInteraction(userId, guildId, npc, character, playerChoice) {
  const memory = realmStore.getNpcMemory(userId, guildId, npc.id, 5);
  const relationship = realmStore.getNpcRelationship(userId, guildId, npc.id);

  if (relationship === 'hostile' && npc.role !== 'enemy') {
    npc.role = 'enemy';
  }

  const dialogue = await aiDriver.generateNpcDialogue(npc, character, memory, guildId);

  let sentiment = 0;
  const choice = playerChoice.toLowerCase();
  if (choice.includes('thank') || choice.includes('help')) sentiment = 2;
  else if (choice.includes('threaten') || choice.includes('attack')) sentiment = -3;
  else if (choice.includes('buy') || choice.includes('trade')) sentiment = 1;

  realmStore.addNpcMemory(userId, guildId, npc.id, 'dialogue', `Player said: ${playerChoice.substring(0, 100)}`, sentiment);

  return { dialogue, relationship };
}

module.exports = { generateNpc, handleNpcInteraction, getNpcRelationship };
