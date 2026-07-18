const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unpopularopinion')
    .setDescription('AI generates a hot take — agree or disagree?'),
  async execute(interaction) {
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Generate a spicy but not offensive unpopular opinion / hot take. Something people would actually debate. Keep it fun and debatable.' },
          { role: 'user', content: 'Generate an unpopular opinion:' },
        ],
        max_tokens: 100,
        temperature: 1.0,
      });

      const opinion = completion.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setTitle('Hot Take')
        .setDescription(opinion)
        .setColor(0xe74c3c);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('uo_agree').setLabel('Agree').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('uo_disagree').setLabel('Disagree').setStyle(ButtonStyle.Danger),
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const votes = { agree: 0, disagree: 0 };
      const filter = i => true;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'uo_agree') votes.agree++;
        else votes.disagree++;
        await i.update({
          content: `👍 ${votes.agree} agree | 👎 ${votes.disagree} disagree`,
          embeds: [embed],
          components: [row],
        });
      });
    } catch {
      await interaction.editReply({ content: 'Hot take generation failed.', ephemeral: true });
    }
  },
};
