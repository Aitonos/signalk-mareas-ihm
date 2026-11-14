// Rev900: state files are written atomically and in order, and a broken
// file is set aside and reported instead of silently read as empty.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname, join } from 'node:path';
import { existsSync, mkdtempSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheJs = resolve(__dirname, '..', 'dist/cache.js');

async function loadCache() {
  assert.ok(existsSync(cacheJs), 'dist/cache.js missing — run `npm run build` first');
  return (await import(pathToFileURL(cacheJs).href)).default;
}

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'ihm-cache-'));
}

test('cache: a value written is read back and no .tmp file is left', async () => {
  const FileCache = await loadCache();
  const dir = tempDir();
  const c = new FileCache(dir);
  await c.set('anchorWatch', { anchored: true, radius: 40 });
  assert.deepEqual(await c.get('anchorWatch'), { anchored: true, radius: 40 });
  assert.deepEqual(readdirSync(dir), ['anchorWatch.json']);
});

test('cache: writes to the same key land in order, the last one wins', async () => {
  const FileCache = await loadCache();
  const dir = tempDir();
  const a = new FileCache(dir);
  const b = new FileCache(dir); // two instances on one folder, as in the plugin
  await Promise.all([a.set('k', 1), b.set('k', 2), a.set('k', 3)]);
  assert.equal(await a.get('k'), 3);
});

test('cache: a missing key reads as undefined', async () => {
  const FileCache = await loadCache();
  assert.equal(await new FileCache(tempDir()).get('nope'), undefined);
});

test('cache: a truncated file is set aside, not silently dropped', async () => {
  const FileCache = await loadCache();
  const dir = tempDir();
  writeFileSync(join(dir, 'securityPins.json'), '[{"alias":"Car');
  const c = new FileCache(dir);
  assert.equal(await c.get('securityPins'), undefined);
  const kept = readdirSync(dir).filter((f) => f.startsWith('securityPins.json.corrupt-'));
  assert.equal(kept.length, 1);
  assert.equal(readFileSync(join(dir, kept[0]), 'utf8'), '[{"alias":"Car');
});
