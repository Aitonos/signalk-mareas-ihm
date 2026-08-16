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

test('imo generates registrations.imo with "IMO " prefix', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', imo: '9876543', tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'registrations.imo');
  assert.equal(deltas[0].value, 'IMO 9876543');
});

test('shipType=0 IS published (0 = Not available, still valid AIS type)', () => {
  const deltas = buildAisRepublishDeltas(
    { mmsi: '123', shipType: 0, tsMs: 0 },
    null,
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].path, 'design.aisShipType');
  assert.deepEqual(deltas[0].value, { id: 0, name: '0' });
});

test('full payload generates all applicable deltas', () => {
  const deltas = buildAisRepublishDeltas({
    mmsi: '999',
    lat: 42, lng: -8,
    sog: 5.14, cog: 1.57, heading: 1.57,
    name: 'IGNORED', // Rev861: silently dropped
    callsign: 'ABC', imo: '1234567',
    length: 12, beam: 4,
    shipType: 36,
    tsMs: 0,
  }, null);
  const paths = deltas.map(d => d.path).sort();
  assert.deepEqual(paths, [
    'communication.callsignVhf',
    'design.aisShipType',
    'design.beam',
    'design.length',
    'navigation.courseOverGroundTrue',
    'navigation.headingTrue',
    'navigation.position',
    'navigation.speedOverGround',
    'registrations.imo',
  ]);
  // Confirm all share the same context
  const ctxs = new Set(deltas.map(d => d.context));
  assert.equal(ctxs.size, 1);
  assert.equal([...ctxs][0], 'vessels.urn:mrn:imo:mmsi:999');
});
