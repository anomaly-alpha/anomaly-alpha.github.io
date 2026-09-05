const { loadPresenceContract, validatePresenceContract } = require('./presenceContract');
const { validateRailwayPhraseDataset } = require('./railwayPresenceDataset');

const STATIC_FALLBACK = 'the mortals squabble';

function createPresenceMoodCycler(options) {
  const config = options || {};
  const contract = config.contract || loadPresenceContract();
  const contractResult = validatePresenceContract(contract);
  if (!contractResult.ok) throw new Error('invalid contract: ' + contractResult.errors.join('; '));
  const datasetResult = validateRailwayPhraseDataset(config.dataset);
  if (!datasetResult.ok) throw new Error('invalid Railway phrase dataset: ' + datasetResult.errors.join('; '));
  if (!config.coordinator || typeof config.coordinator.ensureCurrentMood !== 'function') {
    throw new TypeError('presence mood coordinator is required');
  }
  if (typeof config.setActivity !== 'function') throw new TypeError('setActivity is required');
  const clock = config.clock || (() => Date.now());
  const setIntervalFn = config.setInterval || setInterval;
  const clearIntervalFn = config.clearInterval || clearInterval;
  const log = config.log || (() => {});
  let timer = null;
  let cursor = 0;
  let lastPhraseId = null;
  let lastMood = null;
  let lastUpdateAt = 0;
  let lastUpdateResult = 'never';
  let updateErrorCount = 0;

  function cycle(now) {
    const currentNow = now === undefined ? clock() : now;
    const moodState = config.coordinator.ensureCurrentMood(currentNow);
    lastMood = moodState.mood;
    const candidates = datasetResult.phrases.filter(entry => entry.mood === moodState.mood);
    const selected = candidates.length > 0
      ? candidates[cursor++ % candidates.length]
      : { id: 'fallback', text: config.fallbackPhrase || STATIC_FALLBACK, mood: moodState.mood };
    const degraded = candidates.length === 0;
    try {
      config.setActivity(selected.text, { type: 3 });
      lastUpdateResult = degraded ? 'degraded-fallback' : 'ok';
      lastPhraseId = selected.id;
      lastUpdateAt = currentNow;
      log('Railway presence: ' + moodState.mood + ' / ' + selected.id + ' (' + candidates.length + ' candidates)');
    } catch (error) {
      updateErrorCount++;
      lastUpdateResult = 'error';
      lastUpdateAt = currentNow;
      log('Railway presence update failed: ' + error.message);
    }
    return {
      mood: moodState.mood,
      moodRevision: moodState.revision,
      candidateCount: candidates.length,
      phraseId: selected.id,
      result: lastUpdateResult,
    };
  }

  function start() {
    if (timer) return;
    cycle();
    timer = setIntervalFn(() => cycle(), contract.phraseRotationMs);
  }

  function stop() {
    if (!timer) return;
    clearIntervalFn(timer);
    timer = null;
  }

  function getStatus() {
    return {
      enabled: true,
      datasetCount: datasetResult.counts.total,
      moodCandidateCount: lastMood ? datasetResult.phrases.filter(entry => entry.mood === lastMood).length : 0,
      lastPhraseId,
      lastUpdateAt,
      lastUpdateResult,
      updateErrorCount,
    };
  }

  return { cycle, getStatus, start, stop };
}

module.exports = { createPresenceMoodCycler, STATIC_FALLBACK };
