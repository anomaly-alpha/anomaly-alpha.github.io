const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level or another user\'s level')
    .addUserOption(option => option.setName('user').setDescription('The user to check')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const userData = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(interaction.guild.id, user.id) || { xp: 0, level: 0 };

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
