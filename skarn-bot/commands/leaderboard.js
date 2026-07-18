const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsFile = path.join(__dirname, '..', 'data', 'levels.json');

function loadLevels() {
  if (!fs.existsSync(levelsFile)) return {};
  return JSON.parse(fs.readFileSync(levelsFile, 'utf8'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard'),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const levels = loadLevels();
    const guildLevels = levels[guildId] || {};

    const sorted = Object.entries(guildLevels)
      .sort(([, a], [, b]) => b.xp - a.xp)
      .slice(0, 10);

    if (sorted.length === 0) {
      return interaction.reply({ content: 'No one has earned XP yet.', flags: 64 });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const list = sorted.map(([userId, data], i) => {
      const medal = medals[i] || `**${i + 1}.**`;
      return `${medal} <@${userId}> — Level ${data.level} (${data.xp} XP)`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('Leaderboard')
      .setDescription(list)
      .setColor(0x00e5ff);

    await interaction.reply({ embeds: [embed] });
  },
};
