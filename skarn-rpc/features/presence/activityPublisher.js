const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 5000;
const ACTIVITY_FIELDS = Object.freeze([
  'details',
  'state',
  'largeImageKey',
  'largeImageText',
  'smallImageKey',
  'smallImageText',
  'instance',
  'type',
  'startTimestamp',
  'endTimestamp',
]);

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function stableSerialize(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (isObject(value)) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableSerialize(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hashActivity(activity) {
  return crypto.createHash('sha256').update(stableSerialize(activity), 'utf8').digest('hex');
}

function normalizeActivity(candidate) {
  const source = isObject(candidate) && isObject(candidate.activity)
    ? candidate.activity
    : isObject(candidate) && isObject(candidate.payload) ? candidate.payload : candidate;
  if (!isObject(source)) throw new TypeError('activity candidate must be an object');
  const payload = {};
  ACTIVITY_FIELDS.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(source, field) || source[field] === undefined) return;
    const value = source[field];
    if (['details', 'state', 'largeImageKey', 'largeImageText', 'smallImageKey', 'smallImageText'].includes(field)) {
      if (typeof value !== 'string') throw new TypeError(field + ' must be a string');
      payload[field] = value;
      return;
    }
    if (field === 'instance') {
      payload[field] = Boolean(value);
      return;
    }
    if (field === 'type') {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('type must be a finite number');
      payload[field] = value;
      return;
    }
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) throw new TypeError(field + ' must be a valid date');
      payload[field] = value;
      return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(field + ' must be a finite number or Date');
    payload[field] = value;
  });
  if (!Object.prototype.hasOwnProperty.call(payload, 'details') && !Object.prototype.hasOwnProperty.call(payload, 'state')) {
    throw new TypeError('activity must contain details or state');
  }
  return payload;
}

function getPriority(candidate) {
  return candidate && typeof candidate.priority === 'number' && Number.isFinite(candidate.priority)
    ? candidate.priority
    : 0;
}

function createErrorInfo(error, fallbackCode) {
  return {
    code: error && typeof error.code === 'string' ? error.code : fallbackCode,
    name: error && typeof error.name === 'string' ? error.name : 'Error',
  };
}

function createActivityPublisher(options) {
  const config = options || {};
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS;
  const report = typeof config.logger === 'function' ? config.logger : null;
  let client = null;
  let generation = 0;
  let pending = null;
  let inFlightRequest = null;
  let lastPublishedHash = null;
  let lastPublishedAt = null;
  let lastError = null;
  let sequence = 0;

  function recordError(error, fallbackCode, eventName) {
    lastError = createErrorInfo(error, fallbackCode);
    if (report) {
      try { report(eventName || 'activity_publish_failed', { code: lastError.code, name: lastError.name }); } catch (reportError) {}
    }
  }

  function settle(request, result) {
    if (!request || request.settled) return;
    request.settled = true;
    request.resolve(Boolean(result));
  }

  function safeDestroy(target, detachedGeneration) {
    if (!target || typeof target.destroy !== 'function') return Promise.resolve(false);
    let result;
    try {
      result = target.destroy();
    } catch (error) {
      if (generation === detachedGeneration) recordError(error, 'RPC_CLIENT_DESTROY_FAILED', 'rpc_client_destroy_failed');
      return Promise.resolve(false);
    }
    return Promise.resolve(result).then(() => true, error => {
      if (generation === detachedGeneration) recordError(error, 'RPC_CLIENT_DESTROY_FAILED', 'rpc_client_destroy_failed');
      return false;
    });
  }

  function detachCurrent() {
    const detachedGeneration = generation + 1;
    generation = detachedGeneration;
    const previousClient = client;
    client = null;
    if (pending) settle(pending, false);
    pending = null;
    if (inFlightRequest) settle(inFlightRequest, false);
    inFlightRequest = null;
    lastPublishedHash = null;
    lastPublishedAt = null;
    lastError = { code: 'RPC_CLIENT_DISCONNECTED', name: 'Disconnected' };
    return safeDestroy(previousClient, detachedGeneration);
  }

  function isCurrent(target, targetGeneration) {
    return client === target && generation === targetGeneration;
  }

  function awaitWithTimeout(operation) {
    return new Promise((resolve, reject) => {
      let completed = false;
      const timer = setTimeout(() => {
        if (completed) return;
        completed = true;
        const timeoutError = new Error('RPC activity request timed out');
        timeoutError.code = 'RPC_ACTIVITY_TIMEOUT';
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
      Promise.resolve(operation).then(result => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        resolve(result);
      }, error => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function execute(request, target, targetGeneration) {
    if (!isCurrent(target, targetGeneration)) return Promise.resolve(false);
    let operation;
    try {
      if (request.kind === 'clear') {
        if (typeof target.clearActivity !== 'function') throw new TypeError('RPC client has no clearActivity method');
        operation = target.clearActivity();
      } else {
        if (typeof target.setActivity !== 'function') throw new TypeError('RPC client has no setActivity method');
        operation = target.setActivity(request.payload);
      }
    } catch (error) {
      if (isCurrent(target, targetGeneration)) recordError(error, 'RPC_ACTIVITY_REJECTED');
      return Promise.resolve(false);
    }
    return awaitWithTimeout(operation).then(() => {
      if (!isCurrent(target, targetGeneration)) return false;
      if (request.kind === 'clear') {
        lastPublishedHash = null;
      } else {
        lastPublishedHash = request.hash;
      }
      lastPublishedAt = Date.now();
      lastError = null;
      return true;
    }, error => {
      if (isCurrent(target, targetGeneration)) recordError(error, 'RPC_ACTIVITY_REJECTED');
      return false;
    });
  }

  function drain() {
    if (inFlightRequest || !client || !pending) return;
    const request = pending;
    pending = null;
    request.startedAt = Date.now();
    inFlightRequest = request;
    const target = client;
    const targetGeneration = generation;
    execute(request, target, targetGeneration).then(result => {
      settle(request, result);
    }, error => {
      if (isCurrent(target, targetGeneration)) recordError(error, 'RPC_ACTIVITY_REJECTED');
      settle(request, false);
    }).then(() => {
      if (inFlightRequest !== request) return;
      inFlightRequest = null;
      drain();
    }, () => {
      if (inFlightRequest !== request) return;
      inFlightRequest = null;
      drain();
    });
  }

  function enqueue(request) {
    return new Promise(resolve => {
      request.resolve = resolve;
      request.settled = false;
      if (pending) {
        const replace = request.priority >= pending.priority;
        if (replace) settle(pending, false);
        else {
          settle(request, false);
          return;
        }
      }
      pending = request;
      drain();
    });
  }

  function publish(candidate) {
    let payload;
    try {
      payload = normalizeActivity(candidate);
    } catch (error) {
      recordError(error, 'INVALID_ACTIVITY_CANDIDATE');
      return Promise.resolve(false);
    }
    if (!client) return Promise.resolve(false);
    const hash = hashActivity(payload);
    if (hash === lastPublishedHash) return Promise.resolve(false);
    return enqueue({ kind: 'activity', payload, hash, priority: getPriority(candidate), sequence: sequence++ });
  }

  function clear() {
    if (!client) return Promise.resolve(false);
    return enqueue({ kind: 'clear', payload: null, hash: null, priority: Number.MAX_SAFE_INTEGER, sequence: sequence++ });
  }

  function setClient(nextClient) {
    if (!nextClient) return disconnectClient();
    if (client === nextClient) return Promise.resolve(true);
    if (client || pending || inFlightRequest) disconnectClient();
    generation += 1;
    client = nextClient;
    drain();
    return Promise.resolve(true);
  }

  function disconnectClient() {
    return detachCurrent();
  }

  function getStatus() {
    return {
      connected: Boolean(client),
      pending: Boolean(pending),
      inFlight: Boolean(inFlightRequest),
      lastPublishedHash,
      lastError: lastError ? { ...lastError } : null,
      lastPublishedAt,
    };
  }

  return { clear, disconnectClient, getStatus, publish, setClient };
}

module.exports = {
  ACTIVITY_FIELDS,
  DEFAULT_TIMEOUT_MS,
  createActivityPublisher,
  hashActivity,
  normalizeActivity,
  stableSerialize,
};
