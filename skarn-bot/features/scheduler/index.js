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
  pruneSentimentBuffers, pruneBanterChains, pruneCallbacks, db,
} = require('../../db/database');
const { initReactionTracking, pruneReactionCounters } = require('../serverMemory/signalCapture');
const { runChronicleJob } = require('../serverMemory/chronicle/chronicleJob');
const { runOmenJob } = require('../serverMemory/omen/omenJob');
const { pruneSignals } = require('../serverMemory/signalStore');

function startSchedulers(client) {
  setInterval(evaluateGrowth, 7 * 24 * 60 * 60 * 1000);
  evaluateGrowth();
  setInterval(generateLoreBatch, 60 * 60 * 1000);
  generateLoreBatch();

  const statuses = [
    { type: 'Playing', text: 'with AI' }, { type: 'Listening', text: 'to commands' },
    { type: 'Watching', text: 'the server' }, { type: 'Playing', text: 'Tetris' },
    { type: 'Listening', text: 'to your questions' }, { type: 'Watching', text: 'you type...' },
    { type: 'Playing', text: '52 commands' }, { type: 'Listening', text: 'for mentions' },
  ];
  let statusIndex = 0;
  function setStatus() {
    const status = statuses[statusIndex];
    client.user.setActivity(status.text, { type: status.type });
    statusIndex = (statusIndex + 1) % statuses.length;
  }
  setStatus();
  setInterval(setStatus, 30000);

  startScheduler(client);
  startProactiveScheduler(client);
  setInterval(() => processDueReminders(client), 30 * 1000);

  setInterval(() => {
    fetchNews().then(count => { if (count > 0) console.log('[News] Fetched ' + count + ' articles'); }).catch(() => {});
  }, 60 * 60 * 1000);
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
    runDecayPass(); cleanCallbacks(); cleanChains(); cleanWarmth(); runDecay();
    decayMemoryEntries(); cleanCooldowns(); pruneRateLimits(); pruneExpiredFlags();
    pruneSentimentBuffers(); pruneBanterChains(); pruneCallbacks(); pruneReactionCounters();
  }, 10 * 60 * 1000);

  setInterval(async () => {
    console.log('[Daily] Starting maintenance...');
    await updateAllProfiles();
    await summarizeOldThreads();
    var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    db.prepare('DELETE FROM conversation_messages WHERE created_at < ?').run(cutoff);
    db.prepare('DELETE FROM conversation_summaries WHERE covers_to < ?').run(cutoff);
    console.log('[Daily] Maintenance complete.');
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
