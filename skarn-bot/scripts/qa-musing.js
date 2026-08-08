// ===== QA: Live musing voice check =====
// Fires N REAL musings through generateMusing (real moderatedChatCompletion
// calls — no stubs) and prints each one with the seed it was grounded on.
// Purpose: read Skarn's actual musing voice and tune roles.musing.
//
// Usage (from skarn-bot/):
//   node scripts/qa-musing.js [count] [guildId]
//   - count: how many musings to generate (default 5)
//   - guildId: any guild id — only used for guild-local seed + rate bucket
//     (default 'g1'; chronicle/signals are absent in dev DBs, so musings are
//     the news+history diad, which is fine for voice QA)
//
// Requires: real OPENAI_API_KEY (loaded from .env via dotenv).

require('dotenv').config();
const { generateMusing, assembleSeed } = require('../features/presence/musingEngine');

const count = parseInt(process.argv[2], 10) || 5;
const guildId = process.argv[3] || 'g1';

async function main() {
  console.log(`[QA-musing] ${count} real musings for guild ${guildId}\n`);
  for (let i = 1; i <= count; i++) {
    const seed = assembleSeed(guildId);
    console.log(`--- Musing ${i}/${count} ---`);
    if (seed.news) console.log(`seed news   : ${seed.news.headline}`);
    if (seed.history) console.log(`seed memory : ${seed.history.slice(0, 90)}...`);
    if (seed.server) console.log(`seed server : ${seed.server.slice(0, 90)}...`);
    const text = await generateMusing(guildId, 'musing:' + guildId);
    if (text === null) {
      console.log('(gate blocked or generation failed — no output)\n');
      continue;
    }
    console.log(`MUSING: ${text}\n`);
  }
  console.log('[QA-musing] done.');
}

main().catch(e => {
  console.error('[QA-musing] error:', e.message);
  process.exit(1);
});
