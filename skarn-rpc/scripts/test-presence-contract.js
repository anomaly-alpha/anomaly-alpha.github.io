const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createMoodWindow,
  getLocalDateParts,
  getNextWakeAt,
  isSleepTime,
  loadPresenceContract,
  loadSharedPresenceContract,
  validateLocalPolicy,
  validatePresenceContract,
} = require('../features/presence/presenceContract');
const {
  createMoodState,
  loadMoodState,
  saveMoodState,
} = require('../features/presence/presenceState');
const {
  loadSharedCatalog,
  validateIconRegistry,
  validateSharedCatalog,
} = require('../features/presence/sharedCatalogAdapter');

const root = path.join(__dirname, '..');
const sharedContractPath = path.join(root, '..', 'skarn-bot', 'presence-assets', 'presence-mood-contract.json');
const catalogPath = path.join(root, '..', 'skarn-bot', 'presence-assets', 'presence-phrases.json');
const iconPath = path.join(root, 'data', 'icon-registry.json');
const localContract = loadPresenceContract();
const sharedContract = loadSharedPresenceContract();
const icons = JSON.parse(fs.readFileSync(iconPath, 'utf8'));
const iconKeys = icons.map(icon => icon.key);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skarn-presence-contract-'));

function variant(mutator) {
  return {
    ...catalog,
    phrases: catalog.phrases.map((entry, index) => index === 0 ? mutator({ ...entry }) : { ...entry }),
  };
}

try {
  assert.strictEqual(validateLocalPolicy(JSON.parse(fs.readFileSync(path.join(root, 'config', 'presence-local.json'), 'utf8'))).ok, true);
  assert.strictEqual(localContract.policyRevision, 1);
  assert.strictEqual(localContract.sleepWindow.timeZone, 'America/Toronto');
  assert.strictEqual(validatePresenceContract(localContract).ok, true);
  assert.strictEqual(localContract.moodDwellMs, sharedContract.moodDwellMs);
  assert.deepStrictEqual(localContract.selectionWeights, sharedContract.selectionWeights);

  const winter = Date.UTC(2026, 0, 15, 6, 0, 0);
  const summer = Date.UTC(2026, 6, 15, 5, 0, 0);
  assert.deepStrictEqual(getLocalDateParts(winter, localContract).hour, 1);
  assert.deepStrictEqual(getLocalDateParts(summer, localContract).hour, 1);
  assert.strictEqual(isSleepTime(winter, localContract), true);
  assert.strictEqual(isSleepTime(Date.UTC(2026, 0, 15, 12), localContract), false);
  assert.strictEqual(isSleepTime(summer, localContract), true);
  assert.strictEqual(isSleepTime(Date.UTC(2026, 6, 15, 11), localContract), false);

  const springBefore = Date.UTC(2026, 2, 8, 6, 59, 0);
  const springAfter = Date.UTC(2026, 2, 8, 7, 0, 0);
  assert.strictEqual(getLocalDateParts(springBefore, localContract).hour, 1);
  assert.strictEqual(getLocalDateParts(springAfter, localContract).hour, 3);
  const springWake = getNextWakeAt(Date.UTC(2026, 2, 8, 5), localContract);
  assert.strictEqual(springWake, Date.UTC(2026, 2, 8, 11));
  assert.strictEqual(isSleepTime(springWake - 1, localContract), true);
  assert.strictEqual(isSleepTime(springWake, localContract), false);

  const fallBefore = Date.UTC(2026, 10, 1, 5, 59, 0);
  const fallAfter = Date.UTC(2026, 10, 1, 6, 0, 0);
  assert.strictEqual(getLocalDateParts(fallBefore, localContract).hour, 1);
  assert.strictEqual(getLocalDateParts(fallAfter, localContract).hour, 1);
  const fallWake = getNextWakeAt(Date.UTC(2026, 10, 1, 4), localContract);
  assert.strictEqual(fallWake, Date.UTC(2026, 10, 1, 12));
  assert.strictEqual(isSleepTime(fallWake - 1, localContract), true);
  assert.strictEqual(isSleepTime(fallWake, localContract), false);

  const dormant = createMoodWindow({ now: winter, random: 0.99, process: 'skarn-rpc', contract: localContract });
  assert.strictEqual(dormant.mood, 'dormant');
  assert.strictEqual(dormant.moodUntil, getNextWakeAt(winter, localContract));
  const waking = createMoodWindow({ now: dormant.moodUntil, random: 0.99, process: 'skarn-rpc', contract: localContract });
  assert.notStrictEqual(waking.mood, 'dormant');
  assert.strictEqual(waking.policyRevision, localContract.policyRevision);

  const sharedFromDisk = JSON.parse(fs.readFileSync(sharedContractPath, 'utf8'));
  assert.deepStrictEqual(sharedContract, sharedFromDisk);
  assert.strictEqual(sharedContract.sleepWindow.utcOffset, 0);
  assert.strictEqual(sharedContract.sleepWindow.timeZone, undefined);
  assert.strictEqual(isSleepTime(Date.UTC(2026, 0, 15, 2), sharedContract), true);
  assert.strictEqual(isSleepTime(Date.UTC(2026, 0, 15, 7), sharedContract), false);
  assert.strictEqual(getNextWakeAt(Date.UTC(2026, 0, 15, 2), sharedContract), Date.UTC(2026, 0, 15, 7));

  const statePath = path.join(tempDir, 'rpc-mood-state.json');
  const state = createMoodState({
    process: 'skarn-rpc',
    mood: 'observing',
    moodStartedAt: winter,
    moodUntil: winter + localContract.moodDwellMs,
    revision: 1,
    policyRevision: localContract.policyRevision,
    updatedAt: winter,
  });
  saveMoodState(statePath, state);
  assert.strictEqual(loadMoodState(statePath, winter + 1000).resumable, true);
  assert.strictEqual(loadMoodState(statePath, state.moodUntil).reason, 'expired');
  fs.writeFileSync(statePath, JSON.stringify({ ...state, schemaVersion: 0 }));
  assert.strictEqual(loadMoodState(statePath, winter).reason, 'invalid');
  fs.writeFileSync(statePath, JSON.stringify({ ...state, policyRevision: localContract.policyRevision + 1 }));
  assert.strictEqual(loadMoodState(statePath, winter).reason, 'policy-revision-mismatch');
  fs.writeFileSync(statePath, '{not valid json');
  assert.strictEqual(loadMoodState(statePath, winter).reason, 'malformed');
  assert.strictEqual(loadMoodState(path.join(tempDir, 'missing.json'), winter).reason, 'missing');

  assert.strictEqual(validateIconRegistry(icons).ok, true);
  const byteSafe = variant(entry => ({ ...entry, rpcDetails: '界'.repeat(42) }));
  assert.strictEqual(Buffer.byteLength(byteSafe.phrases[0].rpcDetails, 'utf8'), 126);
  assert.strictEqual(validateSharedCatalog(byteSafe, iconKeys).ok, true);
  const byteTooLong = variant(entry => ({ ...entry, rpcDetails: '界'.repeat(43) }));
  const byteValidation = validateSharedCatalog(byteTooLong, iconKeys);
  assert.strictEqual(byteValidation.ok, false);
  assert.ok(byteValidation.errors.some(error => error.includes('rpcDetails exceeds')));
  const idTooLong = variant(entry => ({ ...entry, id: 'a'.repeat(65) }));
  assert.strictEqual(validateSharedCatalog(idTooLong, iconKeys).ok, false);
  assert.strictEqual(validateIconRegistry([{ key: 'skarn_test', label: '界'.repeat(42) }]).ok, true);
  assert.strictEqual(validateIconRegistry([{ key: 'skarn_test', label: '界'.repeat(43) }]).ok, false);

  const unknownIconCatalog = variant(entry => ({ ...entry, rpcIconKey: 'skarn_unknown_runtime_icon' }));
  const unknownValidation = validateSharedCatalog(unknownIconCatalog, iconKeys);
  assert.strictEqual(unknownValidation.ok, false);
  assert.strictEqual(unknownValidation.unknownIconCount, 1);
  const partialPath = path.join(tempDir, 'partial-unknown.json');
  fs.writeFileSync(partialPath, JSON.stringify(unknownIconCatalog));
  const partialEntries = loadSharedCatalog(partialPath, icons);
  assert.strictEqual(partialEntries.length, catalog.phrases.length - 1);
  assert.ok(partialEntries.every(entry => iconKeys.includes(entry.key)));

  const incompatiblePath = path.join(tempDir, 'all-unknown.json');
  fs.writeFileSync(incompatiblePath, JSON.stringify({
    ...catalog,
    phrases: catalog.phrases.map(entry => ({ ...entry, rpcIconKey: 'skarn_unknown_runtime_icon' })),
  }));
  assert.deepStrictEqual(loadSharedCatalog(incompatiblePath, icons), []);

  console.log('presence contract tests passed: Toronto DST, state migration, UTC regression, UTF-8 limits, and icon quarantine');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
