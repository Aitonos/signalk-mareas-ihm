/**
 * Rev149 — Open-Meteo global tide source.
 *
 * Open-Meteo Marine API expone `sea_level_height_msl` — altura del mar
 * (en metros, referenciado a MSL) cada hora. Es un modelo hidrodinámico
 * global (FES2014 / Copernicus CMEMS) que cubre cualquier coordenada del
 * mundo. Precisión: muy buena en océano abierto; algo peor en estuarios,
 * bahías cerradas o costas con harmónicos locales fuertes. Para España
 * (IHM) seguimos prefiriendo los datos oficiales; para el resto del mundo
 * Open-Meteo es la mejor opción "gratis sin API key".
 *
 * Endpoint:
 *   https://marine-api.open-meteo.com/v1/marine
 *     ?latitude=...&longitude=...
 *     &hourly=sea_level_height_msl
 *     &forecast_days=7
 *
 * Output: extremos (high/low) extraídos como máximos/mínimos locales
 * de la curva horaria. Devolvemos TideForecastResult compatible con el
 * resto del plugin (mismos campos que IHM).
 *
 * Caché: 12 h por (lat, lon). Las predicciones cambian poco a horas
 * vista — refresh diario es más que suficiente.
 *
 * Uso:
 *   - Estación sintética `openmeteo-global` en el dropdown.
 *   - Caller pasa { latitude, longitude } y recibe TideForecastResult.
 */

import FileCache from "../cache.js";
import type { TideForecastResult, TideExtreme } from "../types.js";

interface SignalKApp { debug?: (msg: string) => void; }

const ENDPOINT = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST_DAYS = 7;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 h
const FETCH_TIMEOUT_MS = 10_000;

interface CachedTides {
  lat: number;
  lon: number;
  fetchedAt: string;
  extremes: TideExtreme[];
}

/** Cache key con cuadrícula a 0.1° (≈11 km) — más fino sería desperdicio.
 *  v2 (Rev150): bumped el prefijo después de rebase MSL→cero-del-puerto. La
 *  cache v1 contenía valores negativos referenciados a MSL, había que
 *  invalidarla al introducir el offset. */
function cacheKey(lat: number, lon: number): string {
  const rl = Math.round(lat * 10) / 10;
  const rg = Math.round(lon * 10) / 10;
  return `openmeteo-tides-v2:${rl.toFixed(1)}:${rg.toFixed(1)}`;
}

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  if (isNaN(t)) return true;
  return Date.now() - t > CACHE_TTL_MS;
}

async function fetchWithTimeout(app: SignalKApp, url: string, ms: number): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    app.debug?.(`[OM-TIDES] fetch ${url}`);
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo Marine HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Extrae máximos/mínimos locales de un array `heights` horario.
 * Un punto `i` es high si height[i-1] < height[i] >= height[i+1].
 * Un punto `i` es low si height[i-1] > height[i] <= height[i+1].
 * Ignora los extremos del array (no se puede comparar con ambos vecinos).
 */
function extractExtremes(times: string[], heights: number[]): TideExtreme[] {
  const out: TideExtreme[] = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1];
    const cur = heights[i];
    const next = heights[i + 1];
    if (!isFinite(prev) || !isFinite(cur) || !isFinite(next)) continue;
    if (prev < cur && cur >= next) {
      out.push({ time: times[i], value: cur, type: "High" });
    } else if (prev > cur && cur <= next) {
      out.push({ time: times[i], value: cur, type: "Low" });
    }
  }
  return out;
}

/**
 * Llama a Open-Meteo Marine y devuelve un TideForecastResult con extremos.
 * Cache 12 h por celda 0.1° × 0.1°. En caso de fallo (red / timeout),
 * devuelve cache stale si existe, o lanza.
 */
export async function openmeteoTideForecast(
  app: SignalKApp,
  cache: FileCache,
  lat: number,
  lon: number,
): Promise<TideForecastResult> {
  const key = cacheKey(lat, lon);
  const cached = (await cache.get(key)) as CachedTides | undefined;
  if (cached && !isStale(cached.fetchedAt) && Array.isArray(cached.extremes)) {
    return buildResult(lat, lon, cached.extremes);
  }
  // timezone=auto → los tiempos se devuelven en la TZ local de la coordenada,
  // coherente con el comportamiento de IHM (cada estación = su TZ).
  const url = `${ENDPOINT}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=sea_level_height_msl&forecast_days=${FORECAST_DAYS}&timezone=auto`;
  try {
    const body = await fetchWithTimeout(app, url, FETCH_TIMEOUT_MS);
    const times: string[] = body?.hourly?.time ?? [];
    const heights: number[] = body?.hourly?.sea_level_height_msl ?? [];
    if (!Array.isArray(times) || !Array.isArray(heights) || times.length !== heights.length) {
      throw new Error("Open-Meteo Marine: respuesta sin sea_level_height_msl");
    }
    // Open-Meteo entrega tiempos como `YYYY-MM-DDTHH:mm` sin offset.
    // Con timezone=auto representan hora local de la coordenada — añadimos
    // el offset explícito para que `new Date(t)` se parsee bien en cualquier TZ.
    const utcOffsetSec: number = typeof body?.utc_offset_seconds === "number" ? body.utc_offset_seconds : 0;
    const offsetStr = formatOffset(utcOffsetSec);
    const timesWithTz = times.map((t) => `${t}:00${offsetStr}`);
    // Rev150: rebase a "cero del puerto" estilo IHM.
    // Open-Meteo `sea_level_height_msl` está referenciado a MSL, así que en
    // bajamar da valores negativos (p.ej. -1.36 m) — chocante para usuarios
    // acostumbrados a IHM que muestra alturas siempre positivas sobre el
    // nivel de referencia. Buscamos la bajamar mínima del horizonte 7 días
    // y la usamos como nuevo cero — equivalente a LAT (Lowest Astronomical
    // Tide) aproximado al pronóstico semanal. El RANGO entre pleamar y
    // bajamar se preserva, que es lo que importa para el cálculo de cadena.
    const finiteHeights = heights.filter((h) => Number.isFinite(h));
    const minH = finiteHeights.length > 0 ? Math.min(...finiteHeights) : 0;
    // Margen 5 cm bajo la mínima — evita que la propia bajamar quede en 0,00 m
    // (resulta menos confuso ver "0,05 m" que "0,00 m" en la bajamar de la semana).
    const offsetToZero = -minH + 0.05;
    const heightsRebased = heights.map((h) => Number.isFinite(h) ? h + offsetToZero : h);
    const extremes = extractExtremes(timesWithTz, heightsRebased);
    // Filtramos extremos no fiables (curva muy plana → variación <2 cm
    // entre vecinos). Mar abierto sin marea apenas modela bien.
    const filtered = filterTinyExtremes(extremes, 0.02);
    await cache.set(key, {
      lat,
      lon,
      fetchedAt: new Date().toISOString(),
      extremes: filtered,
    } satisfies CachedTides);
    return buildResult(lat, lon, filtered);
  } catch (err: any) {
    // Si tenemos caché stale, mejor eso que nada.
    if (cached && Array.isArray(cached.extremes)) {
      app.debug?.(`[OM-TIDES] fetch failed (${err?.message ?? err}); serving stale cache`);
      return buildResult(lat, lon, cached.extremes);
    }
    throw err;
  }
}

function buildResult(lat: number, lon: number, extremes: TideExtreme[]): TideForecastResult {
  return {
    station: {
      id: "openmeteo-global",
      name: "Open-Meteo Global Tides",
      position: { latitude: lat, longitude: lon },
    },
    coef: undefined,
    extremes,
  };
}

function formatOffset(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds === 0) return "Z";
  const sign = seconds >= 0 ? "+" : "-";
  const abs = Math.abs(seconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function filterTinyExtremes(extremes: TideExtreme[], minRangeM: number): TideExtreme[] {
  if (extremes.length < 2) return extremes;
  const out: TideExtreme[] = [];
  for (let i = 0; i < extremes.length; i++) {
    if (i === 0 || i === extremes.length - 1) { out.push(extremes[i]); continue; }
    const prev = extremes[i - 1];
    const cur = extremes[i];
    const next = extremes[i + 1];
    const dPrev = Math.abs(cur.value - prev.value);
    const dNext = Math.abs(cur.value - next.value);
    if (dPrev < minRangeM && dNext < minRangeM) continue;
    out.push(cur);
  }
  return out;
}
