const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Skarn\'s daily reading — the state of the realm'),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    var guildId = interaction.guild?.id;

    // Gather data about recent activity
    var contextParts = [];
    try {
      var db = require('../db/database').db;

      var recentMessages = db.prepare(
        "SELECT COUNT(*) as count FROM conversation_messages WHERE guild_id = ? AND created_at > ?"
      ).get(guildId, Date.now() - 24 * 60 * 60 * 1000);
      contextParts.push('Messages in last 24h: ' + (recentMessages ? recentMessages.count : 0));

      var recentSignals = db.prepare(
        "SELECT signal_type, summary_text FROM server_signals WHERE guild_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 3"
      ).all(guildId, Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (recentSignals.length > 0) {
        contextParts.push('Recent signals: ' + recentSignals.map(function(s) { return s.summary_text; }).join('; '));
      }

      var climate = db.prepare(
        "SELECT emotional_state, COUNT(*) as count FROM user_emotional_context WHERE guild_id = ? GROUP BY emotional_state ORDER BY count DESC LIMIT 3"
      ).all(guildId);
      if (climate.length > 0) {
        contextParts.push('Mood: ' + climate.map(function(e) { return e.emotional_state + ' (' + e.count + ')'; }).join(', '));
      }
    } catch (e) { contextParts.push('Limited data.'); }

    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.daily });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'The realm today:\n' + contextParts.join('\n') },
        ],
        max_tokens: roleTokenBudgets.daily,
        temperature: 0.85,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: '🌅 **Daily Reading**\n\n' + result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'The realm\'s currents are unclear today.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
