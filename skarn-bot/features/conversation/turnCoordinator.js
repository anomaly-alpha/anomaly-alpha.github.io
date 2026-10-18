'use strict';

// A new coordinator is independent of Discord, persistence, and transport. The
// caller supplies plain message records and decides what processing and sending
// mean for its application.

const DEFAULT_ACTIVE_TURN_DEBOUNCE_MS = 1500;
const DEFAULT_DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX_SEEN_MESSAGE_IDS = 10000;

function defaultScheduler() {
  return {
    setTimeout,
    clearTimeout,
    now: Date.now,
  };
}

function makeDeferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function asNonNegativeNumber(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(name + ' must be a finite non-negative number');
  }
  return value;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function timestampToNumber(value) {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function createTurnCoordinator(options = {}) {
  // API: enqueue({ messageId, channelId, authorId, content, createdAt }) returns
  // a promise for that message's turn outcome. processTurn(turn, context) is
  // invoked once per serialized turn. A turn contains same-author rapid
  // messages in chronological order; context.send(payload) and the optional
  // send callback always re-check isEligible immediately before delivery.
  // scheduler supplies setTimeout/clearTimeout (and optionally now) for tests.
  const processTurn = firstDefined(options.processTurn, options.process);
  if (typeof processTurn !== 'function') {
    throw new TypeError('processTurn callback is required');
  }

  const scheduler = options.scheduler || options.timerScheduler || options.timer || defaultScheduler();
  if (typeof scheduler.setTimeout !== 'function' || typeof scheduler.clearTimeout !== 'function') {
    throw new TypeError('scheduler must provide setTimeout and clearTimeout');
  }

  const activeTurnDebounceMs = asNonNegativeNumber(
    firstDefined(options.activeTurnDebounceMs, options.debounceMs),
    DEFAULT_ACTIVE_TURN_DEBOUNCE_MS,
    'activeTurnDebounceMs'
  );
  const deduplicationWindowMs = asNonNegativeNumber(
    options.deduplicationWindowMs,
    DEFAULT_DEDUPLICATION_WINDOW_MS,
    'deduplicationWindowMs'
  );
  const maxSeenMessageIds = options.maxSeenMessageIds === undefined
    ? DEFAULT_MAX_SEEN_MESSAGE_IDS
    : options.maxSeenMessageIds;
  if (!Number.isInteger(maxSeenMessageIds) || maxSeenMessageIds < 1) {
    throw new TypeError('maxSeenMessageIds must be a positive integer');
  }

  const send = firstDefined(options.send, options.sendResponse, options.onSend);
  if (send !== undefined && typeof send !== 'function') {
    throw new TypeError('send callback must be a function');
  }
  const recheckEligibility = firstDefined(options.isEligible, options.recheckEligibility, options.eligibilityRecheck);
  if (recheckEligibility !== undefined && typeof recheckEligibility !== 'function') {
    throw new TypeError('isEligible callback must be a function');
  }

  const channels = new Map();
  const seenMessageIds = new Map();
  const idleWaiters = new Map();
  let sequence = 0;

  function now() {
    if (typeof scheduler.now === 'function') return scheduler.now();
    if (typeof scheduler.now === 'number' && Number.isFinite(scheduler.now)) return scheduler.now;
    return Date.now();
  }

  function normalizeMessage(input) {
    if (!input || typeof input !== 'object') {
      throw new TypeError('message must be an object');
    }

    const messageId = firstDefined(input.messageId, input.id);
    const channelId = firstDefined(input.channelId, input.channel);
    const authorId = firstDefined(input.authorId, input.userId, input.author);
    if (messageId === undefined || messageId === '') throw new TypeError('messageId is required');
    if (channelId === undefined || channelId === '') throw new TypeError('channelId is required');
    if (authorId === undefined || authorId === '') throw new TypeError('authorId is required');

    const receivedAt = now();
    const createdAt = firstDefined(
      timestampToNumber(input.createdAt),
      timestampToNumber(input.timestamp),
      timestampToNumber(input.createdTimestamp),
      receivedAt
    );
    const deferred = makeDeferred();

    const message = {
      messageId: String(messageId),
      channelId: String(channelId),
      authorId: String(authorId),
      content: input.content === undefined || input.content === null ? '' : String(input.content),
      createdAt,
      timestamp: createdAt,
      receivedAt,
      referenceMessageId: firstDefined(input.referenceMessageId, input.replyToId),
      sequence: ++sequence,
      deferred,
    };
    if (input.metadata !== undefined) message.metadata = input.metadata;
    return message;
  }

  function pruneSeenMessageIds(currentTime) {
    for (const [messageId, seenAt] of seenMessageIds) {
      if (currentTime - seenAt > deduplicationWindowMs) seenMessageIds.delete(messageId);
    }
    while (seenMessageIds.size > maxSeenMessageIds) {
      seenMessageIds.delete(seenMessageIds.keys().next().value);
    }
  }

  function getOrCreateChannel(channelId) {
    let state = channels.get(channelId);
    if (!state) {
      state = {
        channelId,
        pending: [],
        processing: null,
        timer: null,
        cleanupTimer: null,
        debouncing: false,
        started: false,
        lastActivityAt: now(),
        cancelVersion: 0,
      };
      channels.set(channelId, state);
    }
    return state;
  }

  function clearTimer(state) {
    if (state.timer !== null) {
      scheduler.clearTimeout(state.timer);
      state.timer = null;
    }
  }

  function clearCleanupTimer(state) {
    if (state.cleanupTimer !== null) {
      scheduler.clearTimeout(state.cleanupTimer);
      state.cleanupTimer = null;
    }
  }

  function resolveIdleWaiters(channelId) {
    const waiters = idleWaiters.get(channelId);
    if (!waiters) return;
    idleWaiters.delete(channelId);
    for (const resolve of waiters) resolve();
  }

  function resolveWhenIdle(state) {
    if (state.processing || state.pending.length > 0) return;
    resolveIdleWaiters(state.channelId);
  }

  function cleanupIfIdle(state) {
    if (state.processing || state.pending.length > 0 || state.timer !== null || state.cleanupTimer !== null) return;
    if (channels.get(state.channelId) === state) {
      channels.delete(state.channelId);
      resolveIdleWaiters(state.channelId);
    }
  }

  function scheduleCleanup(state) {
    if (state.processing || state.pending.length > 0) return;
    clearCleanupTimer(state);
    const delay = Math.max(0, state.lastActivityAt + activeTurnDebounceMs - now());
    if (delay === 0) {
      cleanupIfIdle(state);
      return;
    }
    state.cleanupTimer = scheduler.setTimeout(() => {
      state.cleanupTimer = null;
      cleanupIfIdle(state);
    }, delay);
  }

  function makePublicMessage(message) {
    const result = {
      messageId: message.messageId,
      channelId: message.channelId,
      authorId: message.authorId,
      content: message.content,
      createdAt: message.createdAt,
      timestamp: message.timestamp,
      receivedAt: message.receivedAt,
    };
    if (message.referenceMessageId !== undefined) result.referenceMessageId = message.referenceMessageId;
    if (message.metadata !== undefined) result.metadata = message.metadata;
    return result;
  }

  function makeTurn(state, batch) {
    const messages = batch
      .slice()
      .sort((left, right) => left.createdAt - right.createdAt || left.sequence - right.sequence)
      .map(makePublicMessage);
    return {
      channelId: state.channelId,
      authorId: messages[0].authorId,
      authorIds: [messages[0].authorId],
      messages,
      messageIds: messages.map((message) => message.messageId),
      content: messages.map((message) => message.content).join('\n'),
      firstMessage: messages[0],
      lastMessage: messages[messages.length - 1],
    };
  }

  function peekBatch(state) {
    if (state.pending.length === 0) return [];
    const first = state.pending[0];
    const batch = [first];
    for (let index = 1; index < state.pending.length; index += 1) {
      const candidate = state.pending[index];
      const previous = batch[batch.length - 1];
      if (candidate.authorId !== first.authorId) break;
      if (candidate.receivedAt - previous.receivedAt > activeTurnDebounceMs) break;
      batch.push(candidate);
    }
    return batch;
  }

  function batchDeadline(batch) {
    return batch[batch.length - 1].receivedAt + activeTurnDebounceMs;
  }

  function eligibilityResult(value) {
    if (value && typeof value === 'object') {
      if (value.allowed !== undefined) return Boolean(value.allowed);
      if (value.eligible !== undefined) return Boolean(value.eligible);
    }
    return Boolean(value);
  }

  async function checkEligibility(state, processing, turn, payload) {
    if (state.cancelVersion !== processing.cancelVersion) {
      return { allowed: false, reason: 'cancelled' };
    }
    if (!recheckEligibility) return { allowed: true };
    try {
      const value = await recheckEligibility(turn, payload);
      return eligibilityResult(value)
        ? { allowed: true }
        : { allowed: false, reason: 'ineligible' };
    } catch (error) {
      return { allowed: false, reason: 'eligibility-error', error };
    }
  }

  async function deliver(state, processing, turn, payload, sendOutcomes) {
    const eligibility = await checkEligibility(state, processing, turn, payload);
    if (!eligibility.allowed) {
      const outcome = {
        sent: false,
        suppressed: true,
        reason: eligibility.reason,
      };
      sendOutcomes.push(outcome);
      return outcome;
    }

    try {
      const value = send ? await send(payload, turn) : payload;
      const outcome = { sent: true, value };
      sendOutcomes.push(outcome);
      return outcome;
    } catch (error) {
      const outcome = { sent: false, error, reason: 'send-error' };
      sendOutcomes.push(outcome);
      return outcome;
    }
  }

  function settleBatch(batch, outcome) {
    for (const message of batch) {
      message.deferred.resolve({
        ...outcome,
        messageId: message.messageId,
      });
    }
  }

  function startNext(state) {
    if (state.processing || state.pending.length === 0) {
      cleanupIfIdle(state);
      return;
    }

    clearTimer(state);
    clearCleanupTimer(state);
    state.debouncing = false;
    state.started = true;
    const selected = peekBatch(state);
    state.pending.splice(0, selected.length);
    const turn = makeTurn(state, selected);
    const processing = {
      batch: selected,
      turn,
      cancelVersion: state.cancelVersion,
      sendOutcomes: [],
      sendCalled: false,
    };
    state.processing = processing;

    const context = {
      channelId: state.channelId,
      isEligible: (payload) => checkEligibility(state, processing, turn, payload).then((result) => result.allowed),
      send: async (payload) => {
        processing.sendCalled = true;
        return deliver(state, processing, turn, payload, processing.sendOutcomes);
      },
      cancelled: () => state.cancelVersion !== processing.cancelVersion,
      signal: {
        get aborted() {
          return state.cancelVersion !== processing.cancelVersion;
        },
      },
    };

    let processPromise;
    try {
      // Calling the callback before Promise.resolve preserves the immediate
      // opener path; later turns are delayed only by the active-turn debounce.
      processPromise = processTurn(turn, context);
    } catch (error) {
      processPromise = Promise.reject(error);
    }

    Promise.resolve(processPromise).then(async (result) => {
      if (state.cancelVersion !== processing.cancelVersion) {
        return { status: 'cancelled', reason: 'cancelled', turn };
      }

      if (send && result !== undefined && !processing.sendCalled && !(result && result.send === false)) {
        await deliver(state, processing, turn, result, processing.sendOutcomes);
      }

      const suppressed = processing.sendOutcomes.find((outcome) => outcome.suppressed);
      if (suppressed) {
        return { status: 'suppressed', reason: suppressed.reason, result, turn };
      }
      const sendError = processing.sendOutcomes.find((outcome) => outcome.error);
      if (sendError) {
        return { status: 'error', phase: 'send', error: sendError.error, result, turn };
      }
      return { status: 'processed', result, sent: processing.sendOutcomes.some((outcome) => outcome.sent), turn };
    }).catch((error) => ({ status: 'error', phase: 'process', error, turn }))
      .then((outcome) => {
        state.processing = null;
        settleBatch(selected, outcome);
        if (state.pending.length > 0) {
          scheduleNext(state);
        } else {
          resolveWhenIdle(state);
          scheduleCleanup(state);
        }
      });
  }

  function scheduleNext(state) {
    if (state.processing || state.pending.length === 0) {
      cleanupIfIdle(state);
      return;
    }

    clearTimer(state);
    state.debouncing = true;
    const delay = batchDeadline(peekBatch(state)) - now();
    if (delay <= 0) {
      state.debouncing = false;
      startNext(state);
      return;
    }

    state.timer = scheduler.setTimeout(() => {
      state.timer = null;
      state.debouncing = false;
      startNext(state);
    }, delay);
  }

  function enqueue(input) {
    const message = normalizeMessage(input);
    const currentTime = message.receivedAt;
    pruneSeenMessageIds(currentTime);
    if (seenMessageIds.has(message.messageId)) {
      return Promise.resolve({ status: 'duplicate', duplicate: true, messageId: message.messageId });
    }
    seenMessageIds.set(message.messageId, currentTime);
    pruneSeenMessageIds(currentTime);

    const state = getOrCreateChannel(message.channelId);
    clearCleanupTimer(state);
    state.lastActivityAt = message.receivedAt;
    const wasEmpty = state.pending.length === 0;
    state.pending.push(message);

    if (!state.processing) {
      if (state.debouncing) {
        scheduleNext(state);
      } else if (wasEmpty && !state.started) {
        // A channel with no active exchange starts at once; this is the new
        // opener path and intentionally does not pay the 1.5s debounce.
        startNext(state);
      } else {
        scheduleNext(state);
      }
    }

    return message.deferred.promise;
  }

  function cancel(channelId) {
    const key = String(channelId);
    const state = channels.get(key);
    if (!state) return 0;

    state.cancelVersion += 1;
    clearTimer(state);
    clearCleanupTimer(state);
    state.debouncing = false;
    const cancelled = state.pending.splice(0);
    settleBatch(cancelled, { status: 'cancelled', reason: 'cancelled', turn: null });
    const count = cancelled.length + (state.processing ? state.processing.batch.length : 0);
    if (state.processing) {
      resolveWhenIdle(state);
    } else {
      cleanupIfIdle(state);
    }
    return count;
  }

  function whenIdle(channelId) {
    const key = String(channelId);
    const state = channels.get(key);
    if (!state || (!state.processing && state.pending.length === 0)) return Promise.resolve();
    return new Promise((resolve) => {
      const waiters = idleWaiters.get(key) || [];
      waiters.push(resolve);
      idleWaiters.set(key, waiters);
    });
  }

  function getState(channelId) {
    const state = channels.get(String(channelId));
    if (!state) return null;
    return {
      channelId: state.channelId,
      processing: Boolean(state.processing),
      currentMessageIds: state.processing ? state.processing.turn.messageIds.slice() : [],
      pendingCount: state.pending.length,
      pendingMessageIds: state.pending.map((message) => message.messageId),
      debouncing: state.debouncing,
    };
  }

  function getStats() {
    let pendingCount = 0;
    let processingCount = 0;
    for (const state of channels.values()) {
      pendingCount += state.pending.length;
      if (state.processing) processingCount += 1;
    }
    return {
      channelCount: channels.size,
      pendingCount,
      processingCount,
      seenMessageIdCount: seenMessageIds.size,
    };
  }

  return {
    enqueue,
    submit: enqueue,
    cancel,
    whenIdle,
    getState,
    getStats,
    get channelCount() {
      return channels.size;
    },
    activeTurnDebounceMs,
  };
}

module.exports = {
  createTurnCoordinator,
  DEFAULT_ACTIVE_TURN_DEBOUNCE_MS,
};
