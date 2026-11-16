// Rev904 (audit zone 1): tide height between extremes follows a cosine; the
// time to grounding must be read on that same curve, not on a straight line.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const calcJs = resolve(__dirname, '..', 'dist/calculations.js');

async function load() {
  assert.ok(existsSync(calcJs), 'dist/calculations.js missing — run `npm run build` first');
  return import(pathToFileURL(calcJs).href);
}

const HIGH = { time: '2026-11-16T06:00:00.000Z', value: 3.5, type: 'High' };
const LOW = { time: '2026-11-16T12:00:00.000Z', value: 0.5, type: 'Low' };

test('tide curve: exactly at an extreme gives its height, not NaN', async () => {
  const { approximateTideHeightAt } = await load();
  assert.equal(approximateTideHeightAt([HIGH, LOW], new Date(HIGH.time)), 3.5);
  assert.equal(approximateTideHeightAt([HIGH, LOW], new Date(LOW.time)), 0.5);
});

test('tide curve: 75 % of the drop is reached at 4 h of 6, not at 4 h 30 (straight line)', async () => {
  const { approximateTideHeightAt } = await load();
  const threshold = 3.5 - 0.75 * 3.0; // 1.25 m
  let minutes = null;
  for (let m = 1; m <= 360; m++) {
    const h = approximateTideHeightAt([HIGH, LOW], new Date(Date.parse(HIGH.time) + m * 60_000));
    if (h <= threshold) { minutes = m; break; }
  }
  assert.ok(minutes >= 238 && minutes <= 242, `got ${minutes} min`);
});
