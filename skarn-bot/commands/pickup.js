const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pickup')
    .setDescription('AI pickup line generator'),
  async execute(interaction) {
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Generate a creative, funny pickup line. Keep it clean and clever. One line only.' },
          { role: 'user', content: 'Generate a pickup line:' },
        ],
        max_tokens: 50,
        temperature: 1.0,
      });

      const line = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Pickup Line')
        .setDescription(line)
        .setColor(0xe91e8a);

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Pickup line failed.', ephemeral: true });
    }
  },
};
