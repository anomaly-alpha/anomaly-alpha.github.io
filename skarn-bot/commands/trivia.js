const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Play a trivia question'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const data = await res.json();
      const q = data.results[0];
      if (!q) return interaction.editReply('Failed to fetch question.');

      const answers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
      const correctIndex = answers.indexOf(q.correct_answer);

      const rows = [];
      for (let i = 0; i < answers.length; i += 2) {
        const row = new ActionRowBuilder();
        for (let j = i; j < Math.min(i + 2, answers.length); j++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_${j}`)
              .setLabel(answers[j].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace('&#039;', "'"))
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }

      const embed = new EmbedBuilder()
        .setTitle('Trivia')
        .setDescription(q.question.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace('&#039;', "'"))
        .setColor(0x00e5ff);
      await interaction.editReply({ embeds: [embed], components: rows });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

      collector.on('collect', async i => {
        const index = parseInt(i.customId.split('_')[1]);
        if (index === correctIndex) {
          await i.update({ content: `Correct! The answer was: **${q.correct_answer}**`, components: [] });
        } else {
          await i.update({ content: `Wrong! The answer was: **${q.correct_answer}**`, components: [] });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) interaction.editReply({ content: `Time's up! The answer was: **${q.correct_answer}**`, components: [] });
      });
    } catch {
      await interaction.editReply('Failed to fetch trivia question.');
    }
  },
};
