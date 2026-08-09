const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Play a trivia question')
    .addStringOption(option =>
      option.setName('source')
        .setDescription('Where should the question come from?')
        .addChoices(
          { name: 'Skarn (AI-generated, server-themed)', value: 'ai' },
          { name: 'Trivia DB (classic questions)', value: 'db' },
        )),
  async execute(interaction) {
    const source = interaction.options.getString('source') || 'db';
    await interaction.deferReply();

    try {
      var question, correctAnswer, incorrectAnswers;

      if (source === 'ai') {
        // AI-generated trivia — Skarn comes up with questions about the server's interests
        var recentTopics = [];
        try {
          var db = require('../db/database').db;
          recentTopics = db.prepare(
            "SELECT content FROM conversation_messages WHERE guild_id = ? ORDER BY created_at DESC LIMIT 20"
          ).all(interaction.guild.id).map(function(m) { return m.content; });
        } catch (e) {}

        var prompt = 'Generate a trivia question. Return ONLY a JSON object with: { "question": "...", "correct": "...", "incorrect": ["...", "...", "..."] }.';
        if (recentTopics.length > 0) prompt += ' Base it on topics this server cares about: ' + recentTopics.join('; ').slice(0, 500) + '.';

        var systemPrompt = buildSystemPrompt({ roleLine: roles.aitrivia });
        var result = await moderatedChatCompletion({
          model: process.env.AI_MODEL || 'gpt-5.4-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          max_tokens: roleTokenBudgets.aitrivia,
          temperature: 0.8,
          userId: interaction.user.id,
        });
        if (!result.success) throw new Error('AI failed');

        var parsed;
        try {
          parsed = JSON.parse(result.completion.choices[0].message.content.replace(/```json|```/g, '').trim());
        } catch (e) {
          throw new Error('Parse failed');
        }
        question = parsed.question;
        correctAnswer = parsed.correct;
        incorrectAnswers = parsed.incorrect;
      } else {
        // Traditional trivia DB
        var res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        var data = await res.json();
        var q = data.results[0];
        if (!q) throw new Error('Fetch failed');
        question = q.question.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace('&#039;', "'");
        correctAnswer = q.correct_answer;
        incorrectAnswers = q.incorrect_answers;
      }

      var answers = [...incorrectAnswers, correctAnswer].sort(function() { return Math.random() - 0.5; });
      var correctIndex = answers.indexOf(correctAnswer);

      var rows = [];
      for (var i = 0; i < answers.length; i += 2) {
        var row = new ActionRowBuilder();
        for (var j = i; j < Math.min(i + 2, answers.length); j++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('trivia_' + j)
              .setLabel(answers[j].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace('&#039;', "'"))
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }

      var embed = new EmbedBuilder()
        .setTitle('Trivia' + (source === 'ai' ? ' — asked by Skarn' : ''))
        .setDescription(question)
        .setColor(0x00e5ff);

      await interaction.editReply({ embeds: [embed], components: rows, allowedMentions: { parse: ['users'] } });

      var filter = function(i) { return i.user.id === interaction.user.id; };
      var collector = interaction.channel.createMessageComponentCollector({ filter: filter, time: 15000, max: 1 });

      collector.on('collect', async function(i) {
        var index = parseInt(i.customId.split('_')[1]);
        try {
          if (index === correctIndex) {
            await i.update({ content: 'Correct! The answer was: **' + correctAnswer + '**', components: [], allowedMentions: { parse: ['users'] } });
          } else {
            await i.update({ content: 'Wrong! The answer was: **' + correctAnswer + '**', components: [], allowedMentions: { parse: ['users'] } });
          }
        } catch (e) { /* ignore */ }
      });

      collector.on('end', function(collected) {
        if (collected.size === 0) {
          interaction.editReply({ content: 'Time\'s up! The answer was: **' + correctAnswer + '**', components: [], allowedMentions: { parse: ['users'] } });
        }
      });
    } catch (e) {
      await interaction.editReply({ content: 'Could not fetch trivia question.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
