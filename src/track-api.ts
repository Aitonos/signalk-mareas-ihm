// Rev917: one vessel's recorded track, with times, from the Signal K Track
// API (server 2.33+, provided by @signalk/tracks-plugin 3+, which keeps AIS
// tracks for 7 days). Same approach as signalk-anchor-mapper's src/seed.js:
// in process through app.getTrackApi(), no HTTP, port or token, and
// Temporal taken from the server's own module tree (no new dependency).

import { createRequire } from "node:module";

export type TimedFix = { t: number; lat: number; lng: number };

let _temporal: any | undefined;
function loadTemporal(): any | null {
  if (_temporal !== undefined) return _temporal;
  _temporal = null;
  if ((globalThis as any).Temporal) return (_temporal = (globalThis as any).Temporal);
  const bases: string[] = [];
  try { if (require.main?.filename) bases.push(require.main.filename); } catch { /* ESM */ }
  try { if (process.argv[1]) bases.push(process.argv[1]); } catch { /* none */ }
  for (const base of bases) {
    try {
      const req = createRequire(base);
      try { return (_temporal = req("@js-temporal/polyfill").Temporal); } catch { /* next */ }
      try { return (_temporal = createRequire(req.resolve("@signalk/server-api"))("@js-temporal/polyfill").Temporal); } catch { /* next */ }
    } catch { /* next base */ }
  }
  return _temporal;
}

function buildRequest(context: string, fromMs: number, toMs: number, resolutionS: number): any {
  const T = loadTemporal();
  if (T) {
    return {
      contexts: [context],
      from: T.Instant.fromEpochMilliseconds(fromMs),
      to: T.Instant.fromEpochMilliseconds(toMs),
      resolution: T.Duration.from({ seconds: resolutionS }),
      times: true,
    };
  }
  const instant = (ms: number) => ({ epochMilliseconds: ms, toString: () => new Date(ms).toISOString() });
  return { contexts: [context], from: instant(fromMs), to: instant(toMs), times: true };
}

/** Track API FeatureCollection -> fixes of that context, oldest first.
 *  Coordinates are GeoJSON order [lon, lat]; imported tracks are skipped. */
export function featuresToFixes(collection: any, context: string): TimedFix[] {
  const out: TimedFix[] = [];
  for (const f of (collection?.features ?? [])) {
    const p = f?.properties ?? {};
    const g = f?.geometry;
    if (!g || p.context !== context || p.imported !== undefined) continue;
    const lines = g.type === "MultiLineString" ? g.coordinates : g.type === "LineString" ? [g.coordinates] : null;
    const times = g.type === "LineString" && p.coordTimes && !Array.isArray(p.coordTimes[0]) ? [p.coordTimes] : p.coordTimes;
    if (!Array.isArray(lines) || !Array.isArray(times)) continue;
    lines.forEach((line: any[], i: number) => {
      const ts = times[i] || [];
      (line || []).forEach((c: any, j: number) => {
        const t = Date.parse(ts[j]);
        if (!Array.isArray(c) || !Number.isFinite(t)) return;
        const [lon, lat] = c;
        if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ t, lat, lng: lon });
      });
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Resolves the fixes, or null when there is no Track API / provider. */
export async function fetchVesselTrack(app: any, context: string, fromMs: number, toMs: number, resolutionS = 30): Promise<TimedFix[] | null> {
  if (typeof app?.getTrackApi !== "function") return null;
  let api: any;
  try { api = await app.getTrackApi(); } catch { return null; }
  try {
    const col = await api.getTracks(buildRequest(context, fromMs, toMs, resolutionS));
    return featuresToFixes(col, context);
  } catch { return null; }
}
