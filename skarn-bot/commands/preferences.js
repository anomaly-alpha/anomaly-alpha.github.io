const { SlashCommandBuilder } = require('discord.js');
const { getUserPreferences, setUserPreference } = require('../db/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('preferences')
    .setDescription('Manage how Skarn interacts with you')
    .addStringOption(option =>
      option.setName('setting')
        .setDescription('What to change')
        .setRequired(true)
        .addChoices(
          { name: 'Proactive messages', value: 'proactive' },
          { name: 'Nickname', value: 'nickname' },
          { name: 'Tone', value: 'tone' },
          { name: 'Timezone', value: 'timezone' },
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('The value to set')
        .setRequired(true)
        .setMaxLength(50)),
  async execute(interaction) {
    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');

    const validValues = {
      proactive: ['on', 'off'],
      tone: ['match', 'casual', 'witty', 'straightforward'],
      timezone: () => true,
      nickname: v => v.length < 30,
    };

    const validator = validValues[setting];
    if (!validator) {
      return interaction.reply({ content: `Unknown setting: ${setting}.`, flags: 64 });
    }

    if (typeof validator === 'function') {
      if (!validator(value)) {
        return interaction.reply({ content: `Invalid value for **${setting}**.`, flags: 64 });
      }
    } else if (!validator.includes(value)) {
      return interaction.reply({ content: `Invalid value for **${setting}**. Valid: ${validator.join(', ')}.`, flags: 64 });
    }

    const keyMap = { proactive: 'proactive_opt_in', nickname: 'nickname', tone: 'preferred_tone', timezone: 'timezone' };
    const dbValue = setting === 'proactive' ? (value === 'on' ? 1 : 0) : value;

    setUserPreference(interaction.user.id, interaction.guild.id, keyMap[setting], dbValue);

    const extra = setting === 'nickname' ? ` Skarn will use "${value}" from now on.` : '';
    await interaction.reply({
      content: `Set **${setting}** to \`${value}\`.${extra}`,
      flags: 64,
    });
  },
};
