const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  escapeMarkdown,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { CATEGORIES, listExamples, getExample, validateExampleInputs, formatConfirmation } = require('./guideCatalog');
const { checkGuideAccess, denialMessage } = require('./guideAccess');
const { executeGuideExample } = require('./guideExecution');

const SESSION_MS = 5 * 60 * 1000;
const PANEL_ACTIONS = ['guide:category', 'guide:example', 'guide:run', 'guide:close'];

function sessionContext(state) {
  return { userId: state.ownerId, guildId: state.guildId, channelId: state.channelId };
}

function isSessionOwner(state, userId, messageId) {
  return !!state && state.ownerId === userId && state.panelMessage && state.panelMessage.id === messageId;
}

function isSessionExpired(state, now) {
  return !state || state.closed || (now === undefined ? Date.now() : now) >= state.expiresAt;
}

function claimExecution(state) {
  if (!state || state.executionConsumed) return false;
  state.executionConsumed = true;
  return true;
}

function getVisibleText(example) {
  if (!example) return 'Choose an example to preview it. Selecting an example never runs it.';
  const lines = [
    '**' + example.explanation + '**',
    '',
    '**Try saying**',
    '> ' + example.phrase,
    '',
    example.instructions,
    example.accessNote,
  ];
  if (example.requirements) lines.splice(2, 0, '**Needs:** ' + example.requirements);
  if (example.sideEffect === 'writes_personal_state') {
    lines.push('', '**Writes personal data:** you will review editable values and confirm before anything is saved.');
  }
  if (example.visibility === 'ephemeral') lines.push('', 'Run results are visible only to you.');
  return lines.join('\n');
}

function categoryRow(state) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('guide:category')
      .setPlaceholder('Select a natural-language tool…')
      .addOptions(CATEGORIES.map(category => ({
        label: category.label,
        value: category.id,
        description: String(category.description || '').slice(0, 100),
        default: category.id === state.categoryId,
      }))),
  );
}

function exampleRow(state) {
  const examples = listExamples(state.categoryId);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('guide:example')
    .setPlaceholder('Select an example question…')
    .setDisabled(examples.length === 0);
  if (examples.length > 0) {
    menu.addOptions(examples.map(example => ({
      label: example.label,
      value: example.id,
      description: String(example.explanation || '').slice(0, 100),
      default: example.id === state.exampleId,
    })));
  } else {
    menu.addOptions([{ label: 'No examples available', value: 'none' }]);
  }
  return new ActionRowBuilder().addComponents(menu);
}

function actionRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('guide:run')
      .setLabel('Run example')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!state.exampleId || state.busy),
    new ButtonBuilder()
      .setCustomId('guide:close')
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(state.busy),
  );
}

function renderPanel(state) {
  const category = CATEGORIES.find(item => item.id === state.categoryId) || CATEGORIES[0];
  const example = getExample(state.exampleId);
  const embed = new EmbedBuilder()
    .setColor(0x00e5ff)
    .setTitle('SKARN // NATURAL LANGUAGE INTERFACE')
    .setDescription([
      '[GUIDE READY] Choose a tool family, then an example question.',
      '',
      '**' + category.label.toUpperCase() + ' // ' + category.description + '**',
      '',
      getVisibleText(example),
      '',
      'These are dedicated tools; some text-enabled commands also accept natural phrasing. Slash-only workflows are listed in /help.',
      'SELECT previews · RUN executes privately · CLOSE deletes this panel',
    ].join('\n').slice(0, 4000))
    .setFooter({ text: 'Invoker-only session · expires in 5 minutes' });
  return { embeds: [embed], components: [categoryRow(state), exampleRow(state), actionRow(state)] };
}

function buildInputModal(state, example) {
  const modal = new ModalBuilder()
    .setCustomId('guide:input:' + state.id + ':' + example.id)
    .setTitle(('Review ' + example.label).slice(0, 45));
  const rows = example.inputs.map(input => {
    const text = new TextInputBuilder()
      .setCustomId(input.id)
      .setLabel(String(input.label).slice(0, 45))
      .setStyle(input.maxLength > 100 ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(!!input.required)
      .setMinLength(input.minLength || 0)
      .setMaxLength(Math.min(input.maxLength || 500, 4000));
    if (input.defaultValue) text.setValue(String(input.defaultValue).slice(0, input.maxLength || 500));
    return new ActionRowBuilder().addComponents(text);
  });
  modal.addComponents(...rows);
  return modal;
}

function confirmationRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('guide:confirm:' + state.id).setLabel('Confirm and run').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('guide:cancel:' + state.id).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
}

function isGuideConfirmation(customId, sessionId) {
  return customId === 'guide:confirm:' + sessionId || customId === 'guide:cancel:' + sessionId;
}

async function deliverResult(interaction, result) {
  const content = String(result.content || 'The example returned no details.');
  const description = content.length > 3900 ? content.slice(0, 3880) + '\n… (result shortened)' : content;
  const embed = new EmbedBuilder()
    .setColor(result.ok ? 0x2ecc71 : 0xff6b35)
    .setTitle(result.ok ? 'SKARN // TOOL RESULT' : 'SKARN // GUIDE NOTICE')
    .setDescription(description);
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function runSelectedExample(interaction, state, example, values, confirmed) {
  const access = checkGuideAccess(sessionContext(state));
  if (!access.allowed) {
    await interaction.deferReply({ flags: 64 });
    await deliverResult(interaction, { ok: false, content: denialMessage(access, true) });
    return;
  }
  await interaction.deferReply({ flags: 64 });
  const result = await executeGuideExample({
    exampleId: example.id,
    values: values,
    confirmed: confirmed,
    context: sessionContext(state),
    interactionId: interaction.id,
  });
  if (!result.ok && result.access) result.content = denialMessage(result.access, true);
  await deliverResult(interaction, result);
}

async function collectConfirmedValues(interaction, state, example) {
  const modal = buildInputModal(state, example);
  await interaction.showModal(modal);
  let submission;
  try {
    submission = await interaction.awaitModalSubmit({
      filter: item => item.user.id === state.ownerId && item.customId === modal.data.custom_id,
      time: Math.max(1000, state.expiresAt - Date.now()),
    });
  } catch (error) {
    state.awaitingConfirmation = false;
    state.busy = false;
    return;
  }
  if (state.closed || Date.now() >= state.expiresAt) {
    await submission.reply({ content: 'This guide session expired. Open /guide to start another.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
    state.awaitingConfirmation = false;
    state.busy = false;
    return;
  }
  const access = checkGuideAccess(sessionContext(state));
  if (!access.allowed) {
    await submission.reply({ content: denialMessage(access, true), flags: 64, allowedMentions: { parse: [] } });
    state.awaitingConfirmation = false;
    state.busy = false;
    return;
  }
  const values = {};
  for (const input of example.inputs) values[input.id] = submission.fields.getTextInputValue(input.id);
  const checked = validateExampleInputs(example.id, values);
  if (!checked.valid) {
    await submission.reply({ content: checked.errors.join('\n'), flags: 64, allowedMentions: { parse: [] } });
    state.awaitingConfirmation = false;
    state.busy = false;
    return;
  }
  const summary = escapeMarkdown(formatConfirmation(example.id, checked.values) || 'Confirm the values you entered.');
  await submission.reply({
    content: '**Review before saving**\n' + summary + '\n\nNothing changes until you confirm.',
    components: [confirmationRow(state)],
    flags: 64,
    allowedMentions: { parse: [] },
  });
  const confirmation = await submission.fetchReply();
  const collector = confirmation.createMessageComponentCollector({
    filter: item => item.user.id === state.ownerId && item.message.id === confirmation.id && isGuideConfirmation(item.customId, state.id),
    time: Math.max(1000, state.expiresAt - Date.now()),
    max: 1,
  });
  collector.on('collect', async action => {
    try {
      if (action.customId === 'guide:cancel:' + state.id) {
        await action.update({ content: 'Cancelled. Nothing was changed.', components: [], allowedMentions: { parse: [] } });
        state.busy = false;
        return;
      }
      const access = checkGuideAccess(sessionContext(state));
      if (!access.allowed) {
        await action.reply({ content: denialMessage(access, true), flags: 64, allowedMentions: { parse: [] } });
        await confirmation.delete().catch(() => {});
        state.awaitingConfirmation = false;
        state.busy = false;
        return;
      }
      if (!claimExecution(state)) {
        await action.reply({ content: 'That confirmation has already been used.', flags: 64, allowedMentions: { parse: [] } });
        return;
      }
      await runSelectedExample(action, state, example, checked.values, true);
      await confirmation.delete().catch(() => {});
      state.awaitingConfirmation = false;
      state.busy = false;
    } catch (error) {
      console.error('[Guide] Confirmation handler failed:', error.message);
      if (!action.deferred && !action.replied) await action.reply({ content: 'Skarn could not run that example. Try again.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
      state.awaitingConfirmation = false;
      state.busy = false;
    }
  });
  collector.on('end', function(collected) {
    if (collected.size === 0) {
      confirmation.delete().catch(() => {});
      state.awaitingConfirmation = false;
      state.busy = false;
    }
  });
}

async function runExampleAction(interaction, state) {
  if (state.busy) {
    await interaction.reply({ content: 'An example is already in progress for this panel.', flags: 64, allowedMentions: { parse: [] } });
    return;
  }
  const example = getExample(state.exampleId);
  if (!example) {
    await interaction.reply({ content: 'Choose an example first.', flags: 64, allowedMentions: { parse: [] } });
    return;
  }
  state.busy = true;
  state.executionConsumed = false;
  state.awaitingConfirmation = example.inputs.length > 0;
  try {
    if (example.inputs.length > 0) return await collectConfirmedValues(interaction, state, example);
    await runSelectedExample(interaction, state, example, {}, false);
  } finally {
    if (!state.awaitingConfirmation) state.busy = false;
  }
}

async function openGuidePanel(source, isPrivate) {
  const user = isPrivate ? source.user : source.author;
  const context = { userId: user.id, guildId: source.guildId || source.guild && source.guild.id, channelId: source.channelId || source.channel.id };
  const access = checkGuideAccess(context);
  if (!access.allowed) {
    const content = denialMessage(access, isPrivate);
    if (isPrivate) await source.reply({ content: content, flags: 64, allowedMentions: { parse: [] } });
    else await source.reply({ content: content, allowedMentions: { parse: [] } });
    return null;
  }
  const state = {
    id: null,
    ownerId: user.id,
    guildId: context.guildId,
    channelId: context.channelId,
    categoryId: CATEGORIES[0].id,
    exampleId: null,
    expiresAt: Date.now() + SESSION_MS,
    busy: false,
    executionConsumed: false,
    closed: false,
  };
  if (isPrivate) {
    await source.reply({ ...renderPanel(state), flags: 64, allowedMentions: { parse: [] } });
    state.panelMessage = await source.fetchReply();
  } else {
    state.panelMessage = await source.reply({ ...renderPanel(state), allowedMentions: { parse: [] } });
  }
  state.id = state.panelMessage.id;
  const collector = state.panelMessage.createMessageComponentCollector({
    filter: interaction => interaction.message.id === state.panelMessage.id && PANEL_ACTIONS.includes(interaction.customId),
    time: SESSION_MS,
  });
  collector.on('collect', async function(interaction) {
    if (!isSessionOwner(state, interaction.user.id, interaction.message.id)) {
      await interaction.reply({ content: 'This guide panel belongs to its opener. Use /guide to open your own.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    if (isSessionExpired(state)) {
      await interaction.reply({ content: 'This guide session has ended. Open /guide to start another.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    if (state.busy && interaction.customId !== 'guide:close') {
      await interaction.reply({ content: 'Finish or cancel the current example first.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    const allowed = checkGuideAccess(sessionContext(state));
    if (!allowed.allowed) {
      await interaction.reply({ content: denialMessage(allowed, true), flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
      state.closed = true;
      collector.stop('access-revoked');
      await state.panelMessage.delete().catch(() => {});
      return;
    }
    try {
      if (interaction.customId === 'guide:category') {
        const selected = CATEGORIES.find(item => item.id === interaction.values[0]);
        if (!selected) return await interaction.reply({ content: 'Unknown guide category.', flags: 64, allowedMentions: { parse: [] } });
        state.categoryId = selected.id;
        state.exampleId = null;
        await interaction.update(renderPanel(state));
      } else if (interaction.customId === 'guide:example') {
        const example = getExample(interaction.values[0]);
        if (!example || example.categoryId !== state.categoryId) return await interaction.reply({ content: 'Unknown guide example.', flags: 64, allowedMentions: { parse: [] } });
        state.exampleId = example.id;
        await interaction.update(renderPanel(state));
      } else if (interaction.customId === 'guide:run') {
        await runExampleAction(interaction, state);
      } else if (interaction.customId === 'guide:close') {
        state.closed = true;
        await interaction.deferUpdate();
        collector.stop('closed');
        await state.panelMessage.delete().catch(() => {});
      }
    } catch (error) {
      console.error('[Guide] Panel interaction failed:', error.message);
      if (!interaction.deferred && !interaction.replied) await interaction.reply({ content: 'The guide could not process that action. Try again.', flags: 64, allowedMentions: { parse: [] } }).catch(() => {});
    }
  });
  collector.on('end', function() {
    if (state.closed) return;
    state.closed = true;
    state.panelMessage.delete().catch(() => {});
  });
  return state.panelMessage;
}

module.exports = { openGuidePanel, renderPanel, buildInputModal, isSessionOwner, isSessionExpired, claimExecution, SESSION_MS };
