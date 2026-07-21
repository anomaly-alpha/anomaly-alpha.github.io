const realmStore = require('./realmStore');
const { logSignal } = require('../serverMemory/signalCapture');

const MAX_ACTIVE_QUESTS = 3;

const QUEST_TYPES = ['kill', 'fetch', 'explore', 'escort', 'puzzle', 'boss'];

// ===== canAcceptQuest =====

function canAcceptQuest(userId, guildId) {
  const active = realmStore.getActiveQuests(userId, guildId);
  return active.length < MAX_ACTIVE_QUESTS;
}

// ===== createQuest =====

function createQuest(userId, guildId, questData) {
  if (!canAcceptQuest(userId, guildId)) {
    return { error: 'Quest log full', activeCount: realmStore.getActiveQuests(userId, guildId).length };
  }

  const questId = questData.id || `quest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const objectives = (questData.objectives || []).map(obj => ({
    type: obj.type || 'kill',
    target: obj.target || '',
    count: obj.count || 1,
    current: 0,
  }));

  realmStore.addQuest(
    userId,
    guildId,
    questId,
    questData.title || 'Untitled Quest',
    questData.description || '',
    questData.giver || questData.giverNpc || '',
    objectives,
    questData.rewards || null
  );

  return { questId, objectives, rewards: questData.rewards };
}

// ===== checkQuestProgress =====

function checkQuestProgress(userId, guildId, eventType, target) {
  const active = realmStore.getActiveQuests(userId, guildId);
  const completed = [];

  for (const quest of active) {
    let objectives;
    try {
      objectives = JSON.parse(quest.objectives);
    } catch {
      continue;
    }

    let changed = false;
    let allDone = true;

    for (const obj of objectives) {
      if (obj.current == null) obj.current = 0;
      if (obj.count == null) obj.count = 1;

      if (obj.current >= obj.count) continue;

      if (obj.type === eventType && obj.target === target) {
        obj.current = Math.min(obj.current + 1, obj.count);
        changed = true;
      }

      if (obj.current < obj.count) allDone = false;
    }

    if (!changed) continue;

    realmStore.updateQuest(userId, guildId, quest.quest_id, {
      objectives: JSON.stringify(objectives),
    });

    if (allDone) {
      realmStore.updateQuest(userId, guildId, quest.quest_id, {
        status: 'completed',
      });
      logSignal(guildId, null, 'realm_milestone', 'Quest completed: ' + quest.title, userId);
      let rewards;
      try {
        rewards = JSON.parse(quest.rewards);
      } catch {
        rewards = quest.rewards;
      }
      completed.push({ questId: quest.quest_id, title: quest.title, rewards });
    }
  }

  return completed;
}

// ===== completeQuest =====

function completeQuest(userId, guildId, questId) {
  const active = realmStore.getActiveQuests(userId, guildId);
  const quest = active.find(q => q.quest_id === questId);
  if (!quest) {
    return { error: 'Quest not found or already completed' };
  }

  let objectives;
  try {
    objectives = JSON.parse(quest.objectives);
  } catch {
    objectives = [];
  }

  const allDone = objectives.every(obj => (obj.current || 0) >= (obj.count || 1));
  if (!allDone) {
    return { error: 'Objectives not complete', objectives };
  }

  realmStore.completeQuest(userId, guildId, questId);

  let rewards;
  try {
    rewards = JSON.parse(quest.rewards);
  } catch {
    rewards = quest.rewards;
  }

  return { questId, title: quest.title, rewards };
}

module.exports = {
  canAcceptQuest,
  createQuest,
  checkQuestProgress,
  completeQuest,
  QUEST_TYPES,
  MAX_ACTIVE_QUESTS,
};
