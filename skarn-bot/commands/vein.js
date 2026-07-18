// Thin wrapper — command definition and handler live in features/vein/
const command = require('../features/vein/vein.command');
const handler = require('../features/vein/vein.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
