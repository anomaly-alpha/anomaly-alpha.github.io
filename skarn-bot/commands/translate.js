const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

async function getTranslateResponse(args) {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(args.text)}&langpair=en|${args.to || 'en'}`);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error('Translation failed');
  return `**Original:** ${args.text}\n**Translated:** ${data.responseData.translatedText}`;
}

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
      const result = await getTranslateResponse({ text, to });
      await interaction.editReply({ content: result, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'Translation failed.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    try {
      const result = await getTranslateResponse(args);
      await message.reply({ content: result, allowedMentions: { parse: ['users'] } });
    } catch (err) {
      await message.reply({ content: err.message || 'Translation failed.', allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn translate',
    description: 'Translate text',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { text: content.slice('skarn translate'.length).trim(), to: 'en' }; },
  },
};
