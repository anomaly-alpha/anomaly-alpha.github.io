const { SlashCommandBuilder } = require('discord.js');
const { db } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Skarn shares a random piece of his history'),
  async execute(interaction) {
    var story = db.prepare(
      "SELECT * FROM skarn_stories WHERE source IN ('canonical', 'auto_lore') ORDER BY random() LIMIT 1"
    ).get();

    if (!story) {
      return interaction.reply({ content: 'The ashes are quiet. No tales come to mind.', flags: 64 });
    }

    // Update used count
    try { db.prepare("UPDATE skarn_stories SET used_count = used_count + 1, last_used_at = ? WHERE id = ?").run(Date.now(), story.id); } catch (e) {}

    return interaction.reply(story.story_text);
  },
};
