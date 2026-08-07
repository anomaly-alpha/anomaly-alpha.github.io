const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addXp } = require('../character');
const { getLocation, getConnectedLocations, moveTo, parseChoices } = require('../world');
const { rollEnemy, startCombat, processCombatRound, getCombatState } = require('../combat');
const { generateLoot, equipBest } = require('../inventory');
const { canAcceptQuest, createQuest, checkQuestProgress } = require('../quest');
const { generateNpc, handleNpcInteraction } = require('../npc');
const { generateExploration, generateQuestHook } = require('../aiDriver');
const realmStore = require('../realmStore');
const { tryReserve } = require('../realmRateLimit');
const { checkCooldown, setCooldown } = require('../../../db/database');
const { randomError, EPHEMERAL } = require('./ui');

// ===== Build Helpers =====

function buildExplorationButtons(choices) {
  if (!choices || choices.length === 0) return [];
  return [new ActionRowBuilder().addComponents(
    choices.slice(0, 4).map((c, i) =>
      new ButtonBuilder().setCustomId(`exp_${i}`).setLabel(`${c.index}. ${c.text}`.substring(0, 80)).setStyle(ButtonStyle.Primary)
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

// ===== start / explore =====

async function handleExplore(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const char = realmStore.getCharacter(userId, guildId);
  if (!char) {
    return interaction.reply({ content: 'No character found. Use `/realm create` first.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  // Re-enter combat if already in one
  const combatState = getCombatState(userId, guildId);
  if (combatState) {
    const combatEmbed = buildCombatEmbed(combatState.enemy, char.hp_current, char.hp_max);
    return interaction.reply({ embeds: [combatEmbed], components: [buildCombatButtons()], flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }

  const key = 'realm:' + interaction.guildId + ':' + interaction.user.id;
  if (checkCooldown(key)) return interaction.reply({ content: 'You already have a realm action in progress.', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  setCooldown(key, 30000);

  try {
    await interaction.deferReply();

    const location = getLocation(char.current_location);
    if (!location) return interaction.editReply({ content: 'Unknown location. Try `/realm start` again.', allowedMentions: { parse: ['users'] } });

    if (!tryReserve(userId, guildId)) {
      return interaction.editReply({ content: 'The realm is overwhelmed. Try again in a moment.', allowedMentions: { parse: ['users'] } });
    }

    const activeQuests = realmStore.getActiveQuests(userId, guildId);
    const quest = activeQuests[0] || null;

    const sceneHistory = []; // tracks turns for AI context
    const rawText = await generateExploration(char, location, quest, sceneHistory);
    sceneHistory.push({ role: 'assistant', content: rawText });

    const { narrative, choices } = parseChoices(rawText);
    const choiceTexts = choices.map(c => c.text);

    const embed = buildExploreEmbed(location, narrative || rawText, char);
    const components = buildExplorationButtons(choices);

    await interaction.editReply({ embeds: [embed], components, allowedMentions: { parse: ['users'] } });

    // ready for button clicks

    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === userId, time: 120000,
    });

    collector.on('collect', async i => {
      if (checkCooldown(key)) {
        await i.reply({ content: 'Still processing...', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } }).catch(() => {});
        return;
      }
      setCooldown(key, 30000);

      try {
        if (i.customId.startsWith('combat_')) {
          await handleCombatButton(i, userId, guildId, key, collector, interaction, sceneHistory);
        } else if (i.customId.startsWith('exp_')) {
          await handleExploreChoice(i, userId, guildId, key, char, quest, choiceTexts, collector, interaction, sceneHistory);
        }
      } catch (err) {
        console.error('Explore collector error:', err);
        try { await i.editReply({ content: randomError(), allowedMentions: { parse: ['users'] } }); } catch {}
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [], allowedMentions: { parse: ['users'] } }).catch(() => {});
    });

  } catch (err) {
    console.error('Explore error:', err);
    const msg = randomError();
    if (interaction.deferred) await interaction.editReply({ content: msg, allowedMentions: { parse: ['users'] } });
    else await interaction.reply({ content: msg, flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });
  }
}

// ===== Explore Button Handler =====

async function handleExploreChoice(i, userId, guildId, key, char, quest, choiceTexts, collector, interaction, sceneHistory) {
  await i.deferUpdate().catch(() => {});
  const idx = parseInt(i.customId.replace('exp_', ''), 10);
  const choiceText = choiceTexts[idx] || '';

  sceneHistory.push({ role: 'user', content: choiceText });

  const currentChar = realmStore.getCharacter(userId, guildId);
  if (!currentChar) {
    await i.editReply({ content: 'Your character no longer exists.', embeds: [], components: [], allowedMentions: { parse: ['users'] } });
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
    if (moveResult.error) return i.editReply({ content: moveResult.error, allowedMentions: { parse: ['users'] } });

    checkQuestProgress(userId, guildId, 'explore', matchedLoc.id);

    if (!tryReserve(userId, guildId)) {
      return i.editReply({ content: 'The realm is overwhelmed. Try again.', allowedMentions: { parse: ['users'] } });
    }

    const updatedChar = realmStore.getCharacter(userId, guildId);
    try {
      const raw = await generateExploration(updatedChar, moveResult.location, quest, sceneHistory);
      sceneHistory.push({ role: 'assistant', content: raw });

      const parsed = parseChoices(raw);
      choiceTexts.length = 0;
      choiceTexts.push(...parsed.choices.map(c => c.text));

      const embed = buildExploreEmbed(moveResult.location, parsed.narrative || raw, updatedChar);
      const components = buildExplorationButtons(parsed.choices);
      await i.editReply({ embeds: [embed], components, allowedMentions: { parse: ['users'] } });
    } catch {
      await i.editReply({ content: randomError(), embeds: [], components: [], allowedMentions: { parse: ['users'] } });
    }
  } else if (matchedNpc) {
    const npc = generateNpc(matchedNpc, currentChar.current_location);
    const npcResult = await handleNpcInteraction(userId, guildId, npc, currentChar, choiceText);

    let text = `**${npc.name}:** "${npcResult.dialogue}"`;

    if (npc.role === 'quest_giver' && canAcceptQuest(userId, guildId)) {
      if (tryReserve(userId, guildId)) {
        try {
          const hookText = await generateQuestHook(npc, currentChar, currentLocation);

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

    await i.editReply({ embeds: [embed], components: [], allowedMentions: { parse: ['users'] } });
  } else if (triggersCombat || Math.random() < 0.12 * (currentLocation.dangerLevel || 1)) {
    const enemy = rollEnemy(currentLocation.dangerLevel || 1);
    const combatResult = startCombat(userId, guildId, enemy, currentChar.current_location);
    if (combatResult.error) return i.editReply({ content: combatResult.error, allowedMentions: { parse: ['users'] } });

    // Channel message for combat
    await interaction.channel.send({ content: `⚔️ **${currentChar.name}** encounters a **${enemy.name}** (Lv.${enemy.level})!`, allowedMentions: { parse: ['users'] } });

    const combatEmbed = buildCombatEmbed(enemy, combatResult.playerHp, combatResult.playerMaxHp);
    await i.editReply({ embeds: [combatEmbed], components: [buildCombatButtons()], allowedMentions: { parse: ['users'] } });
  } else {
    // Free action — new scene
    if (!tryReserve(userId, guildId)) {
      return i.editReply({ content: 'The realm is overwhelmed. Try again.', allowedMentions: { parse: ['users'] } });
    }

    try {
      const raw = await generateExploration(currentChar, currentLocation, quest, [{ role: 'user', content: choiceText }]);

      const parsed = parseChoices(raw);
      choiceTexts.length = 0;
      choiceTexts.push(...parsed.choices.map(c => c.text));

      const embed = buildExploreEmbed(currentLocation, parsed.narrative || raw, currentChar);
      const components = buildExplorationButtons(parsed.choices);
      await i.editReply({ embeds: [embed], components, allowedMentions: { parse: ['users'] } });
    } catch {
      await i.editReply({ content: randomError(), embeds: [], components: [], allowedMentions: { parse: ['users'] } });
    }
  }
}

// ===== Combat Button Handler =====

async function handleCombatButton(i, userId, guildId, key, collector, interaction) {
  await i.deferUpdate().catch(() => {});
  const action = i.customId.replace('combat_', '');
  const currentChar = realmStore.getCharacter(userId, guildId);
  if (!currentChar) {
    await i.editReply({ content: 'Your character no longer exists.', embeds: [], components: [], allowedMentions: { parse: ['users'] } });
    collector.stop();
    return;
  }

  const result = await processCombatRound(userId, guildId, action, action === 'defend');
  if (result.error) return i.editReply({ content: result.error, allowedMentions: { parse: ['users'] } });

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
      await interaction.channel.send({ content: `🎉 **${currentChar.name}** leveled up to **Level ${xpResult.level}**!`, allowedMentions: { parse: ['users'] } });
    }

    const loot = generateLoot(getLocation(currentChar.current_location)?.dangerLevel || 1, currentChar.luck);
    if (loot) {
      realmStore.addItem(userId, guildId, loot.itemId, loot.name, loot.type, loot.description, loot.rarity, loot.stats, loot.value);
      desc += `\n\nFound: **${loot.name}** (${loot.rarity} ${loot.type})`;
      if (loot.rarity === 'legendary') {
        await interaction.channel.send({ content: `✨ **${currentChar.name}** found a legendary item: **${loot.name}**!`, allowedMentions: { parse: ['users'] } });
      }
    }

    equipBest(userId, guildId);

    const embed = new EmbedBuilder().setTitle('Combat Victory').setDescription(desc).setColor(0x2ecc71)
      .setFooter({ text: `HP: ${result.playerHp}/${result.playerMaxHp} | Gold: ${currentChar.gold + result.goldGained}` });
    await i.editReply({ embeds: [embed], components: [], allowedMentions: { parse: ['users'] } });

    setTimeout(async () => {
      try {
        const updatedChar = realmStore.getCharacter(userId, guildId);
        const location = getLocation(updatedChar.current_location);
        if (!location || !tryReserve(userId, guildId)) return;
        const raw = await generateExploration(updatedChar, location, null, null);
        const parsed = parseChoices(raw);
        const embed = buildExploreEmbed(location, parsed.narrative || raw, updatedChar);
        const components = buildExplorationButtons(parsed.choices);
        await interaction.editReply({ embeds: [embed], components, allowedMentions: { parse: ['users'] } });
      } catch {}
    }, 2000);

  } else if (result.outcome === 'defeat') {
    desc += `\n💀 **Defeated!** Lost ${result.goldLost} gold.`;
    await interaction.channel.send({ content: `💀 **${currentChar.name}** was defeated by ${result.enemyName}!`, allowedMentions: { parse: ['users'] } });

    const embed = new EmbedBuilder().setTitle('Defeated').setDescription(desc).setColor(0xe74c3c)
      .setFooter({ text: `HP: 1/${result.playerMaxHp}` });
    await i.editReply({ embeds: [embed], components: [], allowedMentions: { parse: ['users'] } });

  } else if (result.outcome === 'flee') {
    desc += '\n🏃 You escaped!';
    const embed = new EmbedBuilder().setTitle('Escaped').setDescription(desc).setColor(0xf39c12)
      .setFooter({ text: `HP: ${result.playerHp}/${result.playerMaxHp}` });
    await i.editReply({ embeds: [embed], components: [], allowedMentions: { parse: ['users'] } });

    setTimeout(async () => {
      try {
        const updatedChar = realmStore.getCharacter(userId, guildId);
        const location = getLocation(updatedChar.current_location);
        if (!location || !tryReserve(userId, guildId)) return;
        const raw = await generateExploration(updatedChar, location, null, null);
        const parsed = parseChoices(raw);
        const embed = buildExploreEmbed(location, parsed.narrative || raw, updatedChar);
        const components = buildExplorationButtons(parsed.choices);
        await interaction.editReply({ embeds: [embed], components, allowedMentions: { parse: ['users'] } });
      } catch {}
    }, 2000);

  } else {
    const embed = new EmbedBuilder()
      .setTitle(`Combat: ${result.enemyName}`)
      .setDescription(desc)
      .setColor(0xe91e8a);
    await i.editReply({ embeds: [embed], components: [buildCombatButtons()], allowedMentions: { parse: ['users'] } });
  }
}

module.exports = { handleExplore };