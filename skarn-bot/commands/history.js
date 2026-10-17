const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, searchConversations } = require('../db/database');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

function getThreads(userId, guildId, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return db.prepare('SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND started_at > ? ORDER BY last_active_at DESC LIMIT 10')
    .all(userId, guildId, cutoff);
}

function getMessages(threadId) {
  return db.prepare('SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at').all(threadId);
}

function getThreadListEmbed(threads, username, days) {
  const embed = new EmbedBuilder().setTitle('Conversation History — ' + username)
    .setDescription('Last ' + days + ' days • Use /history thread to inspect a thread')
    .setColor(0x00e5ff);
  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const date = new Date(thread.started_at).toLocaleDateString();
    const time = new Date(thread.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tags = JSON.parse(thread.topic_tags || '[]');
    const tagText = tags.length ? tags.map(t => t.topic || t).join(', ') : 'general';
    const summary = thread.topic_summary || '*' + thread.message_count + ' messages*';
    embed.addFields({ name: '#' + (i + 1) + ' — ' + date + ' ' + time + ' (' + thread.thread_type + ')', value: summary + '\nTopics: ' + tagText, inline: false });
  }
  return embed;
}

async function getThreadEmbed(thread, style, userId, guildId) {
  const messages = getMessages(thread.thread_id);
  if (style === 'skarn') {
    const chatText = messages.map(m => '[' + m.role + ']: ' + m.content.slice(0, 200)).join('\n').slice(0, 1500);
    try {
      const result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-6-luna',
        messages: [{ role: 'system', content: buildSystemPrompt({ roleLine: roles.history }) }, { role: 'user', content: chatText }],
        max_tokens: roleTokenBudgets.history,
        temperature: 0.7,
        userId,
        guildId,
      });
      if (result.success) return new EmbedBuilder().setTitle('Conversation — ' + new Date(thread.started_at).toLocaleDateString())
        .setDescription(result.completion.choices[0].message.content).setColor(0x00e5ff);
    } catch (e) {}
  }

  const lines = messages.slice(-15).map(m => {
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const role = m.role === 'user' ? '**You**' : '**Skarn**';
    const content = m.content.length > 150 ? m.content.slice(0, 150) + '...' : m.content;
    return time + ' ' + role + ': ' + content;
  });
  const embed = new EmbedBuilder().setTitle('Conversation — ' + new Date(thread.started_at).toLocaleDateString())
    .setDescription(thread.thread_type + ' channel • ' + messages.length + ' messages').setColor(0x00e5ff)
    .addFields({ name: 'Messages', value: lines.join('\n') || '*No messages*' });
  if (messages.length > 15) embed.setFooter({ text: 'Showing last 15 of ' + messages.length + ' messages' });
  return embed;
}

function getSearchEmbed(query, results, username) {
  if (!results.length) return null;
  const embed = new EmbedBuilder().setTitle('Conversation search: ' + query).setDescription('Matches for ' + username).setColor(0x00e5ff);
  for (const message of results.slice(0, 5)) {
    const date = new Date(message.created_at).toLocaleDateString();
    const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const content = message.content.length > 200 ? message.content.slice(0, 200) + '...' : message.content;
    const role = message.role === 'user' ? 'User' : 'Skarn';
    embed.addFields({ name: date + ' ' + time + ' — ' + role, value: content, inline: false });
  }
  if (results.length > 5) embed.setFooter({ text: 'Showing 5 of ' + results.length + ' results' });
  return embed;
}

function getTargetUser(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  if (target.id !== interaction.user.id && !interaction.memberPermissions?.has('Administrator')) return null;
  return target;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Browse or search your conversation history with Skarn')
    .addSubcommand(sub => sub.setName('list').setDescription('List conversation threads')
      .addIntegerOption(option => option.setName('days').setDescription('Days back to look (default 7)').setMinValue(1).setMaxValue(30))
      .addUserOption(option => option.setName('user').setDescription('User to view (admin only)')))
    .addSubcommand(sub => sub.setName('thread').setDescription('View or summarize one conversation thread')
      .addIntegerOption(option => option.setName('number').setDescription('Thread number from /history list').setRequired(true).setMinValue(1).setMaxValue(10))
      .addIntegerOption(option => option.setName('days').setDescription('Days back to look (default 7)').setMinValue(1).setMaxValue(30))
      .addStringOption(option => option.setName('style').setDescription('Raw messages or Skarn summary').addChoices({ name: 'Raw messages', value: 'raw' }, { name: 'Skarn summary', value: 'skarn' }))
      .addUserOption(option => option.setName('user').setDescription('User to view (admin only)')))
    .addSubcommand(sub => sub.setName('search').setDescription('Search conversation messages')
      .addStringOption(option => option.setName('query').setDescription('Words to search for').setRequired(true).setMinLength(2).setMaxLength(100))
      .addUserOption(option => option.setName('user').setDescription('User to search (admin only)'))),
  async execute(interaction) {
    if (!interaction.guild || !interaction.member) return interaction.reply({ content: 'This command can only be used in a server.', flags: 64, allowedMentions: { parse: [] } });
    const target = getTargetUser(interaction);
    if (!target) return interaction.reply({ content: 'Only administrators can view another user’s history.', flags: 64, allowedMentions: { parse: [] } });
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      await interaction.deferReply({ flags: 64 });
      const results = searchConversations(query, guildId, target.id, 10);
      const embed = getSearchEmbed(query, results, target.username);
      return interaction.editReply(embed ? { embeds: [embed], allowedMentions: { parse: [] } } : { content: 'No results found for "' + query + '".', allowedMentions: { parse: [] } });
    }

    const days = interaction.options.getInteger('days') || 7;
    const threads = getThreads(target.id, guildId, days);
    if (!threads.length) return interaction.reply({ content: 'No conversation history found for that time period.', flags: 64, allowedMentions: { parse: [] } });
    if (subcommand === 'list') return interaction.reply({ embeds: [getThreadListEmbed(threads, target.username, days)], flags: 64, allowedMentions: { parse: [] } });

    const number = interaction.options.getInteger('number');
    if (number > threads.length) return interaction.reply({ content: 'No thread #' + number + ' in that time range.', flags: 64, allowedMentions: { parse: [] } });
    await interaction.deferReply({ flags: 64 });
    const embed = await getThreadEmbed(threads[number - 1], interaction.options.getString('style') || 'raw', target.id, guildId);
    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
