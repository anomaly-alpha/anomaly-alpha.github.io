// ===== guild membership log reader =====
// Prints the append-only join/leave record written by
// features/safety/guildAllowlist.js. Read-only.
//
//   node scripts/guild-membership-report.js [--limit N] [--guild <id>]

const { getRecentGuildEvents, getGuildMembershipHistory } = require('../db/guildMembership');

function parseArgs(argv) {
  const out = { limit: 50, guild: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit' && argv[i + 1]) out.limit = parseInt(argv[++i], 10) || 50;
    else if (argv[i] === '--guild' && argv[i + 1]) out.guild = argv[++i];
  }
  return out;
}

function pad(value, width) {
  const text = String(value == null ? '-' : value);
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

const args = parseArgs(process.argv.slice(2));
const rows = args.guild ? getGuildMembershipHistory(args.guild, args.limit) : getRecentGuildEvents(args.limit);

console.log('GUILD MEMBERSHIP LOG' + (args.guild ? ' — guild ' + args.guild : '') + ' (newest first, ' + rows.length + ' row(s))');
console.log('-'.repeat(96));
console.log(pad('WHEN (UTC)', 20) + pad('EVENT', 8) + pad('REASON', 22) + pad('MEMBERS', 9) + 'GUILD');
console.log('-'.repeat(96));

for (const row of rows) {
  const when = new Date(row.occurred_at).toISOString().slice(0, 19).replace('T', ' ');
  const name = row.guild_name ? row.guild_name + ' (' + row.guild_id + ')' : row.guild_id;
  console.log(pad(when, 20) + pad(row.event, 8) + pad(row.reason, 22) + pad(row.member_count, 9) + name);
}

if (!rows.length) {
  console.log('(no membership events recorded yet)');
  console.log('');
  console.log('The log starts at the first join or leave observed after this feature was deployed.');
}
