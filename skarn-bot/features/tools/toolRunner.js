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

  switch (name) {
    case 'etch_memory': {
      const { userId, fact } = parsed;
      if (!userId || !fact) return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing userId or fact' };
      addMemoryEntry(userId, guildId, 'etch', 'fact', fact, 1.0, 'Saved by Skarn via tool use');
      return { role: 'tool', tool_call_id: toolCall.id, content: 'Fact saved.' };
    }

    case 'get_memory': {
      const { userId } = parsed;
      if (!userId) return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing userId' };
      const entries = getMemoryEntries(userId, guildId, 15);
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
      const { userId, message, duration } = parsed;
      if (!userId || !message || !duration) {
        return { role: 'tool', tool_call_id: toolCall.id, content: 'Error: missing userId, message, or duration' };
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
      createReminder(userId, channelId || userId, guildId, message, Date.now() + durationMs);
      return { role: 'tool', tool_call_id: toolCall.id, content: 'Reminder set.' };
    }

    default:
      return { role: 'tool', tool_call_id: toolCall.id, content: `Unknown tool: ${name}` };
  }
}

module.exports = { runTool };
