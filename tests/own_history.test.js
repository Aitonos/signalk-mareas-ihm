// Rev920: own true wind and heading history (src/own-history.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const js = resolve(__dirname, '..', 'dist/own-history.js');
async function load() {
  assert.ok(existsSync(js), 'dist/own-history.js missing — run `npm run build` first');
  return import(pathToFileURL(js).href);
}
const D = Math.PI / 180;

test('own history: true wind direction from directionTrue, or heading + angle', async () => {
  const { trueWindDirection, trueHeading } = await load();
  assert.equal(trueWindDirection(200 * D, null, null).toFixed(4), (200 * D).toFixed(4));
  // moored with the bow at 290°, TWA -81° -> wind from 209°
  assert.equal((trueWindDirection(null, 290 * D, -81 * D) / D).toFixed(0), '209');
  assert.equal(trueWindDirection(null, null, -81 * D), null, 'no heading, no direction');
  assert.equal((trueHeading(null, 100 * D, -2 * D) / D).toFixed(0), '98');
});

test('own history: one sample every 30 s, 24 h, survives a save and load', async () => {
  const { OwnHistory } = await load();
  const h = new OwnHistory();
  const t0 = 1_000_000_000_000;
  h.add({ t: t0, tws: 4, twd: 1, hdg: 2 });
  h.add({ t: t0 + 5_000, tws: 5, twd: 1, hdg: 2 });
  assert.equal(h.size(), 1);
  h.add({ t: t0 + 25 * 3600_000, tws: 6, twd: 1, hdg: 2 });
  assert.equal(h.size(), 1, 'the 25 h old sample is gone');
  const h2 = new OwnHistory();
  h2.load(JSON.parse(JSON.stringify(h.toJSON())), t0 + 25 * 3600_000);
  assert.equal(h2.size(), 1);
  assert.equal(h2.at(t0 + 25 * 3600_000 + 10_000).tws, 6);
});
