// ===== PRESENCE MOOD CONTRACT AND STATE =====
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  MOOD_IDS,
  loadPresenceContract,
  validatePresenceContract,
  isSleepTime,
  createMoodWindow,
} = require('../../features/presence/presenceContract');
const {
  createMoodState,
  validateMoodState,
  loadMoodState,
  saveMoodState,
} = require('../../features/presence/presenceState');

function check(label, condition) {
  console.log(label + ':', condition);
  assert.ok(condition, label);
}

const contract = loadPresenceContract();
const expectedMoods = ['dormant', 'observing', 'pondering', 'displeased'];

assert.deepStrictEqual(MOOD_IDS, expectedMoods);
assert.deepStrictEqual(contract.moods, expectedMoods);
assert.strictEqual(contract.sleepWindow.startHour, 1);
assert.strictEqual(contract.sleepWindow.endHour, 7);
assert.strictEqual(contract.sleepWindow.utcOffset, 0);
assert.strictEqual(contract.moodDwellMs, 10 * 60 * 1000);
assert.strictEqual(contract.phraseRotationMs, 10 * 1000);
assert.strictEqual(contract.selectionWeights.observing, 0.85);
assert.strictEqual(contract.selectionWeights.pondering, 0.10);
assert.strictEqual(contract.selectionWeights.displeased, 0.05);
assert.strictEqual(contract.maintenance.localIntervalMs, 12 * 60 * 60 * 1000);
assert.strictEqual(contract.maintenance.railwayIntervalMs, 24 * 60 * 60 * 1000);
assert.strictEqual(contract.maintenance.maxBatchSize, 50);
check('contract validates', validatePresenceContract(contract).ok);
check('invalid mood contract rejected', !validatePresenceContract({ ...contract, moods: ['angry'] }).ok);

const normalNow = Date.UTC(2026, 0, 15, 12, 0, 0);
const sleepNow = Date.UTC(2026, 0, 15, 2, 0, 0);
check('01:00 is sleep', isSleepTime(Date.UTC(2026, 0, 15, 1, 0, 0), contract));
check('06:59 is sleep', isSleepTime(Date.UTC(2026, 0, 15, 6, 59, 0), contract));
check('07:00 is awake', !isSleepTime(Date.UTC(2026, 0, 15, 7, 0, 0), contract));
check('normal window selects displeased at 0', createMoodWindow({
  now: normalNow,
  random: 0,
  process: 'skarn-rpc',
  contract,
}).mood === 'displeased');
check('normal window selects pondering at .10', createMoodWindow({
  now: normalNow,
  random: 0.10,
  process: 'skarn-rpc',
  contract,
}).mood === 'pondering');
const observingWindow = createMoodWindow({
  now: normalNow,
  random: 0.99,
  process: 'skarn-rpc',
  contract,
});
check('normal window selects observing at .99', observingWindow.mood === 'observing');
check('normal window lasts ten minutes', observingWindow.moodUntil === normalNow + contract.moodDwellMs);
const dormantWindow = createMoodWindow({
  now: sleepNow,
  random: 0.99,
  process: 'skarn-railway-bot',
  contract,
});
check('sleep window selects dormant', dormantWindow.mood === 'dormant');
check('sleep window ends at wake boundary', dormantWindow.moodUntil === Date.UTC(2026, 0, 15, 7, 0, 0));

const resumed = createMoodWindow({
  now: normalNow + contract.moodDwellMs,
  random: 0.99,
  process: 'skarn-rpc',
  previousState: { ...observingWindow, revision: 4 },
  contract,
});
check('mood revision increments', resumed.revision === 5);
check('state validates', validateMoodState(resumed).ok);
check('unknown mood state rejected', !validateMoodState({ ...resumed, mood: 'angry' }).ok);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-presence-state-'));
const statePath = path.join(tempDir, 'rpc-mood-state.json');
const state = createMoodState({
  process: 'skarn-rpc',
  mood: 'observing',
  moodStartedAt: normalNow,
  moodUntil: normalNow + contract.moodDwellMs,
  revision: 1,
  updatedAt: normalNow,
});
saveMoodState(statePath, state);
const loaded = loadMoodState(statePath, normalNow + 1000);
check('saved state resumes while unexpired', loaded.resumable && loaded.state.mood === 'observing');
saveMoodState(statePath, resumed);
const replaced = loadMoodState(statePath, normalNow + 1000);
check('state replacement resumes the newer window', replaced.resumable && replaced.state.revision === 5);
const expired = loadMoodState(statePath, resumed.moodUntil);
check('expired state is reported, not resumed', !expired.resumable && expired.reason === 'expired');
fs.writeFileSync(statePath, '{not valid json');
const malformed = loadMoodState(statePath, normalNow);
check('malformed state is rejected by the loader', !malformed.resumable && malformed.reason === 'malformed');
fs.writeFileSync(statePath, JSON.stringify({ ...state, moodUntil: state.moodStartedAt }));
const reversed = loadMoodState(statePath, normalNow);
check('reversed state is rejected by the loader', !reversed.resumable && reversed.reason === 'invalid');

console.log('presence mood smoke passed');
