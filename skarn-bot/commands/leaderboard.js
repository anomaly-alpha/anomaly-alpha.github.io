const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard'),
  async execute(interaction) {
    const topUsers = db.prepare('SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(interaction.guild.id);

    if (topUsers.length === 0) {
      return interaction.reply({ content: 'No one has earned XP yet.', flags: 64 });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const list = topUsers.map((user, i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} <@${user.user_id}> — Level ${user.level} (${user.xp} XP)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Leaderboard')
      .setDescription(list)
      .setColor(0x00e5ff);

    await interaction.reply({ embeds: [embed] });
  },
};
