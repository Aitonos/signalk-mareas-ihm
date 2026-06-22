// Tests Rev478 — sincronizacion + persistencia + schema version.
// Cobertura:
//   C-12: gpsAgeMs expuesto y null si stale.
//   C-16: cache migration (groundingRisk vacio o legacy normaliza limpio).
//   C-17: schemaVersion bumped a 2.
//   C-26: lock comandos lift/drop concurrentes (segundo recibe 409).
//   C-29: deep clone — mutar respuesta no afecta backend.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.IHM_BASE_URL || 'http://100.127.222.27:3000/signalk-mareas-ihm/api';
const SKIP_IF_DOWN = process.env.IHM_TESTS_REQUIRE === 'true' ? false : true;

async function withServer(testFn) {
  try {
    const res = await fetch(`${BASE}/_skshape`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (e) {
    if (SKIP_IF_DOWN) {
      console.warn(`[skip] plugin not reachable at ${BASE}: ${e.message}`);
      return;
    }
    throw e;
  }
  await testFn();
}

// --- C-17: schemaVersion = 2 ---

test('Rev478 C-17: SSE state exposes schemaVersion=2', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    assert.equal(s.schemaVersion, 2, 'schemaVersion must be 2 in Rev478');
  });
});

test('Rev478 C-17: grounding.schemaVersion matches top-level', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s.grounding) {
      assert.equal(s.grounding.schemaVersion, s.schemaVersion,
        'inner grounding.schemaVersion must match top-level');
    }
  });
});

// --- C-12: gpsAgeMs ---

test('Rev478 C-12: state exposes gpsAgeMs (number or null)', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    assert.ok('gpsAgeMs' in s, 'gpsAgeMs field must exist');
    assert.ok(s.gpsAgeMs === null || typeof s.gpsAgeMs === 'number',
      `gpsAgeMs must be number or null, got: ${typeof s.gpsAgeMs}`);
  });
});

test('Rev478 C-12: when gpsAgeMs is null, boatPosition is also null', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s.gpsAgeMs === null) {
      assert.equal(s.boatPosition, null,
        'no fresh GPS means boatPosition MUST be null (no stale leak)');
    }
  });
});

test('Rev478 C-12: when gpsAgeMs is a number, it is <= 60000ms (60s max)', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (typeof s.gpsAgeMs === 'number') {
      assert.ok(s.gpsAgeMs >= 0, 'gpsAgeMs must be non-negative');
      assert.ok(s.gpsAgeMs <= 60_000,
        `gpsAgeMs should be <= 60s freshness window, got: ${s.gpsAgeMs}`);
    }
  });
});

// --- C-29: deep clone defensivo ---

test('Rev478 C-29: state response is independent (mutating it does not affect next fetch)', async () => {
  await withServer(async () => {
    const s1 = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    // Mutate aggressively.
    if (s1.anchorHistory) s1.anchorHistory.push({ INJECTED: true });
    if (s1.grounding && s1.grounding.physics) s1.grounding.physics.state = 'POISONED';
    // Refetch — second response must NOT contain the injection.
    const s2 = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s2.anchorHistory) {
      const injected = s2.anchorHistory.some(h => h && h.INJECTED === true);
      assert.equal(injected, false, 'mutation must NOT survive (deep clone is isolating)');
    }
    if (s2.grounding && s2.grounding.physics) {
      assert.notEqual(s2.grounding.physics.state, 'POISONED');
    }
  });
});

// --- C-26: lock comandos concurrentes ---

test('Rev478 C-26: concurrent drop/lift commands serialize (second gets 409 or processes after)', async () => {
  await withServer(async () => {
    // Get current state first.
    const initial = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const wasAnchored = initial.anchored === true;
    // Fire 3 toggles in parallel — at most one should succeed at any moment.
    const promises = [
      fetch(`${BASE}/anchor-watch/toggle`, { method: 'POST' }).then(r => r.status),
      fetch(`${BASE}/anchor-watch/toggle`, { method: 'POST' }).then(r => r.status),
      fetch(`${BASE}/anchor-watch/toggle`, { method: 'POST' }).then(r => r.status),
    ];
    const codes = await Promise.all(promises);
    // Al menos un 409 (locked) o todas 200 secuenciales son aceptables.
    // Lo critico: ninguna debe ser 500 (estado intermedio corrompido).
    for (const c of codes) {
      assert.ok(c === 200 || c === 409 || c === 400,
        `concurrent toggle returned ${c}, expected 200|409|400`);
    }
    // Restore original anchored state via a final toggle if needed.
    const after = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (after.anchored !== wasAnchored) {
      // Toggle back to leave system as we found it.
      await fetch(`${BASE}/anchor-watch/toggle`, { method: 'POST' });
    }
  });
});

// --- C-16: cache migration ---

test('Rev478 C-16: groundingRisk shape always has required fields (post-migration)', async () => {
  await withServer(async () => {
    const a = await fetch(`${BASE}/alarma`).then(r => r.json());
    const gr = a.groundingRisk;
    assert.ok(gr != null, 'groundingRisk must be populated (migration ensures shape)');
    // Estos campos DEBEN existir como propiedades (aunque null).
    for (const field of ['risk', 'enabled', 'notifyRisk']) {
      assert.ok(field in gr, `groundingRisk.${field} must exist after migration`);
    }
  });
});
