const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchKnowledgeBase, getKnowledgeBase } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('Search Skarn\'s knowledge vault')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('What to search for')
        .setRequired(true)),
  async execute(interaction) {
    const query = interaction.options.getString('query').toLowerCase();
    const results = searchKnowledgeBase(query);
    if (!results || results.length === 0) {
      return interaction.reply({ content: `nothing in the vault about "${query}". try /seed to add articles.`, flags: 64, allowedMentions: { parse: ['users'] } });
    }
    const top = results.slice(0, 5);
    const embed = new EmbedBuilder()
      .setTitle(`ðŸ” vault search: ${query}`)
      .setColor(0x00e5ff);
    for (const r of top) {
      const icon = { wikipedia: 'ðŸ“š', user_taught: 'ðŸ‘¤', learned: 'ðŸ’¡' }[r.source] || 'ðŸ’¡';
      embed.addFields({
        name: `${icon} ${r.topic}`,
        value: r.summary.slice(0, 200) + (r.summary.length > 200 ? '...' : ''),
        inline: false,
      });
    }
    embed.setFooter({ text: `${results.length} result${results.length !== 1 ? 's' : ''} found` });
    await interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const query = args.query;
    if (!query) {
      return message.reply({ content: 'what should i search for? `skarn vault <query>`', allowedMentions: { parse: ['users'] } });
    }
    const results = searchKnowledgeBase(query);
    if (!results || results.length === 0) {
      return message.reply({ content: `nothing in the vault about "${query}". try \`skarn seed\` to add articles.`, allowedMentions: { parse: ['users'] } });
    }
    const top = results.slice(0, 5);
    const embed = new EmbedBuilder()
      .setTitle(`ðŸ” vault search: ${query}`)
      .setColor(0x00e5ff);
    for (const r of top) {
      const icon = { wikipedia: 'ðŸ“š', user_taught: 'ðŸ‘¤', learned: 'ðŸ’¡' }[r.source] || 'ðŸ’¡';
      embed.addFields({
        name: `${icon} ${r.topic}`,
        value: r.summary.slice(0, 200) + (r.summary.length > 200 ? '...' : ''),
        inline: false,
      });
    }
    embed.setFooter({ text: `${results.length} result${results.length !== 1 ? 's' : ''} found` });
    await message.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn vault',
    description: 'Search the knowledge vault',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      return { query: content.slice('skarn vault'.length).trim() };
    },
  },
};
