const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create a rich embed message')
    .addStringOption(option => option.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption(option => option.setName('description').setDescription('Embed description').setRequired(true))
    .addStringOption(option => option.setName('color').setDescription('Hex color (e.g. 00e5ff)')),
  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorHex = interaction.options.getString('color');

    let color = 0x00e5ff;
    if (colorHex) {
      const parsed = parseInt(colorHex.replace('#', ''), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({ text: `Created by ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!args.title || !args.description) {
      return message.reply({ content: 'Usage: `skarn embed title | description` (optional `| #color`)', allowedMentions: { parse: ['users'] } });
    }
    const colorHex = args.color || '';
    let color = 0x00e5ff;
    if (colorHex) {
      const parsed = parseInt(colorHex.replace('#', ''), 16);
      if (!isNaN(parsed)) color = parsed;
    }
    const embed = new EmbedBuilder()
      .setTitle(args.title)
      .setDescription(args.description)
      .setColor(color)
      .setFooter({ text: `Created by ${message.author.username}` })
      .setTimestamp();
    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn embed',
    description: 'Create a rich embed message',
    parseArgs: function(content) {
      const parts = content.slice('skarn embed'.length).trim().split('|').map(function(s) { return s.trim(); });
      return { title: parts[0] || null, description: parts[1] || null, color: parts[2] || null };
    },
  },
};
