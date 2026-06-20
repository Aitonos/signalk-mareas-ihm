/**
 * Rev147 — ImuManager.
 *
 * Orquesta las fuentes IMU según un orden profesional:
 *   A. Signal K existente (paths attitude/heading ya publicados por otro plugin).
 *   B. Pypilot local (localhost:23322).
 *   C. Pypilot remoto (host configurado, o lista candidata).
 *   D. MacArthur HAT — asumido por pypilot, no acceso I2C directo.
 *   E. Raw I2C (último recurso, sólo si `imu.rawI2c.enabled === true`).
 *
 * Reglas:
 *   - `preferredSource` manual fijado por usuario gana mientras esté sano.
 *   - Auto-detect respeta `imu.autoDetect`. Si false, sólo arranca la fuente
 *     fijada (o todas las habilitadas por config y deja al manager elegir).
 *   - Si la fuente activa pasa a stale durante `staleAfterSeconds`, busca
 *     fallback dentro de las disponibles y loguea la transición.
 *   - El manager NO publica datos a SK — los consumers (wave detection, etc.)
 *     reciben muestras vía callback `onSample`.
 *   - El manager NO compite con plugins que ya emiten attitude — la
 *     fuente SignalKAttitudeSource simplemente LEE de SK, no escribe.
 *
 * Robustez:
 *   - Timeouts cortos en probes (3 s).
 *   - Errores de conexión NO lanzan excepciones — se reflejan como `status`.
 *   - El manager corre un tick periódico (100 ms) que poll-ea la fuente activa
 *     y, si está stale, intenta failover.
 */

import { SignalKAttitudeSource } from "./sources/signalk.js";
import { PypilotKeyValueSource } from "./sources/pypilot.js";
import { RawI2cImuSource } from "./sources/rawi2c.js";
import {
  type ImuSource,
  type ImuSample,
  type ImuConfig,
  type ImuSourceType,
  IMU_LOG_MESSAGES,
  DEFAULT_IMU_CONFIG,
} from "./types.js";

interface SignalKApp {
  getSelfPath: (path: string) => any;
  debug?: (msg: string) => void;
}

export interface ImuManagerOptions {
  app: SignalKApp;
  config?: Partial<ImuConfig>;
  /** Tick period en ms para poll de la fuente activa. */
  tickMs?: number;
  /** Callback para entregar muestras al resto del plugin. */
  onSample?: (sample: ImuSample, source: ImuSource) => void;
  /** Llamado cuando la fuente activa cambia. */
  onSourceChange?: (source: ImuSource | null, previous: ImuSource | null) => void;
}

export class ImuManager {
  private app: SignalKApp;
  config: ImuConfig;
  private tickMs: number;
  private onSample?: (sample: ImuSample, source: ImuSource) => void;
  private onSourceChange?: (source: ImuSource | null, previous: ImuSource | null) => void;

  /** Todas las fuentes registradas (algunas pueden estar disabled). */
  sources: ImuSource[] = [];
  /** Fuente activa actualmente entregando muestras al consumer. */
  active: ImuSource | null = null;

  private tickTimer: NodeJS.Timeout | null = null;
  private bootstrapDone = false;
  private lastFailoverLogMs = 0;

  constructor(opts: ImuManagerOptions) {
    this.app = opts.app;
    this.config = { ...DEFAULT_IMU_CONFIG, ...opts.config } as ImuConfig;
    this.tickMs = opts.tickMs ?? 100;
    this.onSample = opts.onSample;
    this.onSourceChange = opts.onSourceChange;
  }

  /**
   * Inicializa: construye las fuentes según config, ejecuta auto-detect si
   * está habilitado, y arranca el tick.
   */
  async start(): Promise<void> {
    if (this.bootstrapDone) return;

    // A. Signal K (siempre disponible — es sólo lectura)
    const skSource = new SignalKAttitudeSource(this.app, {
      staleAfterMs: this.config.staleAfterSeconds * 1000,
    });
    this.sources.push(skSource);

    // B. Pypilot local
    const localPypilot = new PypilotKeyValueSource({
      app: this.app,
      host: "localhost",
      port: this.config.pypilot.port,
      isLocal: true,
      staleAfterMs: this.config.staleAfterSeconds * 1000,
    });
    this.sources.push(localPypilot);

    // C. Pypilot remoto (host configurado + lista candidata)
    const remoteHosts = new Set<string>();
    if (this.config.pypilot.host && this.config.pypilot.host !== "localhost" && this.config.pypilot.host !== "127.0.0.1") {
      remoteHosts.add(this.config.pypilot.host);
    }
    for (const h of this.config.pypilot.remoteHosts || []) {
      if (h && h !== "localhost") remoteHosts.add(h);
    }
    for (const host of remoteHosts) {
      this.sources.push(new PypilotKeyValueSource({
        app: this.app,
        host,
        port: this.config.pypilot.port,
        isLocal: false,
        staleAfterMs: this.config.staleAfterSeconds * 1000,
      }));
    }

    // D. MacArthur HAT — sin acción directa, asumido vía pypilot.
    //    Solo log para que el usuario vea que lo conocemos.
    if (this._looksLikeMacArthur()) {
      this.app.debug?.(IMU_LOG_MESSAGES.macarthurAssumed);
    }

    // E. Raw I2C — siempre instanciado, pero arranca disabled salvo opt-in
    const rawI2c = new RawI2cImuSource({
      app: this.app,
      bus: this.config.rawI2c.bus,
      enabled: this.config.rawI2c.enabled,
      allowedModels: this.config.rawI2c.allowedModels,
    });
    this.sources.push(rawI2c);
    if (!this.config.rawI2c.enabled) {
      this.app.debug?.(IMU_LOG_MESSAGES.rawI2cDisabled);
    }

    // Iniciar la fuente SK siempre (es barata y solo lee).
    skSource.start();

    // Si autoDetect, probar fuentes pypilot en orden de prioridad.
    if (this.config.autoDetect) {
      await this._autoDetect();
    } else {
      // Sin auto-detect: arrancar solo la fuente que coincida con preferredSource.
      this._startPreferredOnly();
    }

    // Tick periódico
    this.tickTimer = setInterval(() => this._tick(), this.tickMs);
    this.bootstrapDone = true;
  }

  async stop(): Promise<void> {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    for (const s of this.sources) {
      try { await s.stop(); } catch { /* defensive */ }
    }
    this.active = null;
    this.bootstrapDone = false;
  }

  /** Estado para el endpoint /api/imu/status. */
  status(): {
    active: { id: string; type: ImuSourceType; ageMs: number } | null;
    available: Array<{
      id: string;
      type: ImuSourceType;
      status: string;
      priority: number;
      ageMs: number;
      sampleRateHz: number;
      provides: ImuSource["provides"];
      host?: string;
      port?: number;
      lastError: string | null;
    }>;
    config: ImuConfig;
  } {
    return {
      active: this.active
        ? { id: this.active.id, type: this.active.type, ageMs: this.active.quality.ageMs }
        : null,
      available: this.sources.map((s) => ({
        id: s.id,
        type: s.type,
        status: s.status,
        priority: s.priority,
        ageMs: s.quality.ageMs,
        sampleRateHz: s.quality.sampleRateHz,
        provides: s.provides,
        host: s.host,
        port: s.port,
        lastError: s.lastError,
      })),
      config: this.config,
    };
  }

  /**
   * Lanza auto-detect manual desde la UI (botón "Buscar IMU"). Re-prueba
   * pypilot local + remoto y re-selecciona la mejor fuente.
   */
  async triggerAutoDetect(): Promise<void> {
    await this._autoDetect();
  }

  // ─────────────────────────── internals ───────────────────────────

  private async _autoDetect(): Promise<void> {
    // A. SK: ya arrancada. Esperamos un tick por si llega data inmediata.
    await this._sleep(200);
    const skSource = this.sources.find((s) => s.type === "signalk");
    if (skSource) {
      skSource.poll(); // refresca estado
      if (skSource.quality.coherent) {
        this.app.debug?.(IMU_LOG_MESSAGES.usingSignalK);
        this._setActive(skSource);
        return;
      }
    }

    // B+C. Probar pypilot local + remotos en paralelo (3 s timeout cada uno)
    const pypilots = this.sources.filter(
      (s): s is PypilotKeyValueSource => s instanceof PypilotKeyValueSource
    );
    const probes = await Promise.all(
      pypilots.map(async (p) => ({ src: p, ok: await p.probe() }))
    );
    // Local gana sobre remoto. Dentro de cada grupo, primer host que responde.
    const localOk = probes.find((p) => p.src.type === "pypilot-local" && p.ok);
    if (localOk) {
      this.app.debug?.(IMU_LOG_MESSAGES.usingPypilotLocal);
      localOk.src.start();
      this._setActive(localOk.src);
      return;
    }
    const remoteOk = probes.find((p) => p.src.type === "pypilot-network" && p.ok);
    if (remoteOk) {
      this.app.debug?.(`${IMU_LOG_MESSAGES.usingPypilotRemote} @ ${remoteOk.src.host}:${remoteOk.src.port}`);
      remoteOk.src.start();
      this._setActive(remoteOk.src);
      return;
    }

    // E. Raw I2C como último recurso (sólo si enabled — y aun así es stub).
    const rawi2c = this.sources.find((s) => s.type === "raw-i2c");
    if (rawi2c && this.config.rawI2c.enabled) {
      rawi2c.start();
      // No lo marcamos como activo — el stub no entrega samples.
    }

    // Nada disponible
    if (!this.active) {
      this.app.debug?.(IMU_LOG_MESSAGES.noSource);
    }
  }

  private _startPreferredOnly(): void {
    const pref = this.config.preferredSource;
    if (pref === "auto" || pref === "none") return;
    const src = this.sources.find((s) => s.type === pref);
    if (!src) return;
    src.start();
    this._setActive(src);
  }

  /** Tick: poll de la fuente activa; si stale, intenta failover. */
  private _tick(): void {
    if (this.active) {
      const sample = this.active.poll();
      if (sample) {
        try { this.onSample?.(sample, this.active); } catch { /* never propagate */ }
      } else {
        // Activa cayó a stale/error: failover
        const now = Date.now();
        if (now - this.lastFailoverLogMs > 5_000) {
          this.app.debug?.(IMU_LOG_MESSAGES.sourceStale);
          this.lastFailoverLogMs = now;
        }
        const fallback = this._chooseBestSource(this.active);
        if (fallback && fallback !== this.active) {
          this._setActive(fallback);
        }
      }
    } else {
      // Sin fuente activa — intentamos elegir una entre las disponibles
      const cand = this._chooseBestSource(null);
      if (cand) this._setActive(cand);
    }
  }

  /** Elige la mejor fuente disponible distinta de `exclude`. */
  private _chooseBestSource(exclude: ImuSource | null): ImuSource | null {
    const candidates = this.sources
      .filter((s) => s !== exclude)
      .filter((s) => s.status === "available" || s.status === "active")
      .filter((s) => {
        if (this.config.minQuality === "ok") return s.quality.coherent;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
    return candidates[0] ?? null;
  }

  private _setActive(src: ImuSource): void {
    const prev = this.active;
    if (prev === src) return;
    if (prev) prev.status = prev.status === "active" ? "available" : prev.status;
    src.status = "active";
    this.active = src;
    try { this.onSourceChange?.(src, prev); } catch { /* ignore */ }
  }

  /**
   * Heurística simple: si /sys/firmware/devicetree/base/model contiene la
   * cadena "MacArthur" (o "OpenPlotter"), consideramos MacArthur HAT
   * probable. Tomar como hint, no como hecho.
   */
  private _looksLikeMacArthur(): boolean {
    try {
      // Sólo en Linux/Pi; cualquier error → asume no.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const candidates = [
        "/sys/firmware/devicetree/base/model",
        "/proc/device-tree/model",
      ];
      for (const p of candidates) {
        try {
          const txt = fs.readFileSync(p, "utf-8");
          if (/macarthur|openplotter/i.test(txt)) return true;
        } catch { /* path missing */ }
      }
    } catch { /* fs missing */ }
    return false;
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
