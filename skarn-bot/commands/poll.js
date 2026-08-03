const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll — Skarn can suggest options if you want')
    .addStringOption(option => option.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption(option => option.setName('options').setDescription('Options (comma-separated, or leave blank for Skarn to suggest)')),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    var options = interaction.options.getString('options');

    if (!options) {
      // AI suggests poll options
      await interaction.deferReply();
      try {
        var recentTopics = [];
        try {
          var db = require('../db/database').db;
          recentTopics = db.prepare(
            "SELECT content FROM conversation_messages WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10"
          ).all(interaction.guild.id).map(function(m) { return m.content; });
        } catch (e) {}

        var ctx = recentTopics.length > 0 ? 'Recent server conversation: ' + recentTopics.join('; ').slice(0, 500) : '';
        var systemPrompt = buildSystemPrompt({ roleLine: roles.pollsuggest });
        var result = await moderatedChatCompletion({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Topic: "' + question + '"\n' + ctx + '\n\nSuggest 3-5 poll options. Return ONLY a JSON array of strings.' },
          ],
          max_tokens: roleTokenBudgets.pollsuggest,
          temperature: 0.8,
          userId: interaction.user.id,
        });
        if (result.success) {
          var parsed = JSON.parse(result.completion.choices[0].message.content.replace(/```json|```/g, '').trim());
          if (Array.isArray(parsed) && parsed.length >= 2) {
            options = parsed.join(', ');
          } else {
            options = 'Yes, No, Maybe';
          }
        }
      } catch (e) {
        options = 'Yes, No, Maybe';
      }
    }

    options = options.split(',').map(function(o) { return o.trim(); }).slice(0, 10);

    if (options.length < 2) {
      return (interaction.deferred ? interaction.editReply : interaction.reply).bind(interaction)({ content: 'You need at least 2 options.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    var description = options.map(function(opt, i) { return reactions[i] + ' ' + opt; }).join('\n');
    var embed = new EmbedBuilder()
      .setTitle(question)
      .setDescription(description)
      .setColor(0x00e5ff);

    var replyFn = interaction.deferred ? interaction.editReply : interaction.reply;
    var message = await replyFn.bind(interaction)({ embeds: [embed], fetchReply: true, allowedMentions: { parse: ['users'] } });
    for (var i = 0; i < options.length; i++) {
      await message.react(reactions[i]);
    }
  },
  async handleActivation(message, args) {
    const question = args.question;
    let options = args.options;
    if (!options) {
      var recentTopics = [];
      try {
        var db = require('../db/database').db;
        recentTopics = db.prepare(
          "SELECT content FROM conversation_messages WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10"
        ).all(message.guild.id).map(function(m) { return m.content; });
      } catch (e) {}
      var ctx = recentTopics.length > 0 ? 'Recent server conversation: ' + recentTopics.join('; ').slice(0, 500) : '';
      var systemPrompt = buildSystemPrompt({ roleLine: roles.pollsuggest });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Topic: "' + question + '"\n' + ctx + '\n\nSuggest 3-5 poll options. Return ONLY a JSON array of strings.' },
        ],
        max_tokens: roleTokenBudgets.pollsuggest,
        temperature: 0.8,
        userId: message.author.id,
      });
      if (result.success) {
        try {
          var parsed = JSON.parse(result.completion.choices[0].message.content.replace(/```json|```/g, '').trim());
          if (Array.isArray(parsed) && parsed.length >= 2) {
            options = parsed.join(', ');
          } else {
            options = 'Yes, No, Maybe';
          }
        } catch (e) {
          options = 'Yes, No, Maybe';
        }
      } else {
        options = 'Yes, No, Maybe';
      }
    }
    const optionList = options.split(',').map(function(o) { return o.trim(); }).slice(0, 10);
    if (optionList.length < 2) {
      return message.reply({ content: 'You need at least 2 options.', allowedMentions: { parse: ['users'] } });
    }
    const description = optionList.map(function(opt, i) { return reactions[i] + ' ' + opt; }).join('\n');
    const embed = new EmbedBuilder().setTitle(question).setDescription(description).setColor(0x00e5ff);
    const sent = await message.reply({ embeds: [embed], fetchReply: true, allowedMentions: { parse: ['users'] } });
    for (let i = 0; i < optionList.length; i++) {
      await sent.react(reactions[i]);
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn poll',
    description: 'Create a poll with reaction options',
    parseArgs: function(content) {
      const rest = content.slice('skarn poll'.length).trim();
      const idx = rest.toLowerCase().indexOf('options:');
      if (idx === -1) return { question: rest || null, options: null };
      return { question: rest.slice(0, idx).trim() || null, options: rest.slice(idx + 'options:'.length).trim() || null };
    },
  },
};
