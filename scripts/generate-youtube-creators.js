'use strict';

const fs = require('fs');
const path = require('path');

// ===== CONSTANTS =====

const VALID_CATEGORIES = [
  'Guides', 'Tier Lists', 'Updates', 'Events',
  'Team Building', 'Gameplay', 'Livestreams'
];
const VALID_STATUSES = ['active', 'pending', 'hidden'];
const VALID_VIDEO_STATUSES = ['active', 'pending', 'unavailable'];
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const YT_URL_RE = /^https:\/\/www\.youtube\.com\//;
const MAX_VIDEOS_PER_CREATOR = 12;
const FEATURED_PER_CREATOR = 6;
const RECENT_DAYS = 180;

const MARKER_PAIRS = [
  'FEATURED_CREATOR',
  'CREATOR_SECTIONS',
  'CREATORS_JSON_LD',
  'CREATORS_NOSCRIPT',
  'CREATORS_NOTE'
];

// ===== ESCAPING =====

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonLd(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/<\/script/gi, '<\\/script');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===== DATE HELPERS =====

function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  var d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

function daysBetween(d1, d2) {
  var date1 = new Date(d1 + 'T00:00:00Z');
  var date2 = new Date(d2 + 'T00:00:00Z');
  return Math.abs(date2 - date1) / (1000 * 60 * 60 * 24);
}

// ===== VALIDATION =====

function validateData(data) {
  var errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Source data must be a JSON object.');
    return errors;
  }

  // Top-level fields
  if (!isValidDate(data.updated)) {
    errors.push('Top-level "updated" must be a valid ISO date-only string (YYYY-MM-DD).');
  }

  if (typeof data.contentMaintainer !== 'string' || data.contentMaintainer.trim() === '') {
    errors.push('"contentMaintainer" must be a non-empty string.');
  }

  if (data.reviewCadenceDays !== 90) {
    errors.push('"reviewCadenceDays" must be exactly 90.');
  }

  if (typeof data.featuredCreatorId !== 'string' || data.featuredCreatorId.trim() === '') {
    errors.push('"featuredCreatorId" must be a non-empty string identifying an active creator.');
  }

  // candidateSources
  if (!Array.isArray(data.candidateSources) || data.candidateSources.length === 0) {
    errors.push('"candidateSources" must be a non-empty array.');
  } else {
    data.candidateSources.forEach(function (src, i) {
      var p = 'candidateSources[' + i + ']';
      if (!src.sourceUrl || typeof src.sourceUrl !== 'string' || !YT_URL_RE.test(src.sourceUrl)) {
        errors.push(p + '.sourceUrl must be a valid https://www.youtube.com/ URL.');
      }
      if (!src.kind || typeof src.kind !== 'string') {
        errors.push(p + '.kind must be a non-empty string.');
      }
      if (!src.lastChecked || !isValidDate(src.lastChecked)) {
        errors.push(p + '.lastChecked must be a valid ISO date.');
      }
      if (!src.resolutionStatus || typeof src.resolutionStatus !== 'string') {
        errors.push(p + '.resolutionStatus must be a non-empty string.');
      } else if (!['verified', 'rejected', 'unresolved'].includes(src.resolutionStatus)) {
        errors.push(p + '.resolutionStatus must be verified, rejected, or unresolved.');
      }
      if (src.resolvedCreatorId !== undefined && src.resolvedCreatorId !== null &&
          (typeof src.resolvedCreatorId !== 'string' || !KEBAB_RE.test(src.resolvedCreatorId))) {
        errors.push(p + '.resolvedCreatorId must be null or a lowercase kebab-case creator ID.');
      }
      if (src.resolutionStatus === 'verified' && (!src.resolvedCreatorId || typeof src.resolvedCreatorId !== 'string')) {
        errors.push(p + '.resolvedCreatorId is required for verified candidate sources.');
      }
      if ((src.resolutionStatus === 'rejected' || src.resolutionStatus === 'unresolved') &&
          (!src.statusReason || typeof src.statusReason !== 'string' || src.statusReason.trim() === '')) {
        errors.push(p + '.statusReason is required for rejected or unresolved candidate sources.');
      }
    });
  }

  // ogImageSources
  if (!Array.isArray(data.ogImageSources) || data.ogImageSources.length === 0) {
    errors.push('"ogImageSources" must contain provenance for the creators OG asset.');
  } else {
    data.ogImageSources.forEach(function (src, i) {
      var p = 'ogImageSources[' + i + ']';
      if (!src.sourceUrl || typeof src.sourceUrl !== 'string') {
        errors.push(p + '.sourceUrl must be a non-empty string.');
      }
      if (!src.license || typeof src.license !== 'string') {
        errors.push(p + '.license must be a non-empty string.');
      }
      if (!src.attribution || typeof src.attribution !== 'string') {
        errors.push(p + '.attribution must be a non-empty string.');
      }
      if (!src.lastChecked || !isValidDate(src.lastChecked)) {
        errors.push(p + '.lastChecked must be a valid ISO date.');
      }
    });
  }

  // Creators
  if (!Array.isArray(data.creators)) {
    errors.push('"creators" must be an array.');
    return errors;
  }

  if (data.creators.length === 0) {
    errors.push('"creators" must contain at least one creator record.');
    return errors;
  }

  var creatorIds = new Set();
  var displayOrders = new Set();
  var videoIds = new Set();
  var today = data.updated || new Date().toISOString().slice(0, 10);

  for (var ci = 0; ci < data.creators.length; ci++) {
    var c = data.creators[ci];
    var cp = 'creators[' + ci + ']';

    // ID
    if (!c.id || typeof c.id !== 'string') {
      errors.push(cp + '.id is required.');
    } else if (!KEBAB_RE.test(c.id)) {
      errors.push(cp + '.id must be lowercase kebab-case.');
    } else if (creatorIds.has(c.id)) {
      errors.push('Duplicate creator ID: "' + c.id + '".');
    } else {
      creatorIds.add(c.id);
    }

    // Status
    if (!VALID_STATUSES.includes(c.status)) {
      errors.push(cp + '.status must be one of ' + VALID_STATUSES.join(', ') + '.');
    }

    // displayOrder
    if (typeof c.displayOrder !== 'number') {
      errors.push(cp + '.displayOrder must be a number.');
    } else if (displayOrders.has(c.displayOrder)) {
      errors.push('Duplicate displayOrder: ' + c.displayOrder + '.');
    } else {
      displayOrders.add(c.displayOrder);
    }

    // lastChecked
    if (!isValidDate(c.lastChecked)) {
      errors.push(cp + '.lastChecked must be a valid ISO date (YYYY-MM-DD).');
    }

    // Active/pending creator required fields
    if (c.status === 'active' || c.status === 'pending') {
      if (!c.name || typeof c.name !== 'string' || c.name.trim() === '') {
        errors.push(cp + '.name is required for ' + c.status + ' creators.');
      }
      if (!c.handle || typeof c.handle !== 'string' || c.handle.trim() === '') {
        errors.push(cp + '.handle is required for ' + c.status + ' creators.');
      }
      if (!c.channelUrl || typeof c.channelUrl !== 'string' || !YT_URL_RE.test(c.channelUrl)) {
        errors.push(cp + '.channelUrl must begin with https://www.youtube.com/ for ' + c.status + ' creators.');
      }
      if (!c.description || typeof c.description !== 'string' || c.description.trim() === '') {
        errors.push(cp + '.description is required for ' + c.status + ' creators.');
      }
      if (c.status === 'active') {
        if (!Array.isArray(c.tags) || c.tags.length === 0) {
          errors.push(cp + '.tags must be a non-empty string array for active creators.');
        }
      }
    }
    if (!c.sourceUrl || typeof c.sourceUrl !== 'string' || !YT_URL_RE.test(c.sourceUrl)) {
      errors.push(cp + '.sourceUrl must be a valid https://www.youtube.com/ URL.');
    }

    // Videos
    if (!Array.isArray(c.videos)) {
      errors.push(cp + '.videos must be an array.');
      continue;
    }

    var eligibleCount = 0;
    var recentCount = 0;
    var featuredCount = 0;

    for (var vi = 0; vi < c.videos.length; vi++) {
      var v = c.videos[vi];
      var vp = cp + '.videos[' + vi + ']';

      // Video ID
      if (!v.id || typeof v.id !== 'string') {
        errors.push(vp + '.id is required.');
      } else if (!VIDEO_ID_RE.test(v.id)) {
        errors.push(vp + '.id "' + v.id + '" is not a valid 11-character YouTube video ID.');
      } else if (videoIds.has(v.id)) {
        errors.push('Duplicate video ID: "' + v.id + '".');
      } else {
        videoIds.add(v.id);
      }

      // Title
      if (!v.title || typeof v.title !== 'string' || v.title.trim() === '') {
        errors.push(vp + '.title is required.');
      }
      if (!v.sourceUrl || typeof v.sourceUrl !== 'string' || !YT_URL_RE.test(v.sourceUrl)) {
        errors.push(vp + '.sourceUrl must be a valid https://www.youtube.com/ URL.');
      }
      if (!v.canonicalUrl || typeof v.canonicalUrl !== 'string' || !YT_URL_RE.test(v.canonicalUrl)) {
        errors.push(vp + '.canonicalUrl must be a valid https://www.youtube.com/ URL.');
      }

      // Video status
      if (!VALID_VIDEO_STATUSES.includes(v.status)) {
        errors.push(vp + '.status must be one of ' + VALID_VIDEO_STATUSES.join(', ') + '.');
      }

      // Category (for active videos)
      if (v.status === 'active') {
        if (!VALID_CATEGORIES.includes(v.category)) {
          errors.push(vp + '.category must be one of ' + VALID_CATEGORIES.join(', ') + '.');
        }
        if (!v.description || typeof v.description !== 'string' || v.description.trim() === '') {
          errors.push(vp + '.description is required for active videos.');
        }
        if (!isValidDate(v.published)) {
          errors.push(vp + '.published must be a valid ISO date (YYYY-MM-DD) for active videos.');
        }
        if (!isValidDate(v.lastChecked)) {
          errors.push(vp + '.lastChecked must be a valid ISO date (YYYY-MM-DD) for active videos.');
        }
        if (!v.evidenceNote || typeof v.evidenceNote !== 'string' || v.evidenceNote.trim() === '') {
          errors.push(vp + '.evidenceNote is required for active videos.');
        }
      }

      // Featured must be active
      if (v.featured === true && v.status !== 'active') {
        errors.push(vp + ' has featured:true but status "' + v.status + '"; featured items must be active.');
      }

      // statusReason required for unavailable/pending
      if (v.status === 'unavailable' || v.status === 'pending') {
        if (!v.statusReason || typeof v.statusReason !== 'string' || v.statusReason.trim() === '') {
          errors.push(vp + '.statusReason is required for ' + v.status + ' videos.');
        }
      }

      // Count eligible items for threshold checks
      if (v.status === 'active') {
        eligibleCount++;
        if (v.published && isValidDate(v.published) && daysBetween(v.published, today) <= RECENT_DAYS) {
          recentCount++;
        }
      }
      if (v.featured === true) {
        featuredCount++;
      }
    }

    // Active creator thresholds
    if (c.status === 'active') {
      if (eligibleCount < 6) {
        errors.push(cp + ' has ' + eligibleCount + ' eligible items; active creators require at least 6.');
      }
      if (recentCount < 3) {
        errors.push(cp + ' has ' + recentCount + ' items published in previous ' + RECENT_DAYS + ' days; active creators require at least 3.');
      }
      if (featuredCount !== 6) {
        errors.push(cp + ' has ' + featuredCount + ' featured:true items; active creators must have exactly 6.');
      }
    }

    // Pending creator thresholds
    if (c.status === 'pending') {
      if (eligibleCount === 0) {
        errors.push(cp + ' is pending with zero eligible items; pending creators require at least 1 eligible item.');
      }
    }

    // Hidden creator thresholds
    if (c.status === 'hidden') {
      if (eligibleCount > 0) {
        errors.push(cp + ' is hidden with ' + eligibleCount + ' eligible items; hidden creators must have zero.');
      }
    }
  }

  if (Array.isArray(data.candidateSources)) {
    data.candidateSources.forEach(function (src, i) {
      if (src.resolvedCreatorId && !creatorIds.has(src.resolvedCreatorId)) {
        errors.push('candidateSources[' + i + '].resolvedCreatorId "' + src.resolvedCreatorId + '" does not match a creator record.');
      }
    });
  }

  // Featured creator validation
  if (typeof data.featuredCreatorId === 'string' && data.featuredCreatorId.trim() !== '') {
    var featuredCreator = null;
    for (var fi = 0; fi < data.creators.length; fi++) {
      if (data.creators[fi].id === data.featuredCreatorId) {
        featuredCreator = data.creators[fi];
        break;
      }
    }
    if (!featuredCreator) {
      errors.push('featuredCreatorId "' + data.featuredCreatorId + '" does not match any creator in the dataset.');
    } else if (featuredCreator.status !== 'active') {
      errors.push('featuredCreatorId "' + data.featuredCreatorId + '" must reference an active creator, but status is "' + featuredCreator.status + '".');
    }
  }

  return errors;
}

// ===== RENDERING: VIDEO CARD =====

function renderVideoCard(video, creator) {
  var thumbnailUrl = 'https://i.ytimg.com/vi/' + video.id + '/maxresdefault.jpg';
  var altText = 'Thumbnail for ' + video.title + ' by ' + creator.name;

  var html = '';
  html += '        <button\n';
  html += '          type="button"\n';
  html += '          class="gem-creator-video"\n';
  html += '          data-youtube-video-id="' + escapeHtml(video.id) + '"\n';
  html += '          data-creator-id="' + escapeHtml(creator.id) + '"\n';
  html += '          aria-label="Play ' + escapeHtml(video.title) + ' by ' + escapeHtml(creator.name) + '"\n';
  html += '        >\n';
  html += '          <div class="gem-creator-video__thumbnail">\n';
  html += '            <img\n';
  html += '              src="' + escapeHtml(thumbnailUrl) + '"\n';
  html += '              alt="' + escapeHtml(altText) + '"\n';
  html += '              loading="lazy"\n';
  html += '              decoding="async"\n';
  html += '              width="480"\n';
  html += '              height="270"\n';
  html += '              referrerpolicy="strict-origin-when-cross-origin"\n';
  html += '              data-thumbnail-fallback="maxres"\n';
  html += '            >\n';
  html += '            <span class="gem-creator-video__fallback" aria-hidden="true">Thumbnail unavailable</span>\n';
  html += '            <span class="gem-creator-video__play" aria-hidden="true">&#9654;</span>\n';
  html += '          </div>\n';
  html += '          <div class="gem-creator-video__content">\n';
  html += '            <span class="gem-creator-video__creator">' + escapeHtml(creator.name);
  if (creator.status === 'pending') {
    html += ' <span class="gem-creator-video__status">Pending</span>';
  }
  html += '</span>\n';
  html += '            <span class="gem-creator-video__title">' + escapeHtml(video.title) + '</span>\n';
  html += '            <span class="gem-creator-video__meta"><time datetime="' + escapeHtml(video.published) + '">' + escapeHtml(video.published) + '</time> &middot; ' + escapeHtml(video.category) + '</span>\n';
  html += '          </div>\n';
  html += '        </button>\n';
  return html;
}

// ===== RENDERING: FEATURED CREATOR (HERO) =====

function renderFeaturedCreatorHtml(data) {
  var creator = null;
  for (var i = 0; i < data.creators.length; i++) {
    if (data.creators[i].id === data.featuredCreatorId) {
      creator = data.creators[i];
      break;
    }
  }
  if (!creator) return '';

  var featuredVideos = creator.videos
    .filter(function (v) { return v.status === 'active' && v.featured === true; })
    .sort(function (a, b) { return new Date(b.published) - new Date(a.published); })
    .slice(0, FEATURED_PER_CREATOR);

  var html = '';
  html += '      <section class="gem-creators__featured gem-creator gem-creator--featured" id="creator-hero-' + escapeHtml(creator.id) + '">\n';
  html += '        <div class="gem-creator__meta">\n';
  html += '          <h2>' + escapeHtml(creator.name) + '</h2>\n';
  if (creator.handle) {
    html += '          <p class="gem-creator__handle">' + escapeHtml(creator.handle) + '</p>\n';
  }
  if (creator.description) {
    html += '          <p class="gem-creator__desc">' + escapeHtml(creator.description) + '</p>\n';
  }
  if (Array.isArray(creator.tags) && creator.tags.length > 0) {
    html += '          <ul class="gem-creator__tags">\n';
    for (var t = 0; t < creator.tags.length; t++) {
      html += '            <li class="gem-creator__tag">' + escapeHtml(creator.tags[t]) + '</li>\n';
    }
    html += '          </ul>\n';
  }
  html += '          <p class="gem-creator__checked">Last checked: <time datetime="' + escapeHtml(creator.lastChecked) + '">' + escapeHtml(creator.lastChecked) + '</time></p>\n';
  if (creator.channelUrl) {
    html += '          <a href="' + escapeHtml(creator.channelUrl) + '" target="_blank" rel="noopener noreferrer" class="gem-creator__channel">Visit Channel</a>\n';
  }
  html += '        </div>\n';
  html += '        <div class="gem-creator__videos">\n';
  for (var vi = 0; vi < featuredVideos.length; vi++) {
    html += renderVideoCard(featuredVideos[vi], creator);
  }
  var additionalVideos = creator.videos
    .filter(function (v) { return v.status === 'active' && v.featured !== true; })
    .sort(function (a, b) { return new Date(b.published) - new Date(a.published); })
    .slice(0, MAX_VIDEOS_PER_CREATOR - featuredVideos.length);
  if (additionalVideos.length > 0) {
    html += '          <details class="gem-creator__expand">\n';
    html += '            <summary>Show more videos</summary>\n';
    html += '            <div class="gem-creator__expanded">\n';
    for (var ai = 0; ai < additionalVideos.length; ai++) {
      html += renderVideoCard(additionalVideos[ai], creator);
    }
    html += '            </div>\n';
    html += '          </details>\n';
  }
  html += '        </div>\n';
  html += '      </section>\n';

  return html;
}

// ===== RENDERING: CREATOR SECTIONS (NORMAL LIST) =====

function renderCreatorSectionsHtml(data) {
  var featuredId = data.featuredCreatorId;
  var activeCreators = [];
  var pendingCreators = [];

  for (var i = 0; i < data.creators.length; i++) {
    var c = data.creators[i];
    if (c.status === 'active' && c.id !== featuredId) {
      activeCreators.push(c);
    } else if (c.status === 'pending') {
      pendingCreators.push(c);
    }
  }

  activeCreators.sort(function (a, b) { return a.displayOrder - b.displayOrder; });
  pendingCreators.sort(function (a, b) { return a.displayOrder - b.displayOrder; });

  var visibleCreators = activeCreators.concat(pendingCreators);
  if (visibleCreators.length === 0) return '';

  var html = '';
  html += '      <div class="gem-creators__list">\n';

  for (var ci = 0; ci < visibleCreators.length; ci++) {
    var creator = visibleCreators[ci];
    var isPending = creator.status === 'pending';

    // Get active videos sorted: featured first, then by date
    var activeVideos = creator.videos
      .filter(function (v) { return v.status === 'active'; })
      .sort(function (a, b) {
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        return new Date(b.published) - new Date(a.published);
      });

    var displayVideos = activeVideos.slice(0, MAX_VIDEOS_PER_CREATOR);
    var hasMore = activeVideos.length > displayVideos.length;

    html += '        <section class="gem-creator' + (isPending ? ' gem-creator--pending' : '') + '" id="creator-' + escapeHtml(creator.id) + '">\n';
    html += '          <div class="gem-creator__meta">\n';
    html += '            <h2>' + escapeHtml(creator.name);
    if (isPending) {
      html += ' <span class="gem-creator__pending-label">Pending</span>';
    }
    html += '</h2>\n';
    if (creator.handle) {
      html += '            <p class="gem-creator__handle">' + escapeHtml(creator.handle) + '</p>\n';
    }
    if (creator.description) {
      html += '            <p class="gem-creator__desc">' + escapeHtml(creator.description) + '</p>\n';
    }
    if (Array.isArray(creator.tags) && creator.tags.length > 0) {
      html += '            <ul class="gem-creator__tags">\n';
      for (var ti = 0; ti < creator.tags.length; ti++) {
        html += '              <li class="gem-creator__tag">' + escapeHtml(creator.tags[ti]) + '</li>\n';
      }
      html += '            </ul>\n';
    }
    html += '            <p class="gem-creator__checked">Last checked: <time datetime="' + escapeHtml(creator.lastChecked) + '">' + escapeHtml(creator.lastChecked) + '</time></p>\n';
    if (creator.channelUrl) {
      html += '            <a href="' + escapeHtml(creator.channelUrl) + '" target="_blank" rel="noopener noreferrer" class="gem-creator__channel">Visit Channel</a>\n';
    }
    html += '          </div>\n';
    html += '          <div class="gem-creator__videos">\n';

    for (var vi = 0; vi < displayVideos.length; vi++) {
      html += renderVideoCard(displayVideos[vi], creator);
    }

    if (isPending && activeVideos.length < FEATURED_PER_CREATOR) {
      html += '            <p class="gem-creator__more">More videos coming soon</p>\n';
    }

    if (hasMore) {
      html += '            <details class="gem-creator__expand">\n';
      html += '              <summary>Show more videos</summary>\n';
      html += '              <div class="gem-creator__expanded">\n';
      var expandedVideos = activeVideos.slice(displayVideos.length, MAX_VIDEOS_PER_CREATOR);
      for (var ei = 0; ei < expandedVideos.length; ei++) {
        html += renderVideoCard(expandedVideos[ei], creator);
      }
      html += '              </div>\n';
      html += '            </details>\n';
    }

    html += '          </div>\n';
    html += '        </section>\n';
  }

  html += '      </div>\n';
  return html;
}

// ===== RENDERING: CHRONOLOGICAL ACTIVITY FEED =====

function getVisibleCreators(data) {
  return data.creators
    .filter(function (creator) { return creator.status === 'active' || creator.status === 'pending'; })
    .sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return a.displayOrder - b.displayOrder;
    });
}

function getVisibleFeedItems(data) {
  var items = [];
  var creators = getVisibleCreators(data);
  for (var ci = 0; ci < creators.length; ci++) {
    var creator = creators[ci];
    var videos = creator.videos
      .filter(function (video) { return video.status === 'active'; })
      .sort(function (a, b) { return new Date(b.published) - new Date(a.published); })
      .slice(0, MAX_VIDEOS_PER_CREATOR);
    for (var vi = 0; vi < videos.length; vi++) {
      items.push({ creator: creator, video: videos[vi] });
    }
  }
  items.sort(function (a, b) {
    var dateSort = new Date(b.video.published) - new Date(a.video.published);
    if (dateSort !== 0) return dateSort;
    return a.creator.displayOrder - b.creator.displayOrder;
  });
  return items;
}

function formatFeedDate(dateString) {
  var date = new Date(dateString + 'T00:00:00Z');
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getUTCMonth()] + ' ' + date.getUTCDate() + ', ' + date.getUTCFullYear();
}

function renderFeedSummaryHtml(data) {
  var creators = getVisibleCreators(data);
  var items = getVisibleFeedItems(data);
  var html = '';
  html += '      <section class="gem-creators__signal" aria-labelledby="creatorFeedTitle">\n';
  html += '        <div class="gem-creators__signal-copy">\n';
  html += '          <p class="gem-creators__eyebrow">ACTIVITY FEED</p>\n';
  html += '          <h2 id="creatorFeedTitle">Fresh coverage, newest first</h2>\n';
  html += '          <p>When a major event lands, videos from different creators stack together here so the community response reads as one burst of activity.</p>\n';
  html += '        </div>\n';
  html += '        <div class="gem-creators__stats" aria-label="Feed summary">\n';
  html += '          <span><strong>' + items.length + '</strong> videos</span>\n';
  html += '          <span><strong>' + creators.length + '</strong> creators</span>\n';
  html += '        </div>\n';
  html += '        <div class="gem-creators__channels">\n';
  html += '          <span class="gem-creators__channels-label">Channels in this feed</span>\n';
  html += '          <ul>\n';
  for (var ci = 0; ci < creators.length; ci++) {
    var creator = creators[ci];
    html += '            <li><a href="' + escapeHtml(creator.channelUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(creator.name) + '</a>';
    if (creator.status === 'pending') html += ' <span>Pending</span>';
    html += '</li>\n';
  }
  html += '          </ul>\n';
  html += '        </div>\n';
  html += '      </section>\n';
  return html;
}

function renderCreatorFeedHtml(data) {
  var items = getVisibleFeedItems(data);
  if (items.length === 0) return '';

  var dateCounts = {};
  for (var i = 0; i < items.length; i++) {
    dateCounts[items[i].video.published] = (dateCounts[items[i].video.published] || 0) + 1;
  }

  var html = '';
  html += '      <section class="gem-creators__feed-shell" aria-labelledby="creatorFeedListTitle">\n';
  html += '        <h2 id="creatorFeedListTitle" class="gem-creators__feed-title">Community activity</h2>\n';
  html += '        <p class="gem-creators__feed-subtitle">Every card is one video. Date markers make bursts around the same event easy to spot.</p>\n';
  html += '        <ol class="gem-creators__feed" aria-label="Creator videos sorted newest first">\n';
  var previousDate = '';
  for (var ii = 0; ii < items.length; ii++) {
    var item = items[ii];
    var date = item.video.published;
    html += '          <li class="gem-creators__item" data-published="' + escapeHtml(date) + '">\n';
    if (date !== previousDate) {
      html += '            <div class="gem-creators__date-marker">\n';
      html += '              <time datetime="' + escapeHtml(date) + '">' + escapeHtml(formatFeedDate(date)) + '</time>\n';
      html += '              <span>' + dateCounts[date] + (dateCounts[date] === 1 ? ' video' : ' videos') + '</span>\n';
      html += '            </div>\n';
      previousDate = date;
    }
    html += renderVideoCard(item.video, item.creator);
    html += '          </li>\n';
  }
  html += '        </ol>\n';
  html += '      </section>\n';
  return html;
}

// ===== RENDERING: JSON-LD =====

function renderJsonLdHtml(data) {
  var allVideoObjects = [];
  var feedItems = getVisibleFeedItems(data);

  for (var i = 0; i < feedItems.length; i++) {
    var item = feedItems[i];
    var creator = item.creator;
    var video = item.video;
    allVideoObjects.push({
      '@type': 'VideoObject',
      'name': video.title,
      'description': video.description,
      'thumbnailUrl': 'https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg',
      'uploadDate': video.published,
      'contentUrl': 'https://www.youtube.com/watch?v=' + video.id,
      'embedUrl': 'https://www.youtube-nocookie.com/embed/' + video.id,
      'author': {
        '@type': 'Person',
        'name': creator.name,
        'url': creator.channelUrl
      },
      'about': { '@id': '#game' }
    });
  }

  if (allVideoObjects.length === 0) return '';

  var itemList = {
    '@type': 'ItemList',
    'name': 'Invincible GTG Creator Videos',
    'itemListElement': allVideoObjects.map(function (vo, i) {
      return {
        '@type': 'ListItem',
        'position': i + 1,
        'item': vo
      };
    })
  };

  var jsonLd = JSON.stringify(itemList, null, 2);
  var escaped = escapeJsonLd(jsonLd);

  var html = '';
  html += '      <script type="application/ld+json">\n';
  html += escaped + '\n';
  html += '      </script>\n';
  return html;
}

// ===== RENDERING: NOSCRIPT =====

function renderNoscriptHtml(data) {
  var links = [];
  var feedItems = getVisibleFeedItems(data);

  for (var i = 0; i < feedItems.length; i++) {
    var item = feedItems[i];
    var creator = item.creator;
    var video = item.video;
    var watchUrl = 'https://www.youtube.com/watch?v=' + video.id;
    links.push(
      '          <li><a href="' + escapeHtml(watchUrl) + '" target="_blank" rel="noopener noreferrer">' +
      'Watch ' + escapeHtml(video.title) + ' by ' + escapeHtml(creator.name) + ' on YouTube</a></li>'
    );
  }

  if (links.length === 0) return '';

  var html = '';
  html += '      <noscript>\n';
  html += '        <div class="gem-creators__noscript">\n';
  html += '          <p>Enable JavaScript to play videos in the modal. You can also watch them directly on YouTube:</p>\n';
  html += '          <ul>\n';
  html += links.join('\n') + '\n';
  html += '          </ul>\n';
  html += '        </div>\n';
  html += '      </noscript>\n';
  return html;
}

// ===== RENDERING: PRIVACY NOTE + DISCLAIMER =====

function renderDisclaimerHtml() {
  var html = '';
  html += '      <div class="gem-creators__note">\n';
  html += '        <p>Thumbnails and playback may connect to YouTube. Videos play through YouTube when selected. Creator activity and video availability can change.</p>\n';
  html += '        <p>Creators listed here are independent community members and are not necessarily endorsed by Ubisoft, YouTube, or Anomaly Alpha.</p>\n';
  html += '      </div>\n';
  return html;
}

// ===== RENDERING: WINDOW.__YOUTUBE_CREATORS JS =====

function renderJsOutput(data) {
  var featuredId = data.featuredCreatorId;
  var publicCreators = data.creators
    .filter(function (c) { return c.status === 'active' || c.status === 'pending'; })
    .sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return a.displayOrder - b.displayOrder;
    })
    .map(function (c) {
      var visibleVideos = c.videos
        .filter(function (v) { return v.status === 'active'; })
        .slice(0, MAX_VIDEOS_PER_CREATOR)
        .map(function (v) {
          return {
            id: v.id,
            title: v.title,
            description: v.description,
            category: v.category,
            published: v.published,
            featured: v.featured === true
          };
        });

      return {
        id: c.id,
        name: c.name,
        handle: c.handle,
        channelUrl: c.channelUrl,
        description: c.description,
        tags: c.tags || [],
        status: c.status,
        displayOrder: c.displayOrder,
        videos: visibleVideos
      };
    });

  return 'window.__YOUTUBE_CREATORS=' + JSON.stringify(publicCreators, null, 2) + ';\n';
}

// ===== MARKER OPERATIONS =====

function assertMarkers(html, markerNames) {
  var missing = [];
  var duplicated = [];

  for (var i = 0; i < markerNames.length; i++) {
    var name = markerNames[i];
    var startTag = '<!--' + name + '_START-->';
    var endTag = '<!--' + name + '_END-->';

    var startRe = new RegExp(escapeRegex(startTag), 'g');
    var endRe = new RegExp(escapeRegex(endTag), 'g');

    var startCount = (html.match(startRe) || []).length;
    var endCount = (html.match(endRe) || []).length;

    if (startCount === 0) missing.push(startTag);
    if (endCount === 0) missing.push(endTag);
    if (startCount > 1) duplicated.push(startTag + ' (found ' + startCount + ')');
    if (endCount > 1) duplicated.push(endTag + ' (found ' + endCount + ')');
    if (startCount !== endCount) {
      duplicated.push('Mismatched ' + name + ': ' + startCount + ' starts vs ' + endCount + ' ends');
    }
  }

  if (missing.length > 0 || duplicated.length > 0) {
    var msgs = [];
    if (missing.length > 0) msgs.push('Missing markers: ' + missing.join(', '));
    if (duplicated.length > 0) msgs.push('Duplicated/mismatched markers: ' + duplicated.join(', '));
    throw new Error(msgs.join('\n'));
  }
}

function replaceMarker(html, markerName, content) {
  var startTag = '<!--' + markerName + '_START-->';
  var endTag = '<!--' + markerName + '_END-->';
  var pattern = new RegExp(
    escapeRegex(startTag) + '[\\s\\S]*?' + escapeRegex(endTag)
  );
  return html.replace(pattern, startTag + '\n' + content + endTag);
}

// ===== INTEGRATION =====

function buildData(sourcePath) {
  var raw;
  try {
    raw = fs.readFileSync(sourcePath, 'utf8');
  } catch (err) {
    return { data: null, errors: ['Cannot read source file: ' + err.message] };
  }

  var data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { data: null, errors: ['Invalid JSON: ' + err.message] };
  }

  var errors = validateData(data);
  return { data: data, errors: errors };
}

function generate(sourcePath, templatePath) {
  var result = buildData(sourcePath);
  if (result.errors.length > 0) {
    return { success: false, errors: result.errors, html: null, js: null };
  }

  var data = result.data;

  var featuredHtml = renderFeedSummaryHtml(data);
  var sectionsHtml = renderCreatorFeedHtml(data);
  var jsonLdHtml = renderJsonLdHtml(data);
  var noscriptHtml = renderNoscriptHtml(data);
  var disclaimerHtml = renderDisclaimerHtml();
  var jsOutput = renderJsOutput(data);

  // If no template, just return JS output
  if (!templatePath) {
    return { success: true, errors: [], html: null, js: jsOutput };
  }

  var templateHtml;
  try {
    templateHtml = fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    return { success: false, errors: ['Cannot read template file: ' + err.message], html: null, js: null };
  }

  // Assert markers
  try {
    assertMarkers(templateHtml, MARKER_PAIRS);
  } catch (err) {
    return { success: false, errors: [err.message], html: null, js: null };
  }

  // Replace markers (idempotent)
  templateHtml = replaceMarker(templateHtml, 'FEATURED_CREATOR', featuredHtml);
  templateHtml = replaceMarker(templateHtml, 'CREATOR_SECTIONS', sectionsHtml);
  templateHtml = replaceMarker(templateHtml, 'CREATORS_JSON_LD', jsonLdHtml);
  templateHtml = replaceMarker(templateHtml, 'CREATORS_NOSCRIPT', noscriptHtml);
  templateHtml = replaceMarker(templateHtml, 'CREATORS_NOTE', disclaimerHtml);

  return { success: true, errors: [], html: templateHtml, js: jsOutput };
}

// ===== CLI =====

if (require.main === module) {
  var rootDir = path.resolve(__dirname, '..');
  var sourcePath = path.join(rootDir, 'data', 'youtube-creators.json');
  var templatePath = path.join(rootDir, 'guide', 'creators', 'index.html');
  var jsOutputPath = path.join(rootDir, 'data', 'generated', 'youtube-creators.js');

  // Graceful skip when source file does not exist yet
  if (!fs.existsSync(sourcePath)) {
    console.log('Source data not found at ' + sourcePath + '; skipping creator generation.');
    process.exit(0);
  }

  var result = generate(sourcePath, fs.existsSync(templatePath) ? templatePath : null);

  if (!result.success) {
    console.error('Validation/generation errors:');
    for (var e = 0; e < result.errors.length; e++) {
      console.error('  - ' + result.errors[e]);
    }
    process.exit(1);
  }

  // Write JS output
  fs.mkdirSync(path.dirname(jsOutputPath), { recursive: true });
  fs.writeFileSync(jsOutputPath, result.js, 'utf8');
  console.log('Wrote ' + jsOutputPath);

  // Write HTML template if available
  if (result.html) {
    fs.writeFileSync(templatePath, result.html, 'utf8');
    console.log('Updated ' + templatePath);
  }

  // Idempotency check
  if (result.html) {
    var result2 = generate(sourcePath, templatePath);
    if (!result2.success) {
      console.error('Idempotency check failed:');
      for (var e2 = 0; e2 < result2.errors.length; e2++) {
        console.error('  - ' + result2.errors[e2]);
      }
      process.exit(1);
    }
    if (result.html !== result2.html || result.js !== result2.js) {
      console.error('Idempotency check failed: second run produced different output.');
      process.exit(1);
    }
    console.log('Idempotency check passed.');
  }
}

// ===== EXPORTS =====

module.exports = {
  // Validation
  validateData: validateData,
  // Rendering
  renderFeaturedCreatorHtml: renderFeaturedCreatorHtml,
  renderCreatorSectionsHtml: renderCreatorSectionsHtml,
  renderFeedSummaryHtml: renderFeedSummaryHtml,
  renderCreatorFeedHtml: renderCreatorFeedHtml,
  getVisibleFeedItems: getVisibleFeedItems,
  renderJsonLdHtml: renderJsonLdHtml,
  renderNoscriptHtml: renderNoscriptHtml,
  renderDisclaimerHtml: renderDisclaimerHtml,
  renderJsOutput: renderJsOutput,
  renderVideoCard: renderVideoCard,
  // Escaping
  escapeHtml: escapeHtml,
  escapeJsonLd: escapeJsonLd,
  // Markers
  assertMarkers: assertMarkers,
  replaceMarker: replaceMarker,
  // Integration
  buildData: buildData,
  generate: generate,
  // Constants
  MARKER_PAIRS: MARKER_PAIRS,
  VALID_CATEGORIES: VALID_CATEGORIES,
  VALID_STATUSES: VALID_STATUSES,
  VALID_VIDEO_STATUSES: VALID_VIDEO_STATUSES,
  VIDEO_ID_RE: VIDEO_ID_RE,
  DATE_RE: DATE_RE,
  KEBAB_RE: KEBAB_RE,
  MAX_VIDEOS_PER_CREATOR: MAX_VIDEOS_PER_CREATOR,
  FEATURED_PER_CREATOR: FEATURED_PER_CREATOR,
  RECENT_DAYS: RECENT_DAYS
};
