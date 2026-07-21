const getOpenAIClient = require('../../ai/client');
const { buildSystemPrompt } = require('../../persona/identity');
const { selectModel } = require('../../features/intelligence/modelRouter');
const { roles, roleTokenBudgets } = require('../../persona/roles');

// Realm-specific context builder
function buildRealmContext(character, location, npc, activeQuests, npcMemory, guildId) {
  const lines = [];
  if (character) lines.push('Character: ' + character.name + ', Level ' + character.level + ' ' + character.race + ' ' + character.class);
  if (location) lines.push('Location: ' + location.name + (location.description ? ' - ' + location.description : ''));
  if (npc) lines.push('NPC: ' + npc.name + (npc.description ? ' - ' + npc.description : '') + (npc.role ? ' (' + npc.role + ')' : ''));
  if (activeQuests && activeQuests.length) {
    lines.push('Active quests: ' + activeQuests.map(function(q) { return q.title + (q.status === 'completed' ? ' (completed)' : ''); }).join('; '));
  }
  if (npcMemory && npcMemory.length) {
    lines.push('Past interactions: ' + npcMemory.slice(0, 3).map(function(m) { return m.summary; }).join('; '));
  }
  return lines.join('\n');
}

async function callAi(role, context, message, temperature) {
  temperature = temperature || 0.8;
  var client = getOpenAIClient();
  var roleLine = roles[role] || '';
  var systemPrompt = buildSystemPrompt({ roleLine: roleLine, stateLine: context });
  var maxTokens = roleTokenBudgets[role] || 500;
  var model = selectModel(message);

  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 30000);

  try {
    var response = await client.chat.completions.create({
      model: model,
      temperature: temperature,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    }, { signal: controller.signal });
    return response.choices[0].message.content;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateBackstory(character) {
  var context = buildRealmContext(character, null, null, null, null, null);
  return callAi('realm', context, 'Generate a backstory for ' + character.name + ' the ' + character.race + ' ' + character.class + '.', 0.9);
}

async function generateExploration(character, location, activeQuests) {
  var context = buildRealmContext(character, location, null, activeQuests, null, null);
  return callAi('realm', context, 'Describe ' + character.name + ' exploring ' + location.name + '. What do they see?', 0.85);
}

async function generateCombatNarration(character, enemy, combatLog) {
  var context = buildRealmContext(character, null, null, null, null, null);
  return callAi('realm_combat', context, 'Combat: ' + character.name + ' vs ' + enemy.name + '. Recent actions: ' + combatLog.slice(-3).join('; '), 0.8);
}

async function generateNpcDialogue(npc, character, npcMemory, guildId) {
  // guildId is accepted but realm_omens injection happens later when the omen feature is built
  var context = buildRealmContext(character, null, npc, null, npcMemory, guildId);
  return callAi('realm_npc', context, 'Speak as ' + npc.name + ' to ' + character.name, 0.9);
}

async function generateQuestHook(npc, character, location) {
  var context = buildRealmContext(character, location, npc, null, null, null);
  return callAi('realm_npc', context, npc.name + ' has a task for ' + character.name + '. What is it?', 0.85);
}

module.exports = { generateBackstory, generateExploration, generateCombatNarration, generateNpcDialogue, generateQuestHook, callAi };
