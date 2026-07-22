const { EmbedBuilder } = require('discord.js');
const { buildSystemPrompt } = require('../../persona/identity');
const { roles, roleTokenBudgets } = require('../../persona/roles');
const { canCall, recordCall, getRateLimitMessage } = require('../../lib/rateLimit');
const { moderatedChatCompletion } = require('../../ai/client');
const { postProcess, splitMessage, maybeBurst, ROLE_NATURE } = require('../discordNative/postProcess');
const { searchWeb } = require('./searchEngine');
const { checkCooldown, setCooldown } = require('../../db/database');

const COOLDOWN_MS = 5 * 1000;

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  "Even the Warmaster's reach has limits. Try in a moment.",
  'Signal lost. The boundary holds.',
];

async function execute(interaction) {
  // Cooldown check (5s per user per channel)
  const cooldownKey = 'search:' + interaction.guildId + ':' + interaction.user.id + ':' + interaction.channelId;
  if (checkCooldown(cooldownKey)) {
    return interaction.reply({ content: 'Please wait 5 seconds between searches.', flags: 64, allowedMentions: { parse: ['users'] } });
  }

  // Rate limit check
  if (!canCall(interaction.user.id)) {
    return interaction.reply({ content: getRateLimitMessage(interaction.user.id), flags: 64, allowedMentions: { parse: ['users'] } });
  }

  const query = interaction.options.getString('query');
  await interaction.deferReply();

  let results = [];
  let source = '';
  try {
    // Step 1: Web search
    const searchResult = await searchWeb(query);

    if (searchResult.source === 'error') {
      return interaction.editReply({ content: 'The search came up empty. Might be a connection issue.', allowedMentions: { parse: ['users'] } });
    }

    results = searchResult.results;
    source = searchResult.source;

    // No results â€” reply directly without LLM call
    if (results.length === 0) {
      return interaction.editReply({ content: 'Nothing came up for that. Try a different search.', allowedMentions: { parse: ['users'] } });
    }

    // Step 2: Build search context line
    const searchContext = 'Web search results for "' + query + '":\n' +
      results.map((r, i) => `${i + 1}. ${r.title} â€” ${r.snippet}`).join('\n');

    // Step 3: Build system prompt with search results as additional context
    const systemPrompt = buildSystemPrompt({
      roleLine: roles.search,
      additionalContext: searchContext,
    });

    // Step 4: OpenAI call
    var result = await moderatedChatCompletion({
      model: process.env.AI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Based on the search results above, answer: ' + query },
      ],
      max_tokens: roleTokenBudgets.search,
      temperature: 0.85,
      userId: interaction.user.id,
    });
    if (!result.success) {
      if (result.crisis) { await interaction.editReply({ content: require('../features/safety/crisisResponse').getCrisisResponse().content, flags: 64, allowedMentions: { parse: ['users'] } }); return; }
      await interaction.editReply({ content: result.safeMessage, flags: 64, allowedMentions: { parse: ['users'] } });
      return;
    }
    recordCall(interaction.user.id);
    var reply = result.completion.choices[0].message.content;
    if (!reply) reply = 'Could not parse the results.';
    reply = postProcess(reply, ROLE_NATURE.search);

    // Step 5: Build result embed
    const embed = new EmbedBuilder()
      .setTitle('Search: ' + query)
      .setDescription(results.map((r, i) => `[${i + 1}. ${r.title}](${r.url})`).join('\n'))
      .setColor(0x00e5ff)
      .setFooter({ text: source === 'cache' ? 'Cached' : source === 'wikipedia' ? 'Wikipedia' : source === 'google' ? 'Google' : 'DuckDuckGo' });

    // Step 6: Send response
    const chunks = splitMessage(reply, 400);
    if (chunks.length === 1) {
      await interaction.editReply({ content: chunks[0], embeds: [embed], allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.editReply({ content: chunks[0], embeds: [embed], allowedMentions: { parse: ['users'] } });
      const tail = await maybeBurst(chunks.slice(1), interaction.channel);
      for (const chunk of tail) {
        await interaction.followUp({ content: chunk, allowedMentions: { parse: ['users'] } });
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
        .setFooter({ text: 'LLM unavailable â€” raw results' });
      return interaction.editReply({ content: 'Got results but had trouble reading them. Here\'s what I found:', embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
    const errorMsg = AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)];
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMsg, allowedMentions: { parse: ['users'] } });
    } else {
      await interaction.reply({ content: errorMsg, flags: 64, allowedMentions: { parse: ['users'] } });
    }
  }
}

module.exports = { execute };
