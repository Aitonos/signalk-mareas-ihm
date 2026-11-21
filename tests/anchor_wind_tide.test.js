// Rev926: anchor from track + own wind + tidal stream (src/anchor-wind-tide.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const js = resolve(__dirname, '..', 'dist/anchor-wind-tide.js');
async function load() {
  assert.ok(existsSync(js), 'dist/anchor-wind-tide.js missing — run `npm run build` first');
  return import(pathToFileURL(js).href);
}
const D = Math.PI / 180, KN = 1.94384;
const A = { lat: 42.2801, lng: -8.7340 };
const at = (brg, m) => ({ lat: A.lat + (m * Math.cos(brg * D)) / 111320, lng: A.lng + (m * Math.sin(brg * D)) / (111320 * Math.cos(A.lat * D)) });
const dist = (p, q) => Math.hypot((p.lat - q.lat) * 111320, (p.lng - q.lng) * 111320 * Math.cos(A.lat * D));
// deterministic noise
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

function scenario(windFromList) {
  const t0 = 1_000_000_000_000, fixes = [], wind = [];
  windFromList.forEach((from, seg) => {
    for (let i = 0; i < 120; i++) {          // 1 h per segment, a fix every 30 s
      const t = t0 + (seg * 120 + i) * 30_000;
      const p = at(from + 180, 20);           // 20 m downwind of the anchor
      fixes.push({ t, lat: p.lat + rnd() * 8 / 111320, lng: p.lng + rnd() * 8 / 111320 });
      wind.push({ t, tws: 15 / KN, twd: from * D });
    }
  });
  return { fixes, wind };
}

test('wind + tide: two wind directions give the anchor and the radius', async () => {
  const { estimateWindTide } = await load();
  const { fixes, wind } = scenario([200, 200, 290, 290]);
  const r = estimateWindTide(fixes, wind, []);
  assert.equal(r.state, 'estimated', r.reason);
  assert.ok(dist({ lat: r.lat, lng: r.lng }, A) < 4, `anchor off by ${dist({ lat: r.lat, lng: r.lng }, A).toFixed(1)} m`);
  assert.ok(Math.abs(r.radiusM - 20) < 3, `radius ${r.radiusM}`);
});

test('wind + tide: one load direction only gives a zone, not a made-up ring', async () => {
  const { estimateWindTide } = await load();
  const { fixes, wind } = scenario([200, 200, 200, 200]);
  const r = estimateWindTide(fixes, wind, []);
  assert.equal(r.state, 'zone');
});

test('wind + tide: stream proxy is + on the flood, - on the ebb, 0 at the turn', async () => {
  const { streamProxy } = await load();
  const ex = [{ t: 0, v: 1, type: 'Low' }, { t: 6 * 3600_000, v: 3.5, type: 'High' }, { t: 12 * 3600_000, v: 1, type: 'Low' }];
  assert.ok(streamProxy(3 * 3600_000, ex) > 0.9);
  assert.ok(streamProxy(9 * 3600_000, ex) < -0.9);
  assert.ok(Math.abs(streamProxy(1, ex)) < 0.01);
});
