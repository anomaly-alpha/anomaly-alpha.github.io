const command = require('../features/serverMemory/omen/omen.command');
const { handleOmen } = require('../features/serverMemory/omen/omenCommand');

module.exports = {
  data: command.data,
  async execute(interaction) {
    await handleOmen(interaction);
  },
};
