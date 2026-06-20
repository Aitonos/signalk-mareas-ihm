/**
 * Rev147 — RawI2cImuSource (stub, opt-in DIY).
 *
 * Lectura I2C directa de IMU compatibles: ICM-20948 (recomendado por pypilot
 * upstream), MPU-9250, MPU-9255 (legacy).
 *
 * Estado: STUB. La detección lista direcciones conocidas y verifica que el
 * bus esté presente, pero la lectura real de registros + descodificación
 * requiere dependencia `i2c-bus` (Linux only) que no añadimos por defecto.
 *
 * Razón del stub:
 *   - pypilot ya hace I2C IMU correctamente: calibración "boat is flat",
 *     filtrado Madgwick, compensación. Reinventarlo aquí es trabajo enorme
 *     y propenso a errores de fase/calibración.
 *   - El 99% de usuarios OpenPlotter tiene pypilot — esta fuente sólo es
 *     útil para DIY puro sin pypilot, escenario marginal.
 *   - Si el usuario lo necesita, activa `imu.rawI2c.enabled = true` en el
 *     schema y le proporcionamos un diagnóstico claro de qué hay en el bus.
 *
 * Si se completa en el futuro, debe:
 *   - npm install i2c-bus
 *   - Identificar chip por WHO_AM_I register
 *   - Pedir calibración explícita (UI "boat is flat" propia)
 *   - Aplicar fusión Madgwick o Mahony
 *   - Marcar `provides.headingMagnetic = true` solo tras calibración
 *
 * Hasta entonces, esta fuente se mantiene como `status: "disabled"` por
 * defecto y emite diagnóstico cuando el usuario la activa explícitamente.
 */

import type { ImuSource, ImuSample, ImuProvides, ImuQuality, ImuSourceStatus } from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; }

const KNOWN_IMU_ADDRESSES = [
  { addr: 0x68, model: "MPU-9250 / MPU-9255 / ICM-20948 (alt)" },
  { addr: 0x69, model: "MPU-9250 / MPU-9255 / ICM-20948 (alt)" },
  { addr: 0x28, model: "BNO055 (alt)" },
  { addr: 0x29, model: "BNO055" },
];

export class RawI2cImuSource implements ImuSource {
  readonly id = "raw-i2c";
  readonly type = "raw-i2c" as const;
  /** Por debajo de todas las demás — opt-in DIY de última instancia. */
  readonly priority = 10;
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

  bus: string;
  address?: number;
  model = "raw-i2c-unverified";

  private app: SignalKApp;
  private enabled: boolean;
  private allowedModels: string[];

  constructor(opts: {
    app: SignalKApp;
    bus?: string;
    enabled: boolean;
    allowedModels?: string[];
  }) {
    this.app = opts.app;
    this.bus = opts.bus ?? "/dev/i2c-1";
    this.enabled = opts.enabled;
    this.allowedModels = opts.allowedModels ?? ["ICM-20948", "MPU-9250", "MPU-9255"];
  }

  /**
   * Diagnostic scan — no abre el bus realmente (necesitaría i2c-bus). Solo
   * detecta presencia del device file y emite info de configuración.
   */
  async probe(): Promise<{ busPresent: boolean; busPath: string; note: string }> {
    let busPresent = false;
    try {
      const fs = await import("fs");
      busPresent = fs.existsSync(this.bus);
    } catch { /* fs unavailable */ }
    return {
      busPresent,
      busPath: this.bus,
      note: busPresent
        ? "I2C bus device exists. Raw read requires `i2c-bus` npm package (not bundled) — implement chip-specific driver."
        : `I2C bus device ${this.bus} not found. Check sudo raspi-config → Interface Options → I2C.`,
    };
  }

  start(): void {
    if (!this.enabled) {
      this.status = "disabled";
      this.lastError = null;
      this.app.debug?.("IMU: raw I2C disabled by default");
      return;
    }
    // Stub: marcamos como error porque no podemos abrir el bus sin la dep.
    this.status = "error";
    this.lastError = "raw I2C reader not implemented — pypilot/SignalK source recommended";
    this.app.debug?.("[IMU-RAWI2C] enabled but driver not implemented; pypilot is the supported path");
  }

  stop(): void {
    this.status = "disabled";
  }

  poll(): ImuSample | null {
    // Stub: nunca devuelve datos hasta que se implemente el driver real.
    return null;
  }

  /** Lista de direcciones conocidas filtrada por `allowedModels`. */
  candidateAddresses(): { addr: number; model: string }[] {
    return KNOWN_IMU_ADDRESSES.filter((a) =>
      this.allowedModels.some((m) => a.model.toLowerCase().includes(m.toLowerCase().split("-")[0]))
    );
  }
}
