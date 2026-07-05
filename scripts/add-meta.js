const fs = require('fs');
const guides = ['beginners', 'code', 'event', 'faq', 'login', 'pvp', 'xp'];

guides.forEach(function(g) {
  var file = 'guide/' + g + '/index.html';
  var html = fs.readFileSync(file, 'utf8');
  var changes = 0;

  // 1. Add OG:locale after OG:url
  if (html.indexOf('og:locale') === -1) {
    html = html.replace('<meta property="og:url"', '<meta property="og:locale" content="en_US">\n    <meta property="og:url"');
    changes++;
  }

  // 2. Add OG:site_name after OG:locale
  if (html.indexOf('og:site_name') === -1) {
    html = html.replace('<meta property="og:locale"', '<meta property="og:site_name" content="Gem Rewards Calculator">\n    <meta property="og:locale"');
    changes++;
  }

  // 3. Add Twitter:site after Twitter:card
  if (html.indexOf('twitter:site') === -1) {
    html = html.replace('twitter:card" content="summary_large_image"', 'twitter:site" content="@InvincibleGtG">\n    <meta name="twitter:creator" content="@anomaly_alpha">\n    <meta name="twitter:card" content="summary_large_image"');
    changes++;
  }

  // 4. Add article:tag after OG:type
  if (html.indexOf('article:tag') === -1 && html.indexOf('"article"') > 0) {
    var tags = g === 'code' ? 'promo codes,gems,redeem,Ubisoft' :
               g === 'pvp' ? 'PvP,arenas,leagues,gems' :
               g === 'beginners' ? 'beginner guide,free gems,new players' :
               g === 'event' ? 'events,rankings,gems' :
               g === 'login' ? 'login rewards,daily bonus,gems' :
               g === 'faq' ? 'FAQ,questions,gems' :
               g === 'xp' ? 'XP,leveling,progression' : 'gems';
    html = html.replace('<meta property="article:published_time"', '<meta property="article:tag" content="' + tags + '">\n    <meta property="article:published_time"');
    changes++;
  }

  // 5. Ensure article:section exists
  if (html.indexOf('article:section') === -1) {
    html = html.replace('<meta property="article:tag"', '<meta property="article:section" content="Gaming Guides">\n    <meta property="article:tag"');
    changes++;
  }

  // 6. Add max-snippet to existing robots if only max-image-preview
  if (html.indexOf('max-snippet') === -1) {
    html = html.replace('content="max-image-preview:large"', 'content="max-snippet:150, max-image-preview:large"');
    changes++;
  }

  // 7. Ensure H1 heading is present and first heading
  var h1Count = (html.match(/<h1 /g) || []).length;
  if (h1Count === 0) {
    console.log('  WARN: No H1 in ' + g);
  }

  if (changes > 0) {
    fs.writeFileSync(file, html);
    console.log('OK guide/' + g + '/ - ' + changes + ' changes');
  } else {
    console.log('-- guide/' + g + '/ - no changes needed');
  }
});
