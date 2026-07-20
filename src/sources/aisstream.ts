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
   *  SSH al Pi para ver journalctl. */
  getStats: () => { received: number; accepted: number; lastMsgMs: number; connected: boolean; boundingBox: [[number, number], [number, number]]; lastError: string | null; lastErrorMs: number };
}

export function startAisstream(opts: AisstreamOptions): AisstreamHandle {
  const debug = opts.onDebug ?? ((m) => console.log("[aisstream] " + m));
  const error = opts.onError ?? ((m) => console.error("[aisstream] " + m));
  let ws: any = null;
  let closed = false;
  let currentBB = opts.boundingBox;
  let reconnectMs = 5_000;
  const RECONNECT_MAX_MS = 60_000;
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
      getStats: () => ({ received: 0, accepted: 0, lastMsgMs: 0, connected: false, boundingBox: opts.boundingBox, lastError: "ws lib not available", lastErrorMs: Date.now() }),
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
      debug(`websocket open (reset backoff, prev streak ended)`);
      reconnectMs = 5_000; // reset backoff en conexión exitosa
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
      if (msgReceived === 1) debug(`first message received (subscribe OK)`);
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
      lastError = String(e?.message ?? e);
      lastErrorMs = Date.now();
      error(`websocket error: ${lastError}`);
      // 'close' vendrá detrás y disparará reconnect — si no viene, el
      // watchdog fuerza un connect() nuevo en <=30 s.
    });
  }

  function scheduleReconnect() {
    if (closed) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    debug(`reconnecting in ${reconnectMs}ms (streak resets on next successful open)`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectMs = Math.min(RECONNECT_MAX_MS, reconnectMs * 2);
      connect();
    }, reconnectMs);
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
      };
    },
  };
}
