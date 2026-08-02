const {
  SlashCommandBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { THEMES, buildHelpPages, getPageEmbed } = require('../features/help/helpPages');

const TIMEOUT = 2 * 60 * 1000;

function themeRow(themeOptions) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_theme')
      .setPlaceholder('Jump to a theme…')
      .addOptions(themeOptions));
}

function pageRow(pages, index) {
  const prev = new ButtonBuilder().setCustomId('help_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0);
  const next = new ButtonBuilder().setCustomId('help_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === pages.length - 1);
  return new ActionRowBuilder().addComponents(prev, next);
}

function disabledRows(state) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('help_theme')
    .setPlaceholder('Jump to a theme…')
    .addOptions(state.themeOptions)
    .setDisabled(true);
  const prev = new ButtonBuilder().setCustomId('help_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true);
  const next = new ButtonBuilder().setCustomId('help_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true);
  return [new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(prev, next)];
}

function renderAt(state, index) {
  return {
    embeds: [getPageEmbed(state.pages[index], index + 1, state.pages.length, state.themeCounts)],
    components: [themeRow(state.themeOptions), pageRow(state.pages, index)],
  };
}

function initialIndex(pages, theme) {
  if (!theme) return 0;
  const found = pages.findIndex(function(p) { return p.kind === 'theme' && p.slug === theme; });
  return found > 0 ? found : 0;
}

async function handleNav(interaction, state, index) {
  if (interaction.customId === 'help_prev') index = Math.max(0, index - 1);
  else if (interaction.customId === 'help_next') index = Math.min(state.pages.length - 1, index + 1);
  else if (interaction.customId === 'help_theme') {
    const found = state.pages.findIndex(function(p) { return p.kind === 'theme' && p.slug === interaction.values[0]; });
    index = found > 0 ? found : 0;
  }
  await interaction.update(renderAt(state, index));
  return index;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription("Browse Skarn's commands — themes, descriptions and tips")
    .addStringOption(function(option) {
      return option.setName('theme')
        .setDescription('Jump straight to a theme')
        .setRequired(false)
        .addChoices(
          ...THEMES.filter(function(t) { return t.slug !== 'other'; }).map(function(t) { return { name: t.emoji + ' ' + t.title, value: t.slug }; }),
        );
    }),
  async execute(interaction) {
    const state = buildHelpPages(interaction.client.commands);
    let index = initialIndex(state.pages, interaction.options.getString('theme'));
    await interaction.reply({ ...renderAt(state, index), flags: 64 });
    const reply = await interaction.fetchReply();
    const collector = interaction.channel.createMessageComponentCollector({
      filter: function(i) {
        return i.user.id === interaction.user.id && ['help_prev', 'help_next', 'help_theme'].includes(i.customId) && i.message.id === reply.id;
      },
      time: TIMEOUT,
    });
    collector.on('collect', async function(i) {
      try {
        index = await handleNav(i, state, index);
      } catch (e) {
        if (e.code !== 10062) console.error('[Help] nav error:', e.message);
      }
    });
    collector.on('end', function() {
      interaction.editReply({ components: disabledRows(state) }).catch(function() {});
    });
  },
  async handleActivation(message, args) {
    const state = buildHelpPages(message.client.commands);
    let index = initialIndex(state.pages, args.theme);
    const reply = await message.reply(renderAt(state, index));
    const collector = message.channel.createMessageComponentCollector({
      filter: function(i) {
        return i.user.id === message.author.id && ['help_prev', 'help_next', 'help_theme'].includes(i.customId) && i.message.id === reply.id;
      },
      time: TIMEOUT,
    });
    collector.on('collect', async function(i) {
      try {
        index = await handleNav(i, state, index);
      } catch (e) {
        if (e.code !== 10062) console.error('[Help] nav error:', e.message);
      }
    });
    collector.on('end', function() {
      reply.edit({ components: disabledRows(state) }).catch(function() {});
    });
  },
  activation: {
    type: 'command',
    phrase: 'skarn help',
    description: "Browse Skarn's commands",
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function(content) {
      const rest = content.slice('skarn help'.length).trim().toLowerCase();
      if (!rest) return { theme: null };
      const match = THEMES.find(function(t) { return t.slug === rest || t.title.toLowerCase() === rest; });
      return { theme: match ? match.slug : null };
    },
  },
};
