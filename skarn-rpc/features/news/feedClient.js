const https = require('https');
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
  return new Set(Array.from(values).map(value => String(value).toLowerCase().replace(/\.$/, '')));
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
    }, response => {
      const headers = response.headers || {};
      const statusCode = Number(response.statusCode) || 0;
      if (REDIRECT_STATUS_CODES.has(statusCode)) {
        response.resume();
        if (!headers.location) return reject(createFeedError('redirect has no location', 'FEED_REDIRECT_INVALID', statusCode));
        return resolve({ redirect: headers.location, statusCode, headers });
      }
      if (statusCode === 304) {
        response.resume();
        return resolve({ statusCode, body: null, ...responseHeaders(headers), headers });
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
        resolve({ statusCode, body: Buffer.concat(chunks).toString('utf8'), ...responseHeaders(headers), headers });
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
  let redirects = 0;
  while (true) {
    const result = await requestOnce(current, { ...settings, httpsModule });
    if (!result.redirect) return { ...result, url: current.toString() };
    if (redirects >= maxRedirects) throw createFeedError('feed redirected too many times', 'FEED_REDIRECT_LIMIT');
    current = validateFeedUrl(new URL(result.redirect, current).toString(), allowlist);
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
  requestFeed,
  validateFeedUrl,
};
