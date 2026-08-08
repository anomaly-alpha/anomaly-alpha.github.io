// ===== Musings =====
// Ambient, grounded reflections. Seed tripod: recent news + a memory from
// Skarn's story archive + the guild's own recent life. Quiet channels only
// for ambient; the command path posts wherever invoked.

const { getAppState, setAppState, getGuildConfig, getChannelState, getServerBuzz } = require('../../db/database');
const { getRecentNews } = require('../news/newsFetcher');
const { findStoryTopic, getExistingStory } = require('../wisdom/storyEngine');
const { getRecentEntry } = require('../serverMemory/chronicle/chronicleStore');
const { getSignalsSince } = require('../serverMemory/signalStore');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles } = require('../../persona/roles');
const { moderatedChatCompletion } = require('../../ai/client');

const MUSING_QUIET_MS = 30 * 60 * 1000;        // [S3] idle window before a musing is allowed
const NEWS_SEED_MS = 48 * 60 * 60 * 1000;      // [S6.1] fresh-headline window
const MIN_NEXT_MS = 24 * 60 * 60 * 1000;       // [S4] never denser than 1/day per guild
const SERVER_SEED_MS = 24 * 60 * 60 * 1000;    // [S6.3] guild-local window

// Local sleep check - importing from bot.js would be circular (bot requires scheduler)
function isSleepTime() {
  const startRaw = process.env.SLEEP_START;
  const endRaw = process.env.SLEEP_END;
  const start = startRaw !== undefined ? parseInt(startRaw, 10) : 1;
  const end = endRaw !== undefined ? parseInt(endRaw, 10) : 7;
  if (start === end) return false;
  const tz = parseInt(process.env.SLEEP_TIMEZONE, 10) || 0;
  const hour = (new Date().getUTCHours() + tz + 24) % 24;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

// ===== Seed assembly =====

function pickNewsSeed() {
  const all = getRecentNews(30);
  if (!all || all.length === 0) return null;
  const fresh = all.filter(a => Date.now() - (a.published_at || 0) <= NEWS_SEED_MS);
  const pool = fresh.length > 0 ? fresh : all;
  const preferred = pool.filter(a => ['world', 'business', 'science', 'tech'].includes(a.category));
  const from = preferred.length > 0 ? preferred : pool;
  return from[Math.floor(Math.random() * from.length)];
}

function pickHistorySeed(headlineText) {
  const topic = headlineText ? findStoryTopic(headlineText) : null;
  if (topic) {
    const story = getExistingStory(topic);
    if (story) return story;
  }
  const db = require('../../db/database').db;
  const row = db.prepare("SELECT story_text FROM skarn_stories WHERE source IN ('canonical','auto_lore') ORDER BY random() LIMIT 1").get();
  return row ? row.story_text : null;
}

function pickGuildSeed(guildId) {
  const chronicle = getRecentEntry(guildId);
  if (chronicle && chronicle.content) return chronicle.content;
  const since = Date.now() - SERVER_SEED_MS;
  const signals = getSignalsSince(guildId, since);
  if (signals && signals.length > 0) return signals[0].summary_text;
  const buzz = getServerBuzz(guildId, since, 10);
  if (buzz && buzz.length > 0) return 'members were talking about ' + buzz.map(b => b.content).join('; ').slice(0, 200);
  return null;
}

function assembleSeed(guildId) {
  const news = pickNewsSeed();
  const history = pickHistorySeed(news ? news.headline : null);
  const server = pickGuildSeed(guildId);
  return { news, history, server };
}

// ===== Generation (shared by ambient + command) =====

async function generateMusing(guildId, senderId) {
  const seed = assembleSeed(guildId);
  const systemPrompt = buildSystemPrompt({ roleLine: roles.musing });
  let userPrompt = '';
  if (seed.news) userPrompt += 'Recent news: ' + seed.news.headline + (seed.news.snippet ? ' - ' + seed.news.snippet : '') + '\n';
  if (seed.history) userPrompt += 'Memory from my years: ' + seed.history + '\n';
  if (seed.server) userPrompt += 'This server lately: ' + seed.server + '\n';
  if (!userPrompt) return null;

  const result = await moderatedChatCompletion({
    model: process.env.AI_MODEL || 'gpt-5.4-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt.trim() },
    ],
    max_tokens: 120,
    temperature: 0.9,
    userId: senderId,
  });
  if (!result.success) return null;
  const content = result.completion.choices[0].message.content;
  return content ? content.trim() : null;
}

// ===== Ambient path =====

function pickQuietChannel(guild, client) {
  const cfg = getGuildConfig(guild.id, 'aiChannels');
  if (!Array.isArray(cfg) || cfg.length === 0) return null;
  const quiet = [];
  for (const cid of cfg) {
    const chan = guild.channels.cache.get(cid);
    if (!chan || !chan.isTextBased()) continue;
    if (!chan.permissionsFor(client.user.id) || !chan.permissionsFor(client.user.id).has('SendMessages')) continue;
    if (isChannelQuiet(chan)) quiet.push(chan);
  }
  return quiet.length > 0 ? quiet[Math.floor(Math.random() * quiet.length)] : null;
}

function isChannelQuiet(channel) {
  if (!channel) return false;
  const state = getChannelState(channel.id, channel.guild ? channel.guild.id : '');
  const quietState = state.current_state === 'Dormant' || state.current_state === 'Attentive';
  const idle = Date.now() - (state.last_message_at || 0) >= MUSING_QUIET_MS;
  return quietState && idle;
}

function setNextMusing(guildId, ms) {
  setAppState('musing_next:' + guildId, String(ms));
}

function rescheduleDraw(guildId, now) {
  // max(existing, drawn) - never pull a later scheduled fire earlier
  // (grilled Q4; symmetric with the command path's max guard).
  const existing = parseInt(getAppState('musing_next:' + guildId), 10) || 0;
  const drawn = now + 48 * 60 * 60 * 1000 * (0.5 + Math.random()); // uniform 24-72h
  setNextMusing(guildId, Math.max(existing, drawn));
}

async function maybeMuse(guild, client) {
  if (isSleepTime()) return false;                                    // [S8] 1
  const key = 'musing_next:' + guild.id;
  const now = Date.now();
  let next = parseInt(getAppState(key), 10) || 0;
  // First-time init: only for guilds that actually have aiChannels configured
  // (per [S5], leave the row alone for everyone else — no pointless reschedule writes).
  if (next === 0) {
    const cfg = getGuildConfig(guild.id, 'aiChannels');
    if (Array.isArray(cfg) && cfg.length > 0) setNextMusing(guild.id, now + MIN_NEXT_MS);
    return false;
  }
  if (now < next) return false;                                       // [S8] 2
  const channel = pickQuietChannel(guild, client);
  if (!channel) { rescheduleDraw(guild.id, now); return false; }      // [S8] 3-4 (no quiet channel)
  if (Math.random() < 0.15) { rescheduleDraw(guild.id, now); return false; } // [S8] 5 skip-draw
  const content = await generateMusing(guild.id, 'musing:' + guild.id);
  if (!content) { rescheduleDraw(guild.id, now); return false; }      // [S8] 6-7 (AI fail / crisis)
  // [S3] Re-check before send (grilled): the LLM call took seconds - if a user
  // message landed meanwhile, this channel is no longer quiet. Skip + reschedule.
  if (!isChannelQuiet(channel)) { rescheduleDraw(guild.id, Date.now()); return false; }
  try {
    await channel.send({ content: content, allowedMentions: { parse: [] } });
  } catch (e) { console.error('[Musing] send error:', e.message); }
  rescheduleDraw(guild.id, now);
  return true;
}

function startMusingScheduler(client) {
  const tick = async function() {
    for (const guild of client.guilds.cache.values()) {
      try { await maybeMuse(guild, client); }
      catch (e) { console.error('[Musing] tick error:', e.message); }
    }
  };
  tick();
  setInterval(tick, 10 * 60 * 1000);
}

module.exports = {
  isSleepTime, generateMusing, assembleSeed, pickNewsSeed, pickHistorySeed, pickGuildSeed,
  isChannelQuiet, pickQuietChannel, setNextMusing, maybeMuse, startMusingScheduler,
};
