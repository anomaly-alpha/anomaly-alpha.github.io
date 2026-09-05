// ===== RAILWAY PRESENCE DATASET AND CYCLER =====
const assert = require('assert');
const {
  loadPresenceContract,
} = require('../../features/presence/presenceContract');
const {
  validateRailwayPhraseDataset,
} = require('../../features/presence/railwayPresenceDataset');
const {
  createPresenceMoodCoordinator,
} = require('../../features/presence/presenceMoodCoordinator');
const {
  createPresenceMoodCycler,
} = require('../../features/presence/presenceMoodCycler');
const {
  buildReviewManifest,
  parseLegacyPool,
} = require('../../scripts/migrate-railway-presence-phrases');

function check(label, condition) {
  console.log(label + ':', condition);
  assert.ok(condition, label);
}

const contract = loadPresenceContract();
const moods = ['dormant', 'observing', 'pondering', 'displeased'];
const phrases = moods.flatMap((mood, moodIndex) => Array.from({ length: 10 }, (_, index) => ({
  id: 'railway-' + mood + '-' + String(index + 1).padStart(2, '0'),
  text: mood + ' thought ' + (index + 1),
  mood,
})));
const dataset = {
  schemaVersion: 1,
  generatedAt: '2026-09-05T00:00:00.000Z',
  phrases,
};

const validDataset = validateRailwayPhraseDataset(dataset);
check('Railway dataset validates', validDataset.ok);
check('Railway dataset counts forty phrases', validDataset.counts.total === 40);
check('Railway dataset covers four moods', validDataset.counts.dormant === 10 && validDataset.counts.observing === 10 && validDataset.counts.pondering === 10 && validDataset.counts.displeased === 10);
const duplicateDataset = {
  ...dataset,
  phrases: [...dataset.phrases, { ...dataset.phrases[0], id: 'railway-duplicate' }],
};
check('normalized duplicate is rejected', !validateRailwayPhraseDataset(duplicateDataset).ok);
const incompleteDataset = {
  ...dataset,
  phrases: dataset.phrases.filter(entry => entry.mood !== 'dormant' || entry.id !== 'railway-dormant-10'),
};
check('mood coverage is required', !validateRailwayPhraseDataset(incompleteDataset).ok);

const legacy = parseLegacyPool(JSON.stringify([' First phrase ', 'SECOND phrase', 'first   phrase', '', 42]));
check('legacy parser removes normalized duplicates', legacy.length === 2);
const review = buildReviewManifest(legacy);
check('review manifest preserves unclassified entries', review.phrases.length === 2 && review.phrases.every(entry => entry.mood === null));
const reviewedManifest = buildReviewManifest(phrases.map(entry => entry.text));
reviewedManifest.phrases = reviewedManifest.phrases.map((entry, index) => ({ ...entry, mood: phrases[index].mood }));
const migratedDataset = require('../../scripts/migrate-railway-presence-phrases').buildDatasetFromReview(reviewedManifest);
check('reviewed manifest builds a valid Railway dataset', migratedDataset.phrases.length === 40);

let now = Date.UTC(2026, 0, 15, 12, 0, 0);
let storedState = null;
const writes = [];
const coordinator = createPresenceMoodCoordinator({
  contract,
  clock: () => now,
  random: () => 0.99,
  readState: () => storedState,
  writeState: state => { storedState = state; writes.push(state); },
});
const first = coordinator.start();
check('coordinator starts observing outside sleep', first.mood === 'observing');
check('coordinator writes initial state', writes.length === 1);
const held = coordinator.ensureCurrentMood(now + contract.moodDwellMs - 1);
check('coordinator holds mood inside window', held.revision === first.revision);
const next = coordinator.ensureCurrentMood(now + contract.moodDwellMs);
check('coordinator advances after dwell', next.revision === first.revision + 1);
now = Date.UTC(2026, 0, 15, 2, 0, 0);
const sleepingCoordinator = createPresenceMoodCoordinator({
  contract,
  clock: () => now,
  random: () => 0.99,
  readState: () => null,
  writeState: () => {},
});
const sleeping = sleepingCoordinator.start();
check('coordinator selects dormant during sleep', sleeping.mood === 'dormant');
check('coordinator holds dormant until wake', sleeping.moodUntil === Date.UTC(2026, 0, 15, 7, 0, 0));

now = Date.UTC(2026, 0, 15, 12, 0, 0);
const activities = [];
const cycler = createPresenceMoodCycler({
  contract,
  dataset,
  coordinator: createPresenceMoodCoordinator({
    contract,
    clock: () => now,
    random: () => 0.99,
    readState: () => null,
    writeState: () => {},
  }),
  clock: () => now,
  setActivity: (text, options) => activities.push({ text, options }),
});
const initialStatus = cycler.getStatus();
check('cycler status is safe before first cycle', initialStatus.enabled && initialStatus.moodCandidateCount === 0);
const cycleResult = cycler.cycle(now);
check('cycler selects current mood phrase', cycleResult.mood === 'observing' && cycleResult.candidateCount === 10);
check('cycler writes Watching activity', activities.length === 1 && activities[0].options.type === 3);
check('cycler phrase belongs to current mood', activities[0].text.indexOf('observing thought') === 0);

console.log('Railway presence smoke passed');
