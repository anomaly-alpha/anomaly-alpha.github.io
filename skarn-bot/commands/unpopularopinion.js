const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    .setName('unpopularopinion')
    .setDescription('AI generates a hot take — agree or disagree?'),
  async execute(interaction) {
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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.unpopularopinion, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate an unpopular opinion:' },
        ],
        max_completion_tokens: roleTokenBudgets.unpopularopinion,
        temperature: 1.0,
      });

      recordCall(interaction.user.id);

      const opinion = completion.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setTitle('Hot Take')
        .setDescription(opinion)
        .setColor(0xe74c3c);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('uo_agree').setLabel('Agree').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('uo_disagree').setLabel('Disagree').setStyle(ButtonStyle.Danger),
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const votes = { agree: 0, disagree: 0 };
      const filter = i => true;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'uo_agree') votes.agree++;
        else votes.disagree++;
        try {
          await i.update({
            content: `\u{1F44D} ${votes.agree} agree | \u{1F44E} ${votes.disagree} disagree`,
            embeds: [embed],
            components: [row],
          });
        } catch {
          // Interaction expired — safe to ignore
        }
      });
    } catch (error) {
      console.error('UnpopularOpinion error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, flags: 64 });
      }
    }
  },
};
