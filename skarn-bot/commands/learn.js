const { SlashCommandBuilder } = require('discord.js');
const { addKnowledgeBase } = require('../db/database');

function getLearnResponse(args) {
  const topic = args.topic.toLowerCase().trim();
  const summary = args.info.trim();
  if (topic.length < 2) return { content: 'Topic must be at least 2 characters.', flags: 64 };
  addKnowledgeBase(topic, summary, 'user_taught', 0.8);
  return { content: `📖 Got it! I'll remember that **${topic}** is: ${summary}`, flags: 64 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('learn')
    .setDescription('Teach Skarn something new')
    .addStringOption(option => option.setName('topic').setDescription('Topic name').setRequired(true))
    .addStringOption(option => option.setName('summary').setDescription('What to know about it').setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic').toLowerCase().trim();
    const summary = interaction.options.getString('summary').trim();
    if (topic.length < 2) return interaction.reply({ content: 'Topic must be at least 2 characters.', flags: 64, allowedMentions: { parse: ['users'] } });
    addKnowledgeBase(topic, summary, 'user_taught', 0.8);
    await interaction.reply({ content: `📖 Got it! I'll remember that **${topic}** is: ${summary}`, flags: 64, allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getLearnResponse(args);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn learn',
    description: 'Teach Skarn something',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { const parts = content.slice('skarn learn'.length).split('|').map(s=>s.trim()); return { topic: parts[0] || '', info: parts[1] || '' }; },
  },
};
