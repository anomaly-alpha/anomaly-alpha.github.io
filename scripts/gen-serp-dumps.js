const fs = require('fs');
const path = require('path');
const dir = 'serp-dumps/2026-07-05/queries';

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 40 queries with GSC data + top competitors
const queries = [
  { file: 'promo-codes.txt', q: 'invincible guarding the globe promo codes', r: 10, imps: 159, cls: 6, competitors: ['Destructoid.com (DA~80)', 'VG247.com (DA~85)', 'PocketTactics.com (DA~70)', 'ProGameGuides.com (DA~75)', 'Ubisoft Help Center', 'AxeeTech.com', 'MinuteTactics.com', 'MobileMatters.gg', 'SuperCheats.com (DA~65)'] },
  { file: 'invincible-codes.txt', q: 'invincible codes', r: 10, imps: 193, cls: 4, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'SuperCheats'] },
  { file: 'new-codes.txt', q: 'new invincible codes', r: 8, imps: 124, cls: 8, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'MobileMatters'] },
  { file: 'invincible-promo-code.txt', q: 'invincible promo code', r: 7, imps: 72, cls: 2, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'SuperCheats'] },
  { file: 'gtg-promo-codes.txt', q: 'invincible guarding the globe promo codes (long)', r: 10, imps: 140, cls: 3, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'AxeeTech'] },
  { file: 'gtg-codes.txt', q: 'invincible guarding the globe codes', r: 15, imps: 118, cls: 6, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'SuperCheats', 'Ubisoft Help'] },
  { file: 'invincible-code.txt', q: 'invincible code', r: 13, imps: 53, cls: 2, competitors: ['Destructoid', 'VG247', 'SuperCheats', 'GameRant'] },
  { file: 'new-gtg-codes.txt', q: 'new invincible guarding the globe codes', r: 8, imps: 42, cls: 2, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'MobileMatters'] },
  { file: 'promo-codes-for-gtg.txt', q: 'promo codes for invincible guarding the globe', r: 10, imps: 35, cls: 0, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides'] },
  { file: 'game-promo-code.txt', q: 'invincible game promo code', r: 10, imps: 27, cls: 0, competitors: ['Destructoid', 'VG247', 'SuperCheats'] },
  { file: 'invincible-new-code.txt', q: 'invincible new code', r: 7, imps: 12, cls: 0, competitors: ['Destructoid', 'VG247', 'Pocket Tactics'] },
  { file: 'summer-code.txt', q: 'summer code invincible guarding the globe', r: 11, imps: 13, cls: 0, competitors: ['Destructoid', 'Pro Game Guides', 'Moyens.net'] },
  { file: 'gtg-codes-colon.txt', q: 'invincible: guarding the globe codes', r: 18, imps: 17, cls: 2, competitors: ['Destructoid', 'VG247', 'Pocket Tactics'] },
  { file: 'code-invincible.txt', q: 'code invincible', r: 9, imps: 14, cls: 2, competitors: ['Destructoid', 'VG247', 'SuperCheats'] },
  { file: 'redeem-code.txt', q: 'invincible redeem code', r: 8, imps: 45, cls: 3, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247', 'Pocket Tactics'] },
  { file: 'redeem-codes.txt', q: 'invincible redeem codes', r: 8, imps: 64, cls: 2, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247'] },
  { file: 'redeem-barcelona.txt', q: 'redeem invincible ubisoft barcelona', r: 9, imps: 69, cls: 2, competitors: ['Ubisoft Help Center', 'Facebook/InvincibleGtG', 'Threads/skyboundgames'] },
  { file: 'ubisoft-redeem.txt', q: 'ubisoft invincible redeem code', r: 8, imps: 67, cls: 2, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247'] },
  { file: 'gtg-redeem.txt', q: 'invincible guarding the globe redeem', r: 8, imps: 49, cls: 2, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247'] },
  { file: 'code-redeem-barcelona.txt', q: 'invincible code redeem barcelona', r: 7, imps: 24, cls: 2, competitors: ['Ubisoft Help Center', 'Destructoid'] },
  { file: 'gtg-code-redeem.txt', q: 'invincible guarding the globe code redeem', r: 23, imps: 5, cls: 2, competitors: ['Ubisoft Help Center', 'Destructoid'] },
  { file: 'barcelona-code.txt', q: 'invincible barcelona code', r: 4, imps: 3, cls: 2, competitors: ['Ubisoft Help Center', 'Facebook/InvincibleGtG'] },
  { file: 'invincible-redeemer.txt', q: 'invincible redeemer', r: 7, imps: 13, cls: 0, competitors: ['Ubisoft Help Center', 'Destructoid', 'SuperCheats'] },
  { file: 'barcelona-redeem.txt', q: 'barcelona invincible redeem', r: 7, imps: 17, cls: 0, competitors: ['Ubisoft Help Center', 'Destructoid'] },
  { file: 'gem-calculator.txt', q: 'invincible guarding the globe gems calculator', r: 1, imps: 88, cls: 5, competitors: ['The-Invincibles.netlify.app', 'Ubisoft Help Center', 'MuMuPlayer.com', 'LDPlayer.net'] },
  { file: 'gtg-calculator.txt', q: 'invincible gtg calculator', r: 3, imps: 88, cls: 5, competitors: ['The-Invincibles.netlify.app', 'ChaptersCheats.com'] },
  { file: 'xp-calculator.txt', q: 'invincible gtg xp calculator', r: 6, imps: 60, cls: 0, competitors: ['The-Invincibles.netlify.app', 'Ubisoft Help Center', 'MuMuPlayer.com', 'LDPlayer.net'] },
  { file: 'calculator.txt', q: 'invincible calculator', r: 5, imps: 18, cls: 0, competitors: ['The-Invincibles.netlify.app', 'Ubisoft Help Center'] },
  { file: 'free-gems.txt', q: 'invincible guarding the globe free gems', r: 10, imps: 2, cls: 2, competitors: ['VG247', 'Pocket Tactics', 'Destructoid', 'AxeeTech', 'MobileMatters', 'MinuteTactics', 'SuperCheats', 'Moyens.net'] },
  { file: 'gtg-gems.txt', q: 'invincible guarding the globe gems', r: 6, imps: 12, cls: 2, competitors: ['VG247', 'Destructoid', 'Pocket Tactics', 'Ubisoft Help Center', 'MuMuPlayer'] },
  { file: 'invincible-gem.txt', q: 'invincible gem', r: 4, imps: 23, cls: 0, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247', 'MuMuPlayer', 'LDPlayer'] },
  { file: 'how-to-get-gems.txt', q: 'how to get gems in invincible guarding the globe', r: 7, imps: 18, cls: 0, competitors: ['Ubisoft Help Center', 'MuMuPlayer', 'LDPlayer', 'GamingonPhone'] },
  { file: 'gtg-promo-singular.txt', q: 'invincible guarding the globe promo code', r: 10, imps: 50, cls: 0, competitors: ['Destructoid', 'VG247', 'Pocket Tactics', 'Pro Game Guides', 'AxeeTech'] },
  { file: 'code-redeem.txt', q: 'invincible code redeem', r: 10, imps: 39, cls: 0, competitors: ['Ubisoft Help Center', 'Destructoid', 'VG247'] },
  { file: 'invincible-pvp.txt', q: 'invincible pvp', r: 7, imps: 26, cls: 0, competitors: ['Ubisoft Help Center', 'Pocket Tactics', 'GamingonPhone'] },
  { file: 'pvp-guide.txt', q: 'invincible guarding the globe pvp guide', r: 5, imps: 5, cls: 0, competitors: ['Ubisoft Help Center', 'GamingonPhone'] },
  { file: 'event-guide.txt', q: 'invincible guarding the globe event guide', r: 7, imps: 5, cls: 0, competitors: ['Ubisoft Help Center', 'GamingonPhone'] },
  { file: 'gtg-guide.txt', q: 'invincible guarding the globe guide', r: 8, imps: 10, cls: 0, competitors: ['GamingonPhone', 'LDPlayer', 'Pocket Tactics', 'Ubisoft Help Center'] },
  { file: 'beginner-guide.txt', q: 'invincible guarding the globe beginner guide', r: 7, imps: 18, cls: 4, competitors: ['GamingonPhone', 'LDPlayer', 'PocketGamer.com', 'AppsMenow.com'] },
  { file: 'login-guide.txt', q: 'invincible guarding the globe login rewards', r: 7, imps: 2, cls: 1, competitors: ['Ubisoft Help Center', 'MuMuPlayer', 'LDPlayer'] }
];

queries.forEach(function(q) {
  var header = 'SERP Query: ' + q.q + '\n' +
    'Date: 2026-07-05\n' +
    'Our Rank: ~#' + q.r + '\n' +
    'GSC Clicks: ' + q.cls + '\n' +
    'GSC Impressions: ' + q.imps + '\n' +
    '='.repeat(60) + '\n\n' +
    'Top Competitors:\n' +
    '---------------\n';
  q.competitors.forEach(function(c, i) {
    header += '  ' + (i + 1) + '. ' + c + '\n';
  });
  header += '\n---\nOur site: https://anomaly-alpha.github.io/\nAnomaly SERP Dump — 2026-07-05\n';
  fs.writeFileSync(path.join(dir, q.file), header);
  console.log('Created ' + q.file);
});

console.log('Done — ' + queries.length + ' query dumps created');
