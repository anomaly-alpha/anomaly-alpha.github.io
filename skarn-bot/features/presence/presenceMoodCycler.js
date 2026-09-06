const { loadPresenceContract, validatePresenceContract } = require('./presenceContract');
const { validateRailwayPhraseDataset } = require('./railwayPresenceDataset');
const { createPresenceUpdateGate } = require('./presenceUpdateGate');
const STATIC_FALLBACK = 'the mortals squabble';
function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function createPresenceMoodCycler(options) {
  const c = options || {}, contract = c.contract || loadPresenceContract(), contractResult = validatePresenceContract(contract);
  if (!contractResult.ok) throw new Error('invalid contract: ' + contractResult.errors.join('; '));
  const dataResult = validateRailwayPhraseDataset(c.dataset, c.validationOptions || { expectedCount: 5000 });
  if (!dataResult.ok) throw new Error('invalid Railway phrase dataset: ' + dataResult.errors.join('; '));
  if (!c.coordinator || typeof c.coordinator.ensureCurrentMood !== 'function') throw new TypeError('presence mood coordinator is required');
  if (typeof c.setActivity !== 'function') throw new TypeError('setActivity is required');
  const clock = c.clock || (() => Date.now()), random = c.random || Math.random, setIntervalFn = c.setInterval || setInterval, clearIntervalFn = c.clearInterval || clearInterval, log = c.log || (() => {}), gate = c.gate || createPresenceUpdateGate({ clock, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, log });
  const entriesByMood = {}, decks = {}, lastByMood = {}; let timer = null, lastPhraseId = null, lastMood = null, lastUpdateAt = 0, lastUpdateResult = 'never', updateErrorCount = 0;
  dataResult.phrases.forEach(entry => { (entriesByMood[entry.mood] || (entriesByMood[entry.mood] = [])).push(entry); });
  Object.keys(entriesByMood).forEach(mood => { decks[mood] = shuffle(entriesByMood[mood], random); });
  function nextPhrase(mood) { const source = entriesByMood[mood] || []; if (!source.length) return { id: 'fallback', text: c.fallbackPhrase || STATIC_FALLBACK, mood, symbol: null }; if (!decks[mood] || !decks[mood].length) decks[mood] = shuffle(source, random); let entry = decks[mood].pop(); if (source.length > 1 && entry.id === lastByMood[mood]) { const swap = decks[mood].pop(); if (swap) { decks[mood].push(entry); entry = swap; } } lastByMood[mood] = entry.id; return entry; }
  function cycle(at) {
    const currentNow = at === undefined ? clock() : at, state = c.coordinator.ensureCurrentMood(currentNow), selected = nextPhrase(state.mood), formatted = selected.symbol ? selected.symbol + ' ' + selected.text : selected.text;
    lastMood = state.mood; lastPhraseId = selected.id; lastUpdateAt = currentNow;
    lastUpdateResult = gate.canAttempt(currentNow) ? 'pending' : (gate.getStatus(currentNow).inFlight ? 'in-flight' : 'suppressed');
    const result = gate.attempt(() => c.setActivity(formatted, { type: 3 }), currentNow);
    result.then(outcome => { lastUpdateResult = outcome.ok ? 'ok' : outcome.reason; if (!outcome.ok && outcome.reason !== 'suppressed' && outcome.reason !== 'in-flight') updateErrorCount++; log('Railway presence: ' + state.mood + ' / ' + selected.id + ' (' + lastUpdateResult + ')'); }).catch(error => { updateErrorCount++; lastUpdateResult = 'error'; log('Railway presence update failed: ' + error.message); });
    return { mood: state.mood, moodRevision: state.revision, candidateCount: dataResult.counts[state.mood] || 0, phraseId: selected.id, result: lastUpdateResult };
  }
  function start() { if (timer) return; cycle(); timer = setIntervalFn(() => { try { cycle(); } catch (error) { updateErrorCount++; lastUpdateResult = 'error'; log('Railway presence cycle failed: ' + error.message); } }, contract.phraseRotationMs); }
  function stop() { if (timer) { clearIntervalFn(timer); timer = null; } }
  function getStatus() { return { enabled: true, datasetCount: dataResult.counts.total, moodCandidateCount: lastMood ? dataResult.counts[lastMood] : 0, lastPhraseId, lastUpdateAt, lastUpdateResult, updateErrorCount, gate: gate.getStatus() }; }
  return { cycle, getStatus, start, stop, gate, notifyDisconnect: at => gate.notifyDisconnect(at) };
}
module.exports = { createPresenceMoodCycler, STATIC_FALLBACK, shuffle };
