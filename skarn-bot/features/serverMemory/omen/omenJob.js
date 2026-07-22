var { getUnresolvedOmens, insertOmen, fulfillOmen, expireOmen, insertRealmOmen } = require('./omenStore');
var { getSignalsSince } = require('../signalStore');
var { getGuildConfig, setGuildConfig } = require('../../../db/database');
var { buildSystemPrompt } = require('../../../persona/identity');
var getOpenAIClient = require('../../../ai/client');
var { selectModel } = require('../../intelligence/modelRouter');
var { roles, roleTokenBudgets } = require('../../../persona/roles');
var { embedText, cosineSimilarity } = require('../../intelligence/embeddings');

var MAX_UNRESOLVED = 10;
var OMEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
var MATCH_THRESHOLD = 0.7;
var MIN_OMEN_AGE_MS = 24 * 60 * 60 * 1000;

async function generateOmen() {
  var client = getOpenAIClient();
  var systemPrompt = buildSystemPrompt({ roleLine: roles.omen, stateLine: '' });
  var model = selectModel('', false);

  var response = await client.chat.completions.create({
    model: model,
    temperature: 0.9,
    max_completion_tokens: roleTokenBudgets.omen,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Speak a prophecy about your realm.' },
    ],
  });
  return response.choices[0].message.content;
}

async function generateCallback(omenText, signalText) {
  var client = getOpenAIClient();
  var systemPrompt = buildSystemPrompt({ roleLine: roles.omen_fulfill, stateLine: '' });
  var model = selectModel('', false);

  var response = await client.chat.completions.create({
    model: model,
    temperature: 0.8,
    max_completion_tokens: roleTokenBudgets.omen_fulfill,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Prophecy: "' + omenText + '"\nWhat happened: "' + signalText + '"\nHow do these connect?' },
    ],
  });
  return response.choices[0].message.content;
}

async function processGuild(guildId, client) {
  var channelId = getGuildConfig(guildId, 'omen_channel') || getGuildConfig(guildId, 'chronicle_channel');
  if (!channelId) return;

  var omens = getUnresolvedOmens(guildId);

  // Post new omen if under cap and enough time has passed
  if (omens.length < MAX_UNRESOLVED) {
    var lastOmen = omens.length ? omens[omens.length - 1] : null;
    var minInterval = parseInt(getGuildConfig(guildId, 'omen_min_interval') || '4') * 86400000;
    var maxInterval = parseInt(getGuildConfig(guildId, 'omen_max_interval') || '7') * 86400000;
    if (!lastOmen || (Date.now() - lastOmen.created_at) >= minInterval) {
      if (lastOmen && (Date.now() - lastOmen.created_at) < (Math.random() * (maxInterval - minInterval) + minInterval)) {
        // Still within randomized window — skip
      } else {
        var text = await generateOmen();
        var embedding = await embedText(text);
        insertOmen(guildId, text, embedding);
        var channel = client.channels.cache.get(channelId);
        if (channel) await channel.send({ content: '*' + text + '*', allowedMentions: { parse: ['users'] } });
        omens = getUnresolvedOmens(guildId); // refresh
      }
    }
  }

  // Check callback matches
  for (var i = 0; i < omens.length; i++) {
    var omen = omens[i];
    if (Date.now() - omen.created_at < MIN_OMEN_AGE_MS) continue;

    var signals = getSignalsSince(guildId, omen.created_at);
    var omenEmbedding = JSON.parse(omen.embedding);
    var matched = false;

    for (var j = 0; j < signals.length; j++) {
      var signal = signals[j];
      var signalEmbedding = await embedText(signal.summary_text);
      var similarity = cosineSimilarity(omenEmbedding, signalEmbedding);
      if (similarity >= MATCH_THRESHOLD) {
        var callbackText = await generateCallback(omen.omen_text, signal.summary_text);
        fulfillOmen(omen.id, callbackText);
        matched = true;

        if (signal.signal_type === 'realm_milestone') {
          insertRealmOmen(omen.id, guildId, callbackText);
        }

        var channel = client.channels.cache.get(channelId);
        if (channel) await channel.send({ content: '> *' + omen.omen_text + '*\n\n' + callbackText, allowedMentions: { parse: ['users'] } });
        break;
      }
    }

    if (!matched && (Date.now() - omen.created_at) > OMEN_EXPIRY_MS) {
      expireOmen(omen.id);
    }
  }
}

async function runOmenJob(client) {
  var guilds = client.guilds.cache.values();
  for (var guild of guilds) {
    try {
      await processGuild(guild.id, client);
    } catch (err) {
      console.error('[Omen] Error for guild ' + guild.id + ':', err.message);
    }
  }
}

// Manual fulfillment
var fulfillCounters = new Map();
var FULFILL_DAILY_LIMIT = 5;

async function manualFulfill(guildId, description, userId) {
  // Check daily cap
  var today = new Date().toDateString();
  var counterKey = guildId + ':' + userId + ':' + today;
  var count = fulfillCounters.get(counterKey) || 0;
  if (count >= FULFILL_DAILY_LIMIT) return { matched: false, text: 'Daily fulfill limit reached (5/day).' };

  var omens = getUnresolvedOmens(guildId);
  if (!omens.length) return { matched: false, text: 'That\'s not the thread I meant.' };

  var descEmbedding = await embedText(description);
  var bestMatch = null;
  var bestScore = 0;

  for (var i = 0; i < omens.length; i++) {
    var omenEmbedding = JSON.parse(omens[i].embedding);
    var score = cosineSimilarity(descEmbedding, omenEmbedding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = omens[i];
    }
  }

  if (!bestMatch || bestScore < MATCH_THRESHOLD) {
    return { matched: false, text: 'That\'s not the thread I meant.' };
  }

  var callbackText = await generateCallback(bestMatch.omen_text, description);
  fulfillOmen(bestMatch.id, callbackText);
  fulfillCounters.set(counterKey, count + 1);

  // Realm effect if description mentions Realm content
  var desc = description.toLowerCase();
  if (desc.indexOf('realm') !== -1 || desc.indexOf('quest') !== -1 || desc.indexOf('boss') !== -1 || desc.indexOf('defeat') !== -1 || desc.indexOf('explor') !== -1) {
    insertRealmOmen(bestMatch.id, guildId, callbackText);
  }

  return { matched: true, text: '> *' + bestMatch.omen_text + '*\n\n' + callbackText };
}

module.exports = { runOmenJob, manualFulfill };
