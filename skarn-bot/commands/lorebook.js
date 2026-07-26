const command = require('../features/lorebook/lorebook.command');
const handler = require('../features/lorebook/lorebook.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
