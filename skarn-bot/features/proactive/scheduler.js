const { processPendingFollowUps } = require('../intelligence/followUpEngine');
const { findAbsentRegulars, shouldSendCheckIn, generateCheckIn } = require('./absenceDetector');
const { getUserPreferences } = require('../../db/database');

const TICK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const DAILY_PROACTIVE_LIMIT = 1; // per user per day
const RANDOM_THOUGHT_CHANCE = 0.03;

let tickCounter = 0;

function startProactiveScheduler(client) {
  setInterval(() => tick(client), TICK_INTERVAL);
}

async function tick(client) {
  tickCounter++;

  // 1. Process follow-ups (every tick)
  await processPendingFollowUps(client);

  // 2. Check inactivity (every 3rd tick = 30 min)
  if (tickCounter % 3 === 0) {
    const guilds = [...client.guilds.cache.values()];
    for (const guild of guilds) {
      const absentUsers = findAbsentRegulars(guild.id);
      for (const user of absentUsers) {
        if (shouldSendCheckIn(user.user_id, guild.id) && hasDailyBudget(user.user_id, guild.id)) {
          try {
            const member = await guild.members.fetch(user.user_id).catch(() => null);
            if (member) {
              const channel = findActiveChannel(guild, user.user_id);
              if (channel) {
                await channel.send(generateCheckIn(user.user_id));
                recordProactiveMessage(user.user_id, guild.id, 'check-in');
              }
            }
          } catch (e) {
            console.error(`[Proactive] Check-in failed for ${user.user_id}:`, e.message);
          }
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
    "SELECT COUNT(*) as count FROM follow_ups WHERE user_id = ? AND guild_id = ? AND status = 'sent' AND sent_at > ?"
  ).get(userId, guildId, today.getTime());
  return count.count < DAILY_PROACTIVE_LIMIT;
}

function recordProactiveMessage(userId, guildId, type) {
  const { db } = require('../../db/database');
  db.prepare(
    "INSERT INTO follow_ups (user_id, guild_id, channel_id, topic, context, created_at, due_after, status, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)"
  ).run(userId, guildId, 'proactive', type, '', Date.now(), Date.now(), Date.now());
}

function findActiveChannel(guild, userId) {
  // Try system channel, then general, then first text channel the user can see
  if (guild.systemChannel) return guild.systemChannel;
  const general = guild.channels.cache.find(c => c.name === 'general' && c.isTextBased());
  if (general) return general;
  return guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(userId)?.has('ViewChannel'));
}

module.exports = { startProactiveScheduler, tick };
