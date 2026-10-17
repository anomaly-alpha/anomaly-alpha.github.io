const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db/database').db;

const MAX_FRIENDS = 30;

function getFriends() {
  return db.prepare('SELECT code, name, power, note FROM friends ORDER BY name COLLATE NOCASE').all();
}

function listEmbed(friends) {
  const list = friends.map(f => '[' + f.code + '] **' + f.name + '** ' + f.power + (f.note ? ' — ' + f.note : '')).join('\n');
  const full = friends.filter(f => f.power === '30/30').length;
  return new EmbedBuilder()
    .setTitle('Friends List')
    .setDescription(list || 'No friends on the list yet.')
    .addFields(
      { name: 'Total', value: String(friends.length), inline: true },
      { name: 'Full (30/30)', value: String(full), inline: true },
      { name: 'Open Slots', value: String(friends.length - full), inline: true },
      { name: 'Capacity', value: friends.length + '/' + MAX_FRIENDS, inline: true },
    )
    .setColor(0x00e5ff);
}

function findMatches(friends, query) {
  const normalized = query.toLowerCase();
  return friends.filter(f => f.name.toLowerCase().includes(normalized) || f.code.toLowerCase().includes(normalized) || (f.note && f.note.toLowerCase().includes(normalized)));
}

function searchEmbed(query, matches) {
  if (!matches.length) return null;
  const lines = matches.map(f => '**' + f.name + '** | [' + f.code + '] | ' + f.power + (f.note ? ' — ' + f.note : ''));
  return new EmbedBuilder().setTitle('Search: ' + query).setDescription(lines.join('\n')).setColor(0x00e5ff);
}

function addFriend(code, name, power, note) {
  const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  if (count.count >= MAX_FRIENDS) return { content: 'Friend list is full (' + MAX_FRIENDS + '/' + MAX_FRIENDS + '). Remove someone first.' };
  if (db.prepare('SELECT 1 FROM friends WHERE code = ?').get(code)) return { content: 'Friend code ' + code + ' is already on the list.' };
  if (db.prepare('SELECT 1 FROM friends WHERE LOWER(name) = LOWER(?)').get(name)) return { content: '**' + name + '** is already on the list.' };

  db.prepare('INSERT INTO friends (code, name, power, note) VALUES (?, ?, ?, ?)').run(code, name, power || '30/30', note || null);
  const newCount = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  return { embeds: [new EmbedBuilder().setTitle('Friend Added').setDescription('**' + name + '** has been added to the friends list.')
    .addFields({ name: 'Code', value: code, inline: true }, { name: 'Power', value: power || '30/30', inline: true }, { name: 'List', value: newCount.count + '/' + MAX_FRIENDS, inline: true }).setColor(0x2ecc71)] };
}

function removeFriend(name) {
  const removed = db.prepare('SELECT * FROM friends WHERE LOWER(name) = LOWER(?)').get(name);
  if (!removed) return { content: '**' + name + '** not found on the friends list.' };
  db.prepare('DELETE FROM friends WHERE LOWER(name) = LOWER(?)').run(name);
  const count = db.prepare('SELECT COUNT(*) as count FROM friends').get();
  return { embeds: [new EmbedBuilder().setTitle('Friend Removed').setDescription('**' + removed.name + '** has been removed from the friends list.')
    .addFields({ name: 'Code', value: removed.code, inline: true }, { name: 'List', value: count.count + '/' + MAX_FRIENDS, inline: true }).setColor(0xe74c3c)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friends')
    .setDescription('Manage the game friend-code roster')
    .addSubcommand(sub => sub.setName('list').setDescription('Show the friend list and open slots'))
    .addSubcommand(sub => sub.setName('search').setDescription('Search friends by name, code, or note')
      .addStringOption(option => option.setName('query').setDescription('Name, code, or note to search').setRequired(true)))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a friend to the list')
      .addStringOption(option => option.setName('code').setDescription('Friend code').setRequired(true))
      .addStringOption(option => option.setName('name').setDescription('Player name').setRequired(true))
      .addStringOption(option => option.setName('power').setDescription('Power level (default 30/30)').setRequired(false))
      .addStringOption(option => option.setName('note').setDescription('Extra note').setRequired(false)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a friend by player name')
      .addStringOption(option => option.setName('name').setDescription('Player name').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'list') return interaction.reply({ embeds: [listEmbed(getFriends())], allowedMentions: { parse: [] } });
    if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const embed = searchEmbed(query, findMatches(getFriends(), query));
      return interaction.reply(embed
        ? { embeds: [embed], allowedMentions: { parse: [] } }
        : { content: 'No friends found matching "' + query + '".', flags: 64, allowedMentions: { parse: [] } });
    }
    if (subcommand === 'add') {
      const result = addFriend(interaction.options.getString('code').toUpperCase(), interaction.options.getString('name'), interaction.options.getString('power'), interaction.options.getString('note'));
      return interaction.reply({ ...result, flags: result.content ? 64 : undefined, allowedMentions: { parse: [] } });
    }
    const result = removeFriend(interaction.options.getString('name'));
    return interaction.reply({ ...result, flags: result.content ? 64 : undefined, allowedMentions: { parse: [] } });
  },
};
