const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllFriends } = require('../db/database');

const MAX_FRIENDS = 30;

function getFull(friends) {
  return friends.filter(f => f.power === '30/30').length;
}

function getNotFull(friends) {
  return friends.filter(f => f.power !== '30/30');
}

function getFriendsResponse(args) {
  const friends = getAllFriends();
  const search = args.search;

  if (search) {
    const query = search.toLowerCase();
    const matches = friends.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.code.toLowerCase().includes(query) ||
      (f.note && f.note.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      return { content: `No friends found matching "${search}".`, flags: 64 };
    }

    const list = matches.map(f => {
      const note = f.note ? ` — ${f.note}` : '';
      return `**${f.name}** | \`${f.code}\` | ${f.power}${note}`;
    }).join('\n');

    return { embeds: [new EmbedBuilder().setTitle(`Search: ${search}`).setDescription(list).setColor(0x00e5ff)] };
  }

  const list = friends.map(f => `\`${f.code}\` **${f.name}** ${f.power}`).join('\n');
  const notFull = getNotFull(friends);
  const full = getFull(friends);

  return {
    embeds: [new EmbedBuilder()
      .setTitle('Friends List')
      .setDescription(list)
      .addFields(
        { name: 'Total', value: `${friends.length}`, inline: true },
        { name: 'Full (30/30)', value: `${full}`, inline: true },
        { name: 'Open Slots', value: `${notFull.length}`, inline: true },
        { name: 'Capacity', value: `${friends.length}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x00e5ff)
      .setFooter({ text: 'Use /friends search:"name" to find someone' })],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friends')
    .setDescription('Show friend list and codes')
    .addStringOption(option =>
      option.setName('search')
        .setDescription('Search by name or code')
        .setRequired(false)),
  async execute(interaction) {
    const friends = getAllFriends();
    const search = interaction.options.getString('search');

    if (search) {
      const query = search.toLowerCase();
      const matches = friends.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.code.toLowerCase().includes(query) ||
        (f.note && f.note.toLowerCase().includes(query))
      );

      if (matches.length === 0) {
        return interaction.reply({ content: `No friends found matching "${search}".`, flags: 64, allowedMentions: { parse: ['users'] } });
      }

      const list = matches.map(f => {
        const note = f.note ? ` — ${f.note}` : '';
        return `**${f.name}** | \`${f.code}\` | ${f.power}${note}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`Search: ${search}`)
        .setDescription(list)
        .setColor(0x00e5ff);
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    }

    const list = friends.map(f => `\`${f.code}\` **${f.name}** ${f.power}`).join('\n');
    const notFull = getNotFull(friends);
    const full = getFull(friends);

    const embed = new EmbedBuilder()
      .setTitle('Friends List')
      .setDescription(list)
      .addFields(
        { name: 'Total', value: `${friends.length}`, inline: true },
        { name: 'Full (30/30)', value: `${full}`, inline: true },
        { name: 'Open Slots', value: `${notFull.length}`, inline: true },
        { name: 'Capacity', value: `${friends.length}/${MAX_FRIENDS}`, inline: true },
      )
      .setColor(0x00e5ff)
      .setFooter({ text: 'Use /friends search:"name" to find someone' });

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    const result = getFriendsResponse(args);
    await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
  },
  activation: {
    type: 'command',
    phrase: 'skarn friends',
    description: 'View friend list',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { search: content.slice('skarn friends'.length).trim() || null }; },
  },
};
