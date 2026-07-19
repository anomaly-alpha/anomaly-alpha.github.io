const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function getUserInfoResponse(args, message) {
  let user = message.author;
  if (args.user) {
    const mentionMatch = args.user.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      user = message.guild.members.cache.get(mentionMatch[1])?.user || user;
    }
  }
  const member = message.guild.members.cache.get(user.id);
  return {
    embeds: [new EmbedBuilder()
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Joined', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setColor(0x00e5ff)],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Shows info about a user')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to look up').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    const embed = new EmbedBuilder()
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Joined', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setColor(0x00e5ff);
    await interaction.reply({ embeds: [embed] });
  },
  async handleActivation(message, args) {
    const result = getUserInfoResponse(args, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn userinfo',
    description: 'Show user info',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn userinfo'.length).trim() || null }; },
  },
};
