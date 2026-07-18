const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wouldyourather')
    .setDescription('AI generates a "Would You Rather" question'),
  async execute(interaction) {
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Generate a "Would You Rather" question with two interesting options. Make it thought-provoking or funny. Return ONLY the two options separated by " | ".' },
          { role: 'user', content: 'Generate a would you rather question:' },
        ],
        max_tokens: 100,
        temperature: 1.0,
      });

      const content = completion.choices[0].message.content;
      const parts = content.split('|').map(p => p.trim());
      const option1 = parts[0] || 'Option A';
      const option2 = parts[1] || 'Option B';

      const embed = new EmbedBuilder()
        .setTitle('Would You Rather')
        .setDescription(`**A:** ${option1}\n\n**B:** ${option2}`)
        .setColor(0x00e5ff);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('wyr_a').setLabel('A').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('wyr_b').setLabel('B').setStyle(ButtonStyle.Secondary),
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async i => {
        const choice = i.customId === 'wyr_a' ? 'A' : 'B';
        await i.update({ content: `You chose **${choice}**!`, embeds: [embed], components: [] });
      });
    } catch {
      await interaction.editReply({ content: 'Failed to generate question.', ephemeral: true });
    }
  },
};
