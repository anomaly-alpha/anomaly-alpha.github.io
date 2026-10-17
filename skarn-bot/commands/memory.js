const command = require('../features/memory/memory.command');
const handler = require('../features/memory/memory.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
