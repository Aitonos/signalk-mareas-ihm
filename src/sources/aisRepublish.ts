/**
 * Rev877: republish AIS a bus SK extraído a módulo puro.
 *
 * Origen: `_aisstreamRepublishToSK` en index.ts:6891 (era ~50 líneas
 * dentro del monolito). Los 3 clientes AIS online (aisstream, aishub,
 * aisfriends) llaman a esta misma función para volcar sus targets al
 * árbol `vessels.urn:mrn:imo:mmsi:*` del bus SignalK, y así Freeboard,
 * KIP y otras apps ven todos los blancos independientemente de si
 * llegaron por VHF, WebSocket, HTTP poll, etc.
 *
 * Extraerlo a módulo propio aporta:
 * - Testabilidad end-to-end del transform sin necesidad de simular
 *   app.handleMessage ni el resto del plugin.
 * - Regresión-proof del bug Rev861 (leak por publicar path:"name" con
 *   string plano) via test dedicado que falla si alguien re-añade
 *   ese push.
 * - Reducción de ~55 líneas del monolito index.ts.
 *
 * La función es pura: recibe payload + selfMmsi y devuelve el array
 * de deltas a publicar. El caller decide cómo enviarlos al bus SK.
 */

export interface AisRepublishPayload {
  mmsi: string;
  lat?: number | null;
  lng?: number | null;
  cog?: number | null;      // rad
  sog?: number | null;      // m/s
  heading?: number | null;  // rad
  name?: string | null;     // *** IGNORED *** ver Rev861
  shipType?: number | null;
  callsign?: string | null;
  imo?: string | null;
  length?: number | null;   // m
  beam?: number | null;     // m
  tsMs: number;
}

export interface AisRepublishDelta {
  context: string;
  path: string;
  value: unknown;
}

/**
 * Convierte un target AIS al conjunto de deltas SK que se pueden
 * publicar bajo `vessels.urn:mrn:imo:mmsi:<mmsi>`.
 *
 * Reglas:
 * - Si `selfMmsi` está definido y coincide con `u.mmsi` → devuelve `[]`.
 *   Evita el ciclo online → SK bus → listado AIS → target fantasma
 *   del propio barco (bug Rev835).
 * - Nunca publica `path: "name"` — `name` es top-level property en
 *   SK, no un delta path válido. Bug Rev861: publicar name como
 *   `{path:"name", value:"AURORA"}` reventaba `fullsignalk.js` en
 *   strict mode con `TypeError: Cannot create property 'meta' on
 *   string 'AURORA'`, generando miles de errores por hora y leak.
 * - `length` y `beam` solo se publican si son > 0 (evita "unknown"
 *   contaminando el bus).
 * - Devuelve array vacío si no hay valores útiles — el caller debe
 *   omitir el handleMessage en ese caso.
 */
export function buildAisRepublishDeltas(
  u: AisRepublishPayload,
  selfMmsi: string | null,
): AisRepublishDelta[] {
  if (selfMmsi && u.mmsi === selfMmsi) return [];
  const ctx = "vessels.urn:mrn:imo:mmsi:" + u.mmsi;
  const deltas: AisRepublishDelta[] = [];
  if (u.lat != null && u.lng != null) {
    deltas.push({ context: ctx, path: "navigation.position", value: { latitude: u.lat, longitude: u.lng } });
  }
  if (u.sog != null && Number.isFinite(u.sog)) {
    deltas.push({ context: ctx, path: "navigation.speedOverGround", value: u.sog });
  }
  if (u.cog != null && Number.isFinite(u.cog)) {
    deltas.push({ context: ctx, path: "navigation.courseOverGroundTrue", value: u.cog });
  }
  if (u.heading != null && Number.isFinite(u.heading)) {
    deltas.push({ context: ctx, path: "navigation.headingTrue", value: u.heading });
  }
  /* Rev861: NO republicar `path: "name"` — es top-level property SK,
     no un delta path válido. Publicarlo como delta rompe fullsignalk.js
     en strict mode y genera miles de errores por hora + leak.
     Sí se acepta `u.name` en la payload por compatibilidad con las
     3 fuentes que lo pasan; simplemente lo ignoramos aquí. */
  if (u.callsign) {
    deltas.push({ context: ctx, path: "communication.callsignVhf", value: u.callsign });
  }
  if (u.imo) {
    deltas.push({ context: ctx, path: "registrations.imo", value: `IMO ${u.imo}` });
  }
  if (u.length != null && u.length > 0) {
    deltas.push({ context: ctx, path: "design.length", value: { overall: u.length } });
  }
  if (u.beam != null && u.beam > 0) {
    deltas.push({ context: ctx, path: "design.beam", value: u.beam });
  }
  if (typeof u.shipType === "number") {
    deltas.push({ context: ctx, path: "design.aisShipType", value: { id: u.shipType, name: String(u.shipType) } });
  }
  return deltas;
}
