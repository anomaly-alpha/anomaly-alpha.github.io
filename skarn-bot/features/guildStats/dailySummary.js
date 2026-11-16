// ===== daily per-server summary =====
// One DM per guild per day to the operator, covering that guild's activity.
// Numbers come from three sources: guild_daily_stats/guild_daily_speaker (human
// traffic and blocked inputs, counted live), conversation_messages (AI use,
// already store per guild/day), and guild_membership_log (joins and leaves).
//
// The text builder is pure so its formatting can be tested without a client.

const { db } = require('../../db/database');
const { utcDay, getDayStats, getDaySpeakers, getDaySpeakerCount, pruneDailyStats } = require('../../db/guildStats');

const OPERATOR_ENV_KEY = 'SKARN_OPERATOR_USER_ID';
const HOUR_ENV_KEY = 'SKARN_SUMMARY_HOUR_UTC';
const DEFAULT_HOUR_UTC = 9;

function dayBounds(day) {
  const start = Date.parse(day + 'T00:00:00Z');
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

function collectGuildDay(guildId, day) {
  const { start, end } = dayBounds(day);
  const counters = getDayStats(guildId, day);

  const ai = db.prepare(
    "SELECT COUNT(*) exchanges, COUNT(DISTINCT thread_id) threads, COUNT(DISTINCT user_id) people " +
    "FROM conversation_messages WHERE guild_id = ? AND role = 'user' AND created_at >= ? AND created_at < ?"
  ).get(String(guildId), start, end);

  const membership = db.prepare(
    'SELECT event, reason, guild_name FROM guild_membership_log WHERE guild_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at'
  ).all(String(guildId), start, end);

  return {
    messages: counters.messages || 0,
    moderationBlocks: counters.moderation_blocks || 0,
    speakers: getDaySpeakers(guildId, day, 3),
    speakerCount: getDaySpeakerCount(guildId, day),
    aiExchanges: ai.exchanges || 0,
    aiThreads: ai.threads || 0,
    aiPeople: ai.people || 0,
    joined: membership.filter((m) => m.event === 'joined').length,
    left: membership.filter((m) => m.event === 'left').length,
  };
}

function buildGuildSummaryText(guildName, day, data, options) {
  const config = options || {};
  const nameOf = config.nameOf || ((id) => id);
  const lines = [];

  lines.push((guildName || 'unknown') + ' — ' + day);

  if (!data.messages && !data.aiExchanges && !data.moderationBlocks && !data.joined && !data.left) {
    lines.push('');
    lines.push('nothing happened.');
    if (config.memberCount) lines.push(config.memberCount + ' members, quiet all day.');
    return lines.join('\n');
  }

  lines.push('');
  if (data.messages) {
    lines.push(data.messages + ' message' + (data.messages === 1 ? '' : 's') + ' from ' + data.speakerCount + ' ' +
      (data.speakerCount === 1 ? 'person' : 'people'));
    if (data.speakers.length) {
      lines.push('  ' + data.speakers.map((s) => nameOf(s.user_id) + ' (' + s.messages + ')').join(', '));
    }
  } else {
    lines.push('no messages.');
  }

  if (data.aiExchanges) {
    lines.push(data.aiExchanges + ' ai exchange' + (data.aiExchanges === 1 ? '' : 's') + ' across ' +
      data.aiThreads + ' thread' + (data.aiThreads === 1 ? '' : 's') + ' from ' + data.aiPeople + ' ' +
      (data.aiPeople === 1 ? 'person' : 'people'));
  }

  if (data.moderationBlocks) {
    lines.push(data.moderationBlocks + ' input' + (data.moderationBlocks === 1 ? '' : 's') + ' blocked by moderation');
  }

  if (data.joined || data.left) {
    const parts = [];
    if (data.joined) parts.push(data.joined + ' joined');
    if (data.left) parts.push(data.left + ' left');
    lines.push(parts.join(', '));
  }

  if (config.memberCount) lines.push('');
  if (config.memberCount) lines.push(config.memberCount + ' members now');

  return lines.join('\n');
}

function displayName(client, guild, userId) {
  const member = guild && guild.members && guild.members.cache ? guild.members.cache.get(userId) : null;
  if (member) return member.displayName || member.user.username;
  const user = client.users.cache.get(userId);
  return user ? (user.globalName || user.username) : userId;
}

async function sendDailySummaries(client, options) {
  const config = options || {};
  const log = config.log || ((message) => console.log('[DailySummary] ' + message));
  const operatorId = config.operatorId !== undefined ? config.operatorId : (process.env[OPERATOR_ENV_KEY] || '');
  const day = config.day || utcDay(Date.now() - 24 * 60 * 60 * 1000);
  const guildIds = config.guildIds || [...client.guilds.cache.keys()];

  if (!operatorId) {
    log('no ' + OPERATOR_ENV_KEY + ' set — skipping (would have covered ' + guildIds.length + ' guild(s))');
    return { sent: 0, skipped: guildIds.length };
  }
  if (!guildIds.length) {
    log('no guilds to summarize');
    return { sent: 0, skipped: 0 };
  }

  let user;
  try {
    user = await client.users.fetch(operatorId);
  } catch (error) {
    log('cannot fetch operator ' + operatorId + ': ' + error.message);
    return { sent: 0, skipped: guildIds.length };
  }

  let sent = 0;
  for (const guildId of guildIds) {
    const guild = client.guilds.cache.get(guildId);
    const data = collectGuildDay(guildId, day);
    const text = buildGuildSummaryText(
      guild ? guild.name : guildId,
      day,
      data,
      { memberCount: guild ? guild.memberCount : null, nameOf: (id) => displayName(client, guild, id) },
    );
    try {
      await user.send({ content: text, allowedMentions: { parse: [] } });
      sent++;
    } catch (error) {
      log('dm failed for ' + guildId + ': ' + error.message);
      break;
    }
  }

  pruneDailyStats();
  log('sent ' + sent + '/' + guildIds.length + ' summary dm(s) for ' + day);
  return { sent, skipped: guildIds.length - sent };
}

function startDailySummary(client, options) {
  const config = options || {};
  const log = config.log || ((message) => console.log('[DailySummary] ' + message));
  const hour = Number.isFinite(config.hour) ? config.hour : parseInt(process.env[HOUR_ENV_KEY], 10);
  const targetHour = Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_HOUR_UTC;
  const operatorId = config.operatorId !== undefined ? config.operatorId : (process.env[OPERATOR_ENV_KEY] || '');

  if (!operatorId) {
    log('disabled — no ' + OPERATOR_ENV_KEY + ' configured');
    return { scheduled: false };
  }

  function msUntilNextRun(now) {
    const next = new Date(now);
    next.setUTCHours(targetHour, 0, 0, 0);
    if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now;
  }

  function schedule() {
    const now = Date.now();
    const delay = msUntilNextRun(now);
    const timer = setTimeout(() => {
      sendDailySummaries(client, config).catch((error) => log('run failed: ' + error.message));
      schedule();
    }, delay);
    if (timer.unref) timer.unref();
  }

  schedule();
  log('scheduled daily at ' + String(targetHour).padStart(2, '0') + ':00 UTC to operator ' + operatorId);
  return { scheduled: true, hour: targetHour };
}

module.exports = {
  OPERATOR_ENV_KEY,
  HOUR_ENV_KEY,
  DEFAULT_HOUR_UTC,
  dayBounds,
  collectGuildDay,
  buildGuildSummaryText,
  sendDailySummaries,
  startDailySummary,
};
