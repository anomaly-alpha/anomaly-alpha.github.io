// ===== CONDENSER =====
// Ported from README.md — reply condenser (offline + deterministic; gate mocked
// before require): under-target untouched, tool reply untouched, over-target uses gate output.
(() => {
  const client = require('../../ai/client');
  client.moderatedChatCompletion = async () => ({ success: true, completion: { choices: [{ message: { content: 'A short, tightened reply that keeps the point.' } }] } });
  const { condenseReply } = require('../../features/ai/condenser');   // require AFTER patch
  return (async () => {
    const long = await condenseReply('This is a deliberately long rambling reply that goes on and on about many things and never gets to the point quickly enough, and it keeps adding more and more unnecessary words until the reader loses interest entirely.', 200, 'consult', 'u', {});
    const short = await condenseReply('hi', 200, 'consult', 'u', {});
    const tool  = await condenseReply('b'.repeat(300), 200, 'consult', 'u', { usedTool: true });
    const all = {
      long: long.reply === 'A short, tightened reply that keeps the point.',
      short: short.reply === 'hi',
      tool: tool.reply.length === 300,
    };
    console.log('condense long uses gate output:', all.long);
    console.log('condense short unchanged:', all.short);
    console.log('condense tool unchanged:', all.tool);
    if (!(all.long && all.short && all.tool)) process.exitCode = 1;
  })();
})();