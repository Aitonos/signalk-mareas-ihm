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
 * - Nunca publica `communication.callsignVhf` — mismo mecanismo que
 *   `name`. Bug Rev879 (2026-09-06): 16.978 excepciones en 15.8 h en
 *   producción. El parser AIS built-in de SK ya pre-planta el
 *   callsign como string pelado en el árbol del vessel; nuestro
 *   delta rompe fullsignalk.js al intentar añadir `.meta` encima.
 * - Nunca publica `registrations.imo` — mismo mecanismo. Bug Rev880
 *   (2026-09-06): destapado inmediatamente tras Rev879 en el mismo
 *   pushup al Pi. 3 crashes en 45 s con valores `IMO 9976264/…`
 *   (exactamente el string prefijado que emitíamos).
 * - Nunca publica `design.aisShipType`. Rev881 (2026-09-06): NO
 *   crashea (SK lo pre-planta como objeto) pero degrada — emitíamos
 *   `name: "36"` y sobreescribíamos el `name: "Sailing"` del parser
 *   built-in en el bus. Cirugía preventiva por coherencia: solo
 *   emitimos paths posicionales/dimensionales, no identitarios.
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
  /* Rev879: MISMO bug que Rev861, ahora en `communication.callsignVhf`.
     El parser AIS built-in de SK pre-planta el callsign como string
     pelado en el árbol del vessel (no como `{value, meta}`); cuando
     nuestro republish emite el delta, fullsignalk.js:190 intenta
     `previous[pathPart].meta = {...}` sobre ese string y truena con
     `TypeError: Cannot create property 'meta' on string '<callsign>'`.
     Observado en producción 2026-09-06: 16.978 excepciones en 15.8 h
     (~18/min, 85 callsigns únicos: EA/EB/CU/CQ/5B/5T/…). Cada
     excepción deja un handler colgado → MaxListeners → cuelgue SK.
     Igual que con name: se acepta `u.callsign` en la payload por
     compat con aisstream/aishub/aisfriends, pero NO se publica.
     Ver test `REGRESSION Rev879` en tests/aisRepublish.test.js. */
  /* Rev880: mismo bug que Rev861 (name) y Rev879 (callsign), ahora en
     `registrations.imo`. Confirmado en el pushup Rev879 en el Pi:
     inmediatamente tras el fix del callsign aparecen 3 crashes en
     45 s con valores `IMO 9976264`, `IMO 9593672`, `IMO 919421800`
     — exactamente el string que emitíamos aquí. El parser AIS
     built-in de SK ya guarda el IMO como string pelado en el árbol
     del vessel; nuestro delta rompe fullsignalk.js:190 al añadir
     `.meta` encima. Silently drop `u.imo`. Ver test regresión
     `REGRESSION Rev880` en tests/aisRepublish.test.js. */
  if (u.length != null && u.length > 0) {
    deltas.push({ context: ctx, path: "design.length", value: { overall: u.length } });
  }
  if (u.beam != null && u.beam > 0) {
    deltas.push({ context: ctx, path: "design.beam", value: u.beam });
  }
  /* Rev881: no republicar `design.aisShipType`. NO crashea (SK
     built-in lo pre-planta como objeto {value,meta}, no como valor
     pelado), pero SÍ degrada: emitimos `name: String(u.shipType)`
     → `name: "36"` mientras que el parser AIS de SK guarda
     `name: "Sailing"`. Apps que leen del bus (KIP, Freeboard,
     WilhelmSK) veían "36" en vez de "Sailing" porque nuestro delta
     era el $source más reciente. Los targets online (aisstream/
     aishub/aisfriends) sin equivalente VHF pierden aisShipType en
     el bus SK; para esos, la identidad la sirve nuestro propio
     visor vía SSE desde _aisKnownDB, que es lo que Carlos usa. */
  return deltas;
}
