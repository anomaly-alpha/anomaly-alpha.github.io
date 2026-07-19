const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');

function getRelationshipResponse(userId, guildId, user) {
  const rel = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  const milestones = db.prepare(
    "SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? AND milestone_type != 'response_feedback' ORDER BY achieved_at DESC LIMIT 10"
  ).all(userId, guildId);
  const totalMessages = db.prepare(
    'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
  ).get(userId, guildId);
  const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

  const embed = new EmbedBuilder()
    .setTitle(`Relationship — ${user.username}`)
    .setColor(0x00e5ff);

  if (rel) {
    const familiarity = Math.round(rel.familiarity);
    const bars = Math.round((familiarity / 100) * 10);
    const barStr = '▓'.repeat(Math.min(bars, 10)) + '░'.repeat(Math.max(0, 10 - bars));
    embed.addFields(
      { name: 'Familiarity', value: `\`${barStr}\` ${familiarity}/100`, inline: false },
      { name: 'Messages', value: `${totalMessages.count}`, inline: true },
      { name: 'Interactions', value: `${rel.interaction_count}`, inline: true },
    );
  }

  if (profile) {
    const engagement = profile.engagement_score > 0.7 ? 'High' : profile.engagement_score > 0.3 ? 'Medium' : 'Low';
    embed.addFields({ name: 'Engagement', value: engagement, inline: true });
  }

  if (milestones.length > 0) {
    const milestoneText = milestones.map(m => {
      const date = new Date(m.achieved_at).toLocaleDateString();
      return `**${m.milestone_name}** — ${date}`;
    }).join('\n');
    embed.addFields({ name: 'Milestones 🏆', value: milestoneText, inline: false });
  }

  if (prefs && prefs.nickname) {
    embed.setDescription(`Nickname: **${prefs.nickname}**`);
  }

  return { embeds: [embed], flags: 64 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relationship')
    .setDescription('View your relationship status with Skarn'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    const rel = db.prepare('SELECT * FROM user_relationship WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const profile = db.prepare('SELECT * FROM user_profile WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const milestones = db.prepare(
      "SELECT * FROM relationship_milestones WHERE user_id = ? AND guild_id = ? AND milestone_type != 'response_feedback' ORDER BY achieved_at DESC LIMIT 10"
    ).all(userId, guildId);
    const totalMessages = db.prepare(
      'SELECT COUNT(*) as count FROM conversation_messages WHERE user_id = ? AND guild_id = ?'
    ).get(userId, guildId);
    const prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

    const embed = new EmbedBuilder()
      .setTitle(`Relationship — ${interaction.user.username}`)
      .setColor(0x00e5ff);

    if (rel) {
      const familiarity = Math.round(rel.familiarity);
      const bars = Math.round((familiarity / 100) * 10);
      const barStr = '▓'.repeat(Math.min(bars, 10)) + '░'.repeat(Math.max(0, 10 - bars));
      embed.addFields(
        { name: 'Familiarity', value: `\`${barStr}\` ${familiarity}/100`, inline: false },
        { name: 'Messages', value: `${totalMessages.count}`, inline: true },
        { name: 'Interactions', value: `${rel.interaction_count}`, inline: true },
      );
    }

    if (profile) {
      const engagement = profile.engagement_score > 0.7 ? 'High' : profile.engagement_score > 0.3 ? 'Medium' : 'Low';
      embed.addFields({ name: 'Engagement', value: engagement, inline: true });
    }

    if (milestones.length > 0) {
      const milestoneText = milestones.map(m => {
        const date = new Date(m.achieved_at).toLocaleDateString();
        return `**${m.milestone_name}** — ${date}`;
      }).join('\n');
      embed.addFields({ name: 'Milestones 🏆', value: milestoneText, inline: false });
    }

    if (prefs && prefs.nickname) {
      embed.setDescription(`Nickname: **${prefs.nickname}**`);
    }

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
  async handleActivation(message, args) {
    if (!message.guild) return message.reply({ content: 'This command can only be used in a server.', flags: 64 });
    const result = getRelationshipResponse(message.author.id, message.guild.id, message.author);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn relationship',
    description: 'Check relationship status',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn relationship'.length).trim() || null }; },
  },
};
