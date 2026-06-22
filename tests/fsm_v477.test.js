// Tests Rev477 — FSM Physics/Config/Notification.
// Cobertura:
//   C-03: ausencia de datos NUNCA produce safe.
//   C-04: apagar alarma NO destruye realidad física.
//   C-07: snooze fuerza notification.audibleRequested=false.
//   C-08: "en movimiento" se modela en operationalMode, no apaga alarma.
//   C-11: contrato grounding objetivado en 3 dimensiones.
//   C-22: legacy paths (groundingAlarm, groundingDetail) preservados.

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

// ─── Contrato FSM ───

test('Rev477 C-11: SSE state exposes "grounding" block with three dimensions', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    assert.ok(s.grounding, 'state.grounding must exist');
    assert.ok(s.grounding.physics, 'physics required');
    assert.ok(s.grounding.config, 'config required');
    assert.ok(s.grounding.notification, 'notification required');
    assert.ok(s.grounding.safetyLatch, 'safetyLatch required');
    assert.equal(typeof s.grounding.schemaVersion, 'number');
  });
});

test('Rev477 physics.state is one of safe|danger|unknown', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const valid = ['safe', 'danger', 'unknown'];
    assert.ok(valid.includes(s.grounding.physics.state),
      `physics.state="${s.grounding.physics.state}" must be one of ${valid.join('|')}`);
  });
});

test('Rev477 physics.dataHealth is one of fresh|stale|missing|degraded|missing-calibration|invalid|conflict', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const valid = ['fresh', 'stale', 'missing', 'degraded', 'missing-calibration', 'invalid', 'conflict'];
    assert.ok(valid.includes(s.grounding.physics.dataHealth));
  });
});

test('Rev477 physics.operationalMode is one of anchored|moving|unknown', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const valid = ['anchored', 'moving', 'unknown'];
    assert.ok(valid.includes(s.grounding.physics.operationalMode));
  });
});

test('Rev477 notification.state is one of inactive|active|snoozed|latched', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const valid = ['inactive', 'active', 'snoozed', 'latched'];
    assert.ok(valid.includes(s.grounding.notification.state));
  });
});

// ─── C-03: ausencia de datos != safe ───

test('Rev477 C-03: physics.state="safe" requires fresh data (dataHealth=fresh)', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s.grounding.physics.state === 'safe') {
      assert.equal(s.grounding.physics.dataHealth, 'fresh',
        'safe should only be set when data is fresh');
      assert.ok(s.grounding.physics.depthBelowSurfaceM != null,
        'safe should not be set without depth data');
    }
  });
});

// ─── C-07: snooze fuerza audibleRequested=false ───

test('Rev477 C-07: snoozed notification has audibleRequested=false', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s.grounding.notification.state === 'snoozed') {
      assert.equal(s.grounding.notification.audibleRequested, false,
        'snoozed must NOT request audible alarm');
    }
  });
});

// ─── C-08: latch active → physics.state=unknown, no safe ───

test('Rev477 C-08: when safetyLatch.active, physics.state is NOT safe', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    if (s.grounding.safetyLatch.active) {
      assert.notEqual(s.grounding.physics.state, 'safe',
        'latch active means we do NOT know current state — must not be safe');
    }
  });
});

// ─── C-04: legacy paths intactos ───

test('Rev477 C-22: legacy groundingAlarm, groundingStatus, groundingDetail preserved', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    // Estos campos legacy DEBEN seguir presentes con el mismo formato que antes.
    assert.equal(typeof s.groundingAlarm, 'string', 'legacy groundingAlarm must be string');
    assert.equal(typeof s.groundingStatus, 'string', 'legacy groundingStatus must be string');
    if (s.groundingDetail) {
      assert.equal(typeof s.groundingDetail.physicalRisk, 'boolean');
    }
  });
});

// ─── C-18: clearance fields exposed ───

test('Rev477 C-18: physics exposes currentPhysicalUnderKeelM, expectedMinPhysicalUnderKeelM, clearanceToEffectiveThresholdM', async () => {
  await withServer(async () => {
    const s = await fetch(`${BASE}/anchor-watch/state`).then(r => r.json());
    const p = s.grounding.physics;
    // Pueden ser null si no hay datos. Pero la propiedad debe existir.
    assert.ok('currentPhysicalUnderKeelM' in p);
    assert.ok('expectedMinPhysicalUnderKeelM' in p);
    assert.ok('clearanceToEffectiveThresholdM' in p);
  });
});

// ─── C-04 endpoint: alarma off conserva physics ───

test('Rev477 C-04: POST /api/alarma/off conserva depthNow en groundingRisk', async () => {
  await withServer(async () => {
    // Primero ver el state actual.
    const aBefore = await fetch(`${BASE}/alarma`).then(r => r.json());
    const depthBefore = aBefore.groundingRisk?.depthNow;
    if (depthBefore == null) return; // no data → skip

    // Apagar alarma vía /api/alarma/off
    const res = await fetch(`${BASE}/alarma/off`, { method: 'POST' });
    assert.equal(res.status, 200);

    // Verificar que depthNow se conserva.
    const aAfter = await fetch(`${BASE}/alarma`).then(r => r.json());
    assert.equal(aAfter.enabled, false, 'alarm must be disabled');
    assert.ok(aAfter.groundingRisk != null, 'groundingRisk must still exist');
    // depthNow puede haber cambiado por nueva evaluación, pero NO debe ser undefined.
    assert.ok('depthNow' in aAfter.groundingRisk,
      'depthNow field must survive alarm off (not wiped)');
  });
});
