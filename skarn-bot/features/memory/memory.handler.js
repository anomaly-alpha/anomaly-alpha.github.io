const { EmbedBuilder } = require('discord.js');
const { getMemoryEntries, getRelationship, getUserProfile, getConversationStats } = require('../../db/database');

async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;

  const embed = new EmbedBuilder()
    .setTitle('The Stone Remembers')
    .setDescription(interaction.user.displayName ? `What Skarn knows about **${interaction.user.displayName}**` : 'What Skarn knows about you')
    .setColor(0x00e5ff)
    .setTimestamp();

  // Etched facts (user intentionally saved)
  const etched = getMemoryEntries(userId, guildId, 10).filter(m => m.source === 'etch');
  if (etched.length > 0) {
    embed.addFields({
      name: `✍️ Etched (${etched.length})`,
      value: etched.map(m => `• ${m.content}`).join('\n'),
    });
  } else {
    embed.addFields({
      name: '✍️ Etched',
      value: 'Nothing yet. Use `/etch` to tell me something to remember.',
    });
  }

  // Extracted interests (auto-discovered)
  const extracted = getMemoryEntries(userId, guildId, 20).filter(m => m.source === 'extracted');
  const interests = extracted.filter(m => m.type === 'interest');
  if (interests.length > 0) {
    embed.addFields({
      name: `🧠 Interests (${interests.length})`,
      value: interests.map(m => `• ${m.content}`).join('\n'),
    });
  }

  // Relationship
  const rel = getRelationship(userId, guildId);
  if (rel) {
    const familiarity = Math.round(rel.familiarity);
    const interactions = rel.interaction_count || 0;
    embed.addFields({
      name: '🤝 Connection',
      value: `Familiarity: **${familiarity}/100**\nInteractions: **${interactions}**\nTone: **${rel.preferred_tone || 'neutral'}**`,
      inline: true,
    });
  }

  // Profile stats
  const profile = getUserProfile(userId, guildId);
  if (profile) {
    const engagement = profile.engagement_score > 0.7 ? 'high' : profile.engagement_score > 0.3 ? 'medium' : 'low';
    embed.addFields({
      name: '📊 Profile',
      value: `Engagement: **${engagement}**\nSentiment: **${Math.round((profile.sentiment_trend || 0) * 100)}%**`,
      inline: true,
    });
  }

  // Conversation stats
  try {
    const stats = getConversationStats(userId, guildId);
    if (stats.totalMessages) {
      embed.addFields({
        name: '💬 Conversation',
        value: `Messages: **${stats.totalMessages.count}**\nQuestions asked: **${stats.questionCount.count}**`,
        inline: true,
      });
    }
  } catch (e) { /* stats unavailable */ }

  await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
}

module.exports = { execute };
