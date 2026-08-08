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
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
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

module.exports = { isSleepTime, generateMusing, assembleSeed, pickNewsSeed, pickHistorySeed, pickGuildSeed };
