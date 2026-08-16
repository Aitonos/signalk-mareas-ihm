/**
 * Rev738 (feedback Carlos "motor AIS gratuito via online para los que no
 * tienen AIS o para extender la cobertura"): cliente WebSocket a
 * aisstream.io (https://aisstream.io) que consume el feed AIS terrestre
 * global y reenvía cada target al plugin via callback.
 *
 * Docs: https://aisstream.io/documentation
 * Endpoint: wss://stream.aisstream.io/v0/stream
 *
 * IMPORTANTE — Deduplicación:
 * El plugin ya tiene un receptor AIS por VHF propio como fuente primaria.
 * Este cliente es SÓLO fallback / extensión. La política de dedupe la
 * decide el caller (index.ts) en el callback: mismo MMSI que ya viene
 * por VHF fresco → ignorar el de aisstream. La política aquí es
 * neutral: entregar TODO lo recibido tal cual, el caller filtra.
 *
 * Reconnect exponencial (backoff 5s → 60s). Bounding box refrescable
 * al cambiar la posición del barco.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { createRequire } from "node:module";
const esmRequire = createRequire(import.meta.url);

export interface AisstreamTargetUpdate {
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
  tsMs: number;                // ms epoch de la recepción
}

export interface AisstreamOptions {
  token: string;
  /** Callback cada vez que llega un update (posición o estático). */
  onUpdate: (u: AisstreamTargetUpdate) => void;
  /** Callback opcional para logs. Defaults a console. */
  onDebug?: (msg: string) => void;
  onError?: (msg: string) => void;
  /** Bounding box inicial [[latMin,lngMin],[latMax,lngMax]]. */
  boundingBox: [[number, number], [number, number]];
}

interface AisstreamHandle {
  updateBoundingBox: (bb: [[number, number], [number, number]]) => void;
  close: () => void;
  /** Rev739: stats para diagnóstico desde el frontend.
   *  Rev746 (feedback Carlos "cert expired en aisstream"): incluye
   *  lastError y lastErrorMs para exponer el motivo real del fallo
   *  (cert caducado, connection refused, DNS, etc.) sin necesidad de
   *  SSH al Pi para ver journalctl.
   *  Rev865 (issue #40): expone rateLimitBackoffActive y nextReconnectMs
   *  para diagnosticar el 429 loop que llevaba a clientes silenciosos
   *  durante días sin recuperación. */
  getStats: () => {
    received: number;
    accepted: number;
    lastMsgMs: number;
    connected: boolean;
    boundingBox: [[number, number], [number, number]];
    lastError: string | null;
    lastErrorMs: number;
    rateLimitBackoffActive: boolean;
    nextReconnectMs: number;
  };
}

export function startAisstream(opts: AisstreamOptions): AisstreamHandle {
  const debug = opts.onDebug ?? ((m) => console.log("[aisstream] " + m));
  const error = opts.onError ?? ((m) => console.error("[aisstream] " + m));
  let ws: any = null;
  let closed = false;
  let currentBB = opts.boundingBox;
  /* Rev865 (issue #40): dos regímenes de backoff. El "normal" es agresivo
     (5s → 60s) para fallos transitorios (net drop, cert glitch). El
     "rate-limited" es lento (60s → 30min) porque cuando el server
     aisstream.io devuelve HTTP 429 en el handshake, seguir intentando
     cada 60s mantiene el rate-limit sliding-window activo indefinidamente
     y el cliente se queda silencioso durante días (visto en el diagnostic
     de @ABS0lute-1 issue #37: 2.7 días sin mensajes tras un 429). */
  const RECONNECT_MIN_MS = 5_000;
  const RECONNECT_MAX_MS = 60_000;
  const RATE_LIMIT_MIN_MS = 60_000;      // 1 min primer intento post-429
  const RATE_LIMIT_MAX_MS = 30 * 60_000; // 30 min cap
  let reconnectMs = RECONNECT_MIN_MS;
  let inRateLimitBackoff = false;
  let reconnectTimer: any = null;

  // Cargar `ws` via require dinámico — dependencia declarada en package.json.
  let WebSocketCtor: any = null;
  try {
    WebSocketCtor = esmRequire("ws");
  } catch (e: any) {
    error(`WebSocket lib ('ws') not available: ${e?.message ?? e}. Aisstream disabled.`);
    return {
      updateBoundingBox: () => { /* noop */ },
      close: () => { /* noop */ },
      getStats: () => ({ received: 0, accepted: 0, lastMsgMs: 0, connected: false, boundingBox: opts.boundingBox, lastError: "ws lib not available", lastErrorMs: Date.now(), rateLimitBackoffActive: false, nextReconnectMs: 0 }),
    };
  }

  function subscribe() {
    if (!ws || ws.readyState !== 1 /* OPEN */) return;
    /* Rev739 (docs check): aisstream cierra la conexión si no recibe
       subscribe en 3 s. Cubrimos también ExtendedClassBPositionReport
       (Class B extendido, no incluido antes) además de los otros
       position reports + estáticos. Coordenadas [lat, lng]. */
    const sub = {
      APIKey: opts.token,
      BoundingBoxes: [currentBB],
      FilterMessageTypes: [
        "PositionReport",
        "StandardClassBPositionReport",
        "ExtendedClassBPositionReport",
        "ShipStaticData",
        "StaticDataReport",
      ],
    };
    try {
      ws.send(JSON.stringify(sub));
      debug(`subscribed → bbox=${JSON.stringify(currentBB)} types=${sub.FilterMessageTypes.length}`);
    } catch (e: any) {
      error(`subscribe failed: ${e?.message ?? e}`);
    }
  }

  /* Rev739: contadores para diagnosticar. Log cada 100 msgs y stats
     accesibles via handle para el frontend. */
  let msgReceived = 0;
  let msgAccepted = 0;
  let lastMsgMs = 0;
  let lastError: string | null = null;
  let lastErrorMs = 0;

  /* Rev745 (feedback Carlos "ahora no sale ninguno" + diagnóstico
     mostró WS desconectado 13.5 h sin auto-recovery): watchdog
     obligatorio que fuerza reconnect si:
     - ws no está OPEN durante >30 s
     - o no llega ningún mensaje en 5 min (WS "zombie" — silenciosamente
       cortado sin close event, típico en NAT/mobile).
     Log claro de cada intento para poder debuggear en journalctl. */
  const WATCHDOG_INTERVAL_MS = 30_000;
  const NO_MSG_TIMEOUT_MS = 5 * 60_000;
  let watchdogTimer: any = null;

  function connect() {
    if (closed) return;
    try {
      ws = new WebSocketCtor("wss://stream.aisstream.io/v0/stream");
    } catch (e: any) {
      lastError = String(e?.message ?? e);
      lastErrorMs = Date.now();
      error(`connect failed: ${lastError}`);
      scheduleReconnect();
      return;
    }
    ws.on("open", () => {
      /* Rev865 (issue #40): NO resetear el backoff aquí. Un handshake
         exitoso NO garantiza que el server no nos cierre inmediatamente
         con 429 o error de suscripción. El reset del backoff se hace al
         PRIMER mensaje real recibido — sabemos que la sesión está viva. */
      debug(`websocket open`);
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      lastError = null;
      subscribe();
    });
    ws.on("message", (buf: Buffer) => {
      let msg: any = null;
      try { msg = JSON.parse(buf.toString("utf8")); }
      catch { return; }
      msgReceived++;
      lastMsgMs = Date.now();
      if (msgReceived === 1) {
        debug(`first message received (subscribe OK)`);
        /* Rev865 (issue #40): reset del backoff solo al primer mensaje
           real — confirma que la sesión funciona end-to-end (no solo
           handshake). Sale del rate-limit backoff si estábamos ahí. */
        if (inRateLimitBackoff) {
          debug(`rate-limit backoff released after successful data flow`);
          inRateLimitBackoff = false;
        }
        reconnectMs = RECONNECT_MIN_MS;
      }
      if (msgReceived % 100 === 0) debug(`stats: ${msgReceived} recv / ${msgAccepted} accepted`);
      /* Rev739: si el server nos manda un mensaje de error, log claro. */
      if (msg?.error || msg?.MessageType === "Error") {
        error(`server error message: ${JSON.stringify(msg)}`);
        return;
      }
      try {
        const meta = msg?.MetaData ?? {};
        const mmsi = String(meta.MMSI ?? meta.MMSI_String ?? "").trim();
        if (!mmsi) return;
        const upd: AisstreamTargetUpdate = { mmsi, tsMs: Date.now() };
        // MetaData siempre trae latitude/longitude en el message si es posición.
        const lat = typeof meta.latitude === "number" ? meta.latitude : null;
        const lng = typeof meta.longitude === "number" ? meta.longitude : null;
        if (lat != null && lng != null) { upd.lat = lat; upd.lng = lng; }
        if (meta.ShipName) upd.name = String(meta.ShipName).trim();
        const inner = msg?.Message ?? {};
        // PositionReport (Class A) o StandardClassBPositionReport
        const pos = inner.PositionReport ?? inner.StandardClassBPositionReport ?? null;
        if (pos) {
          if (typeof pos.Cog === "number" && pos.Cog >= 0 && pos.Cog < 360) {
            upd.cog = pos.Cog * Math.PI / 180;
          }
          if (typeof pos.Sog === "number" && pos.Sog >= 0) {
            upd.sog = pos.Sog * 0.514444; // knots → m/s
          }
          if (typeof pos.TrueHeading === "number" && pos.TrueHeading >= 0 && pos.TrueHeading < 360) {
            upd.heading = pos.TrueHeading * Math.PI / 180;
          }
        }
        // ShipStaticData: name, type, dimensions, callsign, imo
        const stat = inner.ShipStaticData ?? null;
        if (stat) {
          if (stat.Name && !upd.name) upd.name = String(stat.Name).trim();
          if (typeof stat.Type === "number") upd.shipType = stat.Type;
          if (stat.CallSign) upd.callsign = String(stat.CallSign).trim();
          if (stat.ImoNumber) upd.imo = String(stat.ImoNumber);
          const dim = stat.Dimension ?? {};
          const toBow = Number(dim.A) || 0;
          const toStern = Number(dim.B) || 0;
          const toPort = Number(dim.C) || 0;
          const toStbd = Number(dim.D) || 0;
          const len = toBow + toStern;
          const beam = toPort + toStbd;
          if (len > 0) upd.length = len;
          if (beam > 0) upd.beam = beam;
        }
        opts.onUpdate(upd);
        msgAccepted++;
      } catch (e: any) {
        error(`parse failed: ${e?.message ?? e}`);
      }
    });
    ws.on("close", (code: number, reason: any) => {
      const r = reason ? String(reason) : "";
      debug(`websocket closed (code=${code}${r ? " reason=" + r.slice(0, 100) : ""})`);
      scheduleReconnect();
    });
    ws.on("error", (e: any) => {
      const errStr = String(e?.message ?? e);
      lastError = errStr;
      lastErrorMs = Date.now();
      error(`websocket error: ${lastError}`);
      /* Rev865 (issue #40): detectar HTTP 429 (rate limit) del server y
         entrar en régimen de backoff lento. Sin esto, el cliente reintentaba
         cada 60s indefinidamente contra un server que rechazaba por rate
         limit — la ventana rate-limit se mantenía deslizante y el cliente
         quedaba silencioso durante días. Fix: subir a backoff min 60s,
         max 30min con exponencial. */
      if (/\b429\b/.test(errStr) && !inRateLimitBackoff) {
        inRateLimitBackoff = true;
        reconnectMs = RATE_LIMIT_MIN_MS;
        debug(`HTTP 429 rate limit detected → entering rate-limit backoff (start ${RATE_LIMIT_MIN_MS}ms, cap ${RATE_LIMIT_MAX_MS}ms)`);
      }
      // 'close' vendrá detrás y disparará reconnect — si no viene, el
      // watchdog fuerza un connect() nuevo en <=30 s.
    });
  }

  function scheduleReconnect() {
    if (closed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    /* Rev865 (issue #40): jitter ±20% para que múltiples clientes que
       hayan topado 429 al mismo tiempo (ej. rearranque de infra
       aisstream.io) no vuelvan a sincronizarse al reconectar. */
    const jitter = 1 + (Math.random() * 0.4 - 0.2);
    const waitMs = Math.max(1000, Math.round(reconnectMs * jitter));
    const cap = inRateLimitBackoff ? RATE_LIMIT_MAX_MS : RECONNECT_MAX_MS;
    const regime = inRateLimitBackoff ? "rate-limit" : "normal";
    debug(`reconnecting in ${waitMs}ms (${regime} backoff, next step cap ${cap}ms)`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectMs = Math.min(cap, reconnectMs * 2);
      connect();
    }, waitMs);
  }

  /* Rev745: watchdog periódico independiente. Cubre el caso donde
     ws.on('close') no dispara (WS zombie / NAT timeout / carrier drop
     silencioso) — sin esto, el cliente se quedaba muerto indefinidamente. */
  function startWatchdog() {
    if (watchdogTimer) return;
    watchdogTimer = setInterval(() => {
      if (closed) return;
      const now = Date.now();
      const wsOpen = !!(ws && ws.readyState === 1);
      const noMsgFor = lastMsgMs > 0 ? (now - lastMsgMs) : 0;
      if (!wsOpen && !reconnectTimer) {
        debug(`watchdog: ws not open and no reconnect scheduled → force reconnect`);
        connect();
        return;
      }
      if (wsOpen && noMsgFor > NO_MSG_TIMEOUT_MS) {
        debug(`watchdog: no messages for ${Math.round(noMsgFor/1000)}s (zombie WS) → force close+reconnect`);
        try { ws?.close(); } catch { /* defensive */ }
        // El close handler llamará a scheduleReconnect.
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  connect();
  startWatchdog();

  return {
    updateBoundingBox(bb) {
      currentBB = bb;
      if (ws && ws.readyState === 1) subscribe(); // re-suscribir
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
      try { ws?.close(); } catch { /* defensive */ }
      ws = null;
    },
    getStats() {
      return {
        received: msgReceived,
        accepted: msgAccepted,
        lastMsgMs,
        connected: !!(ws && ws.readyState === 1),
        boundingBox: currentBB,
        lastError,
        lastErrorMs,
        /* Rev865 (issue #40): expone estado del rate-limit backoff
           para que el diagnostic (y el user via UI) vea cuándo estamos
           bloqueados por 429 vs simplemente offline. `nextReconnectMs`
           es el intervalo del PRÓXIMO reconnect (ya escalado, no el
           anterior) — 0 si no hay reconnect programado. */
        rateLimitBackoffActive: inRateLimitBackoff,
        nextReconnectMs: reconnectTimer ? reconnectMs : 0,
      };
    },
  };
}
