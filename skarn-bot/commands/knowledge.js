const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getKnowledgeBase, searchKnowledgeBase } = require('../db/database');

function sourceIcon(source) {
  return ({ wikipedia: '📚', user_taught: '👤', learned: '💡' })[source] || '💡';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('Look up or search Skarn’s internal knowledge base')
    .addSubcommand(sub => sub.setName('lookup').setDescription('Look up one exact topic')
      .addStringOption(option => option.setName('topic').setDescription('Topic to look up').setRequired(true)))
    .addSubcommand(sub => sub.setName('search').setDescription('Search across stored topics')
      .addStringOption(option => option.setName('query').setDescription('Words to search for').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'lookup') {
      const topic = interaction.options.getString('topic').toLowerCase();
      const result = getKnowledgeBase(topic);
      if (!result) return interaction.reply({ content: 'I do not have anything stored about "' + topic + '". Try /learn to teach me.', flags: 64, allowedMentions: { parse: [] } });
      const embed = new EmbedBuilder().setTitle(sourceIcon(result.source) + ' ' + result.topic).setDescription(result.summary).setColor(0x00e5ff)
        .setFooter({ text: 'Source: ' + result.source + ' | Confidence: ' + Math.round(result.confidence * 100) + '%' });
      return interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: [] } });
    }

    const query = interaction.options.getString('query').toLowerCase();
    const results = searchKnowledgeBase(query) || [];
    if (!results.length) return interaction.reply({ content: 'Nothing in the knowledge base matched "' + query + '". Try /learn to teach me.', flags: 64, allowedMentions: { parse: [] } });
    const embed = new EmbedBuilder().setTitle('Knowledge search: ' + query).setColor(0x00e5ff);
    for (const result of results.slice(0, 5)) {
      embed.addFields({ name: sourceIcon(result.source) + ' ' + result.topic, value: result.summary.slice(0, 200) + (result.summary.length > 200 ? '...' : ''), inline: false });
    }
    embed.setFooter({ text: results.length + ' result' + (results.length === 1 ? '' : 's') + ' found' });
    return interaction.reply({ embeds: [embed], flags: 64, allowedMentions: { parse: [] } });
  },
};
