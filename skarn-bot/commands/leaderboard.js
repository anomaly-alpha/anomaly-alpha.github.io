const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

function getLeaderboardResponse(args, message) {
  const topUsers = db.prepare('SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(message.guild.id);

  if (topUsers.length === 0) {
    return { content: 'No one has earned XP yet.', flags: 64 };
  }

  const medals = ['🥇', '🥈', '🥉'];
  const list = topUsers.map((user, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    return `${medal} <@${user.user_id}> — Level ${user.level} (${user.xp} XP)`;
  }).join('\n');

  return { embeds: [new EmbedBuilder().setTitle('Leaderboard').setDescription(list).setColor(0x00e5ff)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard'),
  async execute(interaction) {
    const topUsers = db.prepare('SELECT user_id, xp, level FROM user_levels WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10').all(interaction.guild.id);

    if (topUsers.length === 0) {
      return interaction.reply({ content: 'No one has earned XP yet.', flags: 64, allowedMentions: { parse: ['users'] } });
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

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getLeaderboardResponse(args, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn leaderboard',
    description: 'Show XP leaderboard',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
