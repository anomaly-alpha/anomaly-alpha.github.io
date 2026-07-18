// Thin wrapper — command definition and handler live in features/etch/
const command = require('../features/etch/etch.command');
const handler = require('../features/etch/etch.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
