'use strict';

var assert = require('assert');
var audit = require('../scripts/audit-youtube-creators');
var channelId = 'UC1234567890123456789012';

assert.strictEqual(audit.extractChannelId('<meta itemprop="channelId" content="' + channelId + '">'), channelId);
assert.strictEqual(audit.extractChannelId('{"externalId":"' + channelId + '"}'), channelId);
assert.strictEqual(audit.extractChannelId('<html></html>'), null);
assert.strictEqual(audit.extractFeedChannelId('<feed><yt:channelId>' + channelId + '</yt:channelId></feed>'), channelId);

var feed = '<feed>' +
  '<entry><yt:videoId>ABCDEFGHIJK</yt:videoId><title>GTG &amp; more</title><published>2026-10-11T12:00:00+00:00</published></entry>' +
  '<entry><yt:videoId>LMNOPQRSTUV</yt:videoId><title>Already listed</title><published>2026-10-10T12:00:00+00:00</published></entry>' +
  '</feed>';
var candidates = audit.parseFeed(feed, ['LMNOPQRSTUV']);
assert.strictEqual(candidates.length, 1);
assert.deepStrictEqual(candidates[0], {
  videoId: 'ABCDEFGHIJK',
  title: 'GTG & more',
  published: '2026-10-11',
  url: 'https://www.youtube.com/watch?v=ABCDEFGHIJK',
  review: 'Check uploader, GTG relevance, and that this is not a Short before adding.'
});

async function testFeedIdentity() {
  var calls = 0;
  var result = await audit.auditCreator({ id: 'sample', channelUrl: 'https://www.youtube.com/@sample' }, [], async function () {
    calls++;
    return calls === 1 ? '<meta itemprop="channelId" content="' + channelId + '">' : '<feed><yt:channelId>' + channelId + '</yt:channelId></feed>';
  });
  assert.strictEqual(result.checked, true);
  assert.strictEqual(result.channelId, channelId);

  var mismatch = await audit.auditCreator({ id: 'sample', channelUrl: 'https://www.youtube.com/@sample' }, [], async function () {
    return '<feed><yt:channelId>UC9999999999999999999999</yt:channelId></feed>';
  });
  assert.strictEqual(mismatch.checked, false);
  console.log('Creator upload audit tests passed.');
}

testFeedIdentity().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
