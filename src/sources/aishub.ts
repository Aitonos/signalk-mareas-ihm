/**
 * Rev754 (feedback Carlos "AISHub — cada usuario con su API tras
 * contribuir su feed"): cliente HTTP polling a data.aishub.net que
 * consume el pool AIS crowd-sourced global.
 *
 * Docs: https://www.aishub.net/api
 * Endpoint: https://data.aishub.net/ws.php
 *
 * IMPORTANTE — Modelo AISHub:
 * Para tener API key el usuario tiene que compartir SU propio feed AIS
 * con la red AISHub. La key global del desarrollador (Aitonos) NUNCA
 * se distribuye — cada usuario obtiene la suya en aishub.net → JOIN US.
 * El plugin NO envía tráfico saliente (no somos AIS Dispatcher todavía);
 * solo consume.
 *
 * Rate limit ESTRICTO: 1 request / minuto (documentado). Superarlo
 * devuelve payload vacío. Polling cada 65 s para asegurar margen.
 *
 * Dedupe: el caller (index.ts, _aishubMergeUpdate) descarta MMSIs
 * frescos por VHF (60 s) o por aisstream (120 s) — aishub es el más
 * lento, por debajo en prioridad.
 */

export interface AishubTargetUpdate {
  mmsi: string;
  lat?: number | null;
  lng?: number | null;
  cog?: number | null;         // rad
  sog?: number | null;         // m/s
  heading?: number | null;     // rad
  name?: string | null;
  shipType?: number | null;
  callsign?: string | null;
  imo?: string | null;
  length?: number | null;      // m
  beam?: number | null;        // m
  tsMs: number;
}

export interface AishubOptions {
  apiKey: string;
  onUpdate: (u: AishubTargetUpdate) => void;
  onDebug?: (msg: string) => void;
  onError?: (msg: string) => void;
  /** BBox [[latMin,lngMin],[latMax,lngMax]] refrescable. */
  boundingBox: [[number, number], [number, number]];
  /** Ms entre polls. Default 65000 (respeta límite 1/min con margen). */
  pollIntervalMs?: number;
}

interface AishubHandle {
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
    /* Rev865 (issue #40): visibilidad del rate-limit backoff. */
    rateLimitBackoffActive: boolean;
    nextPollInMs: number;
  };
}

const ENDPOINT = "https://data.aishub.net/ws.php";
/* AISHub responde array de 2 elementos:
   [0] = header: { ERROR, ERROR_MESSAGE?, USERNAME, FORMAT, LATMIN, LATMAX, LONMIN, LONMAX, RECORDS }
   [1] = array de vessels: [{ MMSI, TIME, LONGITUDE, LATITUDE, COG, SOG, HEADING, IMO, NAME, CALLSIGN, TYPE, A, B, C, D, ... }]
   Si ERROR:true → error en la request (rate-limit, key inválida, etc.). */

export function startAishub(opts: AishubOptions): AishubHandle {
  const debug = opts.onDebug ?? ((m) => console.log("[aishub] " + m));
  const error = opts.onError ?? ((m) => console.error("[aishub] " + m));
  let closed = false;
  let currentBB = opts.boundingBox;
  const intervalMs = Math.max(60_000, opts.pollIntervalMs ?? 65_000);
  /* Rev865 (issue #40): backoff separado para rate-limit / errores
     persistentes del server. Sin esto, seguíamos polleando cada 65 s
     contra un endpoint que devolvía 429/error persistente, manteniendo
     la ventana rate-limit deslizante activa y auto-perpetuándose. */
  const RATE_LIMIT_MIN_MS = 5 * 60_000;   // 5 min tras primer 429/error
  const RATE_LIMIT_MAX_MS = 30 * 60_000;  // 30 min cap
  let backoffMs = intervalMs;
  let inRateLimitBackoff = false;
  let pollTimer: any = null;
  let nextPollAtMs = 0; // ms epoch cuándo dispara el próximo poll
  let msgReceived = 0;
  let msgAccepted = 0;
  let lastMsgMs = 0;
  let lastPollMs = 0;
  let lastPollDurationMs = 0;
  let pollCount = 0;
  let lastError: string | null = null;
  let lastErrorMs = 0;
  let connected = false;
  let inFlight = false;

  function bboxUrl(): string {
    const [[latMin, lngMin], [latMax, lngMax]] = currentBB;
    const p = new URLSearchParams({
      username: opts.apiKey,
      format: "1",         // human-readable numeric
      output: "json",
      compress: "0",
      latmin: String(latMin),
      latmax: String(latMax),
      lonmin: String(lngMin),
      lonmax: String(lngMax),
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
        headers: { "Accept": "application/json", "User-Agent": "signalk-mareas-ihm/aishub" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        lastErrorMs = Date.now();
        connected = false;
        error(`poll failed: ${lastError}`);
        /* Rev865 (issue #40): entrar en rate-limit backoff para 429 y
           también para 5xx sostenidos. 4xx que no sea 429 son bugs de
           config (401/403 = credenciales inválidas) — mismo tratamiento
           conservador para no martillar el server. */
        if (res.status === 429 || res.status === 403 || res.status >= 500) {
          _enterRateLimitBackoff(`HTTP ${res.status}`);
        }
        return;
      }
      const raw = await res.text();
      lastPollDurationMs = Date.now() - t0;
      if (!raw || raw.trim().length === 0) {
        /* Rate-limit hit → aishub devuelve vacío. Log una vez cada 5 polls. */
        lastError = "empty response (rate-limit or no records)";
        lastErrorMs = Date.now();
        connected = false;
        if (pollCount % 5 === 1) debug(`empty response (rate-limit or no data in bbox)`);
        return;
      }
      let parsed: any;
      try { parsed = JSON.parse(raw); }
      catch (e: any) {
        lastError = `JSON parse failed: ${e?.message ?? e}`;
        lastErrorMs = Date.now();
        connected = false;
        error(lastError);
        return;
      }
      if (!Array.isArray(parsed) || parsed.length < 1) {
        lastError = "unexpected payload shape";
        lastErrorMs = Date.now();
        connected = false;
        error(`${lastError}: ${raw.slice(0, 120)}`);
        return;
      }
      const header = parsed[0] ?? {};
      if (header.ERROR === true || header.ERROR === "true") {
        lastError = `server error: ${header.ERROR_MESSAGE || "unknown"}`;
        lastErrorMs = Date.now();
        connected = false;
        error(lastError);
        return;
      }
      const vessels: any[] = Array.isArray(parsed[1]) ? parsed[1] : [];
      connected = true;
      lastError = null;
      lastMsgMs = Date.now();
      /* Rev865 (issue #40): poll exitoso → salir del backoff si estábamos. */
      if (inRateLimitBackoff) {
        debug(`rate-limit backoff released after successful poll`);
        inRateLimitBackoff = false;
      }
      backoffMs = intervalMs;
      if (pollCount === 1) debug(`first poll OK — ${vessels.length} targets (RECORDS=${header.RECORDS})`);
      if (pollCount % 10 === 0) debug(`stats: poll #${pollCount} ${vessels.length} targets in ${lastPollDurationMs} ms (${msgAccepted} accepted total)`);
      for (const v of vessels) {
        try {
          const mmsi = String(v?.MMSI ?? "").trim();
          if (!mmsi) continue;
          msgReceived++;
          const upd: AishubTargetUpdate = { mmsi, tsMs: Date.now() };
          const lat = typeof v.LATITUDE === "number" ? v.LATITUDE : null;
          const lng = typeof v.LONGITUDE === "number" ? v.LONGITUDE : null;
          if (lat != null && lng != null) { upd.lat = lat; upd.lng = lng; }
          if (typeof v.COG === "number" && v.COG >= 0 && v.COG < 360) upd.cog = v.COG * Math.PI / 180;
          if (typeof v.SOG === "number" && v.SOG >= 0) upd.sog = v.SOG * 0.514444; // knots → m/s
          if (typeof v.HEADING === "number" && v.HEADING >= 0 && v.HEADING < 360) upd.heading = v.HEADING * Math.PI / 180;
          if (v.NAME) upd.name = String(v.NAME).trim();
          if (v.CALLSIGN) upd.callsign = String(v.CALLSIGN).trim();
          if (v.IMO && String(v.IMO) !== "0") upd.imo = String(v.IMO);
          if (typeof v.TYPE === "number") upd.shipType = v.TYPE;
          const toBow = Number(v.A) || 0;
          const toStern = Number(v.B) || 0;
          const toPort = Number(v.C) || 0;
          const toStbd = Number(v.D) || 0;
          const len = toBow + toStern;
          const beam = toPort + toStbd;
          if (len > 0) upd.length = len;
          if (beam > 0) upd.beam = beam;
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
      /* Rev865 (issue #40): re-armar el próximo poll con el delay adaptativo. */
      _scheduleNext();
    }
  }

  /* Rev865 (issue #40): entra en modo backoff exponencial para rate-limit
     (429) o errores persistentes del server (403 credencial, 5xx). */
  function _enterRateLimitBackoff(reason: string): void {
    if (!inRateLimitBackoff) {
      inRateLimitBackoff = true;
      backoffMs = RATE_LIMIT_MIN_MS;
      debug(`entering rate-limit backoff (${reason}) — first retry in ${backoffMs}ms, cap ${RATE_LIMIT_MAX_MS}ms`);
    } else {
      backoffMs = Math.min(RATE_LIMIT_MAX_MS, backoffMs * 2);
      debug(`still ${reason}, backoff extended to ${backoffMs}ms`);
    }
  }

  /* Rev865 (issue #40): scheduler adaptativo. Usa `intervalMs` (65 s)
     en modo normal; `backoffMs` en modo rate-limit. Jitter ±20 % evita
     sincronización de múltiples clientes tras un rearranque de infra
     aisstream/aishub que hubiese 429'd a todos a la vez. */
  function _scheduleNext(): void {
    if (closed) return;
    if (pollTimer) clearTimeout(pollTimer);
    const base = inRateLimitBackoff ? backoffMs : intervalMs;
    const jitter = 1 + (Math.random() * 0.4 - 0.2);
    const waitMs = Math.max(1000, Math.round(base * jitter));
    nextPollAtMs = Date.now() + waitMs;
    pollTimer = setTimeout(() => { if (!closed) pollOnce(); }, waitMs);
  }

  function start() {
    if (pollTimer) return;
    /* Primer poll con 5 s de retraso para no chocar con arranque de SK. */
    pollTimer = setTimeout(() => { if (!closed) pollOnce(); }, 5_000);
    nextPollAtMs = Date.now() + 5_000;
    debug(`aishub client started (poll every ${intervalMs} ms nominal, bbox=${JSON.stringify(currentBB)})`);
  }

  start();

  return {
    updateBoundingBox(bb) {
      currentBB = bb;
      /* Rev754: al cambiar bbox no forzamos poll inmediato (respetamos
         el 1/min). El próximo tick usa el bbox nuevo. */
    },
    close() {
      closed = true;
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
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
        rateLimitBackoffActive: inRateLimitBackoff,
        nextPollInMs: Math.max(0, nextPollAtMs - Date.now()),
      };
    },
  };
}
