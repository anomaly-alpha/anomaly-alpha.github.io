const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { moderatedChatCompletion } = require('../ai/client');
const { buildSystemPrompt } = require('../persona/identity');
const { roles, roleTokenBudgets } = require('../persona/roles');
const { ensureAiConfigured, checkCanCall } = require('../lib/gates');
const { recordCall } = require('../lib/rateLimit');
const { getChannelState, getUserFacts } = require('../db/database');
const { getStateLine } = require('../features/channelState/stateTracker');

const MEMES = [
  { title: 'This is Fine', url: 'https://api.memegen.link/images/doge/This_is_fine/_.png' },
  { title: 'Drake Approves', url: 'https://api.memegen.link/images/drake/this_bot/works_great.png' },
  { title: 'Roll Safe', url: 'https://api.memegen.link/images/rollsafe/cant_lose_in_tetris.png' },
  { title: 'Surprised Pikachu', url: 'https://api.memegen.link/images/pikachu/surprised_pikachu.png' },
  { title: 'Stonks', url: 'https://api.memegen.link/images/stonks/meme/stonks.png' },
  { title: 'UNO Reverse', url: 'https://api.memegen.link/images/uno/no_u.png' },
  { title: 'Is This a Pigeon?', url: 'https://api.memegen.link/images/butterfly/is_this/a_meme.png' },
  { title: 'Change My Mind', url: 'https://api.memegen.link/images/cmb/change_my_mind.png' },
  { title: 'Two Buttons', url: 'https://api.memegen.link/images/twobuttons/make_command/break_command.png' },
  { title: 'Distracted Boyfriend', url: 'https://api.memegen.link/images/boyfriend/new_meme/current_meme.png' },
  { title: 'Expanding Brain', url: 'https://api.memegen.link/images/smart/using_a_bot/programming_a_bot.png' },
  { title: 'Busy Philosoraptor', url: 'https://api.memegen.link/images/philosoraptor/if_discord_is_free.png' },
  { title: 'One Does Not Simply', url: 'https://api.memegen.link/images/boromir/one_does_not_simply.png' },
  { title: 'Flex Tape', url: 'https://api.memegen.link/images/tape/superior/flex_seal.png' },
  { title: 'Y U No', url: 'https://api.memegen.link/images/yuno/fix/the_bot.png' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random funny meme')
    .addStringOption(option => option.setName('topic').setDescription('Topic for AI caption (optional)')),
  async execute(interaction) {
    const topic = interaction.options.getString('topic');

    await interaction.deferReply();

    let title, imageUrl;

    // Try AI caption if topic provided
    if (topic) {
      try {
        ensureAiConfigured();
        checkCanCall(interaction.user.id);

        const channelState = getChannelState(interaction.channel.id, interaction.guild.id);
        const stateLine = getStateLine(channelState.current_state);
        const memory = getUserFacts(interaction.user.id, interaction.guild.id, 5);
        const memoryLine = memory.length > 0
          ? 'What Skarn remembers about this person: ' + memory.map(m => m.content).join('; ')
          : '';
        const systemPrompt = buildSystemPrompt({ roleLine: roles.meme, stateLine, memoryLine });

        var result = await moderatedChatCompletion({
          model: process.env.AI_MODEL || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Meme about: ${topic}` },
          ],
          max_tokens: roleTokenBudgets.meme,
          temperature: 1.0,
          userId: interaction.user.id,
        });

        if (result.success) {
          recordCall(interaction.user.id);
          title = `${result.completion.choices[0].message.content} — ${topic}`;
        }
      } catch {
        // AI failed or was blocked, use random meme
      }
    }

    // Pick a random meme image
    const meme = MEMES[Math.floor(Math.random() * MEMES.length)];
    if (!title) title = meme.title;
    imageUrl = meme.url;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setImage(imageUrl)
      .setColor(0x00e5ff);

    await interaction.editReply({ embeds: [embed], allowedMentions: { parse: ['users'] } });
  },
};
