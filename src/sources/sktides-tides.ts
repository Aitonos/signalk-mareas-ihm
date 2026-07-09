/**
 * Rev674 — signalk-tides plugin bridge (openwatersio/signalk-tides).
 *
 * Desde su versión 2.0, el plugin oficial `signalk-tides` embebe NEAPS y
 * expone `GET /signalk/v2/api/resources/tides` con las predicciones para la
 * posición actual del barco:
 *
 *   {
 *     datum: "MLLW",
 *     units: "meters",
 *     station: { id, name, latitude, longitude },
 *     extremes: [
 *       { time: "…Z", level: 0.02, high: false, low: true, label: "Low" },
 *       …
 *     ]
 *   }
 *
 * Si el usuario ya tiene ese plugin instalado y publicando, preferimos
 * consumirlo — así la BD armónica y el motor se mantienen desde un único
 * sitio (su plugin) y ahorramos duplicidad. Si NO está, caemos al NEAPS
 * embebido directamente. Ver [[project_sprint_j_wizard_installer]].
 *
 * Detección + fetch:
 *  - `probeSignalkTides(baseUrl)`: HEAD/GET al endpoint; devuelve true si
 *    responde 200 con `{ station, extremes }` bien formado.
 *  - `sktidesTideForecast(...)`: GET al endpoint y mapeo a TideForecastResult.
 *
 * Cache: 12 h por celda 0.1° (mismo esquema que Open-Meteo y NEAPS
 * embebido). El plugin oficial recalcula localmente cada minuto, así que
 * un TTL corto no aporta y hace más ruido de red.
 */

import FileCache from "../cache.js";
import type { TideForecastResult, TideExtreme } from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; error?: (msg: string) => void; }

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const FETCH_TIMEOUT_MS = 6_000;
const DEFAULT_BASE = "http://localhost:3000";
export const SKTIDES_TIDES_ENDPOINT = "/signalk/v2/api/resources/tides";

interface CachedSktides {
  lat: number;
  lon: number;
  fetchedAt: string;
  stationId: string;
  stationName: string;
  stationLat: number;
  stationLon: number;
  extremes: TideExtreme[];
}

function baseUrl(): string {
  return (process.env.SK_TIDES_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function cacheKey(lat: number, lon: number): string {
  const rl = Math.round(lat * 10) / 10;
  const rg = Math.round(lon * 10) / 10;
  return `sktides-v1:${rl.toFixed(1)}:${rg.toFixed(1)}`;
}

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  if (isNaN(t)) return true;
  return Date.now() - t > CACHE_TTL_MS;
}

async function fetchTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Rev674: comprueba si el plugin oficial `signalk-tides` está publicando
 * predicciones útiles. Resultado se cachea en memoria durante 5 min para
 * no golpear el endpoint cada minuto.
 */
let _lastProbeMs = 0;
let _lastProbeResult: boolean | null = null;
const PROBE_TTL_MS = 5 * 60 * 1000;

/**
 * Rev675: distinguir el payload del plugin oficial `signalk-tides` del que
 * genera nuestro propio resource provider `tides`. Nosotros publicamos
 * `station.position: {latitude, longitude}` y no incluimos `datum` ni
 * `units`. El oficial publica `station.latitude/longitude` directamente y
 * SIEMPRE incluye `datum` y `units`. Además su id empieza por `noaa/` o
 * `ticon/`. Antes el probe se autodetectaba a sí mismo (false positive).
 */
function looksLikeOfficialSktidesPayload(j: any): boolean {
  if (!j || typeof j !== "object") return false;
  if (!Array.isArray(j.extremes) || j.extremes.length < 2) return false;
  if (!j.station || typeof j.station !== "object") return false;
  // Discriminante 1: la estación del oficial tiene lat/lon planos, no anidados.
  const hasFlatLatLon = typeof j.station.latitude === "number" && typeof j.station.longitude === "number";
  const hasNestedPosition = j.station.position && typeof j.station.position === "object";
  if (!hasFlatLatLon || hasNestedPosition) return false;
  // Discriminante 2: `datum` y `units` son campos que sólo emite el oficial.
  if (typeof j.datum !== "string" || typeof j.units !== "string") return false;
  // Discriminante 3: el id emitido por el oficial trae prefijo de fuente NEAPS.
  const stationId = String(j.station.id ?? "");
  if (!/^(noaa|ticon|tcon)\//i.test(stationId)) return false;
  // Discriminante 4: la forma de los extremes del oficial trae `high` y `low`
  // como booleanos, y `time` como string ISO (nuestros llevan `time` y `type`).
  const first = j.extremes[0];
  if (!first || typeof first.time !== "string") return false;
  if (typeof first.high !== "boolean" && typeof first.low !== "boolean") return false;
  return true;
}

export async function probeSignalkTides(app: SignalKApp): Promise<boolean> {
  if (_lastProbeResult !== null && Date.now() - _lastProbeMs < PROBE_TTL_MS) {
    return _lastProbeResult;
  }
  const url = baseUrl() + SKTIDES_TIDES_ENDPOINT;
  try {
    const r = await fetchTimeout(url, FETCH_TIMEOUT_MS);
    if (!r.ok) {
      _lastProbeResult = false;
    } else {
      const j: any = await r.json().catch(() => null);
      _lastProbeResult = looksLikeOfficialSktidesPayload(j);
      if (j && !_lastProbeResult) {
        app.debug?.(`[SKTIDES] endpoint responde 200 pero payload no es del plugin oficial (probablemente nuestro propio resource provider). Marcamos NO disponible.`);
      }
    }
  } catch (e: any) {
    app.debug?.(`[SKTIDES] probe fallo: ${e?.message ?? e}`);
    _lastProbeResult = false;
  }
  _lastProbeMs = Date.now();
  return _lastProbeResult;
}

/** Invalida la caché del probe (útil tras instalar/desinstalar el plugin). */
export function resetSignalkTidesProbe(): void {
  _lastProbeResult = null;
  _lastProbeMs = 0;
}

/**
 * Fetch al endpoint /resources/tides del plugin oficial y mapeo al formato
 * interno TideForecastResult del plugin. Devuelve null si no está disponible.
 */
export async function sktidesTideForecast(
  app: SignalKApp,
  cache: FileCache,
  lat: number,
  lon: number,
): Promise<TideForecastResult | null> {
  const key = cacheKey(lat, lon);
  const cached = (await cache.get(key)) as CachedSktides | undefined;
  if (cached && !isStale(cached.fetchedAt) && Array.isArray(cached.extremes)) {
    return buildResult(cached);
  }
  const url = baseUrl() + SKTIDES_TIDES_ENDPOINT;
  try {
    const r = await fetchTimeout(url, FETCH_TIMEOUT_MS);
    if (!r.ok) {
      app.debug?.(`[SKTIDES] HTTP ${r.status} en ${url}`);
      return cached ? buildResult(cached) : null;
    }
    const j: any = await r.json();
    // Rev675: defensa cinturón-tirantes. Si el endpoint estuviera sirviendo
    // nuestro propio provider por accidente, no queremos consumirlo como si
    // fuera el oficial (loop de datos + formato incompatible con nuestro
    // rebase).
    if (!looksLikeOfficialSktidesPayload(j)) {
      app.debug?.("[SKTIDES] fetch OK pero payload no es del oficial; skip");
      return cached ? buildResult(cached) : null;
    }
    // Rebase a "cero del puerto" (mismo tratamiento que NEAPS/Open-Meteo).
    // El endpoint del plugin oficial devuelve niveles referenciados al datum
    // (MLLW/LAT), que ya suele ser ~0 en bajamar. Aún así aplicamos un ligero
    // offset para no mostrar valores negativos por convención.
    const finiteLevels = (j.extremes as any[])
      .map(e => Number(e.level))
      .filter(v => Number.isFinite(v)) as number[];
    const minLevel = finiteLevels.length > 0 ? Math.min(...finiteLevels) : 0;
    const offsetToZero = minLevel < 0 ? (-minLevel + 0.05) : 0;
    const extremes: TideExtreme[] = (j.extremes as any[])
      .filter(e => e && e.time && typeof e.level === "number")
      .map(e => ({
        time: String(e.time),
        value: Math.round((Number(e.level) + offsetToZero) * 100) / 100,
        type: (e.high ? "High" : "Low") as "High" | "Low",
      }));
    if (extremes.length < 2) {
      return cached ? buildResult(cached) : null;
    }
    const payload: CachedSktides = {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      stationId: String(j.station.id ?? ""),
      stationName: String(j.station.name ?? j.station.id ?? "signalk-tides"),
      stationLat: Number(j.station.latitude ?? lat),
      stationLon: Number(j.station.longitude ?? lon),
      extremes,
    };
    await cache.set(key, payload);
    app.debug?.(`[SKTIDES] ${extremes.length} extremos de estación ${payload.stationId} (${payload.stationName})`);
    return buildResult(payload);
  } catch (err: any) {
    app.debug?.(`[SKTIDES] fetch fallo: ${err?.message ?? err}`);
    return cached ? buildResult(cached) : null;
  }
}

function buildResult(c: CachedSktides): TideForecastResult {
  return {
    station: {
      id: `sktides/${c.stationId}`,
      name: c.stationName,
      position: { latitude: c.stationLat, longitude: c.stationLon },
    },
    coef: undefined,
    extremes: c.extremes,
  };
}
