const command = require('../features/serverMemory/chronicle/chronicle.command');
const { handleChronicle } = require('../features/serverMemory/chronicle/chronicleCommand');

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleChronicle(interaction);
  },
};
