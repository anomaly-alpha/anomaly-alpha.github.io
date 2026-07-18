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
    .setName('debate')
    .setDescription('AI debate — bot takes a side, you argue the other')
    .addStringOption(option => option.setName('topic').setDescription('Debate topic').setRequired(true)),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.debate, stateLine, memoryLine });

      const sides = ['for', 'against'];
      const botSide = sides[Math.floor(Math.random() * sides.length)];

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Topic: ${topic}\nArgue ${botSide} this topic:` },
        ],
        max_completion_tokens: roleTokenBudgets.debate,
        temperature: 0.8,
      });

      recordCall(interaction.user.id);

      const argument = completion.choices[0].message.content;
      const userSide = botSide === 'for' ? 'against' : 'for';

      const embed = new EmbedBuilder()
        .setTitle('Debate')
        .setDescription(`**Topic:** ${topic}\n\n**Skarn argues ${botSide}:**\n${argument}`)
        .addFields(
          { name: 'Your side', value: `You argue **${userSide}**`, inline: true },
          { name: 'Bot side', value: `Skarn argues **${botSide}**`, inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: 'Make your argument in chat!' });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Debate error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    }
  },
};
