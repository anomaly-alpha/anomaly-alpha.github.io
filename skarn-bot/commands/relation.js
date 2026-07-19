const { SlashCommandBuilder } = require('discord.js');
const { getRelationship } = require('../db/database');

function getRelationResponse(userId, guildId) {
  const rel = getRelationship(userId, guildId);
  const tags = JSON.parse(rel.tags || '[]');
  const tagStr = tags.length > 0 ? tags.join(', ') : 'none yet';
  return {
    content: `I'd say we're at **${Math.round(rel.familiarity)}/100**. Feels like you're one of the *${tagStr}*. Banter level: ${rel.banter_level}.`,
    flags: 64,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('relation')
    .setDescription('See how Skarn sees you'),
  async execute(interaction) {
    const rel = getRelationship(interaction.user.id, interaction.guild.id);
    const tags = JSON.parse(rel.tags || '[]');
    const tagStr = tags.length > 0 ? tags.join(', ') : 'none yet';
    await interaction.reply({
      content: `I'd say we're at **${Math.round(rel.familiarity)}/100**. Feels like you're one of the *${tagStr}*. Banter level: ${rel.banter_level}.`,
      flags: 64,
    });
  },
  async handleActivation(message, args) {
    if (!message.guild) return message.reply({ content: 'This command can only be used in a server.', flags: 64 });
    const result = getRelationResponse(message.author.id, message.guild.id);
    await message.reply(result);
  },
  activation: {
    type: 'command',
    phrase: 'skarn relation',
    description: 'Check relationship status',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn relation'.length).trim() || null }; },
  },
};
