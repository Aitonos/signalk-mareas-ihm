// Open-Meteo weather source — Deploy 4a (Rev58, 2026-05-10).
// Free public API, no key required. Two endpoints:
//   - api.open-meteo.com/v1/forecast        — wind, gust, pressure, temperature
//   - marine-api.open-meteo.com/v1/marine   — wave height + swell components
//
// Designed to feed:
//   1. SK deltas (wind / pressure / waves) — KIP, OpenPlotter, etc.
//   2. KIP weather advisory notification with thresholds
//   3. Future coast/shelter scoring (Capitulo 3) — needs 24h direction + speed
//      arrays already in the WeatherForecast object
//
// Cache strategy: 30 min TTL keyed by GPS rounded to 0.05° (~5 km). Stale-
// while-revalidate: if a fresh fetch fails, serve the previous cache no matter
// how old (boat may be offline for hours and we still want to show *something*).
//
// Attribution (CC-BY 4.0): always returned in the result object so the visor
// can render it in the footer.
import FileCache from "../cache.js";
import type { SignalKApp } from "../types.js";

export interface WeatherForecastHour {
  time: string;             // ISO UTC, hour-aligned
  windSpeedKt: number;      // sustained wind at 10m
  windDirDeg: number;       // 0-359, "wind FROM" direction (meteorological convention)
  windGustKt: number;
  pressureHpa: number;      // mean sea-level pressure
  tempC: number;            // air temperature at 2m
  waveHeightM: number;      // significant wave height (Hs) — combined wind+swell
  wavePeriodSec: number;    // peak period of the combined wave field
  waveDirDeg: number;       // peak direction of combined waves, "FROM" convention
  seaTempC: number;         // sea surface temperature (Rev80)
  swellHeightM: number;
  swellDirDeg: number;      // "swell FROM" direction
  swellPeriodSec: number;
}

export interface WeatherForecast {
  position: { lat: number; lng: number };  // rounded to grid
  fetchedAt: string;                        // ISO UTC of the successful fetch
  current: WeatherForecastHour;             // = next24h[0]
  next24h: WeatherForecastHour[];
  attribution: string;
  // Aggregated peaks for the next 6h / 12h (avoids client recomputing them)
  peak6h: { windKt: number; gustKt: number; waveM: number; gustHourIdx: number; gustDirDeg: number };
  peak12h: { windKt: number; gustKt: number; waveM: number };
  // Pressure trend over the next 3h (negative = falling = approaching low)
  pressureTrend3hHpa: number;
  // Rev67: last 24h of pressure (hPa = mBar), one entry per hour, oldest first.
  // Used by the visor to render a sparkline of the trailing barometric trend.
  past24hPressureHpa: number[];
  // Rev319: next 12h of pressure forecast (hPa = mBar), one entry per hour,
  // chronological. Used by the visor to draw the FORECAST continuation of the
  // pressure curve in the bottom bar (dashed cyan line right of "NOW").
  future12hPressureHpa: number[];
}

const CACHE_TTL_MS = 30 * 60 * 1000;      // 30 min
const CACHE_STALE_MAX_MS = 24 * 60 * 60 * 1000;  // 24 h — beyond this we don't even serve stale
const FETCH_TIMEOUT_MS = 10_000;

function roundCoord(c: number): number {
  // 0.05° grid (~5 km at mid-latitudes)
  return Math.round(c * 20) / 20;
}

function cacheKey(lat: number, lng: number): string {
  /* Rev81: bump suffix to invalidate caches that pre-date sea_surface_temperature. */
  return `weather_v2_${roundCoord(lat).toFixed(2)}_${roundCoord(lng).toFixed(2)}`;
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Find the index in the hourly array whose timestamp matches "now" (hour-aligned).
function findNowIndex(times: string[] | undefined): number {
  if (!Array.isArray(times) || times.length === 0) return 0;
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const targetPrefix = now.toISOString().slice(0, 13); // "2026-05-10T14"
  const idx = times.findIndex((t) => typeof t === "string" && t.startsWith(targetPrefix));
  return idx >= 0 ? idx : 0;
}

function num(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function buildHour(
  fc: any, marine: any, idx: number,
): WeatherForecastHour {
  return {
    time:           String(fc.hourly?.time?.[idx] ?? ""),
    windSpeedKt:    num(fc.hourly?.wind_speed_10m?.[idx]),
    windDirDeg:     num(fc.hourly?.wind_direction_10m?.[idx]),
    windGustKt:     num(fc.hourly?.wind_gusts_10m?.[idx]),
    pressureHpa:    num(fc.hourly?.pressure_msl?.[idx]),
    tempC:          num(fc.hourly?.temperature_2m?.[idx]),
    waveHeightM:    num(marine?.hourly?.wave_height?.[idx]),
    wavePeriodSec:  num(marine?.hourly?.wave_period?.[idx]),
    waveDirDeg:     num(marine?.hourly?.wave_direction?.[idx]),
    seaTempC:       num(marine?.hourly?.sea_surface_temperature?.[idx]),
    swellHeightM:   num(marine?.hourly?.swell_wave_height?.[idx]),
    swellDirDeg:    num(marine?.hourly?.swell_wave_direction?.[idx]),
    swellPeriodSec: num(marine?.hourly?.swell_wave_period?.[idx]),
  };
}

function peakOver(
  hours: WeatherForecastHour[], windowH: number,
): { windKt: number; gustKt: number; waveM: number; gustHourIdx: number; gustDirDeg: number } {
  let windKt = 0, gustKt = 0, waveM = 0;
  let gustHourIdx = 0, gustDirDeg = 0;
  for (let i = 0; i < Math.min(windowH, hours.length); i++) {
    const h = hours[i];
    if (h.windSpeedKt > windKt) windKt = h.windSpeedKt;
    if (h.windGustKt  > gustKt) { gustKt = h.windGustKt; gustHourIdx = i; gustDirDeg = h.windDirDeg; }
    if (h.waveHeightM > waveM)  waveM  = h.waveHeightM;
  }
  return { windKt, gustKt, waveM, gustHourIdx, gustDirDeg };
}

export async function fetchWeather(
  lat: number,
  lng: number,
  cache: FileCache,
  app?: SignalKApp,
): Promise<WeatherForecast | null> {
  const rLat = roundCoord(lat);
  const rLng = roundCoord(lng);
  const key = cacheKey(rLat, rLng);

  // Check cache freshness — if young enough, return it directly.
  const cached = (await cache.get(key)) as WeatherForecast | undefined;
  if (cached?.fetchedAt) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < CACHE_TTL_MS) return cached;
  }

  // Otherwise fetch. If fetch fails, fall back to stale cache (within 24h).
  // Rev71: lock to ECMWF IFS (Centro Europeo de Previsiones, 0.25° = 25km
   // resolution). Using a single named model — rather than the default
   // `best_match` blend — means the wx-bar agrees hour-by-hour with the
   // ECMWF column in the detailed forecast popup, so the skipper can
   // cross-check without seeing unexplained discrepancies.
  const fcParams = [
    `latitude=${rLat}`,
    `longitude=${rLng}`,
    "hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,temperature_2m",
    "wind_speed_unit=kn",
    "past_days=1",
    "forecast_days=2",
    "timezone=UTC",
    "models=ecmwf_ifs025",
  ].join("&");
  const marineParams = [
    `latitude=${rLat}`,
    `longitude=${rLng}`,
    // Rev73: include peak period + direction of the combined wave field too
    // (not just swell). The anchorage feels the combined sea state, and long-
    // period swell can wrap around obstacles even when wind is sheltered.
    // Rev80: include sea_surface_temperature for the shelter info box.
    "hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature",
    "past_days=1",
    "forecast_days=2",
    "timezone=UTC",
  ].join("&");

  const fcUrl = `https://api.open-meteo.com/v1/forecast?${fcParams}`;
  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?${marineParams}`;

  let fc: any;
  let marine: any = null;
  try {
    fc = await fetchJson(fcUrl);
  } catch (e: any) {
    if (cached?.fetchedAt) {
      const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
      if (ageMs < CACHE_STALE_MAX_MS) {
        app?.debug?.(`[IHM-WX] forecast fetch failed (${e?.message}); serving stale cache (${(ageMs / 60000) | 0} min old)`);
        return cached;
      }
    }
    app?.debug?.(`[IHM-WX] forecast fetch failed and no usable cache: ${e?.message}`);
    return null;
  }

  // Marine is best-effort: inland positions may not have data, network
  // can fail independently. Wave fields just degrade to 0 if missing.
  try {
    marine = await fetchJson(marineUrl);
  } catch (e: any) {
    app?.debug?.(`[IHM-WX] marine fetch failed (non-fatal): ${e?.message}`);
  }

  const idx = findNowIndex(fc.hourly?.time);
  const next24h: WeatherForecastHour[] = [];
  for (let h = 0; h < 24; h++) {
    next24h.push(buildHour(fc, marine, idx + h));
  }
  const current = next24h[0];

  // Rev67: last 24h of pressure for the sparkline (idx-24 .. idx-1, oldest first)
  const past24hPressureHpa: number[] = [];
  for (let h = 24; h >= 1; h--) {
    const i = idx - h;
    past24hPressureHpa.push(i >= 0 ? num(fc.hourly?.pressure_msl?.[i]) : current.pressureHpa);
  }
  // Rev319: next 12h pressure forecast (idx+1 .. idx+12), chronological.
  const future12hPressureHpa: number[] = [];
  for (let h = 1; h <= 12; h++) {
    future12hPressureHpa.push(num(fc.hourly?.pressure_msl?.[idx + h]));
  }

  const result: WeatherForecast = {
    position: { lat: rLat, lng: rLng },
    fetchedAt: new Date().toISOString(),
    current,
    next24h,
    attribution: "Weather © Open-Meteo (CC-BY 4.0)",
    peak6h:  peakOver(next24h, 6),
    peak12h: peakOver(next24h, 12),
    pressureTrend3hHpa: next24h.length > 3 ? +(next24h[3].pressureHpa - current.pressureHpa).toFixed(1) : 0,
    past24hPressureHpa,
    future12hPressureHpa,
  };

  try {
    await cache.set(key, result);
  } catch (e: any) {
    app?.debug?.(`[IHM-WX] cache write failed: ${e?.message}`);
  }
  return result;
}

// Threshold-based advisory generator. Returns a localized string when any
// threshold is exceeded in the next 6h, or null if conditions are calm.
export interface AdvisoryThresholds {
  windWarnKt: number;        // sustained wind warning in next 6h
  gustWarnKt: number;        // gust warning in next 6h
  waveWarnM: number;         // wave height warning in next 6h
  pressureDropWarnHpa3h: number; // |drop| triggering low-pressure warning
}

export const DEFAULT_ADVISORY_THRESHOLDS: AdvisoryThresholds = {
  windWarnKt: 20,
  gustWarnKt: 25,
  waveWarnM:  1.5,
  pressureDropWarnHpa3h: 3,
};

// Convert a "wind FROM" direction in degrees to a 16-point compass label.
const COMPASS_16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function compass16(deg: number): string {
  const idx = Math.round(((deg % 360) / 22.5)) & 0xf;
  return COMPASS_16[idx];
}

export interface WeatherAdvisory {
  level: "ok" | "warn";
  message: string;            // human-readable, in user's lang
  flags: {                    // which thresholds tripped (for analytics)
    wind: boolean;
    gust: boolean;
    wave: boolean;
    pressureDrop: boolean;
  };
}

export function buildAdvisory(
  fc: WeatherForecast,
  thresholds: AdvisoryThresholds,
  lang: "es" | "en" = "es",
): WeatherAdvisory {
  const peak = fc.peak6h;
  const drop3h = fc.pressureTrend3hHpa;  // negative = falling

  const flags = {
    wind:         peak.windKt > thresholds.windWarnKt,
    gust:         peak.gustKt > thresholds.gustWarnKt,
    wave:         peak.waveM  > thresholds.waveWarnM,
    pressureDrop: drop3h <= -thresholds.pressureDropWarnHpa3h,
  };
  const tripped = Object.values(flags).some(Boolean);
  if (!tripped) {
    return {
      level: "ok",
      message: lang === "en"
        ? `Calm: wind ${fc.current.windSpeedKt.toFixed(0)}kt ${compass16(fc.current.windDirDeg)}`
        : `Calma: viento ${fc.current.windSpeedKt.toFixed(0)}kt ${compass16(fc.current.windDirDeg)}`,
      flags,
    };
  }

  // Rev68: short coherent message. Includes the peak time as a clock hour
  // ("18h") rather than a relative offset ("in 4h"), so the user can compare
  // it directly with the detailed forecast popup (which shows clock times).
  // Only the worst single factor is shown to keep the bar one short line.
  const peakDirCompass = compass16(peak.gustDirDeg);
  // Absolute local hour-of-day of the peak gust
  let peakClock = "";
  try {
    const peakTime = fc.next24h[peak.gustHourIdx]?.time;
    if (peakTime) {
      // peakTime is UTC ISO. Convert to local hour for display.
      const peakDate = new Date(peakTime);
      peakClock = String(peakDate.getHours()).padStart(2, "0") + "h";
    }
  } catch { /* fallback below */ }
  if (!peakClock) peakClock = (lang === "en" ? "in " : "en ") + peak.gustHourIdx + "h";

  // Pick the SINGLE worst factor to fit in the compact bar.
  let part: string;
  if (flags.gust) {
    part = lang === "en"
      ? `gusts ${peak.gustKt.toFixed(0)}kt ${peakDirCompass} @ ${peakClock}`
      : `rachas ${peak.gustKt.toFixed(0)}kt ${peakDirCompass} @ ${peakClock}`;
  } else if (flags.wind) {
    part = lang === "en"
      ? `wind ${peak.windKt.toFixed(0)}kt ${peakDirCompass} @ ${peakClock}`
      : `viento ${peak.windKt.toFixed(0)}kt ${peakDirCompass} @ ${peakClock}`;
  } else if (flags.wave) {
    part = lang === "en"
      ? `waves ${peak.waveM.toFixed(1)}m`
      : `olas ${peak.waveM.toFixed(1)}m`;
  } else {
    part = lang === "en"
      ? `pressure ${drop3h.toFixed(1)}hPa/3h`
      : `presion ${drop3h.toFixed(1)}hPa/3h`;
  }

  return {
    level: "warn",
    message: part,
    flags,
  };
}

// === Capitulo 4B (Rev60): Coast/shelter scoring (MVP — manual mask) ===
//
// The user marks which 16-sector compass directions are SHELTERED for the
// current anchorage (land, breakwater, headland upwind). The scoring then
// counts forecast hours where wind comes from an EXPOSED direction and
// weights them by wind speed.
//
// Sectors are 22.5° wide, centred on the cardinal points:
//   0=N (centre 0°)  1=NNE  2=NE  3=ENE  4=E  5=ESE  6=SE  7=SSE
//   8=S              9=SSW  10=SW 11=WSW 12=W 13=WNW 14=NW 15=NNW

export type ShelterMask = boolean[]; // length 16; true=sheltered, false=exposed
export const SHELTER_SECTOR_LABELS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"] as const;
export const SHELTER_SECTOR_COUNT = 16;

export function emptyShelterMask(): ShelterMask {
  return new Array(SHELTER_SECTOR_COUNT).fill(false);
}

export function dirDegToSectorIdx(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  return Math.round(norm / 22.5) % SHELTER_SECTOR_COUNT;
}

export type ShelterGrade = "A" | "B" | "C" | "D" | "F";

export interface ShelterHour {
  time: string;
  dirDeg: number;
  speedKt: number;
  gustKt: number;
  sectorIdx: number;
  sheltered: boolean;       // wind FROM is in a sheltered sector
  exposureKt: number;       // 0 if sheltered, else max(speed, gust)
  /* Rev74: wave-aware exposure. A long-period swell from an exposed sector
     reaches the anchorage even if wind is sheltered, so it spoils the rest.
     `waveSheltered` mirrors `sheltered` but for wave direction; the overall
     hour is sheltered ONLY if both are true. */
  waveHeightM?: number;
  wavePeriodSec?: number;
  waveDirDeg?: number;
  waveSectorIdx?: number;
  waveSheltered?: boolean;
  /* Rev80: surface info for the shelter info box (pressure + temps). */
  pressureHpa?: number;
  tempC?: number;
  seaTempC?: number;
}

export interface ShelterAssessment {
  grade: ShelterGrade;
  worstExposureKt: number;
  avgExposureKt: number;
  exposedHourCount: number;     // hours with non-zero exposure in next 12h
  hours: ShelterHour[];         // 12 entries (one per forecast hour)
  mask: ShelterMask;
  configured: boolean;          // false if mask is all-false (user hasn't set up)
  evaluatedAt: string;
  message: string;
  // Rev71/76: percentage protection score, 0-100. Derived from the worst
  // exposed wind in the 12 h window so the donut and the A-F grade always
  // move together visually (see formula in assessShelter).
  scorePercent: number;
}

function gradeFromExposure(worstKt: number): ShelterGrade {
  // Thresholds chosen against typical anchoring tolerance for a 12m cruising
  // sailboat with proper scope. F triggers at sustained-gale exposure.
  if (worstKt < 5)  return "A";
  if (worstKt < 12) return "B";
  if (worstKt < 18) return "C";
  if (worstKt < 25) return "D";
  return "F";
}

// Rev74: thresholds for wave exposure being "real" enough to spoil shelter.
// Below these, a wave from an exposed sector is small/short and won't reach
// the anchorage (short chop dies on the breakwater; <0.3 m is negligible).
const WAVE_EXPOSURE_MIN_HEIGHT_M = 0.3;
const WAVE_EXPOSURE_MIN_PERIOD_S = 6;

export function assessShelter(
  fc: WeatherForecast,
  mask: ShelterMask,
  lang: "es" | "en" = "es",
): ShelterAssessment {
  // Rev139: filtrar horas YA PASADAS del cache de forecast. fc.next24h se
  // calculó con findNowIndex en el momento del FETCH (cacheado ~30 min).
  // En el momento del serve, la primera entrada puede ser de una hora pasada.
  // Saltarlas hace que el strip siempre empiece en la hora actual o futura.
  const nowMs = Date.now();
  const futureHours = fc.next24h.filter((h) => {
    const tStr = (h.time && !h.time.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(h.time)) ? h.time + "Z" : h.time;
    const tMs = Date.parse(tStr || "");
    if (isNaN(tMs)) return true; // si no se parsea, no filtrar
    return tMs + 3_600_000 > nowMs; // mantener si el fin de la hora aún está en futuro
  });
  const horizon = Math.min(12, futureHours.length);
  const safeMask = Array.isArray(mask) && mask.length === SHELTER_SECTOR_COUNT
    ? mask : emptyShelterMask();
  const hours: ShelterHour[] = [];
  let worst = 0;
  let sum = 0;
  let exposedHours = 0;
  for (let i = 0; i < horizon; i++) {
    const h = futureHours[i];
    const sectorIdx = dirDegToSectorIdx(h.windDirDeg);
    const windSheltered = !!safeMask[sectorIdx];
    // Rev74: wave-aware shelter. A long-period (>6s) wave from an exposed
    // sector with non-trivial height (>0.3m) still reaches the anchorage
    // even if wind is sheltered — swell wraps around obstacles. So the
    // overall "sheltered" flag is windSheltered AND waveSheltered.
    let waveSectorIdx: number | undefined;
    let waveSheltered = true;
    if (typeof h.waveDirDeg === "number" &&
        typeof h.waveHeightM === "number" &&
        h.waveHeightM >= WAVE_EXPOSURE_MIN_HEIGHT_M &&
        (h.wavePeriodSec ?? 0) >= WAVE_EXPOSURE_MIN_PERIOD_S) {
      waveSectorIdx = dirDegToSectorIdx(h.waveDirDeg);
      waveSheltered = !!safeMask[waveSectorIdx];
    }
    const sheltered = windSheltered && waveSheltered;
    // Rev75: shelter grade is computed against SUSTAINED wind only. Gusts
    // are temporary peaks that the anchor's swing radius and chain catenary
    // absorb. What really determines if an anchorage is safe is the
    // sustained wind force. (Gusts are still shown to the user in cell
    // tooltips for awareness, but they don't drive the grade.)
    const intensity = h.windSpeedKt;
    const exposureKt = sheltered ? 0 : intensity;
    if (exposureKt > worst) worst = exposureKt;
    sum += exposureKt;
    if (exposureKt > 0) exposedHours++;
    hours.push({
      time: h.time,
      dirDeg: h.windDirDeg,
      speedKt: h.windSpeedKt,
      gustKt: h.windGustKt,
      sectorIdx,
      sheltered,
      exposureKt,
      waveHeightM: h.waveHeightM,
      wavePeriodSec: h.wavePeriodSec,
      waveDirDeg: h.waveDirDeg,
      waveSectorIdx,
      waveSheltered,
      pressureHpa: h.pressureHpa,
      tempC: h.tempC,
      seaTempC: h.seaTempC,
    });
  }
  const avg = horizon > 0 ? sum / horizon : 0;
  const configured = safeMask.some(Boolean);
  // If user hasn't configured the mask yet we still grade (everything exposed)
  // but flag `configured: false` so the UI can prompt them.
  const grade = gradeFromExposure(worst);

  // Rev84: redacción más natural — incluye en una sola frase el número
  // de horas expuestas y los picos. La UI ya no añade "Nh expuestas en 12h"
  // por separado (el resumen completo viene aquí).
  const wkt = worst.toFixed(0);
  const hExpo = exposedHours;
  const hTotal = horizon;
  let message: string;
  if (!configured) {
    message = lang === "en"
      ? "Shelter not configured — tap to set sheltered sectors"
      : "Abrigo no configurado — pulsa para marcar sectores abrigados";
  } else if (grade === "A") {
    // Rev95: redacción natural — distingue 0 h, 1 h y N>1 h, evita "picos 0 kt".
    if (hExpo === 0) {
      message = lang === "en"
        ? `Sheltered: none of the next ${hTotal} h are exposed.`
        : `Abrigado: ninguna de las próximas ${hTotal} h queda expuesta.`;
    } else if (hExpo === 1) {
      message = lang === "en"
        ? `Sheltered: only 1 h slightly exposed (peaks ${wkt} kt).`
        : `Abrigado: solo 1 h ligeramente expuesta (picos ${wkt} kt).`;
    } else {
      message = lang === "en"
        ? `Sheltered: only ${hExpo} h slightly exposed (peaks ${wkt} kt).`
        : `Abrigado: solo ${hExpo} h ligeramente expuestas (picos ${wkt} kt).`;
    }
  } else if (grade === "B" || grade === "C") {
    if (hExpo === 0) {
      message = lang === "en"
        ? `Acceptable shelter for the next ${hTotal} h.`
        : `Abrigo aceptable en las próximas ${hTotal} h.`;
    } else if (hExpo === 1) {
      message = lang === "en"
        ? `Acceptable shelter: 1 h with open sector, peaks up to ${wkt} kt.`
        : `Abrigo aceptable: 1 h con sector abierto, picos hasta ${wkt} kt.`;
    } else {
      message = lang === "en"
        ? `Acceptable shelter: ${hExpo} h with open sector, peaks up to ${wkt} kt.`
        : `Abrigo aceptable: ${hExpo} h con sector abierto, picos hasta ${wkt} kt.`;
    }
  } else if (grade === "D") {
    if (hExpo === 1) {
      message = lang === "en"
        ? `Caution: 1 h exposed, peak up to ${wkt} kt — consider relocating.`
        : `Precaución: 1 h expuesta, pico hasta ${wkt} kt — valora cambiar de sitio.`;
    } else {
      message = lang === "en"
        ? `Caution: ${hExpo} h exposed, peaks up to ${wkt} kt — consider relocating.`
        : `Precaución: ${hExpo} h expuestas, picos hasta ${wkt} kt — valora cambiar de sitio.`;
    }
  } else {
    if (hExpo === 1) {
      message = lang === "en"
        ? `EXPOSED: 1 h with peak up to ${wkt} kt — seek shelter.`
        : `EXPUESTO: 1 h con pico hasta ${wkt} kt — busca abrigo.`;
    } else {
      message = lang === "en"
        ? `EXPOSED: ${hExpo} h with peaks up to ${wkt} kt — seek shelter.`
        : `EXPUESTO: ${hExpo} h con picos hasta ${wkt} kt — busca abrigo.`;
    }
  }

  // Rev76: protection percentage now correlates with grade so the donut and
  // the letter don't disagree visually. Previous formula (% of sheltered
  // hours weighted by intensity) gave 0% when ALL wind came from exposed
  // sectors — even with light wind that's not actually risky (grade B).
  // New formula: % = how far we are from "F gale" (≥25 kt sustained exposed):
  //    worst 0 kt   → 100 %
  //    worst 5 kt   → ~83 %  (grade A boundary)
  //    worst 12 kt  → ~60 %  (B boundary)
  //    worst 18 kt  → ~40 %  (C boundary)
  //    worst 25 kt  → ~17 %  (D/F boundary)
  //    worst 30+ kt → 0 %
  // Each grade band gets a visually distinct % range, matching the donut
  // colour bands in the visor.
  const F_THRESHOLD_KT = 30;
  const scorePercent = configured
    ? Math.max(0, Math.min(100, Math.round(100 * (1 - worst / F_THRESHOLD_KT))))
    : 0;

  return {
    grade,
    worstExposureKt: +worst.toFixed(1),
    avgExposureKt: +avg.toFixed(1),
    exposedHourCount: exposedHours,
    hours,
    mask: [...safeMask],
    configured,
    evaluatedAt: new Date().toISOString(),
    message,
    scorePercent,
  };
}
