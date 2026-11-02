'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const sourcePath = path.join(__dirname, '..', 'data', 'youtube-creators.json');

// YouTube retired the per-channel Atom upload feed: feeds/videos.xml now answers 404 for every
// channel, which made this audit report a false "0 candidates" for all creators. Discovery now
// reads the channel's /videos tab and the ytInitialData payload embedded in it.

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const REVIEW_NOTE = 'Confirm the uploader, GTG relevance, and that this is not a Short before adding.';

function channelVideosUrl(channelId) {
  return 'https://www.youtube.com/channel/' + channelId + '/videos';
}

function extractChannelId(html) {
  var patterns = [
    /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{22})["']/i,
    /["']externalId["']\s*:\s*["'](UC[A-Za-z0-9_-]{22})["']/i,
    /["']channelId["']\s*:\s*["'](UC[A-Za-z0-9_-]{22})["']/i,
    /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[A-Za-z0-9_-]{22})["']/i,
    /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = html.match(patterns[i]);
    if (match && CHANNEL_ID_RE.test(match[1])) return match[1];
  }
  return null;
}

function sliceJsonObject(text, start) {
  var depth = 0;
  var inString = false;
  var escaped = false;
  for (var i = start; i < text.length; i++) {
    var ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// The payload is a bare JS object literal, so its end cannot be found by looking for the next
// </script> tag: an earlier script in the page can contain the marker as a plain string.
function extractInitialData(html) {
  var marker = 'var ytInitialData = ';
  var from = 0;
  while (true) {
    var at = html.indexOf(marker, from);
    if (at === -1) return null;
    var start = html.indexOf('{', at + marker.length);
    var raw = start === -1 ? null : sliceJsonObject(html, start);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        // fall through to the next candidate occurrence
      }
    }
    from = at + marker.length;
  }
}

// Video tiles are lockupViewModel nodes. Their publish info sits in metadataRows as parts such as
// "12K views" and "2 days ago"; only the relative part is stable enough to surface for review.
function publishedTextFromLockup(metadata) {
  var rows = metadata && metadata.contentMetadataViewModel && metadata.contentMetadataViewModel.metadataRows;
  if (!Array.isArray(rows)) return '';
  for (var i = 0; i < rows.length; i++) {
    var parts = rows[i] && rows[i].metadataParts;
    if (!Array.isArray(parts)) continue;
    for (var p = 0; p < parts.length; p++) {
      var text = parts[p] && parts[p].text && parts[p].text.content;
      if (typeof text === 'string' && /(?:ago|^Streamed|^Premier|^Scheduled)/i.test(text)) return text;
    }
  }
  return '';
}

function collectVideoLockups(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) collectVideoLockups(node[i], out);
    return;
  }
  var lockup = node.lockupViewModel;
  if (lockup && typeof lockup.contentId === 'string' && VIDEO_ID_RE.test(lockup.contentId)) {
    var metadata = lockup.metadata && lockup.metadata.lockupMetadataViewModel;
    var title = metadata && metadata.title && typeof metadata.title.content === 'string' ? metadata.title.content : '';
    out.push({
      videoId: lockup.contentId,
      title: title,
      publishedText: publishedTextFromLockup(metadata && metadata.metadata)
    });
    return;
  }
  var keys = Object.keys(node);
  for (var k = 0; k < keys.length; k++) collectVideoLockups(node[keys[k]], out);
}

function extractChannelVideos(html) {
  var data = extractInitialData(html);
  var videos = [];
  if (data) collectVideoLockups(data, videos);
  var seen = new Set();
  var unique = videos.filter(function (video) {
    if (seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return true;
  });
  var canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[A-Za-z0-9_-]{22})["']/i);
  return {
    channelId: canonical ? canonical[1] : extractChannelId(html),
    videos: unique
  };
}

function buildCandidates(videos, knownVideoIds) {
  var known = new Set(knownVideoIds || []);
  return videos
    .filter(function (video) { return !known.has(video.videoId); })
    .map(function (video) {
      return {
        videoId: video.videoId,
        title: video.title,
        publishedText: video.publishedText,
        url: 'https://www.youtube.com/watch?v=' + video.videoId,
        review: REVIEW_NOTE
      };
    });
}

function requestText(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve, reject) {
    var req = https.get(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9'
      }
    }, function (res) {
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
  var page = extractChannelVideos(await request(channelVideosUrl(channelId)));
  if (page.channelId !== channelId) {
    return { creatorId: creator.id, channelUrl: channelUrl, checked: false, error: 'The channel videos page did not belong to the verified channel.' };
  }
  return {
    creatorId: creator.id,
    channelUrl: channelUrl,
    channelId: channelId,
    checked: true,
    checkedAt: new Date().toISOString(),
    candidates: buildCandidates(page.videos, knownVideoIds)
  };
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
        creator.videosLastChecked = result.checkedAt.slice(0, 10);
        creator.lastChecked = result.checkedAt.slice(0, 10);
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
      result.candidates.forEach(function (video) { console.log('REVIEW ' + (video.publishedText || 'unknown upload age') + '\t' + video.title + '\t' + video.url); });
    });
    if (!recordChecks) console.log('Read-only run. Pass --record-checks to store verified channel IDs and successful check dates in data/youtube-creators.json.');
    if (checked !== results.length) process.exitCode = 1;
  }).catch(function (error) { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  extractChannelId: extractChannelId,
  extractChannelVideos: extractChannelVideos,
  buildCandidates: buildCandidates,
  auditCreator: auditCreator
};
