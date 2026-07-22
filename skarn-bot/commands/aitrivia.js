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

const TRIVIA_FORMAT = `Generate a single trivia question with 4 multiple choice answers (A, B, C, D). One answer must be correct. Return ONLY valid JSON in this exact format, nothing else:
{"question":"...","answers":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"funFact":"..."}

The "correct" field is the index (0-3) of the correct answer. "funFact" is a short interesting fact about the answer.`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aitrivia')
    .setDescription('AI-powered trivia on any topic')
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('Topic for questions (e.g. space, movies, history)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('difficulty')
        .setDescription('Difficulty level')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
        )),
  async execute(interaction) {
    await interaction.deferReply();
    const topic = interaction.options.getString('topic') || 'general knowledge';
    const difficulty = interaction.options.getString('difficulty') || 'medium';

    if (!process.env.OPENAI_API_KEY) {
      return interaction.deleteReply();
    }

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
      const systemPrompt = buildSystemPrompt({ roleLine: roles.aitrivia, stateLine, memoryLine });

      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${TRIVIA_FORMAT}\n\nGenerate a ${difficulty} trivia question about: ${topic}. Return ONLY the JSON, no markdown, no code blocks.` },
        ],
        max_tokens: roleTokenBudgets.aitrivia,
        temperature: 0.9,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
        await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      recordCall(interaction.user.id);

      let content = result.completion.choices[0].message.content.trim();
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

      let trivia;
      try {
        trivia = JSON.parse(content);
      } catch {
        await interaction.editReply({ content: 'Failed to generate question. Try again.', flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Trivia — ${topic}`)
        .setDescription(trivia.question)
        .addFields(
          { name: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), value: '\u200b', inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: 'You have 30 seconds to answer!' });

      const rows = [];
      for (let i = 0; i < trivia.answers.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 2, trivia.answers.length); j++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`aitrivia_${j}`)
              .setLabel(trivia.answers[j])
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }

      const msg = await interaction.editReply({ embeds: [embed], components: rows, allowedMentions: { parse: ['users'] } });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async i => {
        const answerIndex = parseInt(i.customId.split('_')[1]);
        const isCorrect = answerIndex === trivia.correct;

        const resultEmbed = new EmbedBuilder()
          .setTitle(isCorrect ? 'Correct!' : 'Wrong!')
          .setDescription(trivia.question)
          .addFields(
            { name: 'Your Answer', value: trivia.answers[answerIndex], inline: true },
            { name: 'Correct Answer', value: trivia.answers[trivia.correct], inline: true },
            { name: 'Fun Fact', value: trivia.funFact || 'N/A' },
          )
          .setColor(isCorrect ? 0x2ecc71 : 0xe74c3c);

        try {
          await i.update({ embeds: [resultEmbed], components: [] });
        } catch {
          // Interaction expired — safe to ignore
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          const timeEmbed = new EmbedBuilder()
            .setTitle("Time's up!")
            .setDescription(trivia.question)
            .addFields(
              { name: 'Correct Answer', value: trivia.answers[trivia.correct] },
              { name: 'Fun Fact', value: trivia.funFact || 'N/A' },
            )
            .setColor(0xf39c12);
          interaction.editReply({ embeds: [timeEmbed], components: [], allowedMentions: { parse: ['users'] } });
        }
      });
    } catch (error) {
      console.error('AI trivia error:', error);
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
      } else {
        await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
      }
    }
  },
};
