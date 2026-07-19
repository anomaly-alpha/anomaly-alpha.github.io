const fetch = require('node-fetch');
const { EmbedBuilder } = require('discord.js');
const getOpenAIClient = require('../ai/client');
const { db, getGuildConfig, setGuildConfig } = require('../db/database');

const WEATHER_TZ_OFFSET = -5; // UTC-5 (EST)

function getESTTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + WEATHER_TZ_OFFSET * 3600000);
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

async function fetchWeather(location) {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
  if (!res.ok) throw new Error(`wttr.in returned ${res.status}`);
  return await res.json();
}

function buildRawEmbed(location, data) {
  const current = data.current_condition[0];
  const forecast = data.weather.slice(0, 3);

  const fields = [
    { name: 'Temperature', value: `${current.temp_C}°C / ${current.temp_F}°F`, inline: true },
    { name: 'Condition', value: current.weatherDesc[0].value, inline: true },
    { name: 'Humidity', value: `${current.humidity}%`, inline: true },
    { name: 'Wind', value: `${current.windspeedKmph} km/h ${current.winddir16Point}`, inline: true },
  ];

  if (forecast.length > 0) {
    const forecastText = forecast.map(d => {
      const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `**${date}**: ${d.mintempC}–${d.maxtempC}°C, ${d.hourly[4].weatherDesc[0].value}`;
    }).join('\n');
    fields.push({ name: 'Forecast', value: forecastText, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`Weather in ${location}`)
    .addFields(fields)
    .setColor(0x00e5ff)
    .setTimestamp();
}

async function generateSkarnSummary(location, data) {
  if (!process.env.AI_MODEL) return null;

  const current = data.current_condition[0];
  const weatherInfo = `Location: ${location}\nTemperature: ${current.temp_C}°C / ${current.temp_F}°F\nCondition: ${current.weatherDesc[0].value}\nHumidity: ${current.humidity}%\nWind: ${current.windspeedKmph} km/h ${current.winddir16Point}`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL,
      messages: [
        { role: 'system', content: 'You are Skarn, a 10,000-year-old demon Warmaster. Summarize today\'s weather in 2-3 vivid sentences. Use metaphors from your ancient perspective. Mention key details: temp, condition, wind. Keep it under 300 characters. Don\'t say "As Skarn" or introduce yourself.' },
        { role: 'user', content: weatherInfo },
      ],
      max_completion_tokens: 150,
      temperature: 0.85,
    });
    return completion.choices[0].message.content;
  } catch {
    return null;
  }
}

async function postWeatherReport(client, track) {
  try {
    const data = await fetchWeather(track.location);
    const embed = buildRawEmbed(track.location, data);

    const summary = await generateSkarnSummary(track.location, data);
    if (summary) {
      embed.setDescription(summary);
    }

    const channel = await client.channels.fetch(track.channelId);
    if (!channel || !channel.isTextBased()) {
      console.log(`Weather scheduler: channel ${track.channelId} not found or not text`);
      return false;
    }

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Weather scheduler error for ${track.location}:`, error.message);
    return false;
  }
}

function startScheduler(client) {
  let lastCheckedMinute = '';

  setInterval(async () => {
    const now = getESTTime();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = formatDate(now);

    if (currentTime === lastCheckedMinute) return;
    lastCheckedMinute = currentTime;

    const guilds = db.prepare("SELECT DISTINCT guild_id FROM guild_config WHERE key = 'weatherTracks'").all();

    for (const { guild_id } of guilds) {
      const tracks = getGuildConfig(guild_id, 'weatherTracks') || [];
      let modified = false;

      for (const track of tracks) {
        if (track.time === currentTime && track.lastPosted !== today) {
          const success = await postWeatherReport(client, track);
          if (success) {
            track.lastPosted = today;
            modified = true;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (modified) setGuildConfig(guild_id, 'weatherTracks', tracks);
    }
  }, 60000);
}

module.exports = { startScheduler, fetchWeather, buildRawEmbed, generateSkarnSummary };
