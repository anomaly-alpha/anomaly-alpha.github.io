// Thin wrapper — command definition and handler live in features/consult/
const command = require('../features/consult/consult.command');
const handler = require('../features/consult/consult.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
