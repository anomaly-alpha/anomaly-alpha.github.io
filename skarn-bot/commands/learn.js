const { SlashCommandBuilder } = require('discord.js');
const { addKnowledgeBase } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('learn')
    .setDescription('Teach Skarn something new')
    .addStringOption(option => option.setName('topic').setDescription('Topic name').setRequired(true))
    .addStringOption(option => option.setName('summary').setDescription('What to know about it').setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic').toLowerCase().trim();
    const summary = interaction.options.getString('summary').trim();
    if (topic.length < 2) return interaction.reply({ content: 'Topic must be at least 2 characters.', flags: 64 });
    addKnowledgeBase(topic, summary, 'user_taught', 0.8);
    await interaction.reply({ content: `📖 Got it! I'll remember that **${topic}** is: ${summary}`, flags: 64 });
  },
};
