const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

function getLevelResponse(args, message) {
  let userId = message.author.id;
  if (args.user) {
    const mentionMatch = args.user.match(/<@!?(\d+)>/);
    if (mentionMatch) userId = mentionMatch[1];
  }
  const member = message.guild.members.cache.get(userId);
  const user = member ? member.user : message.author;
  const userData = db.prepare('SELECT * FROM user_levels WHERE guild_id = ? AND user_id = ?').get(message.guild.id, userId) || { xp: 0, level: 0 };

  const xpForNext = (userData.level + 1) * 100;
  const progress = Math.min((userData.xp / xpForNext) * 100, 100);

  return {
    embeds: [new EmbedBuilder()
      .setTitle(`${user.username}'s Level`)
      .addFields(
        { name: 'Level', value: `${userData.level}`, inline: true },
        { name: 'XP', value: `${userData.xp} / ${xpForNext}`, inline: true },
        { name: 'Progress', value: `${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))} ${Math.floor(progress)}%`, inline: false },
      )
      .setColor(0x00e5ff)
      .setThumbnail(user.displayAvatarURL())],
  };
}

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
  async handleActivation(message, args) {
    const result = getLevelResponse(args, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn level',
    description: 'Check your level',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn level'.length).trim() || null }; },
  },
};
