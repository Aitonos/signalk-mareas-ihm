// Rev916: history of where the other boats have been, and our own estimate
// of where each one is anchored. Lives in the backend, the single source of
// truth: the viewer used to keep it in each browser's localStorage, so each
// device had its own and started empty. It is the fallback for boats that
// signalk-anchor-mapper does not cover (or when it is not installed).

export type Fix = { t: number; lat: number; lng: number };

export type OwnAnchorEstimate = {
  lat: number;
  lng: number;
  /** Radius the GPS antenna swings at (P90 distance to the centroid). The
   *  viewer adds what the stern reaches beyond the antenna. */
  radiusM: number;
  points: number;
};

export const HIST_MS = 3 * 3600_000;
export const STEP_MS = 30_000;
const MIN_POINTS = 4;
const MAX_NET_DRIFT_M = 200;
const MAX_RADIUS_M = 300;
const MAX_SOG_KN = 0.5;

export function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Same rule the viewer used since Rev906: centroid of the last 3 h and the
 *  P90 distance to it. A rough fit (the anchor is really at the centre of
 *  the swing arc); anchor-mapper's circle fit is better and wins. */
export function estimateFromFixes(fixes: Fix[], sogKn: number | null, now: number): OwnAnchorEstimate | null {
  if (typeof sogKn === "number" && sogKn > MAX_SOG_KN) return null;
  const recent = fixes.filter((f) => now - f.t < HIST_MS);
  if (recent.length < MIN_POINTS) return null;
  if (distM(recent[0], recent[recent.length - 1]) > MAX_NET_DRIFT_M) return null;
  let sLat = 0, sLng = 0;
  for (const f of recent) { sLat += f.lat; sLng += f.lng; }
  const c = { lat: sLat / recent.length, lng: sLng / recent.length };
  const d = recent.map((f) => distM(c, f)).sort((a, b) => a - b);
  const radiusM = d[Math.max(0, Math.floor(d.length * 0.9) - 1)];
  if (!(radiusM >= 0) || radiusM > MAX_RADIUS_M) return null;
  return { lat: c.lat, lng: c.lng, radiusM, points: recent.length };
}

/** Rev918: does an anchor published by another app (anchor-mapper) fit
 *  this boat's own recent track? No when the P90 distance of the last 3 h
 *  from that anchor is beyond its radius plus the position noise of a
 *  class B AIS (10 m). Too few fixes: we cannot tell, so it fits. */
export const AIS_POS_NOISE_M = 10;
export function anchorFitsTrack(fixes: Fix[], anchor: { lat: number; lng: number }, radiusM: number, now: number): { fits: boolean; p90M: number | null } {
  const recent = fixes.filter((f) => now - f.t < HIST_MS);
  if (recent.length < 20) return { fits: true, p90M: null };
  const d = recent.map((f) => distM(anchor, f)).sort((a, b) => a - b);
  const p90M = d[Math.max(0, Math.floor(d.length * 0.9) - 1)];
  return { fits: p90M <= radiusM + AIS_POS_NOISE_M, p90M };
}

export class AnchorHistory {
  private tracks = new Map<string, Fix[]>();

  /** One fix per boat every STEP_MS; older than HIST_MS is dropped. */
  add(id: string, lat: number, lng: number, now: number): void {
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let a = this.tracks.get(id);
    if (!a) { a = []; this.tracks.set(id, a); }
    if (a.length && now - a[a.length - 1].t < STEP_MS) return;
    a.push({ t: now, lat, lng });
    if (a[0].t < now - HIST_MS) this.tracks.set(id, a.filter((f) => f.t >= now - HIST_MS));
  }

  /** Boats not heard for HIST_MS are forgotten. */
  prune(now: number): void {
    for (const [id, a] of this.tracks) {
      if (!a.length || a[a.length - 1].t < now - HIST_MS) this.tracks.delete(id);
    }
  }

  get(id: string): Fix[] {
    return this.tracks.get(id) ?? [];
  }

  estimate(id: string, sogKn: number | null, now: number): OwnAnchorEstimate | null {
    return estimateFromFixes(this.get(id), sogKn, now);
  }

  size(): number {
    return this.tracks.size;
  }
}
