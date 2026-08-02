const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../db/database');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

async function getHistoryResponse(args, message) {
  const authorId = message.author.id;
  const guildId = message.guild.id;
  const days = args.days || 7;
  const threadNum = args.thread ? parseInt(args.thread) : null;

  // For activation (text-based), only the message author can view their own history
  const targetUserId = authorId;
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

  const threads = db.prepare(
    `SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND started_at > ? ORDER BY last_active_at DESC LIMIT 10`
  ).all(targetUserId, guildId, cutoff);

  if (threads.length === 0) {
    return { content: 'No conversation history found for that time period.' };
  }

  if (threadNum && threadNum <= threads.length) {
    const thread = threads[threadNum - 1];
    const messages = db.prepare(
      'SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at'
    ).all(thread.thread_id);

    const embed = new EmbedBuilder()
      .setTitle(`Conversation — ${new Date(thread.started_at).toLocaleDateString()}`)
      .setDescription(`${thread.thread_type} channel • ${messages.length} messages`)
      .setColor(0x00e5ff);

    const recentMsgs = messages.slice(-15);
    const chatLog = recentMsgs.map(m => {
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const role = m.role === 'user' ? '**You**' : '**Skarn**';
      const content = m.content.length > 150 ? m.content.substring(0, 150) + '...' : m.content;
      return `\`${time}\` ${role}: ${content}`;
    }).join('\n');

    embed.addFields({ name: 'Messages', value: chatLog || '*No messages*' });
    if (messages.length > 15) {
      embed.setFooter({ text: `Showing last 15 of ${messages.length} messages` });
    }
    return { embeds: [embed] };
  }

  const embed = new EmbedBuilder()
    .setTitle(`Conversation History — ${message.author.username}`)
    .setDescription(`Last ${days} days • Use \`skarn history thread:N\` to view messages`)
    .setColor(0x00e5ff);

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    const date = new Date(thread.started_at).toLocaleDateString();
    const time = new Date(thread.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tags = JSON.parse(thread.topic_tags || '[]');
    const tagStr = tags.length > 0 ? tags.map(t => t.topic || t).join(', ') : 'general';
    const summary = thread.topic_summary || `*${thread.message_count} messages*`;

    embed.addFields({
      name: `#${i + 1} — ${date} ${time} (${thread.thread_type})`,
      value: `${summary}\nTopics: ${tagStr}`,
      inline: false,
    });
  }
  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('View your conversation history with Skarn')
    .addUserOption(option => option.setName('user').setDescription('User to view (admin only)').setRequired(false))
    .addIntegerOption(option => option.setName('days').setDescription('Days back to look (default 7)').setMinValue(1).setMaxValue(30).setRequired(false))
    .addIntegerOption(option => option.setName('thread').setDescription('Thread number to view messages (1-10)').setMinValue(1).setMaxValue(10).setRequired(false))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('View raw messages or Skarn summary')
        .addChoices({ name: 'Raw messages', value: 'raw' }, { name: 'Skarn summary', value: 'skarn' })),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const days = interaction.options.getInteger('days') || 7;
    const threadNum = interaction.options.getInteger('thread');
    const style = interaction.options.getString('style') || 'raw';

    if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Only admins can view other users\' history.', flags: 64, allowedMentions: { parse: ['users'] } });
    }

    await interaction.deferReply({ flags: 64 });

    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const threads = db.prepare(
      `SELECT * FROM conversation_threads WHERE user_id = ? AND guild_id = ? AND started_at > ? ORDER BY last_active_at DESC LIMIT 10`
    ).all(targetUser.id, interaction.guild.id, cutoff);

    if (threads.length === 0) {
      return interaction.editReply({ content: 'No conversation history found for that time period.', allowedMentions: { parse: ['users'] } });
    }

    // If thread number specified, show messages from that thread
    if (threadNum && threadNum <= threads.length) {
      if (style === 'skarn') {
        // AI summary instead of raw messages
        var summaryThread = threads[threadNum - 1];
        var summaryMessages = db.prepare(
          'SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at'
        ).all(summaryThread.thread_id);
        var chatText = summaryMessages.map(function(m) {
          return '[' + m.role + ']: ' + m.content.slice(0, 200);
        }).join('\n').slice(0, 1500);
        try {
          var systemPrompt = buildSystemPrompt({ roleLine: roles.history });
          var result = await moderatedChatCompletion({
            model: process.env.AI_MODEL || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: chatText },
            ],
            max_tokens: roleTokenBudgets.history,
            temperature: 0.7,
            userId: interaction.user.id,
          });
          if (result.success) {
            var summaryEmbed = new EmbedBuilder()
              .setTitle('Conversation — ' + new Date(summaryThread.started_at).toLocaleDateString())
              .setDescription(result.completion.choices[0].message.content)
              .setColor(0x00e5ff);
            return interaction.editReply({ embeds: [summaryEmbed], allowedMentions: { parse: ['users'] } });
          }
        } catch (e) { /* fall through to raw */ }
      }
      const thread = threads[threadNum - 1];
      const messages = db.prepare(
        'SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at'
      ).all(thread.thread_id);

      const embed = new EmbedBuilder()
        .setTitle(`Conversation — ${new Date(thread.started_at).toLocaleDateString()}`)
        .setDescription(`${thread.thread_type} channel • ${messages.length} messages`)
        .setColor(0x00e5ff);

      // Show last 15 messages (embed field value limit)
      const recentMsgs = messages.slice(-15);
      const chatLog = recentMsgs.map(m => {
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const role = m.role === 'user' ? '**You**' : '**Skarn**';
        const content = m.content.length > 150 ? m.content.substring(0, 150) + '...' : m.content;
        return `\`${time}\` ${role}: ${content}`;
      }).join('\n');

      embed.addFields({ name: 'Messages', value: chatLog || '*No messages*' });

      if (messages.length > 15) {
        embed.setFooter({ text: `Showing last 15 of ${messages.length} messages` });
      }

      return interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
    }

    // Otherwise show thread list
    const embed = new EmbedBuilder()
      .setTitle(`Conversation History — ${targetUser.username}`)
      .setDescription(`Last ${days} days • Use \`/history thread:N\` to view messages`)
      .setColor(0x00e5ff);

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const date = new Date(thread.started_at).toLocaleDateString();
      const time = new Date(thread.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tags = JSON.parse(thread.topic_tags || '[]');
      const tagStr = tags.length > 0 ? tags.map(t => t.topic || t).join(', ') : 'general';
      const summary = thread.topic_summary || `*${thread.message_count} messages*`;

      embed.addFields({
        name: `#${i + 1} — ${date} ${time} (${thread.thread_type})`,
        value: `${summary}\nTopics: ${tagStr}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
  async handleActivation(message, args) {
    if (!message.guild) {
      return message.reply({ content: 'This command can only be used in a server.', allowedMentions: { parse: ['users'] } });
    }
    try {
      const result = await getHistoryResponse(args, message);
      await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
    } catch (err) {
      await message.reply({ content: err.message || 'Error fetching history.', allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn history',
    description: 'View conversation history',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) { return { user: content.slice('skarn history'.length).trim() || null }; },
  },
};
