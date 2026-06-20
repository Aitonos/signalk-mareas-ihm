/**
 * Rev147 — IMU/attitude source abstraction.
 *
 * Diseño: el plugin lee datos de actitud, heading y aceleración desde fuentes
 * heterogéneas (Signal K core, pypilot local, pypilot remoto, IMU I2C nativo,
 * MacArthur HAT vía pypilot). Esta capa abstrae la fuente para que el resto
 * del código (Fase 1 wave detection, Fase 2 wave height) consuma datos
 * uniformes sin saber de dónde vienen.
 *
 * Principios:
 *   - No bloquear arranque si no hay IMU disponible.
 *   - Errores son estados (`error`/`stale`/`invalid`), no excepciones fatales.
 *   - El usuario puede fijar manualmente la fuente (`preferredSource`) y la
 *     auto-detección la respeta mientras esté sana.
 *   - Pypilot tiene prioridad sobre raw I2C cuando está disponible — pypilot
 *     ya hace calibración/filtrado/compensación.
 *   - Raw I2C es opt-in (DIY mode), nunca por defecto.
 */

export type ImuSourceType =
  | "signalk"            // Datos ya publicados en SK por otro plugin
  | "pypilot-network"    // pypilot remoto (ej. TinyPilot Pi Zero dedicado)
  | "pypilot-local"      // pypilot en localhost
  | "macarthur-via-pypilot" // MacArthur HAT, datos van por pypilot
  | "raw-i2c"            // Lectura I2C directa (DIY, opt-in)
  | "manual"             // Usuario forzó la fuente manualmente
  | "none";              // Sin fuente disponible

export type ImuSourceStatus =
  | "available"          // Detectada y funcional
  | "active"             // Actualmente seleccionada como fuente activa
  | "stale"              // No recibe updates desde hace > staleAfterSeconds
  | "invalid"            // Datos no coherentes (NaN, fuera de rango, etc.)
  | "error"              // Error de conexión/IO
  | "disabled";          // Deshabilitada por config

export interface ImuProvides {
  headingMagnetic: boolean;
  headingTrue: boolean;
  roll: boolean;
  pitch: boolean;
  heel: boolean;
  trim: boolean;
  acceleration: boolean;
  gyro: boolean;
  calibrationState: boolean;
}

/**
 * Sample uniforme que entregan todas las fuentes a ImuManager. Cualquier
 * campo puede ser null si la fuente no lo provee. Unidades:
 *   - heading: radianes (convención SK)
 *   - roll/pitch/heel/trim: radianes
 *   - acceleration: m/s²
 *   - gyro: rad/s
 */
export interface ImuSample {
  ts: number; // ms epoch
  headingMagnetic?: number | null;
  headingTrue?: number | null;
  roll?: number | null;
  pitch?: number | null;
  heel?: number | null;
  trim?: number | null;
  ax?: number | null;
  ay?: number | null;
  az?: number | null;
  gx?: number | null;
  gy?: number | null;
  gz?: number | null;
  calibrationState?: number | null; // 0..3 típicamente (BNO055-style)
}

export interface ImuQuality {
  /** Tasa estimada de updates por segundo (rolling 30 s). */
  sampleRateHz: number;
  /** ms desde la última muestra fresca. */
  ageMs: number;
  /** Valores fuera de rango físico detectados en últimos 30 s. */
  invalidCount: number;
  /** True si todos los campos `provides:true` siguen llegando coherentes. */
  coherent: boolean;
}

/**
 * Contrato común para cualquier fuente IMU.
 *
 * Lifecycle:
 *   - constructor()
 *   - start(): conecta/se suscribe. No throw — errores en status.
 *   - poll(): lee última muestra disponible. Llamada periódicamente por el
 *     Manager. Devuelve null si no hay sample fresco.
 *   - stop(): cierra conexión, libera recursos.
 *
 * Las fuentes NO deben hacer publish a SK ellas mismas — eso lo decide el
 * Manager basándose en la fuente activa, para evitar duplicados.
 */
export interface ImuSource {
  id: string;
  type: ImuSourceType;
  /** Numérico — más alto = preferente cuando varias están sanas. */
  priority: number;
  status: ImuSourceStatus;
  lastSeen: number; // ms epoch
  lastError: string | null;
  provides: ImuProvides;
  quality: ImuQuality;

  /** Config snapshot — opcional, para debug. */
  host?: string;
  port?: number;
  bus?: string;
  address?: number;
  model?: string;

  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  /** Devuelve la muestra más reciente, o null si la fuente está stale/error. */
  poll(): ImuSample | null;
}

/** Configuración expuesta al schema del plugin. */
export interface ImuConfig {
  autoDetect: boolean;
  preferredSource: ImuSourceType | "auto";
  pypilot: {
    host: string;        // hostname/IP del pypilot remoto principal
    port: number;        // típicamente 23322
    remoteHosts: string[]; // candidatos adicionales para auto-detect
  };
  rawI2c: {
    enabled: boolean;    // DIY opt-in
    bus: string;         // ej. "/dev/i2c-1"
    allowedModels: string[]; // ["ICM-20948", "MPU-9250", "MPU-9255"]
  };
  staleAfterSeconds: number;
  /** "ok" o "any" — si "ok", solo fuentes con quality.coherent=true cuentan. */
  minQuality: "ok" | "any";
}

export const DEFAULT_IMU_CONFIG: ImuConfig = {
  autoDetect: true,
  preferredSource: "auto",
  pypilot: {
    host: "",
    port: 23322,
    remoteHosts: [],
  },
  rawI2c: {
    enabled: false,
    bus: "/dev/i2c-1",
    allowedModels: ["ICM-20948", "MPU-9250", "MPU-9255"],
  },
  staleAfterSeconds: 10,
  minQuality: "any",
};

/** Logs estándar que cada fuente / manager debe emitir cuando aplique. */
export const IMU_LOG_MESSAGES = {
  usingSignalK: "IMU: using Signal K attitude source",
  usingPypilotLocal: "IMU: using local pypilot key/value source",
  usingPypilotRemote: "IMU: remote pypilot detected",
  macarthurAssumed: "IMU: MacArthur/Qwiic assumed, waiting for pypilot/OpenPlotter data",
  rawI2cDisabled: "IMU: raw I2C disabled by default",
  sourceStale: "IMU: source stale, switching fallback",
  noSource: "IMU: no valid source available",
} as const;
