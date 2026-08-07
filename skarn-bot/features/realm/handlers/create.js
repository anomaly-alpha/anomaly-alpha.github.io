const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCharacter } = require('../character');
const { generateBackstory } = require('../aiDriver');
const realmStore = require('../realmStore');
const { tryReserve } = require('../realmRateLimit');
const { RACE_BONUSES, CLASS_STATS } = require('../realmConfig');
const { capitalize, EPHEMERAL } = require('./ui');

// ===== create =====

async function handleCreate(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!interaction.channel) {
    return interaction.reply({
      content: 'This command must be used in a server channel.',
      flags: EPHEMERAL,
      allowedMentions: { parse: ['users'] },
    });
  }

  const existing = realmStore.getCharacter(userId, guildId);
  if (existing) {
    return interaction.reply({
      content: `You already have **${existing.name}**. Use \`/realm delete\` first.`,
      flags: EPHEMERAL,
      allowedMentions: { parse: ['users'] },
    });
  }

  // Step 1: Name
  console.log('[REALM] create: waiting for name input from', userId);
  await interaction.reply({ content: '**Step 1/5** — What shall your character be called?', flags: EPHEMERAL, allowedMentions: { parse: ['users'] } });

  const nameMsg = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId && !m.author.bot,
    max: 1, time: 60000, errors: ['time'],
  }).catch(e => { console.error('[REALM] awaitMessages error:', e.message); return null; });

  console.log('[REALM] create: nameMsg received:', !!nameMsg);
  if (!nameMsg) return interaction.editReply({ content: 'Timed out. Try `/realm create` again.', allowedMentions: { parse: ['users'] } });
  const charName = nameMsg.first().content.trim();
  await nameMsg.first().delete().catch(() => {});
  if (charName.length < 2 || charName.length > 32) {
    return interaction.editReply({ content: 'Name must be 2-32 characters. Try `/realm create` again.', allowedMentions: { parse: ['users'] } });
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
  await interaction.editReply({ content: `**Step 2/5** — Choose a race for **${charName}**:`, components: raceComponents, allowedMentions: { parse: ['users'] } });

  const raceInter = await interaction.channel.awaitMessageComponent({
    filter: i => i.user.id === userId && i.customId.startsWith('race_'),
    time: 60000,
  }).catch(() => null);

  if (!raceInter) return interaction.editReply({ content: 'Timed out.', components: [], allowedMentions: { parse: ['users'] } });
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
  await interaction.editReply({ content: `**Step 3/5** — Choose a class for **${charName}**:`, components: classComponents, allowedMentions: { parse: ['users'] } });

  const classInter = await interaction.channel.awaitMessageComponent({
    filter: i => i.user.id === userId && i.customId.startsWith('class_'),
    time: 60000,
  }).catch(() => null);

  if (!classInter) return interaction.editReply({ content: 'Timed out.', components: [], allowedMentions: { parse: ['users'] } });
  const selectedClass = classInter.customId.replace('class_', '');
  await classInter.update({ content: `Class: **${capitalize(selectedClass)}** ✓`, components: [] });

  // Step 4: Background
  await interaction.editReply({ content: '**Step 4/5** — Tell me about your character\'s background. What drove them to the Realm of Skarn?',
    components: [],
    allowedMentions: { parse: ['users'] },
  });

  const bgMsg = await interaction.channel.awaitMessages({
    filter: m => m.author.id === userId && !m.author.bot,
    max: 1, time: 60000, errors: ['time'],
  }).catch(() => null);

  if (!bgMsg) return interaction.editReply({ content: 'Timed out.', allowedMentions: { parse: ['users'] } });
  const bgAnswer = bgMsg.first().content.trim();
  await bgMsg.first().delete().catch(() => {});

  // Step 5: AI Backstory
  if (!tryReserve(userId, guildId)) {
    return interaction.editReply({ content: 'The realm is overwhelmed. Try again in a moment.', allowedMentions: { parse: ['users'] } });
  }

  await interaction.editReply({ content: '**Step 5/5** — Skarn is weaving your destiny...', allowedMentions: { parse: ['users'] } });

  let backstory;
  try {
    backstory = await generateBackstory({ name: charName, race: selectedRace, class: selectedClass, user_id: userId }, bgAnswer);
  } catch {
    backstory = `${charName} arrived at the Abyssal Gate with nothing but a blade and a burning will to survive.`;
  }

  const storyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('story_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('story_reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({ content: `**Your Backstory:**\n${backstory}`, components: [storyRow], allowedMentions: { parse: ['users'] } });

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
    await interaction.editReply({ content: 'Using default backstory...', components: [], allowedMentions: { parse: ['users'] } });
    backstory = `${charName} arrived at the Abyssal Gate with nothing but a blade and a burning will to survive.`;
  }

  const result = createCharacter(userId, guildId, charName, selectedRace, selectedClass, backstory);
  if (result.error) return interaction.editReply({ content: `Error: ${result.error}`, allowedMentions: { parse: ['users'] } });

  // Channel message for major event
  await interaction.channel.send({
    content: `⚔️ **${charName}** the **${capitalize(selectedRace)} ${capitalize(selectedClass)}** has entered the Realm of Skarn!\n\n*${backstory}*`,
    allowedMentions: { parse: ['users'] },
  });
  return interaction.editReply({ content: `✅ Character **${charName}** created! Use \`/realm start\` to begin.`, components: [], allowedMentions: { parse: ['users'] } });
}

module.exports = { handleCreate };