const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCharacter, getCharacterSheet, addXp, heal } = require('./character');
const { getLocation, getConnectedLocations, moveTo, parseChoices } = require('./world');
const { rollEnemy, startCombat, processCombatRound, getCombatState } = require('./combat');
const { generateLoot, equipBest, paginateItems } = require('./inventory');
const { canAcceptQuest, createQuest, checkQuestProgress } = require('./quest');
const { canTrade, startTrade } = require('./economy');
const { generateNpc, handleNpcInteraction } = require('./npc');
const { generateBackstory, generateExploration, generateQuestHook } = require('./aiDriver');
const realmStore = require('./realmStore');
const { canCall, recordCall, canGuildCall, incrementGuildDaily } = require('./realmRateLimit');
const { RACE_BONUSES, CLASS_STATS } = require('./realmConfig');

// ===== Constants =====

const EPHEMERAL = 64;

const AI_ERRORS = [
  'The connection is frayed. Try again.',
  'Even the Warmaster\'s reach has limits. Try in a moment.',
  'Signal lost. The boundary holds.',
];

const isProcessing = new Map();
const PROCESSING_TTL = 30000; // 30s auto-expire to prevent stuck keys

function guardKey(i) { return `${i.user.id}:${i.guildId}`; }
function setProcessing(key) { isProcessing.set(key, Date.now() + PROCESSING_TTL); }
function checkProcessing(key) {
  const expires = isProcessing.get(key);
  if (!expires) return false;
  if (Date.now() > expires) { clearProcessing(key); return false; }
  return true;
}
function clearProcessing(key) { isProcessing.delete(key); }
function randomError() { return AI_ERRORS[Math.floor(Math.random() * AI_ERRORS.length)]; }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

// ===== Build Helpers =====

function buildExplorationButtons(choices) {
  if (!choices || choices.length === 0) return [];
  return [new ActionRowBuilder().addComponents(
    choices.slice(0, 4).map((c, i) =>
      new ButtonBuilder().setCustomId(`exp_${i}`).setLabel(`${c.index}. ${c.text.substring(0, 80)}`).setStyle(ButtonStyle.Primary)
    )
  )];
}

function buildExploreEmbed(location, text, char) {
  return new EmbedBuilder()
    .setTitle(location.name)
    .setDescription(text)
    .setColor(0x00e5ff)
    .setFooter({ text: `HP: ${char.hp_current}/${char.hp_max} | Gold: ${char.gold} | Lv.${char.level}` });
}

function buildCombatButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('combat_attack').setLabel('Attack').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('combat_defend').setLabel('Defend').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('combat_flee').setLabel('Flee').setStyle(ButtonStyle.Primary),
  );
}

function buildCombatEmbed(enemy, playerHp, playerMaxHp) {
  return new EmbedBuilder()
    .setTitle(`Combat: ${enemy.name}`)
    .setDescription(`**${enemy.name}** (Lv.${enemy.level})\n\nYour HP: ${playerHp}/${playerMaxHp}\nEnemy HP: ${enemy.hp}/${enemy.maxHp}`)
    .setColor(0xe91e8a);
}

// ===== create =====

async function handleCreate(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const existing = realmStore.getCharacter(userId, guildId);
  if (existing) {
    return interaction.reply({
      content: `You already have **${existing.name}**. Use \`/realm delete\` first.`,
      flags: EPHEMERAL,
    });
  }

  // Step 1: Name
  console.log('[REALM] create: waiting for name input from', userId);
  await interaction.reply({ content: '**Step 1/5** — What shall your character be called?', flags: EPHEMERAL });

  const nameMsg = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId && !m.author.bot,
    max: 1, time: 60000, errors: ['time'],
  }).catch(e => { console.error('[REALM] awaitMessages error:', e.message); return null; });

  console.log('[REALM] create: nameMsg received:', !!nameMsg);
  if (!nameMsg) return interaction.editReply({ content: 'Timed out. Try `/realm create` again.' });
  const charName = nameMsg.first().content.trim();
  await nameMsg.first().delete().catch(() => {});
  if (charName.length < 2 || charName.length > 32) {
    return interaction.editReply({ content: 'Name must be 2-32 characters. Try `/realm create` again.' });
  }

  // Step 2: Race (Discord limits 5 buttons per row)
  const races = Object.keys(RACE_BONUSES);
  const raceRow1 = new ActionRowBuilder().addComponents(
    races.slice(0, 5).map(r => new ButtonBuilder().setCustomId(`race_${r}`).setLabel(capitalize(r)).setStyle(ButtonStyle.Secondary))
  );
  const raceComponents = [raceRow1];
  if (races.length > 5) {
    const raceRow2 = new ActionRowBuilder().addComponents(
      races.slice(5).map(r => new ButtonBuilder().setCustomId(`race_${r}`).setLabel(capitalize(r)).setStyle(ButtonStyle.Secondary))
    );
    raceComponents.push(raceRow2);
  }
  await interaction.editReply({ content: `**Step 2/5** — Choose a race for **${charName}**:`, components: raceComponents });

  const raceInter = await interaction.channel.awaitMessageComponent({
    filter: i => i.user.id === userId && i.customId.startsWith('race_'),
    time: 60000,
  }).catch(() => null);

  if (!raceInter) return interaction.editReply({ content: 'Timed out.', components: [] });
  const selectedRace = raceInter.customId.replace('race_', '');
  await raceInter.update({ content: `Race: **${capitalize(selectedRace)}** ✓`, components: [] });

  // Step 3: Class (Discord limits 5 buttons per row)
  const classes = Object.keys(CLASS_STATS);
  const classRow1 = new ActionRowBuilder().addComponents(
    classes.slice(0, 5).map(c => new ButtonBuilder().setCustomId(`class_${c}`).setLabel(capitalize(c)).setStyle(ButtonStyle.Secondary))
  );
  const classComponents = [classRow1];
  if (classes.length > 5) {
    const classRow2 = new ActionRowBuilder().addComponents(
      classes.slice(5).map(c => new ButtonBuilder().setCustomId(`class_${c}`).setLabel(capitalize(c)).setStyle(ButtonStyle.Secondary))
    );
    classComponents.push(classRow2);
  }
  await interaction.editReply({ content: `**Step 3/5** — Choose a class for **${charName}**:`, components: classComponents });

  const classInter = await interaction.channel.awaitMessageComponent({
    filter: i => i.user.id === userId && i.customId.startsWith('class_'),
    time: 60000,
  }).catch(() => null);

  if (!classInter) return interaction.editReply({ content: 'Timed out.', components: [] });
  const selectedClass = classInter.customId.replace('class_', '');
  await classInter.update({ content: `Class: **${capitalize(selectedClass)}** ✓`, components: [] });

  // Step 4: Background
  await interaction.editReply({
    content: '**Step 4/5** — Tell me about your character\'s background. What drove them to the Realm of Skarn?',
    components: [],
  });

  const bgMsg = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId && !m.author.bot,
    max: 1, time: 60000, errors: ['time'],
  }).catch(() => null);

  if (!bgMsg) return interaction.editReply({ content: 'Timed out.' });
  const bgAnswer = bgMsg.first().content.trim();
  await bgMsg.first().delete().catch(() => {});

  // Step 5: AI Backstory
  if (!canCall(userId) || !canGuildCall(guildId)) {
    return interaction.editReply({ content: 'The realm is overwhelmed. Try again in a moment.' });
  }

  await interaction.editReply({ content: '**Step 5/5** — Skarn is weaving your destiny...' });

  let backstory;
  try {
    backstory = await generateBackstory({ name: charName, race: selectedRace, class: selectedClass }, bgAnswer);
    recordCall(userId);
    incrementGuildDaily(guildId);
  } catch {
    backstory = `${charName} arrived at the Abyssal Gate with nothing but a blade and a burning will to survive.`;
  }

  const storyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('story_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('story_reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({ content: `**Your Backstory:**\n${backstory}`, components: [storyRow] });

  const storyInter = await interaction.channel.awaitMessageComponent({
    filter: i => i.user.id === userId && i.customId.startsWith('story_'),
    time: 60000,
  }).catch(() => null);

  if (storyInter && storyInter.customId === 'story_reroll') {
    await storyInter.update({ content: 'Using default backstory...', components: [] });
    backstory = `${charName} arrived at the Abyssal Gate with nothing but a blade and a burning will to survive.`;
  } else if (storyInter) {
    await storyInter.update({ content: 'Character created!', components: [] });
  } else {
    await interaction.editReply({ content: 'Using default backstory...', components: [] });
    backstory = `${charName} arrived at the Abyssal Gate with nothing but a blade and a burning will to survive.`;
  }

  const result = createCharacter(userId, guildId, charName, selectedRace, selectedClass, backstory);
  if (result.error) return interaction.editReply({ content: `Error: ${result.error}` });

  // Channel message for major event
  await interaction.channel.send(
    `⚔️ **${charName}** the **${capitalize(selectedRace)} ${capitalize(selectedClass)}** has entered the Realm of Skarn!\n\n*${backstory}*`
  );
  return interaction.editReply({ content: `✅ Character **${charName}** created! Use \`/realm start\` to begin.`, components: [] });
}

// ===== start / explore =====

async function handleExplore(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const char = realmStore.getCharacter(userId, guildId);
  if (!char) {
    return interaction.reply({ content: 'No character found. Use `/realm create` first.', flags: EPHEMERAL });
  }

  // Re-enter combat if already in one
  const combatState = getCombatState(userId, guildId);
  if (combatState) {
    const combatEmbed = buildCombatEmbed(combatState.enemy, char.hp_current, char.hp_max);
    return interaction.reply({ embeds: [combatEmbed], components: [buildCombatButtons()], flags: EPHEMERAL });
  }

  const key = guardKey(interaction);
  if (checkProcessing(key)) return interaction.reply({ content: 'Processing your last action...', flags: EPHEMERAL });
  setProcessing(key);

  try {
    await interaction.deferReply();

    const location = getLocation(char.current_location);
    if (!location) return interaction.editReply({ content: 'Unknown location. Try `/realm start` again.' });

    if (!canCall(userId) || !canGuildCall(guildId)) {
      return interaction.editReply({ content: 'The realm is overwhelmed. Try again in a moment.' });
    }

    const activeQuests = realmStore.getActiveQuests(userId, guildId);
    const quest = activeQuests[0] || null;

    const rawText = await generateExploration(char, location, quest, null);
    recordCall(userId);
    incrementGuildDaily(guildId);

    const { narrative, choices } = parseChoices(rawText);
    const choiceTexts = choices.map(c => c.text);

    const embed = buildExploreEmbed(location, narrative || rawText, char);
    const components = buildExplorationButtons(choices);

    await interaction.editReply({ embeds: [embed], components });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === userId, time: 120000,
    });

    collector.on('collect', async i => {
      if (checkProcessing(key)) {
        await i.reply({ content: 'Still processing...', flags: EPHEMERAL }).catch(() => {});
        return;
      }
      setProcessing(key);

      try {
        if (i.customId.startsWith('combat_')) {
          await handleCombatButton(i, userId, guildId, key, collector, interaction);
        } else if (i.customId.startsWith('exp_')) {
          await handleExploreChoice(i, userId, guildId, key, char, quest, choiceTexts, collector, interaction);
        }
      } catch (err) {
        console.error('Explore collector error:', err);
        try { await i.update({ content: randomError() }); } catch {}
      } finally {
        clearProcessing(key);
      }
    });

    collector.on('end', () => {
      clearProcessing(key);
      interaction.editReply({ components: [] }).catch(() => {});
    });

  } catch (err) {
    console.error('Explore error:', err);
    clearProcessing(key);
    const msg = randomError();
    if (interaction.deferred) await interaction.editReply(msg);
    else await interaction.reply({ content: msg, flags: EPHEMERAL });
  }
}

// ===== Explore Button Handler =====

async function handleExploreChoice(i, userId, guildId, key, char, quest, choiceTexts, collector, interaction) {
  const idx = parseInt(i.customId.replace('exp_', ''), 10);
  const choiceText = choiceTexts[idx] || '';

  const currentChar = realmStore.getCharacter(userId, guildId);
  if (!currentChar) {
    await i.update({ content: 'Your character no longer exists.', embeds: [], components: [] });
    collector.stop();
    return;
  }

  const currentLocation = getLocation(currentChar.current_location);
  const connected = getConnectedLocations(currentChar.current_location);

  const matchedLoc = connected.find(loc =>
    choiceText.toLowerCase().includes(loc.name.toLowerCase()) ||
    choiceText.toLowerCase().includes(loc.id.replace(/_/g, ' '))
  );

  const matchedNpc = (currentLocation.npcPool || []).find(npcId =>
    choiceText.toLowerCase().includes(npcId.replace(/_/g, ' '))
  );

  const combatKw = ['fight', 'attack', 'slay', 'battle', 'confront', 'challenge', 'engage'];
  const triggersCombat = combatKw.some(kw => choiceText.toLowerCase().includes(kw));

  if (matchedLoc) {
    const moveResult = moveTo(userId, guildId, matchedLoc.id);
    if (moveResult.error) return i.update({ content: moveResult.error });

    checkQuestProgress(userId, guildId, 'explore', matchedLoc.id);

    if (!canCall(userId) || !canGuildCall(guildId)) {
      return i.update({ content: 'The realm is overwhelmed. Try again.' });
    }

    const updatedChar = realmStore.getCharacter(userId, guildId);
    try {
      const raw = await generateExploration(updatedChar, moveResult.location, quest, null);
      recordCall(userId);
      incrementGuildDaily(guildId);

      const parsed = parseChoices(raw);
      choiceTexts.length = 0;
      choiceTexts.push(...parsed.choices.map(c => c.text));

      const embed = buildExploreEmbed(moveResult.location, parsed.narrative || raw, updatedChar);
      const components = buildExplorationButtons(parsed.choices);
      await i.update({ embeds: [embed], components });
    } catch {
      await i.update({ content: randomError(), embeds: [], components: [] });
    }
  } else if (matchedNpc) {
    const npc = generateNpc(matchedNpc, currentChar.current_location);
    const npcResult = await handleNpcInteraction(userId, guildId, npc, currentChar, choiceText);

    let text = `**${npc.name}:** "${npcResult.dialogue}"`;

    if (npc.role === 'quest_giver' && canAcceptQuest(userId, guildId)) {
      if (canCall(userId) && canGuildCall(guildId)) {
        try {
          const hookText = await generateQuestHook(npc, currentChar, currentLocation);
          recordCall(userId);
          incrementGuildDaily(guildId);

          const titleMatch = hookText.match(/Title:\s*(.+)/i);
          const descMatch = hookText.match(/Description:\s*(.+)/i);
          const rewardMatch = hookText.match(/Reward:\s*(.+)/i);

          const questData = {
            title: titleMatch ? titleMatch[1].trim() : 'Unknown Quest',
            description: descMatch ? descMatch[1].trim() : '',
            objectives: [{ type: 'explore', target: currentChar.current_location, count: 3 }],
            rewards: rewardMatch ? rewardMatch[1].trim() : null,
            giver: npc.name,
          };

          const qr = createQuest(userId, guildId, questData);
          if (!qr.error) text += `\n\n📜 **Quest:** ${questData.title}\n${questData.description}`;
        } catch {}
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('NPC Interaction')
      .setDescription(text)
      .setColor(0xf39c12)
      .setFooter({ text: `HP: ${currentChar.hp_current}/${currentChar.hp_max} | Gold: ${currentChar.gold} | Lv.${currentChar.level}` });

    await i.update({ embeds: [embed], components: [] });
  } else if (triggersCombat || Math.random() < 0.12 * (currentLocation.dangerLevel || 1)) {
    const enemy = rollEnemy(currentLocation.dangerLevel || 1);
    const combatResult = startCombat(userId, guildId, enemy, currentChar.current_location);
    if (combatResult.error) return i.update({ content: combatResult.error });

    // Channel message for combat
    await interaction.channel.send(`⚔️ **${currentChar.name}** encounters a **${enemy.name}** (Lv.${enemy.level})!`);

    const combatEmbed = buildCombatEmbed(enemy, combatResult.playerHp, combatResult.playerMaxHp);
    await i.update({ embeds: [combatEmbed], components: [buildCombatButtons()] });
  } else {
    // Free action — new scene
    if (!canCall(userId) || !canGuildCall(guildId)) {
      return i.update({ content: 'The realm is overwhelmed. Try again.' });
    }

    try {
      const raw = await generateExploration(currentChar, currentLocation, quest, [{ role: 'user', content: choiceText }]);
      recordCall(userId);
      incrementGuildDaily(guildId);

      const parsed = parseChoices(raw);
      choiceTexts.length = 0;
      choiceTexts.push(...parsed.choices.map(c => c.text));

      const embed = buildExploreEmbed(currentLocation, parsed.narrative || raw, currentChar);
      const components = buildExplorationButtons(parsed.choices);
      await i.update({ embeds: [embed], components });
    } catch {
      await i.update({ content: randomError(), embeds: [], components: [] });
    }
  }
}

// ===== Combat Button Handler =====

async function handleCombatButton(i, userId, guildId, key, collector, interaction) {
  const action = i.customId.replace('combat_', '');
  const currentChar = realmStore.getCharacter(userId, guildId);
  if (!currentChar) {
    await i.update({ content: 'Your character no longer exists.', embeds: [], components: [] });
    collector.stop();
    return;
  }

  const result = await processCombatRound(userId, guildId, action, action === 'defend');
  if (result.error) return i.update({ content: result.error });

  let desc = '';
  if (result.narration) desc += `${result.narration}\n\n`;
  desc += `**Round ${result.round}**\n`;
  desc += `You: ${result.playerHp}/${result.playerMaxHp} HP | ${result.enemyName}: ${result.enemyHp}/${result.enemyMaxHp} HP\n`;

  if (result.playerDamage > 0) desc += `You deal **${result.playerDamage}** damage${result.isCrit ? ' (CRIT!)' : ''}.\n`;
  if (result.enemyDamage > 0) desc += `${result.enemyName} deals **${result.enemyDamage}** damage.\n`;
  if (result.fleeSuccess) desc += 'You fled successfully!\n';

  if (result.outcome === 'victory') {
    desc += `\n🏆 **Victory!** +${result.xpGained} XP, +${result.goldGained} gold`;
    const xpResult = addXp(userId, guildId, result.xpGained);
    if (xpResult.leveledUp) {
      await interaction.channel.send(`🎉 **${currentChar.name}** leveled up to **Level ${xpResult.level}**!`);
    }

    const loot = generateLoot(getLocation(currentChar.current_location)?.dangerLevel || 1, currentChar.luck);
    if (loot) {
      realmStore.addItem(userId, guildId, loot.itemId, loot.name, loot.type, loot.description, loot.rarity, loot.stats, loot.value);
      desc += `\n\nFound: **${loot.name}** (${loot.rarity} ${loot.type})`;
      if (loot.rarity === 'legendary') {
        await interaction.channel.send(`✨ **${currentChar.name}** found a legendary item: **${loot.name}**!`);
      }
    }

    equipBest(userId, guildId);

    const embed = new EmbedBuilder().setTitle('Combat Victory').setDescription(desc).setColor(0x2ecc71)
      .setFooter({ text: `HP: ${result.playerHp}/${result.playerMaxHp} | Gold: ${currentChar.gold + result.goldGained}` });
    await i.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const updatedChar = realmStore.getCharacter(userId, guildId);
        const location = getLocation(updatedChar.current_location);
        if (!location || !canCall(userId) || !canGuildCall(guildId)) return;
        const raw = await generateExploration(updatedChar, location, null, null);
        recordCall(userId);
        incrementGuildDaily(guildId);
        const parsed = parseChoices(raw);
        const embed = buildExploreEmbed(location, parsed.narrative || raw, updatedChar);
        const components = buildExplorationButtons(parsed.choices);
        await interaction.editReply({ embeds: [embed], components });
      } catch {}
    }, 2000);

  } else if (result.outcome === 'defeat') {
    desc += `\n💀 **Defeated!** Lost ${result.goldLost} gold.`;
    await interaction.channel.send(`💀 **${currentChar.name}** was defeated by ${result.enemyName}!`);

    const embed = new EmbedBuilder().setTitle('Defeated').setDescription(desc).setColor(0xe74c3c)
      .setFooter({ text: `HP: 1/${result.playerMaxHp}` });
    await i.update({ embeds: [embed], components: [] });

  } else if (result.outcome === 'flee') {
    desc += '\n🏃 You escaped!';
    const embed = new EmbedBuilder().setTitle('Escaped').setDescription(desc).setColor(0xf39c12)
      .setFooter({ text: `HP: ${result.playerHp}/${result.playerMaxHp}` });
    await i.update({ embeds: [embed], components: [] });

    setTimeout(async () => {
      try {
        const updatedChar = realmStore.getCharacter(userId, guildId);
        const location = getLocation(updatedChar.current_location);
        if (!location || !canCall(userId) || !canGuildCall(guildId)) return;
        const raw = await generateExploration(updatedChar, location, null, null);
        recordCall(userId);
        incrementGuildDaily(guildId);
        const parsed = parseChoices(raw);
        const embed = buildExploreEmbed(location, parsed.narrative || raw, updatedChar);
        const components = buildExplorationButtons(parsed.choices);
        await interaction.editReply({ embeds: [embed], components });
      } catch {}
    }, 2000);

  } else {
    const embed = new EmbedBuilder()
      .setTitle(`Combat: ${result.enemyName}`)
      .setDescription(desc)
      .setColor(0xe91e8a);
    await i.update({ embeds: [embed], components: [buildCombatButtons()] });
  }
}

// ===== stats =====

async function handleStats(interaction) {
  const sheet = getCharacterSheet(interaction.user.id, interaction.guildId);
  if (!sheet) {
    return interaction.reply({ content: 'No character found. Use `/realm create` first.', flags: EPHEMERAL });
  }

  const s = sheet.stats;
  const embed = new EmbedBuilder()
    .setTitle(`${sheet.name} — Level ${sheet.level} ${capitalize(sheet.race)} ${capitalize(sheet.class)}`)
    .setDescription(sheet.backstory || 'No backstory.')
    .addFields(
      { name: 'HP', value: `${sheet.hp.current}/${sheet.hp.max}`, inline: true },
      { name: 'Gold', value: `${sheet.gold}`, inline: true },
      { name: 'XP', value: `${sheet.xp}`, inline: true },
      { name: 'STR', value: `${s.str}`, inline: true },
      { name: 'DEX', value: `${s.dex}`, inline: true },
      { name: 'CON', value: `${s.con}`, inline: true },
      { name: 'INT', value: `${s.int}`, inline: true },
      { name: 'WIS', value: `${s.wis}`, inline: true },
      { name: 'CHA', value: `${s.cha}`, inline: true },
      { name: 'Kills', value: `${sheet.kills}`, inline: true },
      { name: 'Locations', value: `${sheet.locations_discovered}`, inline: true },
    )
    .setColor(0x00e5ff);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

// ===== inventory =====

async function handleInventory(interaction) {
  const items = realmStore.getInventory(interaction.user.id, interaction.guildId);
  if (!items.length) {
    return interaction.reply({ content: 'Your inventory is empty.', flags: EPHEMERAL });
  }

  let page = 1;
  const paginated = paginateItems(items, page);

  const embed = buildInventoryEmbed(paginated);
  const components = buildInventoryButtons(paginated);

  await interaction.reply({ embeds: [embed], components, flags: EPHEMERAL });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && (i.customId === 'inv_prev' || i.customId === 'inv_next'),
    time: 60000,
  });

  collector.on('collect', async i => {
    if (i.customId === 'inv_next' && paginated.hasNext) page++;
    else if (i.customId === 'inv_prev' && paginated.hasPrev) page--;

    const freshItems = realmStore.getInventory(interaction.user.id, interaction.guildId);
    const p = paginateItems(freshItems, page);
    Object.assign(paginated, p);

    await i.update({ embeds: [buildInventoryEmbed(paginated)], components: buildInventoryButtons(paginated) });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}

function buildInventoryEmbed(p) {
  const lines = p.items.map(item => {
    let stats = '';
    try {
      const s = JSON.parse(item.stats || '{}');
      if (s.weaponBonus) stats = ` (+${s.weaponBonus} atk)`;
      if (s.defense) stats = ` (+${s.defense} def)`;
      if (s.healAmount) stats = ` (heals ${s.healAmount})`;
    } catch {}
    const equip = item.equipped ? ' ⚔️' : '';
    return `• **${item.name}** (${item.rarity} ${item.type})${stats}${equip} — ${item.value}g`;
  });

  return new EmbedBuilder()
    .setTitle(`Inventory (${p.totalItems} items)`)
    .setDescription(lines.join('\n') || 'Empty')
    .setFooter({ text: `Page ${p.page}/${p.totalPages}` })
    .setColor(0x2ecc71);
}

function buildInventoryButtons(p) {
  if (p.totalPages <= 1) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('inv_prev').setLabel('← Previous').setStyle(ButtonStyle.Secondary).setDisabled(!p.hasPrev),
    new ButtonBuilder().setCustomId('inv_next').setLabel('Next →').setStyle(ButtonStyle.Secondary).setDisabled(!p.hasNext),
  )];
}

// ===== quests =====

async function handleQuests(interaction) {
  const quests = realmStore.getActiveQuests(interaction.user.id, interaction.guildId);
  if (!quests.length) {
    return interaction.reply({ content: 'No active quests. Talk to NPCs to find quests!', flags: EPHEMERAL });
  }

  const lines = quests.map(q => {
    let objectives;
    try { objectives = JSON.parse(q.objectives); } catch { objectives = []; }
    const objText = objectives.map(o => {
      const done = (o.current || 0) >= (o.count || 1) ? '✅' : '⬜';
      return `  ${done} ${o.type} ${o.target} (${o.current || 0}/${o.count || 1})`;
    }).join('\n');
    return `**${q.title}**\n${q.description || ''}\n${objText}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Active Quests')
    .setDescription(lines.join('\n\n'))
    .setColor(0xf39c12);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

// ===== rest =====

async function handleRest(interaction) {
  const result = heal(interaction.user.id, interaction.guildId);
  if (result.error) {
    return interaction.reply({ content: result.error, flags: EPHEMERAL });
  }

  const embed = new EmbedBuilder()
    .setTitle('Rest')
    .setDescription(`You rest and recover **${result.healed}** HP.\n\nHP: ${result.hp.current}/${result.hp.max}`)
    .setColor(0x2ecc71);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

// ===== trade =====

async function handleTrade(interaction) {
  const partner = interaction.options.getUser('player');
  if (!partner) {
    return interaction.reply({ content: 'Specify a player to trade with.', flags: EPHEMERAL });
  }

  const check = canTrade(interaction.user.id, partner.id);
  if (!check.ok) {
    return interaction.reply({ content: check.error, flags: EPHEMERAL });
  }

  const result = startTrade(interaction.user.id, interaction.guildId, partner.id);
  if (!result.ok) {
    return interaction.reply({ content: result.error, flags: EPHEMERAL });
  }

  // Channel message for trade initiation
  return interaction.reply({
    content: `🤝 **${interaction.user.username}** initiated a trade with **${partner.username}**!`,
    flags: EPHEMERAL,
  });
}

// ===== delete =====

async function handleDelete(interaction) {
  const char = realmStore.getCharacter(interaction.user.id, interaction.guildId);
  if (!char) {
    return interaction.reply({ content: 'No character found.', flags: EPHEMERAL });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('del_confirm').setLabel(`Delete ${char.name}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('del_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({
    content: `⚠️ Are you sure you want to delete **${char.name}**? This cannot be undone.`,
    components: [row],
    flags: EPHEMERAL,
  });

  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('del_'),
    time: 30000,
  });

  collector.on('collect', async i => {
    if (i.customId === 'del_confirm') {
      realmStore.deleteCharacterCascade(interaction.user.id, interaction.guildId);
      await i.update({ content: `**${char.name}** has been deleted.`, components: [] });
      await interaction.channel.send(`🪦 **${char.name}** has been deleted from the Realm.`);
    } else {
      await i.update({ content: 'Deletion cancelled.', components: [] });
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}

// ===== leaderboard =====

async function handleLeaderboard(interaction) {
  const entries = realmStore.getLeaderboard(interaction.guildId, 10);
  if (!entries.length) {
    return interaction.reply({ content: 'No characters in this server yet.', flags: EPHEMERAL });
  }

  const lines = entries.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    return `${medal} **${e.name}** — Level ${e.level} (${e.xp} XP)`;
  });

  const embed = new EmbedBuilder()
    .setTitle('Leaderboard — Top 10')
    .setDescription(lines.join('\n'))
    .setColor(0xf39c12);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

// ===== help =====

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('Realm of Skarn — Commands')
    .setDescription('A persistent AI-driven RPG adventure.')
    .addFields(
      { name: '/realm create', value: 'Create a new character', inline: true },
      { name: '/realm start', value: 'Begin your journey', inline: true },
      { name: '/realm explore', value: 'Continue exploring', inline: true },
      { name: '/realm stats', value: 'View your character sheet', inline: true },
      { name: '/realm inventory', value: 'View your items', inline: true },
      { name: '/realm quests', value: 'View active quests', inline: true },
      { name: '/realm rest', value: 'Rest to recover 25% HP', inline: true },
      { name: '/realm trade @player', value: 'Trade with another player', inline: true },
      { name: '/realm delete', value: 'Delete your character', inline: true },
      { name: '/realm leaderboard', value: 'Top characters by level', inline: true },
      { name: '/realm help', value: 'Show this help', inline: true },
    )
    .setColor(0x00e5ff);

  return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
}

// ===== Main Router =====

module.exports = {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      switch (sub) {
        case 'create': return handleCreate(interaction);
        case 'start':
        case 'explore': return handleExplore(interaction);
        case 'stats': return handleStats(interaction);
        case 'inventory': return handleInventory(interaction);
        case 'quests': return handleQuests(interaction);
        case 'rest': return handleRest(interaction);
        case 'trade': return handleTrade(interaction);
        case 'delete': return handleDelete(interaction);
        case 'leaderboard': return handleLeaderboard(interaction);
        case 'help': return handleHelp(interaction);
        default:
          return interaction.reply({ content: 'Unknown subcommand.', flags: EPHEMERAL });
      }
    } catch (err) {
      console.error(`[REALM] ${sub} error:`, err.message, err.stack);
      const msg = 'Something went wrong. Try again.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, flags: EPHEMERAL }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: EPHEMERAL }).catch(() => {});
      }
    }
  },
};
