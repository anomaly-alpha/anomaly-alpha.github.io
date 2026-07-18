const { LOCATIONS } = require('./realmConfig');
const { getCharacter, saveCharacter, discoveredLocation } = require('./realmStore');

// ===== Location Helpers =====

function getLocation(id) {
  const loc = LOCATIONS[id];
  if (!loc) return null;
  return { id, ...loc };
}

function getConnectedLocations(id) {
  const loc = LOCATIONS[id];
  if (!loc) return [];
  return loc.connections.map(cid => {
    const connected = LOCATIONS[cid];
    if (!connected) return null;
    return { id: cid, ...connected };
  }).filter(Boolean);
}

function moveTo(userId, guildId, locationId) {
  const char = getCharacter(userId, guildId);
  if (!char) return { error: 'No character found' };

  const connected = getConnectedLocations(char.current_location).map(l => l.id);
  if (!connected.includes(locationId)) return { error: 'Location not reachable from here' };

  const loc = LOCATIONS[locationId];
  if (!loc) return { error: `Unknown location '${locationId}'` };

  discoveredLocation(userId, guildId, locationId);
  saveCharacter(userId, guildId, { current_location: locationId });

  return { location: { id: locationId, ...loc }, char };
}

// ===== AI Response Parsing =====

function parseChoices(aiText) {
  const lines = aiText.split('\n');
  const choices = [];
  let narrativeLines = [];

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (match) {
      choices.push({ index: parseInt(match[1], 10), text: match[2].trim() });
    } else {
      if (!choices.length) narrativeLines.push(line);
    }
  }

  const narrative = narrativeLines.join('\n').trim();
  return { narrative, choices };
}

module.exports = {
  getLocation,
  getConnectedLocations,
  moveTo,
  parseChoices,
};
