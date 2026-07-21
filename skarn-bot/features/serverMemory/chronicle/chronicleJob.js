var { getSignalsSince, countSignalsSince } = require('../signalStore');
var { insertEntry, getLatestEntryPeriod } = require('./chronicleStore');
var { buildSystemPrompt } = require('../../../persona/identity');
var { getOpenAIClient } = require('../../../ai/client');
var { selectModel } = require('../../intelligence/modelRouter');
var { roles, roleTokenBudgets } = require('../../../persona/roles');

var CHRONICLE_INTERVAL = 7 * 24 * 60 * 60 * 1000;
var MIN_SIGNALS = 3;

async function generateChronicle(guildId) {
  var last = getLatestEntryPeriod(guildId);
  var since = last ? last.period_end : (Date.now() - CHRONICLE_INTERVAL);
  if (last && (Date.now() - last.period_end) < CHRONICLE_INTERVAL) return null;

  var count = countSignalsSince(guildId, since);
  if (count < MIN_SIGNALS) return null;

  var signals = getSignalsSince(guildId, since);
  var highPriority = signals.filter(function(s) { return s.signal_type === 'realm_milestone'; });
  var otherSignals = signals.filter(function(s) { return s.signal_type !== 'realm_milestone'; });

  var milestoneLines = highPriority.map(function(s) { return s.summary_text; }).join('\n');
  var otherLines = otherSignals.map(function(s) { return s.summary_text; }).join('\n');
  var promptParts = [];
  if (milestoneLines) promptParts.push('Realm events this week:\n' + milestoneLines);
  if (otherLines) promptParts.push('Other notable moments:\n' + otherLines);
  var userPrompt = promptParts.join('\n\n') + '\n\nWrite a chronicle entry for this week in Skarn\'s voice.';

  var client = getOpenAIClient();
  var systemPrompt = buildSystemPrompt({ roleLine: roles.chronicle, stateLine: '' });
  var model = selectModel(userPrompt, false);

  var response = await client.chat.completions.create({
    model: model,
    temperature: 0.8,
    max_completion_tokens: roleTokenBudgets.chronicle,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  var content = response.choices[0].message.content;
  insertEntry(guildId, content, since, Date.now());
  return content;
}

async function runChronicleJob(client) {
  var guilds = client.guilds.cache.values();
  for (var guild of guilds) {
    try {
      var db = require('../../../db/database');
      var row = db.db ? db.db.prepare('SELECT value FROM guild_config WHERE guild_id = ? AND key = ?').get(guild.id, 'chronicle_channel') : null;
      if (!row) continue;
      var channel = client.channels.cache.get(row.value);
      if (!channel) continue;

      var content = await generateChronicle(guild.id);
      if (content) {
        await channel.send(content);
      }
    } catch (err) {
      console.error('[Chronicle] Error for guild ' + guild.id + ':', err.message);
    }
  }
}

module.exports = { generateChronicle, runChronicleJob };
