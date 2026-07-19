const { SlashCommandBuilder } = require('discord.js');
const { createReminder } = require('../db/database');

function getRemindResponse(args, message) {
  const minutes = args.minutes;
  const text = args.text;
  const remindAt = Date.now() + minutes * 60 * 1000;

  createReminder(message.author.id, message.channel.id, message.guild?.id, text, remindAt);

  setTimeout(async () => {
    try {
      const channel = await message.client.channels.fetch(message.channel.id);
      await channel.send(`<@${message.author.id}> Reminder: **${text}**`);
    } catch {}
  }, minutes * 60 * 1000);

  return { content: `I'll remind you in **${minutes}** minute(s): ${text}`, flags: 64 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addIntegerOption(option => option.setName('minutes').setDescription('Minutes from now').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption(option => option.setName('message').setDescription('What to remind you about').setRequired(true)),
  async execute(interaction) {
    const minutes = interaction.options.getInteger('minutes');
    const message = interaction.options.getString('message');
    const remindAt = Date.now() + minutes * 60 * 1000;

    createReminder(interaction.user.id, interaction.channel.id, interaction.guild.id, message, remindAt);

    setTimeout(async () => {
      try {
        const channel = await interaction.client.channels.fetch(interaction.channel.id);
        await channel.send(`<@${interaction.user.id}> Reminder: **${message}**`);
      } catch {}
    }, minutes * 60 * 1000);

    await interaction.reply({ content: `I'll remind you in **${minutes}** minute(s): ${message}`, flags: 64 });
  },
  async handleActivation(message, args) {
    if (!args.minutes || !args.text) {
      return message.reply({ content: 'Usage: `skarn remind <minutes> <message>` — e.g. `skarn remind 30 take out the trash` or `skarn remind 2h deploy check`', flags: 64 });
    }
    const result = getRemindResponse(args, message);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn remind',
    description: 'Set a reminder',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      const rest = content.slice('skarn remind'.length).trim();
      const match = rest.match(/^(\d+)\s*(m|min|minute|h|hr|hour)?\s+(.+)/i);
      if (match) {
        let minutes = parseInt(match[1]);
        if (match[2] && /^h/i.test(match[2])) minutes *= 60;
        return { minutes, text: match[3] };
      }
      return { minutes: null, text: rest };
    },
  },
};
