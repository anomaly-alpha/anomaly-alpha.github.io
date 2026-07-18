const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text to another language')
    .addStringOption(option => option.setName('text').setDescription('Text to translate').setRequired(true))
    .addStringOption(option =>
      option.setName('to')
        .setDescription('Target language code')
        .setRequired(true)
        .addChoices(
          { name: 'English', value: 'en' },
          { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Italian', value: 'it' },
          { name: 'Portuguese', value: 'pt' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Korean', value: 'ko' },
          { name: 'Chinese', value: 'zh' },
          { name: 'Russian', value: 'ru' },
          { name: 'Arabic', value: 'ar' },
          { name: 'Hindi', value: 'hi' },
        )),
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const to = interaction.options.getString('to');
    await interaction.deferReply();
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${to}`);
      const data = await res.json();
      if (data.responseStatus !== 200) throw new Error('Translation failed');
      await interaction.editReply(`**Original:** ${text}\n**Translated:** ${data.responseData.translatedText}`);
    } catch {
      await interaction.editReply({ content: 'Translation failed.', ephemeral: true });
    }
  },
};
