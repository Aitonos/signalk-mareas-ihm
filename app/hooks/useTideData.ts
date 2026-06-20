import { useEffect, useState } from "react";

export const { VITE_SIGNALK_URL = window.location.origin } = import.meta.env;

export const TIDE_URL = new URL(
  "/signalk/v1/api/vessels/self/environment/tide",
  VITE_SIGNALK_URL
).toString();

// Sunlight times (used in the header: Salida/Puesta = sunrise/sunset (SOL REAL) in station-local HH:MM)
export const NAV_DATETIME_URL = new URL(
  "/signalk/v1/api/vessels/self/navigation/datetime",
  VITE_SIGNALK_URL
).toString();

export const SUNLIGHT_TIMES_URL = new URL(
  "/signalk/v1/api/vessels/self/environment/sunlight/times",
  VITE_SIGNALK_URL
).toString();

export const RESOURCES_TIDES_URL = new URL(
  "/signalk/v1/api/resources/tides",
  VITE_SIGNALK_URL
).toString();

// Preferred: plugin-owned endpoint (no 404 on servers without /resources/tides)
export const PLUGIN_EXTREMES_URL = new URL(
  "/signalk-mareas-ihm/api/extremes",
  VITE_SIGNALK_URL
).toString();

export const SETTINGS_URL = new URL(
  "/#/serverConfiguration/plugins/mareas-ihm",
  VITE_SIGNALK_URL
).toString();

export type TideSnapshot = {
  stationName?: string;
  heightNow?: number;
  tendency?: string;
  heightLastHigh?: number;
  timeLastHigh?: string;
  heightLastLow?: number;
  timeLastLow?: string;
  heightNextHigh?: number;
  timeNextHigh?: string;
  heightNextLow?: number;
  timeNextLow?: string;
  coef?: number;
  coefLocal?: number;
  amplitudeCoefficient?: number;
  pluginVersion?: string;
  pluginIteration?: string;
  navegacionRiasbaixas?: string;  sunrise?: string;
  sunset?: string;
  navDatetime?: string;
  timestamp?: string;
  resume?: string;
  groundingStatus?: string;
};

export type TideExtreme = {
  time: string;
  value: number;
  type?: string; // "High" | "Low" (as used by signalk-tides)
};

export type TideStation = {
  id?: string;
  name: string;
  lat?: number;
  lon?: number;
};

export type TideForecast = {
  station: TideStation;
  extremes: TideExtreme[];
  coef?: number;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

function unwrapValue<T = any>(v: any): T | undefined {
  if (v && typeof v === "object" && "value" in v) return (v as any).value as T;
  return v as T;
}

function unwrapTimestamp(v: any): string | undefined {
  if (v && typeof v === "object" && "timestamp" in v) return (v as any).timestamp as string;
  return undefined;
}

function normalizeTideSnapshot(json: any): TideSnapshot {
  // Supports Signal K v1 "full" values (objects with .value) and plain values.
  if (!json || typeof json !== "object") return {};
  return {
    stationName: unwrapValue<string>(json.stationName),
    heightNow: unwrapValue<number>(json.heightNow),
    tendency: unwrapValue<string>(json.tendency),
    heightLastHigh: unwrapValue<number>(json.heightLastHigh),
    timeLastHigh: unwrapValue<string>(json.timeLastHigh),
    heightLastLow: unwrapValue<number>(json.heightLastLow),
    timeLastLow: unwrapValue<string>(json.timeLastLow),
    heightNextHigh: unwrapValue<number>(json.heightNextHigh),
    timeNextHigh: unwrapValue<string>(json.timeNextHigh),
    heightNextLow: unwrapValue<number>(json.heightNextLow),
    timeNextLow: unwrapValue<string>(json.timeNextLow),
    coef: unwrapValue<number>(json.coef),
    coefLocal: unwrapValue<number>(json.coefLocal),
    amplitudeCoefficient: unwrapValue<number>(json.amplitudeCoefficient),
    pluginVersion: unwrapValue<string>(json.pluginVersion),
    pluginIteration: unwrapValue<string>(json.pluginIteration),
    navegacionRiasbaixas: unwrapValue<string>(json.navegacionRiasbaixas),
    resume: unwrapValue<string>(json.resume),
    groundingStatus: unwrapValue<string>(json.vessel?.groundingStatus),
    // Sunrise/Sunset are fetched separately and merged later.
    // Prefer a timestamp from one of the fields (Signal K v1 includes per-field timestamps)
    timestamp:
      unwrapTimestamp(json.heightNow) ??
      unwrapTimestamp(json.timeNextHigh) ??
      unwrapTimestamp(json.timeNextLow) ??
      unwrapTimestamp(json.timeLastHigh) ??
      unwrapTimestamp(json.timeLastLow),
  };
}

function normalizeSunlightTimes(json: any): { sunrise?: string; sunset?: string } {
  if (!json || typeof json !== "object") return {};
  return {
    sunrise: unwrapValue<string>((json as any).sunrise),
    sunset: unwrapValue<string>((json as any).sunset),
  };
}

function normalizeTideForecast(json: any): TideForecast | undefined {
  if (!json) return undefined;

  // Signal K resource list may be:
  // - an array of resources
  // - an object with "resources" array
  // - directly a TideForecast-like object
  const candidate =
    Array.isArray(json) ? json[0] :
    (json && typeof json === "object" && Array.isArray((json as any).resources)) ? (json as any).resources[0] :
    json;

  if (!candidate || typeof candidate !== "object") return undefined;

  const extremesRaw = (candidate as any).extremes;
  if (!Array.isArray(extremesRaw)) return undefined;

  const station = (candidate as any).station ?? { name: (candidate as any).stationName ?? "Mareas" };

  const extremes: TideExtreme[] = extremesRaw
    .map((e: any) => ({
      time: String(e.time),
      value: typeof e.value === "number" ? e.value : Number(e.value),
      type: e.type ? String(e.type) : undefined,
    }))
    .filter((e: TideExtreme) => e.time && Number.isFinite(e.value));

  return {
    station: {
      id: station.id ? String(station.id) : undefined,
      name: String(station.name ?? "Mareas"),
      lat: station.lat != null ? Number(station.lat) : undefined,
      lon: station.lon != null ? Number(station.lon) : undefined,
    },
    extremes,
    coef: typeof (candidate as any).coef === "number" ? (candidate as any).coef : undefined,
  };
}

export function useTideData(pollSeconds = 30) {
  const [snapshot, setSnapshot] = useState<TideSnapshot>();
  const [forecast, setForecast] = useState<TideForecast>();
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = () => setRefetchTrigger((c) => c + 1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapJson = await fetchJson(TIDE_URL);

        if (cancelled) return;
        // Fetch sunlight times (optional). Do NOT fail the whole view if this endpoint is missing.
                let sunlight: { sunrise?: string; sunset?: string } = {};
        try {
          const sunJson = await fetchJson(SUNLIGHT_TIMES_URL);
          sunlight = normalizeSunlightTimes(sunJson);
        } catch {
          // ignore
        }

        // Fetch navigation.datetime (optional). Used to show "hora del dato" in header.
        let navDatetime: string | undefined;
        try {
          const navJson = await fetchJson(NAV_DATETIME_URL);
          navDatetime = unwrapValue<string>(navJson as any);
        } catch {
          // ignore
        }


        setSnapshot({
          ...normalizeTideSnapshot(snapJson),
          ...sunlight,
          ...(navDatetime ? { navDatetime } : {}),
        });

        // Forecast is optional. Prefer plugin endpoint, fallback to /resources/tides when available.
        let forecastSet = false;
        try {
          const pluginJson = await fetchJson(PLUGIN_EXTREMES_URL);
          const nf = normalizeTideForecast(pluginJson);
          if (!cancelled) setForecast(nf);
          forecastSet = Boolean(nf);
        } catch {
          // ignore
        }

        if (!forecastSet) {
          try {
            const resJson = await fetchJson(RESOURCES_TIDES_URL);
            if (!cancelled) setForecast(normalizeTideForecast(resJson));
          } catch {
            if (!cancelled) setForecast(undefined);
          }
        }

        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    };

    load();
    const t = window.setInterval(load, pollSeconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [pollSeconds, refetchTrigger]);

  return { snapshot, forecast, error, refetch };
}
