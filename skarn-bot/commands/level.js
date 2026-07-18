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
    .setName('level')
    .setDescription('Check your level or another user\'s level')
    .addUserOption(option => option.setName('user').setDescription('The user to check')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guild.id;
    const levels = loadLevels();
    const userData = levels[guildId]?.[user.id] || { xp: 0, level: 0 };

    const xpForNext = (userData.level + 1) * 100;
    const progress = Math.min((userData.xp / xpForNext) * 100, 100);

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Level`)
      .addFields(
        { name: 'Level', value: `${userData.level}`, inline: true },
        { name: 'XP', value: `${userData.xp} / ${xpForNext}`, inline: true },
        { name: 'Progress', value: `${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))} ${Math.floor(progress)}%`, inline: false },
      )
      .setColor(0x00e5ff)
      .setThumbnail(user.displayAvatarURL());

    await interaction.reply({ embeds: [embed] });
  },
};
