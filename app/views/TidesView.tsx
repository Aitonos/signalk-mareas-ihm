import React, { useEffect, useLayoutEffect, useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTideData, VITE_SIGNALK_URL } from "../hooks/useTideData";
import { useStationRef } from "../hooks/useStationRef";
import { useContainerDimensions } from "../hooks/useContainerDimensions";

const STATIONS_URL = new URL("/signalk-mareas-ihm/api/stations", VITE_SIGNALK_URL).toString();
const MANUAL_URL = new URL("/signalk-mareas-ihm/api/manual", VITE_SIGNALK_URL).toString();
const ALARMA_URL = new URL("/signalk-mareas-ihm/api/alarma", VITE_SIGNALK_URL).toString();
const SNOOZE_URL = new URL("/signalk-mareas-ihm/api/snooze", VITE_SIGNALK_URL).toString();
const ALARMA_OFF_URL = new URL("/signalk-mareas-ihm/api/alarma/off", VITE_SIGNALK_URL).toString();
const SETTINGS_URL = new URL("/signalk-mareas-ihm/api/settings", VITE_SIGNALK_URL).toString();
const ANCHOR_CFG_URL = new URL("/signalk-mareas-ihm/api/anchor/config", VITE_SIGNALK_URL).toString();
const ANCHOR_CALC_URL = new URL("/signalk-mareas-ihm/api/anchor/calc", VITE_SIGNALK_URL).toString();

function fmtHHMMFromIso(iso: string | undefined): string {
  if (!iso) return "–";
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return "–";
  return `${m[1]}:${m[2]}`;
}

function getOffsetMinutesFromIso(iso: string | undefined): number | null {
  if (!iso) return null;
  // Expect ISO 8601 with timezone offset, e.g. 2026-02-08T12:34:56+00:00 or ...Z
  const m = iso.match(/([+-])(\d{2}):(\d{2})\s*$/) || iso.match(/Z\s*$/);
  if (!m) return null;
  if (m[0].trim() === "Z") return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return sign * (hh * 60 + mm);
}

function fmtNowByStationOffset(now: Date, stationSampleIso: string | undefined): string | null {
  const offMin = getOffsetMinutesFromIso(stationSampleIso);
  if (offMin == null) return null;
  // Shift UTC "now" by station offset, then read shifted time as UTC clock.
  const shifted = new Date(now.getTime() + offMin * 60_000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function fmtIsoUtcByStationOffset(isoUtc: string | undefined, stationSampleIso: string | undefined): string {
  if (!isoUtc) return "–";
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "–";
  return fmtNowByStationOffset(d, stationSampleIso) ?? fmtHHMMFromIso(isoUtc);
}

function fmtDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(".", ",");
}

// Rev431: helper top-level para formato de altura de marea segun units configurados.
// Devuelve "X,XX m" (metric) o "X.XX ft" (imperial). Util tanto en TidesView
// principal como en sub-componentes (TideChartModal). Pasado como prop a sub.
function makeFmtTideHeight(units: string): (m: number | null | undefined, decimals?: number) => string {
  const isImperial = (units || "metric_nautical").indexOf("imperial") === 0;
  return (m, decimals = 2) => {
    if (m == null || !Number.isFinite(m)) return "–";
    if (isImperial) return (m * 3.28084).toFixed(decimals) + " ft";
    return m.toFixed(decimals).replace(".", ",") + " m";
  };
}

function easeSine(progress: number) {
  return (1 - Math.cos(progress * Math.PI)) / 2;
}

function approximateTideHeightAt(extremes: { time: string; value: number }[], time: Date): number | null {
  if (!Array.isArray(extremes) || extremes.length < 2) return null;
  const sorted = extremes.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const prev = sorted.filter((h) => new Date(h.time) <= time).pop();
  const next = sorted.find((h) => new Date(h.time) >= time);
  if (!prev || !next) return null;
  const span = new Date(next.time).getTime() - new Date(prev.time).getTime();
  const progress = span > 0 ? (time.getTime() - new Date(prev.time).getTime()) / span : 0;
  return prev.value + (next.value - prev.value) * easeSine(Math.max(0, Math.min(1, progress)));
}

function findPrevNext(extremes: { time: string; value: number; type?: string }[], now: Date) {
  const sorted = extremes.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const prevArr = sorted.filter((e) => new Date(e.time) <= now);
  const nextArr = sorted.filter((e) => new Date(e.time) > now);
  return { prev: prevArr.pop(), next: nextArr[0], sorted };
}

type StationInfo = { id: string; name: string; inRange?: boolean; distance?: number | null; tz?: string; synthetic?: boolean };

// ===== v1.129: TIDE CHART MODAL =====
function TideChartModal({ extremes, now, heightNow, riskTimeIso, stationSampleIso, stationName, onClose, tr, fmtH }: {
  extremes: { time: string; value: number; type?: string }[];
  now: Date;
  heightNow: number;
  riskTimeIso?: string | null;
  stationSampleIso?: string;
  stationName?: string;
  onClose: () => void;
  tr: (es: string, en: string) => string;
  fmtH: (m: number | null | undefined, decimals?: number) => string;
}) {
  const [cursor, setCursor] = useState<{ x: number; time: Date; height: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const sorted = useMemo(() =>
    extremes.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [extremes]
  );

  // Format time in local (using station offset)
  const fmtLocal = useCallback((ms: number) => {
    const offMin = getOffsetMinutesFromIso(stationSampleIso);
    const shifted = new Date(ms + (offMin ?? 0) * 60000);
    const hh = String(shifted.getUTCHours()).padStart(2, "0");
    const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [stationSampleIso]);

  // v1.128: X scale proportional to low/high extremes, +1 extreme margin each side
  const { rangeStart, rangeEnd, visibleExtremes } = useMemo(() => {
    const nowMs = now.getTime();
    const before = sorted.filter(e => new Date(e.time).getTime() <= nowMs);
    const after = sorted.filter(e => new Date(e.time).getTime() > nowMs);
    // +1 extra each side for margin
    const vis = [...before.slice(-3), ...after.slice(0, 4)];
    if (vis.length < 2) return { rangeStart: nowMs - 12*3600000, rangeEnd: nowMs + 12*3600000, visibleExtremes: vis };
    const first = new Date(vis[0].time).getTime();
    const last = new Date(vis[vis.length - 1].time).getTime();
    return { rangeStart: first, rangeEnd: last, visibleExtremes: vis };
  }, [sorted, now]);

  const curvePoints = useMemo(() => {
    const pts: { t: number; h: number }[] = [];
    const step = 5 * 60000;
    for (let t = rangeStart; t <= rangeEnd; t += step) {
      const h = approximateTideHeightAt(sorted, new Date(t));
      if (h != null) pts.push({ t, h });
    }
    return pts;
  }, [sorted, rangeStart, rangeEnd]);

  const W = 600, H = 320, PAD_L = 50, PAD_R = 15, PAD_T = 25, PAD_B = 40;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allH = curvePoints.map(p => p.h);
  const hMin = Math.floor((Math.min(...allH) - 0.3) * 10) / 10;
  const hMax = Math.ceil((Math.max(...allH) + 0.3) * 10) / 10;
  const toY = (h: number) => PAD_T + plotH - ((h - hMin) / (hMax - hMin)) * plotH;
  const toX = (t: number) => PAD_L + ((t - rangeStart) / (rangeEnd - rangeStart)) * plotW;

  const pathD = curvePoints.map((p, i) =>
    `${i === 0 ? "M" : "L"}${toX(p.t).toFixed(1)},${toY(p.h).toFixed(1)}`
  ).join(" ");

  // Time grid: at each extreme
  const timeGrids = visibleExtremes.map(e => new Date(e.time).getTime());

  const hGrids: number[] = [];
  for (let h = Math.ceil(hMin * 2) / 2; h <= hMax; h += 0.5) hGrids.push(h);

  // Risk time text
  const riskTimeLocal = riskTimeIso ? fmtLocal(new Date(riskTimeIso).getTime()) : null;

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const cx = (e.clientX - rect.left) * scaleX;
    const t = rangeStart + ((cx - PAD_L) / plotW) * (rangeEnd - rangeStart);
    if (t < rangeStart || t > rangeEnd) { setCursor(null); return; }
    const h = approximateTideHeightAt(sorted, new Date(t));
    if (h != null) setCursor({ x: cx, time: new Date(t), height: h });
  };

  const nowX = toX(now.getTime());
  const nowY = toY(heightNow);

  return (
    <div className="tide-chart-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tide-chart-container">
        <div className="tide-chart-header">
          <div className="tide-chart-title-block">
            <span className="tide-chart-title">{tr("Curva de Mareas", "Tide Curve")}{stationName ? ` — ${stationName}` : ""}</span>
            <span className="tide-chart-subtitle">{tr("Creada el", "Generated on")} {now.toLocaleDateString()} {tr("a las", "at")} {fmtLocal(now.getTime())}</span>
          </div>
          <button className="tide-chart-close" onClick={onClose}>✕</button>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="tide-chart-svg"
          onPointerMove={handlePointer} onPointerLeave={() => setCursor(null)} style={{ touchAction: "none" }}>
          <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="#f8f9fa" stroke="#ddd" />

          {hGrids.map(h => (
            <g key={h}>
              <line x1={PAD_L} y1={toY(h)} x2={W - PAD_R} y2={toY(h)} stroke="#e0e0e0" strokeWidth="0.5" />
              <text x={PAD_L - 5} y={toY(h) + 3.5} textAnchor="end" fontSize="10" fill="#666">{fmtH(h, 1)}</text>
            </g>
          ))}

          {timeGrids.map((t, i) => (
            <g key={i}>
              <line x1={toX(t)} y1={PAD_T} x2={toX(t)} y2={H - PAD_B} stroke="#e8e8e8" strokeWidth="0.5" />
              <text x={toX(t)} y={H - PAD_B + 14} textAnchor="middle" fontSize="9" fill="#999">{fmtLocal(t)}</text>
            </g>
          ))}

          {/* Tide curve */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />

          {/* NOW vertical line + dynamic label */}
          <line x1={nowX} y1={PAD_T} x2={nowX} y2={H - PAD_B} stroke="#333" strokeWidth="1.2" strokeDasharray="4,2" />
          <circle cx={nowX} cy={nowY} r="4.5" fill="#333" stroke="#fff" strokeWidth="1" />
          <rect x={nowX - 70} y={Math.max(PAD_T, nowY - 34)} width="140" height="24" rx="4" fill="rgba(0,0,0,0.8)" />
          <text x={nowX} y={Math.max(PAD_T + 15, nowY - 18)} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="bold">
            {tr("AHORA", "NOW")}: {fmtLocal(now.getTime())} {fmtH(heightNow, 2)}
          </text>

          {/* Extreme dots */}
          {visibleExtremes.map((e, i) => {
            const t = new Date(e.time).getTime();
            const isHigh = e.type?.toLowerCase() === "high";
            return (
              <g key={i}>
                <circle cx={toX(t)} cy={toY(e.value)} r="5" fill={isHigh ? "#28a745" : "#dc3545"} stroke="#fff" strokeWidth="1.5" />
                <text x={toX(t)} y={toY(e.value) + (isHigh ? -10 : 14)} textAnchor="middle" fontSize="9" fontWeight="bold" fill={isHigh ? "#28a745" : "#dc3545"}>
                  {fmtH(e.value, 2)} {fmtLocal(t)}
                </text>
              </g>
            );
          })}

          {/* Cursor */}
          {cursor && (
            <g>
              <line x1={cursor.x} y1={PAD_T} x2={cursor.x} y2={H - PAD_B} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" />
              <circle cx={cursor.x} cy={toY(cursor.height)} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
              <rect x={Math.min(Math.max(cursor.x - 45, PAD_L), W - PAD_R - 95)} y={toY(cursor.height) - 28} width="95" height="20" rx="3" fill="rgba(0,0,0,0.85)" />
              <text x={Math.min(Math.max(cursor.x, PAD_L + 48), W - PAD_R - 48)} y={toY(cursor.height) - 13} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">
                {fmtLocal(cursor.time.getTime())} — {fmtH(cursor.height, 2)}
              </text>
            </g>
          )}

          {/* v1.128: Grounding risk warning box (top-left, no line) */}
          {riskTimeLocal && (
            <g>
              <rect x={PAD_L + 4} y={PAD_T + 4} width="170" height="22" rx="4" fill="rgba(220,53,69,0.9)" />
              <text x={PAD_L + 10} y={PAD_T + 19} fontSize="10" fill="#fff" fontWeight="bold">
                ⚠ {tr("Riesgo varada a las", "Risk at")} {riskTimeLocal}
              </text>
            </g>
          )}

          <text x={W / 2} y={H - 3} textAnchor="middle" fontSize="10" fill="#999">{tr("Hora local", "Local time")}</text>
          <text x={12} y={H / 2} textAnchor="middle" fontSize="10" fill="#999" transform={`rotate(-90,12,${H / 2})`}>{tr("Altura (m)", "Height (m)")}</text>
        </svg>
      </div>
    </div>
  );
}
interface AlarmaConfig { enabled: boolean; alertOnArrival: boolean; alertBeforeGrounding: boolean; minutesBefore: number; safetyMargin: number; soundMuted: boolean; }
interface GroundingRisk { risk: boolean; timeUntil?: number; message?: string; effectiveDraft?: number; physicalRisk?: boolean; }

// ─── SVG components (module-level: no re-creation on render → less GC / GPU) ───

// Pez Payaso (Nemo) — bandas blancas verticales, cola en V base-fuera
const ClownFish = ({ color, darkColor }: { color: string; darkColor: string }) => (
  <svg viewBox="0 0 52 30" width="52" height="30" fill="none">
    <path d="M2,6 L12,15 L2,24" fill={color} opacity="0.8" stroke={color} strokeWidth="0.5" strokeLinejoin="round"/>
    <ellipse cx="28" cy="15" rx="20" ry="12" fill={color}/>
    <rect x="19" y="4" width="3.5" height="22" rx="1.8" fill="#fff" opacity="0.85"/>
    <rect x="31" y="6" width="3.5" height="18" rx="1.8" fill="#fff" opacity="0.85"/>
    <ellipse cx="28" cy="19" rx="15" ry="5" fill="#fff" opacity="0.12"/>
    <path d={`M24 3 Q28 7 32 3`} fill={darkColor} opacity="0.6"/>
    <circle cx="40" cy="12" r="3.2" fill="#fff"/><circle cx="40.7" cy="11.5" r="1.9" fill="#222"/><circle cx="41.2" cy="10.8" r="0.6" fill="#fff"/>
    <path d="M46 15 Q48 16 46 17" stroke="#333" strokeWidth="0.8" fill="none"/>
  </svg>
);

// Pez Mariposa (Butterflyfish) — banda oscura sobre ojo, aletas dorsal+ventral, cola en V base-fuera
const ButterflyFish = ({ color, darkColor }: { color: string; darkColor: string }) => (
  <svg viewBox="0 0 54 32" width="54" height="32" fill="none">
    <path d="M2,7 L12,16 L2,25" fill={color} opacity="0.8" stroke={color} strokeWidth="0.5" strokeLinejoin="round"/>
    <ellipse cx="29" cy="16" rx="21" ry="13" fill={color}/>
    <ellipse cx="29" cy="20" rx="16" ry="6" fill="#fff" opacity="0.12"/>
    <path d={`M25 3 Q29 8 33 3`} fill={darkColor} opacity="0.7"/>
    <path d={`M25 29 Q29 24 33 29`} fill={darkColor} opacity="0.7"/>
    <path d="M39 4 Q41 16 39 28" stroke="#222" strokeWidth="3.5" fill="none" opacity="0.55"/>
    <path d="M18 11 Q24 15 18 19" stroke="#fff" strokeWidth="0.7" fill="none" opacity="0.2"/>
    <path d="M24 9 Q30 13 24 17" stroke="#fff" strokeWidth="0.7" fill="none" opacity="0.15"/>
    <circle cx="40" cy="12" r="3.5" fill="#fff"/><circle cx="40.8" cy="11.5" r="2" fill="#222"/><circle cx="41.3" cy="10.8" r="0.7" fill="#fff"/>
    <path d="M48 16 Q50 17 48 18" stroke="#333" strokeWidth="0.8" fill="none"/>
  </svg>
);

// 5 peces: 2 Nemo (B) + 3 Butterflyfish (C)
const FISH_ELEMENTS = [
  <ClownFish key="f0" color="#FF5722" darkColor="#BF360C" />,
  <ClownFish key="f1" color="#FFCA28" darkColor="#F57F17" />,
  <ButterflyFish key="f2" color="#26C6DA" darkColor="#00838F" />,
  <ButterflyFish key="f3" color="#AB47BC" darkColor="#6A1B9A" />,
  <ButterflyFish key="f4" color="#66BB6A" darkColor="#2E7D32" />,
];

const CrabSvg = () => (
  <svg viewBox="0 0 40 32" width="40" height="32" fill="none">
    <ellipse cx="20" cy="18" rx="12" ry="9" fill="#E53935"/>
    <ellipse cx="20" cy="18" rx="10" ry="7" fill="#EF5350"/>
    <circle cx="14" cy="9" r="4" fill="#E53935"/><circle cx="26" cy="9" r="4" fill="#E53935"/>
    <circle cx="14" cy="8" r="2" fill="#fff"/><circle cx="14.4" cy="7.8" r="1" fill="#222"/>
    <circle cx="26" cy="8" r="2" fill="#fff"/><circle cx="26.4" cy="7.8" r="1" fill="#222"/>
    <path d="M5 14 Q2 10 4 7" stroke="#E53935" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M35 14 Q38 10 36 7" stroke="#E53935" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M8 20 Q4 22 3 25" stroke="#E53935" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M32 20 Q36 22 37 25" stroke="#E53935" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M11 24 Q9 27 8 30" stroke="#E53935" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M29 24 Q31 27 32 30" stroke="#E53935" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);

// Sol SVG — preparado para intercambiar con icono de clima en v2
const WeatherIcon = () => (
  <svg className="tide-sun" viewBox="0 0 42 42" width="42" height="42" style={{position:'absolute',top:4,left:12}}>
    <circle cx="21" cy="21" r="9" fill="#FFD700"/>
    {[0,45,90,135,180,225,270,315].map((a) => (
      <line key={a} x1="21" y1="21"
        x2={21+17*Math.cos(a*Math.PI/180)} y2={21+17*Math.sin(a*Math.PI/180)}
        stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round"/>
    ))}
  </svg>
);

// 4 cangrejos (reducido de 6 para aliviar GPU)
const CRAB_POSITIONS = [
  { id: 0, leftPct: 15, topPct: 22 },
  { id: 1, leftPct: 50, topPct: 18 },
  { id: 2, leftPct: 82, topPct: 35 },
  { id: 3, leftPct: 35, topPct: 55 },
];

// Rev150: auto-reload del browser cuando el backend se redeploya. Sondea
// /api/build-info cada 20 s. La primera lectura fija el "buildTag" actual;
// si una lectura posterior trae un buildTag distinto → location.reload().
// Idea: el usuario hace .\deploy.ps1 -Restart, el plugin renace con un nuevo
// timestamp en build-info.json, y los navegadores abiertos lo cogen sin
// pedirle al usuario que dé F5 manualmente.
function useAutoReloadOnBuildChange() {
  useEffect(() => {
    let knownTag: string | null = null;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch("/signalk-mareas-ihm/api/build-info", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const tag = String(j?.buildTag ?? "");
        if (!tag) return;
        if (knownTag === null) { knownTag = tag; return; }
        if (cancelled) return;
        if (tag !== knownTag) {
          window.location.reload();
        }
      } catch { /* network blip — try again next tick */ }
    };
    poll();
    const id = window.setInterval(poll, 20_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);
}

export default function TidesView() {
  type UiLang = "en" | "es";
  type UnitSystem = "metric" | "metric_nautical" | "imperial_us" | "imperial_us_nautical" | "imperial_uk" | "imperial_uk_nautical";
  const [lang, setLang] = useState<UiLang>("es");
  const [units, setUnits] = useState<UnitSystem>("metric_nautical");
  // Rev431: helper de formato de altura (m / ft) consistente con visor mobile.
  const fmtTideHeight = useMemo(() => makeFmtTideHeight(units), [units]);
  const isImperialUnits = units.indexOf("imperial") === 0;
  const labelDepth = isImperialUnits ? "ft" : "m";
  useAutoReloadOnBuildChange();
  const { snapshot, forecast, error, refetch } = useTideData(30);
  const [allStations, setAllStations] = useState<StationInfo[]>([]);
  const [nearbyStations, setNearbyStations] = useState<StationInfo[]>([]);
  const [manualOverride, setManualOverride] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [favoriteStationId, setFavoriteStationId] = useState("");
  const [activeStationId, setActiveStationId] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);
  const refreshStartTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const expectedStationRef = useRef<string>("");
  
  // Dropdown custom
  const [stationDropdownOpen, setStationDropdownOpen] = useState(false);
  const [autoPickCountdown, setAutoPickCountdown] = useState<number | null>(null);
  const autoPickTimerRef = useRef<number | null>(null);

  
  // Modales
  const [showAvisoLegal, setShowAvisoLegal] = useState(false);
  /* Rev244: auto-abrir modal Instrucciones si se carga con
     ?showInstructions=1 (lanzado desde el botón "Instrucciones" del menú
     Hamburger del visor). */
  const [showInstrucciones, setShowInstrucciones] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("showInstructions") === "1";
    } catch { return false; }
  });
  const [showChangelog, setShowChangelog] = useState(false);
  /* Rev522: changelog dinámico. Antes el contenido del botón "Versiones" estaba
     hardcoded en este componente y quedaba huérfano entre releases del plugin.
     Ahora hacemos fetch a /signalk-mareas-ihm/CHANGELOG.md servido por el
     plugin: cada release del plugin solo necesita actualizar CHANGELOG.md y
     este modal lo refleja automáticamente. */
  const [changelogMd, setChangelogMd] = useState<string | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  useEffect(() => {
    if (!showChangelog || changelogMd !== null) return;
    setChangelogLoading(true);
    fetch("/signalk-mareas-ihm/CHANGELOG.md", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => { setChangelogMd(txt ?? ""); setChangelogLoading(false); })
      .catch(() => { setChangelogMd(""); setChangelogLoading(false); });
  }, [showChangelog, changelogMd]);
  /* Rev527: manual ES servido como fragmento HTML por el plugin
     (/instrucciones_es.html, originalmente docs/INSTRUCCIONES_MODAL_v3.html).
     Cuando el idioma activo es ES, el modal renderiza este HTML en lugar del
     JSX hardcoded EN, así el castellano vuelve a estar completo sin tener que
     mantener dos árboles JSX. */
  const [instrEsHtml, setInstrEsHtml] = useState<string | null>(null);
  const [instrEsLoading, setInstrEsLoading] = useState(false);
  useEffect(() => {
    if (showChangelog || lang !== 'es' || instrEsHtml !== null) return;
    setInstrEsLoading(true);
    fetch("/signalk-mareas-ihm/instrucciones_es.html", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => { setInstrEsHtml(txt ?? ""); setInstrEsLoading(false); })
      .catch(() => { setInstrEsHtml(""); setInstrEsLoading(false); });
  }, [showChangelog, lang, instrEsHtml]);
  const [instrSearch, setInstrSearch] = useState("");
  const instrContentRef = useRef<HTMLDivElement>(null);
  const [instrMatchCount, setInstrMatchCount] = useState(0);
  const [searchResults, setSearchResults] = useState<Array<{ section: string; snippet: string; element: Element }>>([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  // Search effect — builds results list grouped by section + highlights in DOM
  useEffect(() => {
    const el = instrContentRef.current;
    if (!el) { setSearchResults([]); setInstrMatchCount(0); return; }
    // Remove old marks
    el.querySelectorAll("mark.search-hl").forEach((m) => {
      const parent = m.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(m.textContent || ""), m); parent.normalize(); }
    });
    const q = instrSearch.trim().toLowerCase();
    if (!q || q.length < 2) { setSearchResults([]); setInstrMatchCount(0); setShowSearchPanel(false); return; }

    const results: Array<{ section: string; snippet: string; element: Element }> = [];
    // Walk text nodes, find matches, determine section from nearest h3
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    while (walk.nextNode()) nodes.push(walk.currentNode as Text);

    for (const tn of nodes) {
      const txt = tn.textContent || "";
      const idx = txt.toLowerCase().indexOf(q);
      if (idx === -1) continue;

      // Find nearest h3 ancestor/previous sibling for section
      let section = "General";
      let parent = tn.parentElement;
      while (parent && parent !== el) {
        // Look for preceding h3
        let prev = parent.previousElementSibling;
        while (prev) {
          if (prev.tagName === "H3") { section = prev.textContent?.replace(/^[^\w]*/, "") || "General"; break; }
          prev = prev.previousElementSibling;
        }
        if (section !== "General") break;
        parent = parent.parentElement;
      }

      // Extract snippet (±40 chars around match)
      const start = Math.max(0, idx - 40);
      const end = Math.min(txt.length, idx + q.length + 40);
      const snippet = (start > 0 ? "…" : "") + txt.slice(start, end).trim() + (end < txt.length ? "…" : "");

      // Highlight in DOM
      const before = txt.slice(0, idx);
      const match = txt.slice(idx, idx + q.length);
      const after = txt.slice(idx + q.length);
      const mark = document.createElement("mark");
      mark.className = "search-hl";
      mark.textContent = match;
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));
      tn.parentNode?.replaceChild(frag, tn);

      results.push({ section, snippet, element: mark });
    }

    // Sort: group by section, then by order of appearance
    const sectionOrder = new Map<string, number>();
    results.forEach((r, i) => { if (!sectionOrder.has(r.section)) sectionOrder.set(r.section, i); });
    results.sort((a, b) => (sectionOrder.get(a.section) ?? 99) - (sectionOrder.get(b.section) ?? 99));

    setSearchResults(results);
    setInstrMatchCount(results.length);
    setShowSearchPanel(results.length > 0);
    if (results.length > 0) results[0].element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [instrSearch, showChangelog]);

  const [showAlarma, setShowAlarma] = useState(false);

  // Paths published by the plugin (dynamic FAQ)
  const [publishedPaths, setPublishedPaths] = useState<Array<{ path: string; description: string }>>([]);
  
  // Alarma config
  const [alarmaConfig, setAlarmaConfig] = useState<AlarmaConfig>({ enabled: false, alertOnArrival: true, alertBeforeGrounding: true, minutesBefore: 60, safetyMargin: 0.5, soundMuted: false });
  const [alarmaConfigLocal, setAlarmaConfigLocal] = useState<AlarmaConfig | null>(null);
  const [groundingRisk, setGroundingRisk] = useState<GroundingRisk | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number>(20);

  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alarmOffNotice, setAlarmOffNotice] = useState<string | null>(null);
  const [showTideChart, setShowTideChart] = useState(false);
  const alarmaConfigLocalInitRef = useRef(false);

  /* Rev187: escuchar evento 'm-show-curvas' disparado desde el botón
     "📈 Curvas" del header iOS de index.html (solo visible en modo embed). */
  useEffect(() => {
    const onCurvas = () => setShowTideChart(true);
    document.addEventListener('m-show-curvas', onCurvas);
    return () => document.removeEventListener('m-show-curvas', onCurvas);
  }, []);

  // v1.2.0: Anchoring/Catenary modal
  const [showAnchor, setShowAnchor] = useState(false);
  const [anchorCfg, setAnchorCfg] = useState({ hBowMeters: 0, zTxMeters: 0, scopeBasic: 3.5, scopeNormal: 5.0, scopeHard: 8.0, roundingStep: 5, autoPublish: false });
  const [hBowStr, setHBowStr] = useState("");
  const [anchorMode, setAnchorMode] = useState<"basic" | "normal" | "hard">("normal");
  const [anchorDays, setAnchorDays] = useState(0);
  const [anchorHours, setAnchorHours] = useState(12);
  const anchorDuration = anchorDays * 24 + anchorHours;
  const [anchorDepthManual, setAnchorDepthManual] = useState<string>("");
  const [anchorResult, setAnchorResult] = useState<any>(null);
  const [editingChain, setEditingChain] = useState(false);
  const [chainDeployedStr, setChainDeployedStr] = useState("");
  const [chainDeployedVal, setChainDeployedVal] = useState<number | null>(null);

  // Fetch persisted chainDeployed from backend on mount
  useEffect(() => {
    fetch('/signalk-mareas-ihm/api/anchor-watch/state')
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s?.chainDeployed != null && s.chainDeployed > 0) setChainDeployedVal(s.chainDeployed); })
      .catch(() => {});
  }, []);

  // Medición del layout para posicionamiento geométrico (px) de cajas/líneas
  const heroRef = useRef<HTMLDivElement | null>(null);
  const heroRect = useContainerDimensions(heroRef);

  // Medición REAL de alturas de cajas (no usar constantes: la caja cambia con idioma y contenido)
  const nowBoxRef = useRef<HTMLDivElement | null>(null);
  const highBoxRef = useRef<HTMLDivElement | null>(null);
  const lowBoxRef = useRef<HTMLDivElement | null>(null);
  const [nowBoxH, setNowBoxH] = useState(90);
  const [highBoxH, setHighBoxH] = useState(90);
  const [lowBoxH, setLowBoxH] = useState(90);

  useEffect(() => {
    const updateScale = () => {
      const baseW = 825;
      const baseH = 890;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isPortrait = vh > vw;
      // Rev300: en portrait usar scale=vw/baseW para llenar el ancho, anclar
      // al top:0 (sin margen superior). El contenido extiende su altura
      // natural escalada; el bg de body coincide con el de tide-page así
      // que la zona baja vacía no se ve como "ventana en medio". Antes con
      // Math.min se centraba dejando bandas arriba y abajo.
      const s = isPortrait
        ? (vw / baseW)
        : Math.min(vw / baseW, vh / baseH);
      document.documentElement.style.setProperty('--viewport-scale', String(s));
      const el = document.querySelector('.tide-page') as HTMLElement;
      // Rev321: respetar la altura del m-tv-header (64px) para que el título
      // de TidesView no quede oculto detrás. Si no existe el header, offset=0.
      const tvHdr = document.getElementById('m-tv-header');
      const hdrH = tvHdr && tvHdr.offsetParent !== null ? tvHdr.offsetHeight : 0;
      if (el) {
        el.style.left = `${Math.max(0, (vw - baseW * s) / 2)}px`;
        el.style.top = isPortrait
          ? `${hdrH}px`
          : `${Math.max(hdrH, (vh - baseH * s) / 2)}px`;
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Medir alturas reales de las cajas para que la línea punteada atraviese SIEMPRE su centro
  // (y para que el clamp inferior tenga en cuenta la altura real + triángulo).
  useLayoutEffect(() => {
    const measure = () => {
      if (nowBoxRef.current) setNowBoxH(Math.max(60, nowBoxRef.current.offsetHeight));
      if (highBoxRef.current) setHighBoxH(Math.max(60, highBoxRef.current.offsetHeight));
      if (lowBoxRef.current) setLowBoxH(Math.max(60, lowBoxRef.current.offsetHeight));
    };
    measure();
    // Re-medir al próximo frame por si la tipografía/layout termina de asentarse
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [lang, heroRect?.height]);

  // UI language: load persisted setting (shared for all clients)
  useEffect(() => {
    let alive = true;
    /* Rev413 — fix lang: el query ?lang= manda sobre el backend (mobile.html
       lo pasa al abrir el iframe con la preferencia local del usuario).
       Si no hay query, fallback al backend. Antes solo leíamos del backend
       → instrucciones/changelog/aviso legal salían en ES cuando el visor
       estaba en EN. */
    let qHadLang = false;
    try {
      const qLang = new URLSearchParams(window.location.search).get("lang");
      if (qLang === "es" || qLang === "en") {
        setLang(qLang);
        qHadLang = true;
      }
    } catch { /* ignore */ }
    // Rev431: cargar siempre units desde backend (no dependiente del query lang).
    (async () => {
      try {
        const r = await fetch(SETTINGS_URL, { cache: "no-store" });
        if (!r.ok) return;
        const js = await r.json();
        if (!qHadLang) {
          const l = String(js?.lang ?? "").toLowerCase();
          if (alive && (l === "es" || l === "en")) setLang(l);
        }
        const u = String(js?.units ?? "").toLowerCase();
        const valid: UnitSystem[] = ["metric","metric_nautical","imperial_us","imperial_us_nautical","imperial_uk","imperial_uk_nautical"];
        if (alive && (valid as string[]).indexOf(u) >= 0) setUnits(u as UnitSystem);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load the list of published Signal K paths when opening the instructions window.
  useEffect(() => {
    if (!showInstrucciones) return;
    let cancelled = false;
    const pathsUrl = new URL("/signalk-mareas-ihm/api/paths", VITE_SIGNALK_URL);
    pathsUrl.searchParams.set("lang", lang);
    fetch(pathsUrl.toString(), { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : (data?.paths ?? []);
        if (Array.isArray(rows)) setPublishedPaths(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setPublishedPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showInstrucciones, lang]);

  useEffect(() => () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (refreshStartTimeoutRef.current) clearTimeout(refreshStartTimeoutRef.current);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    if (autoPickTimerRef.current) clearInterval(autoPickTimerRef.current);
  }, []);

  const stopRefresh = useCallback(() => {
    if (refreshTimerRef.current) { clearInterval(refreshTimerRef.current); refreshTimerRef.current = null; }
    if (refreshStartTimeoutRef.current) { clearTimeout(refreshStartTimeoutRef.current); refreshStartTimeoutRef.current = null; }
    if (refreshTimeoutRef.current) { clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; }
    setIsRefreshing(false);
    setRefreshLabel("");
    setRefreshCount(0);
    expectedStationRef.current = "";
  }, []);

  const tr = useCallback((es: string, en: string) => (lang === "es" ? es : en), [lang]);

  useEffect(() => {
    const currentStation = snapshot?.stationName?.toUpperCase() ?? "";
    if (isRefreshing && expectedStationRef.current && currentStation.includes(expectedStationRef.current)) {
      stopRefresh();
    }
  }, [snapshot?.stationName, isRefreshing, stopRefresh]);

  const loadSettings = useCallback(async () => {
    try {
      const [stationsRes, manualRes, alarmaRes] = await Promise.all([
        fetch(STATIONS_URL, { credentials: "include" }).catch(() => null),
        fetch(MANUAL_URL, { credentials: "include" }).catch(() => null),
        fetch(ALARMA_URL, { credentials: "include" }).catch(() => null),
      ]);
      if (stationsRes?.ok) {
        const json = await stationsRes.json();
        const list: StationInfo[] = (Array.isArray(json) ? json : [])
          .map((s: any) => ({
            id: String(s.id),
            name: String(s.name ?? ""),
            inRange: Boolean(s.inRange),
            distance: s.distance ?? null,
            tz: s.tz,
            // Rev149: marca pseudo-estaciones sintéticas para mantenerlas al
            // principio independientemente del sort alfabético.
            synthetic: Boolean((s as any).synthetic),
          } as StationInfo))
          .filter((s) => s.id && s.name);
        // Rev149: orden distinto según modo.
        //   MANUAL: sintéticas PRIMERAS (acceso rápido — el usuario eligió
        //     manual probablemente porque no tiene cobertura IHM).
        //   AUTO: sintéticas AL FINAL (la "más cercana" debe ser IHM real
        //     por distancia, no una sintética).
        // El render del dropdown pinta un separador entre los dos grupos.
        const syns = list.filter((s) => s.synthetic);
        const reals = list.filter((s) => !s.synthetic);
        reals.sort((a, b) => a.name.localeCompare(b.name, "es"));
        setAllStations([...syns, ...reals]); // MANUAL: sintéticas primero
        const nearby = reals.filter((s) => s.inRange);
        nearby.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
        setNearbyStations([...nearby, ...syns]); // AUTO: sintéticas al final
      }
      if (manualRes?.ok) {
        const m = await manualRes.json();
        const isManual = Boolean(m.manualOverride);
        const activeId = String(m.activeStationId ?? "");
        setManualOverride(isManual);
        setActiveStationId(activeId);

        // Selector:
        // - En MANUAL muestra la estación manual.
        // - En AUTO muestra la estación activa (normalmente la más cercana por GPS).
        if (isManual && m.manualStationId) {
          setSelectedStationId(String(m.manualStationId));
        } else {
          setSelectedStationId(activeId);
        }

        if (m.favoriteStationId) setFavoriteStationId(String(m.favoriteStationId));
      }
      if (alarmaRes?.ok) {
        const a = await alarmaRes.json();
        const cfg: AlarmaConfig = { 
          enabled: Boolean(a.enabled), 
          alertOnArrival: a.alertOnArrival !== false, 
          alertBeforeGrounding: a.alertBeforeGrounding !== false, 
          minutesBefore: a.minutesBefore ?? 60,
          safetyMargin: a.safetyMargin ?? 0.5,
          soundMuted: Boolean(a.soundMuted)
        };
        setAlarmaConfig(cfg);
        if (!alarmaConfigLocalInitRef.current) {
          setAlarmaConfigLocal(cfg);
          alarmaConfigLocalInitRef.current = true;
        }
        if (a.groundingRisk) setGroundingRisk(a.groundingRisk);
        if (typeof a.snoozedUntil === "number") setSnoozedUntil(a.snoozedUntil || null);
        // Re-arm banner automatically when snooze expires
        if (typeof a.snoozedUntil === "number" && a.snoozedUntil && Date.now() > a.snoozedUntil) {
          setAlertDismissed(false);
        }
      }
    } catch {}
  }, []);

  // v1.128: Poll faster when alarm enabled (5s) for near-instant red box. Normal: 20s.
  useEffect(() => {
    loadSettings();
    const ms = alarmaConfig.enabled ? 5000 : 20000;
    const i = setInterval(loadSettings, ms);
    return () => clearInterval(i);
  }, [loadSettings, alarmaConfig.enabled]);

  const startRefresh = (label: string, expectedStation: string) => {
    stopRefresh();
    setRefreshLabel(label);
    expectedStationRef.current = expectedStation.toUpperCase();

    // Nota: "Detectando"/contador solo debe aparecer si realmente tarda el fetch.
    // Para estaciones ya en caché, la respuesta suele ser inmediata y no queremos mostrar espera artificial.
    setIsRefreshing(false);
    setRefreshCount(0);

    refreshStartTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(true);
      setRefreshCount(30);
      refreshTimerRef.current = window.setInterval(() => setRefreshCount((c) => Math.max(0, c - 1)), 1000);
      refreshTimeoutRef.current = window.setTimeout(stopRefresh, 30000);
    }, 400);
  };

const stopAutoPickCountdown = useCallback(() => {
  if (autoPickTimerRef.current) {
    window.clearInterval(autoPickTimerRef.current);
    autoPickTimerRef.current = null;
  }
  setAutoPickCountdown(null);
}, []);

const startAutoPickCountdown = useCallback((seconds = 15) => {
  stopAutoPickCountdown();
  setAutoPickCountdown(seconds);
  autoPickTimerRef.current = window.setInterval(() => {
    setAutoPickCountdown((s) => {
      if (s == null) return null;
      const next = s - 1;
      if (next <= 0) {
        // Time out: close dropdown and keep nearest (AUTO default).
        setStationDropdownOpen(false);
                    stopAutoPickCountdown();
        if (autoPickTimerRef.current) {
          window.clearInterval(autoPickTimerRef.current);
          autoPickTimerRef.current = null;
        }
        return null;
      }
      return next;
    });
  }, 1000);
}, [stopAutoPickCountdown]);


  const pushManual = async (payload: { manualOverride: boolean; manualStationId: string; favoriteStationId?: string }) => {
    try {
      const res = await fetch(MANUAL_URL, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...payload, forceRefresh: true }) });
      if (res.ok) {
        const u = await res.json();
        setActiveStationId(String(u.activeStationId ?? ""));
        setManualOverride(Boolean(u.manualOverride));
        if (u.favoriteStationId) setFavoriteStationId(String(u.favoriteStationId));
        if (refetch) refetch();
      }
    } catch {}
  };

  const saveAlarma = async () => {
    if (!alarmaConfigLocal) return;
    try {
      const res = await fetch(ALARMA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(alarmaConfigLocal) });
      if (res.ok) { 
        const d = await res.json(); 
        setAlarmaConfig(alarmaConfigLocal); 
        if (d.groundingRisk) setGroundingRisk(d.groundingRisk); 
        else setGroundingRisk(null); 
        // v1.128: Re-arm banner when re-enabling
        if (alarmaConfigLocal.enabled) setAlertDismissed(false);
      }
    } catch {}
    // v1.128: Force immediate refresh to pick up grounding state fast
    setTimeout(loadSettings, 1500);
  };

  const snoozeAlert = async () => {
  setAlertDismissed(true);
  try {
    await fetch(SNOOZE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ minutes: snoozeMinutes }),
    });
    setSnoozedUntil(Date.now() + (snoozeMinutes * 60_000));
  } catch {}
  setTimeout(loadSettings, 1500);
};

const disableAlarm = async () => {
  setAlertDismissed(true);
  try {
    await fetch(ALARMA_OFF_URL, { method: "POST", credentials: "include" });
    setAlarmaConfig((p) => ({ ...p, enabled: false }));
    setAlarmaConfigLocal((p) => p ? { ...p, enabled: false } : null);
    // v1.128: Do NOT null groundingRisk — keep physicalRisk so blink/popup works
    setSnoozedUntil(null);
    setAlarmOffNotice(tr("Alarma desactivada. No volverás a recibir avisos hasta que la rearmes.", "Alarm turned off. You will not receive alerts again until you re-arm it."));
  } catch {}
  setTimeout(loadSettings, 1500);
};


  // Ticker + Visibility: v1.126 — Stop EVERYTHING when tab is hidden.
  // - Stops ticker interval (saves CPU: zero React re-renders in background)
  // - Adds animations-paused class (saves GPU: animation:none releases compositor layers)
  // - On return: restarts ticker + refreshes immediately
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let t: number | null = null;
    const startTicker = () => {
      if (!t) t = window.setInterval(() => setNow(new Date()), 15000) as unknown as number;
    };
    const stopTicker = () => {
      if (t) { window.clearInterval(t); t = null; }
    };
    const handler = () => {
      const el = document.querySelector(".tide-page");
      if (document.hidden) {
        stopTicker();
        if (el) el.classList.add("animations-paused");
      } else {
        if (el) el.classList.remove("animations-paused");
        setNow(new Date());
        startTicker();
      }
    };
    document.addEventListener("visibilitychange", handler);
    startTicker();
    return () => {
      stopTicker();
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);

  const extremes = forecast?.extremes ?? [];
  const { prev: prevExtreme, sorted } = findPrevNext(extremes, now);
  const tendency = prevExtreme ? (prevExtreme.type?.toLowerCase() === "low" ? "rising" : "falling") : undefined;
  const rawStationName = snapshot?.stationName ?? forecast?.station?.name ?? tr("Sin datos", "No data");

  const displayStationName = isRefreshing
    ? (refreshLabel === "AUTO"
        // AUTO: the nearest station is already active; we open the dropdown so the user can
        // optionally pick a preferred station. We should show the nearest station name here.
        ? `${rawStationName.toUpperCase()}`
        : `${tr("Refrescando", "Refreshing")} ${refreshLabel}... ${refreshCount}`)
    : rawStationName.toUpperCase();

  const prevHeight = prevExtreme?.value ?? 0;
  const prevTime = fmtHHMMFromIso(typeof prevExtreme?.time === "string" ? prevExtreme.time : undefined);
  const nextHigh = sorted.find((e) => (e.type ?? "").toLowerCase() === "high" && new Date(e.time) > now);
  const nextLow = sorted.find((e) => (e.type ?? "").toLowerCase() === "low" && new Date(e.time) > now);
  const heightNow = typeof snapshot?.heightNow === "number" ? snapshot.heightNow : approximateTideHeightAt(sorted, now) ?? 0;

  const stationIdForRef = manualOverride ? selectedStationId : activeStationId;
  const stationRefState = useStationRef(stationIdForRef);
  
  let HAT: number, LAT: number;
  if (stationRefState.status === "ok" && stationRefState.ref.hat > stationRefState.ref.lat) {
    HAT = stationRefState.ref.hat; LAT = stationRefState.ref.lat;
  } else {
    const vals = sorted.map((e) => e.value).concat([heightNow]);
    HAT = Math.max(...vals) + 0.3;
    LAT = Math.max(0, Math.min(...vals) - 0.2);
  }
  const scaleRange = Math.max(0.1, HAT - LAT);
  const calcPct = (v: number) => Math.max(0, Math.min(1, (v - LAT) / scaleRange));
  
  const waterPct = calcPct(heightNow);
  const highPct = nextHigh?.value != null ? calcPct(nextHigh.value) : null;
  const lowPct = nextLow?.value != null ? calcPct(nextLow.value) : null;

  const hPlus10 = approximateTideHeightAt(sorted, new Date(now.getTime() + 600000));
  const delta10mRaw = hPlus10 != null ? hPlus10 - heightNow : null;

  // v1.1.0 BUG 2 FIX: Validate delta sign coherence with tendency.
  // During refresh or near extremes, stale data can produce sign contradictions
  // (e.g. tendency "rising" but delta negative). Guard against this.
  const delta10m = (() => {
    if (isRefreshing || delta10mRaw == null) return null;
    if (tendency === "rising" && delta10mRaw < -0.001) return null; // contradicts rising
    if (tendency === "falling" && delta10mRaw > 0.001) return null; // contradicts falling
    return delta10mRaw;
  })();
  const deltaText = delta10m != null ? `${delta10m >= 0 ? "+" : ""}${Math.round(delta10m * 100)} cm` : "–";
  const statusText = tendency
    ? `${tendency === "rising" ? tr("SUBIENDO", "RISING") : tr("BAJANDO", "FALLING")} ${tr("DESDE", "SINCE")} ${fmtTideHeight(prevHeight, 2)} ${tr("A LAS", "AT")} ${prevTime}`
    : tr("SIN DATOS", "NO DATA");
  const statusClass = tendency === "rising" ? "tide-status up" : tendency === "falling" ? "tide-status down" : "tide-status neutral";

  const ISLAND_PCT = 22;
  const heroH = heroRect?.height ?? 0;
  const islandPx = heroH * (ISLAND_PCT / 100);
  const barPx = heroH - islandPx;
  const waterTopPct = heroH > 0 ? ((islandPx + barPx * (1 - waterPct)) / heroH) * 100 : 50;

  // Geometría de cajas/líneas:
  // - La línea punteada debe atravesar SIEMPRE el centro de la caja (cuando están "acopladas").
  // - Solo hay clamp inferior: cuando la caja baja tanto que chocaría con el borde inferior,
  //   la caja se PARA y la línea continúa bajando/subiendo sola hasta volver a re-acoplarse.
  const TREND_ARROW_PX = 42 + 3; // altura + margen (ver CSS .trend-arrow)
  const MIN_BOX_TOP_PX = islandPx + 6;

  const lineYpx = (pct: number) => islandPx + barPx * (1 - pct);
  const clampInfo = (pct: number, boxH: number, topExtra: number, bottomExtra: number) => {
    const yTide = lineYpx(pct);

    // Centro ideal de la caja (acoplada) debe coincidir con yTide.
    // La caja real está dentro del wrapper, desplazada por topExtra (triángulo arriba).
    // boxCenter = wrapperTop + topExtra + boxH/2
    const idealTop = yTide - (topExtra + boxH / 2);

    // Clamp inferior: la caja se para antes de tocar el borde inferior, considerando triángulo abajo.
    // wrapperBottom = top + topExtra + boxH + bottomExtra
    const maxTop = Math.max(MIN_BOX_TOP_PX, heroH - (topExtra + boxH + bottomExtra) - 6);
    const top = Math.max(MIN_BOX_TOP_PX, Math.min(maxTop, idealTop));
    const clamped = Math.abs(top - idealTop) > 2;

    const boxCenter = top + topExtra + boxH / 2;

    // La línea sigue el nivel real; si no hay clamp, coincide con el centro de la caja.
    // Limitamos visualmente la línea al rango del héroe.
    const yLineRaw = Math.max(islandPx + 2, Math.min(heroH - 2, yTide));
    const yLine = clamped ? yLineRaw : boxCenter;

    // Segmento vertical cuando la caja está clamped.
    let vertTop = 0;
    let vertHeight = 0;
    if (clamped) {
      if (yLine > boxCenter) {
        vertTop = boxCenter;
        vertHeight = yLine - boxCenter;
      } else if (yLine < boxCenter) {
        vertTop = yLine;
        vertHeight = boxCenter - yLine;
      }
    }

    return { y: yTide, top, clamped, arrowY: yLine, lineTop: vertTop, lineHeight: vertHeight };
  };

  // NOW: triángulo arriba si sube, abajo si baja.
  const nowTopExtra = tendency === "rising" ? TREND_ARROW_PX : 0;
  const nowBottomExtra = tendency === "falling" ? TREND_ARROW_PX : 0;
  const nowGeom = clampInfo(waterPct, nowBoxH, nowTopExtra, nowBottomExtra);

  // HIGH/LOW: sin triángulos.
  const highGeom = highPct !== null ? clampInfo(highPct, highBoxH, 0, 0) : null;
  const lowGeom = lowPct !== null ? clampInfo(lowPct, lowBoxH, 0, 0) : null;

  const hasNearby = nearbyStations.length > 0;
  const stationsForSel = manualOverride ? allStations : nearbyStations;
  const selDisabled = !manualOverride && !hasNearby;
  
  // REGLA CRÍTICA: Backend = fuente única de verdad
  const selValue = manualOverride ? selectedStationId : activeStationId;
  const selPlaceholder = manualOverride ? tr("Elige estación", "Select station") : (hasNearby ? tr("Elige preferida", "Choose preferred") : rawStationName.toUpperCase());
  
  // La estación más cercana es la primera de nearbyStations
  const nearestStationId = nearbyStations.length > 0 ? nearbyStations[0].id : "";
  const nearestStationName = nearestStationId ? (allStations.find((s) => s.id === nearestStationId)?.name ?? rawStationName) : rawStationName;
  const autoPickHint = (!manualOverride && stationDropdownOpen && autoPickCountdown != null)
    ? `${nearestStationName.toUpperCase()}: ${tr("Elige preferida", "Choose preferred")} (${autoPickCountdown})`
    : null;

  
  const showAlert = groundingRisk?.risk && alarmaConfig.enabled && !alertDismissed && (!snoozedUntil || Date.now() > snoozedUntil);

  // v1.128: Detect physical risk regardless of alarm state (for blink/popup)
  const hasPhysicalRisk = Boolean((groundingRisk as any)?.physicalRisk);
  const alarmOff = !alarmaConfig.enabled;
  const riskButAlarmOff = hasPhysicalRisk && alarmOff;
  const [showRiskPopup, setShowRiskPopup] = useState(false);

  // v1.128: Tab title + favicon blink when alarm active
  useEffect(() => {
    if (!showAlert) {
      document.title = "Mareas IHM";
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) link.href = "/signalk-mareas-ihm/favicon.ico";
      return;
    }
    let on = true;
    const t = setInterval(() => {
      on = !on;
      document.title = on ? "⚠ RIESGO DE VARADA ⚠" : "Mareas IHM";
    }, 1000);
    return () => { clearInterval(t); document.title = "Mareas IHM"; };
  }, [showAlert]);

  const openAlarma = () => {
    if (riskButAlarmOff) setShowRiskPopup(true);
    setShowAlarma(true);
  };
  // Keep for future use (visor de fondeo integration); suppress TS6133
  void openAlarma;

  const riskTimeStr = useMemo(() => {
    const t = (groundingRisk as any)?.timeUntil;
    if (typeof t !== "number" || t <= 0) return null;
    const d = new Date(Date.now() + t * 60000);
    const offMin = getOffsetMinutesFromIso(nextHigh?.time ?? nextLow?.time);
    const shifted = new Date(d.getTime() + (offMin ?? 0) * 60000);
    return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
  }, [groundingRisk, nextHigh, nextLow]);
  // When alarm is re-armed or risk returns, the banner must be allowed to show again.
  useEffect(() => {
    if (alarmaConfig.enabled) {
      setAlarmOffNotice(null);
    }
    if (alarmaConfig.enabled && groundingRisk?.risk) {
      setAlertDismissed(false);
    }
  }, [alarmaConfig.enabled, groundingRisk?.risk]);

  // v1.2.0: Anchoring / Catenaria
  const openAnchor = useCallback(async () => {
    setShowAnchor(true);
    try {
      const r = await fetch(ANCHOR_CFG_URL, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setAnchorCfg(d);
        setHBowStr(d.hBowMeters > 0 ? String(d.hBowMeters) : "");
        // Sprint C: read visor sync data — if visor has chain deployed, show it
        if (d.visorChainDeployed && d.visorChainDeployed > 0) {
          setChainDeployedVal(d.visorChainDeployed);
        }
      }
    } catch { /* ignore */ }
  }, []);
  void openAnchor; // Keep for future use; suppress TS6133

  const calcAnchor = useCallback(async () => {
    try {
      await fetch(ANCHOR_CFG_URL, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...anchorCfg }),
      });
      const depthManual = parseFloat(anchorDepthManual);
      const r = await fetch(ANCHOR_CALC_URL, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: anchorMode, durationHours: anchorDuration,
          depthManual: Number.isFinite(depthManual) && depthManual > 0 ? depthManual : null,
          autoPublish: anchorCfg.autoPublish,
        }),
      });
      if (r.ok) { const d = await r.json(); setAnchorResult(d); }
    } catch { /* ignore */ }
  }, [anchorCfg, anchorMode, anchorDays, anchorHours, anchorDepthManual]);

  // Auto-calculate when any anchor input changes (after modal open)
  const anchorAutoCalcRef = useRef(false);
  useEffect(() => {
    if (!showAnchor) { anchorAutoCalcRef.current = false; return; }
    // Skip first render (we calc on open), debounce subsequent changes
    if (!anchorAutoCalcRef.current) { anchorAutoCalcRef.current = true; calcAnchor(); return; }
    const t = setTimeout(calcAnchor, 400);
    return () => clearTimeout(t);
  }, [showAnchor, anchorCfg, anchorMode, anchorDays, anchorHours, anchorDepthManual, calcAnchor]);

  const [showScopeHelp, setShowScopeHelp] = useState(false);
  const [showAnchorConfig, setShowAnchorConfig] = useState(false);

  return (
    <>
    <div className="tide-page">
      {/* ALERTA ROJA — overlay absoluto sobre cabecera, NO genera línea adicional */}
      {showAlert && (
          <div className="grounding-alert">
            <div className="alert-content">
              <span className="alert-icon"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M14 2L1 26h26L14 2z" fill="#FFD600" stroke="#222" strokeWidth="1.5"/><text x="14" y="22" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#222">!</text></svg></span>
              <span className="alert-text">{groundingRisk?.message ?? tr("RIESGO DE VARADA", "GROUNDING RISK")}</span>
            </div>
            <div className="alert-actions">
              <div className="alert-actions-left">
                <button className="alert-snooze" onClick={snoozeAlert}>{tr("SNOOZE", "SNOOZE")}</button>
                <select className="snooze-select" value={snoozeMinutes} onChange={(e) => setSnoozeMinutes(parseInt(e.target.value) || 20)}>
                  {[10, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} {tr("min", "min")}</option>)}
                </select>
              </div>
              <button className="alert-off" onClick={disableAlarm}>{tr("APAGAR", "TURN OFF")}</button>
            </div>
          </div>
      )}
      {/* v1.127: Alarm-off notice shown in same RED box style, with close button */}
      {alarmOffNotice && !showAlert && (
          <div className="grounding-alert grounding-alert-off">
            <div className="alert-content">
              <span className="alert-icon"><svg viewBox="0 0 28 28" width="28" height="28"><path d="M14 2L1 26h26L14 2z" fill="#FFD600" stroke="#222" strokeWidth="1.5"/><text x="14" y="22" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#222">!</text></svg></span>
              <span className="alert-text">{alarmOffNotice}</span>
            </div>
            <div className="alert-actions">
              <button className="alert-off" onClick={() => setAlarmOffNotice(null)}>{tr("CERRAR", "CLOSE")}</button>
            </div>
          </div>
      )}
      <header className="tide-header">
          <div className="header-lines">
    <div className="header-title">
      {tr("Tides (IHM Spain)", "Tides (IHM Spain)")}
    </div>
  </div>
</header>
<main className="tide-main">
        {/* Rev247: tide-station MOVIDO dentro de tide-main para que entre
            en el centrado vertical (justify-content:center). Antes estaba
            fuera del flex centering y se quedaba arriba dejando hueco. */}
        <div className={`tide-station ${isRefreshing ? 'refreshing' : ''}`}>{displayStationName}</div>
        {error && <div className="tide-error">{error}</div>}
        <div className={statusClass}>{statusText}</div>
        
        <div className="tide-hero" ref={heroRef}>
          <div className="tide-col-left">
            <div className="tide-box-wrapper now-wrapper" style={{ top: `${nowGeom.top}px` }}>
              {tendency === "rising" && <div className="trend-arrow up" />}
              <div className="tide-box now-box" ref={nowBoxRef}>
                <div className="box-title now">{tr("AHORA", "NOW")} ({fmtNowByStationOffset(now, nextHigh?.time ?? nextLow?.time) ?? fmtIsoUtcByStationOffset(snapshot?.navDatetime, nextHigh?.time ?? nextLow?.time)})</div>
                <div className="box-value now">{Number.isFinite(heightNow) ? fmtTideHeight(heightNow, 2) : "–"}</div>
                <div className="box-delta">{tr("EN 10 MIN", "IN 10 MIN")}: {deltaText}</div>
              </div>
              {tendency === "falling" && <div className="trend-arrow down" />}
            </div>
            <div className="tide-line now-line" style={{ top: `${nowGeom.arrowY}px` }}><span className="line-arrow">▶</span></div>
            {nowGeom.lineHeight > 2 && (
              <div className="tide-line-vert now" style={{ top: `${nowGeom.lineTop}px`, height: `${nowGeom.lineHeight}px` }} />
            )}
          </div>

          <div className="tide-barWrap">
            <div className="tide-bar" style={{ '--waterTopPct': `${waterTopPct}%` } as React.CSSProperties} onClick={() => setShowTideChart(true)} title={tr("Haz click para ver las curvas", "Click to see tide curves")}>
              <div className="tide-barInner">
                <div className="tide-sand">
                  {CRAB_POSITIONS.map((crab) => (
                    <span key={crab.id} className={`sand-crab crab-${crab.id}`} style={{ left: `${crab.leftPct}%`, top: `${crab.topPct}%` }}>
                      <CrabSvg />
                    </span>
                  ))}
                </div>
                <div className="tide-water">
                  <div className="tide-waterSurface" />
                  {FISH_ELEMENTS.map((fish, i) => (
                    <span key={i} className={`fish fish-${i}`}>
                      {fish}
                    </span>
                  ))}
                </div>
                <div className="tide-scene">
                  <div className="tide-sky" />
                  <WeatherIcon />
                  <svg className="tide-island" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Isla: skyline suave original, borde inferior recto */}
                    <path d="M0 92 Q10 75 25 78 Q45 82 60 70 Q80 60 100 72 L100 100 L0 100 Z" fill="#2ecc71" />
                    <path d="M0 92 Q10 75 25 78 Q45 82 60 70 Q80 60 100 72" stroke="#1a7f3d" strokeWidth="2.5" fill="none" />
                    {/* Faro */}
                    <polygon points="66,35 74,35 73,70 67,70" fill="white" />
                    <rect x="67" y="35" width="6" height="7" fill="#dc3545" /><rect x="67" y="49" width="6" height="7" fill="#dc3545" /><rect x="67" y="63" width="6" height="7" fill="#dc3545" />
                    <rect x="63" y="30" width="14" height="5" fill="#555" /><rect x="66" y="20" width="8" height="10" fill="#b8e4f5" stroke="#666" strokeWidth="0.5" /><polygon points="65,20 75,20 70,12" fill="#dc3545" />
                  </svg>
                </div>
                {/* Línea de costa irregular: borde verde/arena ondulante */}
                <svg className="tide-coastline" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0 0 L0 8 Q6 12 12 9 Q18 6 24 10 Q30 14 36 11 Q42 7 48 10 Q54 14 60 11 Q66 8 72 12 Q78 15 84 11 Q90 8 96 12 L100 10 L100 0 Z" fill="#2ecc71" />
                </svg>
              </div>
            </div>
          </div>

          <div className="tide-col-right">
            {highGeom !== null && nextHigh && (
              <>
                <div className="tide-line high-line" style={{ top: `${highGeom.arrowY}px` }}><span className="line-arrow">◀</span></div>
                {highGeom.lineHeight > 2 && (
              <div className="tide-line-vert high" style={{ top: `${highGeom.lineTop}px`, height: `${highGeom.lineHeight}px` }} />
            )}
                <div className="tide-box-wrapper high-wrapper" style={{ top: `${highGeom.top}px` }}>
                  <div className="tide-box high-box" ref={highBoxRef}><div className="box-title high">{tr("PRÓX. PLEAMAR", "NEXT HIGH")}</div><div className="box-value high">{fmtTideHeight(nextHigh.value, 2)}</div><div className="box-when">{tr("A las", "At")} {fmtHHMMFromIso(nextHigh.time)}</div></div>
                </div>
              </>
            )}
            {lowGeom !== null && nextLow && (
              <>
                <div className="tide-line low-line" style={{ top: `${lowGeom.arrowY}px` }}><span className="line-arrow">◀</span></div>
                {lowGeom.lineHeight > 2 && (
              <div className="tide-line-vert low" style={{ top: `${lowGeom.lineTop}px`, height: `${lowGeom.lineHeight}px` }} />
            )}
                <div className="tide-box-wrapper low-wrapper" style={{ top: `${lowGeom.top}px` }}>
                  <div className="tide-box low-box" ref={lowBoxRef}><div className="box-title low">{tr("PRÓX. BAJAMAR", "NEXT LOW")}</div><div className="box-value low">{fmtTideHeight(nextLow.value, 2)}</div><div className="box-when">{tr("A las", "At")} {fmtHHMMFromIso(nextLow.time)}</div></div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="tide-controls">
          <label className={`mode-btn ${!manualOverride ? 'selected' : ''}`}>
            <input type="radio" name="mode" checked={!manualOverride} onChange={() => {
              if (manualOverride) {
                setManualOverride(false);
                setSelectedStationId("");
                // In AUTO, default must be the nearest station (GPS). Clear any previous favorite.
                setFavoriteStationId("");
                startRefresh("AUTO", "");
                pushManual({ manualOverride: false, manualStationId: "", favoriteStationId: "" });
                // UX: al pasar a AUTO, abrimos el selector para que puedas fijar preferida
                // (si no eliges nada, seguirá la más cercana por GPS).
                setStationDropdownOpen(true);
                startAutoPickCountdown(15);
              }
            }} /><span className="radio-circle" />{tr("Automático","Automatic")}
          </label>
          {/* Dropdown custom */}
          <div className="station-dropdown-container">
            <button 
              className={`station-dropdown-btn ${selDisabled ? 'disabled' : ''}`}
              onClick={() => {
                if (selDisabled) return;
                setStationDropdownOpen((o) => {
                  const next = !o;
                  if (next && !manualOverride) startAutoPickCountdown(15);
                  if (!next) stopAutoPickCountdown();
                  return next;
                });
              }}
              disabled={selDisabled}
            >
              <span className="station-dropdown-text">
                {autoPickHint ?? (selValue ? (allStations.find((s) => s.id === selValue)?.name ?? selPlaceholder) : selPlaceholder)}
              </span>
              <span className="station-dropdown-chev">{stationDropdownOpen ? "▲" : "▼"}</span>
            </button>
            {stationDropdownOpen && !selDisabled && (
              <>
                <div className="station-dropdown-backdrop" onClick={() => { setStationDropdownOpen(false); stopAutoPickCountdown(); }} />
                <div className="station-dropdown-menu" onMouseLeave={() => { setStationDropdownOpen(false);
                    stopAutoPickCountdown(); }}>
                <div 
                  className={"station-option" + (selValue === "" ? " selected" : "")}
                  onClick={() => {
                    setStationDropdownOpen(false);
                    stopAutoPickCountdown();
                    if (manualOverride) {
                      setSelectedStationId("");
                    } else {
                      setFavoriteStationId("");
                      pushManual({ manualOverride: false, manualStationId: "", favoriteStationId: "" });
                    }
                  }}
                >
                  {selPlaceholder}
                </div>
                {stationsForSel.map((s, idx) => {
                  // Rev149: separador visual entre bloque sintéticas y
                  // bloque IHM. Detecta TRANSICIÓN entre los dos grupos
                  // independientemente del orden (MANUAL: sint → IHM,
                  // AUTO: IHM → sint).
                  const prev = idx > 0 ? stationsForSel[idx - 1] : null;
                  const crossesBoundary = prev && Boolean(prev.synthetic) !== Boolean(s.synthetic);
                  const labelSynth = tr("─── Sin datos IHM ───", "─── No IHM data ───");
                  const labelReal = tr("─── Estaciones IHM ───", "─── IHM stations ───");
                  return (
                  <React.Fragment key={s.id}>
                  {crossesBoundary && (
                    <div className="station-divider" style={{
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#888",
                      borderTop: "1px solid rgba(255,255,255,.15)",
                      marginTop: "4px",
                      textTransform: "uppercase",
                      letterSpacing: ".5px",
                    }}>
                      {s.synthetic ? labelSynth : labelReal}
                    </div>
                  )}
                  <div
                    className={
                      "station-option" +
                      (String(s.id) === String(selValue) ? " selected" : "") +
                      (!manualOverride && String(s.id) === nearestStationId ? " nearest" : "")
                    }
                    onClick={() => {
                      setStationDropdownOpen(false);
                    stopAutoPickCountdown();
                      if (manualOverride) {
                        setSelectedStationId(s.id);
                        startRefresh(s.name.toUpperCase(), s.name);
                        pushManual({ manualOverride: true, manualStationId: s.id });
                      } else {
                        setFavoriteStationId(s.id);
                        startRefresh(s.name.toUpperCase(), s.name);
                        pushManual({ manualOverride: false, manualStationId: "", favoriteStationId: s.id });
                      }
                    }}
                  >
                    <span className="station-name">{s.name}</span>
                    {!manualOverride && String(s.id) === nearestStationId && (
                      <span className="nearest-badge">{tr("Más cercana", "NEAREST")}</span>
                    )}
                  </div>
                  </React.Fragment>
                  );
                })}
              </div>
              </>
            )}
          </div>

          <label className={`mode-btn ${manualOverride ? 'selected' : ''}`}>
            <input type="radio" name="mode" checked={manualOverride} onChange={() => {
              if (!manualOverride) {
                setManualOverride(true);
                const st = favoriteStationId || activeStationId;
                setSelectedStationId(st);
                const f = allStations.find((s) => s.id === st);
                if (st && f) { 
                  startRefresh(f.name.toUpperCase(), f.name); 
                  pushManual({ manualOverride: true, manualStationId: st }); 
                } else { 
                  pushManual({ manualOverride: true, manualStationId: st }); 
                }
              }
            }} /><span className="radio-circle" />{tr("Manual","Manual")}
          </label>
        </div>
        <div className="tide-subinfo tide-subinfo-footer">
          <span>
    <span className="emph">{tr("Coef. marea: ", "Tide coef: ")}</span>
    {Number.isFinite(snapshot?.coef)
      ? fmtDecimal(Number(snapshot?.coef), 2)
      : "–"}
	    {" · "}<span className="emph" title={tr("Requiere plugin Derived Data + señal GPS", "Requires Derived Data plugin + GPS signal")}>{tr("Salida", "Sunrise")}</span>{": "}{(() => { const v = fmtIsoUtcByStationOffset(snapshot?.sunrise, nextHigh?.time ?? nextLow?.time ?? snapshot?.timeNextHigh ?? snapshot?.timeNextLow ?? snapshot?.timeLastHigh ?? snapshot?.timeLastLow); return v === "–" ? tr("(Derived Data + GPS)", "(Derived Data + GPS)") : v; })()}
	    {" · "}<span className="emph" title={tr("Requiere plugin Derived Data + señal GPS", "Requires Derived Data plugin + GPS signal")}>{tr("Puesta", "Sunset")}</span>{": "}{(() => { const v = fmtIsoUtcByStationOffset(snapshot?.sunset, nextHigh?.time ?? nextLow?.time ?? snapshot?.timeNextHigh ?? snapshot?.timeNextLow ?? snapshot?.timeLastHigh ?? snapshot?.timeLastLow); return v === "–" ? tr("(Derived Data + GPS)", "(Derived Data + GPS)") : v; })()}
          </span>
        </div>
        {/* Rev244: fila inferior eliminada por petición del usuario. Las
            Instrucciones se abren ahora desde el menú Hamburger del visor
            (que carga TidesView con ?showInstructions=1 y auto-abre el
            modal). El idioma se mantiene por persistencia desde el visor. */}
      </main>
    </div>

    {/* Modales: portal al body para que position:fixed funcione bien con transform:scale */}
    {createPortal(
      <>
      {showAvisoLegal && (
        // Rev149 (bug fix): zIndex 1100 — encima del modal de INSTRUCCIONES
        // que comparte z-index 1000 con todos los modal-overlay. Sin esto,
        // pulsar "Aviso Legal" abre el modal pero queda tapado por el
        // INSTRUCCIONES que es padre del botón y se renderizó antes.
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowAvisoLegal(false)}>
          <div className="modal-content modal-fullscreen disclaimer-modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚓ {tr("AVISO LEGAL", "LEGAL NOTICE")}</h2>
            <div className="disclaimer-body disclaimer-scroll">
              {lang === "es" ? (
                <>
                  <p className="disclaimer-hero">🚢 Hecho con mucho esfuerzo con IA (ChatGPT/Claude) por un <a href="https://github.com/aitonos" target="_blank" rel="noopener noreferrer">navegante</a> para navegantes</p>
                  <p>Objetivo: simplificar la vida a bordo</p>
                  <p>📜 <a href="https://www.apache.org/licenses/LICENSE-2.0.txt" target="_blank" rel="noopener noreferrer">Licencia Apache 2.0</a></p>
                  <p><strong>🙏 Créditos y agradecimientos:</strong></p>
                  <ul>
                    <li>Basado en <a href="https://github.com/openwatersio/signalk-tides" target="_blank" rel="noopener noreferrer">SignalK-Tides</a>. ¡Gracias, <a href="https://github.com/bkeepers" target="_blank" rel="noopener noreferrer">Bkeepers</a>!</li>
                    <li>A los creadores de <a href="https://signalk.org/" target="_blank" rel="noopener noreferrer"><strong>SignalK</strong></a> y <a href="https://openmarine.net/" target="_blank" rel="noopener noreferrer"><strong>OpenPlotter</strong></a> por el brillante trabajo que están haciendo</li>
                    <li>A toda la comunidad de <strong>código abierto</strong> náutico</li>
                    <li>Grupo de WhatsApp "Náutica Friki"</li>
                    <li>En memoria de <a href="https://github.com/penkamaster" target="_blank" rel="noopener noreferrer">Rafica</a>, compañero de aventuras informáticas y no tan informáticas. ¡En tu honor!</li>
                  </ul>
                  <div className="disclaimer-warning">
                    <p><strong>⚠️ ADVERTENCIA IMPORTANTE</strong></p>
                    <p>Este software se proporciona "tal cual", sin garantías. El uso es bajo la exclusiva responsabilidad del usuario.</p>
                    <p><strong>En ningún caso sustituye al uso de las tablas de mareas oficiales publicadas por el Instituto Hidrográfico de la Marina.</strong></p>
                    <p>NO sustituye: la vigilancia del patrón, las cartas náuticas oficiales, el buen juicio marinero, la responsabilidad del mando a bordo.</p>
                    <p><strong>Navega siempre con prudencia. 🌊</strong></p>
                  </div>
                </>
              ) : (
                <>
                  <p className="disclaimer-hero">🚢 Built with a lot of effort using AI (ChatGPT/Claude) by a <a href="https://github.com/aitonos" target="_blank" rel="noopener noreferrer">sailor</a> for sailors</p>
                  <p>Goal: make life aboard simpler</p>
                  <p>📜 <a href="https://www.apache.org/licenses/LICENSE-2.0.txt" target="_blank" rel="noopener noreferrer">Apache 2.0 License</a></p>
                  <p><strong>🙏 Credits &amp; acknowledgements:</strong></p>
                  <ul>
                    <li>Based on <a href="https://github.com/openwatersio/signalk-tides" target="_blank" rel="noopener noreferrer">SignalK-Tides</a>. Thanks, <a href="https://github.com/bkeepers" target="_blank" rel="noopener noreferrer">Bkeepers</a>!</li>
                    <li>To the creators of <a href="https://signalk.org/" target="_blank" rel="noopener noreferrer"><strong>SignalK</strong></a> and <a href="https://openmarine.net/" target="_blank" rel="noopener noreferrer"><strong>OpenPlotter</strong></a> for the outstanding work</li>
                    <li>To the entire nautical <strong>open-source</strong> community</li>
                    <li>WhatsApp group "Náutica Friki"</li>
                    <li>In memory of <a href="https://github.com/penkamaster" target="_blank" rel="noopener noreferrer">Rafica</a>, companion in IT (and non‑IT) adventures. In your honor!</li>
                  </ul>
                  <div className="disclaimer-warning">
                    <p><strong>⚠️ IMPORTANT WARNING</strong></p>
                    <p>This software is provided "as is", without warranties. Use is entirely at the user's own risk.</p>
                    <p><strong>It does not replace the official tide tables published by the Spanish Hydrographic Institute (IHM).</strong></p>
                    <p>It does NOT replace: the skipper's watch, official charts, good seamanship, or command responsibility on board.</p>
                    <p><strong>Always navigate prudently. 🌊</strong></p>
                  </div>
                </>
              )}
            </div>
            <div className="modal-buttons-fixed">
              <button className="modal-close" onClick={() => setShowAvisoLegal(false)}>{tr("CERRAR", "CLOSE")}</button>
            </div>
          </div>
        </div>
      )}

{/* Modal INSTRUCCIONES */}
      {showInstrucciones && (
        <div className="modal-overlay" onClick={() => { setShowInstrucciones(false); setShowChangelog(false); }}>
          <div className="modal-content modal-fullscreen instrucciones-modal" onClick={(e) => e.stopPropagation()}>
            <div className="instrucciones-body instrucciones-scroll" ref={instrContentRef}>
              {/* Rev536 (feedback Carlos): h2 movido DENTRO del scroll para
                  que se desplace con el contenido en lugar de ocupar altura
                  fija arriba (antes flex-shrink:0 lo dejaba colgado). */}
              <h2 style={{ marginTop: 14 }}>{showChangelog ? tr("Registro de cambios – Versiones", "Changelog – Versions") : "AnchorWatch Pro: Smart Anchoring, AIS & Tides"} – v{snapshot?.pluginVersion ?? "—"}</h2>
              {showChangelog ? (
                changelogLoading ? (
                  <p style={{ color: '#9cc', fontStyle: 'italic' }}>
                    {tr("Cargando historial de cambios…", "Loading changelog…")}
                  </p>
                ) : changelogMd ? (
                  <div
                    className="changelog-md"
                    style={{ fontSize: 16, lineHeight: 1.5, color: '#cfd8dc' }}
                    dangerouslySetInnerHTML={{ __html: (function(md: string, uiLang: string): string {
                      function esc(s: string){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
                      function inl(s: string){
                        s = esc(s);
                        s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(255,178,63,.12);color:#ffb23f;padding:1px 6px;border-radius:3px;font-size:.92em">$1</code>');
                        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff">$1</strong>');
                        s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
                        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#4dd0ff;text-decoration:none">$1</a>');
                        return s;
                      }
                      /* Rev528: filtrar por idioma. CHANGELOG.md tiene secciones
                         `### English` y `### Español` por release. Mostramos solo
                         las del idioma activo. La sección H3 "### English" o
                         "### Español" actúa como switch: a partir de ahí, salto
                         líneas hasta el próximo H3 (otro idioma) o H2 (siguiente
                         release) o H1.
                         También ocultamos los H3 marcadores (no aportan info
                         útil si ya filtras un solo idioma). */
                      const isEs = uiLang === 'es';
                      const langKeepRe = isEs ? /^###\s*Espa(ñ|n)ol\s*$/i : /^###\s*English\s*$/i;
                      const langDropRe = isEs ? /^###\s*English\s*$/i : /^###\s*Espa(ñ|n)ol\s*$/i;
                      const filtered: string[] = [];
                      let drop = false;
                      for (const ln of md.split('\n')){
                        if (langKeepRe.test(ln)){ drop = false; continue; /* skip marker */ }
                        if (langDropRe.test(ln)){ drop = true; continue; }
                        /* Cualquier otro H1/H2 reinicia (release boundary). */
                        if (/^#{1,2}\s/.test(ln)) drop = false;
                        if (!drop) filtered.push(ln);
                      }
                      const lines = filtered;
                      const out: string[] = [];
                      let inCode = false;
                      let listType: 'ul' | 'ol' | null = null;
                      const closeList = () => { if (listType){ out.push('</' + listType + '>'); listType = null; } };
                      for (let i = 0; i < lines.length; i++){
                        const ln = lines[i];
                        if (/^```/.test(ln)){ inCode = !inCode; out.push(inCode ? '<pre style="background:rgba(255,255,255,.06);padding:10px 14px;border-radius:4px;overflow-x:auto"><code>' : '</code></pre>'); continue; }
                        if (inCode){ out.push(esc(ln) + '\n'); continue; }
                        const h = ln.match(/^(#{1,6})\s+(.*)$/);
                        if (h){
                          closeList();
                          const lvl = h[1].length;
                          const color = lvl <= 2 ? '#ffb23f' : '#fff';
                          /* Rev533: tamaños = ~60% de los del visor (24/32 lógicos) porque
                             el modal Instrucciones NO está bajo zoom var(--ui-scale)=0.6
                             tras el fix Rev531. Para verse visualmente igual que Sonda
                             (que SÍ tiene zoom 0.6 → 24×0.6=14.4 visual), nuestros
                             tamaños inline deben estar ya en 14-20px. */
                          const sz = lvl === 1 ? '20px' : lvl === 2 ? '18px' : lvl === 3 ? '17px' : '16px';
                          const border = lvl <= 2 ? ';border-bottom:1px solid rgba(255,178,63,.25);padding-bottom:6px' : '';
                          out.push(`<h${lvl} style="color:${color};font-size:${sz};margin:22px 0 10px${border};font-weight:800">${inl(h[2])}</h${lvl}>`);
                          continue;
                        }
                        const ul = ln.match(/^\s*[-*]\s+(.*)$/);
                        if (ul){ if (listType !== 'ul'){ closeList(); out.push('<ul style="padding-left:24px;margin:8px 0">'); listType = 'ul'; } out.push('<li style="margin:5px 0;font-size:16px">' + inl(ul[1]) + '</li>'); continue; }
                        const ol = ln.match(/^\s*\d+\.\s+(.*)$/);
                        if (ol){ if (listType !== 'ol'){ closeList(); out.push('<ol style="padding-left:24px;margin:8px 0">'); listType = 'ol'; } out.push('<li style="margin:5px 0;font-size:16px">' + inl(ol[1]) + '</li>'); continue; }
                        if (/^\s*$/.test(ln)){ closeList(); continue; }
                        out.push('<p style="margin:8px 0;font-size:16px">' + inl(ln) + '</p>');
                      }
                      closeList();
                      return out.join('\n');
                    })(changelogMd, lang) }}
                  />
                ) : (
                  <p style={{ color: '#f88', fontStyle: 'italic' }}>
                    {tr("CHANGELOG no disponible. Revisa CHANGELOG.md del repositorio del plugin.", "CHANGELOG not available. Check CHANGELOG.md in the plugin repository.")}
                  </p>
                )
              ) : lang === 'es' ? (
                /* Rev527: si el visor está en español, renderizamos el fragmento
                   HTML servido por el plugin (originalmente docs/INSTRUCCIONES_MODAL_v3.html).
                   El JSX hardcoded EN de debajo solo se usa cuando lang==='en'. */
                instrEsLoading ? (
                  <p style={{ color: '#9cc', fontStyle: 'italic' }}>Cargando manual…</p>
                ) : instrEsHtml ? (
                  <div className="instr-es-content" dangerouslySetInnerHTML={{ __html: instrEsHtml }} />
                ) : (
                  <p style={{ color: '#f88', fontStyle: 'italic' }}>Manual no disponible. Revisa public/instrucciones_es.html.</p>
                )
              ) : (
                <>
                  <div style={{ background: 'rgba(220,40,40,0.12)', borderLeft: '5px solid #ff6b6b', padding: '16px 18px', margin: '0 0 18px', borderRadius: 4 }}>
                    <strong style={{ color: '#ff8a8a', fontSize: 20, display: 'block', marginBottom: 8 }}>
                      ⚠ {tr("AVISO DE SEGURIDAD", "SAFETY NOTICE")}
                    </strong>
                    <span style={{ fontSize: 18, lineHeight: 1.5 }}>
                      {tr(
                        "Este plugin es una ayuda a la navegación. NO sustituye la vigilancia del patrón, una maniobra de fondeo correcta, las cartas y avisos oficiales, ni la observación directa del entorno. Las estimaciones dependen de la calidad y actualidad de los datos de sensores entrantes.",
                        "This plugin is a navigation aid. It does NOT replace the skipper's watch, a correct anchoring manoeuvre, official charts and notices, or direct observation of the surroundings. Estimates depend on the quality and currency of the incoming sensor data."
                      )}
                    </span>
                  </div>

                  <p style={{ fontSize: 18, color: '#cfe6f5', margin: '0 0 14px' }}>
                    {tr(
                      "Este plugin tiene dos grandes áreas: el ",
                      "This plugin has two large areas: the "
                    )}
                    <strong>AnchorWatch Pro: Smart Anchoring, AIS &amp; Tides</strong>
                    {tr(
                      " (vigilancia del ancla, AIS, abrigo, alarmas) y el módulo ",
                      " (anchor watch, AIS, shelter, alarms) and the "
                    )}
                    <strong>{tr("Mareas IHM", "IHM Tides")}</strong>
                    {tr(
                      ", que sirve datos oficiales de marea española a Signal K y alimenta los cálculos predictivos del gestor.",
                      " module, which serves official Spanish tide data to Signal K and feeds the manager's predictive calculations."
                    )}
                  </p>

                  <p style={{ fontSize: 16, color: '#9ad', fontStyle: 'italic', margin: '0 0 18px' }}>
                    💡 {tr(
                      "Para ver el detalle de qué novedades trae cada versión, pulsa el botón ",
                      "For details on what each version brings, press the "
                    )}
                    <strong style={{ color: '#ffb23f' }}>{tr("VERSIONES", "CHANGELOG")}</strong>
                    {tr(
                      " arriba. Siempre refleja exactamente la versión del plugin instalado.",
                      " button at the top. It always reflects the exact version of the plugin you have installed."
                    )}
                  </p>


                  <h3>1. What it does</h3>
                  <p>Combines the boat's real sensors (GPS, depth, wind, IMU if any) with weather forecast and official tide data to monitor the anchorage continuously. The watch runs in the backend (Signal K server on the boat), so alarms remain active even if you close the browser on phone or tablet.</p>

                  <h3>2. Minimum setup</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>2.1 Signal K plugins</h4>
                  <ul>
                    <li><strong>Essential — GPS:</strong> <code>navigation.position</code> must be published by some NMEA0183/NMEA2000 driver or equivalent.</li>
                    <li><strong>Recommended — Sun and magnetic variation:</strong> <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> with the Sun option enabled.</li>
                    <li><strong>Optional — AIS:</strong> any connection with an AIS receiver. The Signal K server processes it automatically.</li>
                    <li><strong>Optional — depth and wind:</strong> the transducer driver publishing standard <code>environment.depth.*</code> and <code>environment.wind.*</code> paths.</li>
                    <li><strong>Optional — IMU:</strong> <code>navigation.attitude</code> and acceleration paths. Lets the plugin estimate boat motion; not a substitute for an oceanographic buoy.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>2.2 Vessel data</h4>
                  <p>In <em>Signal K → Server → Settings → Vessel Base Data</em> set at least: <strong>Draft</strong> (used by grounding alarm and effective draft); <strong>Length / LOA</strong> (used by swing-circle geometry); <strong>Beam</strong> (optional). If you have a bow roller above the waterline, the viewer asks for its <strong>height above waterline</strong> in the ⚓ Anchor Calc panel.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>2.3 Recommended onboard hardware</h4>
                  <ul>
                    <li><strong>Onboard computer:</strong> Raspberry Pi 3B+ or better with OpenPlotter V4 (or equivalent Signal K + Node.js install). Runs the plugin backend, the alarm audio and serves client devices (phone, tablet).</li>
                    <li><strong>USB self-amplified speaker:</strong> essential for alarms to be audible. The Pi's analog jack alone is weak; a USB speaker with its own amplifier covers the whole cabin and deck. Any ALSA-compatible model works. The viewer detects and picks the USB output first.</li>
                    <li><strong>GPS (NMEA0183 or NMEA2000):</strong> essential. No position means no anchoring, no AIS, nothing. Must publish <code>navigation.position</code>.</li>
                    <li><strong>Depth sounder (NMEA0183/NMEA2000):</strong> strongly recommended. Without depth there is no reliable scope calculation or grounding alarm. Any transducer publishing <code>environment.depth.belowSurface</code>, <code>belowKeel</code> or <code>belowTransducer</code>.</li>
                    <li><strong>Anemometer (NMEA0183/NMEA2000):</strong> recommended. Enables the "Veleta" badge in the viewer and the real-time shelter-grade downgrade. Without it, you work only with weather forecast.</li>
                    <li><strong>AIS receiver (NMEA0183/NMEA2000):</strong> optional but very useful in busy bays. Enables AIS proximity watch and the intrusion alarm in your red circle.</li>
                    <li><strong>IMU / attitude sensor:</strong> optional. If you have pypilot, MacArthur HAT or a raw I2C IMU, enables on-board wave estimation (direction, period, apparent height) and the 24 h history. Without it, shelter relies only on forecast wind.</li>
                    <li><strong>Internet connection (4G/WiFi):</strong> optional but recommended for weather forecast, Open-Meteo tides (outside IHM coverage) and internet AIS data. The plugin works offline with a local cache of 2+ months.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>2.4 Audio</h4>
                  <p>The primary safety output is the boat's onboard computer (typically a Raspberry Pi). The backend picks the available output automatically in order: USB → analog → HDMI. On phones, tablets and other client devices, the alarm plays <strong>if</strong> the tab is open and the browser has authorised audio. A web application cannot guarantee sound when the device is silenced, in do-not-disturb mode, the tab is suspended or the browser blocks autoplay. Consider client-side audio <strong>complementary</strong>, not a substitute for the Pi audio.</p>

                  <h3>3. How to anchor properly (recommended manoeuvre)</h3>
                  <p>The manager watches the anchorage. It does not anchor for you. For the alarms to be reliable, the manoeuvre must be correct:</p>
                  <ol style={{ paddingLeft: 22 }}>
                    <li style={{ marginBottom: 8 }}><strong>Slow approach</strong> into the dominant wind or current. Reach the chosen spot at idle.</li>
                    <li style={{ marginBottom: 8 }}><strong>Full stop on the spot.</strong> SOG = 0, bow into wind. The boat will start drifting slowly astern.</li>
                    <li style={{ marginBottom: 8 }}><strong>Drop the anchor</strong> at that instant and <strong>press DROP ANCHOR immediately.</strong> The system saves the boat's GPS position as the initial anchor estimate.</li>
                    <li style={{ marginBottom: 8 }}><strong>Pay out chain</strong> following the astern drift (engine in neutral or very gentle reverse). The chain must extend in a line on the seabed, never piled on top of the anchor.</li>
                    <li style={{ marginBottom: 8 }}><strong>Pay out the proper scope</strong> by mode: <em>Provisional</em> (3.5:1), <em>Normal</em> (5:1, recommended), <em>Safe</em> (8:1, bad weather or overnight). The viewer computes chain needed.</li>
                    <li style={{ marginBottom: 8 }}><strong>Tension with reverse engine</strong> progressively until the chain is taut.</li>
                    <li style={{ marginBottom: 8 }}><strong>Check the set.</strong> Keep reverse a few seconds at moderate-to-strong RPM. If the boat stays still → anchor set. If it keeps moving aft → dragging: lift and start over from step 1.</li>
                    <li style={{ marginBottom: 8 }}><strong>Enable Anchor Watch</strong> and adjust the safety zone margin (see section 4).</li>
                    <li><strong>Watch for several minutes</strong> before going ashore. Confirm with the GPS track that the swing pattern is stable.</li>
                  </ol>
                  <h4 style={{ margin: '12px 0 4px' }}>3.1 Chain calculation methods</h4>
                  <ul>
                    <li><strong>Scope ratio:</strong> L = scope × D, where D is the maximum predicted vertical distance between roller and seabed in the chosen horizon. Scope 3.5:1 / 5:1 / 8:1 by mode.</li>
                    <li><strong>Vicente formula:</strong> L = 15 + 2 × D (metres). Useful as a second opinion.</li>
                  </ul>
                  <p style={{ fontSize: 14, opacity: 0.85, fontStyle: 'italic' }}>Technical clarification: this is a geometric anchoring calculation based on scope ratio, not a full physical catenary model (no chain linear weight or horizontal tension — just depth, predictive tide and bow roller height).</p>

                  <h3>4. Anchor position and watch circles</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>4.1 The ⚓ icon</h4>
                  <p>The ⚓ icon represents an <strong>estimated position</strong>. Pressing DROP ANCHOR stores the boat's GPS at that instant — not the exact physical anchor location on the seabed. The difference depends on the GPS antenna location, drift during chain payout and anchor displacement while setting. The anchor does occupy a definite position on the seabed, even though uncertainty exists about it.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.2 Blue circle — boat's maximum swing</h4>
                  <p>Centred on the ⚓ icon, represents the maximum distance the boat's <strong>stern</strong> can reach from the anchor in the chosen horizon (typically 12 h):</p>
                  <div style={{ background: 'rgba(77,208,255,0.10)', borderLeft: '3px solid #4dd0ff', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>blue = R_chain + LOA</div>
                  <p>Where <strong>R_chain</strong> = horizontal projection of paid-out chain (current depth + max predicted tide variation + roller height). <strong>LOA</strong> = boat length overall.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.3 Red circle — safety zone</h4>
                  <p>Adds a configurable margin (slider) to the blue. It has <strong>two simultaneous functions</strong>:</p>
                  <ol style={{ paddingLeft: 22 }}>
                    <li style={{ marginBottom: 6 }}><strong>AIS proximity watch:</strong> any AIS target entering the red (plus its own LOA) triggers an alarm. The larger the extra, the larger the minimum distance you require from neighbours. Useful in busy bays.</li>
                    <li><strong>Drag alarm for own boat:</strong> if the GPS leaves the red (with 2 m hysteresis to absorb GPS noise), the drag alarm fires.</li>
                  </ol>
                  <h4 style={{ margin: '12px 0 4px' }}>4.4 Operative rule</h4>
                  <p>What matters is not that the ⚓ icon is on the exact centimetre, but that the <strong>blue circle envelops every real swing</strong> of the boat. If the boat brushes the blue boundary habitually, pay out more chain. The red extra you choose by context: solitary anchorage low (5–10 m), busy bays high.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.5 Correcting a mis-marked position</h4>
                  <ul>
                    <li><strong>From the GPS track:</strong> after anchoring and reversing, the track draws a curve tightening sternward. The point where that tension begins is very close to where the anchor hit bottom.</li>
                    <li><strong>By inferring from paid-out chain:</strong> with chain taut, the anchor sits roughly the horizontal chain length ahead of the bow.</li>
                    <li><strong>Drag the ⚓ icon</strong> on the map to the correct point, or enter exact coordinates manually.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>4.6 Paying out more chain or re-tensioning</h4>
                  <p>Pay out chain, re-tension with reverse and open ⚓ Anchor Calc to update length. The blue circle adjusts to the new swing radius. If the red ring is now too tight, raise it with the slider on the alarm panel.</p>

                  <h3>5. Continuous watch</h3>
                  <ul>
                    <li><strong>Drag alarm:</strong> if the boat's GPS exceeds the red circle (2 m hysteresis), siren and voice fire. The siren bypasses user mute within the limits of the OS and browser.</li>
                    <li><strong>Auto-disarm when leaving under engine:</strong> if SOG stays above <strong>3 knots for 30 seconds straight</strong>, the plugin assumes intentional departure and disarms the watch. Real dragging rarely exceeds 1–2 kn; sustained motion &gt; 3 kn is almost always own propulsion. You get an info notification in Signal K. In areas of very strong current (rías, straits) bear this in mind.</li>
                    <li><strong>GPS track with time gradient:</strong> dark = old, bright = recent.</li>
                    <li><strong>Favourite anchorages:</strong> save with custom or auto-name. Synced across devices.</li>
                  </ul>

                  <h3>6. Real sensors (wind, IMU, depth)</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>6.1 Wind</h4>
                  <p>Reads <code>environment.wind.angleApparent</code> + <code>speedApparent</code> from Signal K. The "Veleta" badge marks real data vs forecast.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>6.2 IMU and boat motion</h4>
                  <p>If you have pypilot or an IMU, the plugin reads <code>navigation.attitude</code> and acceleration to <strong>estimate</strong> wave direction, period and apparent height. 24 h history in 5-minute bars visible from the shelter popup. These are estimates derived from boat behaviour, <strong>not certified oceanographic measurements</strong>: precision depends on algorithm, calibration, sensor position, hull and mooring. <code>/api/imu/status</code> endpoint for diagnostics.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>6.3 Depth</h4>
                  <p>The reading is valid only if: (1) last update arrived less than <strong>5 seconds</strong> ago (timestamp), (2) not frozen (change &gt; ±2 cm in 60 s), (3) not an anomalous spike or absurd value. If any check fails, the viewer shows <strong>SOUNDER FROZEN</strong> or <strong>SOUNDER STALE</strong> instead of the last number, preventing the system from "inventing" depth.</p>

                  <h3>7. AIS proximity watch</h3>
                  <p>Detects AIS targets inside the red circle. <strong>This is geometric proximity alarm, not a CPA/TCPA-based anti-collision system.</strong> It does not predict relative trajectories; it reacts when an AIS enters the zone.</p>
                  <ul>
                    <li><strong>Persistent database (72 h):</strong> stores name, length, beam, type, callsign and IMO of every boat seen. On restart, names are ready without waiting for the next AIS static packet (up to 6 min).</li>
                    <li><strong>Ghost cache (5 min):</strong> if VHF reception is briefly lost, the target stays visible with a discrete X and "estimated data" notice with data age.</li>
                    <li><strong>Radius slider (0.5–50 km):</strong> controls how many boats appear on map and list. Persisted.</li>
                    <li><strong>Filterable and sortable list:</strong> by distance, name, favourites, MMSI or type. Filter box with "No results" feedback.</li>
                    <li><strong>Favourites:</strong> mark with the yellow ★. Persisted in backend and synced across devices.</li>
                    <li><strong>Type-specific icons:</strong> ⛵ sailing, 🛥️ pleasure, 📦 cargo, 🛢️ tanker, 🛳️ passenger, 🎣 fishing…</li>
                    <li><strong>🔍 vesselfinder button:</strong> opens vesselfinder.com in a new tab with IMO + MMSI.</li>
                    <li><strong>Proximity alarm:</strong> AIS inside the red (considering its own LOA) → voice alarm after grace period. ACK silences that MMSI without affecting the others.</li>
                    <li><strong>Reactivation on closing:</strong> an ACKed AIS resuming motion towards you (&gt; 0.5 kn, closing &gt; 5 m/min) reactivates the alarm. ACK expires after 15 min.</li>
                    <li><strong>Click-to-focus:</strong> click an AIS → the map centres and follows it, showing live distance. The X on the ring deselects.</li>
                  </ul>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4 }}>
                    <strong>AIS limit:</strong> not all boats transmit AIS; data may arrive late or contain errors. Keep visual and radar watch when appropriate.
                  </div>

                  <h3>8. Shelter indicator</h3>
                  <p>Automatic analysis of how exposed your anchorage is to the forecast wind in the next 12 h. It is a <strong>geometric exposure indicator</strong>, not a shelter guarantee: it does not incorporate terrain height, real fetch, refraction, diffraction or bathymetric effects.</p>
                  <ul>
                    <li><strong>16-sector rose:</strong> automatic detection of sectors with coast/man-made structure nearby (green = sheltered) vs. open sea (red). Uses OpenStreetMap (natural coastline + man-made breakwaters/piers).</li>
                    <li><strong>A–F grade and % protection:</strong> A = fully sheltered geometrically; F = exposed to gale. % from forecast wind in exposed sectors over 12 h.</li>
                    <li><strong>12 h hourly strip:</strong> grade per hour and peak wind. Click a cell for detail.</li>
                    <li><strong>Estimated wave history (24 h):</strong> intensity/period/height derived from IMU. One bar every 5 minutes, autoscaling vertical axis up to 2 m.</li>
                    <li><strong>Real-time downgrade:</strong> if the anemometer reads more wind than forecast in an exposed sector, the A–F grade is downgraded and "▼ Real · Wind" appears. Same with estimated waves: "▼ Real · Waves". Calm/light bands do NOT downgrade the grade.</li>
                  </ul>

                  <h3>9. Anchoring calculator and grounding alarm</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>9.1 Anchoring calculator</h4>
                  <p>Estimates recommended chain and swing radius for the chosen horizon (typically 12 h). Uses the maximum predicted vertical distance between roller and seabed during that period. Publishes optionally to Signal K: scope ratio, anchoring recommendation summary, chain to deploy and swing radius (current and maximum). If the minimum predicted depth falls below effective draft, a blinking red alert appears.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>9.2 Grounding alarm</h4>
                  <p>Effective draft is defined as:</p>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>effective_draft = (base_draft + safety_margin) × 1.15</div>
                  <p>The alarm compares projected future depth with that effective draft. Projection formula:</p>
                  <div style={{ background: 'rgba(77,208,255,0.10)', borderLeft: '3px solid #4dd0ff', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>future_depth = current_depth + (current_tide − future_tide)</div>
                  <ul>
                    <li><strong>24 h warning:</strong> detects risk in the next 24 h.</li>
                    <li><strong>Advance alarm:</strong> warns X minutes before running out of clearance, with sound.</li>
                    <li><strong>Snooze:</strong> postpones without clearing the risk.</li>
                    <li><strong>Mute sound:</strong> disables audio but keeps visual alert and SK state.</li>
                  </ul>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4 }}>
                    <strong>Tide source suitability for the grounding alarm:</strong> synthetic sources (Mediterranean M2, No tide) and Open-Meteo (rebased to an approximate local level, not real Chart Datum) are fine for visualisation. For the grounding alarm use an official IHM station within its coverage. If you pick a synthetic station, treat the warning as informational only.
                  </div>

                  <h3>10. Multi-device audio</h3>
                  <p>Primary output from the boat's Pi: synthetic siren + pre-recorded voice (OGG) in the chosen language. If no OGG, automatic fallback to TTS (espeak). Output selection: USB → analog → HDMI. Replicated on connected client devices (phone, tablet) if their tab is open and audio is authorised. Client replication is complementary, not more reliable than local Pi audio.</p>

                  <h3>11. Map and layers</h3>
                  <ul>
                    <li>Esri Satellite (default), Bing Hybrid, Esri Clarity, Google Satellite.</li>
                    <li>OpenStreetMap, OpenSeaMap.</li>
                    <li>Official IHM charts (WMS), Bathymetry.</li>
                    <li>Offline MBTiles charts with opacity slider: copy your <code>.mbtiles</code> to the charts folder (typically <code>/home/pi/charts/</code> in OpenPlotter) and they appear as checkboxes.</li>
                  </ul>
                  <p style={{ fontSize: 14, opacity: 0.85, fontStyle: 'italic' }}>No non-official layer should be presented as a substitute for current official nautical cartography.</p>

                  <p style={{ fontSize: 18, color: '#9bb4c8', fontStyle: 'italic', margin: '24px 0 8px', borderTop: '1px dashed rgba(255,255,255,0.18)', paddingTop: 18 }}>
                    Next, the tides module that feeds the anchor manager with official data:
                  </p>

                  <h2 style={{ borderBottom: '2px solid rgba(77,208,255,0.4)', paddingBottom: 6, marginTop: 4, color: '#4dd0ff' }}>📊 TIDES MODULE (IHM)</h2>

                  <h3>12. Data sources and safety suitability</h3>
                  <ul>
                    <li><strong>Official IHM (~70 stations):</strong> official astronomical prediction by the Spanish Hydrographic Institute for the whole Spanish coast (mainland, Balearic and Canary Islands). Monthly data with coefficient. Referred to each station's <strong>Chart Datum</strong>. Centimetric publication resolution; actual level may deviate due to pressure, wind, swell or river inflow.</li>
                    <li><strong>🌍 Open-Meteo global:</strong> worldwide forecast for any lat/lon, hydrodynamic model. 12 h refresh. No API key. The plugin adjusts data to an approximate local level (typically weekly low water ≈ 0). <strong>Not official Chart Datum</strong>; a useful approximation for relative consultation. For grounding alarm, calibrate locally before trusting the warning.</li>
                    <li><strong>Mediterranean:</strong> synthetic sinusoidal M2 curve (≈ 0.2 m amplitude). Visualisation only where astronomical tide is negligible.</li>
                    <li><strong>No tide / Offshore:</strong> flat curve (Δ = 0 m). Allows the anchor viewer to start with no internet or coverage. Does not represent real level.</li>
                  </ul>
                  <p>In the dropdown, synthetic stations appear <strong>first</strong> in MANUAL (quick access) and <strong>last</strong> in AUTO (the "nearest" must be a real IHM).</p>

                  <h3>13. Automatic and manual selection</h3>
                  <ul>
                    <li><strong>AUTOMATIC:</strong> detects the nearest station by GPS (300 km radius). You can mark a "favourite": AUTO keeps tracking the nearest but remembers your favourite if you return.</li>
                    <li><strong>MANUAL:</strong> pick any station, including synthetic ones. Useful outside GPS range or for consulting another area.</li>
                  </ul>
                  <p>If there is no GPS at startup, the plugin currently falls back to Vigo. When GPS arrives, it switches automatically to the nearest valid station. While in the fallback, the displayed tide may not correspond to your real position.</p>

                  <h3>14. Curves, time and vertical reference</h3>
                  <p>Press <strong>CURVES</strong> to open the interactive SVG chart. Shows extremes (high and low water), current-time marker and sinusoidal interpolation. <strong>Horizontal axis:</strong> station local time (Europe/Madrid or Atlantic/Canary). <strong>Vertical axis:</strong> height in metres above the source reference — Chart Datum for IHM, approximate local level for Open-Meteo, relative height for synthetic sources.</p>

                  <h3>15. Coefficient, solar and current</h3>
                  <ul>
                    <li><strong>Tide coefficient:</strong> official IHM coefficient, downloaded from the annual PDF. Values &gt; 90 mean large tidal ranges; &lt; 40 neap tides.</li>
                    <li><strong>Solar data:</strong> sunrise and sunset. Requires GPS + <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> with Sun active.</li>
                    <li><strong>🧭 Tactical navigation Rías Baixas:</strong> experimental and informational feature. Tactical advice based on tide phase (flooding/ebbing) and percentage. Real local current also depends on the channel and offsets between level and current — a complement, not absolute truth.</li>
                  </ul>

                  <h3>16. Cache and offline operation</h3>
                  <p>Local cache of more than 2 months of IHM data. Auto-update every 48 h when connected. First boot without internet: hardcoded stations as fallback.</p>

                  <h3>❓ Frequently Asked Questions</h3>
                  <h4 style={{ margin: '10px 0 4px' }}>About anchoring</h4>
                  <ul>
                    <li><strong>Does the ⚓ icon mark the exact anchor position?</strong> → No. It is the boat's GPS at the moment of pressing DROP ANCHOR. The real anchor location may be a few metres off. What matters is that the blue circle envelops every real swing.</li>
                    <li><strong>What's the difference between blue and red?</strong> → Blue = maximum stern reach (chain + LOA). Red = blue + configurable margin. It works simultaneously as AIS proximity watch zone and as drag-alarm threshold (2 m hysteresis).</li>
                    <li><strong>Can I move the anchor if I marked it wrong?</strong> → Yes: drag the ⚓ icon or enter coordinates manually. Circles recentre instantly.</li>
                    <li><strong>How to change scope or chain mid-anchor?</strong> → Open ⚓ Anchor Calc, change mode or length. Blue updates. Adjust red with the slider if you need more margin.</li>
                    <li><strong>Does the alarm work if I close the browser?</strong> → Yes. The watch runs in the Pi backend. Pi audio and SK notifications stay active. Connected web clients ring in parallel if their tab is open.</li>
                    <li><strong>Why does it sometimes auto-disarm?</strong> → If your SOG exceeds 3 knots for 30 s straight, we assume intentional departure. Real dragging rarely exceeds 1–2 kn. If you expect very strong currents, bear in mind.</li>
                    <li><strong>What does "SOUNDER FROZEN" mean?</strong> → No updates in &gt; 5 s, or fixed value (±2 cm in 60 s), or anomalous spike. Instead of showing a misleading number, the viewer declares it explicitly.</li>
                  </ul>
                  <h4 style={{ margin: '10px 0 4px' }}>About Signal K and setup</h4>
                  <ul>
                    <li><strong>No GPS position?</strong> → Check that <code>navigation.position</code> is published. You need a GPS receiver and its driver active.</li>
                    <li><strong>What SK plugin do I need for sunrise/sunset?</strong> → <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> with Sun enabled.</li>
                    <li><strong>Where do I set draft?</strong> → Signal K → Server → Settings → Vessel Base Data → Draft. Used by the grounding alarm and the +15% effective draft.</li>
                  </ul>
                  <h4 style={{ margin: '10px 0 4px' }}>About tides</h4>
                  <ul>
                    <li><strong>Is the time UTC?</strong> → No, station local time.</li>
                    <li><strong>Does it work offline?</strong> → Yes, 2+ months local cache.</li>
                    <li><strong>Can I use a synthetic tide for the grounding alarm?</strong> → Not recommended. Mediterranean M2 and "No tide" are approximate; Open-Meteo is rebased to an approximate local level but is not real Chart Datum. Use an official IHM station.</li>
                    <li><strong>What is Chart Datum?</strong> → IHM's vertical datum, roughly the lowest astronomical tide of the year.</li>
                    <li><strong>Why does Open-Meteo differ from IHM at the same location?</strong> → IHM uses Chart Datum; Open-Meteo uses locally-adjusted MSL. They can differ by tens of cm.</li>
                    <li><strong>Supported browsers?</strong> → Firefox and Chromium (OpenPlotter default). Optimized 1920×1080, responsive on mobile/tablet.</li>
                  </ul>
                </>
              )}

              {!showChangelog && (
              <>
              <h2 style={{ borderBottom: '2px solid rgba(255,255,255,0.25)', paddingBottom: 6, marginTop: 24 }}>📡 {tr("Paths publicados en Signal K", "Signal K published paths")}</h2>
              <p style={{ opacity: 0.85, fontSize: 15 }}>{tr("Referencia técnica completa de todos los paths que este plugin publica al servidor Signal K (gestor de fondeo + mareas + meteo + abrigo).", "Full technical reference of every path this plugin publishes to the Signal K server (anchor manager + tides + weather + shelter).")}</p>
              <h3 style={{ marginTop: 0 }}>{tr("Tabla de paths", "Paths table")}</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>Path</th>
                    <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>{tr("Descripción", "Description")}</th>
                  </tr></thead>
                  <tbody>
                    {publishedPaths.length ? publishedPaths.map((r) => (
                      <tr key={r.path}>
                        <td style={{ verticalAlign: 'top', padding: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}><code>{r.path}</code></td>
                        <td style={{ verticalAlign: 'top', padding: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{r.description || ''}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} style={{ padding: '6px', opacity: 0.8 }}>{tr("(Cierra y abre de nuevo)","(Close and reopen)")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
              )}
              <p style={{ marginTop: 14, fontSize: 13 }}>
                {tr("Dudas: tradesolutions@gmail.com — asunto: MAREAS (IHM)","Questions: tradesolutions@gmail.com — subject: MAREAS (IHM)")}
              </p>
            </div>
            {/* Search results panel */}
            {showSearchPanel && searchResults.length > 0 && (
              <div className="search-results-panel">
                <div className="search-results-header">
                  <span>{instrMatchCount} {tr("resultados", "results")}</span>
                  <button onClick={() => { setShowSearchPanel(false); setInstrSearch(""); }} style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                </div>
                <div className="search-results-list">
                  {(() => {
                    const grouped: Record<string, typeof searchResults> = {};
                    searchResults.forEach(r => { (grouped[r.section] ??= []).push(r); });
                    return Object.entries(grouped).map(([section, items]) => (
                      <div key={section} className="search-group">
                        <div className="search-group-title">{section}</div>
                        {items.slice(0, 5).map((r, i) => (
                          <div key={i} className="search-result-item" onClick={() => { r.element.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                            {r.snippet}
                          </div>
                        ))}
                        {items.length > 5 && <div className="search-result-more">+{items.length - 5} {tr("más", "more")}</div>}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
            <div className="modal-buttons-fixed" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="ctrl-btn" style={{ background: 'rgba(255,255,255,0.12)', flex: '0 0 auto', padding: '10px 16px' }} onClick={() => { setShowChangelog(!showChangelog); setInstrSearch(""); }}>
                {showChangelog ? tr("INSTRUCCIONES", "INSTRUCTIONS") : tr("VERSIONES", "CHANGELOG")}
              </button>
              <button className="ctrl-btn" style={{ background: 'rgba(255,152,0,0.15)', flex: '0 0 auto', padding: '10px 16px', color: '#ff9800', border: '1px solid #ff9800' }} onClick={() => setShowAvisoLegal(true)}>
                {tr("AVISO LEGAL", "LEGAL")}
              </button>
              {/* Rev245: botón CERRAR eliminado — el modal se cierra con
                  el ‹ Atrás del header iOS del popup-overlay del Hamburger,
                  que reabre el menú (back-stack). */}
              <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Rev543: input igualado a los botones VERSIONES/AVISO LEGAL
                    (height auto via padding 6/12, font 13, min-height 30). */}
                <input type="text" value={instrSearch} onChange={(e) => setInstrSearch(e.target.value)} placeholder={tr("🔍 Buscar...", "🔍 Search...")} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', color: 'white', padding: '6px 12px', fontSize: '13px', width: '170px', fontWeight: 600, minHeight: '30px', boxSizing: 'border-box' }} />
                {instrSearch.length >= 2 && <span style={{ fontSize: '13px', opacity: 0.85, fontWeight: 700, color: '#66ffaa' }}>{instrMatchCount > 0 ? instrMatchCount : "0"}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
{/* Modal ALARMA */}
      {/* v1.128: Risk popup when opening alarm window with physical risk but alarm off */}
      {showRiskPopup && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setShowRiskPopup(false)}>
          <div className="risk-popup" onClick={(e) => e.stopPropagation()}>
            <button className="risk-popup-close" onClick={() => setShowRiskPopup(false)}>✕</button>
            <div className="risk-popup-icon">⚠️</div>
            <div className="risk-popup-text">
              <strong>{tr("OJO: Alarma desactivada", "WARNING: Alarm is OFF")}</strong><br />
              {tr("Riesgo de varada", "Grounding risk")}{riskTimeStr ? ` ${tr("a partir de las", "from")} ${riskTimeStr}` : ""}
            </div>
          </div>
        </div>
      )}
      {showAlarma && (
        <div className="modal-overlay" onClick={() => { saveAlarma(); setShowAlarma(false); }}>
          <div className="modal-content modal-fullscreen alarma-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔔 {tr("ALARMA DE CALADO", "DRAFT ALARM")}</h2>
            <div className="alarma-body alarma-scroll">
              <div className="alarma-field">
                <label className="alarma-toggle">
                  <input
                    type="checkbox"
                    checked={alarmaConfigLocal?.enabled ?? false}
                    onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, enabled: e.target.checked } : null)}
                  />
                  <span className="toggle-slider" />
                  <span className="toggle-label">{tr("Alarmas activadas", "Alarms enabled")}</span>
                </label>
              </div>

              <div className="alarma-section">
                <h3>{tr("Tipos de alerta:", "Alert types:")}</h3>

                <div className="alarma-field">
                  <label className="alarma-checkbox">
                    <input
                      type="checkbox"
                      checked={alarmaConfigLocal?.alertOnArrival ?? true}
                      onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, alertOnArrival: e.target.checked } : null)}
                      disabled={!alarmaConfigLocal?.enabled}
                    />
                    <span>{tr("Aviso al llegar a zona con riesgo (próximas 24h)", "Warning on arrival to a risk area (next 24h)")}</span>
                  </label>
                </div>

                <div className="alarma-field">
                  <label className="alarma-checkbox">
                    <input
                      type="checkbox"
                      checked={alarmaConfigLocal?.alertBeforeGrounding ?? true}
                      onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, alertBeforeGrounding: e.target.checked } : null)}
                      disabled={!alarmaConfigLocal?.enabled}
                    />
                    <span>{tr("Alarma X minutos antes de quedarse sin calado", "Alarm X minutes before you lose under-keel clearance")}</span>
                  </label>
                </div>

                <div className="alarma-inline-row">
                  <div className="alarma-field">
                    <label>{tr("Minutos de anticipación", "Minutes in advance")}</label>
                    <input type="number" className="alarma-input" step="5" min="15" max="120"
                      value={alarmaConfigLocal?.minutesBefore ?? 60}
                      onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, minutesBefore: parseInt(e.target.value) || 60 } : null)}
                      disabled={!alarmaConfigLocal?.enabled}
                    />
                  </div>
                  <div className="alarma-field">
                    <label>{tr("Margen de seguridad (metros)", "Safety margin (meters)")}</label>
                    <input type="number" className="alarma-input" step="0.1" min="0" max="5"
                      value={alarmaConfigLocal?.safetyMargin ?? 0.5}
                      onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, safetyMargin: parseFloat(e.target.value) || 0.5 } : null)}
                      disabled={!alarmaConfigLocal?.enabled}
                    />
                  </div>
                </div>
              </div>

              {/* v1.1.0: Mute sound toggle (keeps visual alerts active) */}
              <div className="alarma-section">
                <h3>{tr("Sonido:", "Sound:")}</h3>
                <div className="alarma-field">
                  <label className="alarma-toggle">
                    <input
                      type="checkbox"
                      checked={!(alarmaConfigLocal?.soundMuted ?? false)}
                      onChange={(e) => setAlarmaConfigLocal((p) => p ? { ...p, soundMuted: !e.target.checked } : null)}
                      disabled={!alarmaConfigLocal?.enabled}
                    />
                    <span className="toggle-slider" />
                    <span className="toggle-label">{tr("Sonido de alarma activado", "Alarm sound enabled")}</span>
                  </label>
                  <p style={{ fontSize: '13px', opacity: 0.7, marginTop: 6 }}>
                    {tr("Si desactivas el sonido, la alarma visual seguirá funcionando.", "If you mute the sound, visual alerts will still work.")}
                  </p>
                </div>
              </div>

              <div className="alarma-info">
                <p>{tr("ℹ️ La alarma considera calado del barco + margen de seguridad + 15% adicional (por defecto) y avisa si detecta riesgo según la evolución de la marea.", "ℹ️ The alarm uses vessel draft + safety margin + an extra 15% (default) and warns when a grounding risk is detected based on tide evolution.")}</p>
              </div>
            </div>

            <div className="modal-buttons-fixed">
              <button className="modal-close" onClick={() => { saveAlarma(); setShowAlarma(false); }}>{tr("CERRAR", "CLOSE")}</button>
            </div>
          </div>
        </div>
      )}
    </>, document.body)}

{/* Modal FONDEO / CATENARIA */}
{showAnchor && createPortal(
  <div className="modal-overlay" onClick={() => { setShowAnchor(false); setShowScopeHelp(false); }}>
    <div className="modal-content modal-fullscreen anchor-modal" onClick={(e) => e.stopPropagation()}>
      <h2>⚓ {tr("Cálculo de Fondeo", "Anchoring Calculator")}</h2>

      <div className="anchor-scroll-body">
        {/* Green title box + mode selector */}
        <div className="anchor-type-box">
          <div className="anchor-type-header">
            <span>{tr("Tipo de fondeo y ratio de cadena", "Anchoring type and chain ratio")}</span>
            <button className="anchor-help-btn" onClick={() => setShowScopeHelp(!showScopeHelp)}>?</button>
          </div>
          {showScopeHelp && (
            <div className="anchor-help-popup">
              <p><strong>{tr("Provisional", "Provisional")} ({anchorCfg.scopeBasic} : 1):</strong> {tr("Fondeo corto o de espera. Buen tiempo, fondo de arena, poco viento. Mínimo aceptable.", "Short or waiting anchorage. Fair weather, sand bottom, light wind. Minimum acceptable.")}</p>
              <p><strong>Normal ({anchorCfg.scopeNormal} : 1):</strong> {tr("Condiciones normales. Recomendado por defecto para la mayoría de situaciones.", "Normal conditions. Recommended default for most situations.")}</p>
              <p><strong>{tr("Seguro", "Safe")} ({anchorCfg.scopeHard} : 1):</strong> {tr("Fondeo de seguridad. Mal tiempo, temporal, fondo malo, noche o fondeo prolongado.", "Safety anchoring. Heavy weather, storm, poor holding, overnight or extended stay.")}</p>
            </div>
          )}
          <div className="anchor-mode-btns anchor-mode-wide">
            {(["basic", "normal", "hard"] as const).map((m) => (
              <button key={m} className={`anchor-mode-btn${anchorMode === m ? " active" : ""}`} onClick={() => setAnchorMode(m)}>
                {m === "basic" ? `${tr("Provisional", "Provisional")}  ${anchorCfg.scopeBasic} : 1` : m === "normal" ? `Normal  ${anchorCfg.scopeNormal} : 1` : `${tr("Seguro", "Safe")}  ${anchorCfg.scopeHard} : 1`}
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible config */}
        <div className="anchor-config-toggle" onClick={() => setShowAnchorConfig(!showAnchorConfig)}>
          <span className={`anchor-config-arrow${showAnchorConfig ? " open" : ""}`}>▶</span>
          <span>{tr("Configuración avanzada", "Advanced configuration")}</span>
        </div>
        {showAnchorConfig && (
          <>
          <div className="anchor-config-backdrop" onClick={() => setShowAnchorConfig(false)} />
          <div className="anchor-config-body">
            <div className="anchor-field">
              <label>{tr("Altura roldana sobre el agua", "Bow roller height above water")}</label>
              <div className="anchor-input-row">
                <input type="number" min="0" max="10" step="0.1" value={hBowStr} onChange={(e) => { setHBowStr(e.target.value); const v = parseFloat(e.target.value); if (Number.isFinite(v)) setAnchorCfg((p) => ({ ...p, hBowMeters: v })); }} onBlur={() => { const v = parseFloat(hBowStr); if (!Number.isFinite(v) || v < 0) { setHBowStr(""); setAnchorCfg((p) => ({ ...p, hBowMeters: 0 })); } }} placeholder="ej: 1.2" />
                <span className="anchor-unit">{labelDepth}</span>
              </div>
            </div>
            <div className="anchor-field">
              <label>{tr("Tiempo previsto de fondeo", "Expected anchoring time")}</label>
              <div className="anchor-input-row">
                <input type="number" min="0" max="7" step="1" value={anchorDays} onChange={(e) => setAnchorDays(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 55 }} />
                <span className="anchor-unit">{tr("días", "days")}</span>
                <input type="number" min="0" max="23" step="1" value={anchorHours} onChange={(e) => setAnchorHours(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: 55 }} />
                <span className="anchor-unit">{tr("horas", "hours")}</span>
              </div>
            </div>
            <div className="anchor-field">
              <label>{tr("Introduce manualmente la profundidad", "Enter depth manually")}</label>
              <div className="anchor-input-row">
                <input type="number" min="0" max="100" step="0.1" className="anchor-input-wide" value={anchorDepthManual} onChange={(e) => setAnchorDepthManual(e.target.value)} placeholder={tr("SOLO SI NO HAY DATO SONDA", "ONLY IF NO SOUNDER DATA")} />
                <span className="anchor-unit">{labelDepth}</span>
              </div>
            </div>
            <div className="anchor-field">
              <label>{tr("Ratios de cadena (editables)", "Chain ratios (editable)")}</label>
              <div className="anchor-ratios-vertical">
                <div className="anchor-ratio-row"><span className="anchor-ratio-label">{tr("Provisional", "Provisional")}:</span><input type="number" min="1" max="12" step="0.5" value={anchorCfg.scopeBasic} onChange={(e) => setAnchorCfg({ ...anchorCfg, scopeBasic: parseFloat(e.target.value) || 3.5 })} /></div>
                <div className="anchor-ratio-row"><span className="anchor-ratio-label">Normal:</span><input type="number" min="1" max="12" step="0.5" value={anchorCfg.scopeNormal} onChange={(e) => setAnchorCfg({ ...anchorCfg, scopeNormal: parseFloat(e.target.value) || 5.0 })} /></div>
                <div className="anchor-ratio-row"><span className="anchor-ratio-label">{tr("Seguro", "Safe")}:</span><input type="number" min="1" max="12" step="0.5" value={anchorCfg.scopeHard} onChange={(e) => setAnchorCfg({ ...anchorCfg, scopeHard: parseFloat(e.target.value) || 8.0 })} /></div>
              </div>
              <button className="anchor-config-calc-btn" onClick={() => setShowAnchorConfig(false)}>{tr("Calcular", "Calculate")}</button>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Results: 8 boxes in 2 columns × 4 rows */}
      {anchorResult && Number.isFinite(anchorResult.chainL) && (
        <div className="anchor-results-fixed">
          {anchorResult.warnings?.length > 0 && (
            <div className="anchor-warnings">
              {anchorResult.warnings.map((w: string, i: number) => <div key={i} className="anchor-warn">⚠ {w}</div>)}
            </div>
          )}
          <div className="anchor-result-grid-4x2">
            {/* Row 1: Orange highlighted */}
            <div className="anchor-rbox anchor-rbox-highlight" style={{ cursor: 'pointer', position: 'relative' }}
              onClick={() => { if (!editingChain) { setEditingChain(true); setChainDeployedStr(chainDeployedVal ? String(chainDeployedVal) : ""); } }}>
              <span className="anchor-rbox-label">⚓ {tr("Cadena", "Chain")}</span>
              {editingChain ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <input type="number" min="1" max="200" step="1" autoFocus value={chainDeployedStr}
                    onChange={(e) => setChainDeployedStr(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') {
                      const v = parseInt(chainDeployedStr);
                      if (v > 0) { setChainDeployedVal(v); fetch('/signalk-mareas-ihm/api/anchor-watch/chain-deployed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ meters: v }) }); }
                      setEditingChain(false);
                    }}}
                    onBlur={() => {
                      const v = parseInt(chainDeployedStr);
                      if (v > 0) { setChainDeployedVal(v); fetch('/signalk-mareas-ihm/api/anchor-watch/chain-deployed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ meters: v }) }); }
                      setEditingChain(false);
                    }}
                    style={{ width: '60px', background: 'rgba(255,255,255,0.15)', border: '1px solid #ff9800', borderRadius: '4px', color: '#fff', textAlign: 'center', fontSize: '18px', padding: '2px' }} />
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>{labelDepth}</span>
                </div>
              ) : (
                <span className="anchor-rbox-value">{chainDeployedVal ? fmtTideHeight(chainDeployedVal, 0) : fmtTideHeight(anchorResult.chainL, 0)}</span>
              )}
              <span style={{ position: 'absolute', bottom: '3px', right: '6px', fontSize: '23px', opacity: 0.9, fontWeight: 700, color: '#ffb74d' }}>
                {chainDeployedVal ? `rec: ${fmtTideHeight(anchorResult.chainL, 0)}` : tr("pulsa para editar", "tap to edit")}
              </span>
            </div>
            <div className="anchor-rbox anchor-rbox-highlight">
              <span className="anchor-rbox-label">🌊 {tr("Profundidad ahora", "Depth now")}</span>
              <span className="anchor-rbox-value">{fmtTideHeight(anchorResult.dNow, 2)}</span>
              {anchorResult.depthPathUsed && <span style={{ fontSize: '10px', opacity: 0.5 }}>{anchorResult.depthPathUsed === "none" ? tr("⚠ manual", "⚠ manual") : "SK ✓"}</span>}
            </div>

            {/* Row 2 */}
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">📈 {tr("Profundidad máxima", "Max depth")}</span>
              <span className="anchor-rbox-value">{fmtTideHeight(anchorResult.depthMax, 2)}</span>
            </div>
            <div className={`anchor-rbox${anchorResult.draftEffective != null && anchorResult.depthMin != null && anchorResult.depthMin < anchorResult.draftEffective ? " anchor-rbox-danger" : ""}`}>
              <span className="anchor-rbox-label">📉 {tr("Profundidad mínima", "Min depth")}</span>
              <span className="anchor-rbox-value">{fmtTideHeight(anchorResult.depthMin, 2)}</span>
              {anchorResult.draftEffective != null && anchorResult.depthMin != null && anchorResult.depthMin < anchorResult.draftEffective && <span className="anchor-rbox-alert">⚠ &lt; {tr("calado ef.", "eff. draft")} {fmtTideHeight(anchorResult.draftEffective, 2)}</span>}
            </div>

            {/* Row 3 */}
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">↔ {tr("Radio de borneo ahora", "Swing radius now")}</span>
              <span className="anchor-rbox-value">{fmtTideHeight(anchorResult.swingRadiusNow ?? anchorResult.swingRadiusMax, 1)}</span>
            </div>
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">↔ {tr("Radio de borneo máximo", "Max swing radius")}</span>
              <span className="anchor-rbox-value">{fmtTideHeight(anchorResult.swingRadiusMax, 1)}</span>
            </div>

            {/* Row 4 */}
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">🌊 {tr("Estado marea", "Tide state")}</span>
              <span className="anchor-rbox-value anchor-rbox-value-sm">{snapshot?.resume ?? anchorResult.tendencyPercentage ?? "–"}</span>
            </div>
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">⚠ {tr("Status Profundidad", "Depth Status")}</span>
              <span className="anchor-rbox-value anchor-rbox-value-sm">{snapshot?.groundingStatus ?? "–"}</span>
            </div>
            <div className="anchor-rbox anchor-rbox-map" style={{ gridColumn: 'span 2', cursor: 'pointer', background: 'rgba(255,152,0,0.15)', border: '2px solid rgba(255,152,0,0.5)' }}
              onClick={() => window.location.href='/signalk-mareas-ihm/visorfondeo'}>
              <span className="anchor-rbox-value" style={{ color: '#ff9800', fontSize: '48px', lineHeight: 1.2, textAlign: 'center' }}>{tr("ABRIR VISOR DE FONDEO", "OPEN ANCHOR VIEWER")}</span>
            </div>
          </div>
          {anchorResult.partial && <div className="anchor-partial-notice">⚠ {tr("Estimación parcial — horizonte largo sin datos de extremos completos", "Partial estimate — long horizon without complete extreme data")}</div>}
        </div>
      )}
      {anchorResult && !Number.isFinite(anchorResult.chainL) && (
        <div className="anchor-results-fixed">
          <div className="anchor-warnings">{anchorResult.warnings?.map((w: string, i: number) => <div key={i} className="anchor-warn">⚠ {w}</div>)}</div>
        </div>
      )}

      <div className="modal-buttons-fixed" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label className="anchor-publish-bar" style={{ flex: '1' }}>
          <input type="checkbox" checked={anchorCfg.autoPublish} onChange={(e) => setAnchorCfg({ ...anchorCfg, autoPublish: e.target.checked })} />
          <span className="anchor-publish-label">{tr("Publicar en Signal K", "Publish to Signal K")}</span>
        </label>
        <button className="modal-close" onClick={() => { setShowAnchor(false); setShowScopeHelp(false); }}>{tr("CERRAR", "CLOSE")}</button>
      </div>
    </div>
  </div>
, document.body)}

    {showTideChart && (
      <TideChartModal
        extremes={extremes}
        now={now}
        heightNow={heightNow}
        riskTimeIso={(groundingRisk as any)?.physicalRisk && (groundingRisk as any)?.nextLowTime ? (groundingRisk as any).nextLowTime : null}
        stationSampleIso={nextHigh?.time ?? nextLow?.time}
        stationName={snapshot?.stationName ?? ""}
        onClose={() => setShowTideChart(false)}
        tr={tr}
        fmtH={fmtTideHeight}
      />
    )}
    </>
  );
}
