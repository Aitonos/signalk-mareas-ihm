# BACKLOG — items abiertos en Rev761 / v2.9.0

Estado: **2026-07-21** — reescrito desde cero tras auditoría. Los
sprints 1-6 originales (B-01…B-22, período Rev190) están todos
resueltos y archivados en
[`archive/BACKLOG_Rev190_snapshot.md`](archive/BACKLOG_Rev190_snapshot.md).

Nota: no hay estructura de sprints activa. Trabajamos por feature
request de Carlos + bug hunt reactivo. Los "sprints" I/J/K de las
memorias están todos completados y viven como snapshot histórico en
[`SPRINTS.md`](SPRINTS.md).

---

## ACTIVE — a acometer cuando toque

| Item | Prio | Ref |
|---|---|---|
| Smoothing filter sonda (~30 cm oscilación) | Baja | [K-01 en KNOWN_BUGS.md](KNOWN_BUGS.md#k-01) |
| QA en agua real de features 2.7.0 → 2.9.0 (ver KNOWN_BUGS) | Media | Carlos, cuando salga a navegar |

---

## PAUSED — buenas ideas para versión futura

| Item | Razón pausa |
|---|---|
| Telegram bot UI ampliada (bot commands, chat groups) | Q-C: token/chat_id ya guardables desde wizard; el resto en pausa. |
| Compartir/exportar fondeo (coords+radio por Telegram/email/QR) | Q-AP: baja demanda. |
| **NOAA NCDS chart layer** (US) | Endpoint base `https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer` — gratis, sin API key. Candidatos futuros: CHS Canadá, LINZ NZ, Traficom Finlandia, Kartverket Noruega. UKHO/SHOM son comerciales, no se incluyen. |
| **AIS Friends forwarder embebido (Fase 2)** | El plugin actúa como AIS Dispatcher: lee NMEA `!AIVDM` del bus SK y lo reenvía por UDP a `ais.aisfriends.com:<port>`. Elimina la necesidad de instalar AIS Catcher/SDRAngel. Mismo mecanismo serviría para aishub cuando quisieran. Ver [aisfriends card en wizard](../public/mobile.html) para contexto de por qué está pausado. |
| **AIS Hub forwarder embebido (Fase 2)** | Análogo al de AIS Friends. |

---

## DROPPED — descartados por Carlos (no re-abrir sin repro fresco)

| Item | Decisión |
|---|---|
| Desktop landscape font scaling | Q-I |
| Cálc Varada = Cálc Sonda (era confusión) | Q-D |
| Voces TTS hombre/mujer | Q-AR |
| Audio QZ overboost 3-4 | Q-K |
| Declutter visor | Q-J: completado |
| Unificar TODOS los botones a estilo Mareas | Q-J: completado |
| Persona junior dev tone | Q-AH |
| Offline banner / pantalla blanca | Q-AL |
| Ad blocker leak | Q-AM: out of scope |
| IMU + pypilot phase 2 avanzado | Q-X: ya bien |
| USB routing + chart defaults + mobile audio backlog | Q-Y: ya bien |
| Tema claro/oscuro switch | Q-AG: siempre dark |
| Zoom indicator | Q-AK |
| Botones flotantes refactor | Q-AJ |
| Build counter custom | Q-AO |
| Datos SOG/DEPTH refinado | Q-B |
| Cartas en hamburger | Q-A: sidebar es el sitio |
| Botón "TEST ALARMA" en menú | Q-AT (test-alarm ya vive en wizard) |

---

## INVARIANTES — nunca cambiar sin permiso explícito de Carlos

- Backend = single source of truth (Q-N). Toda acción con múltiples
  controles POSTea al mismo endpoint y lee del SSE.
- `mobile.html` como UI única (Q-O). No hay rama desktop separada.
- Tema dark only (Q-AG).
- Predictive swing ring siempre ON (Q-AF).
- Pi audio sin más software gain (memoria `project_audio_hardware_ceiling`).
- Branch único `main` (sin develop/staging).
- Solo `espeak` mandatorio en deps externas (memoria `feedback_minimal_deps`).
- Cero referencias comerciales en código/UI (memoria `feedback_no_commercial_refs`).
- Localhost en ejemplos URL, no `<pi-ip>` (memoria `feedback_use_localhost`).
- No re-abrir Q-R / B-03 / AIS engine (memoria `project_ais_engine_resolved`).
- No mencionar "Hoekens" en changelogs/README/PRs (memoria
  `feedback_no_hoekens_reference`).
