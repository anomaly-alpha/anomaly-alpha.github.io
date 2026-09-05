const {
  createMoodWindow,
  isSleepTime,
  loadPresenceContract,
  validatePresenceContract,
} = require('./presenceContract');
const { validateMoodState } = require('./presenceState');

const PROCESS_NAME = 'skarn-railway-bot';

function parseStoredState(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function createPresenceMoodCoordinator(options) {
  const config = options || {};
  const contract = config.contract || loadPresenceContract();
  const contractResult = validatePresenceContract(contract);
  if (!contractResult.ok) throw new Error('invalid contract: ' + contractResult.errors.join('; '));
  const clock = config.clock || (() => Date.now());
  const random = config.random || Math.random;
  const readState = config.readState || (() => null);
  const writeState = config.writeState || (() => {});
  let state = null;
  let started = false;

  function canResume(candidate, now) {
    if (!candidate || !validateMoodState(candidate).ok) return false;
    if (candidate.process !== PROCESS_NAME || candidate.moodUntil <= now) return false;
    if (candidate.mood !== 'dormant' && isSleepTime(now, contract)) return false;
    return true;
  }

  function persist(next) {
    writeState(next);
    state = next;
    return state;
  }

  function ensureCurrentMood(now) {
    const currentNow = now === undefined ? clock() : now;
    if (!Number.isFinite(currentNow) || currentNow < 0) throw new RangeError('now must be a non-negative number');
    if (!started) start(currentNow);
    const enteredSleep = state && state.mood !== 'dormant' && isSleepTime(currentNow, contract);
    if (state && state.moodUntil > currentNow && !enteredSleep) return state;
    return persist(createMoodWindow({
      now: currentNow,
      random: random(),
      process: PROCESS_NAME,
      previousState: state,
      contract,
    }));
  }

  function start(now) {
    if (started) return state;
    const currentNow = now === undefined ? clock() : now;
    const stored = parseStoredState(readState());
    if (canResume(stored, currentNow)) {
      state = stored;
    } else {
      state = createMoodWindow({
        now: currentNow,
        random: random(),
        process: PROCESS_NAME,
        previousState: stored,
        contract,
      });
      writeState(state);
    }
    started = true;
    return state;
  }

  function stop() {
    started = false;
  }

  return {
    ensureCurrentMood,
    getState: () => state,
    isStarted: () => started,
    start,
    stop,
  };
}

module.exports = { createPresenceMoodCoordinator, PROCESS_NAME };
