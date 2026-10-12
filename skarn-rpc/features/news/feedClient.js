const https = require('https');
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_ALLOWED_HOSTS = Object.freeze([
  'www.nasa.gov',
  'github.blog',
  'openai.com',
  'blog.rust-lang.org',
  'blog.playstation.com',
  'www.cisa.gov',
  'www.microsoft.com',
  'kubernetes.io',
  'about.gitlab.com',
  'blog.mozilla.org',
  'www.esa.int',
  'news.xbox.com',
  'blog.cloudflare.com',
  'aws.amazon.com',
  'developer.chrome.com',
  'deepmind.google',
  'developer.nvidia.com',
  'engineering.fb.com',
  'pytorch.org',
  'huggingface.co',
  'machinelearning.apple.com',
  'go.dev',
  'www.postgresql.org',
  'www.ruby-lang.org',
  'www.cncf.io',
  'www.docker.com',
  'www.hashicorp.com',
  'blog.jetbrains.com',
  'www.elastic.co',
  'grafana.com',
  'www.linuxfoundation.org',
  'www.bleepingcomputer.com',
  'www.schneier.com',
  'www.darkreading.com',
  'www.securityweek.com',
  'therecord.media',
  'isc.sans.edu',
  'www.tenable.com',
  'unit42.paloaltonetworks.com',
  'www.crowdstrike.com',
  'www.sciencedaily.com',
  'phys.org',
  'www.sciencenews.org',
  'www.newscientist.com',
  'www.polygon.com',
  'www.eurogamer.net',
  'www.rockpapershotgun.com',
  'www.gamespot.com',
  'feeds.macrumors.com',
  'feeds.bbci.co.uk',
  'github.com',
  'pnpm.io',
  'yarnpkg.com',
  'astral.sh',
  'blog.pypi.org',
  'blog.rubygems.org',
  'blog.packagist.com',
  'thephp.foundation',
  'bun.com',
  'deno.com',
  'www.raspberrypi.com',
  'www.phoronix.com',
  'lwn.net',
  'www.kernel.org',
  'www.w3.org',
  'planet.gnome.org',
  'planet.kde.org',
  'www.drupal.org',
  'wordpress.org',
  'elixir-lang.org',
  'fs.blog',
  'techcrunch.com',
  'slack.engineering',
  'stripe.com',
  'overreacted.io',
  'www.redhat.com',
  'www.theverge.com',
  'www.engadget.com',
  'interestingengineering.com',
  'www.ghacks.net',
  'feeds.arstechnica.com',
  'www.wired.com',
  'securityaffairs.com',
]);
const ACCEPTED_CONTENT_TYPES = new Set([
  'application/atom+xml',
  'application/rdf+xml',
  'application/rss+xml',
  'application/xml',
  'text/xml',
]);
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

function asAllowedHosts(allowlist) {
  const values = allowlist === undefined ? DEFAULT_ALLOWED_HOSTS : allowlist;
  if (!Array.isArray(values) && !(values instanceof Set)) throw new TypeError('allowlist must be an array or Set');
  const immutableHosts = new Set(DEFAULT_ALLOWED_HOSTS);
  const normalized = new Set(Array.from(values).map(value => String(value).toLowerCase().replace(/\.$/, '')));
  if (Array.from(normalized).some(host => !immutableHosts.has(host))) {
    const failure = new Error('requested feed host is outside the immutable approved allowlist');
    failure.code = 'FEED_HOST_NOT_ALLOWED';
    throw failure;
  }
  return normalized;
}

function validateFeedUrl(value, allowlist) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    const failure = new Error('feed URL is invalid');
    failure.code = 'INVALID_FEED_URL';
    throw failure;
  }
  if (parsed.protocol !== 'https:') {
    const failure = new Error('feed URL must use HTTPS');
    failure.code = 'INSECURE_FEED_URL';
    throw failure;
  }
  if (parsed.username || parsed.password) {
    const failure = new Error('feed URL must not contain credentials');
    failure.code = 'FEED_URL_CREDENTIALS';
    throw failure;
  }
  if (net.isIP(parsed.hostname)) {
    const failure = new Error('feed URL must use an approved hostname');
    failure.code = 'FEED_IP_HOST_NOT_ALLOWED';
    throw failure;
  }
  const allowedHosts = asAllowedHosts(allowlist);
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    const failure = new Error('feed host is not allowlisted');
    failure.code = 'FEED_HOST_NOT_ALLOWED';
    throw failure;
  }
  return parsed;
}

function createFeedError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  if (statusCode !== undefined) error.statusCode = statusCode;
  return error;
}

function ipv4Number(address) {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256) + parts[3];
}

function inIpv4Range(number, start, end) {
  return number !== null && number >= start && number <= end;
}

function ipv6Bytes(address) {
  let value = String(address).toLowerCase().split('%', 1)[0];
  if (!value.includes(':')) return null;
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const parsePart = part => {
    if (!part) return [];
    const pieces = part.split(':');
    const output = [];
    for (const piece of pieces) {
      if (piece.includes('.')) {
        const number = ipv4Number(piece);
        if (number === null) return null;
        output.push((number >>> 24) & 255, (number >>> 16) & 255, (number >>> 8) & 255, number & 255);
      } else if (/^[0-9a-f]{1,4}$/.test(piece)) {
        const number = parseInt(piece, 16);
        output.push((number >>> 8) & 255, number & 255);
      } else return null;
    }
    return output;
  };
  const left = parsePart(halves[0]);
  const right = parsePart(halves[1] || '');
  if (!left || !right || (halves.length === 1 && left.length !== 16) || (halves.length === 2 && left.length + right.length >= 16)) return null;
  const bytes = halves.length === 2 ? left.concat(Array(16 - left.length - right.length).fill(0), right) : left;
  return bytes.length === 16 ? bytes : null;
}

function isUnsafeAddress(address) {
  const family = net.isIP(String(address));
  if (family === 4) {
    const number = ipv4Number(address);
    return inIpv4Range(number, 0x00000000, 0x00ffffff)
      || inIpv4Range(number, 0x0a000000, 0x0affffff)
      || inIpv4Range(number, 0x64400000, 0x647fffff)
      || inIpv4Range(number, 0x7f000000, 0x7fffffff)
      || inIpv4Range(number, 0xa9fe0000, 0xa9feffff)
      || inIpv4Range(number, 0xac100000, 0xac1fffff)
      || inIpv4Range(number, 0xc0000000, 0xc00000ff)
      || inIpv4Range(number, 0xc0000200, 0xc00002ff)
      || inIpv4Range(number, 0xc0a80000, 0xc0a8ffff)
      || inIpv4Range(number, 0xc6120000, 0xc613ffff)
      || inIpv4Range(number, 0xc6336400, 0xc63364ff)
      || inIpv4Range(number, 0xcb007100, 0xcb0071ff)
      || inIpv4Range(number, 0xe0000000, 0xffffffff);
  }
  if (family !== 6) return true;
  const bytes = ipv6Bytes(address);
  if (!bytes) return true;
  const first = bytes[0];
  const v4Mapped = bytes.slice(0, 10).every(byte => byte === 0) && bytes[10] === 255 && bytes[11] === 255;
  if (v4Mapped) {
    const mapped = bytes.slice(12).join('.');
    return isUnsafeAddress(mapped);
  }
  return bytes.every(byte => byte === 0)
    || (bytes.slice(0, 15).every(byte => byte === 0) && bytes[15] === 1)
    || (first & 0xfe) === 0xfc
    || (first === 0xfe && (bytes[1] & 0xc0) === 0x80)
    || first >= 0xff
    || (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8);
}

function createSafeLookup(lookup) {
  const resolver = lookup || dns.lookup;
  return (hostname, options, callback) => {
    const lookupOptions = options && typeof options === 'object' ? options : {};
    const done = typeof options === 'function' ? options : callback;
    resolver(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return done(error);
      const entries = Array.isArray(addresses) ? addresses : [{ address: addresses, family: lookupOptions.family || net.isIP(addresses) }];
      if (entries.length === 0 || entries.some(entry => !entry || isUnsafeAddress(entry.address))) {
        return done(createFeedError('feed hostname resolved to a non-public address', 'FEED_DNS_DESTINATION_UNSAFE'));
      }
      if (lookupOptions.all) return done(null, entries);
      return done(null, entries[0].address, entries[0].family);
    });
  };
}

function contentTypeIsAccepted(headers) {
  const value = String(headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  return ACCEPTED_CONTENT_TYPES.has(value);
}

function responseHeaders(headers) {
  return {
    etag: typeof headers.etag === 'string' ? headers.etag : null,
    lastModified: typeof headers['last-modified'] === 'string' ? headers['last-modified'] : null,
  };
}

function requestOnce(parsed, options) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes || DEFAULT_MAX_RESPONSE_BYTES;
  const conditionalHeaders = {};
  if (options.validators && options.validators.etag) conditionalHeaders['If-None-Match'] = options.validators.etag;
  if (options.validators && options.validators.lastModified) conditionalHeaders['If-Modified-Since'] = options.validators.lastModified;

  return new Promise((resolve, reject) => {
    let settled = false;
    let byteCount = 0;
    const chunks = [];
    const request = options.httpsModule.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'skarn-rpc-news/1.0',
        ...conditionalHeaders,
      },
      lookup: createSafeLookup(options.lookup),
    }, response => {
      const headers = response.headers || {};
      const statusCode = Number(response.statusCode) || 0;
      const tlsVerified = response.socket && typeof response.socket.authorized === 'boolean' ? response.socket.authorized : null;
      const contentType = String(headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase() || null;
      if (tlsVerified === false) {
        response.resume();
        return reject(createFeedError('feed TLS certificate was not verified', 'FEED_TLS_INVALID'));
      }
      if (REDIRECT_STATUS_CODES.has(statusCode)) {
        response.resume();
        if (!headers.location) return reject(createFeedError('redirect has no location', 'FEED_REDIRECT_INVALID', statusCode));
        return resolve({ redirect: headers.location, statusCode, headers });
      }
      if (statusCode === 304) {
        response.resume();
        return resolve({ statusCode, body: null, tlsVerified, contentType, ...responseHeaders(headers), headers });
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        return reject(createFeedError('feed returned an HTTP error', 'FEED_HTTP_ERROR', statusCode));
      }
      const declaredLength = Number(headers['content-length']);
      if (Number.isFinite(declaredLength) && (declaredLength < 0 || declaredLength > maxResponseBytes)) {
        response.resume();
        return reject(createFeedError('feed response is too large', 'FEED_RESPONSE_TOO_LARGE'));
      }
      if (!contentTypeIsAccepted(headers)) {
        response.resume();
        return reject(createFeedError('feed content type is not XML', 'FEED_CONTENT_TYPE_INVALID'));
      }
      response.on('data', chunk => {
        if (settled) return;
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        byteCount += buffer.length;
        if (byteCount > maxResponseBytes) {
          settled = true;
          response.resume();
          request.destroy(createFeedError('feed response is too large', 'FEED_RESPONSE_TOO_LARGE'));
          return reject(createFeedError('feed response is too large', 'FEED_RESPONSE_TOO_LARGE'));
        }
        chunks.push(buffer);
      });
      response.on('aborted', () => {
        if (!settled) reject(createFeedError('feed response was aborted', 'FEED_RESPONSE_ABORTED'));
      });
      response.on('error', error => {
        if (!settled) reject(createFeedError('feed response failed', error.code || 'FEED_RESPONSE_FAILED'));
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ statusCode, body: Buffer.concat(chunks).toString('utf8'), tlsVerified, contentType, ...responseHeaders(headers), headers });
      });
    });
    request.setTimeout(timeoutMs, () => {
      if (settled) return;
      settled = true;
      request.destroy(createFeedError('feed request timed out', 'FEED_TIMEOUT'));
      reject(createFeedError('feed request timed out', 'FEED_TIMEOUT'));
    });
    request.on('error', error => {
      if (settled) return;
      settled = true;
      reject(error.code ? error : createFeedError('feed request failed', 'FEED_REQUEST_FAILED'));
    });
    request.end();
  });
}

async function requestFeed(value, options) {
  const settings = options || {};
  const allowlist = settings.allowlist === undefined ? DEFAULT_ALLOWED_HOSTS : settings.allowlist;
  const maxRedirects = settings.maxRedirects === undefined ? DEFAULT_MAX_REDIRECTS : settings.maxRedirects;
  const httpsModule = settings.httpsModule || https;
  let current = validateFeedUrl(value, allowlist);
  const originHost = current.hostname.toLowerCase();
  let redirects = 0;
  while (true) {
    const result = await requestOnce(current, { ...settings, httpsModule });
    if (!result.redirect) return { ...result, url: current.toString(), redirectCount: redirects };
    if (redirects >= maxRedirects) throw createFeedError('feed redirected too many times', 'FEED_REDIRECT_LIMIT');
    const next = validateFeedUrl(new URL(result.redirect, current).toString(), allowlist);
    if (next.hostname.toLowerCase() !== originHost) throw createFeedError('feed redirect changed host', 'FEED_REDIRECT_CROSS_HOST');
    current = next;
    redirects++;
  }
}

module.exports = {
  ACCEPTED_CONTENT_TYPES,
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_TIMEOUT_MS,
  fetchFeed: requestFeed,
  createSafeLookup,
  isUnsafeAddress,
  requestFeed,
  validateFeedUrl,
};
