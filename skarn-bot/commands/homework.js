const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('homework')
    .setDescription('AI homework helper — explains concepts step by step')
    .addStringOption(option => option.setName('question').setDescription('Your homework question').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful tutor. Explain concepts clearly and step by step. Use examples. Make it easy to understand. Format with bullet points or numbered steps.' },
          { role: 'user', content: question },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const answer = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Homework Helper')
        .setDescription(answer)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Ask follow-up questions if needed!' });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Failed to answer. Try rephrasing.', ephemeral: true });
    }
  },
};
