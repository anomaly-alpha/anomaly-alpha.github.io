const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { moderatedChatCompletion } = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { canCall, recordCall, getRateLimitMessage } = require('../lib/rateLimit');
const { getChannelState, getUserFacts } = require('../db/database');
const { getStateLine } = require('../features/channelState/stateTracker');

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipe')
    .setDescription('AI recipe finder — what can you make?')
    .addStringOption(option => option.setName('ingredients').setDescription('Ingredients you have (e.g. chicken, rice, eggs)').setRequired(true)),
  async execute(interaction) {
    const ingredients = interaction.options.getString('ingredients');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', flags: 64 });

    if (!canCall(interaction.user.id)) {
      return interaction.reply({ content: getRateLimitMessage(interaction.user.id), flags: 64 });
    }

    await interaction.deferReply();
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.recipe, stateLine, memoryLine });

      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `I have: ${ingredients}. What can I make?` },
        ],
        max_tokens: roleTokenBudgets.recipe,
        temperature: 0.7,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64 }); return; }
        await interaction.editReply({ content: result.safeMessage, flags: 64 });
        return;
      }

      recordCall(interaction.user.id);

      const recipe = result.completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Recipe')
        .setDescription(recipe)
        .setColor(0x00e5ff)
        .setFooter({ text: `Ingredients: ${ingredients}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Recipe error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, flags: 64 });
      }
    }
  },
};
