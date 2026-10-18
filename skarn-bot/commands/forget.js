const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { forgetUserData } = require('../features/forget/forget.handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Delete what Skarn remembers')
    .addSubcommand(sub =>
      sub.setName('memory')
        .setDescription('Delete personal memories and your stored channel context/summary details'))
    .addSubcommand(sub =>
      sub.setName('conversation')
        .setDescription('Delete conversation history and your stored channel context/summary details (keeps explicit memories)')
        .addUserOption(option => option.setName('user').setDescription('User to forget (admin only)')))
    .addSubcommand(sub =>
      sub.setName('all')
        .setDescription('Delete all personal memories, conversation data, and stored channel context/summary details')),
  async execute(interaction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Use forget in a server so I can clear the right records.', flags: 64, allowedMentions: { parse: [] } });
    const subcommand = interaction.options.getSubcommand();
    const targetUser = subcommand === 'conversation' ? interaction.options.getUser('user') || interaction.user : interaction.user;

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can clear other users\' data.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    forgetUserData(targetUser.id, interaction.guild.id, subcommand);
    const description = subcommand === 'memory'
      ? 'Personal memories and your stored channel context/summary details are deleted; personal conversation history remains.'
      : subcommand === 'conversation'
        ? 'Conversation history and your stored channel context/summary details are deleted; explicit memories remain.'
        : 'Personal memories, conversation history, and your stored channel context/summary details are deleted.';
    return interaction.reply({ content: description + ' Raw shared channel context expires within seven days.', flags: 64, allowedMentions: { parse: [] } });
  },
  async handleActivation(message, args) {
    if (!message.guild) return message.reply({ content: 'Use this command in a server so I can clear the right records.', allowedMentions: { parse: [] } });
    const scope = args.action === 'memory' ? 'memory' : args.action === 'conversation' ? 'conversation' : 'all';
    forgetUserData(message.author.id, message.guild.id, scope);
    await message.reply({ content: 'Your requested memory and conversation records were deleted. Attributed channel-summary details were removed; raw shared context expires within seven days.', allowedMentions: { parse: [] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn forget',
    description: 'Clear memories or conversation history',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      var rest = content.slice('skarn forget'.length).trim().toLowerCase();
      if (rest === 'memory' || rest === 'memories') return { action: 'memory' };
      if (rest === 'conversation' || rest === 'chat' || rest === 'history') return { action: 'conversation' };
      return { action: 'all' };
    },
  },
};
