const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('AI summarizes recent messages in a channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to summarize')
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option =>
      option.setName('timeframe')
        .setDescription('How far back to look')
        .setRequired(false)
        .addChoices(
          { name: 'Last hour', value: '1' },
          { name: 'Last 6 hours', value: '6' },
          { name: 'Last 12 hours', value: '12' },
          { name: 'Last 24 hours', value: '24' },
          { name: 'Last 3 days', value: '72' },
          { name: 'Last week (default)', value: '168' },
        ))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('What to focus on (e.g. action items, decisions, drama)')
        .setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const hours = parseInt(interaction.options.getString('timeframe') || '168'); // default 1 week
    const focus = interaction.options.getString('focus') || 'general summary';

    if (!process.env.OPENAI_API_KEY) {
      return interaction.reply({ content: 'AI is not configured. Add OPENAI_API_KEY.', flags: 64 });
    }

    await interaction.deferReply();

    try {
      // Fetch messages in batches to cover the timeframe
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      let allMessages = [];
      let lastId = null;
      const maxBatches = Math.min(Math.ceil(hours / 12), 20); // limit API calls

      for (let i = 0; i < maxBatches; i++) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (batch.size === 0) break;

        const batchArray = [...batch.values()];
        const oldEnough = batchArray.filter(m => m.createdTimestamp < cutoff);
        allMessages.push(...batchArray.filter(m => m.createdTimestamp >= cutoff));

        if (oldEnough.length > 0) break; // hit the cutoff
        lastId = batchArray[batchArray.length - 1].id;
      }

      // Sort oldest first
      const sorted = allMessages.reverse();

      if (sorted.length === 0) {
        return interaction.editReply({ content: 'No messages found in this timeframe.', flags: 64 });
      }

      // Build conversation text
      const timeRange = `${sorted[0].createdAt.toLocaleDateString()} to ${sorted[sorted.length - 1].createdAt.toLocaleDateString()}`;
      const conversation = sorted
        .filter(m => !m.author.bot)
        .map(m => `[${m.author.username}]: ${m.content}`)
        .join('\n');

      if (conversation.length === 0) {
        return interaction.editReply({ content: 'No user messages found (only bot messages).', flags: 64 });
      }

      // Truncate if too long for API
      const truncated = conversation.length > 12000 ? conversation.slice(0, 12000) + '\n... (truncated)' : conversation;

      // Summarize with AI
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a helpful assistant that summarizes Discord conversations. Be concise but capture all important points. Use bullet points. Focus on: ${focus}.` },
          { role: 'user', content: `Summarize this Discord conversation from #${channel.name} (${timeRange}):\n\n${truncated}` },
        ],
        max_completion_tokens: 500,
        temperature: 0.3,
      });

      const summary = completion.choices[0].message.content;
      const userMessages = sorted.filter(m => !m.author.bot).length;
      const uniqueUsers = [...new Set(sorted.filter(m => !m.author.bot).map(m => m.author.username))];
      const timeframeLabel = hours >= 168 ? 'Last week' : hours >= 72 ? 'Last 3 days' : `Last ${hours}h`;

      const embed = new EmbedBuilder()
        .setTitle(`Summary: #${channel.name}`)
        .setDescription(summary)
        .addFields(
          { name: 'Messages', value: `${userMessages}`, inline: true },
          { name: 'Participants', value: `${uniqueUsers.length}`, inline: true },
          { name: 'Timeframe', value: timeframeLabel, inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: `Focus: ${focus}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Summarize error:', error);
      await interaction.editReply({ content: 'Failed to summarize. Try a shorter timeframe.', flags: 64 });
    }
  },
};
