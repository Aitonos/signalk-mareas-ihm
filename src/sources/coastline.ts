// Coastline-based shelter auto-detection (Rev68, Capítulo 4B-2).
//
// Uses OpenStreetMap's Overpass API to fetch coastline geometry within a few
// nautical miles of the boat. For each of the 16 compass sectors, we mark it
// SHELTERED if any coastline point falls within `shelterDistNm` along that
// bearing — i.e. there's land upwind from that direction.
//
// Free public API, no key needed. Attribution: © OpenStreetMap contributors
// (already declared in the visor footer for the OSM tile layer).
//
// Tolerant to offline / Overpass downtime: returns null on any failure; the
// caller falls back to whatever mask is currently in anchor state.

import FileCache from "../cache.js";
import type { SignalKApp } from "../types.js";
import {
  type ShelterMask,
  dirDegToSectorIdx,
  SHELTER_SECTOR_COUNT,
  emptyShelterMask,
} from "./openmeteo.js";

// Rev69: Overpass mirrors. The main API often has 429/504 spikes; community
// mirrors share traffic. We try them in order, falling through on 5xx/timeout
// so the user gets a result whenever ANY mirror is up.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const OVERPASS_USER_AGENT = "signalk-mareas-ihm/1.3.1 (shelter-detector; +https://github.com/)";
const FETCH_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 h — coastline doesn't move

const NM_TO_DEG_LAT = 1 / 60;
function nmToDegLngAtLat(nm: number, lat: number): number {
  return nm / 60 / Math.cos((lat * Math.PI) / 180);
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1r = toRad(lat1), lat2r = toRad(lat2);
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(lat2r);
  const x = Math.cos(lat1r) * Math.sin(lat2r) -
            Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export interface PeakInfo {
  lat: number;
  lng: number;
  elevationM: number;
  name?: string;
  bearingDeg: number;     // from anchor to peak
  distanceNm: number;     // from anchor
  shelterRangeNm: number; // = elevationM / 100 nm (rule-of-thumb wind shadow)
}

export interface AutoShelterResult {
  mask: ShelterMask;
  pointsTotal: number;     // total coastline points returned by Overpass
  pointsInRange: number;   // points within shelterDistNm
  sectorsSheltered: number;// count of mask entries set to true
  shelterDistNm: number;
  origin: { lat: number; lng: number };
  fetchedAt: string;
  source: "overpass" | "cache" | "stale-cache";
  mirror?: string;         // which Overpass mirror succeeded (Rev69)
  /* Per-sector nearest-coastline distance in nautical miles (16 entries, ∞
     when no land in any direction within range). Rev71. */
  sectorDistNm?: number[];
  /* Rev74: peaks within the search bbox that contribute shelter via the
     wind-shadow extension. Each peak shelters within ~10× its elevation
     downwind, so a 100m hill shelters up to ~1 nm in its lee. */
  peaks?: PeakInfo[];
  /* Sectors that gained shelter ONLY from peaks (not from coastline) — useful
     debugging signal: "this sector is open water but a 200m hill shelters it". */
  sectorsByPeakOnly?: number[];
}

export interface AutoShelterError {
  ok: false;
  reason: string;          // human-readable
  attempts: { url: string; error: string; status?: number }[];
}

function cacheKey(lat: number, lng: number, distNm: number): string {
  // Round to ~500 m so a small drift reuses the cached coastline. Include
  // distance + algorithm version so a behaviour change forces a re-fetch.
  return `coastline_${ALGORITHM_VERSION}_${lat.toFixed(3)}_${lng.toFixed(3)}_d${distNm.toFixed(2)}`;
}

// Fetch from a single Overpass mirror via POST (body= query). POST avoids URL-
// length limits and triggers Overpass's "json" path correctly. Returns parsed
// JSON or throws with a structured Error (.status, .body).
async function overpassFetch(url: string, query: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": OVERPASS_USER_AGENT,
        "Accept": "application/json",
      },
      body: "data=" + encodeURIComponent(query),
      signal: controller.signal,
    });
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      const err: any = new Error(`HTTP ${res.status} ${res.statusText} ${body ? "| " + body : ""}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Rev70 → Rev72 → Rev75 → Rev327 (v76, publicado en NPM 2.1.10): algoritmo
// SIMPLE que el usuario valido en campo: si CUALQUIER land (coastline,
// breakwater, pier o groyne) cae a <= shelterDistNm en el rayo del sector,
// el sector es ABRIGADO. Sin dual-distance, sin land-mass criterion.
//
// Rev366 INTENTO FALLIDO: dual-distance scoring (v80/v81) introducido para
// "arreglar" un supuesto falso positivo en Bouzas — rompio la deteccion en
// Moaña (mezcla incorrecta de sectores). Revertido por feedback del usuario
// ("lo solucionamos en la version publicada y la cagamos al cambiarlo").
const DEFAULT_SHELTER_DIST_NM = 0.3;          // 0.3 nm ~ 556 m. Threshold simple "hay tierra cerca".
const ALGORITHM_VERSION = "v82";  // Rev367: revert a logica v76 simple (publicada). Invalida v80/v81.

export async function detectShelterFromCoastline(
  lat: number,
  lng: number,
  cache: FileCache,
  app?: SignalKApp,
  shelterDistNm: number = DEFAULT_SHELTER_DIST_NM,
): Promise<AutoShelterResult | AutoShelterError> {
  const key = cacheKey(lat, lng, shelterDistNm);

  // Serve from fresh cache if available.
  const cached = (await cache.get(key)) as AutoShelterResult | undefined;
  if (cached?.fetchedAt) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < CACHE_TTL_MS) {
      app?.debug?.(`[IHM-SHELTER-AUTO] cache hit (${(ageMs / 60000) | 0} min old)`);
      return { ...cached, source: "cache" };
    }
  }

  // BBox around the anchor — bastante para capturar coastline candidatas.
  // Rev367: revertido al bbox simple = shelterDistNm. La extension a 2nm de
  // Rev359 era para el dual-distance scoring que no funcionaba bien; lo
  // quitamos.
  const dLat = shelterDistNm * NM_TO_DEG_LAT;
  const dLng = nmToDegLngAtLat(shelterDistNm, lat);
  const minLat = lat - dLat, maxLat = lat + dLat;
  const minLng = lng - dLng, maxLng = lng + dLng;

  // Rev74: also query peaks within a WIDER bbox (3 nm) so a 200m hill 1.5 nm
  // inland still contributes shelter to its lee. Wind shadow from a peak of
  // elevation H extends roughly 10×H downwind (rule of thumb), so a 200m peak
  // shelters up to ~2 km / 1.1 nm downwind. We use 3 nm to be safe.
  const PEAK_SEARCH_NM = 3.0;
  const dpLat = PEAK_SEARCH_NM * NM_TO_DEG_LAT;
  const dpLng = nmToDegLngAtLat(PEAK_SEARCH_NM, lat);
  const pMinLat = lat - dpLat, pMaxLat = lat + dpLat;
  const pMinLng = lng - dpLng, pMaxLng = lng + dpLng;

  // Rev327 (feedback Pablo en Vigo marina 42.242,-8.724):
  // El query original SOLO buscaba `natural=coastline`. En marinas/puertos,
  // los espigones que realmente protegen del oleaje están etiquetados como
  // `man_made=breakwater` (escollera/dique exterior, SÓLIDO) o
  // `man_made=groyne` (espigón perpendicular SÓLIDO). Estos atenúan oleaje
  // como un muro.
  // Rev332 (fix Rev327): `man_made=pier` (pantalanes de pilotes/madera) NO
  // son obstáculos sólidos — el oleaje pasa entre los pilotes con poca
  // atenuación. Tratarlos como sólidos daba FALSOS POSITIVOS gravísimos:
  // el usuario reportó su puerto (Vigo 42.27,-8.73) con escollera REAL
  // dando 100% protección porque el sistema "veía" pantalanes como muros
  // que cubrían sectores adicionales. Eliminamos `man_made=pier` del query.
  // Mantenemos breakwater + groyne que son los obstáculos REALES al oleaje.
  // One combined Overpass query — saves a round-trip and shares the timeout.
  // bbox order: south, west, north, east.
  const bboxStr = `${minLat.toFixed(5)},${minLng.toFixed(5)},${maxLat.toFixed(5)},${maxLng.toFixed(5)}`;
  const query =
    `[out:json][timeout:25];` +
    `(` +
      `way["natural"="coastline"](${bboxStr});` +
      `way["man_made"="breakwater"](${bboxStr});` +
      `way["man_made"="groyne"](${bboxStr});` +
      `node["natural"="peak"]["ele"](${pMinLat.toFixed(5)},${pMinLng.toFixed(5)},${pMaxLat.toFixed(5)},${pMaxLng.toFixed(5)});` +
    `);out geom;`;

  // Iterate mirrors until one succeeds or all fail.
  let data: any = null;
  let successUrl = "";
  const attempts: { url: string; error: string; status?: number }[] = [];
  for (const url of OVERPASS_MIRRORS) {
    try {
      app?.debug?.(`[IHM-SHELTER-AUTO] trying ${url}`);
      data = await overpassFetch(url, query);
      successUrl = url;
      break;
    } catch (e: any) {
      attempts.push({ url, error: e?.message || String(e), status: e?.status });
      app?.debug?.(`[IHM-SHELTER-AUTO] ${url} failed: ${e?.message}`);
      // On 429 (rate limit) or 504 (timeout) try next mirror immediately.
      // On other errors also try next — there's nothing to lose.
    }
  }

  if (!data) {
    // All mirrors failed. Fall back to stale cache if any.
    if (cached) {
      app?.debug?.(`[IHM-SHELTER-AUTO] all mirrors down, serving stale cache (${attempts.length} attempts)`);
      return { ...cached, source: "stale-cache" };
    }
    return {
      ok: false,
      reason: `All ${OVERPASS_MIRRORS.length} Overpass mirrors failed`,
      attempts,
    };
  }

  // Rev71: switched from "any coastline POINT in sector bearing" to RAY-
  // CASTING against coastline SEGMENTS. Previous approach failed in
  // ría/marina cases where the coast curves: e.g. boat in Moaña marina with
  // a mountain to the NW, the closest coastline points were east-west
  // running and never lined up with the NW bearing, so NW was marked
  // exposed despite obvious shelter. Ray-casting against segments correctly
  // detects "the next bit of land I'd hit going in direction X".
  //
  // Approach: collect all consecutive coastline segments (P1,P2) in local
  // metres relative to the anchor. For each of the 16 sector centres, cast
  // 3 rays (centre + ±8°) and find the minimum hit distance. If any hit
  // lands within shelterDistNm, the sector is sheltered.
  const mask = emptyShelterMask();
  const minSectorDistM: number[] = new Array(SHELTER_SECTOR_COUNT).fill(Infinity);
  const maxDistM = shelterDistNm * 1852;
  const latM = 111320;
  const lngM = 111320 * Math.cos((lat * Math.PI) / 180);
  // Returns ray-segment intersection distance along the ray (meters), or null.
  // Anchor sits at the origin (0,0) in local meters. Ray direction is clockwise
  // from north (clock-face angle): rx = sin(θ), ry = cos(θ).
  function rayHit(thetaDeg: number, p1x: number, p1y: number, p2x: number, p2y: number): number | null {
    const t = (thetaDeg * Math.PI) / 180;
    const rx = Math.sin(t), ry = Math.cos(t);
    const sx = p2x - p1x, sy = p2y - p1y;
    const denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-9) return null;
    const tt = (p1x * sy - p1y * sx) / denom;
    const uu = (p1x * ry - p1y * rx) / denom;
    if (tt > 0 && uu >= -0.01 && uu <= 1.01) return tt;
    return null;
  }
  let pointsTotal = 0;
  let pointsInRange = 0;
  // Pre-convert all way geometries to local meters once.
  const wayLocals: { x: number; y: number }[][] = [];
  if (Array.isArray(data?.elements)) {
    for (const el of data.elements) {
      if (el?.type === "way" && Array.isArray(el.geometry)) {
        const localPts: { x: number; y: number }[] = [];
        for (const pt of el.geometry) {
          if (typeof pt.lat !== "number" || typeof pt.lon !== "number") continue;
          pointsTotal++;
          const x = (pt.lon - lng) * lngM;
          const y = (pt.lat - lat) * latM;
          const distM = Math.hypot(x, y);
          if (distM <= maxDistM) pointsInRange++;
          localPts.push({ x, y });
        }
        if (localPts.length >= 2) wayLocals.push(localPts);
      }
    }
  }
  // Per-sector ray cast: centre + offsets covering the sector's 22.5° width.
  // Rev367: RESTAURADO al algoritmo v76 (Rev327) publicado en NPM 2.1.10.
  // Logica simple: si CUALQUIER land (coastline/breakwater/pier/groyne) cae
  // dentro de shelterDistNm en el rayo del sector, el sector es ABRIGADO.
  //
  // El intento de "dual-distance / land-mass scoring" (v80/v81) introducido
  // en Rev359-366 para "arreglar" un supuesto falso positivo en Bouzas
  // ROMPIO la deteccion en Moaña. Feedback del usuario: "lo solucionamos
  // en la version publicada y la cagamos al cambiarlo". Volvemos a lo
  // simple y robusto.
  const angleOffsets = [-8, 0, 8];
  const sectorDiag: Array<{ idx: number; ang: number; minHit: number; decision: "SHELTERED" | "EXPOSED" }> = [];
  for (let i = 0; i < SHELTER_SECTOR_COUNT; i++) {
    const baseAng = i * 22.5;
    let minHit = Infinity;
    for (const off of angleOffsets) {
      const ang = baseAng + off;
      for (const pts of wayLocals) {
        for (let j = 0; j < pts.length - 1; j++) {
          const d = rayHit(ang, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
          if (d !== null && d < minHit) minHit = d;
        }
      }
    }
    minSectorDistM[i] = minHit;
    if (minHit <= maxDistM) mask[i] = true;
    sectorDiag.push({ idx: i, ang: baseAng, minHit: Math.round(minHit), decision: mask[i] ? "SHELTERED" : "EXPOSED" });
  }
  // Rev367: diagnostico simple (journalctl -u signalk).
  try {
    app?.debug?.(`[IHM-SHELTER-AUTO] simple-distance scoring (threshold=${maxDistM}m):`);
    for (const d of sectorDiag) {
      app?.debug?.(`  sec ${String(d.idx).padStart(2)} (${String(d.ang).padStart(5)}°): ${d.decision.padEnd(9)} minHit=${d.minHit === Infinity ? "none" : d.minHit + "m"}`);
    }
  } catch { /* non-critical */ }

  // Rev75: stricter peak shelter, replacing the lax Rev74 logic.
  // Wind shadow range = elevationM / 185 nm (≈ 10× height physical rule).
  //   100m hill → 0.54 nm shadow
  //   200m hill → 1.08 nm shadow
  //   400m hill → 2.16 nm shadow
  // PLUS line-of-sight test: a peak only shelters its sector if there's
  // ALREADY land between boat and peak in the same bearing (otherwise wind
  // crosses open water and reforms before reaching the peak).
  // PLUS no lateral spillover — only the peak's own sector benefits.
  const peaks: PeakInfo[] = [];
  const sectorsByPeakOnly: number[] = [];
  if (Array.isArray(data?.elements)) {
    for (const el of data.elements) {
      if (el?.type === "node" && el.tags && el.tags.natural === "peak") {
        const elev = parseFloat(String(el.tags.ele).replace(/[^\d.]/g, ""));
        if (!isFinite(elev) || elev <= 0) continue;
        if (typeof el.lat !== "number" || typeof el.lon !== "number") continue;
        const d = haversineNm(lat, lng, el.lat, el.lon);
        const b = bearingDeg(lat, lng, el.lat, el.lon);
        const sr = elev / 185;     // shelter range in nm (Rev75 physical)
        peaks.push({
          lat: el.lat,
          lng: el.lon,
          elevationM: elev,
          name: el.tags.name,
          bearingDeg: +b.toFixed(1),
          distanceNm: +d.toFixed(2),
          shelterRangeNm: +sr.toFixed(2),
        });
        if (d > sr) continue;  // peak too far to shelter
        // Line-of-sight: there must be coastline between boat and peak.
        // We compute the closest coastline ray hit at this bearing — if it's
        // closer than the peak, land sits between us and the peak → wind is
        // truly blocked. If no coastline hit OR coastline is beyond the
        // peak, the path crosses open water and wind reforms — skip.
        const peakDistM = d * 1852;
        let coastHitAtBearing = Infinity;
        const bRad = (b * Math.PI) / 180;
        const rx = Math.sin(bRad), ry = Math.cos(bRad);
        for (const pts of wayLocals) {
          for (let j = 0; j < pts.length - 1; j++) {
            const p1 = pts[j], p2 = pts[j + 1];
            const sx = p2.x - p1.x, sy = p2.y - p1.y;
            const denom = rx * sy - ry * sx;
            if (Math.abs(denom) < 1e-9) continue;
            const tt = (p1.x * sy - p1.y * sx) / denom;
            const uu = (p1.x * ry - p1.y * rx) / denom;
            if (tt > 0 && uu >= -0.01 && uu <= 1.01 && tt < coastHitAtBearing) {
              coastHitAtBearing = tt;
            }
          }
        }
        if (coastHitAtBearing < peakDistM) {
          // LoS through land confirmed — peak shelters its sector only.
          const idx = dirDegToSectorIdx(b);
          if (!mask[idx]) {
            mask[idx] = true;
            if (!sectorsByPeakOnly.includes(idx)) sectorsByPeakOnly.push(idx);
          }
        }
      }
    }
  }

  const sectorsSheltered = mask.filter(Boolean).length;
  const sectorDistNm = minSectorDistM.map(m => isFinite(m) ? +(m / 1852).toFixed(2) : Infinity);
  const result: AutoShelterResult = {
    mask,
    pointsTotal,
    pointsInRange,
    sectorsSheltered,
    shelterDistNm,
    origin: { lat, lng },
    fetchedAt: new Date().toISOString(),
    source: "overpass",
    mirror: successUrl,
    sectorDistNm,
    peaks,
    sectorsByPeakOnly,
  };
  try { await cache.set(key, result); } catch { /* non-critical */ }
  app?.debug?.(`[IHM-SHELTER-AUTO] detected: ${sectorsSheltered}/${SHELTER_SECTOR_COUNT} sectors sheltered (${pointsInRange}/${pointsTotal} pts) via ${successUrl}`);
  return result;
}

// Type guard for the result types
export function isAutoShelterError(x: AutoShelterResult | AutoShelterError | null): x is AutoShelterError {
  return !!x && (x as AutoShelterError).ok === false;
}

// Rev146 (audit fix): eliminada `maskCoherence()` — exportada pero sin
// callers en ningún módulo. Si la necesitas en el futuro para comparar
// máscaras manual vs auto, recupéralo desde git.
