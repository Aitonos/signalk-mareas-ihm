/**
 * Rev886: enrich the SK `vessels.*` tree with AIS identity cached in
 * `_aisKnownDB` (see docs/_audit_ais_identity_enrichment_rev886.md).
 *
 * SK does not persist the vessels tree: after every restart a target's
 * name only comes back with its next AIS static message (type 5 / 24),
 * and online targets (aisstream / aishub / aisfriends) never get one.
 * Measured 2026-10-14: 43 of 77 vessels without name right after a
 * restart, 42 of them known by `_aisKnownDB`.
 *
 * Shape matters. Rev861 / Rev879 / Rev880 published identity as DOTTED
 * paths (`path:"name"`, `path:"communication.callsignVhf"`,
 * `path:"registrations.imo"`) and `fullsignalk.js:190` crashed trying to
 * hang `.meta` off a string. The SK built-in parsers
 * (`n2k-signalk` PGN 129794, `nmea0183-signalk` VDM) publish identity
 * with `path: ""` and an OBJECT value, which SK merges into the vessel
 * root without meta. We emit exactly that shape, so every SK app
 * (Freeboard, KIP, collision-alerts, ...) sees the name.
 *
 * Pure function: no app, no I/O. The caller sends the deltas.
 */

export interface AisIdentity {
  name?: string | null;
  callsign?: string | null;
  imo?: string | null;   // digits only, without "IMO " prefix
}

export interface AisIdentityDelta {
  path: "";
  value: Record<string, unknown>;
}

const _skVal = (x: any) =>
  (x != null && typeof x === "object" && "value" in x) ? x.value : x;

const _str = (x: any): string | null => {
  const v = _skVal(x);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Reads the identity fields currently on the SK bus for a vessel node. */
export function readBusIdentity(vessel: any): AisIdentity {
  return {
    name: _str(vessel?.name),
    callsign: _str(vessel?.communication?.callsignVhf),
    imo: _str(vessel?.registrations?.imo),
  };
}

/** Same criterion as the AIS list builder (Rev387/393): a real name is
 *  not a numeric MMSI, not a urn, not the MMSI itself. */
export function isRealAisName(name: string | null | undefined, mmsi: string): boolean {
  if (!name) return false;
  const n = name.trim();
  return n !== "" && !n.startsWith("urn:") && n !== mmsi && !/^\d{6,}$/.test(n);
}

/**
 * Deltas filling ONLY the identity fields missing on the bus. Never
 * overwrites a value SK already has (fresh VHF static data wins).
 * Every delta uses `path: ""` — see header (Rev861 regression).
 */
export function buildAisIdentityDeltas(
  mmsi: string,
  bus: AisIdentity,
  db: AisIdentity | null,
  selfMmsi: string | null,
): AisIdentityDelta[] {
  if (!db || !mmsi) return [];
  if (selfMmsi && mmsi === selfMmsi) return [];
  const out: AisIdentityDelta[] = [];
  if (!isRealAisName(bus.name, mmsi) && isRealAisName(db.name, mmsi)) {
    out.push({ path: "", value: { name: String(db.name).trim() } });
  }
  if (!bus.callsign && db.callsign && String(db.callsign).trim() !== "") {
    out.push({ path: "", value: { communication: { callsignVhf: String(db.callsign).trim() } } });
  }
  const dbImo = db.imo ? String(db.imo).replace(/^IMO\s*/i, "").trim() : "";
  if (!bus.imo && /^\d{7}$/.test(dbImo)) {
    // Same "IMO <n>" string the nmea0183 VDM parser stores.
    out.push({ path: "", value: { registrations: { imo: `IMO ${dbImo}` } } });
  }
  return out;
}
