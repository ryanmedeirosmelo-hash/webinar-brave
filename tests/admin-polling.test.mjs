import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVisiblePolling } from '../src/lib/visible-polling.ts';

function environment(t) {
  const doc = new EventTarget();
  doc.hidden = false;
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    const id = ++sequence;
    timers.set(id, callback);
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', (id) => timers.delete(id));
  const previous = globalThis.document;
  globalThis.document = doc;
  t.after(() => { globalThis.document = previous; });
  let sequence = 0;
  const timers = new Map();
  return {
    timers,
    visibility(hidden) { doc.hidden = hidden; doc.dispatchEvent(new Event('visibilitychange')); },
    async tick() {
      const callbacks = [...timers.values()];
      timers.clear();
      await Promise.all(callbacks.map((callback) => callback()));
    },
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('pauses hidden tabs and refreshes immediately on return', async (t) => {
  const env = environment(t);
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 10000);
  assert.equal(calls, 0);
  assert.equal(env.timers.size, 1);
  env.visibility(true);
  assert.equal(env.timers.size, 0);
  await env.tick();
  assert.equal(calls, 0);
  env.visibility(false);
  await flush();
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 1);
  stop();
  env.visibility(false);
  await env.tick();
  assert.equal(calls, 1);
});

test('slow requests cannot overlap, and cleanup prevents scheduling', async (t) => {
  const env = environment(t);
  let calls = 0;
  let release;
  const stop = startVisiblePolling(() => {
    calls++;
    return new Promise((resolve) => { release = resolve; });
  }, 10000, { immediate: true });
  env.visibility(true);
  env.visibility(false);
  env.visibility(false);
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
  stop();
  release();
  await flush();
  assert.equal(env.timers.size, 0);
});

test('retries after transient errors', async (t) => {
  const env = environment(t);
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; throw new Error('offline'); }, 10000);
  await env.tick();
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 1);
  await env.tick();
  assert.equal(calls, 2);
  stop();
});

test('historical reports load once even if initially hidden', async (t) => {
  const env = environment(t);
  env.visibility(true);
  let calls = 0;
  const stop = startVisiblePolling(async () => { calls++; }, 10000, { immediate: true, repeat: false });
  assert.equal(calls, 0);
  env.visibility(false);
  await flush();
  env.visibility(true);
  env.visibility(false);
  await env.tick();
  assert.equal(calls, 1);
  assert.equal(env.timers.size, 0);
  stop();
});
