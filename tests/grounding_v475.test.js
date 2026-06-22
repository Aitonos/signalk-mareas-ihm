// Tests integración HTTP para los cambios de Rev475 (correcciones críticas).
// Requiere el plugin desplegado y corriendo (variable de entorno IHM_BASE_URL).
// Skip silenciosamente si no hay servidor accesible — no rompe CI.
//
// Cobertura:
//   C-10 validation: inputs inválidos rechazados con 400.
//   C-21 operationalMode: expuesto en groundingDetail.
//   C-02 latch: campo expuesto en groundingDetail.
//   C-09 schemaVersion: presente en state.
//   Single-flight: state poll responde sin errores.

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

// ─── C-10 Validation ───

test('Rev475 C-10: safetyMargin=-999 rejected with 400', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/calado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safetyMargin: -999 }),
    });
    assert.equal(res.status, 400, 'should be 400 Bad Request');
    const body = await res.json();
    assert.match(body.error, /safetyMargin/i);
  });
});

test('Rev475 C-10: enabled="yes" rejected (no Boolean coercion)', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/alarma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: 'yes' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /boolean/i);
  });
});

test('Rev475 C-10: enabled="false" string correctly parsed as false', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/alarma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: 'false' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.enabled, false, 'must be false, NOT coerced to true');
  });
});

test('Rev475 C-10: minutesBefore=99999 rejected with 400', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/alarma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, minutesBefore: 99999 }),
    });
    assert.equal(res.status, 400);
  });
});

test('Rev475 C-10: draft="texto" rejected (NaN check)', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/calado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: 'texto' }),
    });
    assert.equal(res.status, 400);
  });
});

test('Rev475 C-10: draftSource enum strict', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/calado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftSource: 'azucar' }),
    });
    assert.equal(res.status, 400);
  });
});

// ─── C-09 schemaVersion + serverInstanceId ───

test('Rev475 SSE state exposes schemaVersion, serverInstanceId, serverTimeMs', async () => {
  // NB: schemaVersion bumped from 1 (Rev475) -> 2 (Rev478). Test acepta >=1.
  await withServer(async () => {
    const res = await fetch(`${BASE}/anchor-watch/state`);
    assert.equal(res.status, 200);
    const s = await res.json();
    assert.ok(typeof s.schemaVersion === 'number' && s.schemaVersion >= 1,
      `schemaVersion must be >=1, got ${s.schemaVersion}`);
    assert.equal(typeof s.serverInstanceId, 'string');
    assert.ok(s.serverInstanceId.length > 0);
    assert.equal(typeof s.serverTimeMs, 'number');
    assert.equal(typeof s.generatedAt, 'string');
  });
});

// ─── C-21 operationalMode ───

test('Rev475 C-21: groundingDetail.operationalMode exposed (anchored|moving|unknown)', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/anchor-watch/state`);
    const s = await res.json();
    if (s.groundingDetail) {
      const om = s.groundingDetail.operationalMode;
      assert.ok(
        om === 'anchored' || om === 'moving' || om === 'unknown' || om === null,
        `operationalMode must be one of anchored|moving|unknown|null, got: ${om}`
      );
    }
  });
});

// ─── C-02 safetyLatch ───

test('Rev475 C-02: groundingDetail exposes safetyLatchActive field', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/anchor-watch/state`);
    const s = await res.json();
    if (s.groundingDetail) {
      assert.equal(typeof s.groundingDetail.safetyLatchActive, 'boolean',
        'safetyLatchActive must be a boolean (true|false), even if false');
    }
  });
});

// ─── C-28 audit endpoint ───

test('Rev475 C-28: /api/_skshape returns verdict and summary', async () => {
  await withServer(async () => {
    const res = await fetch(`${BASE}/_skshape`);
    assert.equal(res.status, 200);
    const r = await res.json();
    assert.ok(r.verdict, 'verdict required');
    assert.ok(r.summary, 'summary required');
    assert.equal(typeof r.summary.totalPaths, 'number');
    assert.equal(typeof r.summary.withTimestamp, 'number');
  });
});

// ─── Single-flight C-13: no errors after restart ───

test('Rev475 C-13: state poll keeps responding after multiple concurrent calls', async () => {
  await withServer(async () => {
    // 5 calls concurrentes — single-flight no debe romper.
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${BASE}/anchor-watch/state`).then(r => r.status)
    );
    const codes = await Promise.all(promises);
    for (const c of codes) assert.equal(c, 200);
  });
});
