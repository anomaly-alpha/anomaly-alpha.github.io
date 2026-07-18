const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchWeather, buildRawEmbed, generateSkarnSummary } = require('../lib/weatherScheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather for a location')
    .addSubcommand(sub =>
      sub.setName('current')
        .setDescription('Quick weather lookup')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('report')
        .setDescription('Detailed weather report (Skarn-styled or raw)')
        .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true))
        .addStringOption(option =>
          option.setName('style')
            .setDescription('Report style')
            .addChoices(
              { name: 'Skarn (AI summary)', value: 'skarn' },
              { name: 'Raw data', value: 'raw' },
            ))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const location = interaction.options.getString('location');

    await interaction.deferReply();

    try {
      const data = await fetchWeather(location);

      if (subcommand === 'current') {
        const current = data.current_condition[0];
        const embed = new EmbedBuilder()
          .setTitle(`Weather in ${location}`)
          .addFields(
            { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
            { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
            { name: 'Humidity', value: `${current.humidity}%`, inline: true },
            { name: 'Wind', value: `${current.windspeedKmph} km/h ${current.winddir16Point}`, inline: true },
          )
          .setColor(0x00e5ff);
        return interaction.editReply({ embeds: [embed] });
      }

      // Report subcommand
      const style = interaction.options.getString('style') || 'skarn';
      const embed = buildRawEmbed(location, data);

      if (style === 'skarn') {
        const summary = await generateSkarnSummary(location, data);
        if (summary) embed.setDescription(summary);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: `Could not fetch weather for "${location}".`, flags: 64 });
    }
  },
};
