const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

const activeAdventures = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adventure')
    .setDescription('AI Dungeon Master — text adventure game')
    .addStringOption(option => option.setName('theme').setDescription('Theme (fantasy, sci-fi, horror, etc.)')
      .addChoices(
        { name: 'Fantasy', value: 'fantasy medieval' },
        { name: 'Sci-Fi', value: 'sci-fi space' },
        { name: 'Horror', value: 'horror' },
        { name: 'Pirate', value: 'pirate adventure' },
        { name: 'Zombie', value: 'zombie apocalypse' },
      )),
  async execute(interaction) {
    await interaction.deferReply();
    const theme = interaction.options.getString('theme') || 'fantasy medieval';
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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.adventure, stateLine, memoryLine });

      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Start a new ${theme} adventure for ${interaction.user.username}. Describe the opening scene and give me 4 choices.` },
        ],
        max_tokens: roleTokenBudgets.adventure,
        temperature: 0.9,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
        await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      recordCall(interaction.user.id);

      const scene = result.completion.choices[0].message.content;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('adv_1').setLabel('1').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_2').setLabel('2').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_3').setLabel('3').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_4').setLabel('4').setStyle(ButtonStyle.Primary),
      );

      const embed = new EmbedBuilder()
        .setTitle('Adventure')
        .setDescription(scene)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Click a button to choose your action' });

      const msg = await interaction.editReply({ embeds: [embed], components: [row], allowedMentions: { parse: ['users'] } });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      const history = [{ role: 'assistant', content: scene }];

      collector.on('collect', async i => {
        if (!canCall(i.user.id)) {
          await i.reply({ content: getRateLimitMessage(i.user.id), flags: 64, allowedMentions: { parse: ['users'] } });
          return;
        }

        const choice = i.customId.replace('adv_', '');
        history.push({ role: 'user', content: `Choice ${choice}` });

        try {
          var result = await moderatedChatCompletion({
            model: process.env.AI_MODEL || 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              ...history,
            ],
            max_tokens: roleTokenBudgets.adventure,
            temperature: 0.9,
            userId: i.user.id,
          });

          if (!result.success) {
            if (result.crisis) { await i.update({ content: require('../features/safety/crisisResponse').getCrisisResponse().content }); return; }
            await i.update({ content: result.safeMessage });
            return;
          }

          recordCall(i.user.id);

          const nextScene = result.completion.choices[0].message.content;
          history.push({ role: 'assistant', content: nextScene });

          const nextEmbed = new EmbedBuilder()
            .setTitle('Adventure')
            .setDescription(nextScene)
            .setColor(0x00e5ff)
            .setFooter({ text: 'Click a button to choose your action' });

          await i.update({ embeds: [nextEmbed], components: [row] });
        } catch (error) {
          if (error.code !== 10062) console.error('Adventure continuation error:', error);
          try {
            const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
            await i.update({ content: errorMsg });
          } catch {
            // Interaction expired or already acknowledged — safe to ignore
          }
        }
      });

      collector.on('end', () => {
        interaction.editReply({ components: [], allowedMentions: { parse: ['users'] } }).catch(() => {});
      });
    } catch (error) {
      console.error('Adventure error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
      } else {
        await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
      }
    }
  },
};
