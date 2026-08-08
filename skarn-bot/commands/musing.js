const { SlashCommandBuilder } = require('discord.js');
const { generateMusing, setNextMusing } = require('../features/presence/musingEngine');
const { getAppState } = require('../db/database');

const MIN_NEXT_MS = 24 * 60 * 60 * 1000; // double-fire guard: no ambient musing the same day

async function shareMusing(target, senderId, replyFn) {
  const content = await generateMusing(target.guild.id, senderId);
  if (!content) {
    return replyFn({ content: "The words won't come. Try again in a moment.", allowedMentions: { parse: ['users'] } });
  }
  // [S7.4] push the ambient timer out (max, never overwrite so the next fire
  // comes sooner) - a commanded musing isn't echoed by the tick the same day.
  const existing = parseInt(getAppState('musing_next:' + target.guild.id), 10) || 0;
  setNextMusing(target.guild.id, Math.max(existing, Date.now() + MIN_NEXT_MS));
  return replyFn({ content: content, allowedMentions: { parse: ['users'] } });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musing')
    .setDescription('Skarn shares a reflection - something recent brushing against something ancient'),
  async execute(interaction) {
    await interaction.deferReply();
    if (!interaction.guild || !interaction.channel) {
      return interaction.editReply({ content: 'This command works in a server channel.', allowedMentions: { parse: ['users'] } });
    }
    await shareMusing(interaction, interaction.user.id, opts => interaction.editReply(opts));
  },
  async handleActivation(message, args) {
    if (!message.guild || !message.channel) {
      return message.reply({ content: 'This command works in a server channel.', allowedMentions: { parse: ['users'] } });
    }
    await shareMusing(message, message.author.id, opts => message.reply(opts));
  },
  activation: {
    type: 'command',
    phrase: 'skarn musing',
    aliases: ['muse', 'reflect', 'contemplate'],
    description: 'Skarn shares a grounded, in-voice reflection',
    guildOnly: false,
    requiredPermissions: [],
    parseArgs: function() { return {}; },
  },
};
