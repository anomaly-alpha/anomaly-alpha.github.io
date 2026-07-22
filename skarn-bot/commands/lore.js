const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../db/database');
const { moderatedChatCompletion } = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles } = require('../persona/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Skarn shares a random piece of his history'),
  async execute(interaction) {
    await interaction.deferReply();
    var story = db.prepare(
      "SELECT * FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY random() LIMIT 1"
    ).get();

    if (!story) {
      return interaction.editReply({ content: 'The ashes are quiet. No tales come to mind.', allowedMentions: { parse: ['users'] } });
    }

    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.lore });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Tell this story in your own words, as only you can:\n\n' + story.story_text },
        ],
        max_tokens: 600,
        temperature: 0.7,
        userId: interaction.user.id,
      });

      if (!result.success) {
        if (result.crisis) {
          await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } });
          return;
        }
        await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
        return;
      }

      try { db.prepare("UPDATE skarn_stories SET used_count = used_count + 1, last_used_at = ? WHERE id = ?").run(Date.now(), story.id); } catch (e) {}
      await interaction.editReply({ content: result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch (e) {
      console.error('[Lore] Error:', e.message);
      await interaction.editReply({ content: 'The memory slips through my fingers. Try again.', allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    var story = db.prepare(
      "SELECT * FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY random() LIMIT 1"
    ).get();

    if (!story) {
      return message.reply({ content: 'The ashes are quiet. No tales come to mind.', allowedMentions: { parse: ['users'] } });
    }

    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.lore });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Tell this story in your own words, as only you can:\n\n' + story.story_text },
        ],
        max_tokens: 600,
        temperature: 0.7,
        userId: message.author.id,
      });

      if (!result.success) {
        if (result.crisis) {
          await message.reply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } });
          return;
        }
        await message.reply({ content: result.safeMessage, allowedMentions: { parse: ['users'] } });
        return;
      }

      try { db.prepare("UPDATE skarn_stories SET used_count = used_count + 1, last_used_at = ? WHERE id = ?").run(Date.now(), story.id); } catch (e) {}
      await message.channel.send({ content: result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch (e) {
      console.error('[Lore] Error:', e.message);
      await message.reply({ content: 'The memory slips through my fingers. Try again.', allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn lore',
    description: 'Skarn shares a random piece of his history',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
