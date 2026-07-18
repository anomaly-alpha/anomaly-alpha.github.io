const getOpenAIClient = require('../../ai/client');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');

const MODEL = 'gpt-5.4-mini';

// ===== Context Builder =====

function buildContextPrompt(character, location, quest, npcMemory, history) {
  const parts = [];

  if (character) {
    parts.push(`Character: ${character.name} (Level ${character.level} ${character.race} ${character.class})` +
      ` — HP ${character.hp_current || character.hp?.current || '?'}/${character.hp_max || character.hp?.max || '?'}` +
      `, STR ${character.strength || character.stats?.str || '?'} DEX ${character.dexterity || character.stats?.dex || '?'}` +
      `, INT ${character.intelligence || character.stats?.int || '?'} WIS ${character.wisdom || character.stats?.wis || '?'}` +
      `, CHA ${character.charisma || character.stats?.cha || '?'}` +
      `, Gold ${character.gold}`);
  }

  if (location) {
    parts.push(`Location: ${location.name} — ${location.description}` +
      (location.npcPool ? ` [NPCs here: ${location.npcPool.join(', ')}]` : ''));
  }

  if (quest) {
    let objectiveText = '';
    if (quest.objectives) {
      try {
        const objectives = typeof quest.objectives === 'string' ? JSON.parse(quest.objectives) : quest.objectives;
        objectiveText = ` Objectives: ${objectives.map(o => `${o.current || 0}/${o.count || 1} ${o.type} ${o.target}`).join('; ')}`;
      } catch { /* objectives parse failed, skip */ }
    }
    parts.push(`Active Quest: ${quest.title} — ${quest.description}${objectiveText}`);
  }

  if (npcMemory && npcMemory.length) {
    const recent = npcMemory.slice(0, 5);
    parts.push(`NPC History: ${recent.map(m => `${m.npc_id} (${m.interaction_type}): ${m.summary}`).join('; ')}`);
  }

  if (history && history.length) {
    const recent = history.slice(-6);
    parts.push(`Recent: ${recent.map(h => `${h.role === 'assistant' ? 'Skarn' : 'Player'}: ${h.content}`).join(' | ')}`);
  }

  return parts.join('\n');
}

// ===== Core AI Call =====

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('AI call timed out')), ms)),
  ]);
}

async function callAi(role, context, message, temperature = 0.8) {
  const client = getOpenAIClient();
  const roleLine = roles[role] || '';
  const systemPrompt = buildSystemPrompt({ roleLine, stateLine: context });
  const maxTokens = roleTokenBudgets[role] || 500;

  const response = await withTimeout(
    client.chat.completions.create({
      model: MODEL,
      temperature,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }),
    30000, // 30 second timeout
  );

  return response.choices[0].message.content;
}

// ===== Generators =====

async function generateBackstory(character, answer) {
  const prompt = `Based on these creation answers, write a 2-3 sentence backstory for the character.\n` +
    `Name: ${character.name}\nRace: ${character.race}\nClass: ${character.class}\n` +
    `Player answers: ${answer}`;
  return callAi('realm', '', prompt, 0.9);
}

async function generateExploration(character, location, quest, history) {
  const context = buildContextPrompt(character, location, quest, null, history);
  const prompt = `The player explores ${location.name}. Generate a scene with:\n` +
    `1. A vivid description of what they encounter (2-3 sentences)\n` +
    `2. Four numbered action choices the player can take next\n\n` +
    `Format exactly:\n[narrative]\n1. [choice]\n2. [choice]\n3. [choice]\n4. [choice]`;
  return callAi('realm', context, prompt, 0.85);
}

async function generateCombatNarration(character, enemy, action, damage, enemyHp, history) {
  const context = buildContextPrompt(character, null, null, null, history);
  const prompt = `Combat scene: ${character.name} uses ${action} against ${enemy.name} for ${damage} damage. ` +
    `${enemy.name} has ${enemyHp} HP remaining. ` +
    `Narrate this action in 1-2 vivid sentences. Keep it kinetic and tactical.`;
  return callAi('realm_combat', context, prompt, 0.8);
}

async function generateNpcDialogue(npc, character, npcMemory) {
  const npcContext = `NPC: ${npc.name} — ${npc.description || npc.role || 'stranger'}`;
  const memoryContext = npcMemory && npcMemory.length
    ? `Past interactions: ${npcMemory.slice(0, 3).map(m => m.summary).join('; ')}`
    : 'No prior interactions.';
  const charContext = buildContextPrompt(character, null, null, null, null);
  const prompt = `Speak as ${npc.name} to ${character.name}. React naturally. ` +
    `${memoryContext}\nKeep dialogue to 1-3 sentences. Stay in character.`;
  return callAi('realm_npc', `${npcContext}\n${charContext}`, prompt, 0.9);
}

async function generateQuestHook(npc, character, location) {
  const charContext = buildContextPrompt(character, location, null, null, null);
  const prompt = `As ${npc.name} in ${location.name}, offer a quest hook to ${character.name} (Level ${character.level} ${character.class}). ` +
    `Return format:\nTitle: [quest title]\nDescription: [1-2 sentence description]\n` +
    `Objective: [single objective]\nReward: [reward description]`;
  return callAi('realm_npc', charContext, prompt, 0.85);
}

module.exports = {
  buildContextPrompt,
  callAi,
  generateBackstory,
  generateExploration,
  generateCombatNarration,
  generateNpcDialogue,
  generateQuestHook,
};
