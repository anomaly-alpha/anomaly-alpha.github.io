'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const sourcePath = path.join(__dirname, '..', 'data', 'youtube-creators.json');

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function getTag(block, name) {
  var match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>'));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractChannelId(html) {
  var patterns = [
    /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{22})["']/i,
    /["']externalId["']\s*:\s*["'](UC[A-Za-z0-9_-]{22})["']/i,
    /["']channelId["']\s*:\s*["'](UC[A-Za-z0-9_-]{22})["']/i,
    /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && CHANNEL_ID_RE.test(match[1])) return match[1];
  }
  return null;
}

function parseFeed(xml, knownVideoIds) {
  var known = new Set(knownVideoIds || []);
  var entries = [];
  var blocks = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/g) || [];
  blocks.forEach(function (block) {
    var videoId = getTag(block, 'yt:videoId');
    if (!VIDEO_ID_RE.test(videoId) || known.has(videoId)) return;
    known.add(videoId);
    entries.push({
      videoId: videoId,
      title: getTag(block, 'title'),
      published: getTag(block, 'published').slice(0, 10),
      url: 'https://www.youtube.com/watch?v=' + videoId,
      review: 'Check uploader, GTG relevance, and that this is not a Short before adding.'
    });
  });
  return entries;
}

function extractFeedChannelId(xml) {
  var match = xml.match(/<yt:channelId>(UC[A-Za-z0-9_-]{22})<\/yt:channelId>/);
  return match ? match[1] : null;
}

function requestText(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { headers: { 'user-agent': 'AnomalyAlphaCreatorAudit/1.0' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) return reject(new Error('Too many redirects: ' + url));
        var next = new URL(res.headers.location, url).toString();
        return resolve(requestText(next, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () { resolve(body); });
    });
    req.setTimeout(15000, function () { req.destroy(new Error('Request timed out: ' + url)); });
    req.on('error', reject);
  });
}

async function auditCreator(creator, knownVideoIds, request) {
  request = request || requestText;
  var channelUrl = creator.channelUrl || creator.sourceUrl;
  var channelId = creator.channelId;
  if (!channelId) channelId = extractChannelId(await request(channelUrl));
  if (!channelId || !CHANNEL_ID_RE.test(channelId)) {
    return { creatorId: creator.id, channelUrl: channelUrl, checked: false, error: 'Could not verify a YouTube channel ID.' };
  }
  var feed = await request('https://www.youtube.com/feeds/videos.xml?channel_id=' + channelId);
  if (extractFeedChannelId(feed) !== channelId) {
    return { creatorId: creator.id, channelUrl: channelUrl, checked: false, error: 'The upload feed channel ID did not match the verified channel.' };
  }
  var entries = parseFeed(feed, knownVideoIds);
  return { creatorId: creator.id, channelUrl: channelUrl, channelId: channelId, checked: true, checkedAt: new Date().toISOString(), candidates: entries };
}

async function run(options) {
  var data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  var knownVideoIds = data.creators.flatMap(function (creator) { return creator.videos.map(function (video) { return video.id; }); });
  var creators = options.creatorId ? data.creators.filter(function (creator) { return creator.id === options.creatorId; }) : data.creators;
  if (options.creatorId && creators.length === 0) throw new Error('Unknown creator ID: ' + options.creatorId);
  var results = [];
  for (var i = 0; i < creators.length; i++) {
    var creator = creators[i];
    try {
      var result = await auditCreator(creator, knownVideoIds);
      results.push(result);
      if (result.checked && options.recordChecks) {
        creator.channelId = result.channelId;
        creator.feedLastChecked = result.checkedAt.slice(0, 10);
      }
    } catch (error) {
      results.push({ creatorId: creator.id, channelUrl: creator.channelUrl || creator.sourceUrl, checked: false, error: error.message });
    }
  }
  if (options.recordChecks && results.some(function (result) { return result.checked; })) {
    data.updated = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n');
  }
  return results;
}

if (require.main === module) {
  var recordChecks = process.argv.includes('--record-checks');
  var creatorArg = process.argv.find(function (arg) { return arg.indexOf('--creator=') === 0; });
  run({ recordChecks: recordChecks, creatorId: creatorArg ? creatorArg.slice('--creator='.length) : null }).then(function (results) {
    var checked = results.filter(function (result) { return result.checked; }).length;
    var candidates = results.reduce(function (sum, result) { return sum + (result.candidates || []).length; }, 0);
    console.log('Checked ' + checked + '/' + results.length + ' channels; ' + candidates + ' new upload candidate(s).');
    results.forEach(function (result) {
      if (!result.checked) return console.log('SKIP ' + result.creatorId + ': ' + result.error);
      console.log('\n' + result.creatorId + ' (' + result.channelId + ') — ' + result.candidates.length + ' candidate(s) — ' + result.checkedAt);
      result.candidates.forEach(function (video) { console.log('REVIEW ' + video.published + '\t' + video.title + '\t' + video.url); });
    });
    if (!recordChecks) console.log('Read-only run. Pass --record-checks to store verified channel IDs and successful check dates in data/youtube-creators.json.');
    if (checked !== results.length) process.exitCode = 1;
  }).catch(function (error) { console.error(error.message); process.exitCode = 1; });
}

module.exports = { extractChannelId: extractChannelId, extractFeedChannelId: extractFeedChannelId, parseFeed: parseFeed, auditCreator: auditCreator };
