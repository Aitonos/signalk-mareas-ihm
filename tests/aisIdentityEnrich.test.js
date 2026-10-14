/**
 * Rev886: tests for buildAisIdentityDeltas (AIS identity enrichment of
 * the SK vessels tree from _aisKnownDB).
 *
 * Includes a dedicated REGRESSION test for Rev861 / Rev879 / Rev880:
 * identity must ALWAYS be published with path "" + object value. A
 * dotted path (name, communication.callsignVhf, registrations.imo)
 * crashes fullsignalk.js and leaks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAisIdentityDeltas,
  readBusIdentity,
  isRealAisName,
} from '../dist/sources/aisIdentityEnrich.js';

const DB = { name: 'PELAGOS', callsign: 'EA1234', imo: '9976264' };

test('REGRESSION Rev861/879/880: every delta uses path "" with object value', () => {
  const deltas = buildAisIdentityDeltas('244060022', {}, DB, null);
  assert.equal(deltas.length, 3);
  for (const d of deltas) {
    assert.equal(d.path, '');
    assert.equal(typeof d.value, 'object');
  }
});

test('canonical shapes match SK built-in parsers', () => {
  const deltas = buildAisIdentityDeltas('244060022', {}, DB, null);
  assert.deepEqual(deltas.map(d => d.value), [
    { name: 'PELAGOS' },
    { communication: { callsignVhf: 'EA1234' } },
    { registrations: { imo: 'IMO 9976264' } },
  ]);
});

test('never overwrites identity already on the bus', () => {
  const bus = { name: 'REAL NAME', callsign: 'XX99', imo: 'IMO 1234567' };
  assert.equal(buildAisIdentityDeltas('244060022', bus, DB, null).length, 0);
});

test('numeric bus name counts as missing and gets filled', () => {
  const deltas = buildAisIdentityDeltas('244060022', { name: '244060022' }, { name: 'PELAGOS' }, null);
  assert.deepEqual(deltas, [{ path: '', value: { name: 'PELAGOS' } }]);
});

test('self mmsi returns no deltas', () => {
  assert.equal(buildAisIdentityDeltas('228023660', {}, DB, '228023660').length, 0);
});

test('no db entry returns no deltas', () => {
  assert.equal(buildAisIdentityDeltas('244060022', {}, null, null).length, 0);
});

test('db name that is not real is not published', () => {
  assert.equal(buildAisIdentityDeltas('244060022', {}, { name: '244060022' }, null).length, 0);
  assert.equal(buildAisIdentityDeltas('244060022', {}, { name: 'urn:mrn:x' }, null).length, 0);
});

test('invalid imo is not published; prefixed db imo is normalised', () => {
  assert.equal(buildAisIdentityDeltas('1', {}, { imo: '12' }, null).length, 0);
  assert.deepEqual(
    buildAisIdentityDeltas('1', {}, { imo: 'IMO 9976264' }, null),
    [{ path: '', value: { registrations: { imo: 'IMO 9976264' } } }],
  );
});

test('readBusIdentity handles raw strings and {value} nodes', () => {
  assert.deepEqual(
    readBusIdentity({ name: 'A', communication: { callsignVhf: { value: 'EA1' } }, registrations: { imo: 'IMO 1234567' } }),
    { name: 'A', callsign: 'EA1', imo: 'IMO 1234567' },
  );
  assert.deepEqual(readBusIdentity(undefined), { name: null, callsign: null, imo: null });
});

test('isRealAisName', () => {
  assert.equal(isRealAisName('PELAGOS', '1'), true);
  assert.equal(isRealAisName('', '1'), false);
  assert.equal(isRealAisName('123456789', '1'), false);
});
