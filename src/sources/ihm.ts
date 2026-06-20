import path from "path";
import moment from "moment-timezone";
import FileCache from "../cache.js";
import { isCanaryStationId } from "../data/canaryStations.js";
import type {
  SignalKApp,
  TideForecastParams,
  TideForecastResult,
  TideSource,
} from "../types.js";
import {
  MAX_AUTO_DISTANCE_KM,
  DEFAULT_STATION_ID,
  DEFAULT_STATION_NAME,
  DEFAULT_STATION_LAT,
  DEFAULT_STATION_LON,
} from "../types.js";
import {
  SYNTHETIC_STATIONS,
  isSyntheticStationId,
  getSyntheticStation,
  syntheticForecast,
} from "./synthetic.js";
import { openmeteoTideForecast } from "./openmeteo-tides.js";

// Lightweight haversine distance (meters). Avoids external deps (no runtime install surprises).
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type IhmStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  // Optional hint for timezone (e.g. Europe/Madrid, Atlantic/Canary)
  tz?: string;
};

type IhmExtreme = {
  time: string; // ISO UTC
  value: number; // meters
  type: "High" | "Low";
};

type CachedMonth = {
  station: IhmStation;
  year: number;
  month: number; // 1-12
  extremes: IhmExtreme[];
  coef?: number;
  fetchedAt: string; // ISO
};

const DEFAULT_REFRESH_HOURS = 48;
const DEFAULT_GPS_MAX_AGE_MINUTES = 10;

// Rev146 (audit fix): MAX_AUTO_DISTANCE_KM movido a ../types.ts (single source).

// Vigo as absolute last-resort default station.
// Rev142: id corregido de "3214" → "29". Rev146: usa constantes de ../types.
const VIGO_FALLBACK: IhmStation = {
  id: DEFAULT_STATION_ID,
  name: DEFAULT_STATION_NAME,
  lat: DEFAULT_STATION_LAT,
  lon: DEFAULT_STATION_LON,
};

// Hardcoded IHM stations for offline first boot.
// Rev143: lista regenerada desde el endpoint real de IHM
//   curl https://ideihm.covam.es/api-ihm/getmarea?request=getlist&format=json
// Antes los IDs eran 4-dígitos INVENTADOS (3002, 3110, 3214…) y TODOS
// daban ERROR ("El puerto no existe…") al consultarse — eso rompía el
// JSON.parse de fetchJsonWithTimeout cada segundo cuando el plugin caía
// al fallback offline. IDs reales son 1-72 (verificado contra getlist).
// Med + Baleares + Melilla NO existen en IHM y por eso se eliminan del
// seed: ese servicio cubre Cantábrico, Atlántico Sur, Estrecho y Canarias.
// Auto-refreshed from IHM when internet becomes available.
export const HARDCODED_STATIONS: IhmStation[] = [
  { id: "1", name: "Pasajes", lat: 43.3367, lon: -1.9250 },
  { id: "2", name: "Bilbao", lat: 43.3685, lon: -3.0690 },
  { id: "3", name: "Santander", lat: 43.4617, lon: -3.7900 },
  { id: "4", name: "Llanes", lat: 43.4200, lon: -4.7483 },
  { id: "5", name: "Ribadesella", lat: 43.4617, lon: -5.0600 },
  { id: "6", name: "Gijón", lat: 43.5583, lon: -5.6983 },
  { id: "7", name: "Avilés (San Juan de Nieva)", lat: 43.5917, lon: -5.9300 },
  { id: "8", name: "Cudillero", lat: 43.5667, lon: -6.1500 },
  { id: "9", name: "Navia", lat: 43.5417, lon: -6.7250 },
  { id: "10", name: "Tapia", lat: 43.5717, lon: -6.9450 },
  { id: "11", name: "Ribadeo", lat: 43.5333, lon: -7.0367 },
  { id: "12", name: "Foz", lat: 43.5650, lon: -7.2550 },
  { id: "13", name: "Burela", lat: 43.6567, lon: -7.3483 },
  { id: "14", name: "Alúmina Española (San Cibrao)", lat: 43.7083, lon: -7.4617 },
  { id: "15", name: "Cillero (Ría de Viveiro)", lat: 43.6783, lon: -7.5983 },
  { id: "16", name: "Cariño", lat: 43.7367, lon: -7.8650 },
  { id: "17", name: "Cedeira", lat: 43.6567, lon: -8.0717 },
  { id: "18", name: "Ferrol", lat: 43.4767, lon: -8.2483 },
  { id: "19", name: "Sada Fontán (Ría de Betanzos)", lat: 43.3617, lon: -8.2467 },
  { id: "20", name: "A Coruña", lat: 43.3567, lon: -8.3883 },
  { id: "21", name: "Malpica", lat: 43.3233, lon: -8.8083 },
  { id: "22", name: "Camariñas", lat: 43.1267, lon: -9.1817 },
  { id: "23", name: "Fisterra", lat: 42.9083, lon: -9.2583 },
  { id: "24", name: "Portosín (Ría de Muros y Noia)", lat: 42.7633, lon: -8.9483 },
  { id: "25", name: "Santa Uxía de Ribeíra (Ría de Arousa)", lat: 42.5633, lon: -8.9883 },
  { id: "26", name: "Vilagarcía (Ría de Arousa)", lat: 42.6000, lon: -8.7700 },
  { id: "27", name: "Sanxenxo (Ría de Pontevedra)", lat: 42.3967, lon: -8.8050 },
  { id: "28", name: "Marín (Ría de Pontevedra)", lat: 42.4100, lon: -8.6900 },
  { id: "29", name: "Vigo", lat: 42.2400, lon: -8.7300 },
  { id: "30", name: "Baiona", lat: 42.1183, lon: -8.8450 },
  { id: "31", name: "Lisboa", lat: 38.7117, lon: -9.1233 },
  { id: "32", name: "Ayamonte", lat: 37.2117, lon: -7.4050 },
  { id: "33", name: "Marina de Isla Canela", lat: 37.1883, lon: -7.3400 },
  { id: "34", name: "Isla Cristina", lat: 37.2050, lon: -7.3250 },
  { id: "35", name: "Punta Umbría", lat: 37.1800, lon: -6.9567 },
  { id: "36", name: "Mazagón (Huelva)", lat: 37.1317, lon: -6.8333 },
  { id: "37", name: "Bonanza (Sanlúcar de Barrameda)", lat: 36.8017, lon: -6.3383 },
  { id: "38", name: "Sevilla", lat: 37.3317, lon: -5.9950 },
  { id: "39", name: "Chipiona", lat: 36.7467, lon: -6.4283 },
  { id: "40", name: "Rota", lat: 36.6150, lon: -6.3300 },
  { id: "41", name: "El Puerto de Santa María", lat: 36.5983, lon: -6.2217 },
  { id: "42", name: "Cádiz", lat: 36.5400, lon: -6.2867 },
  { id: "43", name: "La Carraca", lat: 36.4967, lon: -6.1833 },
  { id: "44", name: "Gallineras", lat: 36.4383, lon: -6.2050 },
  { id: "45", name: "Sancti Petri", lat: 36.3950, lon: -6.2083 },
  { id: "46", name: "Conil", lat: 36.2950, lon: -6.1367 },
  { id: "47", name: "Barbate", lat: 36.1850, lon: -5.9333 },
  { id: "48", name: "Tarifa", lat: 36.0067, lon: -5.6033 },
  { id: "49", name: "Algeciras", lat: 36.1800, lon: -5.4000 },
  { id: "50", name: "Sotogrande", lat: 36.2833, lon: -5.2833 },
  { id: "51", name: "Ceuta", lat: 35.8917, lon: -5.3150 },
  { id: "52", name: "Tánger", lat: 35.7883, lon: -5.8033 },
  { id: "53", name: "Arrecife (Lanzarote)", lat: 28.9667, lon: -13.5300, tz: "Atlantic/Canary" },
  { id: "54", name: "Puerto del Rosario (Fuerteventura)", lat: 28.4917, lon: -13.8583, tz: "Atlantic/Canary" },
  { id: "55", name: "Morro Jable (Fuerteventura)", lat: 28.0500, lon: -14.3600, tz: "Atlantic/Canary" },
  { id: "56", name: "Puerto de la Luz (Gran Canaria)", lat: 28.1467, lon: -15.4100, tz: "Atlantic/Canary" },
  { id: "57", name: "Arinaga (Gran Canaria)", lat: 27.8467, lon: -15.4017, tz: "Atlantic/Canary" },
  { id: "58", name: "Pasito Blanco (Gran Canaria)", lat: 27.7467, lon: -15.6217, tz: "Atlantic/Canary" },
  { id: "59", name: "Puerto de las Nieves (Gran Canaria)", lat: 28.1000, lon: -15.7117, tz: "Atlantic/Canary" },
  { id: "60", name: "Santa Cruz de Tenerife", lat: 28.4767, lon: -16.2417, tz: "Atlantic/Canary" },
  { id: "61", name: "Los Gigantes (Tenerife)", lat: 28.2483, lon: -16.8417, tz: "Atlantic/Canary" },
  { id: "62", name: "Puerto de la Cruz (Tenerife)", lat: 28.4183, lon: -16.5500, tz: "Atlantic/Canary" },
  { id: "63", name: "Los Cristianos (Tenerife)", lat: 28.0483, lon: -16.7183, tz: "Atlantic/Canary" },
  { id: "64", name: "Granadilla (Tenerife)", lat: 28.0883, lon: -16.4917, tz: "Atlantic/Canary" },
  { id: "65", name: "San Sebastián de la Gomera", lat: 28.0883, lon: -17.1083, tz: "Atlantic/Canary" },
  { id: "66", name: "Santa Cruz de La Palma", lat: 28.6800, lon: -17.7700, tz: "Atlantic/Canary" },
  { id: "67", name: "Puerto de la Estaca (El Hierro)", lat: 27.7833, lon: -17.9017, tz: "Atlantic/Canary" },
  { id: "70", name: "Langosteira (Puerto exterior de A Coruña)", lat: 43.3467, lon: -8.5317 },
  { id: "71", name: "A Guarda", lat: 41.8983, lon: -8.8767 },
  { id: "72", name: "Bermeo", lat: 43.4207, lon: -2.7128 },
];

// IHM stations list endpoint (always UTC and may change over time).
// Keep this separate from the baseUrl setting so the dropdown list stays up to date.
const IHM_GETLIST_URL =
  "https://ideihm.covam.es/api-ihm/getmarea?request=getlist&format=json";

export default function (app: SignalKApp): TideSource {
  return {
    id: "ihm",
    title: "IHM (España)",
    properties: {
      ihmBaseUrl: {
        title: "IHM base URL",
        type: "string",
        description:
          "Base URL of the getmarea service. Example: https://ideihm.covam.es/api-ihm/getmarea",
        default: "https://ideihm.covam.es/api-ihm/getmarea",
      },
      cacheRefreshHours: {
        title: "Cache refresh (hours)",
        type: "number",
        default: DEFAULT_REFRESH_HOURS,
        minimum: 1,
      },
      gpsMaxAgeMinutes: {
        title: "GPS max age (min)",
        type: "number",
        default: DEFAULT_GPS_MAX_AGE_MINUTES,
        minimum: 1,
      },
    },
    async start(props) {
      const baseUrl = (props.ihmBaseUrl || "").replace(/\/$/, "");
      if (!baseUrl) {
        // Plugin stays inactive until configured.
        app.error("IHM: falta configurar 'IHM base URL' (plugin inactivo hasta que lo configures)");
        // Return an updater that does nothing (so the plugin doesn't crash Signal K).
        return async () => ({ station: { name: "IHM" }, extremes: [] } as any);
      }

      const refreshHours = props.cacheRefreshHours ?? DEFAULT_REFRESH_HOURS;
      const gpsMaxAgeMinutes = props.gpsMaxAgeMinutes ?? DEFAULT_GPS_MAX_AGE_MINUTES;

      const cache = new FileCache(path.join(app.getDataDirPath(), "ihm"));
      // Always keep the station list updated (and cached) because IHM may change it.
      const stations = await StationList.load(cache, app, baseUrl, refreshHours);

      return async (params: TideForecastParams): Promise<TideForecastResult> => {
        const date = params.date ? moment(params.date) : moment().subtract(1, "days");
        const begin = date.clone().startOf("day");
        const end = date.clone().add(7, "days").endOf("day");

        // Rev149 / Rev150: si el usuario eligió una pseudo-estación,
        // saltamos IHM por completo:
        //   - "sin-marea" / "mediterraneo": modelo sintético offline.
        //   - "openmeteo-global": Open-Meteo Marine API (cualquier lat/lon
        //     del mundo, requiere internet).
        // El usuario puede elegirla en MANUAL (manualStationId) o en AUTO
        // (favoriteStationId). Ambas vías deben respetarse — antes solo
        // funcionaba MANUAL.
        const manualOverride = Boolean(await cache.get("manualOverride"));
        const manualStationId = String((await cache.get("manualStationId")) ?? "");
        const favoriteStationIdEarly = String((await cache.get("favoriteStationId")) ?? "");
        const effSynId = manualOverride && manualStationId
          ? manualStationId
          : (favoriteStationIdEarly || "");
        if (effSynId === "openmeteo-global") {
          const lat = params.position?.latitude;
          const lon = params.position?.longitude;
          if (typeof lat === "number" && typeof lon === "number") {
            try {
              return await openmeteoTideForecast(app, cache, lat, lon);
            } catch (e: any) {
              app.debug(`[OM-TIDES] forecast failed: ${e?.message ?? e}. Falling back to "sin-marea".`);
              return syntheticForecast(getSyntheticStation("sin-marea")!, params.position, begin.valueOf());
            }
          }
          // Sin GPS → no podemos usar Open-Meteo global. Caemos a "sin-marea".
          return syntheticForecast(getSyntheticStation("sin-marea")!, params.position, begin.valueOf());
        }
        if (isSyntheticStationId(effSynId)) {
          const synStation = getSyntheticStation(effSynId)!;
          return syntheticForecast(synStation, params.position, begin.valueOf());
        }

        const position = isUsablePosition(params.position, gpsMaxAgeMinutes)
          ? params.position!
          : undefined;

        const station = await resolveStation(cache, stations, position);
        if (!station) {
          // Rev149: este caso no debería ocurrir tras el fix de offshore (la
          // resolución ahora siempre cae a VIGO como último recurso), pero
          // dejamos el chequeo defensivo con un mensaje preciso.
          throw new Error(
            "IHM: no se pudo seleccionar estación (caché vacía + sin GPS + fallback VIGO falló). Selecciona una estación manualmente."
          );
        }

        const months = monthsNeeded(begin, end);
        const monthData = await Promise.all(
          months.map(({ year, month }) =>
            loadMonth(cache, app, baseUrl, station, year, month, refreshHours)
          )
        );

        const extremes = monthData
          .flatMap((m) => m.extremes)
          .filter((e) => {
            const t = new Date(e.time).getTime();
            return t >= begin.valueOf() && t <= end.valueOf();
          })
          .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        // Prefer coefficient from the current month if available
        const coef =
          monthData.find((m) => m.year === begin.year() && m.month === begin.month() + 1)
            ?.coef ?? monthData.find((m) => typeof m.coef === "number")?.coef;

        return {
          station: {
            id: station.id,
            name: station.name,
            position: { latitude: station.lat, longitude: station.lon },
          },
          ...(typeof coef === "number" ? { coef } : {}),
          extremes: extremes.map((e) => ({
            type: e.type,
            value: e.value,
            time: e.time,
          })),
        };
      };
    },
  };
}

function isUsablePosition(
  position: TideForecastParams["position"],
  maxAgeMinutes: number
): boolean {
  if (!position) return false;
  const { latitude, longitude } = position as any;
  const timestamp = (position as any).timestamp as string | undefined;

  if (typeof latitude !== "number" || typeof longitude !== "number") return false;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  // Defensive bounds
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  if (!timestamp) return true; // Some SK implementations omit it

  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs >= 0 && ageMs <= maxAgeMinutes * 60 * 1000;
}

async function resolveStation(
  cache: FileCache,
  stations: StationList,
  position: TideForecastParams["position"] | undefined
): Promise<IhmStation | null> {
  // 1) Manual override from webapp (must win)
  const manualOverride = Boolean(await cache.get("manualOverride"));
  const manualStationId = (await cache.get("manualStationId")) as any;
  if (manualOverride && manualStationId != null) {
    const st = stations.get(String(manualStationId));
    if (st) {
      await cache.set("lastStation", st);
      return st;
    }
    // Rev150: NO purgar si es un ID sintético (openmeteo-global, sin-marea,
    // mediterraneo). El intercept del provider los maneja antes de llegar
    // aquí; si llegamos a este punto con uno de ellos es por una ruta
    // alternativa (p.ej. `lastForecast` aún sin poblar). Conservamos el ID.
    if (!isSyntheticStationId(String(manualStationId)) && String(manualStationId) !== "openmeteo-global") {
      // Rev144: id manual ya no existe (probable upgrade desde lista vieja).
      // Limpiar para evitar reintentos perpetuos contra ids muertos.
      await cache.set("manualStationId", null);
      await cache.set("manualOverride", false);
    }
  }

  // 2) Favorite station (user-picked while staying in Auto)
  // If the user has selected a station in the Auto dropdown, we must honor it
  // even if GPS is present. Otherwise the GPS "closest" logic will immediately
  // overwrite the selection and the UI will appear broken.
  const favoriteStationId = (await cache.get("favoriteStationId")) as any;
  if (favoriteStationId != null) {
    const fav = stations.get(String(favoriteStationId));
    if (fav) {
      await cache.set("lastStation", fav);
      return fav;
    }
    // Rev150: NO purgar IDs sintéticos. El intercept del provider los maneja.
    if (!isSyntheticStationId(String(favoriteStationId)) && String(favoriteStationId) !== "openmeteo-global") {
      // Rev144: idem para favorito.
      await cache.set("favoriteStationId", null);
    }
  }

  if (position) {
    const { station, distanceMeters } = stations.closestToWithDistance(position);
    const distanceKm = distanceMeters / 1000;
    if (Number.isFinite(distanceKm) && distanceKm <= MAX_AUTO_DISTANCE_KM) {
      await cache.set("lastStation", station);
      return station;
    }
    // Rev149 (bug fix): offshore (>300 km de cualquier IHM). Antes devolvía
    // null y el caller lanzaba "sin GPS y sin estación previa en caché",
    // mensaje confuso y bloqueo total para usuarios de Mediterráneo, Norte de
    // España fuera de Cantábrico, etc. Ahora caemos al fallback estándar:
    // estación cacheada previa si existe, si no VIGO. El usuario puede
    // luego elegir manualmente otra del dropdown.
    // (Cae al bloque de cache de abajo deliberadamente.)
  }

  const cached = (await cache.get("lastStation")) as IhmStation | undefined;
  // Rev144: validar el id contra la lista actual ANTES de devolverlo.
  // Si la cache trae un id viejo (ej. "3214" de la lista 4-dígitos pre-2.0)
  // que ya no existe en IHM, lo purgamos y caemos al fallback. Sin esto, el
  // plugin reintenta con el id inválido y IHM devuelve "El puerto no existe"
  // cada minuto al actualizar las mareas.
  if (cached && cached.id && stations.get(String(cached.id))) {
    return cached;
  }
  // Si cached existe pero no es válida, simplemente caemos al fallback (purga silente).

  // v1.2.0: Absolute last resort — Vigo. Prevents plugin from being stuck
  // when there is no GPS, no manual selection, and no cached station.
  await cache.set("lastStation", VIGO_FALLBACK);
  return VIGO_FALLBACK;
}

function monthsNeeded(begin: moment.Moment, end: moment.Moment) {
  const out: Array<{ year: number; month: number }> = [];
  const cur = begin.clone().startOf("month");
  const last = end.clone().startOf("month");
  while (cur.isSameOrBefore(last, "month")) {
    out.push({ year: cur.year(), month: cur.month() + 1 });
    cur.add(1, "month");
  }
  return out;
}

async function loadMonth(
  cache: FileCache,
  app: SignalKApp,
  baseUrl: string,
  station: IhmStation,
  year: number,
  month: number,
  refreshHours: number
): Promise<CachedMonth> {
  // IMPORTANT:
  // Cache schema bump (v2): FIX28 stored extremes with a 1h shift due to local-time parsing.
  // After fixing the parser to use UTC, we must NOT reuse the old cached month files.
  // Using a versioned key lets the plugin seamlessly rebuild cache without requiring the user
  // to manually delete anything.
  const key = `month_v2_${station.id}_${year}-${String(month).padStart(2, "0")}`;
  const cached = (await cache.get(key)) as CachedMonth | undefined;
  if (cached && !isStale(cached.fetchedAt, refreshHours)) {
    return cached;
  }

  try {
    const fresh = await fetchIhmMonth(app, baseUrl, station, year, month);
    await cache.set(key, fresh);
    return fresh;
  } catch (e) {
    if (cached) {
      // Offline/failed refresh: fall back to cached month
      return cached;
    }
    throw e;
  }
}

function isStale(fetchedAt: string, refreshHours: number) {
  const t = Date.parse(String(fetchedAt ?? ""));
  // If timestamp is missing/corrupt, force refresh (otherwise NaN makes the cache look forever-fresh)
  if (!Number.isFinite(t)) return true;
  const ageMs = Date.now() - t;
  return ageMs > refreshHours * 60 * 60 * 1000;
}

async function fetchJsonWithTimeout(app: SignalKApp, url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    app.debug(`IHM: Fetching ${url}`);
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`IHM HTTP ${res.status}: ${res.statusText}`);
    // Rev142: el endpoint IHM a veces devuelve texto plano en errores
    // ("El puerto no existe…") con HTTP 200, lo que hacía explotar res.json()
    // con un SyntaxError "Unexpected token 'E'…" cada segundo. Leemos como
    // texto, validamos que parezca JSON y solo entonces parseamos.
    // Rev144: además, los mensajes de error de IHM llegan en Latin-1 / ISO-8859-1
    // (no UTF-8). Decodificamos los bytes con el charset adecuado según el
    // Content-Type para que "obtención" no aparezca como "obtenci�n" en logs/UI.
    const buf = await res.arrayBuffer();
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isJsonCT = ct.includes("application/json") || ct.includes("text/json");
    const charset = (ct.match(/charset=([^;]+)/) || [])[1]?.trim().toLowerCase() || "";
    let text: string;
    try {
      // Si el server declara charset, lo usamos. Si no, intentamos UTF-8 primero;
      // si vemos U+FFFD (replacement) o cabecera no-JSON, reintentamos Latin-1.
      if (charset) {
        text = new TextDecoder(charset, { fatal: false }).decode(buf);
      } else {
        const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        if (utf8.includes("�") && !isJsonCT) {
          text = new TextDecoder("iso-8859-1").decode(buf);
        } else {
          text = utf8;
        }
      }
    } catch {
      text = new TextDecoder("iso-8859-1").decode(buf);
    }
    const trimmed = text.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
      throw new Error(`IHM API returned non-JSON: "${trimmed.slice(0, 120)}"`);
    }
    try {
      return JSON.parse(trimmed);
    } catch (e: any) {
      throw new Error(`IHM JSON parse failed: ${e?.message ?? e} — body: "${trimmed.slice(0, 120)}"`);
    }
  } finally {
    clearTimeout(t);
  }
}

async function fetchIhmMonth(
  app: SignalKApp,
  baseUrl: string,
  station: IhmStation,
  year: number,
  month: number
): Promise<CachedMonth> {
  // IHM getmarea API (confirmed):
  // - Stations:  <baseUrl>?request=getlist&format=json
  // - Tides:     <baseUrl>?request=gettide&id=<id>&format=json&month=YYYYMM
  const endpoint = new URL(baseUrl);
  endpoint.searchParams.set("request", "gettide");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("id", station.id);
  endpoint.searchParams.set(
    "month",
    `${year}${String(month).padStart(2, "0")}`
  );

  const body = await fetchJsonWithTimeout(app, endpoint.toString());

  const { extremes, coef } = parseIhmTides(body);

  return {
    station,
    year,
    month,
    extremes,
    ...(typeof coef === "number" ? { coef } : {}),
    fetchedAt: new Date().toISOString(),
  };
}

function parseIhmTides(body: any): { extremes: IhmExtreme[]; coef?: number } {
  // Coeficiente: el endpoint getmarea/gettide NO lo incluye (normalmente).
  // Si aparece en el futuro, lo leemos sin romper compatibilidad.
  const coef = asNumber(body?.coef) ?? asNumber(body?.coefficient);

  // La API devuelve como raíz una clave "mareas", pero el shape puede variar:
  // - Diario (por defecto / con date): { mareas: { fecha, datos: { marea: [...] } } }
  // - Mensual (con month): puede incluir múltiples días y anidaciones, pero siempre hay
  //   nodos con { fecha, (datos.marea[] o marea[]) }.
  const root = body?.mareas ?? body;

  const entries: Array<{ fecha: string; list: any[] }> = [];

  function normFecha(f: string): string {
    const s = String(f ?? "").trim();
    if (!s) return "";
    // acepta YYYY-MM-DD o YYYYMMDD
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s;
  }


// Caso mensual típico del IHM: root.datos.marea es una lista "plana" de eventos,
// y cada evento YA incluye su propia "fecha" (YYYY-MM-DD) + "hora".
// Ejemplo:
// { mareas: { datos: { marea: [ { fecha, hora, altura, tipo }, ... ] } } }
const flat = root?.datos?.marea;
if (Array.isArray(flat) && flat.length && typeof flat[0] === "object" && flat[0] && ("fecha" in flat[0])) {
  const extremes: IhmExtreme[] = [];
  for (const r of flat) {
    const fecha = normFecha((r as any)?.fecha);
    const hora = String((r as any)?.hora ?? "").trim();
    const v = asNumber((r as any)?.altura);
    const type = normalizeType((r as any)?.tipo);
    if (!fecha || !hora || typeof v !== "number" || !type) continue;
    // IHM devuelve fecha + hora en UTC (sin sufijo 'Z'). Debemos parsear en UTC SIEMPRE.
    // Parseo estricto: evita que Moment interprete como hora local.
    const hhmmss = /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora;
    const rawUtc = moment.utc(`${fecha}T${hhmmss}`, "YYYY-MM-DDTHH:mm:ss", true);
    if (!rawUtc.isValid()) continue;
    const time = rawUtc.toISOString();
    extremes.push({ time, value: v, type });
  }
  extremes.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return { extremes, ...(typeof coef === "number" ? { coef } : {}) };
}

  function maybeAdd(node: any) {
    if (!node || typeof node !== "object") return;
    const fecha = normFecha(node.fecha);
    const list = node?.datos?.marea ?? node?.marea;
    if (fecha && Array.isArray(list) && list.length) {
      entries.push({ fecha, list });
    }
  }

  function walk(node: any, depth = 0) {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      for (const it of node) walk(it, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    // intenta añadir este nodo como entrada válida
    maybeAdd(node);

    // recorre hijos
    for (const v of Object.values(node)) {
      if (v && (typeof v === "object" || Array.isArray(v))) {
        walk(v, depth + 1);
      }
    }
  }

  // Algunos formatos: root puede ser objeto único con fecha/datos,
  // o puede contener arrays dentro.
  walk(root);

  if (!entries.length) {
    const keys = root && typeof root === "object" ? Object.keys(root).join(", ") : "<non-object>";
    throw new Error(
      `IHM: respuesta de gettide no reconocida. Claves: ${keys}. No encontré entradas con fecha + (datos.marea[] o marea[]).`
    );
  }

  const extremes: IhmExtreme[] = [];

  for (const { fecha, list } of entries) {
    for (const r of list) {
      const hora = String((r as any)?.hora ?? "").trim();
      const v = asNumber((r as any)?.altura);
      const type = normalizeType((r as any)?.tipo);
      if (!hora || typeof v !== "number" || !type) {
        throw new Error(`IHM: marea inválida: ${JSON.stringify(r).slice(0, 200)}`);
      }

      // IHM devuelve fecha + hora en UTC (sin sufijo 'Z'). Debemos parsear en UTC SIEMPRE.
      // Parseo estricto: evita que Moment interprete como hora local.
      const hhmmss = /^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora;
      const rawUtc = moment.utc(`${fecha}T${hhmmss}`, "YYYY-MM-DDTHH:mm:ss", true);
      if (!rawUtc.isValid()) {
        throw new Error(`IHM: fecha/hora inválida: ${fecha} ${hora}`);
      }
      const time = rawUtc.toISOString();
      extremes.push({ time, value: v, type });
    }
  }

  // Orden por tiempo (por si venían desordenados)
  extremes.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return { extremes, ...(typeof coef === "number" ? { coef } : {}) };
}


export function stationTimezone(station: IhmStation): string {
  if (station.tz) return station.tz;

  // Deterministic rule by IHM station ID (works for MANUAL and AUTO, even if lat/lon parsing fails)
  if (isCanaryStationId(station.id)) return "Atlantic/Canary";

  // Canarias: hora local canaria (UTC en invierno, UTC+1 en verano). **Nunca**
  // debe depender de la TZ del sistema (Raspberry/PI).
  //
  // Se deduce por polígono (ray casting) para no colisionar con costa atlántica
  // peninsular y para permitir ajustes futuros sin tocar lógica de presentación.
  if (isInCanaryPolygon(station.lat, station.lon)) return "Atlantic/Canary";
  return "Europe/Madrid";
}

// Polygon (lon,lat) roughly enclosing the Canary Islands archipelago.
// Intentionally conservative; better to slightly over-include islands than to
// misclassify peninsular stations.
const CANARY_POLYGON: Array<[number, number]> = [
  [-18.80, 29.90],
  [-12.80, 29.90],
  [-12.80, 26.90],
  [-18.80, 26.90],
];

function isInCanaryPolygon(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Quick reject by bbox
  if (lon < -18.80 || lon > -12.80 || lat < 26.90 || lat > 29.90) return false;
  // Ray casting algorithm (lon=x, lat=y)
  let inside = false;
  for (let i = 0, j = CANARY_POLYGON.length - 1; i < CANARY_POLYGON.length; j = i++) {
    const xi = CANARY_POLYGON[i][0], yi = CANARY_POLYGON[i][1];
    const xj = CANARY_POLYGON[j][0], yj = CANARY_POLYGON[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function normalizeType(raw: any): "High" | "Low" | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.startsWith("h") || s.includes("plea") || s.includes("alta")) return "High";
  if (s.startsWith("l") || s.includes("baja") || s.includes("low")) return "Low";
  return null;
}

function asNumber(v: any): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

class StationList extends Map<string, IhmStation> {
  static async load(
    cache: FileCache,
    app: SignalKApp,
    _baseUrl: string,
    refreshHours: number
  ): Promise<StationList> {
    const key = "stationsList";
    const cached = (await cache.get(key)) as { stations: IhmStation[]; fetchedAt: string } | undefined;

    // Use cache if fresh.
    if (cached && !isStale(cached.fetchedAt, refreshHours)) {
      app.debug("IHM: Loaded cached station list");
      return new this(cached.stations);
    }

    // Always refresh from the official endpoint; if it fails, fall back to cache.
    // Rev332 (Pi5 fresh install fix): el cache.set DEBE ir envuelto en try/catch
    // independiente. Si falla por permisos del data-dir (caso reportado por
    // el amigo: SK corriendo como usuario distinto al dueño de ~/.signalk),
    // antes hacía return desde el catch externo y rompía el resto del flujo —
    // el provider quedaba inicializado pero la cache vacía, así el endpoint
    // /api/stations devolvía solo Vigo. Ahora capturamos el write error y
    // logueamos claro, pero seguimos devolviendo las stations en memoria.
    try {
      const body = await fetchJsonWithTimeout(app, IHM_GETLIST_URL);
      const stations = parseIhmStations(body);
      try {
        await cache.set(key, { stations, fetchedAt: new Date().toISOString() });
      } catch (writeErr: any) {
        app.error(`IHM: stations fetched OK pero NO se pudo escribir cache (${writeErr?.message ?? writeErr}). El plugin funcionará en memoria; revisa permisos de ${cache.path}.`);
      }
      return new this(stations);
    } catch (e: any) {
      if (cached?.stations?.length) {
        app.error(`IHM: no se pudo refrescar getlist; usando caché (${e?.message ?? String(e)})`);
        return new this(cached.stations);
      }
      // v1.2.0: No internet + no cache → return Vigo so the plugin isn't dead on first boot.
      app.error(`IHM: sin red y sin caché de estaciones; usando lista hardcoded (${e?.message ?? String(e)})`);
      // Cache them so /api/stations endpoint can find them too.
      // Rev332: cache.set en try/catch — si falla por permisos, no rompemos.
      try {
        await cache.set(key, { stations: HARDCODED_STATIONS, fetchedAt: "2000-01-01T00:00:00Z" });
      } catch (writeErr: any) {
        app.error(`IHM: NO se pudo persistir HARDCODED_STATIONS en cache (${writeErr?.message ?? writeErr}). Plugin funcionará en memoria; el endpoint /api/stations ahora también tiene fallback.`);
      }
      return new this(HARDCODED_STATIONS);
    }
  }

  constructor(stations: IhmStation[]) {
    super(stations.map((s) => [s.id, s]));
  }

  closestToWithDistance(position: { latitude: number; longitude: number }): {
    station: IhmStation;
    distanceMeters: number;
  } {
    const list = [...this.values()];
    if (!list.length) throw new Error("IHM: no hay estaciones disponibles");

    let best = list[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const s of list) {
      const dist = distanceMeters(position.latitude, position.longitude , s.lat, s.lon );
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return { station: best, distanceMeters: bestDist };
  }

  // Rev146 (audit fix): eliminado `closestTo()` — sin callers. Toda la lógica
  // usa `closestToWithDistance()` que devuelve estación + distancia.
}

function parseIhmStations(body: any): IhmStation[] {
  // Respuesta real:
  // { estaciones: { puertos: [{id, code, puerto, lat, lon}, ...] } }
  const rawList = body?.estaciones?.puertos;
  if (!Array.isArray(rawList)) {
    const keys = body && typeof body === "object" ? Object.keys(body).join(", ") : "<non-object>";
    throw new Error(
      `IHM: respuesta de getlist no reconocida. Claves: ${keys}. Esperaba estaciones.puertos[].`
    );
  }

  const stations: IhmStation[] = rawList.map((r: any) => {
    const id = String(r?.id ?? "").trim();
    const name = String(r?.puerto ?? "").trim();
    const lat = asNumber(r?.lat);
    const lon = asNumber(r?.lon);
    const tzRaw = r?.tz ?? r?.timezone; // (no siempre viene)
    if (!id || !name || typeof lat !== "number" || typeof lon !== "number") {
      throw new Error(`IHM: estación inválida: ${JSON.stringify(r).slice(0, 200)}`);
    }
    // Si IHM no informa TZ, inferimos un valor seguro.
    // Regla principal: por ID (determinista). Fallback: polígono (por si IHM cambia ids en el futuro).
    const tz = tzRaw
      ? String(tzRaw)
      : (isCanaryStationId(id) || isInCanaryPolygon(lat, lon) ? "Atlantic/Canary" : "Europe/Madrid");
    return { id, name, lat, lon, tz };
  });

  if (!stations.length) throw new Error("IHM: /getlist devolvió 0 estaciones");
  return stations;
}
