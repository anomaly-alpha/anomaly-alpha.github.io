const { getCrisisResponse } = require('../safety/crisisResponse');

const DISTRESS_PHRASES = [
  'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'self harm',
  'hurt myself', 'cant go on', 'can t go on', 'cannot go on', 'no reason to live', 'dont want to live', 'don t want to live',
  'want to end it', 'going to hurt myself',
];

const ISOLATION_PHRASES = [
  'you are the only one', 'you re the only one', 'youre the only one', 'only person i talk to',
  'only one i talk to', 'no one else to talk to', 'no one else i can talk to', 'nobody else to talk to',
];

function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasDistressSignal(text) {
  const normalized = ' ' + normalize(text) + ' ';
  return DISTRESS_PHRASES.some(phrase => normalized.includes(' ' + phrase + ' '));
}

function containsMinorDisclosure(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    let ageIndex = -1;
    if (tokens[i] === 'i' && tokens[i + 1] === 'am') ageIndex = i + 2;
    else if (tokens[i] === 'im') ageIndex = i + 1;
    else if (tokens[i] === 'i' && tokens[i + 1] === 'm') ageIndex = i + 2;
    else if (tokens[i] === 'i' && tokens[i + 1] === 'turn') ageIndex = i + 2;
    else if (tokens[i] === 'i' && tokens[i + 1] === 'just' && tokens[i + 2] === 'turned') ageIndex = i + 3;
    if (ageIndex >= 0 && ageIndex < tokens.length) {
      const age = Number(tokens[ageIndex]);
      if (tokens[ageIndex] === 'minor' || tokens[ageIndex] === 'underage' || (age >= 0 && age <= 17)) return true;
    }
  }
  return tokens.includes('minor') || tokens.includes('underage');
}

function needsGrounding(text) {
  const normalized = normalize(text);
  const tokens = normalized.split(' ').filter(Boolean);
  return containsMinorDisclosure(tokens) || ISOLATION_PHRASES.some(phrase => normalized.includes(phrase));
}

function getCrisisReply() {
  return getCrisisResponse().content;
}

function getGroundingLine() {
  return 'You are a bot character, and you hope this person has trusted people in their life beyond this conversation too. Let that come through plainly and without pressure.';
}

module.exports = { hasDistressSignal, needsGrounding, getCrisisReply, getGroundingLine };
