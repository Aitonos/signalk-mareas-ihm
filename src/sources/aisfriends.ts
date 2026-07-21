/**
 * Rev756 (feedback Carlos "nuevo servicio AIS online — AIS FRIENDS,
 * implementa como los otros"): cliente HTTP polling a la API pública
 * v1 de aisfriends.com — endpoint /vessels/bounding-box.
 *
 * Docs: https://www.aisfriends.com/docs/api/v1
 * Base URL: https://www.aisfriends.com/api/public/v1
 * Auth: Authorization: Bearer <token>
 * Rate limit: 1 request/minuto (mismo que aishub).
 * Retorno: array plano de vessels con campos snake_case
 * (mmsi, latitude, longitude, speed_over_ground [knots],
 * course_over_ground [degrees], true_heading [degrees], length, beam,
 * ...). Timestamps en UTC (epoch_timestamp = segundos).
 *
 * IMPORTANTE — TOS de aisfriends (2026-03-31):
 *  - Acceso al API requiere 7 días de contribución con ≥10 vessels en
 *    zona + ≥90% uptime + ≤60s downsampling. Sin cumplir, el token
 *    devolverá 403.
 *  - 1 device por cuenta a la vez → si el usuario abre la web con la
 *    misma cuenta mientras el plugin está corriendo, uno de los dos
 *    perderá acceso. Advertimos en el wizard.
 *  - Feed obligatoriamente propio (VHF real), no sintético. Este cliente
 *    NO contribuye — solo consume. La contribución es responsabilidad
 *    del usuario (con AIS Catcher o similar; forwarder embebido queda
 *    para Fase 2).
 *
 * Dedupe cross-fuente vive en index.ts (_aisfriendsMergeUpdate):
 * cede a VHF (60 s), aisstream (120 s) y aishub (120 s).
 */

export interface AisfriendsTargetUpdate {
  mmsi: string;
  lat?: number | null;
  lng?: number | null;
  cog?: number | null;         // rad (convertido desde degrees)
  sog?: number | null;         // m/s (convertido desde knots)
  heading?: number | null;     // rad
  name?: string | null;
  shipType?: number | null;    // ais_type numérico
  callsign?: string | null;
  imo?: string | null;
  length?: number | null;      // m
  beam?: number | null;        // m
  tsMs: number;                // ms epoch derivado de epoch_timestamp
}

export interface AisfriendsOptions {
  token: string;
  onUpdate: (u: AisfriendsTargetUpdate) => void;
  onDebug?: (msg: string) => void;
  onError?: (msg: string) => void;
  boundingBox: [[number, number], [number, number]];
  pollIntervalMs?: number;
}

interface AisfriendsHandle {
  updateBoundingBox: (bb: [[number, number], [number, number]]) => void;
  close: () => void;
  getStats: () => {
    received: number;
    accepted: number;
    lastMsgMs: number;
    lastPollMs: number;
    lastPollDurationMs: number;
    pollCount: number;
    connected: boolean;
    boundingBox: [[number, number], [number, number]];
    lastError: string | null;
    lastErrorMs: number;
    intervalMs: number;
    lastHttpStatus: number | null;
  };
}

const ENDPOINT = "https://www.aisfriends.com/api/public/v1/vessels/bounding-box";

export function startAisfriends(opts: AisfriendsOptions): AisfriendsHandle {
  const debug = opts.onDebug ?? ((m) => console.log("[aisfriends] " + m));
  const error = opts.onError ?? ((m) => console.error("[aisfriends] " + m));
  let closed = false;
  let currentBB = opts.boundingBox;
  const intervalMs = Math.max(60_000, opts.pollIntervalMs ?? 65_000);
  let pollTimer: any = null;
  let msgReceived = 0;
  let msgAccepted = 0;
  let lastMsgMs = 0;
  let lastPollMs = 0;
  let lastPollDurationMs = 0;
  let pollCount = 0;
  let lastError: string | null = null;
  let lastErrorMs = 0;
  let lastHttpStatus: number | null = null;
  let connected = false;
  let inFlight = false;

  function bboxUrl(): string {
    const [[latMin, lngMin], [latMax, lngMax]] = currentBB;
    /* `from` = max age minutes. 3 min cubre bien el intervalo de 65s
       con margen (aisfriends garantiza ≤10s delay + downsampling ≤60s,
       así que 3 min asegura no perder ningún update entre polls). */
    const p = new URLSearchParams({
      lat_min: String(latMin),
      lat_max: String(latMax),
      lon_min: String(lngMin),
      lon_max: String(lngMax),
      from: "3",
      format: "json",
    });
    return `${ENDPOINT}?${p.toString()}`;
  }

  async function pollOnce() {
    if (closed || inFlight) return;
    inFlight = true;
    const t0 = Date.now();
    lastPollMs = t0;
    pollCount++;
    try {
      const url = bboxUrl();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${opts.token}`,
          "Accept": "application/json",
          "User-Agent": "signalk-mareas-ihm/aisfriends",
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      lastHttpStatus = res.status;
      lastPollDurationMs = Date.now() - t0;
      if (!res.ok) {
        /* Rev756: mensajes específicos para los códigos documentados —
           401/403 = token inválido o cuenta sin permiso (los 7 días
           no cumplidos → 403), 429 = rate-limit, 503 = maintenance. */
        let hint = "";
        if (res.status === 401) hint = " (invalid token — check Account → API Tokens)";
        else if (res.status === 403) hint = " (quality requirements not met — need 7 days + ≥10 vessels + ≥90% uptime)";
        else if (res.status === 429) hint = " (rate limit 1 req/min exceeded)";
        else if (res.status === 503) hint = " (maintenance in progress)";
        lastError = `HTTP ${res.status}${hint}`;
        lastErrorMs = Date.now();
        connected = false;
        error(`poll failed: ${lastError}`);
        return;
      }
      const raw = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(raw); }
      catch (e: any) {
        lastError = `JSON parse failed: ${e?.message ?? e}`;
        lastErrorMs = Date.now();
        connected = false;
        error(lastError);
        return;
      }
      if (!Array.isArray(parsed)) {
        lastError = "unexpected payload shape (expected array)";
        lastErrorMs = Date.now();
        connected = false;
        error(`${lastError}: ${raw.slice(0, 120)}`);
        return;
      }
      connected = true;
      lastError = null;
      lastMsgMs = Date.now();
      if (pollCount === 1) debug(`first poll OK — ${parsed.length} targets`);
      if (pollCount % 10 === 0) debug(`stats: poll #${pollCount} ${parsed.length} targets in ${lastPollDurationMs} ms (${msgAccepted} accepted total)`);
      for (const v of parsed) {
        try {
          const mmsi = String(v?.mmsi ?? "").trim();
          if (!mmsi || mmsi === "0") continue;
          msgReceived++;
          /* Timestamp del servidor si viene, si no ahora. epoch_timestamp
             está en SEGUNDOS (documentado). */
          const tsSec = typeof v.epoch_timestamp === "number" ? v.epoch_timestamp : 0;
          const tsMs = tsSec > 0 ? tsSec * 1000 : Date.now();
          const upd: AisfriendsTargetUpdate = { mmsi, tsMs };
          const lat = typeof v.latitude === "number" ? v.latitude : null;
          const lng = typeof v.longitude === "number" ? v.longitude : null;
          if (lat != null && lng != null) { upd.lat = lat; upd.lng = lng; }
          if (typeof v.course_over_ground === "number" && v.course_over_ground >= 0 && v.course_over_ground < 360) {
            upd.cog = v.course_over_ground * Math.PI / 180;
          }
          if (typeof v.speed_over_ground === "number" && v.speed_over_ground >= 0) {
            upd.sog = v.speed_over_ground * 0.514444; // knots → m/s
          }
          if (typeof v.true_heading === "number" && v.true_heading >= 0 && v.true_heading < 360) {
            upd.heading = v.true_heading * Math.PI / 180;
          }
          if (v.name) upd.name = String(v.name).trim();
          else if (v.reported_name) upd.name = String(v.reported_name).trim();
          if (v.call_sign) upd.callsign = String(v.call_sign).trim();
          if (v.imo && Number(v.imo) > 0) upd.imo = String(v.imo);
          if (typeof v.ais_type === "number") upd.shipType = v.ais_type;
          if (typeof v.length === "number" && v.length > 0) upd.length = v.length;
          if (typeof v.beam === "number" && v.beam > 0) upd.beam = v.beam;
          opts.onUpdate(upd);
          msgAccepted++;
        } catch (e: any) {
          error(`parse vessel failed: ${e?.message ?? e}`);
        }
      }
    } catch (e: any) {
      lastError = String(e?.message ?? e);
      lastErrorMs = Date.now();
      connected = false;
      error(`poll exception: ${lastError}`);
    } finally {
      inFlight = false;
    }
  }

  function start() {
    if (pollTimer) return;
    setTimeout(() => { if (!closed) pollOnce(); }, 6_000);
    pollTimer = setInterval(() => { if (!closed) pollOnce(); }, intervalMs);
    debug(`aisfriends client started (poll every ${intervalMs} ms, bbox=${JSON.stringify(currentBB)})`);
  }

  start();

  return {
    updateBoundingBox(bb) { currentBB = bb; },
    close() {
      closed = true;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    },
    getStats() {
      return {
        received: msgReceived,
        accepted: msgAccepted,
        lastMsgMs,
        lastPollMs,
        lastPollDurationMs,
        pollCount,
        connected,
        boundingBox: currentBB,
        lastError,
        lastErrorMs,
        intervalMs,
        lastHttpStatus,
      };
    },
  };
}
