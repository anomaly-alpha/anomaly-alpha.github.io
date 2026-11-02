'use strict';

var assert = require('assert');
var audit = require('../scripts/audit-youtube-creators');
var channelId = 'UC1234567890123456789012';

assert.strictEqual(audit.extractChannelId('<meta itemprop="channelId" content="' + channelId + '">'), channelId);
assert.strictEqual(audit.extractChannelId('{"externalId":"' + channelId + '"}'), channelId);
assert.strictEqual(audit.extractChannelId('<link rel="canonical" href="https://www.youtube.com/channel/' + channelId + '">'), channelId);
assert.strictEqual(audit.extractChannelId('<html></html>'), null);

function channelPage(id, lockups) {
  var initial = {
    contents: lockups.map(function (lockup) {
      return { lockupViewModel: { contentId: lockup.id, metadata: { lockupMetadataViewModel: lockup.meta } } };
    })
  };
  return '<html><head><link rel="canonical" href="https://www.youtube.com/channel/' + id + '">' +
    '<meta itemprop="channelId" content="' + id + '"></head><body>' +
    '<script>var ytInitialData = ' + JSON.stringify(initial) + ';</script></body></html>';
}

var freshMeta = {
  title: { content: 'GTG & more' },
  metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: '12K views' } }, { text: { content: '2 days ago' } }] }] } }
};
var knownMeta = { title: { content: 'Already listed' } };

var page = audit.extractChannelVideos(channelPage(channelId, [
  { id: 'ABCDEFGHIJK', meta: freshMeta },
  { id: 'ABCDEFGHIJK', meta: freshMeta },
  { id: 'LMNOPQRSTUV', meta: knownMeta }
]));
assert.strictEqual(page.channelId, channelId);
assert.deepStrictEqual(page.videos, [
  { videoId: 'ABCDEFGHIJK', title: 'GTG & more', publishedText: '2 days ago' },
  { videoId: 'LMNOPQRSTUV', title: 'Already listed', publishedText: '' }
]);

var candidates = audit.buildCandidates(page.videos, ['LMNOPQRSTUV']);
assert.deepStrictEqual(candidates, [{
  videoId: 'ABCDEFGHIJK',
  title: 'GTG & more',
  publishedText: '2 days ago',
  url: 'https://www.youtube.com/watch?v=ABCDEFGHIJK',
  review: 'Confirm the uploader, GTG relevance, and that this is not a Short before adding.'
}]);

assert.strictEqual(audit.extractChannelVideos('<html></html>').videos.length, 0);

async function testChannelIdentity() {
  var result = await audit.auditCreator({ id: 'sample', channelUrl: 'https://www.youtube.com/@sample' }, [], async function (url) {
    if (url.indexOf('/videos') === -1) return '<meta itemprop="channelId" content="' + channelId + '">';
    return channelPage(channelId, [{ id: 'ABCDEFGHIJK', meta: freshMeta }]);
  });
  assert.strictEqual(result.checked, true);
  assert.strictEqual(result.channelId, channelId);
  assert.strictEqual(result.candidates.length, 1);

  var mismatch = await audit.auditCreator({ id: 'sample', channelId: channelId }, [], async function () {
    return channelPage('UC9999999999999999999999', [{ id: 'ABCDEFGHIJK', meta: freshMeta }]);
  });
  assert.strictEqual(mismatch.checked, false);
  assert.match(mismatch.error, /did not belong to the verified channel/);
  console.log('Creator upload audit tests passed.');
}

testChannelIdentity().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
