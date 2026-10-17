const { getTier, upsertActivity, getAllTierRows, updateTierProgress, getTierChannel } = require('./friendTierStore');
const { computeTier, TIERS } = require('./friendTierEngine');

function utcDate(now) {
  return new Date(now).toISOString().slice(0, 10);
}

function recordFriendActivity(userId, guildId, now = Date.now()) {
  if (!userId || !guildId) return null;
  const existing = getTier(userId, guildId);
  if (existing) {
    const decay = applyDecay(existing, now);
    const patch = { activity_points: decay.points };
    if (decay.lastDecayAt != null) patch.last_decay_at = decay.lastDecayAt;
    updateTierProgress(userId, guildId, patch);
  }
  return upsertActivity(userId, guildId, now, utcDate(now));
}

function applyDecay(row, now) {
  const graceEnd = row.last_interaction_at + 14 * 86400000;
  if (now <= graceEnd) return { points: row.activity_points, lastDecayAt: row.last_decay_at };
  const base = Math.max(graceEnd, row.last_decay_at || graceEnd);
  const days = Math.floor((now - base) / 86400000);
  if (days <= 0) return { points: row.activity_points, lastDecayAt: row.last_decay_at };
  return { points: Math.max(0, row.activity_points - 5 * days), lastDecayAt: base + days * 86400000 };
}

async function runFriendTierUpdate(client, now = Date.now()) {
  const rows = getAllTierRows();
  let promoted = 0;
  for (const row of rows) {
    try {
      const decay = applyDecay(row, now);
      const nextTier = computeTier({ ...row, activity_points: decay.points }, now);
      const patch = { activity_points: decay.points, current_tier: nextTier };
      if (decay.lastDecayAt != null) patch.last_decay_at = decay.lastDecayAt;
      updateTierProgress(row.user_id, row.guild_id, patch);
      if (nextTier > row.current_tier) {
        promoted++;
        const channelId = getTierChannel(row.guild_id);
        if (channelId && client) {
          try {
            const guild = client.guilds.cache.get(row.guild_id);
            const channel = guild && await guild.channels.fetch(channelId);
            const member = guild && await guild.members.fetch(row.user_id);
            const content = member ? member.toString() + ' has become a ' + TIERS[nextTier].name + '.' : null;
            if (channel && content) await channel.send({ content, allowedMentions: { users: [row.user_id] } });
          } catch (error) { console.error('[FriendTiers] Promotion announcement failed:', error.message); }
        }
      }
    } catch (error) { console.error('[FriendTiers] Tier update failed for user:', error.message); }
  }
  return { processed: rows.length, promoted };
}

module.exports = { recordFriendActivity, applyDecay, runFriendTierUpdate, utcDate };
