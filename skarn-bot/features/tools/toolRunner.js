const { addMemoryEntry, getMemoryEntries } = require('../../db/database');
const { createReminder } = require('../../db/database');

// Routing functions for search (handles both Google CSE and DDG fallback)
async function searchUrl(query) {
  // Use the existing search engine if available
  try {
    const { searchWeb } = require('../search/searchEngine');
    const results = await searchWeb(query, 3);
    if (results && results.length > 0) {
      return results.map(r => `• ${r.title}: ${r.snippet}`).join('\n');
    }
  } catch (e) {
    // Search engine unavailable
  }
  return 'Search is currently unavailable. Try again later.';
}

// Main tool dispatcher
async function runTool(toolCall, context) {
  const { name, arguments: args } = toolCall.function;
  let parsed;
  try {
    parsed = JSON.parse(args);
  } catch (e) {
    return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: invalid arguments' };
  }

  const guildId = context.guildId || null;
  const channelId = context.channelId || null;
  const requesterId = context.userId || null;

  switch (name) {
    case 'etch_memory': {
      const { fact } = parsed;
      if (!requesterId || !fact) return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing fact' };
      addMemoryEntry(requesterId, guildId, 'etch', 'fact', fact, 1.0, 'Saved by Skarn via tool use');
      return { role: 'tool', tool_call_id: toolCall.id, content: 'Fact saved.' };
    }

    case 'get_memory': {
      if (!requesterId) return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing user' };
      const entries = getMemoryEntries(requesterId, guildId, 15);
      if (entries.length === 0) return { role: 'tool', tool_call_id: toolCall.id, content: 'No memories saved for this user.' };
      const etched = entries.filter(e => e.source === 'etch').map(e => `[etched] ${e.content}`);
      const extracted = entries.filter(e => e.source === 'extracted').map(e => `[${e.type}] ${e.content} (confidence: ${Math.round(e.confidence * 100)}%)`);
      const all = [...etched, ...extracted];
      return { role: 'tool', tool_call_id: toolCall.id, content: all.join('\n') || 'No memories.' };
    }

    case 'search_web': {
      const { query } = parsed;
      if (!query) return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing query' };
      const results = await searchUrl(query);
      return { role: 'tool', tool_call_id: toolCall.id, content: results };
    }

    case 'set_reminder': {
      const { message, duration } = parsed;
      if (!requesterId || !message || !duration) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing user, message, or duration' };
      }
      // Parse duration using the same logic as remind command
      const patterns = [
        { re: /^(\d+)\s*(m|min|mins|minutes?)$/, mult: 60 * 1000 },
        { re: /^(\d+)\s*(h|hr|hrs|hours?)$/, mult: 60 * 60 * 1000 },
        { re: /^(\d+)\s*(d|day|days?)$/, mult: 24 * 60 * 60 * 1000 },
      ];
      let durationMs = 30 * 60 * 1000; // default 30 min
      for (const { re, mult } of patterns) {
        const match = duration.toLowerCase().match(re);
        if (match) { durationMs = parseInt(match[1]) * mult; break; }
      }
      const remindAt = Date.now() + durationMs;
      // Clamp: min 1 minute, max 1 year
      if (durationMs < 60 * 1000) durationMs = 60 * 1000;
      if (durationMs > 365 * 24 * 60 * 60 * 1000) durationMs = 365 * 24 * 60 * 60 * 1000;
      createReminder(requesterId, channelId || requesterId, guildId, message, Date.now() + durationMs);
      return { role: 'tool', tool_call_id: toolCall.id, content: 'Reminder set.' };
    }

    case 'get_weather': {
      const { location } = parsed;
      if (!location) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Which place? Give me a city name, e.g. Tokyo.' };
      }
      const { fetchWeather } = require('../../lib/weatherScheduler');
      try {
        const data = await fetchWeather(location);
        const current = data.current_condition[0];
        const forecast = (data.weather || []).slice(0, 3).map(d => {
          const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return `${date}: ${d.mintempC}-${d.maxtempC}°C, ${d.hourly[4].weatherDesc[0].value}`;
        }).join('; ');
        const lines = [
          `Location: ${location}`,
          `Temperature: ${current.temp_C}°C / ${current.temp_F}°F`,
          `Condition: ${current.weatherDesc[0].value}`,
          `Humidity: ${current.humidity}%`,
          `Wind: ${current.windspeedKmph} km/h ${current.winddir16Point}`,
        ];
        if (forecast) lines.push(`Forecast: ${forecast}`);
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: `Weather service unreachable for "${location}". Try a city name, e.g. 'Tokyo'.` };
      }
    }

    case 'get_news': {
      const { getRecentNews, fetchNews } = require('../news/newsFetcher');
      try {
        let articles = getRecentNews(10);
        if (!articles || articles.length === 0) {
          await fetchNews(); // on-demand refresh (spec [S11] News freshness)
          articles = getRecentNews(10);
        }
        if (!articles || articles.length === 0) {
          return { role: 'tool', tool_call_id: toolCall.id, content: 'No news cached yet — check back in a bit.' };
        }
        const lines = articles.slice(0, 5).map(a =>
          `• ${(a.headline || '').slice(0, 100)}${a.snippet ? ' — ' + a.snippet.slice(0, 150) + '…' : ''}`
        );
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'News is unreachable right now — try again later.' };
      }
    }

    case 'roll_dice': {
      const { getDiceResponse } = require('../../commands/dice');
      let sides = parseInt(parsed.sides, 10);
      if (!(sides >= 2 && sides <= 100)) sides = 6;
      return { role: 'tool', tool_call_id: toolCall.id, content: getDiceResponse({ sides }) };
    }

    case 'flip_coin': {
      const { getCoinflipResponse } = require('../../commands/coinflip');
      return { role: 'tool', tool_call_id: toolCall.id, content: getCoinflipResponse() };
    }

    case 'get_user_stats': {
      if (!context.guildId) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Stats need a server.' };
      }
      const { getStatsData } = require('../../commands/stats');
      try {
        const data = getStatsData(context.userId, context.guildId);
        const lines = [`Messages: ${data.total} · Questions: ${data.questions} · Threads: ${data.threads}`];
        if (data.firstSeen) lines.push(`First conversation: ${data.firstSeen}`);
        if (data.hasProfile) {
          if (data.topTopics) lines.push(`Top topics: ${data.topTopics}`);
          lines.push(`Engagement: ${data.engagement} · Mood trend: ${data.mood}`);
        }
        return { role: 'tool', tool_call_id: toolCall.id, content: lines.join('\n') };
      } catch (e) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Stats are unavailable right now — try again later.' };
      }
    }

    default:
      return { role: 'tool', tool_call_id: toolCall.id, content: `Unknown tool: ${name}` };
  }
}

module.exports = { runTool };
