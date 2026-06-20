import { useEffect, useState } from "react";

export const { VITE_SIGNALK_URL = window.location.origin } = import.meta.env;

export type StationRef = {
  id: string;
  hat: number;
  lat: number;
  datum: string;
  source?: string;
  updated?: string;
};

export type StationRefState =
  | { status: "idle"; ref: null; error?: string }
  | { status: "loading"; ref: null; error?: string }
  | { status: "ok"; ref: StationRef; error?: string }
  | { status: "missing"; ref: null; error?: string };

export function useStationRef(stationId: string): StationRefState {
  const [state, setState] = useState<StationRefState>({ status: "idle", ref: null });

  useEffect(() => {
    let cancelled = false;

    if (!stationId) {
      setState({ status: "idle", ref: null });
      return;
    }

    setState({ status: "loading", ref: null });

    (async () => {
      try {
        const url = new URL(
          `/signalk-mareas-ihm/api/stationRef?id=${encodeURIComponent(stationId)}`,
          VITE_SIGNALK_URL
        ).toString();

        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) {
            setState({
              status: res.status === 404 ? "missing" : "idle",
              ref: null,
              error: `HTTP ${res.status}`,
            });
          }
          return;
        }

        const json = (await res.json()) as any;
        const ref: StationRef = {
          id: String(json.id ?? stationId),
          hat: Number(json.hat),
          lat: Number(json.lat),
          datum: String(json.datum ?? ""),
          source: json.source != null ? String(json.source) : undefined,
          updated: json.updated != null ? String(json.updated) : undefined,
        };

        if (!Number.isFinite(ref.hat) || !Number.isFinite(ref.lat) || ref.hat <= ref.lat) {
          if (!cancelled) setState({ status: "idle", ref: null, error: "invalid ref" });
          return;
        }

        if (!cancelled) setState({ status: "ok", ref });
      } catch (e: any) {
        if (!cancelled) setState({ status: "idle", ref: null, error: e?.message ?? String(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stationId]);

  return state;
}
