// ===== Schedulers =====
const { startScheduler } = require('../../lib/weatherScheduler');
const { startProactiveScheduler } = require('../proactive/scheduler');
const { processDueReminders } = require('../remind/remind.handler');
const { fetchNews } = require('../news/newsFetcher');
const { postDigest } = require('../news/newsDigest');
const { runDecayPass } = require('../channelState/stateDecay');
const { cleanCallbacks } = require('../humor/callbackEngine');
const { cleanChains } = require('../humor/comedyTiming');
const { cleanWarmth } = require('../warmth/warmthManager');
const { runDecay } = require('../relationship/relationshipTracker');
const { evaluateGrowth } = require('../wisdom/growthTracker');
const { generateLoreBatch } = require('../wisdom/storyEngine');
const { summarizeOldThreads } = require('../conversation/summarizer');
const { updateAllProfiles } = require('../conversation/profileUpdater');
const {
  decayMemoryEntries, cleanCooldowns, pruneRateLimits, pruneExpiredFlags,
  pruneOldMessages, pruneSentimentBuffers, pruneBanterChains, pruneCallbacks, db,
} = require('../../db/database');
const { initReactionTracking, pruneReactionCounters } = require('../serverMemory/signalCapture');
const { runChronicleJob } = require('../serverMemory/chronicle/chronicleJob');
const { runOmenJob } = require('../serverMemory/omen/omenJob');
const { pruneSignals } = require('../serverMemory/signalStore');
const { startPresenceCycler } = require('../presence/presenceCycler');

function startSchedulers(client) {
  function safeRun(fn, name) {
    return function() {
      try {
        var result = fn();
        if (result && typeof result.catch === 'function') {
          result.catch(function(e) { console.error('[' + name + '] Job error:', e.message); });
        }
      } catch (e) { console.error('[' + name + '] Job error:', e.message); }
    };
  }
  setInterval(safeRun(evaluateGrowth, 'Growth'), 7 * 24 * 60 * 60 * 1000);
  safeRun(evaluateGrowth, 'Growth')();
  setInterval(safeRun(generateLoreBatch, 'Lore'), 60 * 60 * 1000);
  safeRun(generateLoreBatch, 'Lore')();

  startPresenceCycler(client);

  startScheduler(client);
  startProactiveScheduler(client);
  setInterval(() => { processDueReminders(client).catch(e => console.error('[Reminder] Tick error:', e.message)); }, 30 * 1000);

  setInterval(() => {
    fetchNews().then(count => { if (count > 0) console.log('[News] Fetched ' + count + ' articles'); }).catch(() => {});
  }, 15 * 60 * 1000);
  fetchNews().then(count => { console.log('[News] Initial fetch: ' + count + ' articles'); }).catch(() => {});

  function scheduleDigest() {
    const now = new Date();
    const target = new Date();
    target.setHours(18, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delay = target - now;
    setTimeout(() => { postDigest(client).catch(() => {}); scheduleDigest(); }, delay);
  }
  scheduleDigest();

  setInterval(() => {
    try {
      runDecayPass(); cleanCallbacks(); cleanChains(); cleanWarmth(); runDecay();
      decayMemoryEntries(); cleanCooldowns(); pruneRateLimits(); pruneExpiredFlags();
      pruneSentimentBuffers(); pruneBanterChains(); pruneCallbacks(); pruneReactionCounters();
    } catch (e) { console.error('[Maintenance] Job error:', e.message); }
  }, 10 * 60 * 1000);

  setInterval(() => {
    (async () => {
      console.log('[Daily] Starting maintenance...');
      await updateAllProfiles();
      await summarizeOldThreads();
      pruneOldMessages(90 * 24 * 60 * 60 * 1000);
      console.log('[Daily] Maintenance complete.');
    })().catch(function(e) { console.error('[Daily] Maintenance error:', e.message); });
  }, 24 * 60 * 60 * 1000);

  initReactionTracking(client);
  setInterval(pruneReactionCounters, 60 * 60 * 1000);
  setInterval(function() {
    var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    pruneSignals(cutoff);
  }, 24 * 60 * 60 * 1000);

  setInterval(function() {
    runChronicleJob(client).catch(function(err) { console.error('[Chronicle] Job error:', err.message); });
  }, 24 * 60 * 60 * 1000);
  setInterval(function() {
    runOmenJob(client).catch(function(err) { console.error('[Omen] Job error:', err.message); });
  }, 24 * 60 * 60 * 1000);
  setTimeout(function() {
    runChronicleJob(client).catch(function() {});
    runOmenJob(client).catch(function() {});
  }, 60000);
}

module.exports = { startSchedulers };
