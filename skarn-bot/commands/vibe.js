const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');
const { getServerClimate } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vibe')
    .setDescription('Check the server\'s current emotional climate'),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    var guildId = interaction.guild?.id;
    if (!guildId) return interaction.editReply({ content: 'This command only works in a server.', flags: 64, allowedMentions: { parse: ['users'] } });

    var climate = getServerClimate(guildId);
    var moodData = '';

    try {
      // Get raw emotion distribution
      var db = require('../db/database').db;
      var allEmotions = db.prepare(
        "SELECT emotional_state, COUNT(*) as count FROM user_emotional_context WHERE guild_id = ? GROUP BY emotional_state ORDER BY count DESC"
      ).all(guildId);

      if (allEmotions.length > 0) {
        moodData = allEmotions.map(function(e) { return e.emotional_state + ': ' + e.count + ' users'; }).join(', ');
      }

      // Get recent activity
      var recentActivity = db.prepare(
        "SELECT COUNT(*) as count FROM conversation_messages WHERE guild_id = ? AND created_at > ?"
      ).get(guildId, Date.now() - 3600000);

      moodData += (moodData ? ' | ' : '') + 'Messages in last hour: ' + (recentActivity ? recentActivity.count : 0);
    } catch (e) { moodData = 'Limited data available.'; }

    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.vibe });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Current server climate: ' + moodData },
        ],
        max_tokens: roleTokenBudgets.vibe,
        temperature: 0.85,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: '🌊 **The Vibe:**\n\n' + result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'The server\'s emotional currents are unclear right now.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
