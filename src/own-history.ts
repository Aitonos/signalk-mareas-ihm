// Rev920: the own boat's true wind (speed and direction) and heading, one
// sample every 30 s for 24 h, kept by the backend. For the anchor estimate
// of other boats crossed with wind and tide, and to show how things were at
// any time of the track's time bar. Our own record, not KIP's history (KIP
// stores only what it charts, and the wind angle, not the direction).

export type OwnSample = {
  t: number;
  /** True wind speed, m/s. */
  tws: number | null;
  /** True wind direction (where it blows from), radians. */
  twd: number | null;
  /** True heading, radians. */
  hdg: number | null;
};

export const OWN_HIST_MS = 24 * 3600_000;
export const OWN_STEP_MS = 30_000;
const TWO_PI = 2 * Math.PI;

const norm = (r: number) => ((r % TWO_PI) + TWO_PI) % TWO_PI;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** True wind direction from what Signal K has: directionTrue, or the true
 *  heading plus the true wind angle relative to the bow. */
export function trueWindDirection(directionTrue: unknown, headingTrue: unknown, angleTrueWater: unknown): number | null {
  const d = num(directionTrue);
  if (d != null) return norm(d);
  const h = num(headingTrue), a = num(angleTrueWater);
  return h != null && a != null ? norm(h + a) : null;
}

/** True heading: headingTrue, or headingMagnetic plus the variation. */
export function trueHeading(headingTrue: unknown, headingMagnetic: unknown, magneticVariation: unknown): number | null {
  const h = num(headingTrue);
  if (h != null) return norm(h);
  const m = num(headingMagnetic), v = num(magneticVariation);
  return m != null ? norm(m + (v ?? 0)) : null;
}

export class OwnHistory {
  private samples: OwnSample[] = [];

  add(s: OwnSample): void {
    if (s.tws == null && s.twd == null && s.hdg == null) return;
    const last = this.samples[this.samples.length - 1];
    if (last && s.t - last.t < OWN_STEP_MS) return;
    this.samples.push(s);
    const cut = s.t - OWN_HIST_MS;
    if (this.samples[0].t < cut) this.samples = this.samples.filter((x) => x.t >= cut);
  }

  get(fromMs: number): OwnSample[] {
    return this.samples.filter((x) => x.t >= fromMs);
  }

  /** The sample nearest to t, if within maxGapMs. */
  at(t: number, maxGapMs = 2 * OWN_STEP_MS): OwnSample | null {
    let best: OwnSample | null = null, bd = Infinity;
    for (const x of this.samples) {
      const d = Math.abs(x.t - t);
      if (d < bd) { bd = d; best = x; }
    }
    return best && bd <= maxGapMs ? best : null;
  }

  toJSON(): OwnSample[] {
    return this.samples;
  }

  load(raw: unknown, now: number): void {
    if (!Array.isArray(raw)) return;
    this.samples = raw
      .filter((x: any) => x && Number.isFinite(x.t) && x.t >= now - OWN_HIST_MS && x.t <= now)
      .map((x: any) => ({ t: x.t, tws: num(x.tws), twd: num(x.twd), hdg: num(x.hdg) }))
      .sort((a, b) => a.t - b.t);
  }

  size(): number {
    return this.samples.length;
  }
}
