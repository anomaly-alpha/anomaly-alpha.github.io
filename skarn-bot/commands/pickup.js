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
    .setName('pickup')
    .setDescription('AI pickup line generator'),
  async execute(interaction) {
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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.pickup, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a pickup line:' },
        ],
        max_tokens: roleTokenBudgets.pickup,
        temperature: 1.0,
      });

      recordCall(interaction.user.id);

      const line = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Pickup Line')
        .setDescription(line)
        .setColor(0xe91e8a);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Pickup error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    }
  },
};
