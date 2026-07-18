const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('AI code helper — explain, debug, or write code')
    .addStringOption(option => option.setName('request').setDescription('What you need help with').setRequired(true))
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Programming language')
        .addChoices(
          { name: 'JavaScript', value: 'JavaScript' },
          { name: 'Python', value: 'Python' },
          { name: 'Java', value: 'Java' },
          { name: 'C++', value: 'C++' },
          { name: 'HTML/CSS', value: 'HTML/CSS' },
          { name: 'SQL', value: 'SQL' },
          { name: 'Other', value: 'Other' },
        )),
  async execute(interaction) {
    const request = interaction.options.getString('request');
    const language = interaction.options.getString('language') || '';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are an expert programmer. Help with ${language || 'programming'}. Explain clearly. Use code blocks for code. Keep explanations concise.` },
          { role: 'user', content: request },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const answer = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Code Helper')
        .setDescription(answer)
        .setColor(0x00e5ff)
        .setFooter({ text: language ? `Language: ${language}` : 'Ask for specific languages!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Code helper failed.', ephemeral: true });
    }
  },
};
