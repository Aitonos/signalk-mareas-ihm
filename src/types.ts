import { Position, ServerAPI } from "@signalk/server-api";

// TODO[TS]: Fix this in the upstream types
export type SignalKApp = ServerAPI;

export type OptionalPromise<T> = T | Promise<T>;

export type TideExtremeType = "High" | "Low";

export interface TideForecastParams {
  // Position is optional to support "last station" fallback when GNSS is not yet available.
  position?: Omit<Position, "altitude">;
  date?: string;
}

export interface TideExtreme {
  time: string;
  value: number;
  type: TideExtremeType;
}

export interface TideForecastResult {
  station: {
    id?: string;
    name: string;
    position: {
      latitude: number;
      longitude: number;
    };
  }
  // Optional: tidal coefficient (if provided by the source)
  coef?: number;

  /**
   * Optional convenience fields.
   *
   * The canonical payload is `extremes[]`. However, some code paths (or older
   * forks) may attach `nextHigh/nextLow` objects for quick access.
   *
   * Keeping these as optional prevents TypeScript build errors without
   * changing runtime behavior.
   */
  nextHigh?: { time: string; height: number };
  nextLow?: { time: string; height: number };
  extremes: TideExtreme[];
}

export type TideForecastFunction = (params: TideForecastParams) => OptionalPromise<TideForecastResult>;

export interface TideSource {
  id: string;
  title: string;
  start: (props: Config) => OptionalPromise<TideForecastFunction>;
  properties?: Record<string, any>;
}

export type Config = {
  period?: number;
  // IHM configuration
  ihmBaseUrl?: string;
  cacheRefreshHours?: number;
  gpsMaxAgeMinutes?: number;
};

// Rev146 (audit fix): constantes compartidas que antes vivían duplicadas en
// index.ts y sources/ihm.ts. Una sola fuente de verdad.
export const MAX_AUTO_DISTANCE_KM = 300;
export const DEFAULT_STATION_ID = "29";    // VIGO (IHM, verificado Rev142)
export const DEFAULT_STATION_NAME = "VIGO";
export const DEFAULT_STATION_LAT = 42.24;
export const DEFAULT_STATION_LON = -8.72;
