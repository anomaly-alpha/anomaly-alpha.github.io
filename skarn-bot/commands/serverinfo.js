const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function getServerInfoResponse(args, message) {
  const guild = message.guild;
  const owner = await guild.fetchOwner().then(m => m.user.username).catch(() => 'Unknown');
  return {
    embeds: [new EmbedBuilder()
      .setTitle(guild.name)
      .addFields(
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Owner', value: owner, inline: true },
      )
      .setColor(0x00e5ff)],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Shows server information'),
  async execute(interaction) {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .addFields(
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Owner', value: `${await guild.fetchOwner().then(m => m.user.username)}`, inline: true },
      )
      .setColor(0x00e5ff);
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = await getServerInfoResponse(args, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn serverinfo',
    description: 'Show server info',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
