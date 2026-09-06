/**
 * Rev877: tests para buildAisRepublishDeltas.
 *
 * Fija el comportamiento del republish AIS al bus SK. Incluye un test
 * de regresión DEDICADO para el bug Rev861 (leak por publicar
 * `path:"name"` con string plano) que fallará si alguien re-añade ese
 * push por error en el futuro.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAisRepublishDeltas } from '../dist/sources/aisRepublish.js';

test('empty target (only mmsi + tsMs) returns no deltas', () => {
  const deltas = buildAisRepublishDeltas({ mmsi: '123', tsMs: 0 }, null);
  assert.equal(deltas.length, 0);
});

test('self mmsi returns no deltas (guard against fantasma loop)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '224001234', lat: 42, lng: -8, tsMs: 0 },
    '224001234',
  );
  assert.equal(deltas.length, 0);
});

test('self mmsi guard is null-safe (no crash when selfMmsi=null)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1); // sin bloqueo
});

test('position generates one delta with correct context and shape', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '224001234', lat: 42.5, lng: -8.5, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].context, 'vessels.urn:mrn:imo:mmsi:224001234');
  assert.equal(deltas[0].path, 'navigation.position');
  assert.deepEqual(deltas[0].value, { latitude: 42.5, longitude: -8.5 });
});

test('REGRESSION Rev861: name field is NEVER republished as SK delta', () => {
  // El bug: publicar path:"name" con value:string plano rompía
  // fullsignalk.js:181 (TypeError: Cannot create property 'meta' on
  // string 'AURORA') generando miles de errores/hora y leak progresivo
  // (2.5 GB RSS en 4d 15h). El fix Rev861 quitó ese push. Este test
  // rompe la build si alguien vuelve a añadirlo.
  const deltas = buildAisRepublishDeltas(
    { mmsi: '999', name: 'AURORA', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  const namePaths = deltas.filter(d => d.path === 'name');
  assert.equal(namePaths.length, 0,
    'CRITICAL: name must NEVER be republished — see Rev861 memory leak (issue #37)');
});

test('name in payload does not block other fields', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '999', name: 'AURORA', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  // position sí se publica, name silently dropped
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'navigation.position');
});

test('REGRESSION Rev879: callsign is NEVER republished as SK delta', () => {
  // Mismo bug que Rev861 pero en communication.callsignVhf. El parser
  // AIS built-in de SK ya guarda el callsign como string pelado en el
  // árbol; nuestro delta reventaba fullsignalk.js:190 con
  // TypeError: Cannot create property 'meta' on string '<callsign>'.
  // Observado 2026-09-06: 16.978 excepciones en 15.8 h. Este test
  // rompe la build si alguien vuelve a añadir el push.
  const deltas = buildAisRepublishDeltas(
    { mmsi: '999', callsign: '5BEE6', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  const callsignPaths = deltas.filter(d => d.path === 'communication.callsignVhf');
  assert.equal(callsignPaths.length, 0,
    'CRITICAL: callsignVhf must NEVER be republished — see Rev879 (17k errors/day)');
});

test('callsign in payload does not block other fields', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '999', callsign: '5BEE6', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'navigation.position');
});

test('sog=0 IS published (0 is a valid speed, not "missing")', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', sog: 0, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'navigation.speedOverGround');
  assert.equal(deltas[0].value, 0);
});

test('sog=NaN is NOT published (isFinite guard)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', sog: NaN, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 0);
});

test('sog=Infinity is NOT published (isFinite guard)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', sog: Infinity, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 0);
});

test('length=0 does NOT publish (design.length only if > 0)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', length: 0, beam: 0, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 0);
});

test('length negative does NOT publish', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', length: -5, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 0);
});

test('REGRESSION Rev880: imo is NEVER republished as SK delta', () => {
  // Mismo bug que Rev861 (name) y Rev879 (callsign). Destapado
  // 2026-09-06 inmediatamente tras Rev879: al eliminar el push del
  // callsign, aparecieron 3 crashes en 45 s con `IMO 9976264/…`,
  // que es exactamente el string que emitíamos como
  // { path: "registrations.imo", value: `IMO ${u.imo}` }.
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', imo: '9876543', tsMs: 0 },
    null,
  );
  const imoPaths = deltas.filter(d => d.path === 'registrations.imo');
  assert.equal(imoPaths.length, 0,
    'CRITICAL: registrations.imo must NEVER be republished — Rev880');
});

test('imo in payload does not block other fields', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', imo: '9876543', lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'navigation.position');
});

test('REGRESSION Rev881: aisShipType is NEVER republished as SK delta', () => {
  // Rev881 (2026-09-06): no crashea (SK lo pre-planta como objeto)
  // pero degrada — emitíamos `name: "36"` y sobreescribíamos el
  // `name: "Sailing"` que puso el parser built-in. Cirugía
  // preventiva por coherencia con name/callsign/imo.
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', shipType: 36, tsMs: 0 },
    null,
  );
  const stPaths = deltas.filter(d => d.path === 'design.aisShipType');
  assert.equal(stPaths.length, 0,
    'CRITICAL: aisShipType must NEVER be republished — Rev881 (name degradation)');
});

test('shipType in payload does not block other fields', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', shipType: 36, lat: 42, lng: -8, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'navigation.position');
});

test('full payload generates all applicable deltas', () => {
  const deltas = buildAisRepublishDeltas({
    mmsi: '999',
    lat: 42, lng: -8,
    sog: 5.14, cog: 1.57, heading: 1.57,
    name: 'IGNORED',      // Rev861: silently dropped
    callsign: 'IGNORED',  // Rev879: silently dropped
    imo: '1234567',       // Rev880: silently dropped
    shipType: 36,         // Rev881: silently dropped
    length: 12, beam: 4,
    tsMs: 0,
  }, null);
  const paths = deltas.map(d => d.path).sort();
  assert.deepEqual(paths, [
    'design.beam',
    'design.length',
    'navigation.courseOverGroundTrue',
    'navigation.headingTrue',
    'navigation.position',
    'navigation.speedOverGround',
  ]);
  // Confirm all share the same context
  const ctxs = new Set(deltas.map(d => d.context));
  assert.equal(ctxs.size, 1);
  assert.equal([...ctxs][0], 'vessels.urn:mrn:imo:mmsi:999');
});
