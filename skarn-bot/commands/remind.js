const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const remindersFile = path.join(__dirname, '..', 'data', 'reminders.json');

function loadReminders() {
  if (!fs.existsSync(remindersFile)) return [];
  return JSON.parse(fs.readFileSync(remindersFile, 'utf8'));
}

function saveReminders(data) {
  const dir = path.dirname(remindersFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(remindersFile, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addIntegerOption(option => option.setName('minutes').setDescription('Minutes from now').setRequired(true).setMinValue(1).setMaxValue(10080))
    .addStringOption(option => option.setName('message').setDescription('What to remind you about').setRequired(true)),
  async execute(interaction) {
    const minutes = interaction.options.getInteger('minutes');
    const message = interaction.options.getString('message');
    const reminders = loadReminders();

    const reminder = {
      userId: interaction.user.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      message,
      remindAt: Date.now() + minutes * 60 * 1000,
    };
    reminders.push(reminder);
    saveReminders(reminders);

    setTimeout(async () => {
      try {
        const channel = await interaction.client.channels.fetch(reminder.channelId);
        await channel.send(`<@${reminder.userId}> Reminder: **${message}**`);
        const current = loadReminders();
        const idx = current.findIndex(r => r.remindAt === reminder.remindAt && r.userId === reminder.userId);
        if (idx !== -1) current.splice(idx, 1);
        saveReminders(current);
      } catch {}
    }, minutes * 60 * 1000);

    await interaction.reply({ content: `I'll remind you in **${minutes}** minute(s): ${message}`, ephemeral: true });
  },
};
