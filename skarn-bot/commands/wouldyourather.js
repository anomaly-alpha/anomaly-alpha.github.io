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
    .setName('wouldyourather')
    .setDescription('AI generates a "Would You Rather" question'),
  async execute(interaction) {
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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.wouldyourather, stateLine, memoryLine });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a would you rather question:' },
        ],
        max_completion_tokens: roleTokenBudgets.wouldyourather,
        temperature: 1.0,
      });

      recordCall(interaction.user.id);

      const content = completion.choices[0].message.content;
      const parts = content.split('|').map(p => p.trim());
      const option1 = parts[0] || 'Option A';
      const option2 = parts[1] || 'Option B';

      const embed = new EmbedBuilder()
        .setTitle('Would You Rather')
        .setDescription(`**A:** ${option1}\n\n**B:** ${option2}`)
        .setColor(0x00e5ff);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wyr_a').setLabel('A').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wyr_b').setLabel('B').setStyle(ButtonStyle.Secondary),
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async i => {
        const choice = i.customId === 'wyr_a' ? 'A' : 'B';
        try {
          await i.update({ content: `You chose **${choice}**!`, embeds: [embed], components: [] });
        } catch {
          // Interaction expired — safe to ignore
        }
      });
    } catch (error) {
      console.error('WouldYouRather error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, flags: 64 });
      }
    }
  },
};
