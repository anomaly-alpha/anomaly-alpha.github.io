const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getKnowledgeBase } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('Query Skarn\'s knowledge base')
    .addStringOption(option => option.setName('topic').setDescription('Topic to look up').setRequired(true)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic').toLowerCase();
    const result = getKnowledgeBase(topic);
    if (!result) {
      return interaction.reply({ content: `I don't have anything stored about "${topic}". Try /learn to teach me.`, flags: 64 });
    }
    const sourceIcon = { wikipedia: '📚', user_taught: '👤', learned: '💡' }[result.source] || '💡';
    const embed = new EmbedBuilder()
      .setTitle(`${sourceIcon} ${result.topic}`)
      .setDescription(result.summary)
      .setColor(0x00e5ff)
      .setFooter({ text: `Source: ${result.source} | Confidence: ${Math.round(result.confidence * 100)}%` });
    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
