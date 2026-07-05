const fs = require('fs');
const path = require('path');
const guides = ['beginners', 'code', 'event', 'faq', 'login', 'pvp', 'xp'];

const guideNames = {
  beginners: 'New Players Guide',
  code: 'Codes Guide',
  event: 'Event Rewards Guide',
  faq: 'FAQ Guide',
  login: 'Login Rewards Guide',
  pvp: 'PvP Rewards Guide',
  xp: 'XP and Progression Guide'
};

guides.forEach(function(g) {
  var file = path.join('guide', g, 'index.html');
  var html = fs.readFileSync(file, 'utf8');

  var graphEnd = html.lastIndexOf('      ]');
  if (graphEnd > 0) {
    var name = guideNames[g];
    var url = 'https://anomaly-alpha.github.io/guide/' + g + '/';
    var insert = ',\n        {\n          "@type": "Guide",\n          "name": "Invincible Guarding the Globe ' + name + '",\n          "url": "' + url + '",\n          "about": { "@id": "#game" },\n          "author": { "@type": "Person", "name": "Anomaly" }\n        },\n        {\n          "@type": "DefinedTerm",\n          "name": "Gems",\n          "description": "Premium currency in Invincible Guarding the Globe used for hero upgrades, chest pulls, and premium items.",\n          "inDefinedTermSet": "' + url + '"\n        },\n        {\n          "@type": "DigitalDocument",\n          "name": "' + name + '",\n          "url": "' + url + '",\n          "author": { "@type": "Person", "name": "Anomaly", "url": "https://anomaly-alpha.github.io/authors/anomaly/" }\n        }';

    html = html.slice(0, graphEnd) + insert + html.slice(graphEnd);
    fs.writeFileSync(file, html);
    console.log('OK guide/' + g + '/index.html');
  } else {
    console.log('SKIP guide/' + g + '/');
  }
});
