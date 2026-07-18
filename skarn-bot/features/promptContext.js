const { getChannelState, getUserMemory } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');

function collectContext(userId, guildId, channelId) {
  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);
  const memory = getUserMemory(userId, guildId, 5);
  const memoryLine = memory.length > 0
    ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
    : '';

  return { stateLine, moodLine, relationshipLine, cultureLine, memoryLine };
}

module.exports = { collectContext };
