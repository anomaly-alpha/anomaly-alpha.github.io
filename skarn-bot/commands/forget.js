// Thin wrapper — command definition and handler live in features/forget/
const command = require('../features/forget/forget.command');
const handler = require('../features/forget/forget.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
