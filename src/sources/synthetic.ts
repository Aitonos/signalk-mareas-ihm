/**
 * Rev149 — Synthetic tide sources for areas not covered by IHM España.
 *
 * Dos pseudo-estaciones expuestas como opciones en el dropdown del visor:
 *
 *   1. `sin-marea`     — "Sin marea / Offshore"
 *      Δ = 0. Todos los extremos vienen con altura constante 0 m. Útil para
 *      lagos, ríos, dársenas cerradas, o cualquier sitio donde la marea
 *      astronómica es despreciable. El cálculo de fondeo asume rango cero.
 *
 *   2. `mediterraneo`  — "Mediterráneo (Δ ≈ 0.2 m)"
 *      Modelo sinusoidal con periodicidad M2 (semidiurna lunar, 12h 25m).
 *      Amplitud 0.20 m sobre el cero hidrográfico (rango pico-pico 0.40 m
 *      como peor caso). Fase fija — NO pretende ser una predicción precisa
 *      al cm, pero da un rango operativo para que la alarma de varada y el
 *      cálculo de radio de borneo funcionen sin requerir IHM.
 *      Aviso: en el Mediterráneo dominan presión barométrica y viento;
 *      esto cubre solo la componente astronómica.
 *
 * Diseño consciente — NO se ofrece "delta manual": un usuario que mete
 * "0.4 m" un día porque vio esa marea ese día, no lo vuelve a editar al
 * día siguiente cuando la marea es distinta → cálculos de fondeo erróneos
 * y peligrosos. Sinusoidal fijo es siempre consistente.
 */

import type {
  TideForecastResult,
  TideExtreme,
  TideSource,
  TideForecastParams,
} from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; }

export interface SyntheticStation {
  id: string;
  name: string;
  /** Amplitud (m) sobre el cero hidrográfico. 0 = sin marea. */
  amplitudeM: number;
  /** "Sentinel" — true para que el visor identifique fuente sintética. */
  synthetic: true;
}

export const SYNTHETIC_STATIONS: SyntheticStation[] = [
  {
    id: "sin-marea",
    name: "Sin marea / Offshore (Δ 0 m)",
    amplitudeM: 0,
    synthetic: true,
  },
  {
    id: "mediterraneo",
    name: "Mediterráneo (Δ ≈ 0.2 m sinusoidal)",
    // Rev150: amplitudeM = 0.10 → rango pleamar–bajamar = 0.20 m (lo que
    // dice el label). Antes era 0.20 → rango 0.40 m, no cuadraba con "Δ 0.2".
    amplitudeM: 0.10,
    synthetic: true,
  },
];

const M2_PERIOD_MS = (12 * 60 + 25.235) * 60 * 1000; // 12h 25m 14s

/**
 * Genera extremos sintéticos M2 cubriendo `daysAhead` desde `begin`.
 * El extremo[0] empieza en alta (High) → bajo (Low) alternando cada
 * `M2_PERIOD_MS / 2`. Como no hay referencia de fase real para una posición
 * concreta del Mediterráneo, la fase es arbitraria pero estable
 * (anclada a un epoch fijo Y2K) — así un usuario que mira hoy y mañana ve
 * progresión coherente del ciclo.
 */
function generateM2Extremes(
  amplitudeM: number,
  beginMs: number,
  daysAhead: number = 7,
): TideExtreme[] {
  const Y2K = Date.UTC(2000, 0, 1, 0, 0, 0); // ancla de fase
  const halfPeriod = M2_PERIOD_MS / 2;
  // Calcula el primer extremo >= beginMs.
  const fromAnchor = beginMs - Y2K;
  const nHalfPeriods = Math.floor(fromAnchor / halfPeriod);
  const firstExtremeMs = Y2K + nHalfPeriods * halfPeriod;
  const endMs = beginMs + daysAhead * 24 * 3600 * 1000;
  const out: TideExtreme[] = [];
  for (let t = firstExtremeMs, i = nHalfPeriods; t <= endMs; t += halfPeriod, i++) {
    const isHigh = (i % 2 === 0);
    out.push({
      time: new Date(t).toISOString(),
      value: isHigh ? amplitudeM : -amplitudeM,
      type: isHigh ? "High" : "Low",
    });
  }
  return out;
}

/**
 * Devuelve un TideForecastResult sintético para la estación dada.
 * `position` se usa solo para informar la `station.position` — el modelo
 * no varía por geografía.
 */
export function syntheticForecast(
  station: SyntheticStation,
  position: TideForecastParams["position"] | undefined,
  beginMs: number = Date.now(),
): TideForecastResult {
  const extremes = generateM2Extremes(station.amplitudeM, beginMs);
  return {
    station: {
      id: station.id,
      name: station.name,
      position: {
        latitude: position?.latitude ?? 0,
        longitude: position?.longitude ?? 0,
      },
    },
    coef: undefined,
    extremes,
  };
}

/** True si el id corresponde a una pseudo-estación sintética. */
export function isSyntheticStationId(id: string | undefined | null): boolean {
  if (!id) return false;
  return SYNTHETIC_STATIONS.some((s) => s.id === id);
}

export function getSyntheticStation(id: string): SyntheticStation | undefined {
  return SYNTHETIC_STATIONS.find((s) => s.id === id);
}

/**
 * Source factory — el plugin lo registra en `createSources(app)`. La fuente
 * sintética NUNCA es la fuente principal (IHM lo es); estos están disponibles
 * en el dropdown como opciones cuando IHM no cubre o no hay internet.
 */
export default function (_app: SignalKApp): TideSource {
  return {
    id: "synthetic",
    title: "Sintético (offshore / Mediterráneo)",
    start: async () => {
      return async (params: TideForecastParams): Promise<TideForecastResult> => {
        // El caller indica la estación deseada vía params.position o un id
        // explícito (que viene del frontend "manualStationId"). En este
        // diseño el provider decide qué estación devolver — pero como la
        // lógica está acoplada en index.ts/ihm.ts, esta source se llama
        // SOLO cuando se sabe que la estación es sintética. Por simplicidad
        // devuelve "sin-marea" por defecto.
        return syntheticForecast(SYNTHETIC_STATIONS[0], params.position);
      };
    },
  };
}
