// Rev916: the other boats' history and our own anchor estimate live in the
// backend (src/anchor-history.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const js = resolve(__dirname, '..', 'dist/anchor-history.js');
async function load() {
  assert.ok(existsSync(js), 'dist/anchor-history.js missing — run `npm run build` first');
  return import(pathToFileURL(js).href);
}

const A = { lat: 42.2801, lng: -8.7340 };   // anchor
const at = (bearingDeg, m) => {
  const b = bearingDeg * Math.PI / 180;
  return { lat: A.lat + (m * Math.cos(b)) / 111320, lng: A.lng + (m * Math.sin(b)) / (111320 * Math.cos(A.lat * Math.PI / 180)) };
};

test('anchor history: one fix every 30 s, older than 3 h dropped', async () => {
  const { AnchorHistory } = await load();
  const h = new AnchorHistory();
  const t0 = 1_000_000_000_000;
  h.add('227355930', A.lat, A.lng, t0);
  h.add('227355930', A.lat, A.lng, t0 + 10_000);           // too soon
  assert.equal(h.get('227355930').length, 1);
  h.add('227355930', A.lat, A.lng, t0 + 4 * 3600_000);     // 4 h later
  assert.equal(h.get('227355930').length, 1, 'the 4 h old fix is gone');
  h.prune(t0 + 8 * 3600_000);
  assert.equal(h.size(), 0, 'a boat not heard for 3 h is forgotten');
});

test('anchor history: estimate near the swing centre, radius of the antenna swing', async () => {
  const { AnchorHistory } = await load();
  const h = new AnchorHistory();
  const t0 = 1_000_000_000_000;
  // swinging 15 m from the anchor over a 120° arc, a fix every 30 s for 1 h
  for (let i = 0; i < 120; i++) {
    const p = at(200 + (i % 40) * 3, 15);
    h.add('227355930', p.lat, p.lng, t0 + i * 30_000);
  }
  const e = h.estimate('227355930', 0, t0 + 120 * 30_000);
  assert.ok(e, 'estimated');
  assert.ok(e.radiusM > 3 && e.radiusM < 15, `radius ${e.radiusM}`);
  assert.ok(e.points >= 100);
});

test('anchor history: no estimate while moving, with too few fixes, or after a long drift', async () => {
  const { AnchorHistory, estimateFromFixes } = await load();
  const h = new AnchorHistory();
  const t0 = 1_000_000_000_000;
  for (let i = 0; i < 10; i++) h.add('1', A.lat, A.lng, t0 + i * 30_000);
  assert.equal(h.estimate('1', 3, t0 + 300_000), null, 'moving at 3 kn');
  assert.equal(estimateFromFixes([{ t: t0, ...A }], 0, t0), null, 'one fix');
  const drift = [0, 1, 2, 3, 4].map((i) => ({ t: t0 + i * 30_000, ...at(90, i * 100) }));
  assert.equal(estimateFromFixes(drift, 0, t0 + 150_000), null, '400 m drift is not an anchorage');
});

test('anchor fits track: an anchor whose radius the track goes far beyond is not trusted (Rev918, OHANA)', async () => {
  const { anchorFitsTrack } = await load();
  const t0 = 1_000_000_000_000;
  // the boat swings 25 m around A for an hour
  const fixes = Array.from({ length: 120 }, (_, i) => ({ t: t0 + i * 30_000, ...at(i * 3, 25) }));
  const now = t0 + 120 * 30_000;
  assert.equal(anchorFitsTrack(fixes, A, 8, now).fits, false, 'radius 8 m, boat 25 m away');
  assert.equal(anchorFitsTrack(fixes, A, 20, now).fits, true, 'radius 20 m: within the 10 m class B noise');
  assert.equal(anchorFitsTrack(fixes.slice(0, 5), A, 8, now).fits, true, 'too few fixes to tell');
});

test('current anchorage: the passage that led to the anchorage is cut (Rev922)', async () => {
  const { currentAnchorage } = await load();
  const t0 = 1_000_000_000_000;
  const fixes = [];
  // 1 h under way at 5 kn heading north, then 3 h swinging at anchor
  for (let i = 0; i < 120; i++) fixes.push({ t: t0 + i * 30_000, ...at(180, 9260 - i * 77) });
  const tAnch = t0 + 120 * 30_000;
  for (let i = 0; i < 360; i++) fixes.push({ t: tAnch + i * 30_000, ...at(i * 2, 20) });
  const cut = currentAnchorage(fixes);
  assert.ok(cut[0].t >= tAnch - 600_000, 'starts at the anchorage (within one or two 5-min bins)');
  assert.ok(cut.length >= 340);
  const since = currentAnchorage(fixes, tAnch + 3600_000);
  assert.equal(since[0].t, tAnch + 3600_000, "anchor-mapper's since cuts later");
});

test('anchor history: no estimate from a few minutes of fixes, and a seed merges in time order (Rev922)', async () => {
  const { AnchorHistory } = await load();
  const h = new AnchorHistory();
  const t0 = 1_000_000_000_000;
  for (let i = 0; i < 25; i++) { const p = at(i * 7, 15); h.add('1', p.lat, p.lng, t0 + i * 30_000); }  // 12 min
  assert.equal(h.estimate('1', 0, t0 + 25 * 30_000), null, '12 minutes is not enough');
  const older = Array.from({ length: 100 }, (_, i) => ({ t: t0 - (100 - i) * 30_000, ...at(i * 3, 15) }));
  h.seed('1', older, t0 + 25 * 30_000);
  const all = h.get('1');
  assert.ok(all.length >= 120);
  assert.ok(all.every((f, i) => i === 0 || f.t > all[i - 1].t), 'in time order');
  assert.ok(h.estimate('1', 0, t0 + 25 * 30_000), 'with 1 h of fixes it estimates');
});
