// Rev926: another boat's anchor from its track crossed with the own wind and
// the tidal stream. Physics and method reviewed with GPT and Gemini
// (docs/algoritmo_fondeo_revision_gpt_gemini_2026-11-21.md); prototype
// tested on OHANA's 24 h (R 15 m, anchor 2.7 m from anchor-mapper's).
//
// Under load the boat lies near R from the anchor, downstream of the
// resultant of wind and stream: position ≈ A + R · u. With one load
// direction only, A and R cannot be told apart, so the answer is then
// "zone" (where the boat has been), never a made-up ring.

export type Fix = { t: number; lat: number; lng: number };
export type WindSample = { t: number; tws: number | null; twd: number | null };
export type Extreme = { t: number; v: number; type: "High" | "Low" };

export type WindTideResult = {
  state: "estimated" | "zone" | "none";
  reason: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
  /** Directional spread of the load in the fitted bins, 0..1. */
  spread?: number;
  /** Median residual of the fit, metres. */
  medResM?: number;
  /** Flood-stream bearing (degrees) and stream-to-wind weight of the best fit. */
  floodDeg?: number;
  lambda?: number;
  bins?: number;
};

const D = Math.PI / 180;
const KN = 1.94384;
const BIN_MS = 300_000;
const HUBER_M = 8;
const NOISE_M = 6;          // class B noise after 5-min medians
const MIN_FIT_BINS = 10;
const MIN_SPREAD = 0.15;    // load directions must differ this much
const MAX_A_RANGE_M = 10;   // near-best solutions must agree on A ...
const MAX_R_RANGE_M = 5;    // ... and on R
const MIN_R_M = 10;         // below the AIS position noise: berth or buoy

function solve3(M: number[][], v: number[]): number[] | null {
  const a = M.map((r, i) => [...r, v[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    [a[i], a[p]] = [a[p], a[i]];
    if (Math.abs(a[i][i]) < 1e-9) return null;
    for (let k = i + 1; k < 3; k++) { const f = a[k][i] / a[i][i]; for (let c = i; c < 4; c++) a[k][c] -= f * a[i][c]; }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) { let s = a[i][3]; for (let c = i + 1; c < 3; c++) s -= a[i][c] * x[c]; x[i] = s / a[i][i]; }
  return x;
}

type Bin = { x: number; y: number; t: number; wx: number; wy: number; c: number };

/** Robust (Huber) fit of p = A + R·u over the bins. */
function irls(S: { x: number; y: number; ux: number; uy: number }[]): { Ax: number; Ay: number; R: number; medRes: number } | null {
  let w = S.map(() => 1), sol: number[] | null = null;
  for (let it = 0; it < 25; it++) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    S.forEach((b, i) => {
      for (const r of [[1, 0, b.ux, b.x], [0, 1, b.uy, b.y]]) {
        for (let a = 0; a < 3; a++) { v[a] += w[i] * r[a] * r[3]; for (let c = 0; c < 3; c++) M[a][c] += w[i] * r[a] * r[c]; }
      }
    });
    sol = solve3(M, v);
    if (!sol) return null;
    S.forEach((b, i) => { const e = Math.hypot(b.x - (sol![0] + sol![2] * b.ux), b.y - (sol![1] + sol![2] * b.uy)); w[i] = e <= HUBER_M ? 1 : HUBER_M / e; });
  }
  const res = S.map((b) => Math.hypot(b.x - (sol![0] + sol![2] * b.ux), b.y - (sol![1] + sol![2] * b.uy))).sort((a, b) => a - b);
  return { Ax: sol![0], Ay: sol![1], R: sol![2], medRes: res[Math.floor(res.length / 2)] };
}

/** Signed tidal-stream proxy: + flood, - ebb, ~1 at mid-tide of a 2.5 m range. */
export function streamProxy(t: number, ex: Extreme[]): number {
  for (let i = 0; i < ex.length - 1; i++) {
    if (t >= ex[i].t && t < ex[i + 1].t) {
      const f = (t - ex[i].t) / (ex[i + 1].t - ex[i].t);
      const s = Math.sin(Math.PI * f) * Math.abs(ex[i + 1].v - ex[i].v) / 2.5;
      return ex[i].type === "Low" ? s : -s;
    }
  }
  return 0;
}

export function estimateWindTide(fixes: Fix[], wind: WindSample[], extremes: Extreme[]): WindTideResult {
  if (fixes.length < 20) return { state: "none", reason: "few fixes" };
  const lat0 = fixes.reduce((s, f) => s + f.lat, 0) / fixes.length;
  const lng0 = fixes.reduce((s, f) => s + f.lng, 0) / fixes.length;
  const kx = 111320 * Math.cos(lat0 * D), ky = 111320;
  const ex = extremes.slice().sort((a, b) => a.t - b.t);
  const ws = wind.filter((w) => w.tws != null && w.twd != null).sort((a, b) => a.t - b.t);

  // 5-min bins: median position, own wind nearest in time (within 3 min).
  const groups = new Map<number, Fix[]>();
  for (const f of fixes) { const k = Math.floor(f.t / BIN_MS); (groups.get(k) ?? groups.set(k, []).get(k)!).push(f); }
  const bins: Bin[] = [];
  let wi = 0;
  for (const [k, g] of [...groups].sort((a, b) => a[0] - b[0])) {
    if (g.length < 2) continue;
    const la = g.map((f) => f.lat).sort((a, b) => a - b), lo = g.map((f) => f.lng).sort((a, b) => a - b);
    const m = Math.floor(g.length / 2), tMid = k * BIN_MS + BIN_MS / 2;
    while (wi < ws.length - 1 && Math.abs(ws[wi + 1].t - tMid) <= Math.abs(ws[wi].t - tMid)) wi++;
    const w = ws[wi];
    if (!w || Math.abs(w.t - tMid) > 180_000) continue;
    const down = (w.twd as number) + Math.PI, W = ((w.tws as number) * KN / 10) ** 2;
    bins.push({ x: (lo[m] - lng0) * kx, y: (la[m] - lat0) * ky, t: tMid, wx: W * Math.sin(down), wy: W * Math.cos(down), c: streamProxy(tMid, ex) });
  }
  if (bins.length < MIN_FIT_BINS) return { state: "none", reason: "few bins with wind", bins: bins.length };

  type Cand = { phi: number; lam: number; spread: number; Ax: number; Ay: number; R: number; medRes: number; score: number };
  const cands: Cand[] = [];
  for (let phi = 0; phi < 180; phi += 5) {
    const sx = Math.sin(phi * D), sy = Math.cos(phi * D);
    for (const lam of [0, 0.25, 0.5, 1, 2, 4, 8]) {
      const S = bins.map((b) => {
        const cc = lam * Math.sign(b.c) * b.c * b.c;
        const fx = b.wx + cc * sx, fy = b.wy + cc * sy, F = Math.hypot(fx, fy);
        return { x: b.x, y: b.y, ux: F ? fx / F : 0, uy: F ? fy / F : 0, F };
      });
      const Fs = S.map((s) => s.F).sort((a, b) => a - b), thr = Fs[Math.floor(Fs.length * 0.6)];
      const hi = S.filter((s) => s.F >= thr && s.F > 0.3);
      if (hi.length < MIN_FIT_BINS) continue;
      const mx = hi.reduce((a, s) => a + s.ux, 0) / hi.length, my = hi.reduce((a, s) => a + s.uy, 0) / hi.length;
      const m = irls(hi);
      if (!m || !(m.R > 0) || m.R > 150) continue;
      const d = S.map((s) => Math.hypot(s.x - m.Ax, s.y - m.Ay)).sort((a, b) => a - b);
      const p95 = d[Math.floor(d.length * 0.95)];
      cands.push({ phi, lam, spread: 1 - Math.hypot(mx, my), ...m, score: m.medRes + Math.max(0, p95 - (m.R + NOISE_M)) });
    }
  }
  if (!cands.length) return { state: "zone", reason: "no fit", bins: bins.length };
  cands.sort((a, b) => a.score - b.score);
  const best = cands[0];
  const near = cands.filter((c) => c.score <= best.score + 1);
  const span = (k: "Ax" | "Ay" | "R") => Math.max(...near.map((c) => c[k])) - Math.min(...near.map((c) => c[k]));
  const base = { spread: best.spread, medResM: best.medRes, floodDeg: best.phi, lambda: best.lam, bins: bins.length };
  if (best.spread < MIN_SPREAD) return { state: "zone", reason: "one load direction only", ...base };
  if (span("Ax") > MAX_A_RANGE_M || span("Ay") > MAX_A_RANGE_M || span("R") > MAX_R_RANGE_M) return { state: "zone", reason: "ambiguous", ...base };
  if (best.R < MIN_R_M) return { state: "zone", reason: "radius below position noise", ...base };
  return { state: "estimated", reason: "ok", lat: lat0 + best.Ay / ky, lng: lng0 + best.Ax / kx, radiusM: best.R, ...base };
}
