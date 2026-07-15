/**
 * Rev673 — NEAPS harmonic-constants tide provider.
 *
 * NEAPS (openwatersio/neaps, MIT) es un motor de predicción de mareas por
 * constantes armónicas escrito en TypeScript. Consume `@neaps/tide-database`
 * (~7600 estaciones: NOAA ~3400 US + TICON-4 ~4200 globales) y calcula
 * extremos con precisión sub-minuto en tiempo y milimétrica en altura,
 * validada contra NOAA en CI del propio proyecto.
 *
 * Uso en este plugin: fallback entre IHM (España oficial) y Open-Meteo. Se
 * activa cuando el barco está a menos de MAX_NEAPS_DISTANCE_KM de una
 * estación NEAPS y IHM no encontró estación cercana suficiente (fuera de
 * España). Para el usuario también es elegible manualmente como
 * "neaps-global" en el dropdown.
 *
 * Coordenadas → estación más cercana → getExtremesPrediction(start, end)
 *   → mapeo al formato interno `TideForecastResult` del plugin.
 *
 * Cache: 12 h por celda 0.1° (misma cadencia que Open-Meteo). Sirve stale
 * si la ejecución falla (raro — todo el cálculo es local, sin red).
 */

import FileCache from "../cache.js";
import type { TideForecastResult, TideExtreme } from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; error?: (msg: string) => void; }

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const FORECAST_DAYS = 7;

// Rev715 (feedback Carlos "arregla el tema offset de marea NEAPS versus
// IHM"): el offset previo (-minLevel + 0.05 sobre una ventana de 7 días)
// hace que la bajamar mínima *de la semana* quede a 5 cm — pero durante
// mareas muertas esa bajamar semanal está muy por encima del LAT real
// (Lowest Astronomical Tide). Resultado: NEAPS pinta ~30-60 cm por
// debajo de IHM. Fix: calcular el offset con una ventana amplia (365 d)
// para capturar la bajamar astronómica real, cachearlo por estación
// (~30 d), y ya no añadir "+0.05" — 0 = LAT real, coherente con el cero
// del puerto de IHM.
const LAT_WINDOW_DAYS = 365;
const LAT_OFFSET_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LAT_START_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

// Máxima distancia (km) entre el barco y la estación NEAPS más cercana
// para considerarla utilizable. Más allá el modelo pierde precisión
// (constantes de una zona no aplican a otra).
export const MAX_NEAPS_DISTANCE_KM = 80;

interface CachedNeaps {
  lat: number;
  lon: number;
  fetchedAt: string;
  stationId: string;
  stationName: string;
  stationLat: number;
  stationLon: number;
  distanceKm: number;
  extremes: TideExtreme[];
}

function cacheKey(lat: number, lon: number): string {
  const rl = Math.round(lat * 10) / 10;
  const rg = Math.round(lon * 10) / 10;
  // Rev715: bump a v2 para invalidar cache antiguo (offset LAT roto).
  return `neaps-tides-v2:${rl.toFixed(1)}:${rg.toFixed(1)}`;
}

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  if (isNaN(t)) return true;
  return Date.now() - t > CACHE_TTL_MS;
}

/**
 * Rev715: calcula (y cachea 30 días) el offset LAT (Lowest Astronomical
 * Tide) de una estación NEAPS a partir de una ventana de 365 días. Este
 * offset se suma a `level` para que el mínimo astronómico caiga en 0.00 m,
 * coherente con el cero hidrográfico del puerto que publica IHM.
 *
 * Robustecido: si el cálculo de 365 d falla, cae a la ventana pequeña
 * ya calculada (5 cm sobre bajamar de la ventana) — never worse.
 */
async function computeStationLatOffset(
  app: SignalKApp,
  cache: FileCache,
  station: any,
): Promise<number> {
  const stationId = String(station?.id ?? "");
  if (!stationId) return 0;
  const safeSuffix = stationId.replace(/[^a-z0-9_.-]/gi, "_");
  const key = `neaps-lat-offset-v1_${safeSuffix}`;
  const cached = (await cache.get(key)) as { offset: number; fetchedAt: string } | undefined;
  if (cached && typeof cached.offset === "number" && cached.fetchedAt) {
    const age = Date.now() - Date.parse(cached.fetchedAt);
    if (Number.isFinite(age) && age < LAT_OFFSET_TTL_MS) {
      return cached.offset;
    }
  }
  const start = new Date(Date.now() - LAT_START_LOOKBACK_MS);
  const end = new Date(start.getTime() + LAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    const pred: any = station.getExtremesPrediction({ start, end, units: "meters" });
    const raw: any[] = Array.isArray(pred?.extremes) ? pred.extremes : [];
    const lows: number[] = raw
      .map(e => Number(e?.level))
      .filter(v => Number.isFinite(v));
    if (lows.length < 4) return 0;
    const minLevel = Math.min(...lows);
    const offset = -minLevel;
    await cache.set(key, { offset, fetchedAt: new Date().toISOString() });
    app.debug?.(`[NEAPS] LAT offset estación ${stationId} = ${offset.toFixed(3)} m (min 365d = ${minLevel.toFixed(3)})`);
    return offset;
  } catch (e: any) {
    app.debug?.(`[NEAPS] LAT offset falló para ${stationId}: ${e?.message ?? e}`);
    return 0;
  }
}

/**
 * Predice extremos NEAPS para (lat, lon). Devuelve `null` si no hay
 * estación cercana (distancia > MAX_NEAPS_DISTANCE_KM). Lanza si la
 * librería falla por otro motivo — el caller decide fallback.
 */
export async function neapsTideForecast(
  app: SignalKApp,
  cache: FileCache,
  lat: number,
  lon: number,
): Promise<TideForecastResult | null> {
  const key = cacheKey(lat, lon);
  const cached = (await cache.get(key)) as CachedNeaps | undefined;
  if (cached && !isStale(cached.fetchedAt) && Array.isArray(cached.extremes)) {
    return buildResult(cached);
  }
  // Import dinámico — evita cargar la BD entera (~3-4 MB de estaciones) en
  // el arranque si NEAPS no se usa. Sólo se paga la lectura la primera vez.
  let neapsMod: typeof import("neaps");
  try {
    neapsMod = await import("neaps");
  } catch (e: any) {
    app.error?.(`[NEAPS] módulo no disponible: ${e?.message ?? e}`);
    return null;
  }
  const start = new Date();
  const end = new Date(start.getTime() + FORECAST_DAYS * 24 * 60 * 60 * 1000);
  try {
    const station = neapsMod.nearestStation({ latitude: lat, longitude: lon });
    if (!station) {
      app.debug?.(`[NEAPS] nearestStation devolvió null para (${lat}, ${lon})`);
      return null;
    }
    const distanceKm = typeof (station as any).distance === "number"
      ? (station as any).distance / 1000
      : Infinity;
    if (distanceKm > MAX_NEAPS_DISTANCE_KM) {
      app.debug?.(`[NEAPS] estación ${station.id} a ${distanceKm.toFixed(1)} km — > umbral ${MAX_NEAPS_DISTANCE_KM} km, skip`);
      return null;
    }
    const prediction = station.getExtremesPrediction({
      start,
      end,
      units: "meters",
    });
    // Rebase a "cero del puerto" ≈ LAT (Lowest Astronomical Tide). Rev715:
    // el offset se calcula sobre 365 d (no sobre los 7 d del forecast) para
    // capturar la bajamar astronómica REAL y coincidir con el cero del
    // puerto de IHM. Cacheado por estación.
    const offsetToZero = await computeStationLatOffset(app, cache, station);
    const rawExtremes = Array.isArray(prediction.extremes) ? prediction.extremes : [];
    const extremes: TideExtreme[] = rawExtremes
      .filter(e => e && e.time instanceof Date && Number.isFinite(e.level))
      .map(e => ({
        time: e.time.toISOString(),
        value: Math.round((e.level + offsetToZero) * 100) / 100,
        type: e.high ? "High" as const : "Low" as const,
      }));
    if (extremes.length < 2) {
      app.debug?.(`[NEAPS] estación ${station.id} sin extremos utilizables`);
      return null;
    }
    const payload: CachedNeaps = {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      stationId: String(station.id ?? ""),
      stationName: String((station as any).name ?? station.id),
      stationLat: Number((station as any).latitude ?? 0),
      stationLon: Number((station as any).longitude ?? 0),
      distanceKm,
      extremes,
    };
    await cache.set(key, payload);
    app.debug?.(`[NEAPS] ${extremes.length} extremos calculados en estación ${payload.stationId} (${payload.stationName}) a ${distanceKm.toFixed(1)} km`);
    return buildResult(payload);
  } catch (err: any) {
    // Cache stale > nada. NEAPS es determinista offline: un fallo suele
    // indicar corrupción de datos, no fallo transitorio; aún así preferimos
    // servir stale antes que romper el widget.
    if (cached && Array.isArray(cached.extremes)) {
      app.debug?.(`[NEAPS] cálculo falló (${err?.message ?? err}); sirvo cache stale`);
      return buildResult(cached);
    }
    throw err;
  }
}

function buildResult(c: CachedNeaps): TideForecastResult {
  return {
    station: {
      id: `neaps/${c.stationId}`,
      name: c.stationName,
      position: { latitude: c.stationLat, longitude: c.stationLon },
    },
    coef: undefined,
    extremes: c.extremes,
  };
}

/**
 * Rev686 (feedback Carlos "buscador de ciudades y que el resultado dé el
 * valor más cercano en NEAPS"): predice extremos NEAPS para una estación
 * concreta (por id NEAPS o id de fuente NOAA/TICON). El caller busca la
 * estación con `/api/tide/stations-search?engine=neaps&q=<ciudad>` y
 * después pide extremes para el ID elegido. No depende del GPS.
 */
export async function neapsTideForecastByStationId(
  app: SignalKApp,
  cache: FileCache,
  stationId: string, // p.ej. "noaa/8443970" (sin prefijo neaps/) o "ticon/xxx"
): Promise<TideForecastResult | null> {
  const cleanId = String(stationId).replace(/^neaps\//, "");
  app.debug?.(`[NEAPS-byId] START stationId="${stationId}" cleanId="${cleanId}"`);
  // Rev696 (log Carlos "ENOENT ... open '.../neaps-tides-byid-v1:ticon/...'"):
  // FileCache usa la key como nombre de fichero. Si contiene "/" (como
  // "ticon/willamette_..."), el FS intenta escribir en un subdirectorio que
  // no existe → ENOENT → devuelve null → fallback nearest → Vigo.
  // Sanitizamos: reemplazamos cualquier carácter no seguro por "_".
  const safeSuffix = cleanId.replace(/[^a-z0-9_.-]/gi, "_");
  // Rev715: bump a v2 para invalidar cache antiguo (offset LAT roto).
  const key = `neaps-tides-byid-v2_${safeSuffix}`;
  const cached = (await cache.get(key)) as CachedNeaps | undefined;
  if (cached && !isStale(cached.fetchedAt) && Array.isArray(cached.extremes)) {
    app.debug?.(`[NEAPS-byId] cache hit — ${cached.stationName} (${cached.extremes.length} extremes)`);
    return buildResult(cached);
  }
  let neapsMod: typeof import("neaps");
  try {
    neapsMod = await import("neaps");
  } catch (e: any) {
    app.error?.(`[NEAPS-byId] módulo no disponible: ${e?.message ?? e}`);
    return null;
  }
  const start = new Date();
  const end = new Date(start.getTime() + FORECAST_DAYS * 24 * 60 * 60 * 1000);
  try {
    const station: any = (neapsMod as any).findStation(cleanId);
    if (!station) {
      app.debug?.(`[NEAPS-byId] findStation('${cleanId}') → null`);
      return null;
    }
    app.debug?.(`[NEAPS-byId] station encontrada: ${station.name} @ ${station.latitude},${station.longitude}`);
    let prediction: any;
    try {
      prediction = station.getExtremesPrediction({ start, end, units: "meters" });
    } catch (e: any) {
      app.error?.(`[NEAPS-byId] getExtremesPrediction lanzó: ${e?.message ?? e}`);
      return null;
    }
    const rawExtremes = Array.isArray(prediction?.extremes) ? prediction.extremes : [];
    app.debug?.(`[NEAPS-byId] rawExtremes.length=${rawExtremes.length}`);
    // Rev715: rebase LAT sobre 365 d (ver computeStationLatOffset).
    const offsetToZero = await computeStationLatOffset(app, cache, station);
    const extremes: TideExtreme[] = rawExtremes
      .filter((e: any) => e && e.time instanceof Date && Number.isFinite(e.level))
      .map((e: any) => ({
        time: e.time.toISOString(),
        value: Math.round((e.level + offsetToZero) * 100) / 100,
        type: e.high ? "High" as const : "Low" as const,
      }));
    if (extremes.length < 2) {
      app.debug?.(`[NEAPS-byId] extremes.length < 2 tras filtrar — devuelvo null`);
      return null;
    }
    const payload: CachedNeaps = {
      lat: station.latitude, lon: station.longitude,
      fetchedAt: new Date().toISOString(),
      stationId: String(station.id ?? cleanId),
      stationName: String(station.name ?? cleanId),
      stationLat: Number(station.latitude ?? 0),
      stationLon: Number(station.longitude ?? 0),
      distanceKm: 0,
      extremes,
    };
    await cache.set(key, payload);
    app.debug?.(`[NEAPS-byId] OK — ${payload.stationName}, ${extremes.length} extremes válidos`);
    return buildResult(payload);
  } catch (err: any) {
    app.error?.(`[NEAPS-byId] excepción byId(${cleanId}): ${err?.message ?? err}\n${err?.stack ?? ''}`);
    return null;
  }
}
