const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

const MAX_FRIENDS = 30;

function getRemoveFriendResponse(args) {
  const name = args.name;
  const removed = db.prepare('SELECT * FROM friends WHERE LOWER(name) = LOWER(?)').get(name);
  if (!removed) {
    return { content: `**${name}** not found on the friends list.`, flags: 64 };
  }

  db.prepare('DELETE FROM friends WHERE LOWER(name) = LOWER(?)').run(name);

  const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  return {
    embeds: [new EmbedBuilder()
      .setTitle('Friend Removed')
      .setDescription(`**${removed.name}** has been removed from the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${removed.code}\``, inline: true },
        { name: 'List', value: `${count.count}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0xe74c3c)],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removefriend')
    .setDescription('Remove a friend from the list')
    .addStringOption(option => option.setName('name').setDescription('Player name to remove').setRequired(true)),
  async execute(interaction) {
    const name = interaction.options.getString('name');

    const removed = db.prepare('SELECT * FROM friends WHERE LOWER(name) = LOWER(?)').get(name);
    if (!removed) {
      return interaction.reply({ content: `**${name}** not found on the friends list.`, flags: 64, allowedMentions: { parse: ['users'] } });
    }

    db.prepare('DELETE FROM friends WHERE LOWER(name) = LOWER(?)').run(name);

    const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
    const embed = new EmbedBuilder()
      .setTitle('Friend Removed')
      .setDescription(`**${removed.name}** has been removed from the friends list.`)
      .addFields(
        { name: 'Code', value: `\`${removed.code}\``, inline: true },
        { name: 'List', value: `${count.count}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0xe74c3c);

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getRemoveFriendResponse(args);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn removefriend',
    description: 'Remove a friend',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { name: content.slice('skarn removefriend'.length).trim() }; },
  },
};
