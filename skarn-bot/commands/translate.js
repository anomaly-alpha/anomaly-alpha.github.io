const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

const LANG_NAMES = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian', ar: 'Arabic', hi: 'Hindi' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text (AI in-character or raw)')
    .addStringOption(option => option.setName('text').setDescription('Text to translate').setRequired(true))
    .addStringOption(option =>
      option.setName('to')
        .setDescription('Target language')
        .setRequired(true)
        .addChoices(
          { name: 'English', value: 'en' }, { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' }, { name: 'German', value: 'de' },
          { name: 'Italian', value: 'it' }, { name: 'Portuguese', value: 'pt' },
          { name: 'Japanese', value: 'ja' }, { name: 'Korean', value: 'ko' },
          { name: 'Chinese', value: 'zh' }, { name: 'Russian', value: 'ru' },
          { name: 'Arabic', value: 'ar' }, { name: 'Hindi', value: 'hi' },
        ))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Translation style')
        .addChoices(
          { name: 'Skarn (in-character, keeps your voice)', value: 'skarn' },
          { name: 'Raw (direct translation)', value: 'raw' },
        )),
  async execute(interaction) {
    const text = interaction.options.getString('text');
    const to = interaction.options.getString('to');
    const style = interaction.options.getString('style') || 'skarn';
    await interaction.deferReply();

    if (style === 'raw') {
      try {
        var res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|' + to);
        var data = await res.json();
        if (data.responseStatus !== 200) throw new Error('Translation failed');
        return interaction.editReply({ content: '**Original:** ' + text + '\n**' + LANG_NAMES[to] + ':** ' + data.responseData.translatedText, allowedMentions: { parse: ['users'] } });
      } catch (e) {
        return interaction.editReply({ content: 'Translation failed.', flags: 64, allowedMentions: { parse: ['users'] } });
      }
    }

    // AI in-character translation
    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.translate });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Translate this to ' + LANG_NAMES[to] + ': "' + text + '"' },
        ],
        max_tokens: roleTokenBudgets.translate,
        temperature: 0.7,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: '**' + LANG_NAMES[to] + ' (Skarn-style):** ' + result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'Translation failed.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    try {
      var res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(args.text) + '&langpair=en|' + (args.to || 'en'));
      var data = await res.json();
      if (data.responseStatus !== 200) throw new Error('Translation failed');
      await message.reply({ content: '**Original:** ' + args.text + '\n**Translated:** ' + data.responseData.translatedText, allowedMentions: { parse: ['users'] } });
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
