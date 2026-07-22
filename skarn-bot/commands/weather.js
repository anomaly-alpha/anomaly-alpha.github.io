const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchWeather, buildRawEmbed, generateSkarnSummary } = require('../lib/weatherScheduler');

async function getWeatherResponse(args) {
  const { subcommand, location, style } = args;
  const data = await fetchWeather(location);

  if (subcommand === 'current') {
    const current = data.current_condition[0];
    return {
      embeds: [new EmbedBuilder()
        .setTitle(`Weather in ${location}`)
        .addFields(
          { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
          { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
          { name: 'Humidity', value: `${current.humidity}%`, inline: true },
          { name: 'Wind', value: `${current.windspeedKmph} km/h ${current.winddir16Point}`, inline: true },
        )
        .setColor(0x00e5ff)],
    };
  }

  const embed = buildRawEmbed(location, data);
  if (style === 'skarn') {
    const summary = await generateSkarnSummary(location, data);
    if (summary) embed.setDescription(summary);
  }
  return { embeds: [embed] };
}

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
    const style = interaction.options.getString('style') || 'skarn';

    await interaction.deferReply();

    try {
      const result = await getWeatherResponse({ subcommand, location, style });
      await interaction.editReply({ ...result, allowedMentions: { parse: ['users'] } });
    } catch {
      await interaction.editReply({ content: `Could not fetch weather for "${location}".`, flags: 64, allowedMentions: { parse: ['users'] } });
    }
  },
  async handleActivation(message, args) {
    try {
      const result = await getWeatherResponse(args);
      await message.reply({ ...result, allowedMentions: { parse: ['users'] } });
    } catch (err) {
      await message.reply({ content: err.message || `Could not fetch weather for "${args.location}".`, allowedMentions: { parse: ['users'] } });
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn weather',
    description: 'Check the weather',
    guildOnly: true,
    requiredPermissions: [],
    parseArgs: function(content) {
      const rest = content.slice('skarn weather'.length).trim();
      if (rest.toLowerCase().startsWith('report')) return { subcommand: 'report', location: rest.slice(6).trim(), style: 'skarn' };
      return { subcommand: 'current', location: rest || null, style: 'skarn' };
    },
  },
};
