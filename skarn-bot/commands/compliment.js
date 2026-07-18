const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('AI gives you a nice compliment')
    .addUserOption(option => option.setName('target').setDescription('Who to compliment')),
  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Give a heartfelt, specific, and genuine compliment. Make it feel personal and uplifting. 1-2 sentences.' },
          { role: 'user', content: `Give a compliment to ${target.username}:` },
        ],
        max_tokens: 80,
        temperature: 0.9,
      });

      const compliment = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle('Compliment')
        .setDescription(`${target} ${compliment}`)
        .setColor(0x2ecc71);

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Compliment generation failed.', ephemeral: true });
    }
  },
};
