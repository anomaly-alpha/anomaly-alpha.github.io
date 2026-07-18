const command = require('../features/search/search.command');
const handler = require('../features/search/search.handler');

module.exports = {
  data: command.data,
  execute: handler.execute,
};
