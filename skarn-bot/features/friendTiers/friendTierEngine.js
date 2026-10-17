const { getTier, getFlags } = require('./friendTierStore');

const TIERS = [
  { name: 'Stranger', days: 0, points: 0, multiplier: 1 },
  { name: 'Acquaintance', days: 7, points: 10, multiplier: 1 },
  { name: 'Regular', days: 30, points: 40, multiplier: 1.25 },
  { name: 'Trusted', days: 90, points: 100, multiplier: 1.5 },
  { name: 'Warband', days: 180, points: 250, multiplier: 2 },
];

function tenureDays(row, now = Date.now()) {
  return row ? Math.max(0, Math.floor((now - row.first_seen_at) / 86400000)) : 0;
}

function computeTier(row, now = Date.now()) {
  const days = tenureDays(row, now);
  const points = row ? row.activity_points : 0;
  let tier = 0;
  for (let i = 1; i < TIERS.length; i++) if (days >= TIERS[i].days && points >= TIERS[i].points) tier = i;
  return tier;
}

function getEffectiveTier(userId, guildId) {
  const row = getTier(userId, guildId);
  return row ? Math.max(0, Math.min(TIERS.length - 1, row.current_tier)) : 0;
}

function getTierMultiplier(userId, guildId) {
  return TIERS[getEffectiveTier(userId, guildId)].multiplier;
}

function getFamiliarityLine(tier) {
  const lines = [
    '',
    'You have spoken with this person a handful of times. You recognize them, but nothing is familiar yet.',
    'This person is a regular presence. You are a little more at ease with them than with a stranger.',
    'You trust this person. Let a touch more warmth through — still understated, never effusive.',
    'This person has earned real standing with you over time. Treat them with quiet respect; do not perform affection.',
  ];
  return lines[Math.max(0, Math.min(lines.length - 1, tier))];
}

function getProgress(row, now = Date.now()) {
  const tier = row ? row.current_tier : 0;
  return { tier, name: TIERS[tier].name, tenureDays: tenureDays(row, now), points: row ? row.activity_points : 0, next: TIERS[tier + 1] || null };
}

function getFriendFlags(userId, guildId) {
  return getFlags(userId, guildId) || { ai_blocked: 0, ai_limited: 0 };
}

module.exports = { TIERS, tenureDays, computeTier, getEffectiveTier, getTierMultiplier, getFamiliarityLine, getProgress, getFriendFlags };
