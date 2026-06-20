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
function TideChartModal({ extremes, now, heightNow, riskTimeIso, stationSampleIso, stationName, onClose, tr }: {
  extremes: { time: string; value: number; type?: string }[];
  now: Date;
  heightNow: number;
  riskTimeIso?: string | null;
  stationSampleIso?: string;
  stationName?: string;
  onClose: () => void;
  tr: (es: string, en: string) => string;
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
              <text x={PAD_L - 5} y={toY(h) + 3.5} textAnchor="end" fontSize="10" fill="#666">{h.toFixed(1)}m</text>
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
            {tr("AHORA", "NOW")}: {fmtLocal(now.getTime())} {heightNow.toFixed(2)}m
          </text>

          {/* Extreme dots */}
          {visibleExtremes.map((e, i) => {
            const t = new Date(e.time).getTime();
            const isHigh = e.type?.toLowerCase() === "high";
            return (
              <g key={i}>
                <circle cx={toX(t)} cy={toY(e.value)} r="5" fill={isHigh ? "#28a745" : "#dc3545"} stroke="#fff" strokeWidth="1.5" />
                <text x={toX(t)} y={toY(e.value) + (isHigh ? -10 : 14)} textAnchor="middle" fontSize="9" fontWeight="bold" fill={isHigh ? "#28a745" : "#dc3545"}>
                  {e.value.toFixed(2)}m {fmtLocal(t)}
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
                {fmtLocal(cursor.time.getTime())} — {cursor.height.toFixed(2)}m
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
  const [lang, setLang] = useState<UiLang>("es");
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
    if (!qHadLang) {
      (async () => {
        try {
          const r = await fetch(SETTINGS_URL, { cache: "no-store" });
          if (!r.ok) return;
          const js = await r.json();
          const l = String(js?.lang ?? "").toLowerCase();
          if (alive && (l === "es" || l === "en")) setLang(l);
        } catch {
          // ignore
        }
      })();
    }
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
    ? `${tendency === "rising" ? tr("SUBIENDO", "RISING") : tr("BAJANDO", "FALLING")} ${tr("DESDE", "SINCE")} ${fmtDecimal(prevHeight)} m ${tr("A LAS", "AT")} ${prevTime}`
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
                <div className="box-value now">{Number.isFinite(heightNow) ? `${fmtDecimal(heightNow)} m` : "– m"}</div>
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
                  <div className="tide-box high-box" ref={highBoxRef}><div className="box-title high">{tr("PRÓX. PLEAMAR", "NEXT HIGH")}</div><div className="box-value high">{fmtDecimal(nextHigh.value)} m</div><div className="box-when">{tr("A las", "At")} {fmtHHMMFromIso(nextHigh.time)}</div></div>
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
                  <div className="tide-box low-box" ref={lowBoxRef}><div className="box-title low">{tr("PRÓX. BAJAMAR", "NEXT LOW")}</div><div className="box-value low">{fmtDecimal(nextLow.value)} m</div><div className="box-when">{tr("A las", "At")} {fmtHHMMFromIso(nextLow.time)}</div></div>
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
            <h2>{showChangelog ? tr("Registro de cambios – Versiones", "Changelog – Versions") : tr("📖 INSTRUCCIONES", "📖 INSTRUCTIONS")} – v{snapshot?.pluginVersion ?? "—"}</h2>
            <div className="instrucciones-body instrucciones-scroll" ref={instrContentRef}>
              {showChangelog ? (
                <>
                  <h4>v2.2.0</h4>
                  <ul>
                    <li><strong>{tr("Sistema AIS rediseñado", "AIS system redesigned")}:</strong> {tr("base de datos persistente de 72 h con nombre, eslora, manga, tipo, callsign e IMO de cada barco visto — los nombres ya están al abrir el visor sin esperar al próximo paquete estático AIS (que tarda hasta 6 min). Cache fantasma de 5 min para targets que pierden recepción VHF brevemente — siguen visibles con una X discreta.", "72 h persistent database with name, length, beam, type, callsign and IMO of every boat seen — names are ready when opening the viewer without waiting for the next AIS static packet (up to 6 min). 5-minute ghost cache for targets that briefly lose VHF reception — they stay visible with a discrete X mark.")}</li>
                    <li><strong>{tr("Lista AIS filtrable y ordenable", "Filterable and sortable AIS list")}:</strong> {tr("slider de radio 0.5–50 km, ordena por distancia/nombre/favoritos/MMSI/tipo, caja de filtro de texto con 'Sin resultados', iconos por tipo (⛵/📦/🛢️/🛳️/🎣), favoritos ★ sincronizados entre dispositivos, botón 🔍 vesselfinder por fila.", "0.5–50 km radius slider, sort by distance/name/favourites/MMSI/type, text filter box with 'No results', type-specific icons (⛵/📦/🛢️/🛳️/🎣), ★ favourites synced across devices, 🔍 vesselfinder button per row.")}</li>
                    <li><strong>{tr("Alarma AIS más fiable", "More reliable AIS alarm")}:</strong> {tr("cuando ACKeas un target y vuelve a moverse hacia ti, la alarma vuelve a sonar; ACK caduca a los 15 min para forzar reevaluación; eliminado el bucle 'alarma se abre y cierra sola'; velocidad de acercamiento se pone a cero cuando ambos barcos están parados.", "when you ACK a target and it resumes moving towards you, the alarm fires again; ACK expires after 15 min to force re-evaluation; eliminated the 'alarm opens and closes by itself' loop; closing rate goes to zero when both boats are stopped.")}</li>
                    <li><strong>{tr("Click-to-focus en AIS", "AIS click-to-focus")}:</strong> {tr("click en un barco → el mapa lo centra, lo sigue y muestra su distancia junto al aro azul. La X del aro deselecciona. El rastro del seleccionado se ve siempre destacado.", "click a boat → the map centres on it, follows it and shows live distance next to the blue ring. The X on the ring deselects. The selected target's track is always highlighted.")}</li>
                    <li><strong>{tr("Auto-desarme al salir a motor", "Auto-disarm when leaving under engine")}:</strong> {tr("si tu SOG se mantiene >3 nudos durante 30 segundos, el plugin asume salida intencional y desarma la vigilancia sin disparar la alarma de garreo. Antes saltaba sirena cuando olvidabas 'levar' en la app.", "if your SOG stays above 3 knots for 30 seconds, the plugin assumes intentional departure and disarms the watch without firing the drag alarm. Previously the siren went off when you forgot to lift in the app.")}</li>
                    <li><strong>{tr("Rosa de abrigo restaurada", "Shelter rose restored")}:</strong> {tr("vuelta al algoritmo de detección de sectores de versiones anteriores que funcionaba bien. Los cambios intermedios daban falsos positivos en costas irregulares.", "back to the sector detection algorithm of earlier versions that worked well. Intermediate changes gave false positives in irregular coastlines.")}</li>
                    <li><strong>{tr("Historial de olas mejorado", "Improved wave history")}:</strong> {tr("resolución triplicada (una barra cada 5 min en vez de 15), 'Ahora' a la izquierda y pasado a la derecha, escala vertical autoescalable hasta 2 m con líneas guía a ambos lados, scroll horizontal cuando hay muchos datos.", "3× resolution (one bar every 5 min instead of 15), 'Now' on the left and past on the right, autoscaling vertical axis up to 2 m with guide lines on both sides, horizontal scroll when there is plenty of data.")}</li>
                    <li><strong>{tr("Modales informativos grandes", "Large info modals")}:</strong> {tr("Escala de exposición, Cómo se calcula la protección e Historial de olas con leyenda y tabla ocupan ahora casi toda la pantalla con textos cómodos de leer a la luz del sol.", "Exposure scale, How protection is calculated and Wave history with legend and table now fill almost the whole screen with text comfortable to read in sunlight.")}</li>
                    <li><strong>{tr("Capturas en el App Store de Signal K", "Screenshots in the Signal K App Store")}:</strong> {tr("se incluyen capturas del plugin para que aparezcan en la página del App Store de Signal K tras la instalación.", "plugin screenshots are now included so they appear in the Signal K App Store page after install.")}</li>
                    <li><strong>{tr("Versatilidad multi-pantalla", "Multi-screen versatility")}:</strong> {tr("interfaz user-friendly que se adapta del móvil al monitor del puente: controles del tamaño del dedo, textos legibles bajo la luz del sol, modales que respetan el viewport real.", "user-friendly UI that adapts from phone to bridge monitor: finger-sized controls, sunlight-readable text, modals that respect the actual viewport.")}</li>
                    <li><strong>{tr("Correcciones varias", "Various fixes")}:</strong> {tr("resumen del abrigo ('Sheltered:...') respeta ahora el idioma del visor; nombre AIS ya no se pierde al reaparecer; foco del mapa ya no oscila entre el barco propio y un AIS seleccionado; el panel AIS mantiene fija la cabecera y solo scrollea la lista; tooltip molesto 'Container ship top view' eliminado.", "shelter summary ('Sheltered:...') now respects the viewer language; AIS name no longer lost on reappearance; map focus no longer oscillates between own boat and a selected AIS; AIS panel keeps the header fixed and only the list scrolls; annoying 'Container ship top view' tooltip removed.")}</li>
                  </ul>
                  <h4>v2.1.4</h4>
                  <ul>
                    <li><strong>{tr("Traducción completa ES ↔ EN", "Full ES ↔ EN translation")}:</strong> {tr("panel meteo (AHORA, filas Aire/Presión/etc., resumen), shelter (badges Veleta/Sensor, racha, aire, agua, ahora en gráfico), labels flotantes del visor (Wind, Waves, Calm sea), tooltips de botones, popups Favoritos/Sonda. Cambio de idioma desde el menú actualiza todo al instante.", "weather panel (NOW, Air/Pressure/etc. rows, summary), shelter (Vane/Sensor badges, gust, air, water, now on chart), visor floating labels (Wind, Waves, Calm sea), button tooltips, Favourites/Depth popups. Language switch from the menu updates everything instantly.")}</li>
                    <li><strong>{tr("Estilo unificado de cabeceras", "Unified header style")}:</strong> {tr("el botón 'Atrás' y los títulos de TODOS los modales (Meteo, Shelter, Anchor Calculation, Tides, etc.) usan ahora el mismo color, tamaño y peso. Coherencia visual en toda la app.", "the 'Back' button and titles of ALL modals (Weather, Shelter, Anchor Calculation, Tides, etc.) now use the same color, size and weight. Visual consistency across the app.")}</li>
                    <li><strong>{tr("Tooltips bilingües", "Bilingual tooltips")}:</strong> {tr("los textos title='...' de bottom bar y sidebar derecha respetan ahora el idioma activo. Antes quedaban en español aunque el visor estuviera en inglés.", "title='...' tooltips on the bottom bar and right sidebar now respect the active language. Previously they stayed in Spanish even when the visor was in English.")}</li>
                  </ul>
                  <h4>v2.1.1 — 2.1.3</h4>
                  <ul>
                    <li><strong>{tr("Alarmas fiables", "Reliable alarms")}:</strong> {tr("state machine reforzada — detección de loops huérfanos tras ACK/snooze, 30s de gracia configurable, corte instantáneo de voz al ACK/snooze/mute, mute con ventana de 60s protegida (incluso garreo crítico), banner 'Audio bloqueado' + vibración fallback cuando el navegador móvil suspende el AudioContext.", "hardened state machine — orphan loop detection after ACK/snooze, configurable 30s grace, instant voice cut on ACK/snooze/mute, 60s protected mute window (even for critical anchor drag), 'Audio blocked' banner + vibration fallback when mobile browser suspends AudioContext.")}</li>
                    <li><strong>{tr("Shelter fullscreen en portrait", "Shelter fullscreen in portrait")}:</strong> {tr("fix de la interacción zoom × dvw/dvh que dejaba el modal a media pantalla. Ahora ocupa el viewport completo en ambas orientaciones.", "fix for the zoom × dvw/dvh interaction that left the modal at half screen. Now fills the full viewport in both orientations.")}</li>
                    <li><strong>{tr("Capas: chip de opacidad", "Layers: opacity chip")}:</strong> {tr("número de opacidad flotante encima del thumb de cada slider de capa. Se oculta al arrastrar y al desactivar la capa. Default Batimetría e IHM a 13.", "floating opacity number above each layer slider thumb. Hidden while dragging and when the layer is off. Default Bathymetry and IHM at 13.")}</li>
                    <li><strong>{tr("Cero referencias comerciales", "Zero commercial references")}:</strong> {tr("'SonarChart' renombrado a 'Batimetría' en toda la UI y comentarios.", "'SonarChart' renamed to 'Bathymetry' across UI and comments.")}</li>
                    <li><strong>{tr("NPM: descripción y keywords", "NPM: description and keywords")}:</strong> {tr("paquete con descripción completa de TODAS las funciones (anchor watch, AIS, shelter, weather, depth, charts), ~70 keywords en inglés para descubrimiento internacional.", "package with full description of ALL features (anchor watch, AIS, shelter, weather, depth, charts), ~70 English keywords for international discoverability.")}</li>
                  </ul>
                  <h4>v2.1.0</h4>
                  <ul>
                    <li><strong>{tr("Radio de borneo unificado", "Unified swing radius")}:</strong> {tr("los tres controles (slider del panel Cartas y Capas, slider del modal Información, bolita azul del aro en el mapa) ahora editan el MISMO valor. Todos escriben al backend vía /api/anchor-watch/swing-radius. El visor lee el state SSE y refleja el mismo valor en todos sitios.", "the three controls (Cartas/Capas slider, Info modal slider, blue handle on the map ring) now edit the SAME value. All POST to backend /api/anchor-watch/swing-radius. The visor reads SSE state and reflects the same value everywhere.")}</li>
                    <li><strong>{tr("Optimistic lock 4 s", "4 s optimistic lock")}:</strong> {tr("tras mover un slider o arrastrar una bolita, el visor ignora cualquier delta SSE durante 4 s — evita que un poll en vuelo con el valor antiguo del backend pise lo recién ajustado. Antes el slider 'saltaba' al soltar.", "after moving a slider or dragging a handle, the visor ignores any SSE delta for 4 s — prevents an in-flight poll with the old backend value from overwriting your latest change. Previously sliders would 'jump' on release.")}</li>
                    <li><strong>{tr("Bottom bar rediseñada", "Bottom bar redesigned")}:</strong> {tr("texto descriptivo en lugar de emojis, viento real (flecha + kts, apunta TO), donut de calidad de abrigo con %, línea 'AHORA' naranja en la curva de presión, botón Sonda con texto largo de estado (OK / Atención varada). Cada valor lleva al modal de su dato.", "descriptive text instead of emojis, real wind (arrow + kts, points TO), shelter quality donut with %, orange 'NOW' line in the pressure curve, depth button with long status text (OK / Grounding warning). Each value opens its data modal.")}</li>
                    <li><strong>{tr("Nuevos botones laterales", "New side buttons")}:</strong> {tr("❤ Fondeo favorito (abre modal propio para guardar el fondeo si estás anclado, o lista de favoritos si no), KIP (lleva al dashboard KIP), Freeboard (al instrumento Freeboard-SK). URLs dinámicas al host actual — funciona en localhost, IP local o Tailscale.", "❤ Favourite anchorage (opens a dedicated save modal when anchored, or favourites list otherwise), KIP (KIP dashboard), Freeboard (Freeboard-SK instrument). URLs are dynamic to the current host — works on localhost, LAN IP or Tailscale.")}</li>
                    <li><strong>{tr("Transparencia inteligente de panel", "Smart panel transparency")}:</strong> {tr("al pulsar un slider del modal Información o de Cartas y Capas, el panel se vuelve invisible automáticamente para que veas el mapa detrás. Al soltar, vuelve. Se mantiene incluso si paras de mover sin soltar.", "when you press a slider in the Info modal or Cartas y Capas, the panel automatically becomes invisible so you can see the map behind. Released → restored. Stays transparent even if you stop moving without releasing.")}</li>
                    <li><strong>{tr("Drag en tiempo real", "Real-time drag")}:</strong> {tr("al arrastrar las bolitas del aro azul/rojo, los labels del mapa (Radio borneo / Radio alarma) y los valores del panel se actualizan en vivo, no al soltar. Las flechas viento/ola siguen al aro mientras lo arrastras.", "while dragging the blue/red ring handles, map labels (Borneo radius / Alarm radius) and panel values update live, not on release. Wind/wave arrows follow the ring as you drag.")}</li>
                    <li><strong>{tr("Coherencia visor ↔ Info", "Visor ↔ Info consistency")}:</strong> {tr("Radio borneo y Radio alarma usan el mismo formato (toFixed 1 decimal) en el mapa y en el modal Información. Antes el visor mostraba 30.7 m y el Info redondeaba a 31 m.", "Borneo and Alarm radius use the same format (1 decimal) on the map and in the Info modal. Previously the visor showed 30.7 m and Info rounded to 31 m.")}</li>
                    <li><strong>{tr("Capas en gris al desactivar", "Greyed-out inactive layers")}:</strong> {tr("el slider de opacidad de cada capa (incluidas MBTiles y Charts SignalK dinámicas) se pone gris y no-interactivo cuando la capa no está activa. Más coherente visualmente.", "each layer's opacity slider (including dynamic MBTiles and SignalK Charts) is greyed-out and non-interactive when the layer is off. More visually consistent.")}</li>
                    <li><strong>{tr("Hamburger con tipografía mayor", "Hamburger with larger typography")}:</strong> {tr("opciones del menú a 32 px, título 'Menú' a 56 px, header iOS-style a 38 px, aviso legal y bloque de versión más grandes. Sin tocar la altura de fila — más legibles desde la mesa de cartas.", "menu options at 32 px, 'Menu' title at 56 px, iOS header at 38 px, legal notice and version block larger. Row height unchanged — easier to read from the chart table.")}</li>
                    <li><strong>{tr("Modal Instrucciones desde Hamburger", "Instructions modal from Hamburger")}:</strong> {tr("este propio modal ahora se abre desde el menú Hamburger (en vez del README markdown anterior) con la versión, las funciones y este changelog completos. Tabla de paths SignalK con path y descripción a 22 px.", "this very modal now opens from the Hamburger menu (instead of the previous markdown README) with full version, features and this changelog. SignalK paths table with path and description at 22 px.")}</li>
                    <li><strong>{tr("Resumen meteo colapsable", "Collapsible weather summary")}:</strong> {tr("el bloque '📰 Resumen' del modal Meteo se puede colapsar con un click para liberar espacio en la tabla de horas. El estado se recuerda entre aperturas.", "the '📰 Summary' block of the Weather modal can be collapsed by clicking to free space for the hourly table. State is remembered across openings.")}</li>
                  </ul>
                  <h4>v2.0.3</h4>
                  <ul>
                    <li><strong>{tr("Mareas mundiales (Open-Meteo)", "Worldwide tides (Open-Meteo)")}:</strong> {tr("nueva pseudo-estación 🌍 Open-Meteo global que predice mareas para cualquier coordenada del mundo (USA, Canadá, UK, Australia, NZ, Japón, etc.) usando el modelo FES2014/Copernicus. Sin API key, caché 12 h por celda 11 km. Para España IHM sigue siendo preferente.", "new 🌍 Open-Meteo global pseudo-station predicts tides for any coordinate in the world (USA, Canada, UK, Australia, NZ, Japan, etc.) using FES2014/Copernicus model. No API key, 12 h cache per 11 km cell. For Spain IHM remains preferred.")}</li>
                    <li><strong>{tr("Pseudo-estaciones sintéticas", "Synthetic pseudo-stations")}:</strong> {tr("'Sin marea / Offshore' (Δ 0 m) y 'Mediterráneo' (Δ 0.2 m sinusoidal M2). Para lagos, dársenas cerradas o zonas sin marea apreciable. Permiten arrancar el plugin sin internet ni cobertura IHM.", "'No tide / Offshore' (Δ 0 m) and 'Mediterranean' (Δ 0.2 m sinusoidal M2). For lakes, closed marinas or areas with negligible tide. Allow plugin to start without internet or IHM coverage.")}</li>
                    <li><strong>{tr("Detección automática de IMU", "IMU auto-detection")}:</strong> {tr("nueva arquitectura ImuManager que detecta automáticamente la fuente de attitude/acceleration (Signal K, pypilot local, pypilot remoto, MacArthur HAT, raw I2C opt-in). Endpoint /api/imu/status para diagnóstico.", "new ImuManager architecture that automatically detects attitude/acceleration source (Signal K, local pypilot, remote pypilot, MacArthur HAT, opt-in raw I2C). /api/imu/status endpoint for diagnostics.")}</li>
                    <li><strong>{tr("Grade en tiempo real con Veleta", "Real-time grade with anemometer")}:</strong> {tr("el grade A-F del abrigo ahora degrada si la veleta marca viento real más alto que la previsión en un sector expuesto. Sin esto el plugin podía dar 'A 85%' con 10 kt reales en sector abierto.", "the A-F shelter grade now downgrades if the anemometer reads higher real wind than the forecast in an exposed sector. Without this the plugin could report 'A 85%' with real 10 kt in an open sector.")}</li>
                    <li><strong>{tr("Bug crítico TDZ", "Critical TDZ bug")}:</strong> {tr("variable declarada después de su uso provocaba ReferenceError al arrancar el plugin, abortando el registro de rutas y dejando 404 en /api/shelter y otras. Corregido.", "variable declared after its use caused ReferenceError on plugin start, aborting route registration and leaving 404 on /api/shelter and others. Fixed.")}</li>
                    <li><strong>{tr("Offshore fallback", "Offshore fallback")}:</strong> {tr("posiciones a más de 300 km de cualquier estación IHM (Mediterráneo, alta mar, Asturias central, etc.) ya no rompen el plugin — caen automáticamente a Vigo como fallback hasta que el usuario seleccione otra opción.", "positions more than 300 km from any IHM station (Mediterranean, open ocean, central Asturias, etc.) no longer break the plugin — they fall back to Vigo automatically until the user selects another option.")}</li>
                    <li><strong>{tr("Auditoría completa de código", "Full code audit")}:</strong> {tr("limpieza de timers leaked, listeners de proceso acumulados, código muerto, dependencias huérfanas (moment, d3), constantes duplicadas. ~120 líneas eliminadas, ~40 añadidas (logging defensivo).", "cleanup of leaked timers, accumulated process listeners, dead code, orphan deps (moment, d3), duplicated constants. ~120 lines removed, ~40 added (defensive logging).")}</li>
                    <li><strong>{tr("Fix sin datos al elegir sintética", "Fix no-data when picking synthetic")}:</strong> {tr("endpoint /api/extremes leía sólo de cache mensual de IHM y ignoraba las pseudo-estaciones (Open-Meteo, Sin marea, Mediterráneo). Ahora sirve sus extremos desde el provider y, si la TZ es exótica, los normaliza con offset explícito para que el browser los parsee bien.", "the /api/extremes endpoint only read from IHM monthly cache and ignored synthetic stations (Open-Meteo, No tide, Mediterranean). Now serves their extremes from the provider, normalising to explicit offset so any browser TZ parses them correctly.")}</li>
                    <li><strong>{tr("Open-Meteo referenciado a cero del puerto", "Open-Meteo rebased to chart datum")}:</strong> {tr("la API devuelve altura respecto a MSL (con valores negativos en bajamar, confuso); ahora se reposiciona automáticamente al rango 0…máx como IHM, conservando el rango pleamar–bajamar.", "API returns height relative to MSL (negative values at low tide, confusing); now rebased automatically to 0…max range like IHM, preserving high–low tide range.")}</li>
                    <li><strong>{tr("Sintéticas disponibles en AUTO", "Synthetic stations available in AUTO")}:</strong> {tr("antes solo se podían elegir en MANUAL; en AUTO el favorito sintético se purgaba silenciosamente. Ahora se respetan en ambos modos.", "previously only selectable in MANUAL; in AUTO synthetic favourite was silently purged. Now honoured in both modes.")}</li>
                    <li><strong>{tr("% donut coherente con grade", "Donut % coherent with grade")}:</strong> {tr("el % de abrigo no degradaba con olas reales aunque el grade-letter sí lo hiciera; ahora oleaje moderada→50%, agitada→30%, fuerte→10%.", "the shelter % did not degrade with measured waves even though grade-letter did; now waves moderada→50%, agitada→30%, fuerte→10%.")}</li>
                  </ul>
                  <h4>v2.0.2</h4>
                  <ul>
                    <li><strong>{tr("Fixes de estabilidad", "Stability fixes")}:</strong> {tr("correcciones menores tras tests Rev140-148: timers leaked en evaluateAnchorWatch, listeners de proceso que se acumulaban al toggle disable/enable, logging defensivo en bridge pypilot.", "minor fixes after Rev140-148 testing: leaked timers in evaluateAnchorWatch, process listeners accumulated on toggle disable/enable, defensive logging in pypilot bridge.")}</li>
                    <li><strong>{tr("AIS: ACK por target individual", "AIS: per-target ACK")}:</strong> {tr("acknowledge silencia el AIS por MMSI específico en lugar de toda la alarma global.", "acknowledge silences AIS per specific MMSI instead of the whole global alarm.")}</li>
                    <li><strong>{tr("Sonda: detector de freeze", "Sounder: freeze detector")}:</strong> {tr("si la lectura no cambia en N segundos, en vez de mostrar el último valor (que invita a errores) se muestra 'SONDA CONGELADA'.", "if reading does not change for N seconds, instead of showing the last value (error-prone) it shows 'SOUNDER FROZEN'.")}</li>
                  </ul>
                  <h4>v2.0.1</h4>
                  <ul>
                    <li><strong>{tr("Hotfix audio en móviles iOS/Android", "Hotfix mobile audio iOS/Android")}:</strong> {tr("la alarma no sonaba en segundo plano cuando el navegador estaba minimizado; añadido Web Audio API + Wake Lock + visibility listener.", "alarm did not sound in background when browser was minimised; added Web Audio API + Wake Lock + visibility listener.")}</li>
                    <li><strong>{tr("Hotfix cálculo de cadena", "Hotfix chain calculation")}:</strong> {tr("en modo Provisional (3.5:1) el cálculo usaba un margen de seguridad incorrecto que infraestimaba la cadena recomendada en condiciones de viento bajo.", "in Provisional mode (3.5:1) the calculation used a wrong safety margin that underestimated recommended chain in low-wind conditions.")}</li>
                    <li><strong>{tr("Pequeñas correcciones de UI", "Minor UI fixes")}:</strong> {tr("orden de los botones del modal de calibración IMU, salto a línea correcto en el badge de IMU, color del grade-letter coherente con el porcentaje.", "ordering of IMU calibration modal buttons, correct line break on IMU badge, grade-letter colour coherent with percentage.")}</li>
                  </ul>
                  <h4>v2.0.0</h4>
                  <ul>
                    <li><strong>{tr("Previsión de Abrigo", "Shelter forecast")}:</strong> {tr("rosa de 16 sectores con detección automática del abrigo según la costa (OpenStreetMap), grado A-F con porcentaje de protección, strip de 12 h con previsión hora a hora, resumen AHORA/PREDICCIÓN con datos en tiempo real.", "16-sector rose with automatic shelter detection from coastline (OpenStreetMap), grade A-F with protection percentage, 12 h strip with hourly forecast, NOW/FORECAST summary with real-time data.")}</li>
                    <li><strong>{tr("Medición de olas en fondeo", "On-board wave measurement")}:</strong> {tr("dirección, período y altura de ola calculados a bordo desde sensores de actitud y aceleración (pypilot IMU), historial 24 h en barras de 15 min, el grado de abrigo se ajusta cuando la ola medida supera la prevista.", "wave direction, period and height computed on board from attitude/acceleration sensors (pypilot IMU), 24 h history in 15-min bars, shelter grade auto-adjusts when measured wave exceeds forecast.")}</li>
                    <li><strong>{tr("Sensores en tiempo real", "Real-time sensors")}:</strong> {tr("lectura directa de viento (veleta), temperatura aire/agua y presión atmosférica desde Signal K. Etiquetas \"Veleta\" y \"Sensor\" distinguen datos reales de previsión. Fallback automático a Open-Meteo si un sensor falla.", "direct reading of wind (anemometer), air/water temperature and atmospheric pressure from Signal K. \"Veleta\" and \"Sensor\" badges distinguish real data from forecast. Automatic Open-Meteo fallback if a sensor fails.")}</li>
                    <li><strong>{tr("Audio mejorado", "Enhanced audio")}:</strong> {tr("voces pregrabadas (OGG) por idioma, detección automática de salida del Raspberry Pi (USB → analog → HDMI), patrones distintos por evento, soporte móvil fiable (audio en segundo plano).", "pre-recorded voices (OGG) per language, automatic Raspberry Pi audio output detection (USB → analog → HDMI), distinct patterns per event, reliable mobile support (background audio).")}</li>
                    <li><strong>{tr("Sonda inteligente", "Smart sounder")}:</strong> {tr("detecta congelación, spikes y valores absurdos. Cuando la sonda no es fiable deja de mostrar lecturas inventadas y avisa con \"SONDA CONGELADA / SIN SONDA\".", "detects freeze, spikes and absurd values. When the sounder is unreliable it stops showing made-up readings and signals \"FROZEN / NO SOUNDER\".")}</li>
                    <li><strong>{tr("Compass español NSEO", "Spanish compass NSEO")}:</strong> {tr("toda la rosa y referencias cardinales con \"O\" (no \"W\") en español: N/NE/E/SE/S/SO/O/NO.", "full rose and cardinal references with \"O\" (not \"W\") in Spanish: N/NE/E/SE/S/SO/O/NO.")}</li>
                    <li><strong>{tr("Estaciones IHM corregidas", "IHM stations fixed")}:</strong> {tr("70 estaciones reales del IHM con IDs verificados (antes la lista offline llevaba IDs inventados que rompían la API). Lisboa, Sevilla, A Guarda, Bermeo y Tánger añadidas; Mediterráneo/Baleares/Melilla eliminadas porque IHM no las cubre.", "70 real IHM stations with verified IDs (previously the offline list had invented IDs that broke the API). Lisbon, Seville, A Guarda, Bermeo and Tangier added; Mediterranean/Balearic/Melilla removed because IHM doesn't cover them.")}</li>
                    <li><strong>{tr("Robustez en errores de API", "API error resilience")}:</strong> {tr("ya no se cuelga con respuestas inesperadas de la API IHM. Estabilidad mejorada en conexiones débiles (4G/Tailscale).", "no longer hangs on unexpected IHM API responses. Improved stability on weak connections (4G/Tailscale).")}</li>
                  </ul>
                  <h4>v1.3.1</h4>
                  <ul>
                    <li><strong>{tr("Visor de Fondeo mejorado","Enhanced Anchor Watch")}:</strong> {tr("sincronización en tiempo real entre dispositivos (SSE), cadena largada con slider bidireccional, cálculo automático de cadena recomendada al fondear.","real-time multi-device sync (SSE), bidirectional chain deployed slider, automatic recommended chain calculation on anchoring.")}</li>
                    <li><strong>{tr("Sistema AIS completo","Complete AIS System")}:</strong> {tr("alarma por target individual con ACK, detección de garreo de barcos cercanos, estimación de ancla y radio de borneo de otros barcos mediante análisis de track, anillos de colisión persistentes en la carta.","per-target alarm with ACK, nearby boat dragging detection, anchor position and swing radius estimation from track analysis, persistent collision rings on chart.")}</li>
                    <li><strong>{tr("Alarmas inteligentes","Smart Alarms")}:</strong> {tr("alarma de varada solo cuando el barco está parado (SOG), detección de sonda congelada/inestable, alarmas de garreo y AIS independientes con control individual.","grounding alarm only when boat is stopped (SOG), frozen/unstable sounder detection, independent drag and AIS alarms with individual control.")}</li>
                    <li><strong>{tr("Domótica y KIP","Home Automation & KIP")}:</strong> {tr("botones de fondear/levar en KIP (PUT handlers), endpoints REST para Alexa/Google/MQTT, endpoint toggle para mandos a distancia.","drop/lift buttons in KIP (PUT handlers), REST endpoints for Alexa/Google/MQTT, toggle endpoint for remote controls.")}</li>
                    <li><strong>{tr("Bilingüe ES/EN completo","Full ES/EN Bilingual")}:</strong> {tr("todo el visor de fondeo, popups de cálculo, previsión meteo, curvas de marea, panel de alarmas y landing bilingües. Banderas de idioma en visor, landing y mareas. Idioma sincronizado entre todas las vistas.","full anchor watch viewer, calculation popups, weather forecast, tide curves, alarm panel and landing bilingual. Language flags in viewer, landing and tides. Language synced across all views.")}</li>
                    <li><strong>{tr("Curvas de Marea mejoradas","Enhanced Tide Curves")}:</strong> {tr("líneas HAT/LAT (pleamar/bajamar máxima anual), etiquetas de pleamar/bajamar en cada extremo, cursor interactivo, fondo blanco con textos legibles.","HAT/LAT lines (annual max high/low tide), high/low tide labels on each extreme, interactive cursor, white background with readable text.")}</li>
                    <li><strong>{tr("Navegación unificada","Unified Navigation")}:</strong> {tr("URLs dedicadas /mareas y /visorfondeo, navegación en la misma ventana entre todas las vistas, landing con selector y versión en vivo.","dedicated URLs /mareas and /visorfondeo, same-window navigation between all views, landing with selector and live version.")}</li>
                  </ul>
                  <h4>v1.3.0</h4>
                  <ul>
                    <li><strong>{tr("Visor de Fondeo","Anchor Viewer")}:</strong> {tr("página /visorfondeo con mapa Leaflet, icono de barco estilo SignalK, alarma de garreo visual y sonora, radio de borneo y alarma con etiquetas de metros, marcador de ancla arrastrable. Se abre desde el botón VISOR DE FONDEO.","page /visorfondeo with Leaflet map, SignalK-style boat icon, visual+sound anchor drag alarm, swing and alarm radius with meter labels, draggable anchor marker. Opens from ANCHOR VIEWER button.")}</li>
                    <li><strong>{tr("Alarma de Garreo","Anchor Drag Alarm")}:</strong> {tr("evaluación cada 5s. Radio alarma = swingRadiusMax + margen (ajustable con slider dinámico de 1 a 50m). Notificación Signal K (visual + sonido + push). Panel muestra estado marea y profundidad del plugin principal.","5-second evaluation. Alarm radius = swingRadiusMax + margin (adjustable with dynamic slider 1-50m). Signal K notification (visual + sound + push). Panel shows tide state and depth from main plugin.")}</li>
                    <li><strong>{tr("Cartas MBTiles","MBTiles Charts")}:</strong> {tr("servidor de tiles integrado (better-sqlite3). Selector de carpeta (por defecto /home/pi/charts), checkboxes para cambiar entre cartas sin recargar, detección automática TMS/XYZ.","integrated tile server (better-sqlite3). Folder selector (default /home/pi/charts), checkboxes to switch charts without reloading, automatic TMS/XYZ detection.")}</li>
                    <li><strong>{tr("Capas","Layers")}:</strong> {tr("OpenSeaMap overlay, track GPS con historial de posición, OpenStreetMap dark fallback.","OpenSeaMap overlay, GPS track with position history, OpenStreetMap dark fallback.")}</li>
                    <li><strong>{tr("Paths Signal K","Signal K Paths")}:</strong> {tr("nuevos: anchorLat, anchorLon, distanceToAnchor, alarmRadius, dragging, watchEnabled.","new: anchorLat, anchorLon, distanceToAnchor, alarmRadius, dragging, watchEnabled.")}</li>
                  </ul>
                  <h4>v1.2.1</h4>
                  <ul>
                    <li><strong>{tr("UI Fondeo renovada","Anchor UI revamped")}:</strong> {tr("cajas resultado con títulos uniformes 14px, Cadena y Profundidad ahora en naranja, Estado Marea muestra resumen completo, nuevo Status Profundidad con estado de varada, Publicar SK en barra inferior verde.","result boxes with uniform 14px labels, Chain and Depth now in orange, Tide State shows full resume, new Depth Status with grounding state, Publish SK in green bottom bar.")}</li>
                    <li><strong>{tr("Config overlay","Config overlay")}:</strong> {tr("el panel de configuración avanzada ahora se superpone sin scroll, con botón Calcular naranja. El popup de ayuda ya no desplaza las cajas.","advanced config panel now overlays without scroll, with orange Calculate button. Help popup no longer pushes boxes down.")}</li>
                    <li><strong>{tr("Botones 170px","Buttons 170px")}:</strong> {tr("todos los botones de la barra principal ampliados a 170px mínimo para que INSTRUCCIONES quepa correctamente.","all toolbar buttons enlarged to 170px minimum so INSTRUCCIONES fits correctly.")}</li>
                    <li><strong>{tr("Fix alarma notificaciones","Fix alarm notifications")}:</strong> {tr("corregida la limpieza de notificaciones en OpenPlotter: ahora envía state=normal en vez de null, eliminando notificaciones zombie.","fixed notification clearing in OpenPlotter: now sends state=normal instead of null, eliminating zombie notifications.")}</li>
                    <li><strong>{tr("Fix hBow persistente","Fix hBow persistent")}:</strong> {tr("solucionado el borrado del dato de altura de roldana al editar.","fixed bow roller height being erased when editing.")}</li>
                    <li><strong>{tr("Fix Publicar en Signal K","Fix Publish to Signal K")}:</strong> {tr("el estado de publicación ahora se persiste entre reinicios del plugin.","publish state now persists across plugin restarts.")}</li>
                  </ul>
                  <h4>v1.2.0</h4>
                  <ul>
                    <li><strong>{tr("Calculadora de fondeo","Anchoring calculator")}:</strong> {tr("nueva pestaña FONDEO con modelo de scope náutico. Cadena recomendada, radio de borneo, publicación opcional en Signal K.","new ANCHOR tab with nautical scope model. Recommended chain, swing radius, optional Signal K publication.")}</li>
                    <li><strong>{tr("Fix notificaciones","Notification fix")}:</strong> {tr("la alarma suena UNA sola vez (antes se repetía cada 60s).","alarm sounds ONCE (previously repeated every 60s).")}</li>
                    <li><strong>{tr("Arranque sin GPS/Internet","Startup without GPS/Internet")}:</strong> {tr("lista hardcoded de todas las estaciones IHM españolas. Siempre hay estaciones para elegir.","hardcoded list of all Spanish IHM stations. Stations always available to select.")}</li>
                    <li><strong>{tr("Nuevos paths FONDEO","New ANCHOR paths")}:</strong> {tr("nuevos paths publicados en Signal K relacionados con la función FONDEO.","new Signal K paths published for the ANCHOR function.")}</li>
                    <li><strong>{tr("Tamaño estable al Zoom","Stable Zoom size")}:</strong> {tr("la interfaz siempre llena la ventana al 100% por defecto, sin encogerse al reducir o ampliar el zoom del navegador.","UI always fills the window at 100% by default, no shrinking or growing when changing browser zoom.")}</li>
                  </ul>
                  <h4>v1.1.1</h4>
                  <ul>
                    <li><strong>{tr("Coeficientes IHM oficiales","Official IHM coefficients")}:</strong> {tr("auto-descarga del PDF. Elimina el 'dato bailante'.","PDF auto-download. Eliminates 'dancing data'.")}</li>
                    <li><strong>{tr("Fix zona horaria","Timezone fix")}:</strong> {tr("coeficiente usa hora local española (no UTC).","coefficient uses Spanish local time (not UTC).")}</li>
                    <li><strong>{tr("Fix ESM __dirname","ESM __dirname fix")}:</strong> {tr("polyfill para módulos ESM.","polyfill for ESM modules.")}</li>
                  </ul>
                  <h4>v1.1.0</h4>
                  <ul>
                    <li><strong>{tr("Alarma de varada","Grounding alarm")}:</strong> {tr("aviso 24h, anticipada, snooze, silenciar.","24h warning, advance, snooze, mute.")}</li>
                    <li><strong>{tr("Curvas interactivas","Interactive curves")}:</strong> {tr("gráfica SVG con cursor y extremos.","SVG chart with cursor and extremes.")}</li>
                    <li><strong>{tr("Bilingüe ES/EN","Bilingual ES/EN")}</strong></li>
                    <li><strong>{tr("Salida/Puesta sol","Sunrise/Sunset")}:</strong> {tr("integración Derived Data.","Derived Data integration.")}</li>
                    <li><strong>{tr("Táctica Rías Baixas","Rías Baixas tactics")}:</strong> {tr("experimental.","experimental.")}</li>
                  </ul>
                  <h4>v1.0.0</h4>
                  <ul><li>{tr("Versión inicial: datos IHM, AUTO/MANUAL, paths Signal K.","Initial release: IHM data, AUTO/MANUAL, Signal K paths.")}</li></ul>
                </>
              ) : lang === "es" ? (
                <>
                  <div style={{ background: 'rgba(220,40,40,0.12)', borderLeft: '4px solid #ff6b6b', padding: '12px 14px', margin: '0 0 16px', borderRadius: 4 }}>
                    <strong style={{ color: '#ff8a8a' }}>AVISO DE SEGURIDAD</strong><br />
                    <span style={{ fontSize: 15 }}>Este plugin es una ayuda a la navegación. No sustituye la vigilancia del patrón, una maniobra de fondeo correcta, las cartas y avisos oficiales, ni la observación directa del entorno. Las estimaciones dependen de la calidad y actualidad de los datos recibidos.</span>
                  </div>

                  <p style={{ fontSize: 18, color: '#cfe6f5', margin: '0 0 14px' }}>
                    Este plugin tiene dos áreas grandes: el <strong>Gestor Avanzado de Fondeo</strong> (vigilancia de ancla, AIS, abrigo, alarmas) y el módulo <strong>Mareas IHM</strong>, que sirve datos oficiales de marea a Signal K y alimenta los cálculos predictivos del gestor.
                  </p>

                  <h2 style={{ borderBottom: '2px solid rgba(255,178,63,0.45)', paddingBottom: 6, marginTop: 4, color: '#ffb23f' }}>⚓ GESTOR AVANZADO DE FONDEO</h2>

                  <h3>1. Qué hace</h3>
                  <p>Combina los sensores reales del barco (GPS, sonda, viento, IMU si lo hay) con previsión meteorológica y marea oficial para vigilar el fondeo de forma continua. La vigilancia corre en el backend (servidor Signal K del barco), por lo que las alarmas siguen activas aunque cierres el navegador en el móvil o la tableta.</p>

                  <h3>2. Configuración mínima</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>2.1 Plugins de Signal K</h4>
                  <ul>
                    <li><strong>Imprescindible — GPS:</strong> debe existir <code>navigation.position</code> publicado por algún driver NMEA0183/NMEA2000 o equivalente.</li>
                    <li><strong>Recomendado — Sol y variación magnética:</strong> <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> con la opción de Sol activa.</li>
                    <li><strong>Opcional — AIS:</strong> cualquier conexión con receptor AIS. El servidor Signal K lo procesa automáticamente.</li>
                    <li><strong>Opcional — sonda y viento:</strong> el driver del transductor que publique los paths estándar <code>environment.depth.*</code> y <code>environment.wind.*</code>.</li>
                    <li><strong>Opcional — IMU:</strong> <code>navigation.attitude</code> y los paths de aceleración. Permiten estimar el movimiento del barco; no sustituyen una boya oceanográfica.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>2.2 Datos del barco</h4>
                  <p>En <em>Signal K → Server → Settings → Vessel Base Data</em> define como mínimo: <strong>Draft</strong> (calado, usado por alarma de varada y calado efectivo); <strong>Length / LOA</strong> (eslora, usada por la geometría del círculo de borneo); <strong>Beam</strong> (manga, opcional). Si tienes roldana de proa por encima del agua, el visor te pide su <strong>altura sobre la línea de flotación</strong> en el panel ⚓ Calc. Fondeo.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>2.3 Hardware recomendado a bordo</h4>
                  <ul>
                    <li><strong>Ordenador del barco:</strong> Raspberry Pi 3B+ o superior con OpenPlotter V4 (o instalación equivalente Signal K + Node.js). Es donde corre el backend del plugin, donde suenan las alarmas y donde se sirven los dispositivos cliente (móvil, tableta).</li>
                    <li><strong>Altavoz USB autoamplificado:</strong> imprescindible para que las alarmas se oigan. El jack analógico del Pi por sí solo es flojo; un altavoz USB con amplificador propio cubre toda la cabina y cubierta. Cualquier modelo compatible con ALSA funciona. El visor lo detecta y selecciona la salida USB primero.</li>
                    <li><strong>GPS (NMEA0183 o NMEA2000):</strong> imprescindible. Sin posición no hay fondeo, ni AIS, ni nada. Publica <code>navigation.position</code>.</li>
                    <li><strong>Sonda (NMEA0183/NMEA2000):</strong> muy recomendada. Sin sonda no hay cálculo de scope ni alarma de varada fiable. Cualquier transductor que publique <code>environment.depth.belowSurface</code>, <code>belowKeel</code> o <code>belowTransducer</code>.</li>
                    <li><strong>Anemómetro (NMEA0183/NMEA2000):</strong> recomendado. Habilita el badge "Veleta" del visor y la degradación en tiempo real del grado de abrigo. Sin él, se trabaja solo con la previsión meteorológica.</li>
                    <li><strong>Receptor AIS (NMEA0183/NMEA2000):</strong> opcional pero muy útil en bahías con tráfico. Habilita la vigilancia AIS de proximidad y la alarma anti-intrusión en tu círculo rojo.</li>
                    <li><strong>IMU / sensor de actitud:</strong> opcional. Si tienes pypilot, MacArthur HAT o un IMU I2C directo, habilita la estimación de olas a bordo (dirección, periodo, altura aparente) y el histórico de 24 h. Sin él, el abrigo se basa solo en el viento previsto.</li>
                    <li><strong>Conexión a Internet (4G/WiFi):</strong> opcional pero recomendada para previsión meteo, mareas Open-Meteo (fuera de cobertura IHM) y datos AIS de internet. El plugin funciona offline con caché local de más de 2 meses.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>2.4 Audio</h4>
                  <p>La salida primaria de seguridad es el ordenador del barco (típicamente un Raspberry Pi). El backend escoge automáticamente la salida disponible en orden: USB → analógica → HDMI. En móviles, tabletas y otros clientes la alarma se reproduce <strong>si</strong> la pestaña está abierta y el navegador ha autorizado el audio. Una aplicación web no puede garantizar sonido cuando el dispositivo está silenciado, en modo no molestar, la pestaña está suspendida o el navegador bloquea la reproducción automática. Considera el audio cliente <strong>complementario</strong>, no sustitutivo del audio del Pi.</p>

                  <h3>3. Cómo fondear bien (maniobra recomendada)</h3>
                  <p>El gestor vigila el fondeo. No fondea por ti. Para que las alarmas sean fiables, la maniobra tiene que ser correcta:</p>
                  <ol style={{ paddingLeft: 22 }}>
                    <li style={{ marginBottom: 8 }}><strong>Aproximación lenta</strong> contra el viento o la corriente dominante. Acércate al punto elegido al ralentí.</li>
                    <li style={{ marginBottom: 8 }}><strong>Parada total sobre el punto.</strong> SOG = 0, proa al viento. El barco empezará a derivar lentamente hacia popa.</li>
                    <li style={{ marginBottom: 8 }}><strong>Echa el ancla</strong> en ese instante y <strong>pulsa FONDEAR AQUÍ inmediatamente.</strong> El sistema guarda la posición GPS del barco como estimación inicial del ancla.</li>
                    <li style={{ marginBottom: 8 }}><strong>Larga cadena</strong> acompañando la deriva hacia popa (motor en muerto o toque muy suave atrás). La cadena debe quedar extendida en línea sobre el fondo, nunca apilada sobre el ancla.</li>
                    <li style={{ marginBottom: 8 }}><strong>Lasca la longitud adecuada</strong> según el modo: <em>Provisional</em> (scope 3,5:1), <em>Normal</em> (5:1, recomendado), <em>Seguro</em> (8:1, mal tiempo o noche). El visor te calcula la cadena necesaria.</li>
                    <li style={{ marginBottom: 8 }}><strong>Tensa con motor atrás</strong> de forma progresiva hasta dejar la línea tensa.</li>
                    <li style={{ marginBottom: 8 }}><strong>Comprueba el clavado.</strong> Mantén motor atrás unos segundos a régimen moderado-fuerte. Si el barco queda inmóvil → ancla clavada. Si sigue desplazándose hacia popa → garreo: leva todo y repite desde el paso 1.</li>
                    <li style={{ marginBottom: 8 }}><strong>Activa la Vigilancia del ancla</strong> y ajusta el margen de la zona de seguridad (ver sección 4).</li>
                    <li><strong>Observa varios minutos</strong> antes de abandonar el barco. Confirma con el track GPS que el patrón de borneo es estable.</li>
                  </ol>
                  <h4 style={{ margin: '12px 0 4px' }}>3.1 Métodos de cálculo de cadena</h4>
                  <ul>
                    <li><strong>Relación de fondeo (scope):</strong> L = scope × D, donde D es la mayor distancia vertical prevista entre roldana y fondo en el horizonte elegido. Scope 3,5:1 / 5:1 / 8:1 según modo.</li>
                    <li><strong>Fórmula Vicente:</strong> L = 15 + 2 × D (metros). Útil como segunda opinión.</li>
                  </ul>
                  <p style={{ fontSize: 14, opacity: 0.85, fontStyle: 'italic' }}>Aclaración técnica: es un cálculo geométrico de fondeo basado en relación de scope, no un modelo físico completo de catenaria (no usa peso lineal ni tensión, solo profundidad, marea predictiva y altura de roldana).</p>

                  <h3>4. Posición del ancla y círculos de vigilancia</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>4.1 El icono ⚓ del mapa</h4>
                  <p>El icono ⚓ representa una <strong>posición estimada</strong>. Al pulsar FONDEAR AQUÍ se guarda la posición GPS del barco en ese instante, no la posición física exacta del ancla en el fondo. La diferencia depende de dónde está la antena GPS, la deriva durante la caída y el desplazamiento al clavarse. El ancla sí ocupa una posición concreta aunque exista incertidumbre sobre ella.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.2 Círculo azul — borneo máximo del barco</h4>
                  <p>Centrado en el icono ⚓, representa la distancia máxima que la <strong>popa</strong> del barco puede alcanzar desde el ancla en el horizonte (típicamente 12 h):</p>
                  <div style={{ background: 'rgba(77,208,255,0.10)', borderLeft: '3px solid #4dd0ff', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>azul = R_cadena + LOA</div>
                  <p>Donde <strong>R_cadena</strong> = proyección horizontal de la cadena lascada (profundidad actual + variación de marea máxima prevista + altura de roldana). <strong>LOA</strong> = eslora del barco.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.3 Círculo rojo — zona de seguridad</h4>
                  <p>Añade al azul un margen configurable (slider). Tiene <strong>dos funciones simultáneas</strong>:</p>
                  <ol style={{ paddingLeft: 22 }}>
                    <li style={{ marginBottom: 6 }}><strong>Vigilancia AIS de proximidad:</strong> cualquier AIS que entre dentro del rojo (más su eslora) dispara alarma. Cuanto más extra, más distancia mínima exiges a vecinos. Útil en bahías concurridas.</li>
                    <li><strong>Alarma de garreo del propio barco:</strong> si el GPS sale del rojo (con 2 m de histéresis para absorber ruido GPS), salta alarma de garreo.</li>
                  </ol>
                  <h4 style={{ margin: '12px 0 4px' }}>4.4 Regla operativa</h4>
                  <p>Lo importante no es que el icono ⚓ esté en el centímetro exacto, sino que el <strong>círculo azul englobe todos los borneos reales del barco</strong>. Si ves que el barco roza el azul habitualmente, lasca más cadena. El extra del rojo lo decides según contexto: solitario bajo (5–10 m), bahías concurridas alto.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>4.5 Corregir una posición mal marcada</h4>
                  <ul>
                    <li><strong>Por el track GPS:</strong> tras fondear y dar atrás, el track describe una curva que se tensa hacia popa. El punto donde se inicia esa tensión está muy cerca del ancla.</li>
                    <li><strong>Por inferencia con la cadena lascada:</strong> con cadena tensa, el ancla queda aproximadamente a la proyección horizontal de la cadena por delante de la proa.</li>
                    <li><strong>Arrastra el icono ⚓</strong> sobre el mapa al punto correcto, o introduce coordenadas exactas a mano.</li>
                  </ul>
                  <h4 style={{ margin: '12px 0 4px' }}>4.6 Si largas más cadena o re-tensas</h4>
                  <p>Larga cadena, vuelve a tensar atrás y abre ⚓ Calc. Fondeo para actualizar la longitud. El círculo azul se ajusta al nuevo radio. Si el rojo se queda corto, súbelo con el slider del panel de alarmas.</p>

                  <h3>5. Vigilancia continua</h3>
                  <ul>
                    <li><strong>Alarma de garreo:</strong> si el GPS del barco supera el círculo rojo (2 m de histéresis), salta sirena y voz. La sirena tiene prioridad sobre el mute de usuario dentro de los límites del sistema y navegador.</li>
                    <li><strong>Auto-desarme al salir a motor:</strong> si tu SOG se mantiene por encima de <strong>3 nudos durante 30 segundos seguidos</strong>, el plugin asume que sales intencionalmente y desarma la vigilancia. Garreo real raramente excede 1–2 kn; movimientos sostenidos &gt; 3 kn son casi siempre propulsión propia. Recibes notificación informativa en Signal K. En zonas de corriente muy fuerte (rías, estrechos) tenlo presente.</li>
                    <li><strong>Track GPS con gradiente temporal:</strong> oscuro = antiguo, claro = reciente.</li>
                    <li><strong>Fondeos favoritos:</strong> guarda con nombre personalizado o auto-nombre. Sincronizados entre dispositivos.</li>
                  </ul>

                  <h3>6. Sensores reales (viento, IMU, sonda)</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>6.1 Viento</h4>
                  <p>Lee <code>environment.wind.angleApparent</code> + <code>speedApparent</code> de Signal K. La etiqueta "Veleta" diferencia el dato real del meteorológico previsto.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>6.2 IMU y movimiento del barco</h4>
                  <p>Si tienes pypilot o IMU, el plugin lee <code>navigation.attitude</code> y aceleración para <strong>estimar</strong> dirección, período y altura aparente de las olas. Histórico 24 h en barras de 5 minutos visible en el popup de abrigo. Son estimaciones derivadas del comportamiento del barco, <strong>no mediciones oceanográficas certificadas</strong>: dependen del algoritmo, calibración, posición del sensor, casco y amarre. Endpoint <code>/api/imu/status</code> para diagnóstico.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>6.3 Sonda</h4>
                  <p>La lectura se considera válida sólo si: (1) último valor llegó hace menos de <strong>5 segundos</strong> (timestamp), (2) no está congelada (cambio &gt; ±2 cm en 60 s), (3) no es un pico anómalo ni absurdo. Si falla, el visor muestra <strong>SONDA CONGELADA</strong> o <strong>SONDA STALE</strong> en lugar del último número, evitando que el sistema "invente" profundidad.</p>

                  <h3>7. Vigilancia AIS de proximidad</h3>
                  <p>Detecta blancos AIS dentro del círculo rojo. <strong>Es alarma de proximidad geométrica, no un sistema anti-colisión basado en CPA/TCPA.</strong> No predice trayectorias relativas; reacciona cuando un AIS entra en la zona.</p>
                  <ul>
                    <li><strong>Base de datos persistente (72 h):</strong> guarda nombre, eslora, manga, tipo, callsign e IMO de cada barco visto. Al reiniciar, los nombres ya están sin esperar al próximo paquete estático (puede tardar hasta 6 min).</li>
                    <li><strong>Cache fantasma (5 min):</strong> si pierde recepción VHF brevemente, sigue visible con una X discreta y aviso "datos estimados" con antigüedad del dato.</li>
                    <li><strong>Slider de radio (0,5–50 km):</strong> controla cuántos barcos ver en mapa y lista. Persistente.</li>
                    <li><strong>Lista filtrable y ordenable:</strong> por distancia, nombre, favoritos, MMSI o tipo. Caja de filtro con feedback "Sin resultados".</li>
                    <li><strong>Favoritos:</strong> marca con ★ amarilla. Persistido en backend y sincronizado entre dispositivos.</li>
                    <li><strong>Iconos por tipo:</strong> ⛵ velero, 🛥️ recreo, 📦 carga, 🛢️ tanque, 🛳️ pasaje, 🎣 pesca…</li>
                    <li><strong>Botón 🔍 vesselfinder:</strong> abre vesselfinder.com en nueva pestaña con IMO + MMSI.</li>
                    <li><strong>Alarma de proximidad:</strong> AIS dentro del rojo (considerando su eslora) → alarma de voz con tiempo de gracia. ACK silencia ese MMSI sin afectar al resto.</li>
                    <li><strong>Reactivación por acercamiento:</strong> AIS ACKeado que vuelve a moverse hacia ti (&gt; 0,5 kn, acercamiento &gt; 5 m/min) reactiva alarma. ACK caduca a los 15 min.</li>
                    <li><strong>Click-to-focus:</strong> click en un AIS → mapa lo centra, lo sigue y muestra distancia en directo. La X del aro deselecciona.</li>
                  </ul>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4 }}>
                    <strong>Límite del AIS:</strong> no todos los barcos transmiten AIS; los datos pueden llegar con retraso o contener errores. Mantén vigilancia visual y radar cuando corresponda.
                  </div>

                  <h3>8. Indicador de abrigo (Shelter)</h3>
                  <p>Análisis automático de cuán expuesto está tu fondeo al viento previsto en las próximas 12 h. Es un <strong>indicador geométrico de exposición</strong>, no una garantía de abrigo: no incorpora altura del terreno, fetch real, refracción, difracción ni efectos batimétricos.</p>
                  <ul>
                    <li><strong>Rosa de 16 sectores:</strong> autodetección de sectores con costa/estructura artificial cerca (verde = abrigado) vs. mar abierto (rojo). Usa OpenStreetMap (línea de costa + escolleras/muelles man-made).</li>
                    <li><strong>Grado A–F y % de protección:</strong> A = totalmente abrigado geométricamente; F = expuesto a temporal. % desde viento previsto en sectores expuestos durante 12 h.</li>
                    <li><strong>Strip horario 12 h:</strong> grado por hora y viento pico. Pincha una celda para detalle.</li>
                    <li><strong>Historial de olas estimadas (24 h):</strong> intensidad/período/altura derivados del IMU. Una barra cada 5 minutos, eje vertical autoescalable hasta 2 m.</li>
                    <li><strong>Degradación en tiempo real:</strong> si la veleta mide más viento que el previsto en un sector expuesto, el grado A–F baja y aparece "▼ Real · Viento". Lo mismo con olas estimadas: "▼ Real · Olas". Bandas calma/rizada NO degradan el grado.</li>
                  </ul>

                  <h3>9. Calculadora de fondeo y alarma de varada</h3>
                  <h4 style={{ margin: '12px 0 4px' }}>9.1 Calculadora de fondeo</h4>
                  <p>Estima cadena recomendable y radio de borneo para el horizonte elegido (típicamente 12 h). Usa la mayor distancia vertical prevista entre roldana y fondo durante ese periodo. Publica opcionalmente en Signal K: ratio de scope, resumen de recomendación, metros de cadena y radios de borneo (actual y máximo). Si la profundidad mínima prevista cae por debajo del calado efectivo, alerta roja parpadeante.</p>
                  <h4 style={{ margin: '12px 0 4px' }}>9.2 Alarma de varada</h4>
                  <p>El calado efectivo se define así:</p>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>calado_efectivo = (calado_base + margen_seguridad) × 1,15</div>
                  <p>La alarma compara la profundidad futura proyectada con ese calado efectivo. La proyección:</p>
                  <div style={{ background: 'rgba(77,208,255,0.10)', borderLeft: '3px solid #4dd0ff', padding: '10px 14px', margin: '8px 0', borderRadius: 4, fontFamily: 'monospace' }}>profundidad_futura = profundidad_actual + (marea_actual − marea_futura)</div>
                  <ul>
                    <li><strong>Aviso 24 h:</strong> detecta riesgo en las próximas 24 h.</li>
                    <li><strong>Alarma anticipada:</strong> avisa X minutos antes de quedarse sin calado, con sonido.</li>
                    <li><strong>Posponer:</strong> retrasa el aviso sin borrar el riesgo.</li>
                    <li><strong>Silenciar sonido:</strong> desactiva audio pero mantiene alerta visual y estado SK.</li>
                  </ul>
                  <div style={{ background: 'rgba(255,178,63,0.10)', borderLeft: '3px solid #ffb23f', padding: '10px 14px', margin: '8px 0', borderRadius: 4 }}>
                    <strong>Aptitud de la fuente de marea para la alarma de varada:</strong> las fuentes sintéticas (Mediterráneo M2, Sin marea) y Open-Meteo (rebajado a nivel local aproximado, no Cero Hidrográfico real) sirven para visualización. Para la alarma de varada usa una estación oficial IHM dentro de su cobertura. Si seleccionas una estación sintética, considera el aviso solo informativo.
                  </div>

                  <h3>10. Audio multidispositivo</h3>
                  <p>Salida primaria del Pi del barco: sirena sintética + voz pregrabada (OGG) en el idioma elegido. Si no hay OGG, fallback automático a TTS (espeak). Selección de salida: USB → analógica → HDMI. Réplica en dispositivos cliente conectados (móvil, tablet) si su pestaña está abierta y han autorizado el audio. La réplica cliente es complementaria, no más fiable que el audio local.</p>

                  <h3>11. Mapa y capas</h3>
                  <ul>
                    <li>Satélite Esri (por defecto), Bing Hybrid, Esri Clarity, Google Satélite.</li>
                    <li>OpenStreetMap, OpenSeaMap.</li>
                    <li>Cartas oficiales IHM (WMS), Batimetría.</li>
                    <li>Cartas MBTiles offline con slider de transparencia: copia tus <code>.mbtiles</code> a la carpeta de cartas (típicamente <code>/home/pi/charts/</code> en OpenPlotter) y aparecen como checkboxes.</li>
                  </ul>
                  <p style={{ fontSize: 14, opacity: 0.85, fontStyle: 'italic' }}>Ninguna capa no oficial debe presentarse como sustituta de la cartografía náutica oficial vigente.</p>

                  <p style={{ fontSize: 18, color: '#9bb4c8', fontStyle: 'italic', margin: '24px 0 8px', borderTop: '1px dashed rgba(255,255,255,0.18)', paddingTop: 18 }}>
                    A continuación, el módulo de mareas que alimenta el gestor de fondeo con datos oficiales:
                  </p>

                  <h2 style={{ borderBottom: '2px solid rgba(77,208,255,0.4)', paddingBottom: 6, marginTop: 4, color: '#4dd0ff' }}>📊 MÓDULO MAREAS (IHM)</h2>

                  <h3>12. Fuentes de datos y aptitud para seguridad</h3>
                  <ul>
                    <li><strong>IHM oficial (~70 estaciones):</strong> predicción astronómica oficial del Instituto Hidrográfico de la Marina para toda la costa española (península, Baleares y Canarias). Datos mensuales con coeficiente. Referida al <strong>Cero Hidrográfico</strong> de cada estación. Resolución de publicación centimétrica; el nivel real puede desviarse por presión, viento, oleaje o aportes fluviales.</li>
                    <li><strong>🌍 Open-Meteo global:</strong> predicción mundial para cualquier lat/lon, modelo hidrodinámico. Refresco cada 12 h. Sin API key. El plugin ajusta los datos a un nivel local aproximado (típicamente bajamar semanal ≈ 0). <strong>No es Cero Hidrográfico oficial</strong>; es una aproximación útil para consulta relativa. Para alarma de varada calibra localmente antes de fiarte del aviso.</li>
                    <li><strong>Mediterráneo:</strong> curva sintética sinusoidal M2 (amplitud ≈ 0,2 m). Solo visualización donde la marea astronómica es despreciable.</li>
                    <li><strong>Sin marea / Offshore:</strong> curva plana (Δ = 0 m). Permite arrancar el visor sin internet ni cobertura. No representa nivel real.</li>
                  </ul>
                  <p>En el dropdown, las sintéticas aparecen <strong>primeras</strong> en MANUAL (acceso rápido) y <strong>al final</strong> en AUTO (la "más cercana" debe ser una IHM real).</p>

                  <h3>13. Selección automática y manual</h3>
                  <ul>
                    <li><strong>AUTOMÁTICO:</strong> detecta la estación más cercana por GPS (radio 300 km). Puedes marcar una "favorita": AUTO seguirá las próximas pero la recordará si vuelves.</li>
                    <li><strong>MANUAL:</strong> selecciona cualquier estación, incluidas las sintéticas. Útil fuera de rango GPS o para consulta de otra zona.</li>
                  </ul>
                  <p>Si no hay GPS al arrancar, el plugin actualmente recurre a Vigo como respaldo. Cuando llega señal GPS, cambia automáticamente a la estación válida más cercana. Mientras estés en el respaldo, la marea mostrada puede no corresponder a tu posición real.</p>

                  <h3>14. Curvas, hora y referencia vertical</h3>
                  <p>Pulsa <strong>CURVAS</strong> para abrir la gráfica interactiva SVG. Muestra extremos (pleamares y bajamares), hora actual marcada e interpolación sinusoidal. <strong>Eje horizontal:</strong> hora local de la estación (Europe/Madrid o Atlantic/Canary). <strong>Eje vertical:</strong> altura en metros sobre la referencia de la fuente — Cero Hidrográfico para IHM, nivel local aproximado para Open-Meteo, altura relativa para sintéticas.</p>

                  <h3>15. Coeficiente, solares y corriente</h3>
                  <ul>
                    <li><strong>Coeficiente de mareas:</strong> oficial del IHM, descargado del PDF anual. Valores &gt; 90 implican grandes carreras de marea; &lt; 40 mareas muertas.</li>
                    <li><strong>Datos solares:</strong> amanecer y puesta. Requiere GPS + <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> con Sol activo.</li>
                    <li><strong>🧭 Navegación táctica Rías Baixas:</strong> función experimental e informativa. Consejo táctico basado en fase de marea (llenante/vaciante) y porcentaje. La corriente local real depende también del canal y desfases entre nivel y corriente — complemento, no verdad absoluta.</li>
                  </ul>

                  <h3>16. Caché y funcionamiento sin Internet</h3>
                  <p>Caché local de más de 2 meses de datos IHM. Auto-actualización cada 48 h cuando hay conexión. Primer arranque sin Internet: estaciones hardcoded como respaldo.</p>

                  <h3>❓ Preguntas frecuentes</h3>
                  <h4 style={{ margin: '10px 0 4px' }}>Sobre el fondeo</h4>
                  <ul>
                    <li><strong>¿El icono ⚓ marca la posición exacta del ancla?</strong> → No. Es la posición GPS del barco al pulsar FONDEAR AQUÍ. La posición real del ancla puede estar a unos metros. Lo importante es que el círculo azul englobe todos los borneos reales.</li>
                    <li><strong>¿Qué diferencia hay entre el círculo azul y el rojo?</strong> → El azul = alcance máximo de la popa (cadena + LOA). El rojo = azul + margen configurable. Funciona a la vez como zona de vigilancia AIS de proximidad y como umbral de alarma de garreo (2 m de histéresis).</li>
                    <li><strong>¿Puedo mover el ancla si la marqué mal?</strong> → Sí: arrastra el icono ⚓ o introduce coordenadas a mano. Los círculos se recentran al instante.</li>
                    <li><strong>¿Cómo cambio el scope o la cadena en mitad del fondeo?</strong> → Abre ⚓ Calc. Fondeo, cambia modo o longitud. El azul se actualiza. Ajusta el rojo con el slider si necesitas más margen.</li>
                    <li><strong>¿Funciona la alarma si cierro el navegador?</strong> → Sí. La vigilancia corre en el backend del Pi. Audio del Pi y notificaciones SK siguen activos. Los clientes web suenan en paralelo si su pestaña está abierta.</li>
                    <li><strong>¿Por qué se desarma sola a veces?</strong> → Si tu SOG supera 3 nudos durante 30 s seguidos, asumimos salida intencional. Garreo real raramente excede 1–2 kn. Si esperas corrientes muy fuertes, tenlo en cuenta.</li>
                    <li><strong>¿Qué significa "SONDA CONGELADA"?</strong> → Sin updates en &gt; 5 s, o valor fijo (±2 cm en 60 s), o pico anómalo. En lugar de mostrar un número que invita a error, el visor lo declara explícitamente.</li>
                  </ul>
                  <h4 style={{ margin: '10px 0 4px' }}>Sobre Signal K y configuración</h4>
                  <ul>
                    <li><strong>¿No aparece la posición GPS?</strong> → Comprueba que <code>navigation.position</code> está publicado. Necesitas receptor GPS conectado y driver activo.</li>
                    <li><strong>¿Qué plugins SK necesito para amaneceres y puestas?</strong> → <a href="https://www.npmjs.com/package/signalk-derived-data" target="_blank" rel="noopener" style={{ color: '#4dd0ff' }}>signalk-derived-data</a> con Sun activa.</li>
                    <li><strong>¿Dónde configuro el calado?</strong> → Signal K → Server → Settings → Vessel Base Data → Draft. Se usa para la alarma de varada y el calado efectivo +15%.</li>
                  </ul>
                  <h4 style={{ margin: '10px 0 4px' }}>Sobre mareas</h4>
                  <ul>
                    <li><strong>¿La hora es UTC?</strong> → No, hora local de la estación.</li>
                    <li><strong>¿Funciona sin Internet?</strong> → Sí, caché local de más de 2 meses.</li>
                    <li><strong>¿Puedo usar una marea sintética para la alarma de varada?</strong> → No recomendable. Mediterráneo M2 y "Sin marea" son aproximadas; Open-Meteo está rebajado a nivel local aproximado pero no es Cero Hidrográfico real. Usa estación IHM oficial.</li>
                    <li><strong>¿Qué es el Cero Hidrográfico?</strong> → Datum vertical del IHM, aproximadamente la bajamar astronómica más baja del año.</li>
                    <li><strong>¿Por qué Open-Meteo difiere de IHM en la misma posición?</strong> → IHM usa Cero Hidrográfico; Open-Meteo usa MSL ajustado localmente. Pueden diferir decenas de cm.</li>
                    <li><strong>¿Qué navegadores soporta?</strong> → Firefox y Chromium (OpenPlotter default). Optimizado 1920×1080, responsive a móvil/tableta.</li>
                  </ul>
                </>
              ) : (
                <>
                  <div style={{ background: 'rgba(220,40,40,0.12)', borderLeft: '4px solid #ff6b6b', padding: '12px 14px', margin: '0 0 16px', borderRadius: 4 }}>
                    <strong style={{ color: '#ff8a8a' }}>SAFETY NOTICE</strong><br />
                    <span style={{ fontSize: 15 }}>This plugin is a navigation aid. It does not replace the skipper's watch, a correct anchoring manoeuvre, official charts and notices, or direct observation of the surroundings. Estimates depend on the quality and currency of the incoming sensor data.</span>
                  </div>

                  <p style={{ fontSize: 18, color: '#cfe6f5', margin: '0 0 14px' }}>
                    This plugin has two large areas: the <strong>Advanced Anchor Watch Manager</strong> (anchor watch, AIS, shelter, alarms) and the <strong>IHM Tides</strong> module, which serves official Spanish tide data to Signal K and feeds the manager's predictive calculations.
                  </p>

                  <h2 style={{ borderBottom: '2px solid rgba(255,178,63,0.45)', paddingBottom: 6, marginTop: 4, color: '#ffb23f' }}>⚓ ADVANCED ANCHOR WATCH MANAGER</h2>

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
                <input type="text" value={instrSearch} onChange={(e) => setInstrSearch(e.target.value)} placeholder={tr("🔍 Buscar...", "🔍 Search...")} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', color: 'white', padding: '8px 12px', fontSize: '14px', width: '160px' }} />
                {instrSearch.length >= 2 && <span style={{ fontSize: '12px', opacity: 0.7 }}>{instrMatchCount > 0 ? instrMatchCount : "0"}</span>}
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
                <span className="anchor-unit">m</span>
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
                <span className="anchor-unit">m</span>
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
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>m</span>
                </div>
              ) : (
                <span className="anchor-rbox-value">{chainDeployedVal ? `${chainDeployedVal} m` : `${anchorResult.chainL} m`}</span>
              )}
              <span style={{ position: 'absolute', bottom: '3px', right: '6px', fontSize: '23px', opacity: 0.9, fontWeight: 700, color: '#ffb74d' }}>
                {chainDeployedVal ? `rec: ${anchorResult.chainL}m` : tr("pulsa para editar", "tap to edit")}
              </span>
            </div>
            <div className="anchor-rbox anchor-rbox-highlight">
              <span className="anchor-rbox-label">🌊 {tr("Profundidad ahora", "Depth now")}</span>
              <span className="anchor-rbox-value">{anchorResult.dNow?.toFixed(2) ?? "–"} m</span>
              {anchorResult.depthPathUsed && <span style={{ fontSize: '10px', opacity: 0.5 }}>{anchorResult.depthPathUsed === "none" ? tr("⚠ manual", "⚠ manual") : "SK ✓"}</span>}
            </div>

            {/* Row 2 */}
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">📈 {tr("Profundidad máxima", "Max depth")}</span>
              <span className="anchor-rbox-value">{anchorResult.depthMax?.toFixed(2) ?? "–"} m</span>
            </div>
            <div className={`anchor-rbox${anchorResult.draftEffective != null && anchorResult.depthMin != null && anchorResult.depthMin < anchorResult.draftEffective ? " anchor-rbox-danger" : ""}`}>
              <span className="anchor-rbox-label">📉 {tr("Profundidad mínima", "Min depth")}</span>
              <span className="anchor-rbox-value">{anchorResult.depthMin?.toFixed(2) ?? "–"} m</span>
              {anchorResult.draftEffective != null && anchorResult.depthMin != null && anchorResult.depthMin < anchorResult.draftEffective && <span className="anchor-rbox-alert">⚠ &lt; {tr("calado ef.", "eff. draft")} {anchorResult.draftEffective}m</span>}
            </div>

            {/* Row 3 */}
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">↔ {tr("Radio de borneo ahora", "Swing radius now")}</span>
              <span className="anchor-rbox-value">{anchorResult.swingRadiusNow ?? anchorResult.swingRadiusMax} m</span>
            </div>
            <div className="anchor-rbox">
              <span className="anchor-rbox-label">↔ {tr("Radio de borneo máximo", "Max swing radius")}</span>
              <span className="anchor-rbox-value">{anchorResult.swingRadiusMax} m</span>
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
      />
    )}
    </>
  );
}
