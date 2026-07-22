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
    .setName('song')
    .setDescription('AI writes a custom song about anything')
    .addStringOption(option => option.setName('topic').setDescription('What the song is about').setRequired(true))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Music style')
        .addChoices(
          { name: 'Pop', value: 'pop' },
          { name: 'Rock', value: 'rock' },
          { name: 'Hip Hop', value: 'hip hop' },
          { name: 'Country', value: 'country' },
          { name: 'R&B', value: 'R&B' },
          { name: 'Metal', value: 'metal' },
          { name: 'Classical', value: 'classical poem' },
        )),
  async execute(interaction) {
    await interaction.deferReply();
    const topic = interaction.options.getString('topic');
    const style = interaction.options.getString('style') || 'pop';
    if (!process.env.OPENAI_API_KEY) return interaction.deleteReply();

    if (!canCall(interaction.user.id)) {
      return interaction.deleteReply();
    }
    try {
      const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
      const stateLine = getStateLine(channelState.current_state);
      const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);
      const memoryLine = memory.length > 0
        ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ')
        : '';
      const systemPrompt = buildSystemPrompt({ roleLine: roles.song, stateLine, memoryLine });

      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Write a ${style} song about: ${topic}` },
        ],
        max_tokens: roleTokenBudgets.song,
        temperature: 0.9,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
        await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      recordCall(interaction.user.id);

      const song = result.completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle(`Song: ${topic}`)
        .setDescription(song)
        .setColor(0x00e5ff)
        .setFooter({ text: `Style: ${style}` });

      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    } catch (error) {
      console.error('Song error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
      } else {
        await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
      }
    }
  },
};
