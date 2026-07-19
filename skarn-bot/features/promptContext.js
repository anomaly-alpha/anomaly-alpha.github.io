const { getChannelState, getUserMemory, getRelationship } = require('../db/database');
const { getStateLine } = require('./channelState/stateTracker');
const { getRelationshipLine } = require('./relationship/relationshipTracker');
const { getMoodLine } = require('./mood/moodManager');
const { getCultureLine } = require('./culture/cultureTracker');
const { getWarmthLine, getPatienceLine } = require('./warmth/warmthManager');
const { getCallbackLine } = require('./humor/callbackEngine');
const { getGratitudeDirective, getFirstOfDayLine, getMilestoneLine, getApologyLine } = require('./etiquette/etiquetteEngine');
const { assembleContext } = require('./conversation/contextAssembler');

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

  // Gate persona depth lines behind relationship familiarity
  const rel = getRelationship(userId, guildId);
  const familiarity = rel ? rel.familiarity : 0;

  const patienceLine = getPatienceLine(userId, guildId, userContent);
  const callbackLine = familiarity >= 50 ? getCallbackLine(channelId, userId) : '';
  const gratitudeLine = familiarity >= 15 ? getGratitudeDirective(userContent) : '';
  const firstOfDayLine = familiarity >= 15 ? getFirstOfDayLine(userId, guildId) : '';
  const milestoneLine = familiarity >= 15 ? getMilestoneLine(userId, interactionCount) : '';
  const apologyLine = familiarity >= 15 ? getApologyLine(userId) : '';

  const convContext = assembleContext(userId, guildId, channelId);
  const conversationLine = convContext || '';

  return {
    stateLine, moodLine, relationshipLine, cultureLine, memoryLine,
    warmthLine, patienceLine, callbackLine, gratitudeLine,
    firstOfDayLine, milestoneLine, apologyLine, conversationLine,
  };
}

module.exports = { collectContext };
