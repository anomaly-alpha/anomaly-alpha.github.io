const { SlashCommandBuilder } = require('discord.js');
const { getGuildConfig, setGuildConfig } = require('../db/database');

function getAichatignoreResponse(userId, guildId) {
  let ignored = getGuildConfig(guildId, 'ignoredUsers') || [];
  const idx = ignored.indexOf(userId);

  if (idx === -1) {
    ignored.push(userId);
    setGuildConfig(guildId, 'ignoredUsers', ignored);
    return { content: 'Skarn will now ignore you in AI chat channels. Use skarn aichatignore again to reverse.' };
  } else {
    ignored.splice(idx, 1);
    setGuildConfig(guildId, 'ignoredUsers', ignored);
    return { content: 'Skarn will respond to you again in AI chat channels.' };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aichatignore')
    .setDescription('Toggle whether Skarn responds to you in AI chat channels'),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    let ignored = getGuildConfig(guildId, 'ignoredUsers') || [];
    const idx = ignored.indexOf(userId);

    if (idx === -1) {
      ignored.push(userId);
      setGuildConfig(guildId, 'ignoredUsers', ignored);
      await interaction.reply({ content: 'Skarn will now ignore you in AI chat channels. Use /aichatignore again to reverse.', flags: 64 });
    } else {
      ignored.splice(idx, 1);
      setGuildConfig(guildId, 'ignoredUsers', ignored);
      await interaction.reply({ content: 'Skarn will respond to you again in AI chat channels.', flags: 64 });
    }
  },
  async handleActivation(message, args) {
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.' });
    }
    const result = getAichatignoreResponse(message.author.id, message.guild.id);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn aichatignore',
    description: 'Toggle AI chat ignore',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
