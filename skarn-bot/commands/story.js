const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
    .setName('story')
    .setDescription('AI collaborative story — add to the story')
    .addStringOption(option => option.setName('text').setDescription('Your part of the story').setRequired(true))
    .addStringOption(option => option.setName('genre').setDescription('Story genre')
      .addChoices(
        { name: 'Fantasy', value: 'fantasy' },
        { name: 'Sci-Fi', value: 'sci-fi' },
        { name: 'Horror', value: 'horror' },
        { name: 'Comedy', value: 'comedy' },
        { name: 'Romance', value: 'romance' },
      )),
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const genre = interaction.options.getString('genre') || 'fantasy';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    if (!canCall(interaction.user.id)) {
      return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', ephemeral: true });
    }

    await interaction.deferReply();
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserMemory(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.fact_text).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.story, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Continue this ${genre} story: ${text}` },
        ],
        max_completion_tokens: roleTokenBudgets.story,
        temperature: 0.9,
      });

      recordCall(interaction.user.id);

      const continuation = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Story')
        .setDescription(`**You wrote:**\n${text}\n\n**Skarn continues:**\n${continuation}`)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Use /story to add your next part!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Story error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    }
  },
};
