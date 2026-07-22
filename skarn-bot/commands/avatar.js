const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function getAvatarResponse(args, message) {
  let user = message ? message.author : null;
  if (args.user) {
    const mentionMatch = args.user.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      user = await message.client.users.fetch(mentionMatch[1]).catch(() => message.author);
    } else {
      user = message.author;
    }
  }
  const embed = new EmbedBuilder()
    .setTitle(`${user.username}'s Avatar`)
    .setImage(user.displayAvatarURL({ size: 512 }))
    .setColor(0x00e5ff);
  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Show a user's avatar")
    .addUserOption(option => option.setName('user').setDescription('The user')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 512 }))
      .setColor(0x00e5ff);
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = await getAvatarResponse(args, message);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn avatar',
    description: 'Get avatar',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn avatar'.length).trim() || null }; },
  },
};
