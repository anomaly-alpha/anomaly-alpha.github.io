'use strict';

const assert = require('assert');
const {
  createTurnCoordinator,
  DEFAULT_ACTIVE_TURN_DEBOUNCE_MS,
} = require('../../features/conversation/turnCoordinator');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fakeScheduler() {
  let currentTime = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimeoutFake(callback, delay) {
    const id = nextId++;
    timers.set(id, { id, due: currentTime + delay, callback });
    return id;
  }

  function clearTimeoutFake(id) {
    timers.delete(id);
  }

  async function advance(milliseconds) {
    const target = currentTime + milliseconds;
    while (true) {
      let next = null;
      for (const timer of timers.values()) {
        if (timer.due <= target && (!next || timer.due < next.due || timer.id < next.id)) next = timer;
      }
      if (!next) break;
      currentTime = next.due;
      timers.delete(next.id);
      next.callback();
      await Promise.resolve();
    }
    currentTime = target;
    await Promise.resolve();
  }

  return {
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    now: () => currentTime,
    advance,
    pendingTimerCount: () => timers.size,
  };
}

function message(id, authorId, channelId = 'channel-a', createdAt) {
  return {
    messageId: id,
    authorId,
    channelId,
    content: id,
    createdAt,
  };
}

async function main() {
  assert.strictEqual(DEFAULT_ACTIVE_TURN_DEBOUNCE_MS, 1500);

  const scheduler = fakeScheduler();
  const calls = [];
  const running = [];
  const coordinator = createTurnCoordinator({
    activeTurnDebounceMs: 1500,
    scheduler,
    processTurn: (turn) => {
      calls.push(turn);
      const work = deferred();
      running.push(work);
      return work.promise;
    },
  });

  const sourceMetadata = { sourceMessage: { id: 'discord-a-1' } };
  const opener = coordinator.enqueue({
    ...message('a-1', 'alice', 'channel-a', 0),
    metadata: sourceMetadata,
  });
  assert.strictEqual(calls.length, 1, 'a new opener starts immediately');
  assert.deepStrictEqual(calls[0].messageIds, ['a-1']);
  assert.strictEqual(calls[0].messages[0].metadata, sourceMetadata, 'optional message metadata reaches the turn processor');

  scheduler.advance(100);
  const aliceSecond = coordinator.enqueue(message('a-2', 'alice', 'channel-a', 100));
  scheduler.advance(100);
  const aliceThird = coordinator.enqueue(message('a-3', 'alice', 'channel-a', 200));
  scheduler.advance(100);
  const bobFirst = coordinator.enqueue(message('b-1', 'bob', 'channel-a', 300));
  scheduler.advance(100);
  const bobSecond = coordinator.enqueue(message('b-2', 'bob', 'channel-a', 400));
  const duplicate = coordinator.enqueue(message('a-2', 'alice', 'channel-a', 401));
  const duplicateResult = await duplicate;
  assert.strictEqual(duplicateResult.status, 'duplicate', 'Discord message IDs are idempotent');
  assert.deepStrictEqual(coordinator.getState('channel-a').pendingMessageIds, ['a-2', 'a-3', 'b-1', 'b-2']);

  running.shift().resolve('opener complete');
  await opener;
  assert.strictEqual(calls.length, 1, 'arrivals during processing wait for the next turn');
  assert.strictEqual(scheduler.pendingTimerCount(), 1, 'active turns use a deterministic debounce timer');

  await scheduler.advance(1299);
  assert.strictEqual(calls.length, 1, 'rapid messages remain debounced');
  await scheduler.advance(1);
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[1].messageIds, ['a-2', 'a-3'], 'same-author rapid messages merge chronologically');
  assert.strictEqual(calls[1].content, 'a-2\na-3');
  assert.deepStrictEqual(coordinator.getState('channel-a').pendingMessageIds, ['b-1', 'b-2']);

  running.shift().resolve('alice complete');
  await Promise.all([aliceSecond, aliceThird]);
  await scheduler.advance(300);
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(calls[2].messageIds, ['b-1', 'b-2'], 'another user is not merged into the first user');
  assert.deepStrictEqual(calls.map((turn) => turn.authorId), ['alice', 'alice', 'bob']);

  running.shift().resolve('bob complete');
  await Promise.all([bobFirst, bobSecond]);
  await Promise.all([opener, aliceSecond, aliceThird, bobFirst, bobSecond]);
  await coordinator.whenIdle('channel-a');
  assert.strictEqual(coordinator.channelCount, 0, 'idle channel state is cleaned up');

  const fastScheduler = fakeScheduler();
  const fastCalls = [];
  const fast = createTurnCoordinator({
    scheduler: fastScheduler,
    processTurn: (turn) => {
      fastCalls.push(turn);
      return turn.content;
    },
  });
  const fastOpener = fast.enqueue(message('fast-1', 'alice', 'channel-fast', 0));
  await fastOpener;
  await fastScheduler.advance(100);
  const fastFollowUp = fast.enqueue(message('fast-2', 'alice', 'channel-fast', 100));
  assert.strictEqual(fastCalls.length, 1, 'a fast completed opener still starts an active-turn debounce');
  await fastScheduler.advance(1499);
  assert.strictEqual(fastCalls.length, 1);
  await fastScheduler.advance(1);
  await fastFollowUp;
  assert.deepStrictEqual(fastCalls[1].messageIds, ['fast-2']);
  assert.strictEqual(fast.channelCount, 0, 'fast channel state is cleaned after its active window');

  const suppressionScheduler = fakeScheduler();
  let eligible = true;
  let sent = 0;
  let processed = 0;
  let contextEligible = true;
  const suppression = createTurnCoordinator({
    scheduler: suppressionScheduler,
    processTurn: async (turn, context) => {
      processed += 1;
      contextEligible = await context.isEligible();
      return 'reply';
    },
    isEligible: () => eligible,
    send: async () => { sent += 1; },
  });
  eligible = false;
  const suppressed = await suppression.enqueue(message('s-1', 'alice', 'channel-s', 0));
  assert.strictEqual(processed, 1, 'processing remains injectable and transport-free');
  assert.strictEqual(contextEligible, false, 'the turn context exposes the eligibility recheck');
  assert.strictEqual(suppressed.status, 'suppressed', 'eligibility is rechecked before send');
  assert.strictEqual(sent, 0, 'ineligible turns are not sent');

  const cancellationScheduler = fakeScheduler();
  const cancellationWork = deferred();
  let cancellationSent = 0;
  const cancellable = createTurnCoordinator({
    scheduler: cancellationScheduler,
    processTurn: () => cancellationWork.promise,
    send: async () => { cancellationSent += 1; },
  });
  const inFlight = cancellable.enqueue(message('c-1', 'alice', 'channel-c', 0));
  cancellable.cancel('channel-c');
  cancellationWork.resolve('late reply');
  const cancelled = await inFlight;
  assert.strictEqual(cancelled.status, 'cancelled', 'caller cancellation suppresses an in-flight turn');
  assert.strictEqual(cancellationSent, 0);
  await cancellable.whenIdle('channel-c');
  await cancellationScheduler.advance(1500);
  assert.strictEqual(cancellable.channelCount, 0);

  console.log('turn coordinator smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
