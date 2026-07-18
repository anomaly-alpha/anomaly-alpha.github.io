const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('song')
    .setDescription('AI writes a custom song about anything')
    .addStringOption(option => option.setName('topic').setDescription('What the song is about').setRequired(true))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Music style')
        .addChoices(
          { name: 'Pop', value: 'pop' },
          { name: 'Rock', value: 'rock' },
          { name: 'Hip Hop', value: 'hip hop' },
          { name: 'Country', value: 'country' },
          { name: 'R&B', value: 'R&B' },
          { name: 'Metal', value: 'metal' },
          { name: 'Classical', value: 'classical poem' },
        )),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');
    const style = interaction.options.getString('style') || 'pop';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a talented songwriter. Write a short ${style} song with verses and a chorus. Make it catchy and fun. Include the chorus label.` },
          { role: 'user', content: `Write a ${style} song about: ${topic}` },
        ],
        max_tokens: 400,
        temperature: 0.9,
      });

      const song = completion.choices[0].message.content;
      const embed = new EmbedBuilder()
        .setTitle(`Song: ${topic}`)
        .setDescription(song)
        .setColor(0x00e5ff)
        .setFooter({ text: `Style: ${style}` });

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Song generation failed.', ephemeral: true });
    }
  },
};
