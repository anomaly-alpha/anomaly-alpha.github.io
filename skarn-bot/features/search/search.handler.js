const { EmbedBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall } = require('../../lib/rateLimit');
const getOpenAIClient = require('../../ai/client');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { searchWeb, cleanCache } = require('./searchEngine');

const COOLDOWN_MS = 5 * 1000;
const cooldowns = new Map();

// Clean up stale cooldown entries every 30 seconds
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

async function execute(interaction) {
  // Cooldown check
  const key = `${interaction.user.id}:${interaction.channel.id}`;
  const last = cooldowns.get(key) || 0;
  if (Date.now() - last < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    return interaction.reply({ content: `Slow down. Wait ${remaining}s.`, flags: 64 });
  }

  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: 'Even a Warmaster paces himself. Give it a moment.', flags: 64 });
  }

  const query = interaction.options.getString('query');
  await interaction.deferReply();

  let results = [];
  let source = '';
  try {
    // Step 1: Web search
    const searchResult = await searchWeb(query);
    cooldowns.set(key, Date.now());
    recordCall(interaction.user.id);

    if (searchResult.source === 'error') {
      return interaction.editReply('The search came up empty. Might be a connection issue.');
    }

    results = searchResult.results;
    source = searchResult.source;

    // No results — reply directly without LLM call
    if (results.length === 0) {
      return interaction.editReply('Nothing came up for that. Try a different search.');
    }

    // Step 2: Build search context line
    const searchContext = 'Web search results for "' + query + '":\n' +
      results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet}`).join('\n');

    // Step 3: Build system prompt with search results as additional context
    const systemPrompt = buildSystemPrompt({
      roleLine: roles.search,
      additionalContext: searchContext,
    });

    // Step 4: OpenAI call
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
    reply = postProcess(reply, ROLE_NATURE.search);

    // Step 5: Build result embed
    const embed = new EmbedBuilder()
      .setTitle('Search: ' + query)
      .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
      .setColor(0x00e5ff)
      .setFooter({ text: source === 'cache' ? 'Cached result' : 'DuckDuckGo' });

    // Step 6: Send response
    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      await interaction.editReply({ content: chunks[0], embeds: [embed] });
    } else {
      await interaction.editReply({ content: chunks[0], embeds: [embed] });
      const tail = await maybeBurst(chunks.slice(1), interaction.channel);
      for (const chunk of tail) {
        await interaction.followUp(chunk);
      }
    }
  } catch (error) {
    console.error('Search error:', error);
    // If we have results but LLM failed, still show the raw results
    if (results.length > 0) {
      const embed = new EmbedBuilder()
        .setTitle('Search: ' + query)
        .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
        .setColor(0xff6b35)
        .setFooter({ text: 'LLM unavailable — raw results' });
      return interaction.editReply({ content: 'Got results but had trouble reading them. Here\'s what I found:', embeds: [embed] });
    }
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply(errorMsg);
    } else {
      await interaction.reply({ content: errorMsg, flags: 64 });
    }
  }
}

module.exports = { execute };
