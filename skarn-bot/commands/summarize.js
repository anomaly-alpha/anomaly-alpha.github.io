const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('AI summarizes recent messages in a channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to summarize')
        .addChannelTypes(ChannelType.GuildText))
    .addIntegerOption(option =>
      option.setName('messages')
        .setDescription('Number of messages to analyze (10-500)')
        .setMinValue(10)
        .setMaxValue(500))
    .addStringOption(option =>
      option.setName('focus')
        .setDescription('What to focus on (e.g. action items, decisions, drama)')
        .setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const limit = interaction.options.getInteger('messages') || 100;
    const focus = interaction.options.getString('focus') || 'general summary';

    if (!process.env.OPENAI_API_KEY) {
      return interaction.reply({ content: 'AI is not configured. Add OPENAI_API_KEY.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // Fetch messages
      const messages = await channel.messages.fetch({ limit });
      const sorted = [...messages.values()].reverse(); // oldest first

      if (sorted.length === 0) {
        return interaction.editReply({ content: 'No messages found in this channel.', ephemeral: true });
      }

      // Build conversation text
      const timeRange = `${sorted[0].createdAt.toLocaleDateString()} to ${sorted[sorted.length - 1].createdAt.toLocaleDateString()}`;
      const conversation = sorted
        .filter(m => !m.author.bot)
        .map(m => `[${m.author.username}]: ${m.content}`)
        .join('\n');

      if (conversation.length === 0) {
        return interaction.editReply({ content: 'No user messages found (only bot messages).', ephemeral: true });
      }

      // Summarize with AI
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a helpful assistant that summarizes Discord conversations. Be concise but capture all important points. Use bullet points. Focus on: ${focus}.` },
          { role: 'user', content: `Summarize this Discord conversation from #${channel.name} (${timeRange}):\n\n${conversation}` },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const summary = completion.choices[0].message.content;
      const userMessages = sorted.filter(m => !m.author.bot).length;
      const uniqueUsers = [...new Set(sorted.filter(m => !m.author.bot).map(m => m.author.username))];

      const embed = new EmbedBuilder()
        .setTitle(`Summary: #${channel.name}`)
        .setDescription(summary)
        .addFields(
          { name: 'Messages Analyzed', value: `${userMessages}`, inline: true },
          { name: 'Participants', value: `${uniqueUsers.length}`, inline: true },
          { name: 'Time Range', value: timeRange, inline: true },
        )
        .setColor(0x00e5ff)
        .setFooter({ text: `Focus: ${focus}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Summarize error:', error);
      await interaction.editReply({ content: 'Failed to summarize. Try fewer messages.', ephemeral: true });
    }
  },
};
