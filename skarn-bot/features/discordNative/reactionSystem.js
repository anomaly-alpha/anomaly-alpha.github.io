const Sentiment = require('sentiment');
const sentiment = new Sentiment();

const COOLDOWN_MS = 60 * 1000;
const REACTION_CHANCE = 0.03;
const cooldowns = new Map();

const STANDARD_REACTIONS = ['💀', '😭', '🔥', '💯', '🗿', '👀'];

async function maybeReact(message, client, isAsleep) {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (isAsleep) return;

  const score = sentiment.analyze(message.content).comparative;
  if (score < -0.5) return;

  const channelId = message.channel.id;
  const now = Date.now();

  const lastReaction = cooldowns.get(channelId) || 0;
  if (now - lastReaction < COOLDOWN_MS) return;

  if (Math.random() > REACTION_CHANCE) return;

  const botMember = message.guild.members.me;
  if (!message.channel.permissionsFor(botMember)?.has('AddReactions')) return;

  let emoji;
  try {
    const guildEmojis = await message.guild.emojis.fetch();
    if (guildEmojis.size > 0 && Math.random() > 0.5) {
      emoji = guildEmojis.random();
    }
  } catch {
    // Fall through to standard
  }

  if (!emoji) {
    emoji = STANDARD_REACTIONS[Math.floor(Math.random() * STANDARD_REACTIONS.length)];
  }

  try {
    await message.react(emoji);
    cooldowns.set(channelId, now);
  } catch {
    // Permission issue or emoji unavailable
  }
}

module.exports = { maybeReact };
