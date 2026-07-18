const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const activeAdventures = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adventure')
    .setDescription('AI Dungeon Master — text adventure game')
    .addStringOption(option => option.setName('theme').setDescription('Theme (fantasy, sci-fi, horror, etc.)')
      .addChoices(
        { name: 'Fantasy', value: 'fantasy medieval' },
        { name: 'Sci-Fi', value: 'sci-fi space' },
        { name: 'Horror', value: 'horror' },
        { name: 'Pirate', value: 'pirate adventure' },
        { name: 'Zombie', value: 'zombie apocalypse' },
      )),
  async execute(interaction) {
    const theme = interaction.options.getString('theme') || 'fantasy medieval';
    if (!process.env.OPENAI_API_KEY) return interaction.reply({ content: 'AI not configured.', ephemeral: true });

    await interaction.deferReply();
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a ${theme} Dungeon Master. Create immersive scenes with choices. Describe the scene vividly. Always end with 4 numbered choices (1-4). Keep it exciting and dramatic.` },
          { role: 'user', content: `Start a new adventure for ${interaction.user.username}. Describe the opening scene and give me 4 choices.` },
        ],
        max_tokens: 300,
        temperature: 0.9,
      });

      const scene = completion.choices[0].message.content;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('adv_1').setLabel('1').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_2').setLabel('2').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_3').setLabel('3').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('adv_4').setLabel('4').setStyle(ButtonStyle.Primary),
      );

      const embed = new EmbedBuilder()
        .setTitle('Adventure')
        .setDescription(scene)
        .setColor(0x00e5ff)
        .setFooter({ text: 'Click a button to choose your action' });

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const filter = i => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      const history = [{ role: 'assistant', content: scene }];

      collector.on('collect', async i => {
        const choice = i.customId.replace('adv_', '');
        history.push({ role: 'user', content: `Choice ${choice}` });

        const next = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: `You are a ${theme} Dungeon Master. Continue the adventure based on the player's choice. Describe what happens. End with 4 new numbered choices. Keep it exciting.` },
            ...history,
          ],
          max_tokens: 300,
          temperature: 0.9,
        });

        const nextScene = next.choices[0].message.content;
        history.push({ role: 'assistant', content: nextScene });

        const nextEmbed = new EmbedBuilder()
          .setTitle('Adventure')
          .setDescription(nextScene)
          .setColor(0x00e5ff)
          .setFooter({ text: 'Click a button to choose your action' });

        await i.update({ embeds: [nextEmbed], components: [row] });
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch {
      await interaction.editReply({ content: 'Adventure failed to load.', ephemeral: true });
    }
  },
};
