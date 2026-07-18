const { getChannelState, getUserMemory, getRelationship } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');

function collectContext(userId, guildId, channelId, opts = {}) {
  const { roleNature = 'casual', userContent = '', interactionCount = 0 } = opts;

  const channelState = getChannelState(channelId, guildId);
  const stateLine = getStateLine(channelState.current_state);
  const moodLine = getMoodLine(guildId);
  const relationshipLine = getRelationshipLine(userId, guildId);
  const cultureLine = getCultureLine(guildId, channelId);
  const memory = getUserMemory(userId, guildId, 5);
  const memoryLine = memory.length > 0
    ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
    : '';

  const warmthLine = getWarmthLine(userId, guildId, roleNature);
  const patienceLine = getPatienceLine(userId, guildId, userContent);
  const callbackLine = getCallbackLine(channelId, userId);
  const gratitudeLine = getGratitudeDirective(userContent);
  const firstOfDayLine = getFirstOfDayLine(userId, guildId);
  const milestoneLine = getMilestoneLine(userId, interactionCount);
  const apologyLine = getApologyLine(userId);

  return {
    stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
    warmthLine, patienceLine, callbackLine, gratitudeLine,
    firstOfDayLine, milestoneLine, apologyLine,
  };
}

module.exports = { collectContext };
