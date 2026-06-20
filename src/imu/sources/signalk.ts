/**
 * Rev147 — SignalKAttitudeSource.
 *
 * Lee datos IMU ya publicados en Signal K por OTROS plugins (pypilot's own
 * SK plugin, signalk-bno055, signalk-i2c-imu, signalk-mpu9250, signalk-ros2-imu,
 * etc.). NO se conecta a nada por sí misma; usa app.getSelfPath con paths SK
 * estándar.
 *
 * Paths consultados (en orden de preferencia):
 *   - navigation.attitude (composite con pitch/roll/yaw)
 *   - navigation.headingMagnetic
 *   - navigation.headingTrue
 *   - navigation.acceleration (algunos plugins SÍ logran publicar como leaves)
 *   - navigation.gyro
 *
 * Esta fuente es siempre TRY-FIRST — la más barata y la que respeta mejor
 * la arquitectura SignalK. Si hay datos válidos, se elige ella.
 */

import type { ImuSource, ImuSample, ImuProvides, ImuQuality, ImuSourceStatus } from "../types.js";

interface SignalKApp {
  getSelfPath: (path: string) => any;
  debug?: (msg: string) => void;
}

export class SignalKAttitudeSource implements ImuSource {
  readonly id = "signalk";
  readonly type = "signalk" as const;
  /** Preferente sobre fuentes propias salvo manual lock — respeta SK
   * core como fuente de verdad cuando ya hay datos. */
  readonly priority = 80;
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

  private app: SignalKApp;
  private staleAfterMs: number;
  private _recentTs: number[] = []; // últimos timestamps observados (para tasa)
  private _lastSample: ImuSample | null = null;
  private _invalidCount30s = 0;
  private _invalidSampleTs: number[] = []; // para limpiar contador >30 s

  constructor(app: SignalKApp, opts: { staleAfterMs?: number } = {}) {
    this.app = app;
    this.staleAfterMs = opts.staleAfterMs ?? 10_000;
  }

  start(): void {
    this.status = "available";
    this.lastError = null;
  }

  stop(): void {
    this.status = "disabled";
    this._recentTs = [];
    this._lastSample = null;
  }

  poll(): ImuSample | null {
    const now = Date.now();
    const sample: ImuSample = { ts: now };

    // navigation.attitude — composite con {roll, pitch, yaw}
    const attitudeRaw = this._safeGetPath("navigation.attitude");
    let attitudeTs = 0;
    if (attitudeRaw && typeof attitudeRaw === "object") {
      const v = attitudeRaw.value && typeof attitudeRaw.value === "object" ? attitudeRaw.value : attitudeRaw;
      if (typeof v.roll === "number") sample.roll = v.roll;
      if (typeof v.pitch === "number") sample.pitch = v.pitch;
      if (typeof v.yaw === "number") sample.headingMagnetic = v.yaw; // yaw como fallback
      attitudeTs = this._extractTs(attitudeRaw);
    }

    // navigation.headingMagnetic (numérico) — gana sobre yaw de attitude
    const hm = this._readNumber("navigation.headingMagnetic");
    if (hm.v !== null) {
      sample.headingMagnetic = hm.v;
      if (hm.ts > attitudeTs) attitudeTs = hm.ts;
    }
    const ht = this._readNumber("navigation.headingTrue");
    if (ht.v !== null) {
      sample.headingTrue = ht.v;
    }

    // navigation.acceleration — composite {x,y,z} OR leaves
    const accel = this._readVector("navigation.acceleration");
    if (accel.x !== null || accel.y !== null || accel.z !== null) {
      sample.ax = accel.x;
      sample.ay = accel.y;
      sample.az = accel.z;
    }
    const gyro = this._readVector("navigation.gyro");
    if (gyro.x !== null || gyro.y !== null || gyro.z !== null) {
      sample.gx = gyro.x;
      sample.gy = gyro.y;
      sample.gz = gyro.z;
    }

    // Quality
    const maxTs = Math.max(attitudeTs, hm.ts, ht.ts, accel.ts, gyro.ts);
    const ageMs = maxTs > 0 ? now - maxTs : Infinity;
    if (maxTs > 0) this.lastSeen = maxTs;
    this._updateProvides(sample);
    this._updateQuality(now, ageMs, sample);

    if (ageMs > this.staleAfterMs) {
      this.status = "stale";
      return null;
    }
    if (!this._hasAnyData(sample)) {
      this.status = "available";
      return null;
    }
    this.status = "active";
    this._lastSample = sample;
    return sample;
  }

  // ─────────────────────────── internals ───────────────────────────

  private _safeGetPath(path: string): any {
    try { return this.app.getSelfPath(path); } catch { return undefined; }
  }

  private _extractTs(raw: any): number {
    const t = raw?.timestamp;
    if (typeof t === "string") {
      const x = Date.parse(t);
      return isNaN(x) ? 0 : x;
    }
    if (t instanceof Date) return t.getTime();
    if (typeof t === "number" && isFinite(t)) return t;
    return 0;
  }

  /** Lee path numérico simple, devuelve {v, ts}. */
  private _readNumber(path: string): { v: number | null; ts: number } {
    const raw = this._safeGetPath(path);
    if (raw == null) return { v: null, ts: 0 };
    if (typeof raw === "number") return { v: raw, ts: 0 };
    if (typeof raw === "object") {
      const v = typeof raw.value === "number" ? raw.value : null;
      const ts = this._extractTs(raw);
      return { v, ts };
    }
    return { v: null, ts: 0 };
  }

  /** Lee path composite {x,y,z} (con ts) o leaves directos. */
  private _readVector(path: string): { x: number | null; y: number | null; z: number | null; ts: number } {
    const raw = this._safeGetPath(path);
    let ts = 0;
    if (raw && typeof raw === "object") {
      const v = raw.value && typeof raw.value === "object" ? raw.value : raw;
      ts = this._extractTs(raw);
      const x = typeof v.x === "number" ? v.x : null;
      const y = typeof v.y === "number" ? v.y : null;
      const z = typeof v.z === "number" ? v.z : null;
      if (x !== null || y !== null || z !== null) return { x, y, z, ts };
    }
    // Fallback: leaves directos
    const lx = this._readNumber(`${path}.x`);
    const ly = this._readNumber(`${path}.y`);
    const lz = this._readNumber(`${path}.z`);
    ts = Math.max(ts, lx.ts, ly.ts, lz.ts);
    return { x: lx.v, y: ly.v, z: lz.v, ts };
  }

  private _updateProvides(sample: ImuSample): void {
    this.provides = {
      headingMagnetic: sample.headingMagnetic != null,
      headingTrue: sample.headingTrue != null,
      roll: sample.roll != null,
      pitch: sample.pitch != null,
      heel: false, // SK estándar no usa "heel", pero algunos plugins sí
      trim: false,
      acceleration: sample.ax != null || sample.ay != null || sample.az != null,
      gyro: sample.gx != null || sample.gy != null || sample.gz != null,
      calibrationState: false,
    };
  }

  private _updateQuality(now: number, ageMs: number, sample: ImuSample): void {
    // Validación física rápida
    let invalid = false;
    if (sample.headingMagnetic != null && (sample.headingMagnetic < -2 * Math.PI - 0.1 || sample.headingMagnetic > 2 * Math.PI + 0.1)) invalid = true;
    if (sample.roll != null && Math.abs(sample.roll) > Math.PI + 0.1) invalid = true;
    if (sample.pitch != null && Math.abs(sample.pitch) > Math.PI / 2 + 0.1) invalid = true;
    if (sample.ax != null && Math.abs(sample.ax) > 100) invalid = true; // >10g extremo
    if (invalid) {
      this._invalidCount30s++;
      this._invalidSampleTs.push(now);
    }
    // Limpia contador (>30 s)
    while (this._invalidSampleTs.length > 0 && now - this._invalidSampleTs[0] > 30_000) {
      this._invalidSampleTs.shift();
      this._invalidCount30s = Math.max(0, this._invalidCount30s - 1);
    }
    // Tasa rolling
    this._recentTs.push(now);
    while (this._recentTs.length > 0 && now - this._recentTs[0] > 30_000) {
      this._recentTs.shift();
    }
    const rate = this._recentTs.length / 30;
    this.quality = {
      sampleRateHz: Math.round(rate * 10) / 10,
      ageMs,
      invalidCount: this._invalidCount30s,
      coherent: !invalid && this._hasAnyData(sample),
    };
  }

  private _hasAnyData(s: ImuSample): boolean {
    return s.headingMagnetic != null || s.headingTrue != null ||
      s.roll != null || s.pitch != null ||
      s.ax != null || s.ay != null || s.az != null ||
      s.gx != null || s.gy != null || s.gz != null;
  }
}
