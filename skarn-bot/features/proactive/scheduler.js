const { processPendingFollowUps } = require('../intelligence/followUpEngine');
const { findAbsentRegulars, shouldSendCheckIn, generateCheckIn, canInteract } = require('./absenceDetector');
const { getUserPreferences } = require('../../db/database');

const TICK_INTERVAL = 10 * 60 * 1000;
const DAILY_PROACTIVE_LIMIT = 1;
const RANDOM_THOUGHT_CHANCE = 0.03;
let tickCounter = 0;
const processingCheckIns = new Set();

function startProactiveScheduler(client) {
  setInterval(() => { tick(client).catch(error => console.error('[Proactive] Tick error:', error.message)); }, TICK_INTERVAL);
}

async function tick(client) {
  tickCounter++;
  await processPendingFollowUps(client);

  if (tickCounter % 3 === 0) {
    const guilds = [...client.guilds.cache.values()];
    for (const guild of guilds) {
      const absentUsers = findAbsentRegulars(guild.id);
      for (const user of absentUsers) {
        if (!shouldSendCheckIn(user.user_id, guild.id) || !hasDailyBudget(user.user_id, guild.id) || processingCheckIns.has(user.user_id)) continue;
        processingCheckIns.add(user.user_id);
        try {
          const checkIn = await generateCheckIn(user.user_id, guild.id);
          if (!checkIn || !canInteract(user.user_id, guild.id) || !shouldSendCheckIn(user.user_id, guild.id)) continue;
          const member = await guild.members.fetch(user.user_id).catch(() => null);
          if (!member) continue;
          const channel = findActiveChannel(guild, user.user_id);
          if (!channel) {
            recordFailedAttempt(user.user_id, guild.id, 'check-in', 'no usable channel');
            continue;
          }
          if (!canInteract(user.user_id, guild.id) || !shouldSendCheckIn(user.user_id, guild.id)) continue;
          await channel.send({ content: '<@' + user.user_id + '> ' + checkIn.message, allowedMentions: { users: [user.user_id] } });
          recordProactiveMessage(user.user_id, guild.id, 'check-in', checkIn.topic);
        } catch (error) {
          recordFailedAttempt(user.user_id, guild.id, 'check-in', error.message);
          console.error('[Proactive] Check-in failed for ' + user.user_id + ':', error.message);
        } finally {
          processingCheckIns.delete(user.user_id);
        }
      }
    }
  }
}

function hasDailyBudget(userId, guildId) {
  const { db } = require('../../db/database');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = db.prepare(
    "SELECT COUNT(*) AS count FROM follow_ups WHERE user_id = ? AND status IN ('sent', 'responded', 'failed') AND sent_at > ?"
  ).get(userId, today.getTime());
  return count.count < DAILY_PROACTIVE_LIMIT;
}

function recordProactiveMessage(userId, guildId, type, topic) {
  const { db } = require('../../db/database');
  db.prepare(
    "INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after, status, sent_at) VALUES (?, ?, 'proactive', ?, '', ?, ?, 'sent', ?)"
  ).run(userId, guildId, topic || type, Date.now(), Date.now(), Date.now());
}

function recordFailedAttempt(userId, guildId, type, reason) {
  const { db } = require('../../db/database');
  db.prepare(
    "INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after, status, sent_at) VALUES (?, ?, 'proactive', ?, ?, ?, ?, 'failed', ?)"
  ).run(userId, guildId, type, reason, Date.now(), Date.now(), Date.now());
}

function findActiveChannel(guild, userId) {
  const candidates = [guild.systemChannel, guild.channels.cache.find(channel => channel.name === 'general')];
  for (const channel of candidates) if (isUsableForCheckIn(channel, guild, userId)) return channel;
  return guild.channels.cache.find(channel => isUsableForCheckIn(channel, guild, userId));
}

function isUsableForCheckIn(channel, guild, userId) {
  if (!channel || !channel.isTextBased()) return false;
  const botPermissions = channel.permissionsFor(guild.members.me);
  return channel.viewable && botPermissions?.has('SendMessages') && channel.permissionsFor(userId)?.has('ViewChannel');
}

module.exports = { startProactiveScheduler, tick };
