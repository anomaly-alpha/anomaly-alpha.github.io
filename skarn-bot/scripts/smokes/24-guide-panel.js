// ===== NATURAL-LANGUAGE GUIDE =====
// Deterministic guide catalog, access, execution, and panel-rendering checks.
(async function() {
  const assert = require('assert');
  const preferences = new Map();
  const guildConfigs = new Map();
  const reminders = [];
  const memories = [];
  let rateReservation = 0;
  let fetchedLocation = null;
  const database = {
    getGuildConfig: function(guildId, key) { return guildConfigs.get(guildId + ':' + key) || null; },
    setGuildConfig: function(guildId, key, value) { guildConfigs.set(guildId + ':' + key, value); },
    getUserPreferences: function(userId, guildId) { return { proactive_opt_in: preferences.get(userId + ':' + guildId) || 0 }; },
    setUserPreference: function(userId, guildId, key, value) {
      if (key === 'proactive_opt_in') preferences.set(userId + ':' + guildId, Number(value));
    },
    createReminder: function(userId, channelId, guildId, message, remindAt) { reminders.push({ userId, channelId, guildId, message, remindAt }); },
    addMemoryEntry: function(userId, guildId, source, type, content) { memories.push({ userId, guildId, source, type, content }); },
    getMemoryEntries: function() { return []; },
  };
  function mockModule(request, exports) {
    const id = require.resolve(request);
    require.cache[id] = { id: id, filename: id, loaded: true, exports: exports };
  }
  mockModule('../../db/database', database);
  mockModule('../../features/proactive/absenceDetector', {
    canInteract: function(userId, guildId) { return preferences.get(userId + ':' + guildId) === 1; },
  });
  mockModule('../../features/friendTiers/friendPermission', {
    checkAiPermission: function() { return { allowed: true }; },
  });
  mockModule('../../features/safety/slurFilter', {
    isHostile: function(text) { return /kill yourself|fuck you/i.test(text || ''); },
    isSilenced: function() { return false; },
    recordStrike: function() {},
  });
  mockModule('../../lib/rateLimit', {
    canCall: function() { rateReservation += 1; return rateReservation; },
    releaseCall: function() {},
  });
  mockModule('../../lib/weatherScheduler', {
    fetchWeather: async function(location) {
      fetchedLocation = location;
      return { current_condition: [{ temp_C: '21', temp_F: '70', weatherDesc: [{ value: 'Sunny' }], humidity: '45', windspeedKmph: '12', winddir16Point: 'NE' }], weather: [] };
    },
  });
  const catalog = require('../../features/guide/guideCatalog');
  const access = require('../../features/guide/guideAccess');
  const execution = require('../../features/guide/guideExecution');
  const panel = require('../../features/guide/guidePanel');

  const toolNames = catalog.getDedicatedToolNames();
  assert.strictEqual(toolNames.length, 9);
  assert(!toolNames.includes('run_command'));
  assert(catalog.validateCatalog().valid);
  assert.strictEqual(catalog.listCategories().reduce((total, category) => total + category.examples.length, 0), 45);
  assert(catalog.validateToolRegistry().runCommandExcluded);
  console.log('catalog covers exactly nine dedicated tools and excludes run_command');

  const command = require('../../commands/guide');
  assert.strictEqual(command.data.toJSON().name, 'guide');
  assert.strictEqual(command.activation.phrase, 'skarn guide');
  console.log('/guide and skarn guide are registered without replacing help');

  const state = {
    id: 'panel-1', ownerId: 'guide-user', guildId: 'guide-guild', channelId: 'guide-channel',
    categoryId: 'weather', exampleId: null, expiresAt: Date.now() + panel.SESSION_MS,
    busy: false, closed: false, panelMessage: { id: 'panel-message' },
  };
  const rendered = panel.renderPanel(state);
  const renderedData = rendered.embeds[0].toJSON();
  assert(renderedData.title.includes('NATURAL LANGUAGE INTERFACE'));
  assert.strictEqual(rendered.components.length, 3);
  assert(panel.isSessionOwner(state, 'guide-user', 'panel-message'));
  assert(!panel.isSessionOwner(state, 'other-user', 'panel-message'));
  assert(!panel.isSessionOwner(state, 'guide-user', 'other-message'));
  assert(!panel.isSessionExpired(state, Date.now()));
  assert(panel.isSessionExpired(state, state.expiresAt));
  assert(panel.claimExecution(state));
  assert(!panel.claimExecution(state));
  const reminderModal = panel.buildInputModal(state, catalog.getExample('reminder-editable')).toJSON();
  assert.strictEqual(reminderModal.components.length, 2);
  assert.strictEqual(reminderModal.components[0].components[0].custom_id, 'message');
  assert.strictEqual(reminderModal.components[1].components[0].custom_id, 'duration');
  console.log('terminal panel renders and owner/message/expiry checks are scoped');

  const guildId = 'guide-guild';
  const channelId = 'guide-channel';
  const userId = 'guide-user';
  database.setGuildConfig(guildId, 'aiChannels', [channelId]);
  database.setUserPreference(userId, guildId, 'proactive_opt_in', 1);
  const context = { userId, guildId, channelId };
  assert(access.checkGuideAccess(context).allowed);
  assert.strictEqual(access.checkGuideAccess({ ...context, channelId: 'disabled-channel' }).reason, 'channel_disabled');
  database.setUserPreference(userId, guildId, 'proactive_opt_in', 0);
  assert.strictEqual(access.checkGuideAccess(context).reason, 'opt_in_required');
  database.setUserPreference(userId, guildId, 'proactive_opt_in', 1);
  console.log('guide access requires guild opt-in and an enabled AI channel');

  function fakeMessage(id) {
    return { id: id, deleted: false, createMessageComponentCollector: function(options) {
      const collector = { options: options, handlers: {}, on: function(event, handler) { this.handlers[event] = handler; return this; }, stop: function() {} };
      this.collector = collector;
      return collector;
    }, delete: async function() { this.deleted = true; } };
  }
  const privatePanelMessage = fakeMessage('private-panel');
  let privateReply;
  const slashSource = {
    user: { id: userId }, guildId: guildId, channelId: channelId, channel: { id: channelId },
    reply: async function(payload) { privateReply = payload; },
    fetchReply: async function() { return privatePanelMessage; },
  };
  await panel.openGuidePanel(slashSource, true);
  assert.strictEqual(privateReply.flags, 64);
  assert.strictEqual(privatePanelMessage.collector.options.time, panel.SESSION_MS);
  let closeAcknowledged = false;
  await privatePanelMessage.collector.handlers.collect({
    user: { id: userId }, message: { id: 'private-panel' }, customId: 'guide:close',
    deferUpdate: async function() { closeAcknowledged = true; },
  });
  assert(closeAcknowledged);
  assert(privatePanelMessage.deleted);
  const publicPanelMessage = fakeMessage('public-panel');
  let publicReply;
  const messageSource = {
    author: { id: userId }, guild: { id: guildId }, channel: { id: channelId },
    reply: async function(payload) { publicReply = payload; return publicPanelMessage; },
  };
  await panel.openGuidePanel(messageSource, false);
  assert.strictEqual(publicReply.flags, undefined);
  assert(publicPanelMessage.collector);
  let updatedPanel;
  await publicPanelMessage.collector.handlers.collect({
    user: { id: userId }, message: { id: 'public-panel' }, customId: 'guide:category', values: ['news'],
    update: async function(payload) { updatedPanel = payload; },
  });
  assert(updatedPanel.embeds[0].toJSON().description.includes('NEWS //'));
  let deniedOtherUser = false;
  await publicPanelMessage.collector.handlers.collect({
    user: { id: 'other-user' }, message: { id: 'public-panel' }, customId: 'guide:close',
    reply: async function(payload) { deniedOtherUser = payload.flags === 64; },
  });
  assert(deniedOtherUser);
  publicPanelMessage.collector.handlers.end();
  assert(publicPanelMessage.deleted);
  console.log('/guide opens ephemeral and skarn guide opens public invoker-scoped sessions');

  const weatherResult = await execution.executeGuideExample({ exampleId: 'weather-tokyo', context, interactionId: 'weather-interaction' });
  assert(weatherResult.ok);
  assert(weatherResult.content.includes('Sunny'));
  assert.strictEqual(fetchedLocation, 'Tokyo');
  database.setUserPreference(userId, guildId, 'proactive_opt_in', 0);
  const optedOut = await execution.executeGuideExample({ exampleId: 'weather-tokyo', context, interactionId: 'denied-weather' });
  assert(!optedOut.ok);
  assert.strictEqual(fetchedLocation, 'Tokyo');
  database.setUserPreference(userId, guildId, 'proactive_opt_in', 1);
  console.log('example dispatch returns the selected dedicated tool result');

  const reminderValues = { message: 'Check the oven', duration: '30m' };
  const unconfirmed = await execution.executeGuideExample({ exampleId: 'reminder-editable', values: reminderValues, context, confirmed: false });
  assert.strictEqual(unconfirmed.reason, 'confirmation_required');
  assert.strictEqual(reminders.length, 0);
  const reminderResult = await execution.executeGuideExample({ exampleId: 'reminder-editable', values: reminderValues, context, confirmed: true, interactionId: 'reminder-interaction' });
  assert(reminderResult.ok);
  assert(reminderResult.content.includes('Reminder set'));
  assert.strictEqual(reminders.length, 1);
  assert.strictEqual(reminders[0].userId, userId);
  assert.strictEqual(reminders[0].guildId, guildId);
  assert.strictEqual(reminders[0].channelId, channelId);
  console.log('reminder requires confirmation and creates exactly one record');

  const sensitive = await execution.executeGuideExample({ exampleId: 'memory-save-editable', values: { fact: 'My medical diagnosis is asthma' }, context, confirmed: true });
  assert.strictEqual(sensitive.reason, 'sensitive_memory');
  assert.strictEqual(memories.length, 0);
  const allergy = await execution.executeGuideExample({ exampleId: 'memory-save-editable', values: { fact: 'I am allergic to peanuts' }, context, confirmed: true });
  assert.strictEqual(allergy.reason, 'sensitive_memory');
  assert.strictEqual(memories.length, 0);
  const unconfirmedMemory = await execution.executeGuideExample({ exampleId: 'memory-save-editable', values: { fact: 'My dog is named Miso' }, context, confirmed: false });
  assert.strictEqual(unconfirmedMemory.reason, 'confirmation_required');
  const memoryResult = await execution.executeGuideExample({ exampleId: 'memory-save-editable', values: { fact: 'My dog is named Miso' }, context, confirmed: true, interactionId: 'memory-interaction' });
  assert(memoryResult.ok);
  assert.strictEqual(memories.length, 1);
  assert.strictEqual(memories[0].userId, userId);
  assert.strictEqual(memories[0].guildId, guildId);
  const hostile = await execution.executeGuideExample({ exampleId: 'reminder-editable', values: { message: 'Kill yourself', duration: '30m' }, context, confirmed: true });
  assert.strictEqual(hostile.reason, 'unsafe_input');
  assert.strictEqual(reminders.length, 1);
  console.log('memory writes reject sensitive facts and require confirmation');

  const badDuration = catalog.validateExampleInputs('reminder-editable', { message: 'Check the oven', duration: 'many later' });
  assert(!badDuration.valid);
  const unknown = await execution.executeGuideExample({ exampleId: 'run-command', context });
  assert.strictEqual(unknown.reason, 'invalid_example');
  console.log('invalid inputs and non-catalog command IDs fail closed');
})().catch(function(error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
