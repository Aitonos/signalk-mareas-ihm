// Tests del paquete signalk-mareas-ihm.
// Usa node:test (nativo, sin dependencias nuevas).
//
// Estos tests NO instancian el plugin para evitar arrancar timers,
// conexiones a sqlite y otros side effects. Verifican el contrato
// estatico del paquete:
//   - package.json cumple los requisitos de un Signal K plugin.
//   - Los screenshots declarados existen en disco.
//   - files[] incluye los directorios criticos.
//   - El entrypoint compilado existe y carga.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

test('package.json declares Signal K plugin contract', () => {
  assert.equal(typeof pkg.name, 'string');
  assert.equal(typeof pkg.version, 'string');
  assert.match(pkg.version, /^\d+\.\d+\.\d+/, 'version is semver-like');
  assert.ok(Array.isArray(pkg.keywords), 'keywords[] required');
  assert.ok(
    pkg.keywords.includes('signalk-node-server-plugin'),
    'must declare signalk-node-server-plugin keyword',
  );
  assert.equal(typeof pkg.main, 'string', 'main entrypoint required');
  assert.equal(typeof pkg.signalk, 'object', 'signalk block required');
});

test('signalk.screenshots is an array and every file exists on disk', () => {
  assert.ok(Array.isArray(pkg.signalk.screenshots), 'signalk.screenshots[] required');
  assert.ok(pkg.signalk.screenshots.length > 0, 'at least one screenshot');
  for (const rel of pkg.signalk.screenshots) {
    const abs = resolve(root, rel);
    assert.ok(existsSync(abs), `screenshot missing on disk: ${rel}`);
  }
});

test('files[] includes screenshots/ so the App Store can fetch them', () => {
  assert.ok(Array.isArray(pkg.files), 'files[] required');
  assert.ok(
    pkg.files.some((f) => f.startsWith('screenshots')),
    'files[] must include screenshots/ entry',
  );
});

test('files[] includes dist/ and public/', () => {
  assert.ok(
    pkg.files.some((f) => f.startsWith('dist')),
    'files[] must include dist/',
  );
  assert.ok(
    pkg.files.some((f) => f.startsWith('public')),
    'files[] must include public/',
  );
});

test('built entrypoint and webapp assets exist', () => {
  assert.ok(existsSync(resolve(root, pkg.main)), `${pkg.main} must exist after build`);
  assert.ok(existsSync(resolve(root, 'public/index.html')), 'public/index.html must exist');
  assert.ok(existsSync(resolve(root, 'public/mobile.html')), 'public/mobile.html must exist');
  assert.ok(existsSync(resolve(root, pkg.signalk.appIcon)), `app icon ${pkg.signalk.appIcon} must exist`);
});

test('plugin entrypoint imports and exposes a factory function', async () => {
  const url = pathToFileURL(resolve(root, pkg.main)).href;
  const mod = await import(url);
  const factory = mod.default ?? mod;
  assert.equal(typeof factory, 'function', 'default export must be a factory function');
});

test('README.md and CHANGELOG.md exist and are non-empty', () => {
  for (const f of ['README.md', 'CHANGELOG.md']) {
    const abs = resolve(root, f);
    assert.ok(existsSync(abs), `${f} must exist`);
    const stats = readFileSync(abs, 'utf8');
    assert.ok(stats.length > 100, `${f} is suspiciously short (${stats.length} bytes)`);
  }
});
