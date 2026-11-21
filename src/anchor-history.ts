// Rev916: history of where the other boats have been, and our own estimate
// of where each one is anchored. Lives in the backend, the single source of
// truth: the viewer used to keep it in each browser's localStorage, so each
// device had its own and started empty. It is the fallback for boats that
// signalk-anchor-mapper does not cover (or when it is not installed).

export type Fix = { t: number; lat: number; lng: number; hdg?: number | null };

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
const MIN_POINTS = 20;
// Rev922: no estimate from a couple of minutes of fixes (a ring of 6 m
// right under the boat after a restart); at least 30 min.
export const MIN_SPAN_MS = 30 * 60_000;
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
  if (recent.length < MIN_POINTS || recent[recent.length - 1].t - recent[0].t < MIN_SPAN_MS) return null;
  if (distM(recent[0], recent[recent.length - 1]) > MAX_NET_DRIFT_M) return null;
  let sLat = 0, sLng = 0;
  for (const f of recent) { sLat += f.lat; sLng += f.lng; }
  const c = { lat: sLat / recent.length, lng: sLng / recent.length };
  const d = recent.map((f) => distM(c, f)).sort((a, b) => a - b);
  const radiusM = d[Math.max(0, Math.floor(d.length * 0.9) - 1)];
  if (!(radiusM >= 0) || radiusM > MAX_RADIUS_M) return null;
  // Rev923: a boat that moves less than the position noise of an AIS is
  // berthed or on a buoy, not swinging at anchor (fishing boats in port got
  // 2-7 m rings).
  if (radiusM < AIS_POS_NOISE_M) return null;
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
  add(id: string, lat: number, lng: number, now: number, hdg: number | null = null): void {
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let a = this.tracks.get(id);
    if (!a) { a = []; this.tracks.set(id, a); }
    if (a.length && now - a[a.length - 1].t < STEP_MS) return;
    a.push(hdg != null && Number.isFinite(hdg) ? { t: now, lat, lng, hdg } : { t: now, lat, lng });
    if (a[0].t < now - HIST_MS) this.tracks.set(id, a.filter((f) => f.t >= now - HIST_MS));
  }

  /** Rev922: older fixes from the Track API after a restart, merged in time
   *  order, one every STEP_MS. */
  seed(id: string, fixes: Fix[], now: number): void {
    if (!id || !fixes.length) return;
    const all = [...fixes.filter((f) => now - f.t < HIST_MS), ...(this.tracks.get(id) ?? [])].sort((a, b) => a.t - b.t);
    const out: Fix[] = [];
    for (const f of all) if (!out.length || f.t - out[out.length - 1].t >= STEP_MS) out.push(f);
    if (out.length) this.tracks.set(id, out);
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

/** Rev922: the part of a track that belongs to the current anchorage. Walks
 *  back from the newest fix over 5-minute medians and cuts where the boat
 *  was under way: more than 1.5 kn between consecutive medians (a boat
 *  swinging at anchor moves far slower). `sinceMs`, when another app knows
 *  when the boat anchored, cuts there too (the later of the two wins). */
export const UNDERWAY_KN = 1.5;
export function currentAnchorage<T extends { t: number; lat: number; lng: number }>(fixes: T[], sinceMs: number | null = null): T[] {
  let fx = sinceMs != null && Number.isFinite(sinceMs) ? fixes.filter((f) => f.t >= sinceMs) : fixes.slice();
  if (fx.length < 2) return fx;
  const bins: { t0: number; lat: number; lng: number; tMid: number }[] = [];
  let cur: T[] = [];
  const flush = () => {
    if (!cur.length) return;
    const la = cur.map((f) => f.lat).sort((a, b) => a - b), lo = cur.map((f) => f.lng).sort((a, b) => a - b);
    const m = Math.floor(cur.length / 2);
    bins.push({ t0: cur[0].t, lat: la[m], lng: lo[m], tMid: cur[m].t });
    cur = [];
  };
  for (const f of fx) {
    if (cur.length && Math.floor(f.t / 300_000) !== Math.floor(cur[0].t / 300_000)) flush();
    cur.push(f);
  }
  flush();
  let startT = bins[0].t0;
  for (let i = bins.length - 1; i > 0; i--) {
    const dt = (bins[i].tMid - bins[i - 1].tMid) / 1000;
    const kn = dt > 0 ? (distM(bins[i - 1], bins[i]) / dt) * 1.94384 : 0;
    if (kn > UNDERWAY_KN) { startT = bins[i].t0; break; }
  }
  return fx.filter((f) => f.t >= startT);
}
