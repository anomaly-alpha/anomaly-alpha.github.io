const { SlashCommandBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { moderatedChatCompletion } = require('../ai/client');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Skarn compares two things dramatically')
    .addStringOption(option => option.setName('thing1').setDescription('First thing').setRequired(true))
    .addStringOption(option => option.setName('thing2').setDescription('Second thing').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const t1 = interaction.options.getString('thing1');
    const t2 = interaction.options.getString('thing2');

    try {
      var systemPrompt = buildSystemPrompt({ roleLine: roles.compare });
      var result = await moderatedChatCompletion({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Compare these two: "' + t1 + '" vs "' + t2 + '"' },
        ],
        max_tokens: roleTokenBudgets.compare,
        temperature: 0.9,
        userId: interaction.user.id,
      });
      if (!result.success) throw new Error('AI failed');
      await interaction.editReply({ content: '⚖️ **' + t1 + '** vs **' + t2 + '**\n\n' + result.completion.choices[0].message.content, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: 'The comparison shattered before it could form.', flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
};
