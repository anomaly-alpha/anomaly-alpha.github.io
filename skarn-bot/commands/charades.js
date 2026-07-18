const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const getOpenAIClient = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { canCall, recordCall } = require('../lib/rateLimit');
const { getChannelState, getUserMemory } = require('../db/database');
const { getStateLine } = require('../features/channelState/stateTracker');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('charades')
    .setDescription('AI gives clues, you guess the word')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Category')
        .addChoices(
          { name: 'Movies', value: 'movies' },
          { name: 'Animals', value: 'animals' },
          { name: 'Objects', value: 'objects' },
          { name: 'Celebrity', value: 'celebrities' },
          { name: 'Random', value: 'random' },
        )),
  async execute(interaction) {
    const category = interaction.options.getString('category') || 'random';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', flags: 64 });

    if (!canCall(interaction.user.id)) {
      return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', flags: 64 });
    }

    await interaction.deferReply();
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.charades, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Category: ${category}\nGenerate a word and give 4 clues, one at a time from vague to specific.` },
        ],
        max_completion_tokens: roleTokenBudgets.charades,
        temperature: 0.9,
      });

      recordCall(interaction.user.id);

      const clues = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle(`Charades — ${category}`)
        .setDescription(clues)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Try to guess from the clues!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Charades error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, flags: 64 });
      }
    }
  },
};
