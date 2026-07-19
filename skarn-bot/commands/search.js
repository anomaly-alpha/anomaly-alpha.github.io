// Thin wrapper — command definition and handler live in features/search/
const command = require('../features/search/search.command');
const handler = require('../features/search/search.handler');
const { EmbedBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { canCall, recordCall } = require('../lib/rateLimit');
const getOpenAIClient = require('../ai/client');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../features/discordNative/postProcess');
const { searchWeb } = require('../features/search/searchEngine');

const COOLDOWN_MS = 5 * 1000;
const cooldowns = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of cooldowns) {
    if (now - ts > COOLDOWN_MS) cooldowns.delete(key);
  }
}, 30 * 1000);

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  "Even the Warmaster's reach has limits. Try in a moment.",
  'Signal lost. The boundary holds.',
];

module.exports = {
  data: command.data,
  execute: handler.execute,
  async handleActivation(message, args) {
    // Cooldown check
    const key = `${message.author.id}:${message.channel.id}`;
    const last = cooldowns.get(key) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return message.reply({ content: `Slow down. Wait ${remaining}s.`, flags: 64 });
    }

    if (!canCall(message.author.id)) {
      return message.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', flags: 64 });
    }

    const query = args.query;
    await message.channel.sendTyping();

    let results = [];
    let source = '';
    try {
      const searchResult = await searchWeb(query);
      cooldowns.set(key, Date.now());
      recordCall(message.author.id);

      if (searchResult.source === 'error') {
        return message.reply('The search came up empty. Might be a connection issue.');
      }

      results = searchResult.results;
      source = searchResult.source;

      if (results.length === 0) {
        return message.reply('Nothing came up for that. Try a different search.');
      }

      const searchContext = 'Web search results for "' + query + '":\n' +
        results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet}`).join('\n');

      const systemPrompt = buildSystemPrompt({
        roleLine: roles.search,
        additionalContext: searchContext,
      });

      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Based on the search results above, answer: ' + query },
        ],
        max_completion_tokens: roleTokenBudgets.search,
        temperature: 0.85,
      });

      let reply = completion.choices[0].message.content;
      if (!reply) reply = 'Could not parse the results.';
      reply = postProcess(reply, ROLE_NATURE.search);

      const embed = new EmbedBuilder()
        .setTitle('Search: ' + query)
        .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
        .setColor(0x00e5ff)
        .setFooter({ text: source === 'cache' ? 'Cached' : source === 'wikipedia' ? 'Wikipedia' : source === 'google' ? 'Google' : 'DuckDuckGo' });

      const chunks = splitMessage(reply, 400);
      if (chunks.length === 1) {
        await message.reply({ content: chunks[0], embeds: [embed] });
      } else {
        const sent = await message.reply({ content: chunks[0], embeds: [embed] });
        const tail = await maybeBurst(chunks.slice(1), message.channel);
        for (const chunk of tail) {
          await message.channel.send(chunk);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      if (results.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('Search: ' + query)
          .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
          .setColor(0xff6b35)
          .setFooter({ text: 'LLM unavailable — raw results' });
        return message.reply({ content: 'Got results but had trouble reading them. Here\'s what I found:', embeds: [embed] });
      }
      const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
      await message.reply(errorMsg);
    }
  },
  activation: {
    type: 'command',
    phrase: 'skarn search',
    description: 'Search the web',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) { return { query: content.slice('skarn search'.length).trim() }; },
  },
};
