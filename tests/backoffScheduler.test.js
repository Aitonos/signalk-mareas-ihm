/**
 * Rev875: unit tests para BackoffScheduler.
 * Verifica el comportamiento determinístico del helper compartido
 * usado por los 3 clientes AIS online (aisstream, aishub, aisfriends).
 *
 * Los tests inyectan `random: () => 0.5` para eliminar el jitter (queda
 * factor 1.0), asi los deltas son exactos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BackoffScheduler } from '../dist/util/backoffScheduler.js';

const DEFAULT_OPTS = {
  normalMinMs: 5_000,
  normalMaxMs: 60_000,
  rateLimitMinMs: 60_000,
  rateLimitMaxMs: 30 * 60_000,
  random: () => 0.5, // sin jitter (factor 1.0)
};

test('BackoffScheduler starts in normal regime at normal min', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  const snap = b.getSnapshot(0);
  assert.equal(snap.rateLimitBackoffActive, false);
  assert.equal(snap.currentMs, 5_000);
});

test('onRateLimit switches regime and jumps to rateLimitMin', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  b.onRateLimit();
  const snap = b.getSnapshot(0);
  assert.equal(snap.rateLimitBackoffActive, true);
  assert.equal(snap.currentMs, 60_000);
});

test('onRateLimit repeated doubles the delay in rate-limit regime', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 60_000);
  b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 120_000);
  b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 240_000);
});

test('onRateLimit is capped at rateLimitMax', () => {
  const b = new BackoffScheduler({ ...DEFAULT_OPTS, rateLimitMaxMs: 300_000 });
  for (let i = 0; i < 20; i++) b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 300_000);
});

test('onSuccess resets to normal regime at normalMin', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  b.onRateLimit();
  b.onRateLimit();
  b.onRateLimit();
  b.onSuccess();
  const snap = b.getSnapshot(0);
  assert.equal(snap.rateLimitBackoffActive, false);
  assert.equal(snap.currentMs, 5_000);
});

test('onTransientError in normal regime doubles up to normalMax cap', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 10_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 20_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 40_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 60_000); // cap
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 60_000); // sigue en cap
});

test('onTransientError in rate-limit regime respects rateLimitMax cap', () => {
  const b = new BackoffScheduler({ ...DEFAULT_OPTS, rateLimitMaxMs: 300_000 });
  b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 60_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 120_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 240_000);
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 300_000); // cap rate-limit
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 300_000);
});

test('nextDelay returns currentMs when jitter=0', () => {
  const b = new BackoffScheduler({ ...DEFAULT_OPTS, jitterFraction: 0 });
  const d = b.nextDelay(0);
  assert.equal(d, 5_000);
});

test('nextDelay with jitter and random=0.5 returns unchanged currentMs', () => {
  // random()=0.5 → (0.5*2*j - j) = 0 → factor 1.0
  const b = new BackoffScheduler(DEFAULT_OPTS);
  const d = b.nextDelay(0);
  assert.equal(d, 5_000);
});

test('nextDelay with random=1.0 applies +jitter', () => {
  const b = new BackoffScheduler({ ...DEFAULT_OPTS, random: () => 1.0 });
  // factor = 1 + (1.0*2*0.2 - 0.2) = 1.2 → 5000 * 1.2 = 6000
  const d = b.nextDelay(0);
  assert.equal(d, 6_000);
});

test('nextDelay with random=0.0 applies -jitter', () => {
  const b = new BackoffScheduler({ ...DEFAULT_OPTS, random: () => 0.0 });
  // factor = 1 + (0*2*0.2 - 0.2) = 0.8 → 5000 * 0.8 = 4000
  const d = b.nextDelay(0);
  assert.equal(d, 4_000);
});

test('nextDelay respects minDelayMs floor', () => {
  const b = new BackoffScheduler({
    ...DEFAULT_OPTS,
    normalMinMs: 100,
    normalMaxMs: 200,
    minDelayMs: 1_000,
    random: () => 0.0, // -20% jitter -> 100 * 0.8 = 80 < 1000
  });
  const d = b.nextDelay(0);
  assert.equal(d, 1_000);
});

test('nextDelay updates nextAttemptAtMs snapshot', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  b.nextDelay(10_000); // now=10000
  const snap = b.getSnapshot(10_000);
  // wait = 5000 (jitter 0.5 = factor 1.0), nextAttempt en 15000
  assert.equal(snap.nextAttemptInMs, 5_000);
  // 3 segundos después, quedan 2 s
  const snap2 = b.getSnapshot(13_000);
  assert.equal(snap2.nextAttemptInMs, 2_000);
});

test('full lifecycle: normal -> rate-limit -> success -> normal again', () => {
  const b = new BackoffScheduler(DEFAULT_OPTS);
  assert.equal(b.getSnapshot(0).rateLimitBackoffActive, false);
  b.onTransientError();
  b.onTransientError();
  assert.equal(b.getSnapshot(0).currentMs, 20_000);
  assert.equal(b.getSnapshot(0).rateLimitBackoffActive, false);

  b.onRateLimit();
  assert.equal(b.getSnapshot(0).rateLimitBackoffActive, true);
  assert.equal(b.getSnapshot(0).currentMs, 60_000); // salta a rate-limit min
  b.onRateLimit();
  assert.equal(b.getSnapshot(0).currentMs, 120_000);

  b.onSuccess();
  assert.equal(b.getSnapshot(0).rateLimitBackoffActive, false);
  assert.equal(b.getSnapshot(0).currentMs, 5_000); // vuelta al min normal
});
