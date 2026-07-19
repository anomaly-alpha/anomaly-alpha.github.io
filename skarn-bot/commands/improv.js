const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const getOpenAIClient = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { canCall, recordCall } = require('../lib/rateLimit');
const { getChannelState, getUserFacts } = require('../db/database');
const { getStateLine } = require('../features/channelState/stateTracker');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('improv')
    .setDescription('AI improv — give a scenario and play along')
    .addStringOption(option => option.setName('scenario').setDescription('The scenario to improv').setRequired(true)),
  async execute(interaction) {
    const scenario = interaction.options.getString('scenario');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', flags: 64 });

    if (!canCall(interaction.user.id)) {
      return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', flags: 64 });
    }

    await interaction.deferReply();
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.improv, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Scenario: ${scenario}\n\nYou start the scene:` },
        ],
        max_completion_tokens: roleTokenBudgets.improv,
        temperature: 0.95,
      });

      recordCall(interaction.user.id);

      const reply = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Improv Scene')
        .setDescription(`**Scenario:** ${scenario}\n\n**Skarn:** ${reply}`)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Reply with your part to continue the scene!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Improv error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, flags: 64 });
      }
    }
  },
};
