'use strict';

const fs = require('fs');
const path = require('path');

// Harvests real per-video metadata from the public YouTube watch page so watch pages can
// emit authoritative duration, view counts, and true upload timestamps instead of the
// date-only guesses carried by the editorial source file.
//
// Results are cached in data/youtube-creators.json under each video's `youtube` object.
// Re-runs skip records refreshed within REFRESH_DAYS unless --force is passed.

// ===== CONSTANTS =====

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'data', 'youtube-creators.json');
const REFRESH_DAYS = 14;
const DELAY_MS = 220;
const MAX_ATTEMPTS = 3;
const EXCERPT_LIMIT = 400;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== ARGS =====

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[arg.slice(2)] = next;
        i++;
      } else {
        args[arg.slice(2)] = true;
      }
    }
  }
  return args;
}

// ===== HELPERS =====

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateStr) {
  var then = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(then.getTime())) return Infinity;
  return (Date.now() - then.getTime()) / 86400000;
}

function decodeJsonString(raw) {
  try {
    return JSON.parse('"' + raw + '"');
  } catch (err) {
    return raw;
  }
}

// Creator descriptions carry URLs, emails, timestamps, hashtag walls, and social CTAs.
// Keep the prose that actually describes the video; drop the promotional scaffolding.
const NOISE_LINE_RE = /^(?:my\s+)?(?:patreon|twitch|discord|instagram|twitter|x|tiktok|facebook|second channel|merch|store|shop|business inquiries?|email|contact|subscribe|follow|join|socials?|links?)\b\s*:?/i;
const LABEL_RE = /\b(?:my\s+)?(?:patreon|twitch|discord|instagram|twitter|tiktok|facebook|second channel|merch|store|business inquiries?)\b\s*:/gi;

function cleanExcerpt(raw) {
  if (!raw) return '';
  var text = decodeJsonString(raw);
  text = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, '')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '')
    .replace(/#[\w-]+/g, '')
    .replace(/[▬►◄★☆♦●○■□]+/g, ' ')
    .replace(LABEL_RE, ' ');

  var kept = text
    .split(/\r?\n/)
    .map(function (line) { return line.replace(/\s+/g, ' ').trim(); })
    .filter(function (line) { return line && !NOISE_LINE_RE.test(line) && /[a-z]{2}/i.test(line); });

  text = kept.join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/^[\s:.,;!?-]+/, '')
    .replace(/\s+\b(?:my|and|or|the|a|to|of|for|with)\s*$/i, '')
    .trim();

  if (text.length > EXCERPT_LIMIT) {
    var cut = text.slice(0, EXCERPT_LIMIT);
    var lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    text = lastStop > EXCERPT_LIMIT * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/[\s,;:-]+$/, '') + '\u2026';
  }
  return text.trim();
}

// oEmbed returns 200 only when the owner allows embedding. A 401/404 means the video
// cannot be played inside our player, so it must not become a watch page.
async function checkEmbeddable(videoId) {
  try {
    var res = await fetch('https://www.youtube.com/oembed?url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) + '&format=json', {
      headers: { 'User-Agent': USER_AGENT }
    });
    return res.ok;
  } catch (err) {
    return null;
  }
}

// ===== FETCH =====

async function fetchVideoMetadata(videoId) {
  var url = 'https://www.youtube.com/watch?v=' + videoId;
  var lastError = null;

  for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      var res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow'
      });
      if (!res.ok) {
        lastError = 'HTTP ' + res.status;
        await sleep(DELAY_MS * attempt);
        continue;
      }
      var html = await res.text();

      var lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
      var viewMatch = html.match(/"viewCount":"(\d+)"/);
      var dateMatch = html.match(/"publishDate":"([^"]+)"/) || html.match(/"uploadDate":"([^"]+)"/);
      var descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      var liveMatch = /"isLiveContent":(true|false)/.exec(html);
      var playMatch = html.match(/"playabilityStatus":\{"status":"([A-Z_]+)"/);
      var upcomingMatch = /"isUpcoming":(true|false)/.exec(html);

      if (!lengthMatch && !dateMatch) {
        lastError = 'metadata not present in page';
        await sleep(DELAY_MS * attempt);
        continue;
      }

      var playability = playMatch ? playMatch[1] : null;
      var embeddable = await checkEmbeddable(videoId);

      return {
        ok: true,
        data: {
          durationSeconds: lengthMatch ? Number(lengthMatch[1]) : null,
          viewCount: viewMatch ? Number(viewMatch[1]) : null,
          publishedAt: dateMatch ? dateMatch[1] : null,
          isLive: liveMatch ? liveMatch[1] === 'true' : null,
          isUpcoming: upcomingMatch ? upcomingMatch[1] === 'true' : null,
          playabilityStatus: playability,
          playable: playability === null ? null : playability === 'OK',
          embeddable: embeddable,
          descriptionExcerpt: cleanExcerpt(descMatch ? descMatch[1] : ''),
          checkedAt: today()
        }
      };
    } catch (err) {
      lastError = err.message;
      await sleep(DELAY_MS * attempt);
    }
  }

  return { ok: false, error: lastError };
}

// ===== MAIN =====

async function main() {
  var args = parseArgs(process.argv.slice(2));
  var sourcePath = args.source || SOURCE_PATH;
  var force = args.force === true;
  var limit = args.limit ? Number(args.limit) : Infinity;

  if (!fs.existsSync(sourcePath)) {
    console.error('Source data not found: ' + sourcePath);
    process.exit(1);
  }

  var data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  var targets = [];
  for (var ci = 0; ci < data.creators.length; ci++) {
    var creator = data.creators[ci];
    for (var vi = 0; vi < creator.videos.length; vi++) {
      var video = creator.videos[vi];
      var existing = video.youtube;
      var fresh = existing && existing.checkedAt && daysSince(existing.checkedAt) < REFRESH_DAYS;
      if (fresh && !force) continue;
      targets.push(video);
    }
  }

  if (targets.length > limit) targets = targets.slice(0, limit);

  console.log('Videos needing metadata: ' + targets.length + ' (of ' +
    data.creators.reduce(function (n, c) { return n + c.videos.length; }, 0) + ' total)');

  var updated = 0;
  var failed = [];
  var durations = 0;
  var dates = 0;

  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    var result = await fetchVideoMetadata(target.id);

    if (result.ok) {
      target.youtube = result.data;
      updated++;
      if (result.data.durationSeconds) durations++;
      if (result.data.publishedAt) dates++;
      process.stdout.write('\r  [' + (i + 1) + '/' + targets.length + '] ' + target.id + ' ok   ');
    } else {
      failed.push({ id: target.id, error: result.error });
      process.stdout.write('\r  [' + (i + 1) + '/' + targets.length + '] ' + target.id + ' FAIL ');
    }

    if (i < targets.length - 1) await sleep(DELAY_MS);
  }

  console.log('');
  console.log('Updated: ' + updated + ' | durations: ' + durations + ' | timestamps: ' + dates + ' | failed: ' + failed.length);
  if (failed.length > 0) {
    console.log('Failures:');
    failed.slice(0, 20).forEach(function (f) { console.log('  ' + f.id + '  ' + f.error); });
  }

  // Videos that cannot play in an embedded player must not become watch pages: the page
  // would ship a dead player and Google would refuse to index the video.
  var unplayable = [];
  for (var ci2 = 0; ci2 < data.creators.length; ci2++) {
    var creatorVideos = data.creators[ci2].videos;
    for (var vi2 = 0; vi2 < creatorVideos.length; vi2++) {
      var candidate = creatorVideos[vi2];
      if (candidate.status !== 'active') continue;
      var info = candidate.youtube;
      if (!info) {
        unplayable.push({ id: candidate.id, why: 'no metadata (likely removed)' });
        continue;
      }
      if (info.playable === false) unplayable.push({ id: candidate.id, why: 'playability ' + info.playabilityStatus });
      else if (info.embeddable === false) unplayable.push({ id: candidate.id, why: 'embedding disabled (oEmbed rejected)' });
      else if (info.durationSeconds === 0) unplayable.push({ id: candidate.id, why: 'zero duration (stream never went live)' });
    }
  }

  if (unplayable.length > 0) {
    console.log('');
    console.log('REVIEW: ' + unplayable.length + ' active video(s) cannot play in an embed.');
    console.log('Set status to "unavailable" with a statusReason for each:');
    unplayable.forEach(function (u) { console.log('  ' + u.id + '  ' + u.why); });
  }

  fs.writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('');
  console.log('Wrote ' + sourcePath);
}

if (require.main === module) {
  main().catch(function (err) {
    console.error('Error: ' + err.message);
    process.exit(1);
  });
}

module.exports = {
  fetchVideoMetadata: fetchVideoMetadata,
  cleanExcerpt: cleanExcerpt,
  parseArgs: parseArgs,
  REFRESH_DAYS: REFRESH_DAYS,
  EXCERPT_LIMIT: EXCERPT_LIMIT
};
