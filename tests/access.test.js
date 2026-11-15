// Rev901 (audit A2/D04): with Signal K security on, the plugin routes that
// write need a Signal K session with write permission. Without Signal K
// security nothing changes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const accessJs = resolve(__dirname, '..', 'dist/access.js');

async function loadAccess() {
  assert.ok(existsSync(accessJs), 'dist/access.js missing — run `npm run build` first');
  return import(pathToFileURL(accessJs).href);
}

function run(mw, req) {
  let status = 200, body = null, passed = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  mw(req, res, () => { passed = true; });
  return { passed, status, body };
}

const tokenSecurity = { isDummy: () => false };
const dummySecurity = { isDummy: () => true };

test('access: without Signal K security every request passes', async () => {
  const a = await loadAccess();
  a.setSecurityLayerEnabled(false);
  a.setSkSecurityStrategy(dummySecurity);
  assert.equal(run(a.requireControlAccess, {}).passed, true);
  a.setSkSecurityStrategy(null);
  assert.equal(run(a.requireControlAccess, {}).passed, true);
});

test('access: with Signal K security a request without a session is refused', async () => {
  const a = await loadAccess();
  a.setSecurityLayerEnabled(false);
  a.setSkSecurityStrategy(tokenSecurity);
  const r = run(a.requireControlAccess, { skIsAuthenticated: false });
  assert.equal(r.passed, false);
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'SK_LOGIN_REQUIRED');
});

test('access: read-only (allow_readonly) is refused, readwrite and admin pass', async () => {
  const a = await loadAccess();
  a.setSecurityLayerEnabled(false);
  a.setSkSecurityStrategy(tokenSecurity);
  const as = (permissions) => ({ skIsAuthenticated: true, skPrincipal: { identifier: 'x', permissions } });
  assert.equal(run(a.requireControlAccess, as('readonly')).passed, false);
  assert.equal(run(a.requireControlAccess, as('readwrite')).passed, true);
  assert.equal(run(a.requireControlAccess, as('admin')).passed, true);
  assert.equal(run(a.requireSkWrite, as('readonly')).status, 403);
  a.setSkSecurityStrategy(null);
});
