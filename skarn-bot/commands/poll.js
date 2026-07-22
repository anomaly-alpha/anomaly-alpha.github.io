const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const reactions = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Creates a poll')
    .addStringOption(option =>
      option.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption(option =>
      option.setName('options').setDescription('Options separated by commas').setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = interaction.options.getString('options').split(',').map(o => o.trim()).slice(0, 10);

    if (options.length < 2) {
      await interaction.reply({ content: 'You need at least 2 options.', flags: 64, allowedMentions: { parse: ['users'] } });
      return;
    }

    const description = options.map((opt, i) => `${reactions[i]} ${opt}`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(question)
      .setDescription(description)
      .setColor(0x00e5ff);

    const message = await interaction.reply({ embeds: [embed], fetchReply: true, allowedMentions: { parse: ['users'] } });
    for (let i = 0; i < options.length; i++) {
      await message.react(reactions[i]);
    }
  },
};
