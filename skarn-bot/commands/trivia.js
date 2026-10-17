const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

const TRIVIA_FORMAT = 'Generate one multiple-choice trivia question with four answers. Return only valid JSON in this format: {"question":"...","answers":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"funFact":"..."}. The correct field is the index (0-3).';

function decodeHtml(text) {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

async function getAiQuestion(interaction, topic, difficulty) {
  const channelState = require('../db/database').getChannelState(interaction.channel.id, interaction.guild.id);
  const stateLine = require('../features/channelState/stateTracker').getStateLine(channelState?.current_state);
  const memory = require('../db/database').getUserFacts(interaction.user.id, interaction.guild.id, 5);
  const memoryLine = memory.length ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ') : '';
  let serverTopics = [];
  if (!topic) {
    try {
      serverTopics = require('../db/database').db.prepare(
        'SELECT content FROM conversation_messages WHERE guild_id = ? ORDER BY created_at DESC LIMIT 20'
      ).all(interaction.guild.id).map(m => m.content);
    } catch (e) {}
  }
  const target = topic || (serverTopics.length ? 'topics from this server’s recent conversation' : 'general knowledge');
  const systemPrompt = buildSystemPrompt({ roleLine: roles.aitrivia, stateLine, memoryLine });
  const context = serverTopics.length && !topic ? '\nRecent server topics: ' + serverTopics.join('; ').slice(0, 500) : '';
  const result = await moderatedChatCompletion({
    model: process.env.AI_MODEL || 'gpt-6-luna',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: TRIVIA_FORMAT + '\n\nGenerate a ' + difficulty + ' trivia question about ' + target + '.' + context },
    ],
    max_tokens: roleTokenBudgets.aitrivia,
    temperature: 0.9,
    userId: interaction.user.id,
    guildId: interaction.guildId,
  });
  if (!result.success) return { error: result.safeMessage || 'Trivia generation is unavailable.', crisis: result.crisis };
  let content = result.completion.choices[0].message.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  let question;
  try { question = JSON.parse(content); }
  catch { return { error: 'Failed to generate a valid question. Try again.' }; }
  if (!question.question || !Array.isArray(question.answers) || question.answers.length !== 4 || !Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3) {
    return { error: 'Failed to generate a valid question. Try again.' };
  }
  return { question, topic: target };
}

async function getClassicQuestion() {
  const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
  const data = await response.json();
  const result = data.results && data.results[0];
  if (!result) throw new Error('No trivia question returned');
  const answers = [...result.incorrect_answers, result.correct_answer].map(decodeHtml).sort(() => Math.random() - 0.5);
  return { question: { question: decodeHtml(result.question), answers, correct: answers.indexOf(decodeHtml(result.correct_answer)), funFact: '' } };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Play classic or AI-powered trivia')
    .addStringOption(option => option.setName('source').setDescription('Classic database or Skarn-generated')
      .addChoices({ name: 'Classic', value: 'db' }, { name: 'AI', value: 'ai' }))
    .addStringOption(option => option.setName('topic').setDescription('AI topic; omit to use server conversation themes').setRequired(false).setMaxLength(100))
    .addStringOption(option => option.setName('difficulty').setDescription('AI question difficulty').setRequired(false)
      .addChoices({ name: 'Easy', value: 'easy' }, { name: 'Medium', value: 'medium' }, { name: 'Hard', value: 'hard' })),
  async execute(interaction) {
    const source = interaction.options.getString('source') || 'db';
    const topic = interaction.options.getString('topic');
    const difficulty = interaction.options.getString('difficulty') || 'medium';
    await interaction.deferReply();

    try {
      let generated;
      if (source === 'ai') {
        generated = await getAiQuestion(interaction, topic, difficulty);
        if (generated.error) {
          const content = generated.crisis ? require('../features/safety/crisisResponse').getCrisisResponse().content : generated.error;
          return interaction.editReply({ content, allowedMentions: { parse: [] } });
        }
      } else {
        generated = await getClassicQuestion();
      }

      const trivia = generated.question;
      const rows = [];
      for (let i = 0; i < trivia.answers.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 2, trivia.answers.length); j++) {
          row.addComponents(new ButtonBuilder().setCustomId('trivia_' + j).setLabel(trivia.answers[j].slice(0, 80)).setStyle(ButtonStyle.Secondary));
        }
        rows.push(row);
      }
      const title = source === 'ai' ? 'Trivia — ' + generated.topic : 'Classic Trivia';
      const embed = new EmbedBuilder().setTitle(title).setDescription(trivia.question).setColor(0x00e5ff);
      if (source === 'ai') embed.setFooter({ text: difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + ' · 30 seconds to answer' });
      await interaction.editReply({ embeds: [embed], components: rows, allowedMentions: { parse: [] } });

      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: source === 'ai' ? 30000 : 15000,
        max: 1,
      });
      collector.on('collect', async i => {
        const answerIndex = Number(i.customId.split('_')[1]);
        const correct = answerIndex === trivia.correct;
        const resultEmbed = new EmbedBuilder().setTitle(correct ? 'Correct!' : 'Wrong!').setDescription(trivia.question)
          .addFields({ name: 'Your Answer', value: trivia.answers[answerIndex] || 'Unknown', inline: true }, { name: 'Correct Answer', value: trivia.answers[trivia.correct], inline: true });
        if (trivia.funFact) resultEmbed.addFields({ name: 'Fun Fact', value: trivia.funFact });
        resultEmbed.setColor(correct ? 0x2ecc71 : 0xe74c3c);
        await i.update({ embeds: [resultEmbed], components: [], allowedMentions: { parse: [] } }).catch(() => {});
      });
      collector.on('end', collected => {
        if (collected.size) return;
        const resultEmbed = new EmbedBuilder().setTitle("Time's up!").setDescription(trivia.question)
          .addFields({ name: 'Correct Answer', value: trivia.answers[trivia.correct] });
        if (trivia.funFact) resultEmbed.addFields({ name: 'Fun Fact', value: trivia.funFact });
        resultEmbed.setColor(0xf39c12);
        interaction.editReply({ embeds: [resultEmbed], components: [], allowedMentions: { parse: [] } }).catch(() => {});
      });
    } catch (error) {
      console.error('[Trivia] Error:', error.message);
      await interaction.editReply({ content: 'Could not fetch a trivia question.', allowedMentions: { parse: [] } });
    }
  },
};
