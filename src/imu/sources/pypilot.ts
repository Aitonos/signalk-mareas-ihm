/**
 * Rev147 — PypilotKeyValueSource.
 *
 * Conecta al servidor TCP key/value de pypilot (puerto 23322 por defecto) y
 * suscribe las variables IMU internas: imu.heading, imu.pitch, imu.roll,
 * imu.heel, imu.accel, imu.gyro. Notas profesionales:
 *
 *   - El puerto NMEA 0183 de pypilot (20220) NO se usa aquí — no expone
 *     variables internas, solo sentencias NMEA agregadas.
 *   - El puerto key/value (23322) es el canal correcto para observar el
 *     estado interno del autopilot, incluyendo IMU.
 *   - La conexión es probada con un short timeout para auto-detect (probe()).
 *     Una vez aceptada, queda enganchada con reconnect backoff.
 *
 * Esta clase es una thin wrapper del bridge existente en index.ts (Rev106+).
 * Para no duplicar la lógica TCP/JSON-line, expone un constructor que recibe
 * `feedSample` (callback) y la fuente lo invoca cuando llega data fresca.
 * El cableado real con el bridge legacy se hace en ImuManager.
 */

import { Socket } from "net";
import type { ImuSource, ImuSample, ImuProvides, ImuQuality, ImuSourceStatus, ImuSourceType } from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; }

const PYPILOT_G_TO_MS2 = 9.80665;
const PYPILOT_WATCHES = ["imu.accel", "imu.gyro", "imu.heading", "imu.pitch", "imu.roll", "imu.heel"];
const RECONNECT_MS = 5_000;
const PROBE_TIMEOUT_MS = 3_000;
const FRESH_WINDOW_MS = 2_000;

export class PypilotKeyValueSource implements ImuSource {
  readonly id: string;
  readonly type: ImuSourceType;
  readonly priority: number;
  status: ImuSourceStatus = "disabled";
  lastSeen = 0;
  lastError: string | null = null;
  provides: ImuProvides = {
    headingMagnetic: false,
    headingTrue: false,
    roll: false,
    pitch: false,
    heel: false,
    trim: false,
    acceleration: false,
    gyro: false,
    calibrationState: false,
  };
  quality: ImuQuality = {
    sampleRateHz: 0,
    ageMs: Infinity,
    invalidCount: 0,
    coherent: false,
  };

  host: string;
  port: number;
  model = "pypilot-imu";

  private app: SignalKApp;
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private buffer = "";
  private currentSample: ImuSample = { ts: 0 };
  private staleAfterMs: number;
  private _recentTs: number[] = [];

  constructor(opts: {
    app: SignalKApp;
    host: string;
    port?: number;
    isLocal: boolean;
    staleAfterMs?: number;
  }) {
    this.app = opts.app;
    this.host = opts.host;
    this.port = opts.port ?? 23322;
    this.staleAfterMs = opts.staleAfterMs ?? 10_000;
    this.id = opts.isLocal ? "pypilot-local" : `pypilot-${this.host}`;
    this.type = opts.isLocal ? "pypilot-local" : "pypilot-network";
    // Local > remoto (latencia, fiabilidad de red).
    this.priority = opts.isLocal ? 70 : 60;
  }

  /**
   * Probe rápido para auto-detect: intenta TCP connect con timeout corto y
   * verifica que en N ms recibimos al menos un JSON-line válido. Cierra
   * inmediatamente después de la confirmación. NO altera estado del source
   * para el flujo normal — usa una conexión efímera.
   */
  async probe(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const sock = new Socket();
      let resolved = false;
      const finish = (ok: boolean) => {
        if (resolved) return;
        resolved = true;
        try { sock.destroy(); } catch { /* ignore */ }
        resolve(ok);
      };
      sock.setTimeout(PROBE_TIMEOUT_MS);
      sock.on("timeout", () => finish(false));
      sock.on("error", () => finish(false));
      let buf = "";
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        // Pypilot responde a watch con líneas JSON; cualquier '\n' indica
        // que el protocolo está vivo. No necesitamos parsear aquí.
        if (buf.indexOf("\n") >= 0) finish(true);
      });
      sock.connect(this.port, this.host, () => {
        // Suscribimos a una variable barata para forzar respuesta.
        try { sock.write('watch={"imu.heading":true}\n'); } catch { finish(false); }
      });
    });
  }

  start(): void {
    if (this.socket || this.reconnectTimer) return;
    this.status = "available";
    this.lastError = null;
    this._connect();
  }

  stop(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) { try { this.socket.destroy(); } catch { /* ignore */ } this.socket = null; }
    this.status = "disabled";
    this.buffer = "";
  }

  poll(): ImuSample | null {
    const now = Date.now();
    const age = this.lastSeen > 0 ? now - this.lastSeen : Infinity;
    // Tasa rolling
    while (this._recentTs.length > 0 && now - this._recentTs[0] > 30_000) this._recentTs.shift();
    this.quality.sampleRateHz = Math.round((this._recentTs.length / 30) * 10) / 10;
    this.quality.ageMs = age;
    if (age > this.staleAfterMs) {
      this.status = this.socket ? "stale" : "error";
      this.quality.coherent = false;
      return null;
    }
    if (now - this.currentSample.ts > FRESH_WINDOW_MS) return null;
    this.status = "active";
    this.quality.coherent = true;
    return { ...this.currentSample, ts: now };
  }

  // ─────────────────────────── TCP plumbing ───────────────────────────

  private _connect(): void {
    if (!this.host) {
      this.status = "error";
      this.lastError = "no host configured";
      return;
    }
    const sock = new Socket();
    this.socket = sock;
    sock.on("connect", () => {
      this.app.debug?.(`[IMU-PYPILOT] connected ${this.host}:${this.port}`);
      // Suscribir a las variables IMU
      try {
        for (const path of PYPILOT_WATCHES) {
          sock.write(`watch={"${path}":true}\n`);
        }
      } catch (e: any) {
        this.lastError = `watch failed: ${e?.message ?? e}`;
      }
    });
    sock.on("data", (chunk) => this._onData(chunk.toString("utf8")));
    sock.on("error", (err) => {
      this.lastError = err?.message ?? String(err);
      this.status = "error";
    });
    sock.on("close", () => {
      this.socket = null;
      if (this.status !== "disabled") {
        this._scheduleReconnect();
      }
    });
    sock.connect(this.port, this.host);
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, RECONNECT_MS);
  }

  private _onData(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      this._parseLine(line);
    }
  }

  private _parseLine(line: string): void {
    // Pypilot a veces emite "key={...}" o JSON puro. Intentamos parse JSON.
    let obj: any;
    try { obj = JSON.parse(line); }
    catch {
      // Fallback formato "name=value"
      const eq = line.indexOf("=");
      if (eq < 0) return;
      const name = line.slice(0, eq).trim();
      try {
        const val = JSON.parse(line.slice(eq + 1));
        this._handleNameValue(name, val);
      } catch { /* ignore */ }
      return;
    }
    if (obj && typeof obj === "object") {
      for (const k of Object.keys(obj)) this._handleNameValue(k, obj[k]);
    }
  }

  private _handleNameValue(name: string, value: any): void {
    const now = Date.now();
    let updated = false;
    if (name === "imu.accel" && Array.isArray(value) && value.length >= 3) {
      this.currentSample.ax = Number(value[0]) * PYPILOT_G_TO_MS2;
      this.currentSample.ay = Number(value[1]) * PYPILOT_G_TO_MS2;
      this.currentSample.az = Number(value[2]) * PYPILOT_G_TO_MS2;
      this.provides.acceleration = true;
      updated = true;
    } else if (name === "imu.gyro" && Array.isArray(value) && value.length >= 3) {
      this.currentSample.gx = Number(value[0]) * (Math.PI / 180);
      this.currentSample.gy = Number(value[1]) * (Math.PI / 180);
      this.currentSample.gz = Number(value[2]) * (Math.PI / 180);
      this.provides.gyro = true;
      updated = true;
    } else if (name === "imu.heading") {
      const n = Number(value);
      if (isFinite(n)) {
        this.currentSample.headingMagnetic = n * (Math.PI / 180);
        this.provides.headingMagnetic = true;
        updated = true;
      }
    } else if (name === "imu.pitch") {
      const n = Number(value);
      if (isFinite(n)) {
        this.currentSample.pitch = n * (Math.PI / 180);
        this.provides.pitch = true;
        updated = true;
      }
    } else if (name === "imu.roll") {
      const n = Number(value);
      if (isFinite(n)) {
        this.currentSample.roll = n * (Math.PI / 180);
        this.provides.roll = true;
        updated = true;
      }
    } else if (name === "imu.heel") {
      const n = Number(value);
      if (isFinite(n)) {
        this.currentSample.heel = n * (Math.PI / 180);
        this.provides.heel = true;
        updated = true;
      }
    }
    if (updated) {
      this.currentSample.ts = now;
      this.lastSeen = now;
      this._recentTs.push(now);
      this.status = "active";
    }
  }
}
