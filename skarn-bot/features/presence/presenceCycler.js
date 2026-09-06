const { getAppState, setAppState } = require('../../db/ops');
const { loadPresenceContract } = require('./presenceContract');
const { createPresenceMoodCoordinator } = require('./presenceMoodCoordinator');
const { createPresenceMoodCycler, STATIC_FALLBACK } = require('./presenceMoodCycler');
const { loadRailwayPhraseDataset } = require('./railwayPresenceDataset');

function createCycler(client, contract, dataset, fallback, validationOptions) {
  const coordinator = createPresenceMoodCoordinator({ contract, readState: () => getAppState('skarn_presence_mood'), writeState: state => setAppState('skarn_presence_mood', JSON.stringify(state)) });
  const cycler = createPresenceMoodCycler({ contract, dataset, validationOptions, coordinator, setActivity: (text, options) => client.user.setActivity(text, options), log: line => console.log('[Presence] ' + line), fallbackPhrase: fallback });
  if (typeof client.on === 'function') {
    const markDisconnected = () => cycler.notifyDisconnect();
    client.on('shardDisconnect', markDisconnected);
    client.on('shardError', markDisconnected);
  }
  return cycler;
}
function startPresenceCycler(client) {
  if (!client || !client.user || typeof client.user.setActivity !== 'function') return null;
  let contract;
  try {
    contract = loadPresenceContract();
    const dataset = loadRailwayPhraseDataset();
    const cycler = createCycler(client, contract, dataset);
    cycler.start();
    console.log('[Presence] Loaded canonical catalog: ' + dataset.phrases.length + ' phrases');
    return cycler;
  } catch (error) {
    console.error('[Presence] Canonical catalog unavailable; using static fallback: ' + error.message);
    try {
      contract = contract || loadPresenceContract();
      const fallback = { schemaVersion: 1, generatedAt: new Date(0).toISOString(), phrases: [{ id: 'fallback', text: STATIC_FALLBACK, mood: 'observing', symbol: null, rpcDetails: STATIC_FALLBACK, rpcState: 'Static fallback', rpcIconKey: 'skarn_eye' }] };
      const cycler = createCycler(client, contract, fallback, STATIC_FALLBACK, { expectedCount: 1, minPerMood: 0, maxEntries: 1 });
      cycler.start();
      return cycler;
    } catch (fallbackError) {
      console.error('[Presence] Static fallback unavailable: ' + fallbackError.message);
      try {
        const result = client.user.setActivity(STATIC_FALLBACK, { type: 3 });
        if (result && typeof result.catch === 'function') result.catch(error => console.error('[Presence] Static fallback update failed: ' + error.message));
      } catch (ignored) {}
      return null;
    }
  }
}
module.exports = { startPresenceCycler };
