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
    .setName('insult')
    .setDescription('AI roasts you playfully (no real insults)')
    .addUserOption(option => option.setName('target').setDescription('Who to playfully insult')),
  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', flags: 64, allowedMentions: { parse: ['users'] } });

    if (!canCall(interaction.user.id)) {
      return interaction.reply({ content: getRateLimitMessage(interaction.user.id), flags: 64, allowedMentions: { parse: ['users'] } });
    }

    await interaction.deferReply();
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.insult, stateLine, memoryLine });

      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Playfully insult ${target.username}:` },
        ],
        max_tokens: roleTokenBudgets.insult,
        temperature: 1.0,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
        await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      recordCall(interaction.user.id);

      const insult = result.completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Playful Insult')
        .setDescription(`${target} ${insult}`)
        .setColor(0xe74c3c);

      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    } catch (error) {
      console.error('Insult error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
      } else {
        await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
      }
    }
  },
};
