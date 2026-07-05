const fs = require('fs');
const guides = ['beginners', 'code', 'event', 'faq', 'login', 'pvp', 'xp'];

// tag sets per guide
const tagSets = {
  code: ['promo codes','gems','redeem','Ubisoft','free rewards','hero dossiers'],
  pvp: ['PvP','arenas','leagues','gems','trophies','rankings','pvp currency'],
  beginners: ['beginner guide','free gems','new players','starting tips','gem income'],
  event: ['events','rankings','gems','The Long Haul','Earth Defenders','event rewards'],
  login: ['login rewards','daily bonus','gems','weekly rewards','monthly rewards'],
  faq: ['FAQ','questions','gems','answers','help','game guide'],
  xp: ['XP','leveling','progression','hero XP','rank up','hero levels']
};

guides.forEach(function(g) {
  var file = 'guide/' + g + '/index.html';
  var html = fs.readFileSync(file, 'utf8');
  var changes = 0;

  // 1. Add multiple article:tag entries
  var tags = tagSets[g] || ['gems'];
  var tagHtml = '';
  tags.forEach(function(t) {
    var meta = '<meta property="article:tag" content="' + t + '">';
    if (html.indexOf(meta) === -1) {
      tagHtml += '    ' + meta + '\n';
    }
  });
  if (tagHtml) {
    // Insert after first existing article:tag  
    var tagMarker = '<meta property="article:section"';
    var idx = html.indexOf(tagMarker);
    if (idx > 0) {
      html = html.slice(0, idx) + tagHtml + html.slice(idx);
      changes++;
    }
  }

  // 2. Add link rel="author" in head
  var authorLink = '<link rel="author" href="https://anomaly-alpha.github.io/authors/anomaly/">';
  if (html.indexOf('rel="author"') === -1) {
    html = html.replace('<link rel="canonical"', authorLink + '\n    <link rel="canonical"');
    changes++;
  }

  // 3. Add DNS prefetch for external resources
  var dnsPrefetch = '<link rel="dns-prefetch" href="https://redeem.invincible.ubisoft.barcelona">';
  if (html.indexOf('dns-prefetch') === -1) {
    html = html.replace('<link rel="preload"', dnsPrefetch + '\n    <link rel="preload"');
    changes++;
  }

  // 4. Add more visible date on guide body
  var dateBadge = '<meta name="date" content="2026-07-05">';
  if (html.indexOf('name="date"') === -1) {
    html = html.replace('<link rel="icon"', dateBadge + '\n    <link rel="icon"');
    changes++;
  }

  // 5. Add alternate tag for mobile
  var mediaTag = '<meta name="mobile-web-app-capable" content="yes">';
  if (html.indexOf('mobile-web-app') === -1) {
    html = html.replace('<meta name="robots"', mediaTag + '\n    <meta name="robots"');
    changes++;
  }

  if (changes > 0) {
    fs.writeFileSync(file, html);
    console.log('guide/' + g + '/ - ' + changes + ' changes');
  }
});
