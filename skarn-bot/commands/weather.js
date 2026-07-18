const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather for a location')
    .addStringOption(option => option.setName('location').setDescription('City name').setRequired(true)),
  async execute(interaction) {
    const location = interaction.options.getString('location');
    await interaction.deferReply();
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
      const data = await res.json();
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
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Could not fetch weather for that location.', flags: 64 });
    }
  },
};
