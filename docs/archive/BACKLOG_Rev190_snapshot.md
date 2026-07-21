# BACKLOG — todo lo recogido del usuario y memorias

Status legend: **ACTIVE** = en sprint actual o próximo. **DONE** = confirmado por usuario. **PAUSED** = postergado a futuro release. **DROPPED** = descartado por usuario.

---

## Sprint 1 — Backend Source of Truth + Multi-device Sync (CRÍTICO)

| Item | Status | Bug ref |
|---|---|---|
| AIS ACK cross-device end-to-end + restaurar motor antiguo completo | ACTIVE | B-03 |
| Snooze cross-device (verificar Pi audio stop + visor remoto state:normal) | ACTIVE | B-02 |
| Mute cross-device (nuevo endpoint backend) | ACTIVE | B-01 |
| Cancelar fondeo propaga inmediato (lift + clear notifications + SSE clean) | ACTIVE | B-04 |
| "Ancla fondeada" fantasma fix real (request-id en /drop) | ACTIVE | B-05 |
| Anillos updates en tiempo real (idempotent updC) | ACTIVE | B-07 |
| Preview slider sin saltos (rAF + fórmula directa sin chainDep) | ACTIVE | B-08 |
| Bolitas drag persistencia robusta (backend NO pisa override) | ACTIVE | B-09 |
| Meteo REVERTIR transpose Rev190, dejar layout Rev188 (rows=métricas, cols=horas, scroll-X) | ACTIVE | B-10 |
| Previsión Abrigo: ventana 100vw, strip scroll-X interno | ACTIVE | B-11 |
| TidesView embed: fit pantalla + centrado | ACTIVE | B-12 |
| TidesView embed: solo botón Curvas, resto al hamburger | ACTIVE | B-13 |
| Avisos fantasmas: instrumentar logs + pedir timestamps al usuario | ACTIVE | B-06 |

## Sprint 2 — Cálc Fondeo

| Item | Status | Bug ref |
|---|---|---|
| Cálc Fondeo horizonte arriba | ACTIVE | B-15a |
| Cálc Fondeo inputs disparan calcFondeo() auto en `input` event | ACTIVE | B-15b |
| Cálc Fondeo selector: corregir letra blanca sobre fondo blanco | ACTIVE | B-15c |
| Quitar "Sonarchart" → "Batimetría" (no commercial refs) | ACTIVE | B-22 |

## Sprint 3 — i18n exhaustivo

| Item | Status | Bug ref |
|---|---|---|
| Barrer popups dinámicos JS (m_renderMeteoWindy, m_renderShelterStrip, etc.) | ACTIVE | B-16 |
| Sustituir alert()/confirm() por modal i18n-aware | ACTIVE | B-16 |
| Bottom-bar + wx-bar labels i18n | ACTIVE | B-16 |
| Cálc Fondeo modal i18n | ACTIVE | B-16 |
| Pi voces cambio inmediato con lang (abortar paplay en curso) | ACTIVE | B-17 |
| Audio EN cuando EN seleccionado verificado end-to-end | ACTIVE | B-17 |

## Sprint 4 — UI lite (solo lo que pediste, sin declutter ni unificación masiva)

| Item | Status | Bug ref |
|---|---|---|
| Botones Atrás template CSS único | ACTIVE | B-20 |
| Subir tamaño TODAS las letras móvil 2-4px más | ACTIVE | B-21 |
| Verificar Centrar zoom-fit a veces no funciona | ACTIVE | (Q-A vagamente) |
| Modales: full screen, textos solo izquierda (no justificar ambos lados) | ACTIVE | (Q-AA) |

## Sprint 5 — Push y background

| Item | Status | Bug ref |
|---|---|---|
| Service Worker registrado en mobile.html | ACTIVE | B-18 |
| Web Push API (suscripción primer click usuario) | ACTIVE | B-18 |
| Push notification: garreo = sonido + vibración + banner | ACTIVE | B-18 |
| Push notification: posible colisión = audio + vibración (sin banner persistente) | ACTIVE | B-18 |
| Wake lock con alarma activa (verificar móvil/tablet, Pi ya OK) | ACTIVE | (Q-Z) |

## Sprint 6 — Instrucciones + extras

| Item | Status | Bug ref |
|---|---|---|
| Instrucciones expandidas: copy-paste literal de TidesView (buscador, aviso legal, créditos) y luego actualizar info | ACTIVE | B-19 |
| Sección de debug interna que muestre TODO lo que hace el programa | ACTIVE | (Q-AS) |
| Histórico de eventos persistente (garreó X:XX, ACK target Y, snooze Z:ZZ, AIS target aparece/desaparece) | ACTIVE | (Q-AS) |

---

## PAUSED — buenas ideas para release siguiente

| Item | Razón pausa |
|---|---|
| Telegram bot UI (token + chat_id usuario) | Q-C: en pausa |
| Compartir/exportar fondeo (coords+radio por Telegram/email/QR) | Q-AP: pausa |
| **NOAA NCDS chart layer** (US) | Pendiente Rev320+ — añadir capa "NOAA US Charts" con WMS/WMTS de NOAA Chart Display Service. Endpoint base: `https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer`. Gratis, sin API key. Otros candidatos investigados: CHS Canadá, LINZ NZ, Traficom Finlandia, Kartverket Noruega. UKHO/SHOM son comerciales/licencia y no se incluyen. Ver nota en CLAUDE.md si está. |

---

## DROPPED — descartados por el usuario

| Item | Decisión |
|---|---|
| Desktop landscape font scaling | Q-I: ya bien |
| Cálc Varada = Cálc Sonda | Q-D: era confusión, ya bien |
| Sonda errática / freeze | Q-V: ya arreglado |
| Voces TTS hombre/mujer | Q-AR: ya bien |
| Botón "TEST ALARMA" | Q-AT: dejar como está |
| Audio QZ overboost 3-4 | Q-K: ya bien |
| Declutter visor | Q-J: completado |
| Unificar TODOS los botones a estilo Mareas (más allá Atrás) | Q-J: completado |
| q12 "no dejalo hasta abajo visible" | descartado |
| Q3-Q11 macro screenshot | descartados |
| Persona junior dev tone | Q-AH: olvidar |
| Offline banner / pantalla blanca | Q-AL: olvidar |
| Ad blocker leak | Q-AM: out of scope |
| IMU + pypilot phase 2 | Q-X: ya bien |
| USB routing + chart defaults + mobile audio backlog | Q-Y: ya bien |
| Tema claro/oscuro switch | Q-AG: siempre dark |
| Zoom indicator | Q-AK: ya quitado |
| Botones flotantes refactor | Q-AJ: solucionado |
| Build counter custom | Q-AO: ya bien |
| Datos SOG/DEPTH refinado | Q-B: ya bien |
| Cartas en hamburger (movido a sidebar) | Q-A: dejarlo en sidebar |

---

## Confirmados DONE (no abrir)

| Item | Rev |
|---|---|
| Voces OGG restore tras script Restore | Rev187 (script user) |
| Sidebar y hamburger order correcto | Rev187 |
| Hamburger icono visible | Rev188 v2 |
| Snooze countdown UI / icono 💤 | Rev187 |
| Centrar zoom-fit (a veces falla, verificar S4) | Rev188 |
| Info modal título + botones AIS/Sonda | Rev187 |
| Cartas y capas texto grande (insuficiente, subir más S4) | Rev189 |
| Donut/olas grande info-window Abrigo | Rev189 |
| Strip Abrigo OLA visible portrait | Rev189-190 |
| Sliders en Info fondeo modal | Rev189 |
| Hamburger aviso legal + bloque versión | Rev189 |
| Pi browser animaciones desactivadas | Rev188 v1 |
| Build display version+rev+timestamp+gitHash | Rev187 |
| Aviso legal en menú hamburger | Rev189 |

---

## INVARIANTES — nunca cambiar sin permiso explícito

- Backend = single source of truth (Q-N)
- Mobile.html como UI única (Q-O)
- Tema dark only (Q-AG)
- Predictive swing ring siempre ON (Q-AF)
- Pi audio sin más software gain (memoria audio_hardware_ceiling)
- Branch único `main` (sin develop/staging)
- Solo `espeak` mandatorio en deps externas (memoria minimal_deps)
- Cero referencias comerciales en código/UI (memoria no_commercial_refs)
- Localhost en ejemplos URL, no `<pi-ip>` (memoria use_localhost)
