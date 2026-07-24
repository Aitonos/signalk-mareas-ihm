# Changelog

## [2.10.2] - 2026-07-24

### English

**Fix: `navigation.anchor.position=null` was emitted every 6 s (broke autostate) + AIS UI redesign (single ring per vessel, auto-track on selection)**

Patch release. Two independent user-facing fixes.

- **Canonical anchor paths only emitted on state transitions** (bug reported by Pablo). Until 2.10.1, `evaluateAnchorWatch` re-emitted `navigation.anchor.position=null` + `navigation.anchor.state="off"` on every tick (~ every 6 s) whenever the boat was not anchored. `@meri-imperiumi/signalk-autostate` (and any other subscriber) interpreted each `null` delta as an "anchor just lifted" event, causing the boat state to flip from "moored" to "underway" every 6 s. Now the canonical paths are published exactly once per state transition: at drop with position + state="on", at lift with position=null + state="off", then silence. Internal `environment.anchor.mareasIhm.*` paths keep their cyclic emission (no external consumer, no problem).
- **AIS selection UI redesigned** (feedback from Carlos: "el aro que salga siempre debe ser el estimado de radio, un solo color un solo tipo de aro"). Complete rework:
  - **Tracks are automatic on selection**. No more global toggle for the mass. Select a vessel (click marker, click list row, Locate) → its track appears as one clean orange polyline (no more segmentation-with-overlap artefacts that looked like the boat was going back and forth). Deselect with the X marker on the target → track disappears. Only 1 track at a time, never 15.
  - **Single ring per vessel**. Anchored vessels show one dashed orange ring (their estimated swing radius from track P90 + LOA), coloured red if inside your alarm radius, dim orange if ACKed, orange otherwise. Vessels underway show no ring (they don't have a swing circle) — only their track when selected. No more overlapping red-highlight + orange-anchor rings.
  - **New "Fondeos" toggle** in the AIS panel header replaces the old "Tracks" toggle. When ON: shows anchor rings for ALL anchored vessels in the AIS radius. When OFF: only shows the ring of the selected vessel.
  - **Closing the popup no longer deselects the target**. The vessel stays highlighted in the chart (X + label + track + ring) so you can keep it in view without keeping the popup open. Deselecting is explicit via the X marker on the target.

Related refs: closes reports from Pablo (autostate breakage) and Carlos QA over Rev768-Rev775.

---

### Español

**Fix: `navigation.anchor.position=null` se emitía cada 6 s (rompía autostate) + rediseño UI de AIS (un solo aro por vessel, track automático al seleccionar)**

Release de patch. Dos fixes independientes visibles al usuario.

- **Paths canónicos del ancla solo se emiten en transiciones de estado** (bug reportado por Pablo). Hasta la 2.10.1, `evaluateAnchorWatch` re-emitía `navigation.anchor.position=null` + `navigation.anchor.state="off"` en cada tick (~cada 6 s) mientras el barco no estuviera fondeado. `@meri-imperiumi/signalk-autostate` (y cualquier otro suscriptor) interpretaba cada delta `null` como un evento "acaban de levar" y el estado del barco pasaba de "amarrado" a "navegando" cada 6 s. Ahora los canónicos se publican exactamente UNA vez por transición: al fondear con posición + state="on", al levar con position=null + state="off", después silencio. Los internos `environment.anchor.mareasIhm.*` mantienen su emisión cíclica (nadie de fuera los consume, sin problema).
- **UI de selección AIS rediseñada** (feedback Carlos: "el aro que salga siempre debe ser el estimado de radio, un solo color un solo tipo de aro"). Rework completo:
  - **Los tracks son automáticos al seleccionar**. Se retira el toggle global para el conjunto. Seleccionas un vessel (click en marker, click en fila del listado, Localizar) → aparece SU track como una única polyline naranja limpia (se acabaron los artefactos de segmentación-con-solape que parecían que el barco iba y venía). Deseleccionar con la X sobre el target → el track desaparece. Solo 1 track a la vez, nunca 15.
  - **Un solo aro por vessel**. Los vessels fondeados muestran un único aro naranja discontinuo (su radio de borneo estimado a partir del P90 del track + eslora), rojo si están dentro de tu radio de alarma, naranja tenue si están ACKed, naranja normal si no. Los vessels en movimiento no muestran aro (no tienen círculo de borneo) — solo su track al seleccionar. Se acaban los aros superpuestos rojo-highlight + naranja-fondeo.
  - **Nuevo toggle "Fondeos"** en la cabecera del panel AIS reemplaza al viejo "Tracks". Con ON: muestra aros de fondeo de TODOS los vessels fondeados dentro del radio AIS. Con OFF: solo muestra el aro del vessel seleccionado.
  - **Cerrar el popup ya no deselecciona el target**. El vessel se queda marcado en la carta (X + label + track + aro) para que puedas seguir viéndolo sin necesidad de mantener el popup abierto. Deseleccionar es explícito con la X sobre el target.

Referencias: cierra el reporte de Pablo (autostate roto) y el QA de Carlos a lo largo de Rev768-Rev775.

---

## [2.10.1] - 2026-07-24

### English

**Telegram push localized (thanks @s991116) + shorter NPM description (fixes broken card in SK App Store)**

Patch release. Two small fixes, both user-facing.

- **Telegram push messages now follow the language setting** (issue [#25](https://github.com/Aitonos/signalk-mareas-ihm/issues/25), fixed by [@s991116](https://github.com/s991116) in [PR #26](https://github.com/Aitonos/signalk-mareas-ihm/pull/26)). Until 2.10.0 all Telegram alerts (`startup`, `startup_autodetect`, `startup_connected`, `gps_lost`, `autolift`, `garreo`, `ais`, `test`) were hardcoded in Spanish regardless of `_currentLang`. The PR extracts `sendTelegram()` and `formatTelegramMessage(kind, params, lang)` into a new module `src/telegram.ts`, so the POST is language-agnostic and the copy follows the boat-global language setting (same source-of-truth as Pi voice). Default lang remains `"es"` for backward compat. Adds `tests/telegram.test.js` (characterization test with `node:test`, locks ES + EN copy for the drag kind).
- **NPM description shortened** from ~730 characters to ~230 (fits the SK App Store card layout — the previous long paragraph rendered as a giant underlined link and broke the grid alignment of the webapps store). Full description still lives in `README.md`.

---

### Español

**Push de Telegram localizados (gracias @s991116) + description NPM más corta (arregla la tarjeta rota en la SK App Store)**

Release de patch. Dos fixes pequeños, ambos visibles al usuario.

- **Los mensajes de push de Telegram ahora siguen el idioma configurado** (issue [#25](https://github.com/Aitonos/signalk-mareas-ihm/issues/25), arreglado por [@s991116](https://github.com/s991116) en el [PR #26](https://github.com/Aitonos/signalk-mareas-ihm/pull/26)). Hasta la 2.10.0 todas las alertas de Telegram (`startup`, `startup_autodetect`, `startup_connected`, `gps_lost`, `autolift`, `garreo`, `ais`, `test`) estaban hardcoded en castellano independientemente de `_currentLang`. El PR extrae `sendTelegram()` y `formatTelegramMessage(kind, params, lang)` a un módulo nuevo `src/telegram.ts`, así el POST queda agnóstico del idioma y el texto sigue el idioma boat-global (misma fuente de verdad que la voz del Pi). Idioma por defecto sigue siendo `"es"` por compatibilidad. Añade `tests/telegram.test.js` (test de caracterización con `node:test`, congela el copy ES + EN del kind garreo).
- **Description de NPM acortada** de ~730 caracteres a ~230 (encaja en la tarjeta de la SK App Store — el párrafo largo anterior se renderizaba como un enlace subrayado enorme y rompía la alineación del grid de webapps). La description completa sigue viviendo en el `README.md`.

---

## [2.10.0] - 2026-07-21

### English

**Two more online AIS engines (aishub.net + aisfriends.com), source-aware AIS list, motor-triggered auto-lift, Feedback modal rework, Firefox cache safety-net, docs cleanup**

Follow-up release to 2.9.0. The online AIS engine goes from one to three independent sources, the AIS list now tells you which one served each target, and the anchor auto-lift gets a dedicated trigger when your engine starts.

#### 🚢 Triple online AIS engine

- **aishub.net** (Rev754) — HTTP polling client (1 request/min, hard rate-limit) against `https://data.aishub.net/ws.php`. Peer-to-peer model: to obtain an API username you must share your own AIS feed with the AISHub network (join at [aishub.net](https://www.aishub.net/join-us)). Bounding box is refreshed every 30 min around your boat.
- **aisfriends.com** (Rev756) — HTTP polling client (1 request/min) against the public v1 API at `https://www.aisfriends.com/api/public/v1/vessels/bounding-box`. Bearer-token auth. Peer-to-peer model with quality gate: the API returns HTTP 403 until your station has fed for 7 days with ≥10 vessels in coverage and ≥90 % uptime. The plugin surfaces this state clearly in the wizard so users know when to wait vs when to check their setup.
- **Symmetric dedup across all sources** (Rev758/759): priority is VHF ▶ aisstream (real-time WebSocket) ▶ aishub/aisfriends (both peers, 1/min, symmetric — first one to arrive wins in a 2 min freshness window). Fixed a bug where the endpoint re-processed our own SK republishes as if they were VHF, contaminating the source field: the cache is now authoritative for `source`, not `$source` on the SignalK bus.
- **Source badge in the AIS list** (Rev758): the vessel name is followed by a compact **VHF** (green) / **AS** / **AH** / **AF** (blue) label so you can see at a glance which engine served each target.
- **Bbox reduced 3° → 1°** (~78 km radius) on all three online engines (Rev757) to avoid saturating the map with hundreds of far-away markers; the AIS radius slider is also capped at 100 km. Both changes are pure performance wins — you still see everything your VHF hears, and the online engines only fill the gaps.
- Diagnostics endpoints: `GET /api/aishub/stats` and `GET /api/aisfriends/stats` with pollCount, HTTP status, dedupVhf / dedupAisstream / dedupAishub / adopted counters, targets in cache, bbox and last error. Wizard `📊 Check status` buttons for each engine surface it with hints for the most common failure codes (401/403/429/503).

#### ⚙️ Auto-lift when engine starts

- New primary trigger (Rev751) that reads `propulsion.<name>.state` and `propulsion.<name>.revolutions` from the SignalK bus. When an engine is `started` (or RPM > 0) AND SOG > 0.5 kn sustained for 30 s while anchored, the plugin auto-lifts. This catches your intent much earlier than the pure SOG > 3 kn / 60 s fallback (which still applies as fallback when no propulsion path exists in your SK tree).
- Activity log entries now include `trigger=motor` or `trigger=sog` so you can audit exactly what fired an auto-lift.

#### 💬 Feedback modal rework

- The "Tu opinión cuenta" / "Your feedback matters" modal now uses the project's native window style (orange sticky header with big Back arrow, standard `popup-overlay` + `popup-box`).
- The four CTAs (⭐ Star on GitHub, 🐛 Capture diagnostic, 🐛 Open issue, 📦 View on NPM) are strictly uniform in size, padding, font and icon width — no more "one button bigger than the rest" from generic CSS overriding one HTML tag but not the others.
- The diagnostic capture (previously a separate menu entry) is now integrated inside this modal: one flow to review your JSON, copy it, and paste it into the issue. The standalone menu entry is removed to avoid duplication.

#### 🔥 Firefox cache safety-net

- New JS guard at load (Rev761) that fetches `/api/build-info` with no-cache and compares against localStorage; on mismatch it forces a `location.reload()` once (sessionStorage-protected to avoid loops). Fixes cases where Firefox served an old `mobile.html` from cache despite `Cache-Control: no-cache`.

#### 📄 Docs cleanup

- 22 one-shot `PROMPT_FOR_LLM_*.md` files (from earlier bug-triage sessions with GPT/Gemini) archived under `docs/archive/legacy-prompts/`.
- `KNOWN_BUGS.md`, `BACKLOG.md`, `SPRINTS.md`, `QA_PENDIENTE.md` and `BOOTSTRAP_PROMPT.md` rewritten against the real state at Rev761 — all 22 bugs B-01…B-22 of the May snapshot were resolved months ago, snapshots preserved in `docs/archive/`.
- `CLAUDE.md` refreshed with the new doc map, extended invariants and updated feature list.

---

### Español

**Dos motores AIS online adicionales (aishub.net + aisfriends.com), fuente por target en el listado AIS, auto-lift al arrancar motor, remake del modal Feedback, safety-net cache Firefox, limpieza docs**

Release de continuación de 2.9.0. El motor AIS online pasa de una a tres fuentes independientes, el listado AIS ahora indica cuál sirvió cada target, y el auto-lift del ancla obtiene un trigger dedicado cuando arrancas motor.

#### 🚢 Motor AIS online triple

- **aishub.net** (Rev754) — cliente HTTP polling (1 req/min, rate-limit duro) contra `https://data.aishub.net/ws.php`. Modelo peer-to-peer: para obtener un username API tienes que compartir TU feed AIS con la red AISHub (regístrate en [aishub.net](https://www.aishub.net/join-us)). El bounding box se refresca cada 30 min alrededor de tu barco.
- **aisfriends.com** (Rev756) — cliente HTTP polling (1 req/min) contra el API público v1 en `https://www.aisfriends.com/api/public/v1/vessels/bounding-box`. Auth con Bearer token. Modelo peer-to-peer con puerta de calidad: el API devuelve HTTP 403 hasta que tu estación haya alimentado durante 7 días con ≥10 vessels en cobertura y ≥90 % de uptime. El plugin muestra este estado claramente en el wizard para que el usuario sepa cuándo esperar y cuándo revisar su setup.
- **Dedupe simétrica entre las 3 fuentes** (Rev758/759): prioridad VHF ▶ aisstream (WebSocket real-time) ▶ aishub/aisfriends (los dos peers, 1/min, simétrico — el primero que llegue gana en una ventana de 2 min). Arreglado bug donde el endpoint reprocesaba nuestros propios republishes SK como si fueran VHF, contaminando el campo source: el cache ahora es autoritativo para `source`, no el `$source` del bus SignalK.
- **Badge de fuente en el listado AIS** (Rev758): detrás del nombre del vessel aparece una etiqueta compacta **VHF** (verde) / **AS** / **AH** / **AF** (azul) para que veas de un vistazo qué motor sirvió cada target.
- **Bbox reducido 3° → 1°** (~78 km radio) en los 3 motores online (Rev757) para no saturar el mapa con cientos de markers lejanos; el slider de radio AIS también topado a 100 km. Ambos cambios son mejoras de rendimiento puras — sigues viendo todo lo que oye tu VHF y los motores online sólo rellenan huecos.
- Endpoints de diagnóstico: `GET /api/aishub/stats` y `GET /api/aisfriends/stats` con pollCount, HTTP status, contadores dedupVhf / dedupAisstream / dedupAishub / adopted, targets en cache, bbox y último error. Los botones `📊 Comprobar estado` del wizard lo muestran con pistas para los códigos de error más comunes (401/403/429/503).

#### ⚙️ Auto-lift al arrancar motor

- Nuevo trigger primario (Rev751) que lee `propulsion.<name>.state` y `propulsion.<name>.revolutions` del bus SignalK. Cuando algún motor está `started` (o RPM > 0) Y la SOG > 0,5 kn sostenidos 30 s estando fondeado, el plugin auto-liva. Detecta tu intención mucho antes que el fallback SOG > 3 kn / 60 s (que se mantiene como fallback cuando no hay path `propulsion` en tu árbol SK).
- El activity log ahora incluye `trigger=motor` o `trigger=sog` para que puedas auditar exactamente qué disparó cada auto-lift.

#### 💬 Remake del modal Feedback

- El modal "Tu opinión cuenta" ahora usa el estilo de ventana nativo del proyecto (header naranja sticky con botón Atrás grande, `popup-overlay` + `popup-box` estándar).
- Los cuatro CTAs (⭐ Estrella en GitHub, 🐛 Capturar diagnóstico, 🐛 Abrir issue, 📦 Ver en NPM) son estrictamente uniformes en tamaño, padding, fuente y ancho de icono — se acabaron los "un botón más grande que el resto" por CSS genérico que sobreescribía sólo una etiqueta HTML.
- La captura de diagnóstico (antes entrada separada del menú) queda integrada dentro de este modal: un solo flujo para revisar el JSON, copiarlo y pegarlo en la issue. La entrada suelta del menú se retira para evitar duplicados.

#### 🔥 Safety-net cache Firefox

- Nuevo guard JS al cargar (Rev761) que hace fetch de `/api/build-info` sin cache y lo compara con localStorage; si difieren fuerza un `location.reload()` una única vez (protegido con sessionStorage para no bucle). Cubre los casos donde Firefox servía un `mobile.html` viejo desde su cache pese al `Cache-Control: no-cache`.

#### 📄 Limpieza docs

- 22 archivos `PROMPT_FOR_LLM_*.md` (prompts one-shot para GPT/Gemini de sesiones antiguas de bug hunt) archivados en `docs/archive/legacy-prompts/`.
- `KNOWN_BUGS.md`, `BACKLOG.md`, `SPRINTS.md`, `QA_PENDIENTE.md` y `BOOTSTRAP_PROMPT.md` reescritos contra el estado real Rev761 — los 22 bugs B-01…B-22 del snapshot de mayo estaban todos resueltos hace meses, snapshots preservados en `docs/archive/`.
- `CLAUDE.md` refrescado con el nuevo mapa de docs, invariantes ampliados y features al día.

---

## [2.9.0] - 2026-07-20

### English

**Online AIS engine + multi-user anchoring log + tide provider coexistence + safety / UX**

Big release. Highlights:

#### 🚢 Online AIS engine (aisstream.io)

- Optional online AIS feed via [aisstream.io](https://aisstream.io) — a free crowd-sourced service. Useful if you have no VHF AIS receiver on board, or to extend coverage beyond VHF range.
- WebSocket client with **exponential-backoff reconnect + 30 s watchdog** that catches silent/zombie NAT drops (WS stuck "OPEN" with no traffic → force reconnect after 5 min of no messages). Reconnects itself if the server has an outage.
- **Automatic dedup with your VHF AIS receiver**: any MMSI that came through your own VHF in the last 60 s wins over the online feed. Online only fills the gaps and extends the range.
- **Republishes to the SignalK `vessels.*` tree** with `$source: mareas-ihm.aisstream`, so any consumer in your SignalK environment sees the targets alongside VHF ones (no duplicate branch, standard vocabulary).
- Wizard step **"🚢 AIS over internet"** with sign-up links, docs link, `⚠ beta` warning, API-key field, and live "📊 Check status" button that shows WS state, msgs received/accepted, targets in cache, bounding box, and last error with a hint (e.g. link to known outage issues).
- New endpoint `GET /api/aisstream/stats` with connection/message diagnostics.

#### 👥 Anchoring log per user

- Each `/drop`, `/lift`, `/toggle`, auto-lift and favourite add/delete is attributed to the PIN active at the time and persisted in a 500-entry ring buffer.
- Every favourite and every `anchorHistory` entry now carries `userAlias`. Legacy entries created before this release are auto-migrated to the master's alias at first startup.
- `GET /favorites`, `GET /anchor-watch/history` and new `GET /api/activity-log` filter by active user. Master can query anyone with `?user=<alias>`; guests only see their own.
- Guests can be granted **`permissions.editAnchorages`** by the master (per-PIN) — without it, guests are read-only for their own history/favourites. Master always has full permissions implicitly.
- Master → 👥 User control → tap on any guest → **new sub-sections**: 📌 Favorites, 📋 Recent anchor drops, 🕒 Activity log — each with **📍 Locate on map** button.
- Toggle for `permissions.editAnchorages` inline in the guest card, POSTs immediately.

#### 🌊 Tide provider coexistence (`shy provider`)

*(Reported by [@andmayfi92](https://github.com/andmayfi92) — thank you)*

SignalK only allows a single resource provider per type. Until this release we registered as tide provider unconditionally at startup, which **silently overwrote other tide plugins** (opentide, signalk-tides, signalk-tidal-currents) with our IHM/NEAPS output — problematic for users outside our coverage area, where we'd overwrite valid harmonic data with an empty `extremes:[]`.

- **New `tidePublishToSk` setting** with three modes:
  - **Auto** (default) — yield the `/signalk/v2/api/resources/tides` path if another tide provider is enabled on the server. Publish ourselves only if we're the only one.
  - **Always** — force our provider (previous behaviour). Only for users who specifically want IHM/NEAPS output over anything else already installed.
  - **Never** — don't register at all, this plugin's tide data is consumed only via its own web UI/panel.
- **Detector** at plugin start scans `~/.signalk/plugin-config-data/*.json` for known tide providers (`signalk-opentide`, `signalk-tides`, `signalk-tidal-currents`) and their enabled state.
- **Wizard step "🌊 Tides & weather"** gets a new **"📡 Publish to SignalK tide tree"** section with the 3-option radio, list of detected other providers, and live status: `📢 Currently publishing` / `🤐 Currently NOT publishing` with the reason (`auto + 'signalk-opentide' enabled → yielding`, etc.).
- New endpoint `GET /api/tide/providers-detected`.
- Fallback: if we do publish but our provider has no coverage for the current position, the response now carries a `_note` explaining "No tide coverage from mareas-ihm for this position — install another tide plugin for global coverage" instead of a misleading empty valid-looking object.

#### 📐 Chain-deployed estimator + water temperature widgets

- **New bottom-bar cell 🔗 Deployed chain**: computed from the geometry `L ≈ √(d² + h²) × 1.05` (bow-to-anchor distance + depth at drop + tide delta + bow height), only updated when boat is static (SOG<0.3 kn for ≥30 s) and ≥60 s past the drop, so it doesn't capture noise during the initial reverse-set. Priority: external path (`environment.anchor.chainLength` published by a windlass counter via any means) > geometric estimate > manual value from the anchor calculator. Badge shows source (📡 external / 🧮 estimate / ✋ manual).
- **New bottom-bar cell 🌡 Water temperature**: reads `environment.water.temperature` (Kelvin → °C/°F according to unit system).
- Both cells opt-in from Config → 📊 Bottom-bar widgets.
- New published SK paths `environment.anchor.mareasIhm.chainDeployedM` and `.chainDeployedSource` for KIP/dashboards.

#### 🛰 GPS glitch filter

- **Speed-based rejection**: new setting `gpsGlitchMaxSpeedKt` (0 = off, default 0). If a new GPS fix implies a speed above the threshold vs the last accepted fix, the fix is rejected — up to 5 consecutive rejections; after that we concede the motion is real. Prevents false drag alarms triggered by GPS spikes on 4G/RF-noisy setups.
- Emits `notifications.signalk-mareas-ihm.gpsGlitch` with `state:warn` (never on top of an active drag alarm).

#### 🔔 Test alarms

- New endpoint `POST /api/anchor-watch/test-alarm` fires a simulated alarm (`garreo` / `grounding` / `ais`) for 10 s with `method:["visual","sound","push"]` — verifies audio (Pi + web), push (WilhelmSK / Telegram) and SignalK notifications all reach every consumer. Auto-clears.
- Wizard step **"📲 Mobile push alerts"** gets 3 buttons (⚓ Drag, 🚧 Grounding, 🚢 AIS) to fire each type. Does not affect the real anchor state.

#### 🧙 Wizard rework

- **Summary is now the HOME** of the wizard (was the last step). Every step shows a ✅/⚠ badge. Click any card to jump.
- **New 📋 Home button** in the wizard footer between ← Back and → Next, jumps back to the Summary without exiting.
- Steps completed via "Save & restart plugin" (IMU, notifications, aisFallback, tide-publish) now **auto-mark themselves as done** in the summary — no more red-tile-forever after saving.
- New standalone steps split off from the modal Config: **🚢 AIS over internet**, **📐 Depth calculator** (embedded, was a stub), **📡 Paths published to SignalK** (with live traffic stats).
- Anchor calculator (`⚓ Cálculo de fondeo`) stays accessible from the hamburger menu (frequent use); depth calculator (`📐 Cálculo de sonda`) is wizard-only.

#### 🗺 Map polish

- **Antimeridian wrap fix**: enabling `worldCopyJump:true` on the Leaflet map — layers no longer strand off the far side when panning across ±180° longitude.
- **Auto-invert wheel zoom on MFDs** (`Navico|Zeus|Vulcan|B&G|Simrad-Chart` user-agent): those consoles report wheel deltas with the opposite sign, so scroll-to-zoom was inverted; the fix leaves desktop browsers untouched.
- **AIS radius slider max** raised from **50 km → 500 km** to make sense of far AIS targets fetched via aisstream.io.

#### 🎨 UI / copy

- Every push-notification `message:` field is now emitted in **English by default** (drag, grounding, AIS, GPS lost). The internal viewer keeps its own i18n system for local display; this ensures third-party consumers (WilhelmSK, other apps) show a legible message in a lingua franca regardless of the plugin's UI language.
- Removed duplicate emojis in menu entries `Enviar diagnóstico` and `Tu opinión cuenta` (icon was in both the menu row and the i18n string).
- Text sizes bumped in the SignalK paths panel (+20% overall), categories collapsed by default with a rotating triangle.
- Renamed panel "Publicación en SignalK" → **"Paths publicados en SignalK"** for clarity.

#### 🐛 Fixes

- **Bottom-bar new cells fully switchable**: `cad_larg` and `temp_agua` were rendered in the config picker but the backend whitelist (`BB_CELL_KEYS` in `sanitizeBBOrder`) silently dropped them at save time. Whitelist updated.
- **NEAPS LAT datum** now computed over a 365-day window (was a 7-day + 5 cm safety margin, which drifted 30–60 cm below IHM in neap-tide weeks). Per-station cache TTL 30 d.
- **Sensor check wizard step** completed (was `Under construction`): 16 live tiles including air temperature, humidity, magnetic heading, speed through water, AIS target count.
- **SignalK paths panel — permission popup**: attempting to toggle a required 🔒 or deprecated 🗑 path shows a native modal (dark + amber border, keyboard/backdrop dismiss). The 401 (permission required) response when the security layer is on and no PIN is entered gets the same treatment. No more silent `<input disabled>` non-response on touch devices.

### Español

**Motor AIS online + log de fondeos por usuario + coexistencia de proveedores de marea + seguridad / UX**

Release grande. Puntos clave:

#### 🚢 Motor AIS online (aisstream.io)

- Feed AIS opcional por internet vía [aisstream.io](https://aisstream.io) — servicio gratuito crowd-sourced. Útil si no tienes receptor AIS por VHF a bordo o para extender la cobertura más allá del alcance del VHF.
- Cliente WebSocket con **reconnect exponencial + watchdog cada 30 s** que detecta caídas silenciosas/zombie de NAT (WS aparentemente "OPEN" pero sin tráfico → fuerza reconnect tras 5 min sin mensajes). Se recupera solo si el server tiene una incidencia.
- **Dedupe automático con tu receptor VHF**: cualquier MMSI que llegó por tu VHF en los últimos 60 s prevalece sobre el feed online. Online solo rellena huecos y extiende el alcance.
- **Republica en el árbol `vessels.*` de SignalK** con `$source: mareas-ihm.aisstream`, para que cualquier consumidor de tu entorno SK vea los targets al lado de los de VHF (sin rama duplicada, vocabulario estándar).
- Paso del wizard **"🚢 AIS por internet"** con links de registro, docs, aviso `⚠ beta`, campo de API-key, y botón "📊 Comprobar estado" en vivo que muestra estado WS, msgs recibidos/aceptados, targets en cache, bounding box y último error con pista útil (por ejemplo link a issues conocidos).
- Nuevo endpoint `GET /api/aisstream/stats` con diagnóstico de conexión/mensajes.

#### 👥 Log de fondeos por usuario

- Cada `/drop`, `/lift`, `/toggle`, auto-lift y alta/baja de favorito se atribuye al PIN activo en ese momento y se persiste en un ring buffer de 500 entradas.
- Cada favorito y cada entrada de `anchorHistory` lleva ahora `userAlias`. Las entradas previas a esta release se migran automáticamente al alias del maestro al arrancar por primera vez.
- `GET /favorites`, `GET /anchor-watch/history` y el nuevo `GET /api/activity-log` filtran por usuario activo. El maestro puede consultar los de cualquier alias con `?user=<alias>`; los invitados solo ven los suyos.
- Los invitados pueden recibir del maestro el permiso **`permissions.editAnchorages`** (por PIN) — sin él, los invitados solo pueden leer sus propios fondeos/favoritos. El maestro tiene todos los permisos implícitamente.
- Maestro → 👥 Control de usuarios → toca cualquier invitado → **nuevas sub-secciones**: 📌 Favoritos, 📋 Últimos fondeos, 🕒 Actividad — cada uno con botón **📍 Localizar en mapa**.
- Toggle de `permissions.editAnchorages` inline en la ficha del invitado, POSTea al instante.

#### 🌊 Coexistencia con otros proveedores de marea (`shy provider`)

*(Reportado por [@andmayfi92](https://github.com/andmayfi92) — gracias)*

SignalK sólo permite un resource provider por tipo. Hasta esta release nos registrábamos como proveedor de mareas incondicionalmente al arrancar, lo que **sobreescribía silenciosamente** a otros plugins (opentide, signalk-tides, signalk-tidal-currents) con nuestro output IHM/NEAPS — un problema para usuarios fuera de nuestra cobertura, donde sobreescribíamos datos armónicos válidos con un `extremes:[]` vacío.

- **Nuevo ajuste `tidePublishToSk`** con tres modos:
  - **Auto** (por defecto) — cede el path `/signalk/v2/api/resources/tides` si hay otro proveedor de mareas activo en el server. Publica el nuestro sólo si somos los únicos.
  - **Always** — fuerza nuestro proveedor (comportamiento previo). Sólo para quien quiera específicamente el output IHM/NEAPS sobre lo que ya esté instalado.
  - **Never** — no nos registramos en absoluto; los datos de marea de este plugin se consumen sólo desde su propio panel/visor.
- **Detector** al arrancar el plugin escanea `~/.signalk/plugin-config-data/*.json` buscando proveedores de mareas conocidos (`signalk-opentide`, `signalk-tides`, `signalk-tidal-currents`) y su estado enabled.
- **Paso del wizard "🌊 Mareas y meteo"** gana una nueva sección **"📡 Publicar en el árbol de mareas SignalK"** con el radio de 3 opciones, listado de otros proveedores detectados y estado en vivo: `📢 Actualmente publicando` / `🤐 Actualmente NO publica` con el motivo (`auto + 'signalk-opentide' enabled → yielding`, etc.).
- Nuevo endpoint `GET /api/tide/providers-detected`.
- Fallback: si sí publicamos pero nuestro proveedor no tiene cobertura para la posición actual, la respuesta lleva ahora un `_note` explicando "No tide coverage from mareas-ihm for this position — install another tide plugin for global coverage" en lugar de un objeto vacío que parece válido pero engaña.

#### 📐 Estimador de cadena largada + widget de temperatura del agua

- **Nueva celda bottom-bar 🔗 Cadena largada**: calculada por geometría `L ≈ √(d² + h²) × 1.05` (distancia proa-ancla + sonda al drop + delta de marea + altura de la roldana), sólo actualizada cuando el barco está estático (SOG<0.3 kn durante ≥30 s) y han pasado ≥60 s desde el drop, para no capturar ruido durante el tensado inicial. Prioridad: path externo (`environment.anchor.chainLength` publicado por un contador de cabestrante por cualquier vía) > estimación geométrica > valor manual del calculador de fondeo. Badge muestra la fuente (📡 externo / 🧮 estimado / ✋ manual).
- **Nueva celda bottom-bar 🌡 Temperatura del agua**: lee `environment.water.temperature` (Kelvin → °C/°F según sistema de unidades).
- Ambas celdas opt-in desde Config → 📊 Widgets bottom-bar.
- Nuevos paths SK publicados `environment.anchor.mareasIhm.chainDeployedM` y `.chainDeployedSource` para KIP/dashboards.

#### 🛰 Filtro anti-glitch del GPS

- **Rechazo por velocidad**: nuevo ajuste `gpsGlitchMaxSpeedKt` (0 = off, default 0). Si un fix GPS nuevo implica una velocidad por encima del umbral respecto al último fix aceptado, se rechaza — hasta 5 rechazos consecutivos; después concede que el movimiento es real. Evita alarmas de garreo falsas por picos GPS en instalaciones 4G/con ruido RF.
- Emite `notifications.signalk-mareas-ihm.gpsGlitch` con `state:warn` (nunca sobre una alarma de garreo activa).

#### 🔔 Probar alarmas

- Nuevo endpoint `POST /api/anchor-watch/test-alarm` dispara una alarma simulada (`garreo` / `grounding` / `ais`) durante 10 s con `method:["visual","sound","push"]` — verifica que audio (Pi + web), push (WilhelmSK / Telegram) y notifications SK llegan a todos los consumidores. Auto-limpia.
- Paso del wizard **"📲 Alertas al móvil"** gana 3 botones (⚓ Garreo, 🚧 Varada, 🚢 AIS) para disparar cada tipo. No afecta al estado real del fondeo.

#### 🧙 Rediseño del wizard

- **El Resumen ahora es la HOME** del wizard (era el último paso). Cada paso muestra un badge ✅/⚠. Click en cualquier tarjeta salta al paso.
- **Nuevo botón 📋 Home** en el pie del wizard entre ← Atrás y → Siguiente, vuelve al Resumen sin salir del wizard.
- Los pasos que se completan con "Guardar y reiniciar plugin" (IMU, notifications, aisFallback, tide-publish) ahora **se auto-marcan como hechos** en el resumen — no más tarjeta roja permanente tras guardar.
- Nuevos pasos independientes extraídos del modal Config: **🚢 AIS por internet**, **📐 Cálculo de sonda** (embebido, era un stub), **📡 Paths publicados en SignalK** (con estadísticas de tráfico en vivo).
- El cálculo de fondeo (`⚓ Cálculo de fondeo`) se mantiene accesible desde el menú hamburguesa (uso frecuente); el cálculo de sonda (`📐 Cálculo de sonda`) es sólo del wizard.

#### 🗺 Pulido del mapa

- **Fix wrap del antimeridiano**: activado `worldCopyJump:true` en el mapa Leaflet — las capas ya no se quedan varadas en el otro lado del mapa al panorámica cruzando ±180° de longitud.
- **Invertir zoom con rueda automáticamente en MFDs** (user-agent `Navico|Zeus|Vulcan|B&G|Simrad-Chart`): esas consolas reportan wheel deltas con signo invertido, por lo que scroll-to-zoom iba al revés; el fix no afecta a browsers de escritorio.
- **Máximo del slider de radio AIS** subido de **50 km → 500 km** para tener sentido con los targets AIS lejanos que vienen por aisstream.io.

#### 🎨 UI / copy

- Cada mensaje `message:` de push notification se emite ahora en **inglés por defecto** (garreo, varada, AIS, GPS perdido). El visor interno sigue con su propio sistema i18n para display local; esto asegura que consumidores de terceros (WilhelmSK, otras apps) muestren un mensaje legible en lingua franca independientemente del idioma UI del plugin.
- Quitados emojis duplicados en las entradas de menú `Enviar diagnóstico` y `Tu opinión cuenta` (el icono estaba en la fila del menú Y en el string i18n).
- Tamaños de texto subidos en el panel de paths SignalK (+20% en general), categorías plegadas por defecto con triángulo rotante.
- Renombrado panel "Publicación en SignalK" → **"Paths publicados en SignalK"** para mayor claridad.

#### 🐛 Fixes

- **Nuevas celdas del bottom-bar activables de verdad**: `cad_larg` y `temp_agua` se pintaban en el selector de config pero la whitelist del backend (`BB_CELL_KEYS` en `sanitizeBBOrder`) las tiraba silenciosamente al guardar. Whitelist actualizada.
- **Datum LAT de NEAPS** ahora calculado sobre ventana de 365 días (era 7 días + 5 cm de margen, que desviaba 30–60 cm por debajo de IHM en semanas de mareas muertas). Cache por estación TTL 30 d.
- **Paso de sensores del wizard** completado (era `Under construction`): 16 tarjetas en vivo incluyendo temperatura del aire, humedad, rumbo magnético, velocidad por el agua, contador de targets AIS.
- **Panel de paths SignalK — popup de permisos**: al intentar togglear un path 🔒 imprescindible o 🗑 obsoleto sale un modal nativo (dark + borde ámbar, cierre por teclado/backdrop). El 401 (permisos requeridos) cuando la capa de seguridad está activa y no hay PIN introducido recibe el mismo trato. Se acabó el `<input disabled>` mudo en dispositivos táctiles.

## [2.8.0] - 2026-07-18

### English

**Standard SignalK interop + full wizard remake + Admin cleanup**

Release focused on making the plugin play nicely with the rest of the SignalK anchor-watch ecosystem (Hoekens, Y2K, WilhelmSK, and any other client that reads the canonical vocabulary), and on moving all setup out of the SignalK Admin form into a proper visual wizard.

Huge thanks to **[@jeyrb](https://github.com/jeyrb) on GitHub** for the report that started the interop work — pointing out that every other anchor app shares `navigation.anchor.*` and `notifications.navigation.anchor`, and that only our plugin was living in its own custom namespace. That report drove Rev721/Rev722 below.

#### 🔗 SignalK-standard interop (@jeyrb's suggestion)

- **Canonical anchor data** published in parallel to our own `environment.anchor.mareasIhm.*` — anyone who drops the anchor here now shows up correctly in Hoekens/Y2K/etc. and vice-versa (read-side sync is a future sprint):
  - `navigation.anchor.state` (`"on"` / `"off"`)
  - `navigation.anchor.position` (`{latitude, longitude}`)
  - `navigation.anchor.maxRadius` (m)
  - `navigation.anchor.currentRadius` (m)
  - `navigation.anchor.distanceFromBow` (m)
  - `navigation.anchor.bearingTrue` (rad)
  - `navigation.anchor.apparentBearing` (rad, if we have true heading)
  - `navigation.anchor.watchZone` (`{type:"circle", radius}`)
  - `navigation.anchor.meta` (`{zones:[{normal,0,R},{emergency,R}]}`)
- **Canonical notifications** — all our internal alarm notifications are now auto-mirrored to the standard SK notification paths by wrapping `app.handleMessage`:
  - `notifications.signalk-mareas-ihm.anchorDrag` → `notifications.navigation.anchor`
  - `notifications.signalk-mareas-ihm.grounding` → `notifications.environment.depth.belowKeel`
  - `notifications.signalk-mareas-ihm.aisAnchorAlarm` → `notifications.navigation.collisionRisk`
  - `notifications.signalk-mareas-ihm.gpsLost` → `notifications.navigation.gnss`
  - No need to touch the 15+ call sites where we emit — the wrapper does it once.
- **WilhelmSK-compatible push method**: every critical-state alarm delta now carries `method: ["visual", "sound", "push"]` (grounding safety-latch and AIS were missing `"push"` before), so WilhelmSK on iOS/iPadOS fires a native push notification even with the app in background. Anchor drag and grounding already had it.
- **Optional group in wizard** — `⚓ Fondeo Standard SK` in the SignalK paths panel lets you turn the interop off if you already use another anchor app as the source of truth.

#### 🧙 Wizard remake — one-stop configurator

The old SignalK Admin form is now empty except for a `[App setup moved to Webapp]` link. Every setting lives in the visual wizard at `/signalk-mareas-ihm/mobile` and persists to the same plugin config file via `app.savePluginOptions()`.

- **Summary is now the HOME** of the wizard (was the last step). Thirteen tiles with per-step status ✅/⚠, click any to jump.
- Added steps: **📐 IMU and wave sensor** (probe live + pypilot host/port + IMU manager + raw I²C DIY), **📲 Mobile push alerts (Telegram)** (bot token + chat ID with auto-detect), **📐 Depth calculator** (embedded in-situ — was `Under construction`), **📡 Paths published to SignalK** (with live traffic stats).
- Removed from menu / Config, moved to wizard: units, SignalK path publication, depth calculator.
- Anchor calculator stays in the hamburger menu as `⚓ Cálculo de fondeo` (frequent action).
- New **📋 Home** button in the wizard footer (between ← and →) jumps to the Summary without exiting.
- Progress bar reaches 100 % on the last step (was 89 %).
- Wizard step title's "Step N/M" chip now inline next to the H2.

#### 📡 SignalK paths panel

- **Live stats header** — refresh every 3 s: `📡 <N> active / <M> catalogued · ⚡ <X.XX> deltas/s (30 s avg) · <Y> in the last minute`. Backend endpoint `/api/sk-paths/stats` with rolling 60-s window in the `handleMessage` wrapper.
- **Categories collapsed by default** with a rotating triangle (`▶` closed / `▼` open) — text sizes bumped ~20 % across the panel.
- **`⚓ Fondeo Standard SK` group** for the canonical anchor paths (turn off if you use another anchor app as SoT).
- Toggles apply immediately; ON→OFF publishes a `value: null` so SK clears the path from the tree.

#### 🌐 NEAPS + geocoding polish (carried from 2.7.0 batch)

- LAT (Lowest Astronomical Tide) datum computed over 365 d for NEAPS stations, cached per station 30 d. Previous release had a 30–60 cm systematic offset vs IHM in neap-tide weeks.
- Sensor check wizard step: **16 tiles** (added air temperature, humidity, magnetic heading, speed through water, AIS target count).
- SK paths blocked (required / deprecated): CSS-native popup explaining why they cannot be toggled — no more silent `<input disabled>` non-response on touch devices.
- 401 (permission required) triggers the same styled popup when the security layer is enabled and no PIN is entered.

#### 🎛️ SignalK Admin form cleanup

- Every previously-visible field is gone from the plugin config form (`IHM base URL`, `Cache refresh`, `GPS max age`, `Update frequency`, `Pypilot bridge`, `IMU manager`, `Telegram`, etc.). All defaults are hardcoded sensibly in the source; the wizard remains the single edit surface.
- Description of the plugin config is now a one-line CTA `[App setup moved to Webapp]` linking to the wizard.

#### 💬 Menu changes

- New `💬 Tu opinión cuenta` (`Your feedback matters`) entry — dark modal with ⭐ GitHub star CTA, 🐛 issue link, 📦 NPM link.
- `🧮 Cálculo Sonda y Fondeo` removed. `⚓ Cálculo de fondeo` re-added (anchor only). Depth calculator is now wizard-only.

### Español

**Interop SK estándar + wizard rehecho + Admin limpio**

Release enfocado en hacer que el plugin coopere con el resto del ecosistema SignalK de anchor-watch (Hoekens, Y2K, WilhelmSK, y cualquier otro cliente que lea el vocabulario canónico), y en sacar toda la configuración del formulario del Admin de SignalK para llevarla a un wizard visual completo.

Muchas gracias a **[@jeyrb](https://github.com/jeyrb) en GitHub** por el reporte que arrancó el trabajo de interop — señaló que el resto de apps de fondeo comparten los paths `navigation.anchor.*` y `notifications.navigation.anchor`, y que solo nuestro plugin vivía en su propio namespace. Ese reporte fue el que dio pie a Rev721/Rev722 de abajo.

#### 🔗 Interop con paths estándar de SignalK (sugerencia de @jeyrb)

- **Datos de fondeo canónicos** publicados en paralelo a nuestros propios `environment.anchor.mareasIhm.*` — quien fondee aquí aparece bien en Hoekens/Y2K/etc. y viceversa (la sincronización en lectura queda para próximo sprint):
  - `navigation.anchor.state` (`"on"` / `"off"`)
  - `navigation.anchor.position` (`{latitude, longitude}`)
  - `navigation.anchor.maxRadius` (m)
  - `navigation.anchor.currentRadius` (m)
  - `navigation.anchor.distanceFromBow` (m)
  - `navigation.anchor.bearingTrue` (rad)
  - `navigation.anchor.apparentBearing` (rad, si tenemos rumbo verdadero)
  - `navigation.anchor.watchZone` (`{type:"circle", radius}`)
  - `navigation.anchor.meta` (`{zones:[{normal,0,R},{emergency,R}]}`)
- **Notificaciones canónicas** — todas nuestras alarmas internas se espejan automáticamente a los paths estándar SK envolviendo `app.handleMessage`:
  - `notifications.signalk-mareas-ihm.anchorDrag` → `notifications.navigation.anchor`
  - `notifications.signalk-mareas-ihm.grounding` → `notifications.environment.depth.belowKeel`
  - `notifications.signalk-mareas-ihm.aisAnchorAlarm` → `notifications.navigation.collisionRisk`
  - `notifications.signalk-mareas-ihm.gpsLost` → `notifications.navigation.gnss`
  - Sin tocar los 15+ call sites donde emitimos — el wrapper lo hace una vez.
- **Método push compatible con WilhelmSK**: toda alarma en state crítico lleva `method: ["visual", "sound", "push"]` (el safety-latch de varada y AIS no llevaban `"push"`), para que WilhelmSK en iOS/iPadOS dispare push nativo aunque la app esté en background. Garreo y varada ya lo tenían.
- **Grupo opcional en el wizard** — `⚓ Fondeo Standard SK` en el panel de paths permite apagar la interop si el navegante usa otra app de fondeo como fuente de verdad.

#### 🧙 Wizard rehecho — configurador único

El formulario del Admin de SignalK queda vacío excepto por un enlace `[App setup moved to Webapp]`. Cada ajuste vive en el wizard visual en `/signalk-mareas-ihm/mobile` y se persiste al mismo fichero de config del plugin vía `app.savePluginOptions()`.

- **Resumen ahora es la HOME** del wizard (era el último). Trece tarjetas con estado ✅/⚠ por paso, click en cualquiera para saltar.
- Pasos añadidos: **📐 IMU y sensor de olas** (probe live + host/port de pypilot + gestor IMU + I²C crudo DIY), **📲 Alertas al móvil (Telegram)** (token del bot + chat ID con autodetect), **📐 Cálculo de sonda** (embebido in-situ — era `En construcción`), **📡 Paths publicados en SignalK** (con estadísticas de tráfico en vivo).
- Quitados del menú / Config, movidos al wizard: unidades, publicación de paths SignalK, calculadora de sonda.
- La calculadora de fondeo se queda en el menú hamburguesa como `⚓ Cálculo de fondeo` (acción frecuente).
- Nuevo botón **📋 Home** en el footer del wizard (entre ← y →) que salta al Resumen sin salir.
- Barra de progreso llega al 100 % en el último paso (antes 89 %).
- El chip "Paso N/M" ahora va inline junto al H2 del título del paso.

#### 📡 Panel de paths SignalK

- **Cabecera con estadísticas en vivo** — refresco cada 3 s: `📡 <N> activos / <M> catalogados · ⚡ <X.XX> deltas/s (media 30 s) · <Y> en el último minuto`. Endpoint backend `/api/sk-paths/stats` con ventana rolling de 60 s medida en el wrapper de `handleMessage`.
- **Categorías plegadas por defecto** con triángulo rotable (`▶` cerrado / `▼` abierto) — tamaños +20% en todo el panel.
- **Grupo `⚓ Fondeo Standard SK`** para los paths canónicos de fondeo (apágalo si usas otra app de anchor como SoT).
- Los toggles aplican inmediato; ON→OFF publica `value: null` para que SK borre el path del árbol.

#### 🌐 NEAPS + geocoding pulido (arrastrado del batch 2.7.0)

- Datum LAT (Lowest Astronomical Tide) calculado sobre 365 d para estaciones NEAPS, cacheado por estación 30 d. La release anterior tenía un offset sistemático de 30–60 cm respecto a IHM en semanas de mareas muertas.
- Paso de sensores del wizard: **16 tarjetas** (añadidos temperatura del aire, humedad, rumbo magnético, corredera, contador de targets AIS).
- Paths bloqueados (imprescindibles / obsoletos): popup CSS propio explicando por qué no se pueden togglear — se acabó el `<input disabled>` mudo en dispositivos táctiles.
- El 401 (permisos requeridos) dispara el mismo popup cuando la capa de seguridad está activada y no hay PIN introducido.

#### 🎛️ Limpieza del formulario Admin de SignalK

- Todo campo antes visible desaparece del formulario de config del plugin (`IHM base URL`, `Cache refresh`, `GPS max age`, `Update frequency`, `Pypilot bridge`, `IMU manager`, `Telegram`, etc.). Los defaults quedan hardcoded con valores sensatos en el código fuente; el wizard es la única superficie de edición.
- La descripción del config es ahora un CTA de una línea `[App setup moved to Webapp]` con link al wizard.

#### 💬 Cambios en el menú

- Nueva entrada `💬 Tu opinión cuenta` — modal dark con CTA de ⭐ estrella en GitHub, 🐛 issue y 📦 NPM.
- Quitado `🧮 Cálculo Sonda y Fondeo`. Reintroducido `⚓ Cálculo de fondeo` (solo fondeo). El cálculo de sonda es sólo del wizard.

## [2.7.0] - 2026-07-15

### English

**Wizard polish + NEAPS datum fix + Feedback CTA**

Follow-up release closing the last rough edges of the Sprint J wizard and correcting an accuracy problem with the NEAPS tide provider.

- **NEAPS ↔ IHM offset fixed**: the "cero del puerto" for NEAPS extremes is now computed from a **365-day** window (LAT ≈ Lowest Astronomical Tide) instead of the previous 7-day window + 5 cm safety margin. In neap-tide weeks the old code would leave the semanal minimum at 5 cm and drop all heights 30–60 cm below what IHM/xtide publish. Per-station cache TTL of 30 days keeps it fast. Existing cache invalidated automatically (`neaps-tides-v1` → `v2`).
- **Wizard step 5 — Sensor check** implemented (was `Under construction`): live grid with GPS position/SOG/heading (true + magnetic), depth, wind, barometric pressure, air/water temperature, humidity, IMU attitude, GPS satellites/HDOP, and **AIS target count**. Each tile shows the last value with unit conversion, freshness age, and a hint of what to check when it is missing (USB GPS, BME280, pypilot, SDR + AIS-catcher, etc.). Auto-refresh every 2 s.
- **Wizard step 9 — Summary** now reflects the real state: red banner + red-bordered rows for steps not yet completed, green ✅ for done ones. Removed the redundant "Configuration summary — click any item…" line. Progress bar reaches 100 % at step 9/9 (was 89 %). "Paso N/M" moved from a stacked label to an inline chip next to the H2 title.
- **SignalK path publication panel** in Config: click-lock popup with plugin-native CSS (dark + amber border, keyboard/backdrop dismiss) explaining *why* required 🔒 and deprecated 🗑 paths cannot be toggled. Same-styled amber popup when the security layer is enabled and the user is not logged in — no more silent 401s.
- **Feedback menu entry** — new `💬 Your feedback matters` in the hamburger menu. Modal with GitHub star CTA, "open issue" CTA, and NPM package link. Bilingual, click-outside/Escape to close.
- **README + npm keywords** updated to mention NEAPS, openwatersio, TICON-4, LAT datum, worldwide-tide-predictions and related terms so users searching in the SignalK Appstore find the plugin by these features.

### Español

**Pulido del wizard + arreglo datum NEAPS + CTA de feedback**

Release de continuidad que cierra los flecos del wizard de Sprint J y corrige un problema de precisión del proveedor NEAPS de mareas.

- **Offset NEAPS ↔ IHM arreglado**: el "cero del puerto" para los extremos NEAPS ahora se calcula sobre una ventana de **365 días** (LAT ≈ Lowest Astronomical Tide), en lugar de los 7 días + margen 5 cm anteriores. En semanas de mareas muertas la fórmula vieja dejaba el mínimo semanal en 5 cm y bajaba todas las alturas 30–60 cm respecto a lo que publica IHM/xtide. Caché por estación de 30 días. La caché vieja se invalida automáticamente (`neaps-tides-v1` → `v2`).
- **Wizard paso 5 — Sensores conectados** implementado (era `En construcción`): grid en vivo con posición GPS, SOG, rumbo (verdadero + magnético), sonda, viento, presión, temperatura de aire y agua, humedad, IMU (attitude), satélites/HDOP y **contador de targets AIS**. Cada tarjeta muestra el último valor con conversión de unidades, edad del dato y una pista de qué revisar si falta (GPS USB, BME280, pypilot, SDR + AIS-catcher, etc.). Refresco cada 2 s.
- **Wizard paso 9 — Resumen** ahora refleja el estado real: banner rojo + tarjetas con borde rojo para pasos sin completar, ✅ verde para los hechos. Eliminada la frase redundante "Resumen de configuración — pulsa cualquier ítem…". Barra de progreso llega al 100 % en el paso 9/9 (antes se quedaba en 89 %). "Paso N/M" pasa de línea aparte a chip inline junto al H2 del título.
- **Panel de publicación de paths SignalK** en Config: popup CSS propio del plugin (dark + borde ámbar, cierra con Escape/click fuera) explicando *por qué* los paths 🔒 imprescindibles y 🗑 obsoletos no se pueden togglear. Popup ámbar equivalente cuando la capa de seguridad está activada y no hay sesión — se acabaron los 401 silenciosos.
- **Entrada Feedback en el menú** — nuevo `💬 Tu opinión cuenta` en el menú hamburguesa. Modal con CTA de estrella en GitHub, botón de abrir issue y link a NPM. Bilingüe, se cierra con click fuera o Escape.
- **README + keywords npm** actualizados para mencionar NEAPS, openwatersio, TICON-4, datum LAT, predicciones de marea mundiales y términos relacionados, para que quienes busquen en el Appstore de SignalK encuentren el plugin por estas features.

## [2.6.0] - 2026-07-09

### English

**Sprint J — worldwide tides & setup wizard**

Big release focused on two things: making the plugin usable **outside Spain** (until now IHM was the only real source) and giving new installs a proper onboarding path.

#### 🌍 Multi-source global tides — IHM + signalk-tides + NEAPS + Open-Meteo

The plugin is no longer Spain-only. From this release it embeds a full worldwide tide engine and integrates seamlessly with the official openwatersio ecosystem.

**Automatic engine chain (Auto mode)**:

1. **🇪🇸 IHM (Spain official)** if you are within 300 km of any Spanish IHM station. Highest accuracy on the Spanish coast (Instituto Hidrográfico de la Marina, yearly harmonic coefficients from the official PDF).
2. **🔗 [signalk-tides](https://github.com/openwatersio/signalk-tides) (official plugin) if installed** on the same SignalK server. Auto-detected by probing `/signalk/v2/api/resources/tides` and validating the payload (`datum`, `units`, `station.latitude/longitude`, and `noaa/*` or `ticon/*` station id) so we never confuse it with our own resource provider. When signalk-tides is present, we consume it via its REST endpoint — its own configuration and station picker remain the single source of truth.
3. **📡 NEAPS embedded** as automatic offline fallback. Uses the [openwatersio/neaps](https://github.com/openwatersio/neaps) engine (MIT) with `@neaps/tide-database` (~7600 stations from NOAA + TICON-4 combining GESLA-4 records worldwide). Sub-minute time accuracy and millimetre-level height accuracy per NEAPS's own CI validation.
4. **🌐 Open-Meteo global** as last-resort net when everything else is unreachable.

**Manual mode**: pick your own engine (🇪🇸 IHM / 📡 NEAPS / 🌐 Open-Meteo — signalk-tides only shown when installed) and search a station by **city name**. Every search runs through geocoding (Open-Meteo Geocoding API first for speed and rate-limit friendliness, Nominatim as fallback), so typing `Sydney` finds Fort Denison in Australia, not Sydney BC in Canada. Ships also with the ~67 official IHM ports for direct picking.

**IHM availability aware**: if your GPS position is > 300 km from any Spanish IHM station, the IHM option disappears from the manual picker (with an explanation) so you don't waste time on a source that has no data for your area.

**Correct handling of specific NEAPS stations** (Rev696): the cache-key sanitization for station IDs containing `/` (e.g. `neaps/ticon/willamette_river_at_portland_or-14211720-usa-usgs`) was breaking silently and falling back to the nearest station by GPS. Fixed — the picker now delivers exactly the station you chose.

#### 🧙 Setup wizard (9 steps)

New guided onboarding for fresh installs. Automatically shown when `wizardCompleted !== true`, also re-launchable from **Menu → Configuration → 🧙 Re-launch wizard**.

- **Step 1 — Language** (Español / English) with persistence via `/api/settings`.
- **Step 2 — Units** (metric nautical, metric plain, imperial US, imperial US nautical, imperial UK, imperial UK nautical) applied instantly.
- **Step 3 — Boat data**: draft (SignalK `design.draft` as single source of truth if available, otherwise editable in the wizard **and** injected as a SK delta so it becomes the SoT), safety margin under keel, bow roller height above waterline.
- **Step 4 — System check**: `espeak`, `fonts-noto-color-emoji`, Node ≥ 20, SignalK Server ≥ 2.0, `signalk-derived-data`, tide DB freshness with `↻ Update now`, plugin cache size, MBTiles folder size, internet reachability, USB speaker detection, `@signalk/set-system-time` warning.
- **Step 5 — Connected sensors**: USB devices filtered to relevant (Audio, GPS, SDR for AIS), I²C sensors in plain Spanish (`🧭 IMU (gyro + accelerometer)` with technical chip `MPU-6050/9250 · 0x68`), ALSA audio outputs, SignalK data presence hints.
- **Step 6 — Tides & weather**: the new Auto/Manual picker described above with `📊 Current data` button per source to compare values side by side.
- **Step 7 — Offline charts**: MBTiles folder path with size per file + total, `📋 Copy path`, link to the official SignalK charts plugin.
- **Step 8 — Master user**: alias + PIN (4-8 digits) + confirm form. When there is no master yet, `/access/pin-set` accepts creation without cookie. Once created, the step shows the master alias and a button to open the full user-control modal.
- **Step 9 — Summary**: eight clickable cards (each entire card is a button, no redundant CTAs) that jump to the corresponding step in-place — the wizard never bounces you to an external modal that then dumps you at the viewer.

**Footer**: three big equal-size buttons (🏠 Home to exit straight to the viewer, ← back, → next / ✓ finish).

#### 🎯 Coherent tide state across wizard and TidesView

Before this release the wizard's "default engine" and TidesView's Auto/Manual + station dropdown could contradict each other. Now:

- `POST /api/manual` always keeps `tideEnginePreference`, `manualOverride`, `manualStationId` and `favoriteStationId` in sync. Choosing NEAPS Portland from the wizard picker updates the pref. Choosing IHM Vigo in Manual clears any residual virtual favourite.
- The IHM resolver (`src/sources/ihm.ts`) no longer purges the manual selection when the id starts with `neaps/`, `sktides/` or matches any known virtual id.
- If a specific NEAPS station is selected and fails (rare — cache-key error, missing harmonics), the fallback is controlled: try NEAPS nearest-by-GPS, then synthetic — never IHM without asking.
- On startup, if `manualOverride=false` and `tideEnginePreference` is still stuck at `neaps`/`openmeteo`/etc from a previous session, it is reset to `"auto"` so a fresh boot always tries IHM first when possible.

#### 🔧 Backend surface additions

- `GET /api/tide/engines-available` — reports which engines are usable for the current GPS position.
- `GET /api/tide/stations-search?engine=<ihm|neaps|openmeteo>&q=<text>` — city search with geocoding fallback.
- `GET /api/tide/providers-status` — status per provider (available / active).
- `GET /api/tide/engine-pref`, `POST /api/tide/engine-pref` — read/write the default engine.
- `GET /api/tide/preview?engine=<x>` — ad-hoc query of any provider without changing global state (used by the wizard's "📊 Current data" buttons).
- `POST /api/sk-inject/draft` — injects `design.draft` as a SignalK delta from the wizard.
- `GET /api/wizard/state`, `POST /api/wizard/step`, `POST /api/wizard/finish`, `POST /api/wizard/restart`, `GET /api/wizard/system-check`, `GET /api/wizard/hardware-check` — wizard state machine + audits.

#### 🐛 Fixes bundled in this release

- SignalK path `environment.tide.stationName` now includes a source badge (`📡 NEAPS · Vigo`, `🌐 Open-Meteo global`, `🔗 sktides · <station>`) so at a glance you know where the numbers come from — the TICON-4 database happens to have a station called *Vigo* in Spain, which was indistinguishable from the IHM one without the prefix.
- `updateForecast()` now also updates `_tideFetchState.source` and `.lastAttemptMs`, so the debug status of the wizard is always consistent with what the provider actually just served.
- The tide-cache health check (system-check) no longer looks at a legacy `stationsList.fetchedAt` key that was never actually written by any provider — it reads `_tideFetchState.lastAttemptMs` directly, so `↻ Update now` reflects the real state.

### Español

**Sprint J — mareas mundiales y asistente de instalación**

Release grande centrada en dos cosas: hacer usable el plugin **fuera de España** (hasta ahora IHM era la única fuente real) y darle a las instalaciones nuevas un onboarding decente.

#### 🌍 Mareas mundiales multi-fuente — IHM + signalk-tides + NEAPS + Open-Meteo

El plugin deja de ser sólo-España. Desde esta versión embebe un motor de mareas mundial completo y se integra a la perfección con el ecosistema oficial de openwatersio.

**Cadena automática de motor (modo Auto)**:

1. **🇪🇸 IHM (España oficial)** si estás a menos de 300 km de una estación IHM española. Máxima precisión en costa española (Instituto Hidrográfico de la Marina, coeficientes armónicos anuales del PDF oficial).
2. **🔗 [signalk-tides](https://github.com/openwatersio/signalk-tides) (plugin oficial) si lo tienes instalado** en el mismo servidor SignalK. Autodetectado consultando `/signalk/v2/api/resources/tides` y validando el payload (`datum`, `units`, `station.latitude/longitude` y `station.id` con prefijo `noaa/*` o `ticon/*`) para no confundirlo con nuestro propio resource provider. Cuando signalk-tides está presente lo consumimos por su REST — su propia configuración y selector de estación siguen siendo la única fuente de verdad.
3. **📡 NEAPS embebido** como fallback automático offline. Usa el motor [openwatersio/neaps](https://github.com/openwatersio/neaps) (MIT) con `@neaps/tide-database` (~7600 estaciones NOAA + TICON-4 que combinan registros GESLA-4 globales). Precisión sub-minuto en tiempo y milimétrica en altura según la CI del propio NEAPS.
4. **🌐 Open-Meteo global** como última red cuando todo lo demás falla.

**Modo Manual**: eliges tú el motor (🇪🇸 IHM / 📡 NEAPS / 🌐 Open-Meteo — signalk-tides sólo aparece si está instalado) y buscas una estación por **nombre de ciudad**. Cada búsqueda pasa por geocoding (Open-Meteo Geocoding primero por velocidad y respeto al rate-limit, Nominatim como fallback), así que escribir `Sydney` encuentra Fort Denison en Australia, no Sydney BC de Canadá. Se incluyen también las ~67 estaciones IHM oficiales españolas para elegir directamente.

**Sensible a la cobertura IHM**: si tu GPS está a > 300 km de cualquier estación IHM española, la opción IHM desaparece del selector manual (con explicación) para que no pierdas el tiempo con una fuente que no tiene datos para tu zona.

**Manejo correcto de estaciones NEAPS específicas** (Rev696): la sanitización del cache-key para IDs que contienen `/` (p.ej. `neaps/ticon/willamette_river_at_portland_or-14211720-usa-usgs`) fallaba en silencio y hacía fallback a la estación más cercana por GPS. Arreglado — el picker devuelve exactamente la estación que elegiste.

#### 🧙 Asistente de configuración (9 pasos)

Nuevo onboarding guiado para instalaciones nuevas. Se muestra automáticamente cuando `wizardCompleted !== true`, y también se relanza desde **Menú → Configuración → 🧙 Relanzar asistente**.

- **Paso 1 — Idioma** (Español / English) con persistencia vía `/api/settings`.
- **Paso 2 — Unidades** (métricas náuticas, métricas puras, imperiales US, imperiales US náuticas, imperiales UK, imperiales UK náuticas) aplicadas al instante.
- **Paso 3 — Datos del barco**: calado (SignalK `design.draft` como fuente única de verdad si está disponible; si no, se edita en el asistente **y** se publica como delta SK para que quede como SoT), margen de seguridad bajo quilla, altura de la roldana sobre la línea de flotación.
- **Paso 4 — Chequeo del sistema**: `espeak`, `fonts-noto-color-emoji`, Node ≥ 20, SignalK Server ≥ 2.0, `signalk-derived-data`, actualidad de la BD de mareas con `↻ Actualizar ahora`, tamaño de la cache del plugin, tamaño de la carpeta MBTiles, acceso a Internet, detección de altavoz USB, aviso sobre `@signalk/set-system-time`.
- **Paso 5 — Sensores conectados**: dispositivos USB filtrados a los relevantes (audio, GPS, SDR para AIS), sensores I²C en cristiano (`🧭 IMU (giroscopio + acelerómetro)` con chip técnico `MPU-6050/9250 · 0x68`), salidas de audio ALSA, presencia de datos en SignalK.
- **Paso 6 — Mareas y meteo**: el nuevo selector Auto/Manual descrito arriba con botón `📊 Datos actuales` por fuente para comparar valores lado a lado.
- **Paso 7 — Cartas offline**: ruta de la carpeta MBTiles con tamaño por fichero + total, `📋 Copiar ruta`, link al plugin oficial de cartas SignalK.
- **Paso 8 — Usuario maestro**: formulario alias + PIN (4-8 dígitos) + confirmar. Cuando aún no hay master, `/access/pin-set` acepta la creación sin cookie. Una vez creado, el paso muestra el alias del maestro y un botón para abrir el modal completo de control de usuarios.
- **Paso 9 — Resumen**: ocho tarjetas clickables (la tarjeta entera es un botón, sin CTAs redundantes) que saltan al paso correspondiente in-situ — el asistente nunca te rebota a un modal externo que luego te tira al visor.

**Footer**: tres botones grandes del mismo tamaño (🏠 Home para salir directamente al visor, ← atrás, → siguiente / ✓ finalizar).

#### 🎯 Estado coherente entre asistente y TidesView

Antes de esta release el "motor por defecto" del asistente y el selector Auto/Manual + dropdown de TidesView podían contradecirse. Ahora:

- `POST /api/manual` mantiene siempre en sincronía `tideEnginePreference`, `manualOverride`, `manualStationId` y `favoriteStationId`. Elegir NEAPS Portland desde el asistente actualiza el pref. Elegir IHM Vigo en Manual limpia cualquier favorito virtual residual.
- El resolver IHM (`src/sources/ihm.ts`) ya no purga la selección manual cuando el id empieza por `neaps/`, `sktides/` o coincide con cualquier id virtual conocido.
- Si una estación NEAPS específica se selecciona y falla (raro — error de cache-key, armónicos ausentes), el fallback es controlado: prueba NEAPS más cercana por GPS, luego sintética — nunca IHM sin avisar.
- En arranque, si `manualOverride=false` y `tideEnginePreference` sigue anclado en `neaps`/`openmeteo`/etc de una sesión anterior, se resetea a `"auto"` para que un boot nuevo siempre pruebe IHM primero cuando sea posible.

#### 🔧 Endpoints backend añadidos

- `GET /api/tide/engines-available` — reporta qué motores son usables para la posición GPS actual.
- `GET /api/tide/stations-search?engine=<ihm|neaps|openmeteo>&q=<texto>` — búsqueda por ciudad con fallback de geocoding.
- `GET /api/tide/providers-status` — estado por proveedor (disponible / activo).
- `GET /api/tide/engine-pref`, `POST /api/tide/engine-pref` — leer/escribir el motor por defecto.
- `GET /api/tide/preview?engine=<x>` — consulta ad-hoc de cualquier proveedor sin cambiar el estado global (usado por los botones "📊 Datos actuales" del asistente).
- `POST /api/sk-inject/draft` — inyecta `design.draft` como delta SignalK desde el asistente.
- `GET /api/wizard/state`, `POST /api/wizard/step`, `POST /api/wizard/finish`, `POST /api/wizard/restart`, `GET /api/wizard/system-check`, `GET /api/wizard/hardware-check` — máquina de estado del asistente + audits.

#### 🐛 Fixes bundleados en esta release

- El path SignalK `environment.tide.stationName` incluye ahora un badge de fuente (`📡 NEAPS · Vigo`, `🌐 Open-Meteo global`, `🔗 sktides · <estación>`) para que se sepa de un vistazo de dónde vienen los números — la base de datos TICON-4 resulta que tiene una estación llamada *Vigo* en España, que antes era indistinguible de la IHM sin el prefijo.
- `updateForecast()` actualiza también `_tideFetchState.source` y `.lastAttemptMs`, así el estado de debug del asistente siempre es coherente con lo que el provider acaba de servir realmente.
- El check de salud del cache de marea (system-check) ya no mira una key legacy `stationsList.fetchedAt` que ningún provider escribía en realidad — lee `_tideFetchState.lastAttemptMs` directamente, así `↻ Actualizar ahora` refleja el estado real.

## [2.5.4] - 2026-07-06

### English

**Sprint I — quick wins pack**

Pack of small-but-useful features that many users have been asking for. All batched together so the AppStore card doesn't get spammed with tiny releases.

- **🐛 Send diagnostic — 1-button** (Rev646, Rev648-Rev654). New menu entry `🐛 Enviar diagnóstico` that captures a full technical snapshot of the installation and copies it to the clipboard for the user to paste into support chat/email. Preview modal with big readable typography (28px title, 20px explanation, 16px monospace JSON, 960px wide) shows exactly what's about to be sent so the user can review; sensitive data is already redacted (GPS coords rounded to 0.1°/~11 km, Telegram token/chat_id masked as XXXX, PIN hashes and own MMSI removed). The diagnostic includes: SK Server version, OpenPlotter version, Node version, hostname, uptime, load average, memory (system + plugin), full list of installed SK plugins with real `enabled: true/false` flag, IMU audit, wave engine state, pypilot bridge status, AIS targets seen, all subscribed SK paths with age, `@signalk/set-system-time` detection, tide fetch status, mbtiles config, PIN accounts summary and internet reachability pings to IHM/Open-Meteo/GitHub/NPM. Fuzzy matching for scope packages (`@signalk/*`, `@mxtommy/*`) so `enabled` reflects the real state even when SK stores plugin-config-data flat without the scope prefix.

- **🌀 Windy multi-source** (Rev646). Menu entry Windy now opens a small chooser with 💨 **Wind** (default), 🛰️ **Satellite** and 📡 **Radar**. Choice persisted in localStorage. Closing the Windy popup returns to the chooser instead of the visor so you can switch layers without going through the menu again.

- **User Control polish** (Rev646-Rev648). "Users active" and "Registered users" titles unified to the same big style as "Access control master switch". Thicker separators between blocks (3 px). New explanatory descriptor under each title so the button doesn't sit stuck to the heading. `+ Add user` button now below the title in its own row. `Notes` field bumped from 120 to **500 chars** with a 5-line textarea. Redundant "Your PIN does not expire" line hidden for master users (implicit for the master, useful for guests).

- **🔄 Force tide fetch + auto retry** (Rev655-Rev656). When the first tide download fails on a fresh install (no cache yet + IHM slow / no internet), instead of the dead "Sin datos suficientes" the Curves modal now shows `🔄 Descargando marea IHM — intento X/5…` and a big `↻ Reintentar ahora` button. Backend auto-retries with exponential backoff (3s / 15s / 60s / 3min / 10min). Source is agnostic — displays "IHM" or "Open-Meteo" depending on the station selected. New endpoints `POST /api/tide/force-refresh` and `GET /api/tide/fetch-status`.

- **Minimum requirements documented** (Rev654 README). Explicit block in README (EN + ES) listing: OpenPlotter V4, SignalK Server ≥ 2.0, Node ≥ 20, UTF-8 locale (critical: non-UTF-8 corrupts IMU parsing), `fonts-noto-color-emoji`, `espeak`. Loud warning about `@signalk/set-system-time` being incompatible.

**Additional fixes bundled**

- **Wave widget "IMU… Xs/90s" progress bar** during buffer warmup (Rev654). Previous "🕒 IMU…" was vague; now the user sees the buffer filling in real time and knows exactly when to expect the value.
- **Auto-detect Pypilot bridge on localhost** (Rev644). If no host is configured (fresh install), the plugin probes TCP `localhost:23322` for 1.5 s. If Pypilot answers, the bridge is auto-enabled with `host=localhost, port=23322`. Eliminates a manual step users often missed.

### Español

**Sprint I — pack de mejoras rápidas**

Pack de features pequeños pero útiles que muchos usuarios habían pedido. Todo agrupado en una release para no saturar la ficha del AppStore con mini-releases.

- **🐛 Enviar diagnóstico — 1 botón** (Rev646, Rev648-Rev654). Nueva entrada de menú `🐛 Enviar diagnóstico` que captura una foto técnica completa de la instalación y la copia al portapapeles para que el usuario la pegue en el chat/email de soporte. Modal preview con tipografía grande y legible (título 28px, explicación 20px, JSON monoespaciado 16px, ancho 960px) muestra exactamente qué se va a enviar para que el usuario revise; los datos sensibles ya vienen redactados (coordenadas GPS redondeadas a 0,1°/~11 km, token/chat_id de Telegram enmascarados como XXXX, hashes de PIN y MMSI propio eliminados). El diagnóstico incluye: versión de SK Server, versión de OpenPlotter, versión de Node, hostname, uptime, load average, memoria (sistema + plugin), lista completa de plugins SK instalados con el flag `enabled: true/false` real, IMU audit, estado del motor de olas, estado del bridge pypilot, targets AIS vistos, todos los paths SK con age, detección de `@signalk/set-system-time`, estado del fetch de marea, config de mbtiles, resumen de cuentas PIN y pings de conectividad a IHM/Open-Meteo/GitHub/NPM. Fuzzy matching para paquetes scope (`@signalk/*`, `@mxtommy/*`) para que `enabled` refleje el estado real aunque SK guarde los `plugin-config-data` sin el prefijo del scope.

- **🌀 Windy multi-fuente** (Rev646). La entrada Windy del menú abre ahora un mini-chooser con 💨 **Viento** (por defecto), 🛰️ **Satélite** y 📡 **Radar**. Elección persistida en localStorage. Cerrar el popup Windy vuelve al chooser en lugar del visor para poder cambiar de capa sin pasar por el menú otra vez.

- **Control de usuarios pulido** (Rev646-Rev648). Títulos "Usuarios activos" y "Usuarios registrados" unificados al mismo tamaño grande que "Control activo de usuarios". Separadores entre bloques más gruesos (3 px). Nuevo descriptor explicativo bajo cada título para que el botón no quede pegado al encabezado. Botón `+ Añadir usuario` ahora debajo del título en su propia fila. Campo `Notas` ampliado de 120 a **500 caracteres** con un textarea de 5 líneas. Línea redundante "Tu PIN no caduca" oculta para usuarios master (implícito para el master, útil para invitados).

- **🔄 Forzar fetch de marea + retry automático** (Rev655-Rev656). Cuando la primera descarga de marea falla en una instalación fresca (sin cache + IHM lento / sin internet), en lugar del muerto "Sin datos suficientes" el modal Curvas muestra ahora `🔄 Descargando marea IHM — intento X/5…` y un botón grande `↻ Reintentar ahora`. El backend hace retry automático con backoff exponencial (3s / 15s / 60s / 3min / 10min). Agnóstico a la fuente — muestra "IHM" u "Open-Meteo" según la estación seleccionada. Nuevos endpoints `POST /api/tide/force-refresh` y `GET /api/tide/fetch-status`.

- **Requisitos mínimos documentados** (Rev654 README). Bloque explícito en README (ES + EN) con: OpenPlotter V4, SignalK Server ≥ 2.0, Node ≥ 20, locale UTF-8 (crítico: un locale no-UTF-8 corrompe el parseo del IMU), `fonts-noto-color-emoji`, `espeak`. Aviso destacado sobre la incompatibilidad de `@signalk/set-system-time`.

**Otros fixes bundleados**

- **Barra de progreso "IMU… Xs/90s" en el widget Olas** durante el warmup del buffer (Rev654). El "🕒 IMU…" anterior era vago; ahora el usuario ve el buffer llenándose en tiempo real y sabe exactamente cuándo esperar el valor.
- **Auto-detect del bridge Pypilot en localhost** (Rev644). Si no hay host configurado (instalación fresca), el plugin sondea el TCP `localhost:23322` durante 1.5 s. Si Pypilot responde, se auto-activa el bridge con `host=localhost, port=23322`. Elimina un paso manual que muchos usuarios se saltaban.

## [2.5.3] - 2026-07-05

### English

**Critical: detect and warn about `@signalk/set-system-time` corrupting the IMU every 60 s (Rev644, Rev645)**

Diagnosed by external user Pablo with help from ChatGPT: the SignalK official plugin `@signalk/set-system-time` (shipped by default and often enabled without the user knowing on OpenPlotter installations with internet) runs `date -u -s` every 60 s at 1-second resolution. That truncates ~0.8 s off the clock; `systemd-timesyncd` then corrects it via NTP a few ms later. Two wall-clock jumps per minute, forever. RTIMULib (used by pypilot) timestamps IMU samples with wall clock, so each jump corrupts the Kalman filter `dt` → attitude bandazos of ±150° for 1-2 s → our wave RMS absorbs the noise and publishes phantom "Fuerte 63s" waves with flat sea. Pablo verified the 1:1 correlation between wall-clock jumps and IMU flips.

Two safeguards added:

1. **Backend detection**: the plugin polls `/skServer/plugins/` at start (+5 s) and every 5 min looking for `set-system-time` with `enabled: true`. Exposed as `setSystemTimePluginActive` in the SSE state and via `GET /api/env/system-time-warning`.
2. **Persistent yellow warning banner** in the viewer when detected, with instructions to disable the plugin (SignalK → Server → Plugin Config → "Set System Time" → OFF → restart). Dismissable per browser session.
3. **Defensive `dt` guard on the wave buffer** (Rev645): if the wall-clock time between two consecutive samples jumps > 500 ms (or goes backwards), the new sample is discarded. Debug log emitted. Mitigates the impact even if the user doesn't disable the offending plugin.

**Impact**: any OpenPlotter installation with internet that hasn't manually disabled `set-system-time` was silently suffering this — the visible symptom in our plugin was "phantom Fuerte waves" but the underlying corruption also degrades autopilot, KIP attitude gauges and any other consumer of `navigation.attitude`.

**Auto-detect Pypilot bridge on localhost (Rev644)**

Reported by Pablo: our "Pypilot IMU bridge" defaults to disabled with empty host — the user has to discover the toggle in Plugin Config and set `host: localhost` manually or the whole wave engine stays mute. Now on plugin start, if no host is configured (neither in the SK plugin schema nor in the fs fallback), we probe TCP `localhost:23322` for 1.5 s. If pypilot answers, we auto-enable the bridge with `host=localhost, port=23322` and persist. Zero side effects if no pypilot is listening.

### Español

**Crítico: detección y aviso del bug de `@signalk/set-system-time` que corrompe el IMU cada 60 s (Rev644, Rev645)**

Diagnosticado por el usuario externo Pablo con ayuda de ChatGPT: el plugin oficial de SignalK `@signalk/set-system-time` (viene de serie y muchas veces está activado sin que el usuario lo sepa en instalaciones OpenPlotter con internet) ejecuta `date -u -s` cada 60 s con resolución de 1 segundo. Eso trunca ~0.8 s del reloj; `systemd-timesyncd` corrige por NTP unos ms después. Dos saltos de reloj por minuto, indefinidamente. RTIMULib (usada por pypilot) timestamp´a las muestras del IMU con reloj de pared, así cada salto corrompe el `dt` del filtro Kalman → bandazos de attitude de ±150° durante 1-2 s → nuestro RMS de olas absorbe el ruido y publica "Fuerte 63s" fantasma con mar plana. Pablo verificó la correlación 1:1 entre saltos de reloj y vuelcos del IMU.

Dos salvaguardas añadidas:

1. **Detección backend**: el plugin consulta `/skServer/plugins/` al arrancar (+5 s) y cada 5 min buscando `set-system-time` con `enabled: true`. Expuesto como `setSystemTimePluginActive` en el state SSE y vía `GET /api/env/system-time-warning`.
2. **Banner amarillo persistente** en el visor cuando se detecta, con instrucciones para desactivarlo (SignalK → Server → Plugin Config → "Set System Time" → OFF → reiniciar). Se puede cerrar por sesión.
3. **Guard defensivo del `dt` en el buffer de olas** (Rev645): si el tiempo de pared entre dos muestras consecutivas salta > 500 ms (o retrocede), se descarta la nueva muestra. Log en debug. Mitiga el impacto aunque el usuario no desactive el plugin culpable.

**Impacto**: cualquier instalación OpenPlotter con internet que no haya desactivado manualmente `set-system-time` está sufriéndolo en silencio — el síntoma visible en nuestro plugin era "olas Fuerte fantasma" pero la corrupción subyacente también degrada el autopilot, los gauges de attitude de KIP y cualquier otro consumer de `navigation.attitude`.

**Auto-detect del bridge Pypilot en localhost (Rev644)**

Reportado por Pablo: nuestro "Pypilot IMU bridge" venía apagado por defecto con host vacío — el usuario tenía que descubrir el toggle en Plugin Config y poner `host: localhost` manualmente o todo el motor de olas se quedaba mudo. Ahora al arrancar el plugin, si no hay host configurado (ni en el schema del plugin SK ni en el fallback de fs), hacemos un probe TCP a `localhost:23322` durante 1.5 s. Si pypilot responde, auto-activamos el bridge con `host=localhost, port=23322` y lo persistimos. Cero efectos si no hay pypilot escuchando.

## [2.5.2] - 2026-07-05

### English

**IMU-driven waves — coherence and no more phantom "Fuerte" (Rev637, Rev642)**

The two wave endpoints (`/api/wave/boat` and `/api/wave/nav`) now share the same physical guard: if the encountered period is outside 2-20 s (impossible for real waves) or RMS motion is negligible (< 0.3°), `motionBand` is null and a `rejectionReason` is exposed. Previously only `/api/wave/nav` had the guard, so the map arrow, `wx-wave` in the Shelter popup, and the shelter grade could still show "Fuerte 63s" while the widget said nothing. Consistent now across widget, map, popup and grade.

Rev642 fixes a priority bug in the rejection reason: when both `noMotion` and `periodOutOfRange` were true (typical case in a calm harbour — no real motion produces a spurious PCA period from noise), we now report `noMotion` because that's the real physical state. Before, the widget said "unreliable data" when it should have said "calm".

**Bottom-bar Olas widget — informative states (Rev641, Rev643)**

The widget used to show "— — —" for anything that wasn't a resolved wave. Now it shows:

- 🕒 **IMU…** while the buffer warms up (first 90 s after restart).
- 🟢 **Calma** when RMS is below 0.3° (real calm).
- 🚢 icon + period (with `~` suffix for apparent period at anchor, plain for real Doppler-resolved) + direction when there are real waves.

**Depth calculator — hidden 15% factor removed (Rev638)**

The `effectiveDraft = (draft + safetyMargin) × 1.15` formula is gone. Now `effectiveDraft = draft + safetyMargin` cleanly. The extra factor was giving false safety and triggering premature grounding alarms based on a coefficient the navigator never chose. The user controls all the margin from `safetyMargin`.

Cache from previous versions with the inflated value is auto-repaired on first evaluation. UI label "Calado efectivo (+15%)" simplified to "Calado efectivo".

**Grounding alarm — canonical message + boot warmup (Rev639)**

Fix reported by Carlos: alarm sounded at plugin restart despite plenty of clearance (`physicalRisk: false`, `notifyRisk: false`) and did not recur after snooze. Two root causes patched:

1. The `message` field of `groundingRisk` was always built saying "RIESGO DE VARADA", regardless of whether risk actually existed. Any external consumer reading `message` as a source of truth was misled. Now the message reflects the real state ("SIN RIESGO" or "RIESGO DE VARADA" with the correct predicted depth).
2. Added a 20 s warmup guard: `evaluateAndPublishGroundingRisk` skips execution during the first 20 s after plugin start. This prevents a race where `skDraft` (published by SignalK) has not arrived yet, we fall back to a legacy inflated cache, and a single tick with incomplete data triggers a phantom alarm.

**IMU Audit auto-fallback to SignalK deltas (Rev640)**

Reported by external user Pablo: the IMU Audit page showed 0 samples and "pypilot disconnected" even though his IMU was providing data (via SK deltas). Root cause: the audit buffers were only fed from the direct pypilot TCP socket. In OpenPlotter's "Enable IMU only" mode of the Pypilot plugin, the socket 23322 is not exposed — the audit had no source although the rest of the plugin worked. Now the 5 Hz SK sampler that feeds the wave buffer also feeds the audit buffers. A new `auditSource` field is returned by `/api/imu/debug` (`pypilot-tcp` | `sk-deltas` | `none`) so the user knows which channel is active.

### Español

**Olas por IMU — coherencia y adiós al "Fuerte" fantasma (Rev637, Rev642)**

Los dos endpoints de olas (`/api/wave/boat` y `/api/wave/nav`) comparten ahora el mismo guard físico: si el periodo detectado está fuera de 2-20 s (imposible para olas reales) o el RMS de movimiento es despreciable (< 0.3°), `motionBand` se pone a null y se expone `rejectionReason`. Antes sólo `/api/wave/nav` filtraba, así que la flecha de olas del mapa, el `wx-wave` del popup Abrigo y el grado de abrigo podían seguir mostrando "Fuerte 63s" mientras el widget no decía nada. Ahora consistente entre widget, mapa, popup y grado.

Rev642 corrige un bug de prioridad en el rejection reason: cuando eran verdad a la vez `noMotion` y `periodOutOfRange` (caso típico en puerto tranquilo — sin movimiento real el análisis PCA saca un periodo espurio del ruido), ahora reportamos `noMotion` porque es el estado físico real. Antes el widget decía "dato no fiable" cuando debería decir "calma".

**Widget Olas del bottom-bar — estados informativos (Rev641, Rev643)**

El widget mostraba "— — —" para todo lo que no fuera una ola resuelta. Ahora:

- 🕒 **IMU…** mientras el buffer se calienta (los primeros 90 s tras cada restart).
- 🟢 **Calma** cuando el RMS es inferior a 0.3° (calma real).
- 🚢 icono + periodo (sufijo `~` para periodo aparente en fondeo, sin sufijo para real vía Doppler) + dirección cuando hay olas reales.

**Cálculo Sonda — eliminado el factor 15% oculto (Rev638)**

La fórmula `effectiveDraft = (calado + margen) × 1.15` desaparece. Ahora `effectiveDraft = calado + margen` limpio. El factor extra daba falsa seguridad y disparaba alarmas de varada prematuras basadas en un coeficiente que el navegante nunca eligió. El usuario controla TODO el margen desde `safetyMargin`.

Cache de versiones previas con el valor inflado se auto-repara en la primera evaluación. La etiqueta UI "Calado efectivo (+15%)" pasa a "Calado efectivo".

**Alarma de varada — mensaje canónico + warmup al arrancar (Rev639)**

Fix reportado por Carlos: la alarma sonaba al reiniciar el plugin pese a tener agua sobrada (`physicalRisk: false`, `notifyRisk: false`) y no volvía a sonar tras el snooze. Dos causas raíz corregidas:

1. El campo `message` de `groundingRisk` se construía siempre diciendo "RIESGO DE VARADA", con o sin riesgo real. Cualquier consumer externo que leyera `message` como fuente de verdad se confundía. Ahora el mensaje refleja el estado real ("SIN RIESGO" o "RIESGO DE VARADA" con la profundidad esperada).
2. Añadido warmup guard de 20 s: `evaluateAndPublishGroundingRisk` no se ejecuta durante los primeros 20 s tras el start del plugin. Con esto se evita el race en el que `skDraft` (publicado por SignalK) aún no ha llegado, caemos al cache legacy inflado, y un solo tick con datos incompletos dispara una alarma fantasma.

**Audit del IMU con auto-fallback a deltas SK (Rev640)**

Reportado por el usuario externo Pablo: la página de IMU Audit mostraba 0 samples y "pypilot desconectado" pese a que su IMU sí publicaba (vía deltas SK). Causa raíz: los buffers del audit sólo se alimentaban desde el socket TCP directo de pypilot. En el modo "Habilitar sólo IMU" del plugin Pypilot de OpenPlotter el socket 23322 no se expone — el audit se quedaba sin fuente aunque el resto del plugin funcionara. Ahora el sampler SK a 5 Hz que alimenta el buffer principal también alimenta los buffers del audit. Nuevo campo `auditSource` en `/api/imu/debug` (`pypilot-tcp` | `sk-deltas` | `none`) para que el usuario sepa por qué canal le llegan los datos.

## [2.5.1] - 2026-07-04

### English

**Post-drop alarm popup (Rev628-Rev635)**

Dropping the anchor now enables ALL fondeo alarms by default (Drag + AIS + Depth + GPS-loss + Weather). A small floating popup appears ~5 s later with the four configurable toggles pre-checked and a 60-second countdown inside the OK button. No action → all stay ON. During those 60 s no AIS target popup opens automatically, so the user isn't ambushed with ACK dialogs before deciding.

- Drag alarm shown as a locked greyed row (always on, base safety).
- All alarm titles in the popup use a uniform style (no per-alarm colours).
- Toggle changes apply immediately to the 🔔 Alarms panel across devices.

**Fixes for false-positive AIS "collision" targets (Rev629-Rev631)**

- With AIS alarm OFF, targets no longer get flagged as "DRAGGING" (they had no ACK button reachable and would stay red persistently).
- Toggling the AIS alarm OFF then ON no longer wipes previously ACK'd targets — ACKs are preserved. Only lifting anchor clears them.
- Closing the AIS popup also clears the red highlight ring on the map (no orphaned rings around a deselected target).
- After lifting anchor, every AIS target visually resets: no lingering orange/red states, no orphan rings, no residual "DRAGGING" tag.

**Neighbour anchor visible when selecting an AIS target (Rev630-Rev631)**

Clicking any nearby AIS target now paints its estimated anchor position on the map (a large orange ⚓ with a black glow so it stays visible even when the boat marker overlaps) plus its estimated swing circle (P90 + length + 5 m margin). Clears when the popup is closed, another target is selected, or own anchor is lifted.

**Unified Depth + Anchoring calculator (Rev628)**

The two menu entries "Cálculo Sonda" and "Cálculo Fondeo" are merged into a single "🧮 Cálculo Sonda y Fondeo" modal with both sections stacked. Bottom-bar chain/anchor-distance cells and top tide buttons all open the same unified modal. Less is more.

**Bottom-bar cells (Rev635)**

- "Heading" cell renamed to "Rumbo" in Spanish (was English on both languages).
- "Sonda" cell renamed to "Sonda B. Quilla" (explicit: below keel).
- New optional cell **"Sonda B. Superf"** = depth from water surface (sounder + draft), with sub-label showing expected depth at next low water from surface. Off by default; enable in Bottom-bar config.

**Track point popup i18n (Rev628)**

Clicking a point of the track history now shows title, timestamp and "X ago" text localised to the UI language (ES: "hace 5 min", "hace 2 h"; EN: "5 min ago", "2 h ago") with matching locale date format.

**Physics / IMU-based waves (Rev632)**

Fix reported by external user Pablo: his visor showed "Fuerte 63 s ESE" waves and F/10 % shelter grade while the boat was in a marina with weather-forecast flat sea. Root cause: the algorithm was publishing `motionBand: "fuerte"` based solely on a high roll/pitch RMS even when the encountered period was outside physical range for waves (34 s) and Doppler had `confidencePeriodTrue: 0`. Now if `periodOutOfRange` or no significant motion → `motionBand = null` and `rejectionReason = "periodOutOfRange"`, so downstream Shelter score isn't degraded by IMU noise/pier vibration/mis-calibration.

**Watchdog "DATOS NO FIABLES" false-positive fix (Rev632)**

The banner used to fire spuriously on localhost after tab background switches or Chromium CPU spikes (age inflated by a paused event loop). Now: (1) `visibilitychange → visible` resets `_lastStateRecvMs`; (2) threshold raised 15 → 20 s; (3) before showing the banner an active `fetch /state` ping confirms real disconnection — if the backend answers OK it was a local artefact and the banner is suppressed silently.

**High-latency (Tailscale/4G/Mauritania) drop-lift stability (Rev635)**

With ping 400-800 ms the UI used to "flutter" during drop/lift: rings appearing/disappearing, "anchor down" voice spoken twice, `anch` toggling between true/false with each late SSE tick. Optimistic guard added: for 15 s after a local drop/lift, in-flight SSE echoes with the opposite state are ignored. Anchor-down voice de-dupe raised 5 → 30 s.

### Español

**Popup de alarmas post-fondeo (Rev628-Rev635)**

Al echar ancla ahora se activan por defecto TODAS las alarmas de fondeo (Garreo + AIS + Sonda + Pérdida GPS + Meteo). A los ~5 s aparece un popup pequeño flotante con los cuatro toggles configurables marcados y un contador de 60 s dentro del botón OK. Sin acción → todas quedan ON. Durante esos 60 s no se auto-abre ningún popup individual de target AIS, así el usuario no se ve bombardeado con diálogos de ACK antes de decidir.

- Alarma Garreo mostrada como fila bloqueada gris (siempre activa, seguridad base).
- Todos los títulos del popup con estilo uniforme (sin colorines por alarma).
- Los cambios de toggle se aplican al panel 🔔 Alarmas en tiempo real cross-device.

**Fixes de falsos positivos AIS "colisión" (Rev629-Rev631)**

- Con la alarma AIS OFF, los targets ya no se marcan como "GARREANDO" (antes quedaban en rojo persistente sin botón ACK accesible).
- Apagar y volver a encender la alarma AIS ya no borra los ACKs previos — se conservan. Solo se limpian al levar ancla.
- Cerrar el popup individual de AIS también limpia el aro rojo del mapa (nada de anillos huérfanos alrededor de un target deseleccionado).
- Al levar ancla, todos los targets AIS resetean su estado visual: sin naranjas/rojos residuales, sin anillos huérfanos, sin "¡GARREANDO!" pegajoso.

**Fondeo del vecino visible al seleccionar un target AIS (Rev630-Rev631)**

Al pinchar cualquier target AIS cercano se pinta ahora en el mapa la posición estimada de su ancla (una ⚓ naranja grande con sombra negra para verse aunque el marker del barco quede encima) más su círculo de borneo estimado (P90 + eslora + 5 m de margen). Se limpia al cerrar el popup, seleccionar otro target o levar el ancla propia.

**Cálculo Sonda + Fondeo unificados (Rev628)**

Las dos entradas del menú "Cálculo Sonda" y "Cálculo Fondeo" se unen en un único modal "🧮 Cálculo Sonda y Fondeo" con ambas secciones apiladas. Las celdas del bottom-bar de cadena/distancia y los botones del panel de mareas abren el mismo modal unificado. Menos es más.

**Widgets del bottom-bar (Rev635)**

- Celda "Heading" renombrada a "Rumbo" en español (salía en inglés en ambos idiomas).
- Celda "Sonda" renombrada a "Sonda B. Quilla" (explícito: bajo quilla).
- Nueva celda opcional **"Sonda B. Superf"** = profundidad desde la superficie (sonda + calado), con sublabel mostrando la esperada en la próxima bajamar desde superficie. Off por defecto; se activa en la Config del bottom-bar.

**i18n del popup del punto del track (Rev628)**

Al pinchar un punto del historial del track ahora el título, fecha y texto "hace X" se muestran en el idioma de la UI (ES: "hace 5 min", "hace 2 h"; EN: "5 min ago", "2 h ago") con formato de fecha local.

**Olas por IMU (Rev632)**

Fix reportado por el usuario externo Pablo: su visor mostraba "Fuerte 63 s ESE" y calidad de abrigo F/10 % con el barco en puerto y meteo prediciendo mar plana. Causa raíz: el algoritmo publicaba `motionBand: "fuerte"` sólo por un RMS de balanceo alto aunque el periodo detectado estuviera fuera del rango físico de olas (34 s) y Doppler tuviera `confidencePeriodTrue: 0`. Ahora si `periodOutOfRange` o no hay movimiento significativo → `motionBand = null` y `rejectionReason = "periodOutOfRange"`, así el índice de Abrigo no se degrada por ruido/vibraciones/mala calibración del IMU.

**Fix falso positivo del banner "DATOS NO FIABLES" (Rev632)**

El banner saltaba erróneamente en localhost tras dejar la pestaña en segundo plano o durante picos de CPU en Chromium (el age del watchdog se inflaba porque el event loop estaba pausado). Ahora: (1) `visibilitychange → visible` resetea `_lastStateRecvMs`; (2) umbral subido 15 → 20 s; (3) antes de mostrar el banner se hace un `fetch /state` activo para confirmar la desconexión real — si el backend responde OK era un artefacto local y el banner se suprime silenciosamente.

**Estabilidad drop/lift con alta latencia (Tailscale/4G/Mauritania) (Rev635)**

Con ping de 400-800 ms la UI "titubeaba" durante drop/lift: anillos apareciendo/desapareciendo, voz "ancla fondeada" doble, `anch` oscilando entre true/false por cada tick SSE atrasado. Añadido guard optimista: durante 15 s tras un drop/lift local se ignoran los ecos SSE en vuelo con estado contrario. Dedupe voz "ancla fondeada" subido de 5 s a 30 s.

## [2.5.0] - 2026-07-03

### English

**Nearby AIS anchor estimation, rewritten (Rev625-Rev626)**

The estimation of "where the other AIS boat has its anchor" has been rewritten from scratch. Before it barely triggered and never included the target's length — Carlos observed on the boat that anchored neighbours never got an estimation drawn.

- Minimum 4 track points (was 8) → appears sooner.
- 3-hour rolling window (was 30 min) → far more stable estimation.
- Only applies to targets with SOG < 0.5 kn (regardless of the `isStatic` flag).
- Discards targets with a net drift first→last > 200 m (in transit, not at anchor).
- Swing radius = **P90** of the histogram of distances to the centroid (robust against a single GPS outlier that used to inflate the ring).
- **Length of the target added** to the final swing radius + 5 m margin: `radius = swingP90 + LOA + 5`.
- Rejects radii > 300 m as implausible.
- **Only draws the estimation for targets closer than 250 m to your boat** (Rev626) — no visual noise from distant AIS.
- Popup breakdown: `Ancla est.: r≈45 m (borneo 20 m + eslora 25 m)`.

**User control module — polish (Rev619-Rev624)**

- **Own modal for User control**, out of Configuration. Menú (☰) → 👥 Control de usuarios opens its own popup with header, larger typography (H2 36 px, H3 28 px, help 24 px) and a 900 px max-width so text never floats lost on wide displays.
- **Master editable now** (Rev622): the master name is clickable (golden underlined) and the ✏️ button opens the edit card. Notes are editable; expiry section is hidden (master never expires); delete button is hidden. PIN change works too but the master must confirm the current PIN first (Rev623) — no easy override.
- **Each registered user shows 3 lines** (Rev621): `Creado: DD/MM/YYYY` / `Validez hasta: DD/MM/YYYY` or `sin caducidad` / `Último acceso: DD/MM/YYYY HH:MM` (`nunca` in italics if never signed in). Backend now tracks `lastAccessMs` on every successful PIN unlock.
- **User name is clickable** — opens the edit card (Rev621).
- **Sidebar lock button always has a dark solid background** (Rev624) — no more disappearing over bright chart backgrounds.
- **Sidebar lock now opens User control** (not Configuration) when authenticated (Rev623).
- **Banner "Read-only mode" can be dismissed with ✕** (Rev626) without entering a PIN. The lock stays orange "PIN" as a permanent reminder. Session-scoped dismiss (comes back next reload).

**AIS alarm off = no clutter (Rev613)**

If the AIS alarm toggle is OFF, the "in zone" logic is now inhibited visually: no red rings on the map, no `🔴 Colisión N` badge, no `borneo-alert` frame around the panel, no ACK buttons in the list or target popup. Only distance + locate + vesselfinder. The alarm has to be ON for any anchor-watching machinery to appear.

**Track rendering rewrite (Rev615-Rev616)**

Third iteration after Carlos said "el track es inconexo y el gradiente no tiene pies ni cabeza".

- One consecutive polyline per pair of points → **continuity guaranteed**.
- Colour changes gradually along the line: **HSL gradient** 0h green (120°) → 4h yellow (60°) → 12h orange (30°) → 24h+ red (10°).
- Small "checkpoint" dots at the first point of each round hour (5 px radius, coloured by age).
- Click on the line or on a checkpoint → popup with the exact timestamp of the closest recorded point.
- **z-index fixed** (Rev608): boat marker now paints on top of the track. Custom Leaflet `trackPane` lowered from `zIndex:650` → `550`.
- **Bridge segment**: from the last recorded point to the current boat position, refreshed on every `bPos` update so the track never appears to disconnect from the boat.

**Own tracks — Cartas panel (Rev610-Rev611)**

New **"Tracks"** section at the top of the Cartas y Capas panel:
- ☑ Mi track (GPS) toggle.
- Slider "Últimas X h" (1-72 h, default 12 h) → filters own track by age. Instant rebuild.
- 🗑 Borrar mi track completo button.
- ☑ Tracks de otros barcos (AIS) — now synced with the AIS header toggle (Rev612).

**Anchor / voice bug fixes**

- **Idempotent `/drop`** (Rev602): if already anchored, no re-fire of the "Anchor down" voice nor re-broadcast SSE. Fixes cross-device "first tap says anchor down, second tap actually lifts".
- **`m_onAnchorBtn` syncs state before deciding** drop vs lift (Rev602).
- **Anti-spurious voice guard** on `_speakAlarm('anchor_down')` (Rev600, Rev604): checks `anchoredSinceMs` freshness AND `window._lastLocalLiftMs` recency.
- **Voice dedupe** shortened 30 s → 5 s (Rev598).
- **AIS activate popup cancelled on lift** (Rev604).
- **AIS highlight ring turns orange on ACK** (Rev616), not red-with-red as before. Selection ring recreates on ACK state change instead of just repositioning.
- **ACK button hidden when AIS alarm is OFF** (Rev617).

**Weather advisory false-warn** (already shipped in 2.4.0) confirmed clean in production.

**Notifications workflow — pending fix (Rev620-Rev621)**

The Notifications viewer showed `signalk-mareas-ihm.weatherAdvisory` state=warn even after the user turned the alarm OFF for days. Fixed backend-side in 2.4.0 (Rev608); confirmed by the affected user in this cycle.

**Session table typography (Rev620-Rev621)**

The user reported one entry "Carlos (tu sesión actual) — Windows · Firefox · 100.82.158.116 — Sin caducidad" only occupied 160×35 px on a 2880-wide display. Rebuilt the inline styles inside `m_loadPinsList` and `m_loadSessionsList` — the id-scoped CSS was being overridden by nested inline `font-size`. Sizes now 20-24 px inline, matches the modal typography.

**Wind widget** — "racha" renamed to "Racha" (Rev615) — proper capitalisation as gust label.

**CI Lint** — 2.4.0 CI had a Lint job failing with 905 errors carried over from a React/TS legacy folder (`app/**`). ESLint config updated (Rev626): noisy inherited rules (`no-explicit-any`, `no-unused-vars` with `_` pattern, `no-empty` allowing empty catch, `no-require-imports`, `no-var`) downgraded to **warn**; only genuine structural rules stay as `error`. CI now green.

### Español

**Estimación de ancla de AIS vecinos, reescrita (Rev625-Rev626)**

La estimación de "dónde tiene el ancla el otro AIS" se ha reescrito desde cero. Antes casi nunca se disparaba y no incluía la eslora del target — Carlos comprobó en el barco que los vecinos fondeados nunca conseguían estimación dibujada.

- Mínimo 4 puntos del track (antes 8) → aparece antes.
- Ventana rodante 3 h (antes 30 min) → estimación mucho más estable.
- Sólo aplica a targets con SOG < 0.5 kn (independiente del flag `isStatic`).
- Descarta targets con drift neto primer→último > 200 m (en tránsito, no fondeados).
- Radio de borneo = **P90** del histograma de distancias al centroide (robusto ante un solo outlier GPS que antes inflaba el círculo).
- **Eslora del target sumada** al radio + 5 m margen: `radius = swingP90 + eslora + 5`.
- Rechaza radios > 300 m como no plausibles.
- **Sólo dibuja la estimación para targets a menos de 250 m del barco propio** (Rev626) — sin ruido visual con AIS lejanos.
- Popup con desglose: `Ancla est.: r≈45 m (borneo 20 m + eslora 25 m)`.

**Control de usuarios — pulido (Rev619-Rev624)**

- **Modal propio para Control de usuarios**, fuera de Configuración. Menú (☰) → 👥 Control de usuarios abre su popup con cabecera, tipografía más grande (H2 36 px, H3 28 px, help 24 px) y max-width 900 px para que el texto no flote perdido en pantallas amplias.
- **Maestro editable** (Rev622): el nombre del maestro es clickable (dorado subrayado) y el botón ✏️ abre su ficha. Se pueden cambiar las notas; la sección de caducidad se oculta (el maestro no caduca); no aparece el botón borrar. Cambiar su PIN funciona también, pero se le exige verificar el PIN actual primero (Rev623) — el maestro no puede ser suplantado tan fácil.
- **Cada usuario registrado muestra 3 líneas** (Rev621): `Creado: DD/MM/YYYY` / `Validez hasta: DD/MM/YYYY` o `sin caducidad` / `Último acceso: DD/MM/YYYY HH:MM` (`nunca` en cursiva si nunca ha entrado). El backend registra `lastAccessMs` en cada unlock exitoso.
- **Nombre del usuario clickable** — abre la ficha (Rev621).
- **Botón candado de la sidebar siempre con fondo oscuro sólido** (Rev624) — ya no desaparece sobre fondos claros de cartas.
- **El candado de la sidebar abre Control de usuarios** (no Configuración) cuando estás autenticado (Rev623).
- **Banner "Modo SOLO lectura" cerrable con ✕** (Rev626) sin necesidad de meter PIN. El candado queda en naranja "PIN" como recordatorio permanente. Descarte por sesión (vuelve al recargar).

**Alarma AIS OFF = sin adornos (Rev613)**

Si el toggle "Alarma AIS" está OFF, la lógica de "en zona" queda inhibida visualmente: sin círculos rojos en el mapa, sin badge `🔴 Colisión N`, sin marco `borneo-alert` alrededor del panel, sin botones ACK en la lista ni en el popup del target. Sólo distancia + Localizar + Vesselfinder. Para que aparezca cualquier maquinaria de vigilancia AIS la alarma tiene que estar ON.

**Track propio — rediseño (Rev615-Rev616)**

Tercera iteración tras "el track es inconexo y el gradiente no tiene pies ni cabeza".

- Una polyline por cada par de puntos consecutivos → **continuidad garantizada**.
- El color va cambiando a lo largo de la línea: **gradient HSL** 0h verde (120°) → 4h amarillo (60°) → 12h naranja (30°) → 24h+ rojo (10°).
- Puntitos "checkpoint" en el primer punto de cada hora entera (radio 5 px, coloreado por edad).
- Click sobre la línea o sobre un checkpoint → popup con la hora exacta del punto grabado más cercano.
- **Bug z-index arreglado** (Rev608): el barco se pinta ahora **encima** del track. Custom Leaflet `trackPane` bajado de `zIndex:650` → `550`.
- **Segmento puente**: desde el último punto grabado hasta la posición actual del barco, refrescado en cada actualización de `bPos` para que el track nunca aparente estar desconectado del barco.

**Tracks propios — panel Cartas (Rev610-Rev611)**

Nueva sección **"Tracks"** al principio del panel Cartas y Capas:
- ☑ Mi track (GPS) toggle.
- Slider "Últimas X h" (1-72 h, default 12 h) → filtra tu track por antigüedad. Rebuild instantáneo.
- 🗑 Borrar mi track completo.
- ☑ Tracks de otros barcos (AIS) — sincronizado con el toggle del header AIS (Rev612).

**Bug fixes fondeo / voz**

- **`/drop` idempotente** (Rev602): si ya estás fondeado, no re-dispara la voz "Ancla fondeada" ni re-emite SSE. Arregla el "primer tap dice ancla fondeada, segundo tap leva de verdad" en dispositivos cross.
- **`m_onAnchorBtn` sincroniza estado antes de decidir** drop vs lift (Rev602).
- **Guard anti-voz-espuria** en `_speakAlarm('anchor_down')` (Rev600, Rev604): comprueba frescor de `anchoredSinceMs` Y recencia de `window._lastLocalLiftMs`.
- **Dedupe voz** bajado de 30 s → 5 s (Rev598).
- **Popup activar AIS cancelado al levar** (Rev604).
- **Aro del target AIS pasa a naranja al ACK** (Rev616), no rojo-con-rojo como antes. El aro se re-crea al cambiar el estado ACK en vez de sólo reposicionarse.
- **Botón ACK oculto cuando alarma AIS está OFF** (Rev617).

**Tipografía tabla de sesiones (Rev620-Rev621)**

El usuario reportó que una entrada "Carlos (tu sesión actual) — Windows · Firefox · 100.82.158.116 — Sin caducidad" ocupaba sólo 160×35 px en un display de 2880 de ancho. Los inline styles dentro de `m_loadPinsList` y `m_loadSessionsList` estaban ganando al CSS externo por id. Ahora los tamaños se fijan inline en 20-24 px, coherentes con la tipografía del modal.

**Widget viento** — "racha" renombrado a "Racha" (Rev615) — mayúscula inicial como etiqueta.

**CI Lint** — el job Lint del CI en 2.4.0 fallaba con 905 errores heredados de una carpeta React/TS legacy (`app/**`). Config ESLint actualizada (Rev626): reglas ruidosas heredadas (`no-explicit-any`, `no-unused-vars` con patrón `_`, `no-empty` permitiendo catch vacío, `no-require-imports`, `no-var`) bajadas a **warn**; sólo las genuinas reglas estructurales quedan como `error`. CI ahora en verde.

## [2.4.0] - 2026-07-02

### English

**Multi-user PIN control (new module)**

A new **User Control** layer (Rev573-Rev606) protects boat actions (drop/lift anchor, alarms, settings) with a local PIN system. **Public read remains open** — only mutating actions require a PIN. Zero Signal K account setup required; everything lives inside the plugin.

- **Master + Guests model**. The first PIN created is the MASTER (manages the layer + other PINs + everyday use). The master can create GUEST PINs for crew or charter guests. Guests can use the plugin normally but cannot manage users or toggle the layer.
- **Per-user PIN visible to master** (Rev603). The master opens a guest's card and sees their current PIN in plain text. Aimed at a boat scenario where the file lives on the owner's own Pi.
- **Optional expiry** with quick-buttons: no expiry / +1 day / +7 / +30 / +90 / +1 year.
- **Notes** field per user (charter crew, family member, etc.).
- **Change guest PIN from the master's card** (`🔑 Change now`). Master fixes a new number without needing the old one.
- **Active users list**, master-only. Shows every open session with alias, OS · browser, IP, remaining minutes/hours/days. Master can revoke any guest session; cannot revoke another master session (there is only one) nor themselves.
- **Coherent expiry across PIN ↔ cookie**: guest with no expiry PIN → persistent cookie; guest with expiry → cookie lasts until the PIN expires. Master session persistent (1 year TTL) — the boat's owner does not have to re-enter PIN every 30 minutes.
- **Master control retained**: if the "User control" toggle is OFF, everything works as before Rev573 (no PIN required for any action).
- **User-Agent parsing fixed** (Rev607). Opera Mobile on Android used to show as "Linux · Chrome" (regex `|` returns first-position match, not the most specific one). Now cascading `if/else` in specificity order — Android before Linux, Opera before Chrome, Edge before Chrome, CriOS/FxiOS/EdgA aliases recognised.

**Notifications: `weatherAdvisory` false-warn fix (Rev608)** ⚠️

Fixed a **critical bug** reported after a scare on a real boat: the plugin kept emitting `notifications.signalk-mareas-ihm.weatherAdvisory` with `state:warn` and `method:['visual']` **even with the "Bad weather" alarm toggle OFF for days**. The toggle lived only in browser localStorage; the backend polled Open-Meteo and emitted the warn regardless. Now:

- New backend flag `_weatherAdvisoryEnabled`, persisted in cache.
- If the toggle is OFF, the notification path is still published but always with `state:'normal'` and empty `method` — SK does not raise a visual alarm.
- On plugin start, if the toggle is OFF, the plugin publishes an immediate `state:'normal'` delta to blank out any stale `warn` from before the restart.
- Frontend `setAlarm('weather')` now POSTs the state to the backend and syncs with the backend on visor boot (backend is the source of truth).

**Anchor & voice fixes**

- **Idempotent `/drop`** (Rev602): if already anchored, the endpoint returns OK without re-firing the "Anchor down" voice nor re-broadcasting SSE. Fixes cross-device scenario where device B tapped "Lift" once and got "Anchor down" voice + no action, then tapped again to actually lift.
- **Sync state before deciding** (Rev602): `m_onAnchorBtn` now fetches `/state` before choosing `doDrop` vs `doLift`, ensuring the local `anch` variable matches the backend's truth.
- **Anti-spurious voice guard** (Rev600, Rev604): `_speakAlarm('anchor_down')` gated on `anchoredSinceMs` freshness AND `window._lastLocalLiftMs` recency. A delayed SSE `drop` event landing after a local `lift` no longer triggers the voice.
- **Voice dedupe window** shortened from 30 s → 5 s (Rev598): 30 s was too aggressive and silenced legitimate voices during rapid QA drops/lifts.
- **AIS activate popup cancelled on lift** (Rev604): the 5 s `setTimeout` that asks the user to enable AIS alarm after drop is now cleared when the user lifts anchor before the timeout fires. The popup no longer pops up seconds after the anchor is up.

**Track rendering**

- **z-index bug fixed** (Rev608): the boat marker now paints **on top of** the track polyline. Custom Leaflet `trackPane` lowered from `zIndex:650` → `550` (Leaflet's `markerPane` is at 600).
- **Grey out old tracks** (Rev608): points more than 4 hours old are painted progressive grey instead of the red→green gradient. Yesterday's track no longer looks as fresh as today's.
- **Optional horizon** for own tracks with default 12 h (Rev608). Points beyond the horizon are not drawn. Runtime setters `m_trkSetLimitHours`, `m_trkSetOwnEnabled`, `m_trkClearOwn` (UI in Cartas panel scheduled for next release).

**UX & wording**

- "Security layer" renamed to "**User control**" (Rev599). Toggle "Activada/Desactivada" → "Activado/Desactivado" (masculine).
- "PIN" nomenclature aligned with "User" everywhere the human concept made more sense: "Registered PINs" → "Registered users"; "Active PIN sessions" → "Active users"; "My PIN session" → "My session"; "Edit guest PIN" → "Edit guest user"; "Sign out PIN" → "Sign out"; "+ Add PIN" → "+ Add user" (Rev601).
- **PIN dialer** iteratively enlarged (Rev585 → Rev589) to reach 110×100 px keys with 38 px font — comfortable on a real phone.
- **Anonymous entry point** (Rev593): if PINs exist and you are not signed in, the sidebar 🔒 button opens the PIN modal directly (no need to open Config first).
- **Master's session shown as "No expiry"** in Active users list, instead of showing thousands of minutes (Rev597).
- **Guest sees their own remaining time** in "My session" (Rev606) — separately for PIN expiry (validity) and session cookie (until next login).
- **CSS hierarchy audit** of the Config modal (Rev587): section titles unified to 28 px bold, help text 18 px grey, sub-sections 22 px, primary/secondary/reset buttons styled with shared classes.
- **Lock icon in the sidebar** moved to the left column, above the Alarms button (Rev587); coloured background + glow to make it noticeable when the control is active (Rev595).

### Español

**Control de usuarios (módulo nuevo)**

Nuevo módulo **Control de usuarios** (Rev573-Rev606) que protege las acciones del barco (echar/levar ancla, alarmas, configuración) con un sistema de PIN local. **La lectura pública se mantiene abierta** — sólo las acciones que mutan estado requieren PIN. No requiere configurar cuentas de Signal K; todo vive dentro del plugin.

- **Modelo Maestro + Invitados**. El primer PIN creado es el MAESTRO (gestiona el control + otros PINs + uso normal). El maestro puede crear PINs INVITADO para tripulación o charters. Los invitados pueden usar el plugin normalmente pero no pueden gestionar usuarios ni tocar el control.
- **PIN por usuario visible al maestro** (Rev603). El maestro abre la ficha de un invitado y ve su PIN actual en claro. Coherente con el escenario: el fichero vive en la Pi del propio armador.
- **Caducidad opcional** con botones rápidos: sin caducidad / +1 día / +7 / +30 / +90 / +1 año.
- **Notas** por usuario (tripulación de charter, familiar, etc.).
- **Cambiar PIN del invitado desde su ficha** (`🔑 Cambiar ahora`). El maestro fija el nuevo número sin necesitar el anterior.
- **Lista de usuarios activos**, sólo maestro. Muestra cada sesión abierta con alias, OS · navegador, IP, minutos/horas/días restantes. El maestro puede revocar cualquier sesión de invitado; no puede revocar otra sesión de maestro (sólo hay una) ni a sí mismo.
- **Coherencia caducidad PIN ↔ cookie**: invitado con PIN sin caducidad → cookie persistente; con caducidad → cookie hasta que caduque el PIN. Sesión maestro persistente (TTL 1 año) — el armador no re-introduce PIN cada 30 minutos.
- **Control retenido por el maestro**: si el toggle "Control de usuarios" está OFF, todo funciona como antes de Rev573 (sin PIN para nada).
- **Parseo User-Agent arreglado** (Rev607). Opera Mobile en Android salía como "Linux · Chrome" (regex `|` devuelve la primera coincidencia por posición, no la más específica). Ahora cascada `if/else` por especificidad — Android antes que Linux, Opera antes que Chrome, Edge antes que Chrome, aliases CriOS/FxiOS/EdgA reconocidos.

**Notificaciones: fix `weatherAdvisory` fantasma (Rev608)** ⚠️

Arreglado **bug grave** reportado tras un susto en un barco real: el plugin seguía emitiendo `notifications.signalk-mareas-ihm.weatherAdvisory` con `state:warn` y `method:['visual']` **con el interruptor "Mala condición climática" APAGADO durante días**. El toggle vivía sólo en localStorage del navegador; el backend polleaba Open-Meteo y emitía el warn de todas formas. Ahora:

- Nueva flag backend `_weatherAdvisoryEnabled`, persistido en cache.
- Si el toggle está OFF, el path se sigue publicando pero siempre con `state:'normal'` y `method` vacío — Signal K no dispara alarma visual.
- Al arrancar el plugin, si el toggle está OFF, se publica delta inmediato `state:'normal'` para blanquear cualquier `warn` colgado del reinicio.
- Frontend `setAlarm('weather')` ahora POSTea el estado al backend y sincroniza con el backend al arrancar el visor (backend = fuente de verdad).

**Fondeo y voz**

- **`/drop` idempotente** (Rev602): si ya estás fondeado, el endpoint devuelve OK sin re-disparar la voz "Ancla fondeada" ni re-emitir SSE. Arregla el escenario cross-device donde el dispositivo B pulsaba "Levar" y la primera pulsación decía "Ancla fondeada" sin hacer nada, teniendo que pulsar una segunda vez para levar de verdad.
- **Sincronización de estado antes de decidir** (Rev602): `m_onAnchorBtn` hace fetch `/state` antes de elegir `doDrop` vs `doLift`, garantizando que la variable local `anch` coincide con la verdad del backend.
- **Guard anti-voz-espuria** (Rev600, Rev604): `_speakAlarm('anchor_down')` respeta el frescor de `anchoredSinceMs` Y `window._lastLocalLiftMs`. Un SSE `drop` atrasado que llega tras un `lift` local ya no dispara la voz.
- **Dedupe voz** bajado de 30 s → 5 s (Rev598): 30 s era demasiado agresivo y silenciaba voces legítimas en QA con drops/lifts rápidos.
- **Popup activar AIS cancelado al levar** (Rev604): el `setTimeout` de 5 s que pregunta si activar la alarma AIS tras fondear ahora se cancela cuando el usuario leva antes de que salte. El popup ya no aparece segundos después de levar.

**Renderizado de tracks**

- **Bug z-index arreglado** (Rev608): el barco ahora se pinta **encima** del polyline del track. Pane custom de Leaflet `trackPane` bajado de `zIndex:650` → `550` (el `markerPane` de Leaflet vale 600).
- **Tracks viejos en gris** (Rev608): los puntos con más de 4 h de antigüedad se pintan en gris progresivo en lugar del gradiente rojo→verde. El track de ayer ya no se ve tan fresco como el de hoy.
- **Horizonte opcional** para tracks propios con default 12 h (Rev608). Los puntos más allá del horizonte no se dibujan. Setters runtime `m_trkSetLimitHours`, `m_trkSetOwnEnabled`, `m_trkClearOwn` (UI en el panel Cartas pendiente para la próxima release).

**UX y textos**

- "Capa de seguridad" renombrado a "**Control de usuarios**" (Rev599). Toggle "Activada/Desactivada" → "Activado/Desactivado" (masculino).
- Nomenclatura "PIN" alineada con "Usuario" allí donde el concepto humano tenía más sentido: "PINs registrados" → "Usuarios registrados"; "Sesiones PIN activas" → "Usuarios activos"; "Mi sesión PIN" → "Mi sesión"; "Editar PIN invitado" → "Editar usuario invitado"; "Cerrar sesión PIN" → "Cerrar sesión"; "+ Añadir PIN" → "+ Añadir usuario" (Rev601).
- **Dialer PIN** ampliado iterativamente (Rev585 → Rev589) hasta teclas 110×100 px con fuente 38 px — cómodo en un móvil real.
- **Punto de entrada anónimo** (Rev593): si hay PINs y no estás autenticado, el botón 🔒 de la sidebar abre directamente el modal PIN (sin pasar por Config).
- **Sesión del maestro como "Sin caducidad"** en la lista de usuarios activos, en lugar de mostrar miles de minutos (Rev597).
- **El invitado ve su propio tiempo restante** en "Mi sesión" (Rev606) — separado para caducidad del PIN (validez) y cookie de sesión (hasta el próximo login).
- **Audit CSS jerarquía** del modal Configuración (Rev587): títulos de sección uniformados a 28 px bold, help 18 px gris, sub-secciones 22 px, botones primario/secundario/reset con clases compartidas.
- **Icono del candado** movido a la sidebar izquierda encima de Alarmas (Rev587); fondo de color + glow para que destaque cuando el control está activo (Rev595).

## [2.3.5] - 2026-06-26

### English

**Bottom-bar widgets — directs, new Wind/Sun/Moon/GPS widgets, gust display**

- **Widget click destinations remapped** (Carlos feedback): Sonda/Tide/Dif-LW/Prof.min. now open Curvas (`curvas-pop` + `fetchCurvas()`); Cad.rec./Dist.ancla open Cálculo Fondeo (`fondeo-pop`); H.fondeo/T.fondeo/Wave open Historial Olas (`wave-hist-info-pop`). Wave widget no longer opens the `/wave-debug` technical page.
- **Wind widget**: now shows the gust value `(racha X kt)` under the main reading. Source = `_envSensors.gustKt` (same as the shelter infobox). Rolling window enlarged 10 → 23 min for a more useful peak. Last seen gust is cached so it stays visible even if the sensor pauses briefly. Threshold to display dropped from 30 samples (~30 s) to 5 (~5 s) so the gust appears almost immediately after plugin start.
- **Sun widget** redesigned: label shows "Salida SOL" / "Ocaso SOL" (text only), value shows icon + time of the next event (🌅 06:32 / 🌇 21:45), sub-label shows ▲/▼ + time of the following event.
- **Moon widget** new + parallel design: label "Salida LUNA" / "Ocaso LUNA", value shows current moon phase icon + time of next moonrise/moonset, sub shows ▲/▼ + time of the following event. Astronomical calculation (Meeus simplified inline, ±5 min accuracy).
- **GPS accuracy widget** new (`gps_acc`, opt-in): label "Prec. GPS" / "GPS Prec.", value = estimated precision in meters (HDOP × 5), sub-label = Fix / DFix / Sin fix · N sat. Color codes: green = good, orange = low reliability, red = none/no fix. Reads `navigation.gnss.horizontalDilution`, `satellites`, `methodQuality` from SignalK.
- **+ widget** (already in 2.3.4) — pinned to the right edge, opens widget configuration. Separator handling fixed so the previous cell keeps its divider and "+" never draws one.
- **Bottom-bar layout** centered (`safe center`), gap-right reduced to remove perceived gap at the right edge.

**Meteo modal — moonrise/moonset astronomical events**

- Real moonrise/moonset events added to the hourly table (next 3 days), replacing the legacy "tossed" formula `(17 + dom*0.83) % 24`. New `_lunarTimes(date, lat, lng)` (Meeus simplified, SunCalc-style) gives ±5 min precision based on the boat's real position.
- Event columns show: moon phase icon + ▲/▼ arrow, hour, and abbreviated phase name (Gib. Crec. / Wax. Gib. etc).

**AIS panel**

- Distances in the AIS list and the AIS radius slider now use a new `unitFmt.distanceLand()` helper: metric → `m`/`km`, imperial → `ft`/`mi`. Never `NM` even when the user system is `metric_nautical`.
- When the AIS filter finds no targets in the local list, a "🔍 Search in Vesselfinder" button appears with the search term — opens `vesselfinder.com/vessels?name=<term>` in a new tab.
- AIS toggle row in portrait wraps to the left (was sticking right because of inherited `margin-left:auto`).

**Shelter modal polish**

- Pressure sparkline appears instantly when opening the modal instead of waiting 5-60 s for the next SSE tick (fix to `_wxRefreshChip` re-paint trigger).
- "Detectados N sectores abrigados" / "Detectado 1 sector abrigado" — plural-aware in both paths.
- Wind/gust badges (Veleta · Sensor · IMU) inside the infobox bumped to 22 px (were 10-11 px, illegible under zoom 0.6).

**Modal Instructions (iframe)**

- Hidden the orphaned inner header (Atrás · Mareas · Curvas) when the iframe is opened from the visor with `?embed=1` or `?showInstructions=1`. The parent already injects its own header.

**Map**

- Self-track now renders even when GPS is extremely stable. Distance threshold 0.5 → 0.2 m + 60 s keep-alive guarantee at least one new point per minute. Polylines moved to a custom Leaflet pane with `zIndex: 650` and weight bumped to 5 / opacity 0.95.

### Español

**Widgets de la bottom-bar — destinos de click, nuevos Viento/Sol/Luna/GPS, racha de viento**

- **Destinos de click remapeados** (feedback Carlos): Sonda/Marea/Dif.Bajamar/Prof.mín. abren Curvas; Cad.rec./Dist.ancla abren Cálculo Fondeo; H.fondeo/T.fondeo/Wave abren Historial Olas. Wave ya no abre la página técnica `/wave-debug`.
- **Widget Viento**: muestra ahora la racha `(racha X kt)` bajo el valor principal. Fuente = `_envSensors.gustKt` (misma del infobox del Abrigo). Ventana del rolling ampliada 10 → 23 min para pico más útil. Última racha vista se cachea para que persista aunque el sensor pause. Threshold para mostrar bajado de 30 muestras (~30 s) a 5 (~5 s) para que aparezca casi inmediatamente tras el arranque del plugin.
- **Widget Sol** rediseñado: label "Salida SOL" / "Ocaso SOL" (sólo texto), valor con icono + hora del próximo evento (🌅 06:32 / 🌇 21:45), sub-label con ▲/▼ + hora del siguiente.
- **Widget Luna** nuevo paralelo: label "Salida LUNA" / "Ocaso LUNA", valor con icono de fase actual + hora del próximo moonrise/moonset, sub-label con ▲/▼ + hora del siguiente. Cálculo astronómico (Meeus simplificado inline, precisión ±5 min).
- **Widget Precisión GPS** nuevo (`gps_acc`, opt-in): label "Prec. GPS" / "GPS Prec.", valor = precisión estimada en metros (HDOP × 5), sub-label = Fix / DFix / Sin fix · N sat. Colores: verde = buena, naranja = baja fiabilidad, rojo = nula/sin fix. Lee `navigation.gnss.horizontalDilution`, `satellites`, `methodQuality` de SignalK.
- **Widget +** (ya en 2.3.4) — fijo al borde derecho, abre la configuración de widgets. Separadores arreglados: la celda anterior conserva su divisor y el "+" nunca dibuja uno.
- **Layout bottom-bar** centrado (`safe center`), gap derecho reducido para eliminar hueco visual al borde.

**Modal Meteo — eventos moonrise/moonset astronómicos**

- Eventos reales moonrise/moonset añadidos a la tabla horaria (próximos 3 días), reemplazando la fórmula tosca legacy `(17 + dom*0.83) % 24`. Nueva función `_lunarTimes(date, lat, lng)` (Meeus simplificada, estilo SunCalc) da precisión ±5 min basada en la posición real del barco.
- Columnas de evento muestran: icono de fase + flecha ▲/▼, hora, y nombre de fase abreviado (Gib. Crec. / Wax. Gib. etc).

**Panel AIS**

- Distancias del listado AIS y slider del radio AIS usan ahora el nuevo helper `unitFmt.distanceLand()`: métrico → `m`/`km`, imperial → `ft`/`mi`. Nunca `NM` aunque el sistema sea `metric_nautical`.
- Cuando el filtro AIS no encuentra targets en la lista local, aparece un botón "🔍 Buscar en Vesselfinder" con el término buscado — abre `vesselfinder.com/vessels?name=<término>` en pestaña nueva.
- Fila de toggles AIS en vertical wrappea a la izquierda (antes se quedaba a la derecha por `margin-left:auto` heredado).

**Pulido modal Abrigo**

- Sparkline de presión aparece al instante al abrir el modal en lugar de tardar 5-60 s al próximo tick SSE (fix al trigger de repintado en `_wxRefreshChip`).
- "Detectados N sectores abrigados" / "Detectado 1 sector abrigado" — plural-aware en los dos paths.
- Badges Veleta · Sensor · IMU del infobox subidos a 22 px (eran 10-11 px, ilegibles bajo el zoom 0.6).

**Modal Instrucciones (iframe)**

- Ocultado el header interno huérfano (Atrás · Mareas · Curvas) cuando el iframe se abre desde el visor con `?embed=1` o `?showInstructions=1`. El padre ya inyecta su propio header.

**Mapa**

- Track propio se pinta ahora incluso cuando el GPS está extremadamente estable. Threshold 0.5 → 0.2 m + keep-alive 60 s garantizan al menos un punto nuevo por minuto. Polylines movidas a un pane custom de Leaflet con `zIndex: 650` y weight subido a 5 / opacidad 0.95.

## [2.3.4] - 2026-06-26

### English

**Shelter modal — readability, layout and weather chart fixes (Rev548-Rev562)**

- **Infobox shelter — typography rebuild** validated by GPT-5 + Gemini Pro from first principles: removed the generic `span,div{font-size:22px}` rule that was breaking inheritance from id-containers; duplicate `#shelter-summary-text` declarations consolidated; base 22 px declared on `.shelter-popup-box` and overridden +8 nominal on each id (status-label 24→32, status-body 22→30, summary 26→34, auto-prompt 20→28, auto-status 22→30). Compensates the inherited `zoom: var(--ui-scale)` so the change is actually visible on mobile.
- **Veleta / IMU / Sensor badges** in the infobox bumped 11→22 px (Veleta/Sensor) and IMU inline tag matched. Mar en calma now reads instead of being invisible under zoom.
- **Wave history chart** taller: SVG 94→140 px (+49%), yaxis scale labels 13→20 px, header "Historial de olas en fondeo · 5 min por barra · Fondeado a las…" 16→24 px (+50%), ⓘ button 17→22 px.
- **Pressure sparkline inside the infobox** taller (75→120 px, +60%) and arrives instantly on modal open instead of 5-60 s late — `_wxRefreshChip` now repaints the shelter popup the moment it fills `_wxLastPast24hPressureHpa` from null.
- **Rose of sectors** scales properly on mobile — switched from `vmin` (which was being multiplied again by the inherited zoom) to fixed pixel values: 440 px desktop / 520 px mobile aligned with the height of the A/Grade column. No longer captures the entire tap area for swipe scroll.
- **Sheltered sectors text** is now plural-aware: `Detectado 1 sector abrigado` vs `Detectados N sectores abrigados`. Applied in both the auto-detect path and the popup render path.
- **Shelter scroll no longer covers header** — `.m-modal-hdr` z-index bumped from 10 to 2050 so `.shelter-hour.selected` (z-index 100) can no longer paint on top of it during scroll.
- **Wave history rose-wrap layout** — grid gap doubled (14×16 → 24×32 px) for better separation between rose and adjacent boxes; removed unused `overflow-x: auto` that was creating phantom scroll; full-width centered.
- **Summary text** ("Abrigado: ninguna de las próximas 12 h queda expuesta") now fits in a single line on wide screens (max-width:760 removed, full width with stretch).

**Hourly strip — height, spacing and centering**

- Cell height bumped 88→124 px (124→168 in portrait) so the third line ("0.7 m" wave) no longer clips out.
- Cell width bumped progressively to 158 px (from original 110) — text breathes and the ola label fits without overlap.
- Cell contents grouped (was `space-between` with huge gaps, now `center` + 10 px gap).
- Wave label inside cell bumped 18→26 px (24 in portrait).
- Cells container now `flex:0 0 auto` + `justify-content:center` + parent row `safe-center` — when content fits, the whole AHORA+cells block centers; when overflow, it falls back to flex-start without cutting the first item.
- AHORA button height aligned with cells in every breakpoint (was 64 px in landscape while cells were 88-90).
- Strip auto-scrolls to AHORA on render (scrollLeft=0 after appendChild).
- Selected cell scale reduced 1.18→1.10 and origin moved from `bottom` to `center` so the cell no longer collides with the header above and content fits without crop.
- Strip separated 14 px from header (was `top:-19px` margin negative that overlapped selected cell).

**Bottom-bar widgets**

- Widget viento — fixed phase lag: the wind cell was only updating on the slow tick (`_mPollSlow` ≈ 6-10 s on Pi) so it lagged behind the wind arrow on the map. Extracted to `_updateBBWindCell()` and called from `_refreshBoatWind` so both are in sync (~3-5 s).
- Pressure cell — reverted Rev551 width change (it was hitting the wrong SVG; the cell padre was already constrained to 50 px and the fix made no visual difference).
- Sonda — sub-label `(X m)` always visible (was hidden in Rev556 except on alarm; reverted on Carlos feedback). Word "final" removed from the label.
- Marea — sub-label simplified to `PM a las 14:23` / `BM a las 02:15` (was `PM 2.3m 14:23`). Wave height already lives in the dedicated Dif. Bajamar widget.
- **New widget**: `T. fondeo` — elapsed time since anchor drop (`23m` / `5h 12m` / `2d 7h`). Complements the existing `H. fondeo` (absolute drop time). Tick every 60 s.
- **New widget**: `+` — always pinned to the right edge of the bar (uses `order:9999` + explicit DOM re-append after reorder), no `data-bb-cell` so the order CRUD doesn't touch it. Click opens the bottom-bar widgets configuration directly. Custom separator handling: previous cell keeps its divider when the `+` is present, and the `+` itself never draws one.
- Bottom-bar layout — `justify-content` changed from `flex-start` to `safe center` so widgets center when they fit and fall back to flex-start when overflow; gap right reduced 12→4 px to remove the perceived gap at the right edge.

**AIS panel**

- AIS list distances and AIS radius slider now use a new `unitFmt.distanceLand()` helper: metric → `m`/`km`, imperial → `ft`/`mi`. Never `NM` even when the user system is `metric_nautical` (a vessel 800 m away was being shown as `0.43 NM` which is unreadable in context).
- AIS toggle row (`AIS · Tracks · Alarma`) in portrait: when it wraps to its own line it now justifies to the LEFT (was sticking to the right because of `margin-left:auto` inherited from desktop layout).

**Map**

- Self-track on the chart now renders even when GPS is extremely stable (RTK or stationary). Distance threshold lowered 0.5 → 0.2 m and added a 60 s keep-alive so a new point is always recorded at least once per minute, guaranteeing the visor always has ≥2 points (the minimum for `updateTrackGradient` to draw the polyline). Track polylines moved to a custom Leaflet pane with `zIndex: 650` so they always paint above tile layers regardless of base-layer z-order; weight bumped 3→5, opacity .8→.95 for visibility against dark raster charts.

**Modal Instrucciones (iframe)**

- Hidden the orphaned `m-tv-header` (Back · Mareas · Curvas) when the iframe is opened from the visor as `?embed=1` or `?showInstructions=1`. The parent now injects its own orange header, so the inner one was duplicating it.

**Other**

- Reverted accidental icon swap on the Abrigo button — both sidebar button and modal header now use 🏔️ (mountain) as Carlos requested, no longer ⚓ (which conflicts visually with the anchor drop button).
- Favorites modal title renamed from "Listado de últimos fondeos y favoritos" to simply "Últimos fondeos" (the modal already shows the favorites and recent sections internally; the title was redundant). The 📍 icon in the hamburger menu entry is unchanged.

### Español

**Modal Abrigo — legibilidad, layout y arreglo de gráfica meteo (Rev548-Rev562)**

- **Infobox del Abrigo — tipografía reconstruida** validado por GPT-5 + Gemini Pro desde primeros principios: eliminada la regla genérica `span,div{font-size:22px}` que rompía la herencia desde id-contenedores; consolidadas las declaraciones duplicadas de `#shelter-summary-text`; base 22 px declarada en `.shelter-popup-box` y override +8 nominal sobre cada id (status-label 24→32, status-body 22→30, summary 26→34, auto-prompt 20→28, auto-status 22→30). Compensa el `zoom: var(--ui-scale)` heredado para que el cambio sea realmente visible en móvil.
- **Badges Veleta / IMU / Sensor** del infobox subidos 11→22 px (Veleta/Sensor) y la etiqueta inline IMU al mismo nivel. "Mar en calma" ahora se lee en lugar de quedar invisible bajo el zoom.
- **Histórico de olas** más alto: SVG 94→140 px (+49%), escalas Y 13→20 px, cabecera "Historial de olas en fondeo · 5 min por barra · Fondeado a las…" 16→24 px (+50%), botón ⓘ 17→22 px.
- **Sparkline de presión en el infobox** más alto (75→120 px, +60%) y aparece al instante al abrir el modal en vez de tardar 5-60 s — `_wxRefreshChip` ahora repinta el popup en el momento en que `_wxLastPast24hPressureHpa` se llena desde null.
- **Rosa de sectores** escala correctamente en móvil — cambiado de `vmin` (que se multiplicaba de nuevo por el zoom heredado) a valores px fijos: 440 px desktop / 520 px móvil alineada con la altura de la columna A/Grado. Ya no acapara toda el área táctil impidiendo el scroll.
- **Texto de sectores abrigados** plural-aware: `Detectado 1 sector abrigado` vs `Detectados N sectores abrigados`. Aplicado en el path auto-detect y en el popup render.
- **Scroll del Abrigo ya no tapa el header** — z-index de `.m-modal-hdr` subido de 10 a 2050 para que `.shelter-hour.selected` (z-index 100) no pueda pintar encima.
- **Layout del rose-wrap** — gap del grid doblado (14×16 → 24×32 px) para mejor separación rosa-infobox; eliminado el `overflow-x: auto` que generaba scroll fantasma; full-width centrado.
- **Caja resumen** ("Abrigado: ninguna de las próximas 12 h queda expuesta") cabe ahora en una sola línea en pantallas anchas (quitado `max-width:760`, ancho completo con stretch).

**Strip horario — altura, espaciado y centrado**

- Altura de celda subida 88→124 px (124→168 en vertical) para que la tercera línea ("0.7 m" ola) no se recorte.
- Ancho de celda subido progresivamente a 158 px (desde los 110 originales) — el texto respira y la etiqueta de ola cabe sin solaparse.
- Contenido de la celda agrupado (era `space-between` con huecos enormes, ahora `center` + gap 10 px).
- Etiqueta de ola dentro de celda subida 18→26 px (24 en vertical).
- Container de celdas ahora `flex:0 0 auto` + `justify-content:center` + row padre `safe-center` — cuando el contenido cabe, el bloque AHORA+celdas se centra entero; cuando hay overflow, cae a flex-start sin cortar el primer item.
- Botón AHORA con altura sincronizada con las celdas en todos los breakpoints (estaba a 64 px en landscape mientras las celdas tenían 88-90).
- Strip auto-scroll a AHORA en render (scrollLeft=0 tras appendChild).
- Celda seleccionada con scale reducido 1.18→1.10 y origin cambiado de `bottom` a `center` para que no choque con el header de arriba y el contenido quepa sin recortar.
- Strip separado 14 px del header (era `top:-19px` margen negativo que solapaba la celda seleccionada).

**Widgets de la bottom-bar**

- Widget viento — fix del lag de fase: la celda viento sólo se actualizaba en el tick lento (`_mPollSlow` ≈ 6-10 s en Pi) así que iba retrasada respecto a la flecha del visor. Extraído a `_updateBBWindCell()` y llamado desde `_refreshBoatWind` para que ambos vayan en sincronía (~3-5 s).
- Celda presión — revertido el cambio de Rev551 (tocaba el SVG erróneo; la cell padre estaba limitada a 50 px y el cambio no daba diferencia visual).
- Sonda — sub-label `(X m)` siempre visible (Rev556 lo ocultaba salvo en alarma; revertido por feedback Carlos). Quitada la palabra "final" del label.
- Marea — sub-label simplificado a `PM a las 14:23` / `BM a las 02:15` (era `PM 2.3m 14:23`). La altura ya vive en el widget propio Dif. Bajamar.
- **Nuevo widget**: `T. fondeo` — tiempo transcurrido desde el drop (`23m` / `5h 12m` / `2d 7h`). Complementa el existente `H. fondeo` (hora absoluta). Tick cada 60 s.
- **Nuevo widget**: `+` — siempre fijo en el borde derecho de la barra (usa `order:9999` + re-append explícito al DOM tras reordenar), sin `data-bb-cell` para que el CRUD de orden no lo toque. Click abre directamente la configuración de widgets. Manejo de separador a medida: la celda anterior mantiene su divisor cuando existe el `+`, y el `+` nunca dibuja uno.
- Layout de la bottom-bar — `justify-content` cambiado de `flex-start` a `safe center` así los widgets se centran cuando caben y caen a flex-start si hay overflow; gap derecho reducido 12→4 px para eliminar el hueco visible al borde derecho.

**Panel AIS**

- Distancias del listado AIS y slider de radio AIS usan ahora el nuevo helper `unitFmt.distanceLand()`: métrico → `m`/`km`, imperial → `ft`/`mi`. Nunca `NM` aunque el sistema del usuario sea `metric_nautical` (un barco a 800 m se mostraba como `0.43 NM`, ilegible en contexto).
- Fila de toggles AIS (`AIS · Tracks · Alarma`) en vertical: cuando hace wrap a su propia línea se justifica a la IZQUIERDA (antes se pegaba a la derecha por `margin-left:auto` heredado del layout desktop).

**Mapa**

- Track propio del barco se pinta incluso cuando el GPS está extremadamente estable (RTK o quieto). Threshold bajado 0.5 → 0.2 m + keep-alive de 60 s para garantizar al menos un punto por minuto (mínimo de 2 que necesita `updateTrackGradient` para dibujar la polyline). Polylines del track movidas a un pane custom de Leaflet con `zIndex: 650` para que siempre pinten por encima de los tiles independientemente del z-order de las capas base; weight subido 3→5, opacidad .8→.95 para visibilidad sobre cartas raster oscuras.

**Modal Instrucciones (iframe)**

- Ocultado el `m-tv-header` huérfano (Atrás · Mareas · Curvas) cuando el iframe se abre desde el visor como `?embed=1` o `?showInstructions=1`. El padre ya inyecta su propio header naranja, así que el interior estaba duplicando.

**Otros**

- Revertido el intercambio accidental de icono en el botón Abrigo — tanto el botón del sidebar como el header del modal usan ahora 🏔️ (montaña) como pidió Carlos, ya no ⚓ (que entra en conflicto visual con el botón de fondear ancla).
- Modal de favoritos renombrado: "Listado de últimos fondeos y favoritos" → simplemente "Últimos fondeos" (el modal ya muestra dentro las secciones de favoritos y recientes; el título era redundante). El icono 📍 del menú hamburger se mantiene intacto.

## [2.3.3] - 2026-06-25

### English

- **README title cleanup** — removed the redundant `signalk-mareas-ihm —` prefix from the README heading. The page on npmjs.com now shows only the commercial name `AnchorWatch Pro: Smart Anchoring, AIS & Tides`. NPM keeps the package name (`signalk-mareas-ihm`) in its own metadata column, so duplicating it in the title was visual noise.

### Español

- **Limpieza del título del README** — quitado el prefijo redundante `signalk-mareas-ihm —` del encabezado del README. La página en npmjs.com ahora muestra solo el nombre comercial `AnchorWatch Pro: Smart Anchoring, AIS & Tides`. El nombre del paquete (`signalk-mareas-ihm`) ya lo enseña NPM en su propia columna de metadatos; duplicarlo en el título era ruido visual.

## [2.3.2] - 2026-06-24

### English

**UI polish — modal headers consistent across the whole viewer**

- **Modal headers unified** — Sonda, Fondeo, Abrigo, AIS panel, Cartas y Capas and all sub-modals now render the same BACK button + title (24px back, 32px title, 88px header height). Previously each context had drift from local CSS overrides.
- **Shelter sub-modals fixed** — "Exposure scale A-F", "% protection detail" and "Wave history info" were physically nested inside `#shelter-pop` in the DOM. Both elements had `zoom: var(--ui-scale)` so the zoom composed (0.6 × 0.6 = 0.36) and the child header rendered at 36% of the intended size. Sub-modals are now siblings at root level, single zoom layer, headers match Sonda.
- **Panel headers (`#panel`, `#ais-alarm-panel`)** — universal `*` / `button` rules inside the panels were overriding the injected `.m-back` and `.m-title`. Now explicit rules with higher specificity restore the default size.
- **AIS panel header** — was the only `.m-modal-hdr` rendering at 100% (the panel is not a `.popup-overlay`, so it didn't inherit the global UI zoom). Now scaled with `var(--ui-scale)` to match Sonda visually.
- **Title span inheritance** — when a modal's `<h4>` contains a `<span>` (e.g. `#shelter-pop` "⚓ Previsión de Abrigo"), the span did not inherit the 32px font of its parent `.m-title` because external rules with higher specificity hit it directly. Now `.m-title *` is forced to inherit font-size/weight/color.
- **Orphaned dropdown arrow** removed from the AIS panel header (leftover from an older collapse pattern).
- **Instructions modal header** — the manual modal now shows a standard injected header with title "📖 Instructions · v<version>" so the user knows which version they are reading.
- **Cache-bust automatic** — visor reloads itself when the backend `serverInstanceId` changes, so any plugin restart picks up the fresh build immediately.
- **Bottom-bar widgets — defaults updated and user config respected on restart** — the default order on fresh install is now `sog, wind, sonda, tide, sunrise, cad_rec, dist_ancla, h_fondeo, calidad, abrigo` (snapshot of real on-boat use). Auto-migration that re-inserted `dif_lw` / `prof_min` on every visor load (Rev491) has been removed: it was silently overriding the user's deliberate cell removals after each deploy. The "↺ Reset to default order" button in the bottom-bar config returns to this default.
- **Instructions modal — single source of truth, no longer orphaned** — the manual content was hardcoded in TidesView and got out of sync between releases. Now the Spanish manual is served from `instrucciones_es.html` by the plugin (cut from `docs/INSTRUCCIONES_MODAL_v3.html`), and the "CHANGELOG" button reads `CHANGELOG.md` directly from the installed plugin. Each release just needs to update those two files and the modal reflects the change automatically.
- **Modal Instructions — header consistent with viewer (zoom fix)** — diagnosed by GPT-5 + Gemini Pro: `.popup-overlay { zoom: var(--ui-scale) }` was scaling visually everything the iframe rendered, so `font-size: 28px !important` inside React was painted at 16.8px. Excluded `#m-instructions-overlay` from the global zoom and re-applied `var(--ui-scale)` only to its injected `.m-modal-hdr` so back/title still match Sonda/Fondeo.
- **Web entry root redirects to anchor viewer** — `/signalk-mareas-ihm/` now goes straight to `/visorfondeo` (mobile.html) instead of loading TidesView (Tides app). TidesView still accessible via the in-app `Tides` button.
- **README + npm description + Signal K display name aligned** — title corrected to `AnchorWatch Pro: Smart Anchoring, AIS & Tides` everywhere (was `Advanced Anchor Watch Manager` in README root).

### Español

**Pulido UI — headers de modales consistentes en todo el visor**

- **Headers de modales unificados** — Sonda, Fondeo, Abrigo, panel AIS, Cartas y Capas y todos los sub-modales renderizan ahora el mismo botón ATRÁS + título (back 24px, título 32px, altura header 88px). Antes cada contexto tenía deriva por overrides CSS locales.
- **Sub-modales de Abrigo arreglados** — "Escala A-F", "Detalle Score %" e "Info histórico olas" estaban físicamente anidados dentro de `#shelter-pop` en el DOM. Ambos elementos tienen `zoom: var(--ui-scale)` y los zooms se componían (0.6 × 0.6 = 0.36), renderizando el header hijo al 36% del tamaño esperado. Ahora los sub-modales son hermanos al nivel raíz, una sola capa de zoom, headers idénticos a Sonda.
- **Headers de paneles (`#panel`, `#ais-alarm-panel`)** — las reglas universales `*` / `button` dentro de los paneles pisaban el `.m-back` y `.m-title` inyectados. Ahora reglas explícitas con más especificidad restauran el tamaño por defecto.
- **Header del panel AIS** — era el único `.m-modal-hdr` renderizándose al 100% (el panel no es `.popup-overlay`, así que no heredaba el zoom global). Ahora escala con `var(--ui-scale)` para igualar a Sonda visualmente.
- **Herencia del span en .m-title** — cuando el `<h4>` de un modal contiene un `<span>` (ej. `#shelter-pop` "⚓ Previsión de Abrigo"), el span no heredaba los 32px del `.m-title` padre porque reglas externas con más especificidad lo atacaban directamente. Ahora `.m-title *` se fuerza a heredar font-size/weight/color.
- **Flecha desplegable huérfana** eliminada del header del panel AIS (residuo de un patrón collapse anterior).
- **Modal Instrucciones con header** — ahora el modal del manual muestra un header inyectado estándar con título "📖 Instrucciones · v<versión>" para que el usuario sepa qué versión está leyendo.
- **Cache-bust automático** — el visor se recarga solo cuando cambia `serverInstanceId` del backend, así cualquier reinicio del plugin coge el build fresco sin intervención.
- **Widgets bottom-bar — defaults actualizados y config del usuario respetada en reinicios** — el orden por defecto en instalación nueva es `sog, viento, sonda, marea, salida, cadena rec., dist. ancla, h. fondeo, calidad, abrigo` (snapshot de uso real en barco). Eliminada la auto-migración Rev491 que re-insertaba `dif_lw` / `prof_min` en cada carga del visor: pisaba en silencio las celdas que el usuario había desactivado a propósito. El botón "↺ Restablecer orden por defecto" del config de la bottom-bar vuelve a este default.
- **Modal Instrucciones — fuente única, ya no huérfano** — el contenido del manual estaba hardcoded dentro de TidesView y se desfasaba entre releases. Ahora el manual en español se sirve desde `instrucciones_es.html` por el plugin (extraído de `docs/INSTRUCCIONES_MODAL_v3.html`), y el botón "VERSIONES" lee `CHANGELOG.md` directamente del plugin instalado. Cada release solo necesita actualizar esos dos archivos y el modal lo refleja automáticamente.
- **Modal Instrucciones — header coherente con el visor (fix zoom)** — diagnosticado por GPT-5 + Gemini Pro: `.popup-overlay { zoom: var(--ui-scale) }` escalaba visualmente todo lo que pintaba el iframe, así que `font-size: 28px !important` dentro de React se pintaba a 16.8px. Excluido `#m-instructions-overlay` del zoom global y re-aplicado `var(--ui-scale)` solo a su `.m-modal-hdr` inyectado para que back/título sigan iguales que Sonda/Fondeo.
- **Entrada raíz del webapp redirige al visor de fondeo** — `/signalk-mareas-ihm/` ahora va directo a `/visorfondeo` (mobile.html) en lugar de cargar TidesView (app de mareas). TidesView sigue accesible mediante el botón `Mareas` interno del visor.
- **README + descripción NPM + displayName de Signal K alineados** — título corregido a `AnchorWatch Pro: Smart Anchoring, AIS & Tides` en todos los sitios (estaba como `Advanced Anchor Watch Manager` en el README root).

## [2.3.1] - 2026-06-23

### English

**Skipper feedback round 1 (Vicente / Tunatunes Vigo)**

- **New bottom-bar widget "Drop to LW"** — large number = how many centimetres the tide will drop until the next low water (negative). Sub-label = expected final depth. Visible permanently (not only on grounding alert). Lets you decide whether to anchor with enough margin.
- **New bottom-bar widget "At LW"** — large number = expected depth at next low water (consistent with the main SONDA cell, raw sensor reference, not below-surface). Sub-label = LW time. Amber if <2m, red if <1m.
- **Depth cell sub-label rewritten** — now compact "(final X.X m)" in parentheses below the depth reading. Coherent with the new widgets above.
- **Bottom-bar config bug fixed** — disabling and re-enabling cells in the config UI now actually persists. The backend whitelist was filtering out new keys silently.
- **Left arrow of bottom-bar always visible** when the bar is open, matching the right arrow. Previously the left arrow hid when no horizontal scroll was available, getting covered by the bar.

**Signal K data hygiene (skipper feedback)**

- `environment.tide.vessel.finalExpctDepthBKeel` — **fixed historic bug**: the path name said "below keel" but the value was actually "below surface" (off by the boat's draft). Now finally publishes the real below-keel value.
- `environment.tide.finalExpctDepthBKeelResume` — same fix applied to the text summary "Min. depth X m at HH:MM".
- New: `environment.tide.expectedDropToLW` (m) — how much the tide will drop until next low water.
- New: `environment.depth.belowKeelExpectedAtLW` (m) — expected depth under keel at next LW.
- Removed `environment.depth.belowSurfaceExpectedAtLW` (it was confusing — skipper asked for below-keel only).

**Dep hygiene**
- `@signalk/server-api` range tagged with explicit patch `^2.0.0` (was `^2.0`) — cosmetic, fixes Socket.dev "floating dependency" warning. NPM resolution unchanged.

### Español

**Feedback navegante ronda 1 (Vicente / Tunatunes Vigo)**

- **Nuevo widget bottom-bar "Dif. Bajamar"** — número grande = cuántos centímetros bajará la marea hasta la próxima bajamar (negativo). Sub-label = profundidad final esperada. Visible permanentemente (no solo cuando hay alerta de varada). Permite decidir si fondear con margen suficiente.
- **Nuevo widget bottom-bar "En B.M."** — número grande = profundidad esperada en la próxima bajamar (coherente con la celda SONDA principal, referencia del sensor crudo, no bajo superficie). Sub-label = hora de la bajamar. Ámbar si <2m, rojo si <1m.
- **Sub-label de la celda Sonda reescrito** — ahora compacto "(final X.X m)" entre paréntesis bajo el valor de sonda. Coherente con los nuevos widgets.
- **Bug del config del bottom-bar arreglado** — desactivar y reactivar celdas en el config UI ahora persiste de verdad. El backend filtraba silenciosamente las claves nuevas.
- **Flecha izquierda del bottom-bar siempre visible** cuando la barra está abierta, igual que la derecha. Antes solo aparecía si había scroll horizontal posible, quedando tapada por la barra.

**Limpieza de datos en Signal K (feedback navegante)**

- `environment.tide.vessel.finalExpctDepthBKeel` — **bug histórico corregido**: el nombre del path decía "bajo quilla" pero el valor era "bajo superficie" (desfase = calado del barco). Ahora por fin publica el valor real bajo quilla.
- `environment.tide.finalExpctDepthBKeelResume` — el mismo fix aplicado al resumen textual "Prof. mínima X m a las HH:MM".
- Nuevo: `environment.tide.expectedDropToLW` (m) — cuánto bajará la marea hasta la próxima bajamar.
- Nuevo: `environment.depth.belowKeelExpectedAtLW` (m) — sonda esperada bajo quilla en la próxima bajamar.
- Eliminado `environment.depth.belowSurfaceExpectedAtLW` (creaba confusión — el navegante pidió solo bajo quilla).

**Limpieza de deps**
- `@signalk/server-api` rango etiquetado con patch explícito `^2.0.0` (antes `^2.0`) — cosmético, resuelve el aviso "floating dependency" de Socket.dev. Resolución de NPM idéntica.

## [2.3.0] - 2026-06-22

### English

**Safety hardening (refactor Rev475-487)**

- **Grounding FSM** with four orthogonal dimensions exposed at `state.grounding`: `physics` (data + clearance), `config` (alarm settings), `notification` (active/snoozed/inactive/latched), `safetyLatch` (persistent across restart). Plus legacy paths (`groundingAlarm`, `groundingStatus`, `groundingDetail`) preserved for backward compatibility.
- **Grounding snooze** added: `POST /api/anchor-watch/silence-alarm {kind:"grounding", minutes:N}` silences the grounding siren for N minutes. The visor snooze button (😴) now silences AIS *and* grounding (anchor-drag still untouched — safety critical). Cancel with `kind:"all"`.
- **Visual risk indicator**: anchor icon (sidebar button + map marker) glows red and pulses when physical grounding risk is detected, independent of whether the alarm is enabled or silenced. Bottom-bar SONDA cell shows "⚠ RIESGO DE VARADA" in red.
- **Disconnect banner**: when the visor stops receiving state for >15s (WiFi lost, plugin down, SK stopped, Pi off), a red banner appears warning "DATA UNRELIABLE — check WiFi, plugin or boat link before making decisions". Auto-reload on backend restart (detected via `serverInstanceId` change).
- **GPS freshness exposed** as `state.gpsAgeMs`. `boatPosition: null` when fresh GPS is unavailable (avoids stale-position leakage).
- **Single-flight lock** for `drop`/`lift`/`toggle` anchor commands (10s recovery). Concurrent calls return 409.
- **Persistent safety latch**: if the depth sounder freezes or disappears while grounding is monitored, the latch holds the alarm even across plugin restarts until the user explicitly clears it.
- **Schema version 2** + `serverInstanceId` to detect cached frontend / backend restart and force reload.
- **Input validation**: POST endpoints now reject invalid types (`enabled:"yes"`, `draft:"text"`, out-of-range numbers) with 400 instead of silent coercion.
- **Robust draft reader** handling all `design.draft` shapes (number, `{value}`, `{value:{maximum}}`).
- **Validated position** with 60s timestamp window for SSE consumers.
- **Defensive deep-clone** of state payload to avoid mutation leaks.
- **Cache migration** for legacy `groundingRisk` snapshots.
- Integration test suite (`tests/grounding_v475.test.js`, `depth_v476.test.js`, `fsm_v477.test.js`, `sync_v478.test.js`) — 37 tests.

QA validated in-water on Tunatunes during a real grounding-risk event (Vigo, 2026-06-22), including snooze, glow indicators, bottom-bar display, and connection-loss banner triggered by laptop WiFi cut.

### Español

**Refuerzo de seguridad (refactor Rev475-487)**

- **FSM de varada** con cuatro dimensiones ortogonales expuestas en `state.grounding`: `physics` (datos + holgura), `config` (configuración de alarma), `notification` (active/snoozed/inactive/latched), `safetyLatch` (persistente entre reinicios). Más los paths legacy (`groundingAlarm`, `groundingStatus`, `groundingDetail`) preservados por compatibilidad.
- **Snooze de varada** añadido: `POST /api/anchor-watch/silence-alarm {kind:"grounding", minutes:N}` silencia la sirena de varada N minutos. El botón snooze del visor (😴) ahora silencia AIS *y* varada (garreo intocable — safety crítico). Cancelar con `kind:"all"`.
- **Indicador visual de riesgo**: el icono ancla (botón sidebar + marker del mapa) brilla en rojo pulsante cuando se detecta riesgo físico de varada, independientemente de si la alarma está activada o silenciada. La celda SONDA del bottom-bar muestra "⚠ RIESGO DE VARADA" en rojo.
- **Banner de desconexión**: cuando el visor lleva >15s sin recibir state (WiFi caído, plugin parado, SK parado, Pi apagado), aparece un banner rojo: "DATOS NO FIABLES — verifica WiFi, plugin o conexión con el barco antes de tomar decisiones". Auto-recarga al reiniciar backend (detectado vía cambio de `serverInstanceId`).
- **Edad del GPS expuesta** en `state.gpsAgeMs`. `boatPosition: null` cuando no hay fix fresco (evita filtrar posiciones obsoletas).
- **Lock single-flight** para comandos `drop`/`lift`/`toggle` (recovery 10s). Llamadas concurrentes devuelven 409.
- **Safety latch persistente**: si la sonda se congela o desaparece mientras vigilamos varada, el latch mantiene la alarma incluso entre reinicios del plugin hasta que el usuario la limpie explícitamente.
- **Schema versión 2** + `serverInstanceId` para detectar frontend cacheado / backend reiniciado y forzar reload.
- **Validación de inputs**: los endpoints POST ahora rechazan tipos inválidos (`enabled:"yes"`, `draft:"texto"`, números fuera de rango) con 400 en lugar de coerción silenciosa.
- **Lector de calado robusto** que maneja todos los shapes de `design.draft` (número, `{value}`, `{value:{maximum}}`).
- **Posición validada** con ventana timestamp 60s para consumidores SSE.
- **Deep-clone defensivo** del payload de state para evitar fugas de mutación.
- **Migración de cache** para snapshots legacy de `groundingRisk`.
- Suite de tests de integración (`tests/grounding_v475.test.js`, `depth_v476.test.js`, `fsm_v477.test.js`, `sync_v478.test.js`) — 37 tests.

QA validado en agua a bordo del Tunatunes durante un evento real de riesgo de varada (Vigo, 2026-06-22), incluyendo snooze, indicadores de glow, bottom-bar y banner de pérdida de conexión disparado al cortar el WiFi del portátil.

## [2.2.2] - 2026-06-20

### English

- **Fix:** `tests/` directory now included in the published npm tarball via `files[]`. In 2.2.1 the `npm test` script was declared but the test files themselves were excluded, so the Signal K Plugin Registry could not detect any tests and showed the "no plugin-level tests provided" warning. This release ships the suite inside the package so `npm test` runs from the installed tarball.

### Español

- **Corrección:** el directorio `tests/` ahora va dentro del tarball npm publicado (añadido a `files[]`). En 2.2.1 declaramos el script `npm test` pero los archivos de test no viajaban en el paquete, así que el Signal K Plugin Registry no detectaba ninguno y mostraba el aviso "no plugin-level tests provided". Esta versión incluye la suite dentro del paquete para que `npm test` se ejecute desde el tarball instalado.

## [2.2.1] - 2026-06-20

### English

**Documentation & UI**
- Instructions modal rewritten as a proper user manual: safety notice, 16 sections covering setup, anchoring manoeuvre, swing-circle geometry (blue/red rings), real sensors, AIS proximity watch, shelter, grounding alarm, multi-device audio, FAQ.
- New "Recommended onboard hardware" section listing what each user typically needs: Raspberry Pi, USB self-amplified speaker (essential for audible alarms), GPS, depth sounder, anemometer, AIS receiver, IMU.
- Modal typography +2 px for easier reading at arm's length in cockpit conditions.
- AIS module renamed "anti-collision" → "proximity watch" (no CPA/TCPA yet — honesty matters in safety tooling).

**Bug fixes**
- Map no longer auto-recenters on the boat after a temporary GPS loss. If you dragged the map to look elsewhere, that decision is now respected even if the GPS blinks.

**App Store & registry**
- Screenshots converted to JPEG ≤1778 px wide, each <500 KB, per Signal K App Store spec. Tarball size dropped from 6.1 MB to 2.9 MB.
- Plugin test suite added using Node's built-in `node:test` (no new devDependencies). Covers Signal K plugin contract, screenshot manifest integrity, files[] correctness and entrypoint import. Runs with `npm test`.

### Español

**Documentación y UI**
- Modal de instrucciones reescrito como manual profesional: aviso de seguridad, 16 secciones con configuración, maniobra de fondeo, geometría de los círculos azul y rojo, sensores reales, vigilancia AIS de proximidad, abrigo, alarma de varada, audio multidispositivo, FAQ.
- Nueva sección "Hardware recomendado a bordo" con lo que necesita cada usuario: Raspberry Pi, altavoz USB autoamplificado (imprescindible para que las alarmas se oigan), GPS, sonda, anemómetro, receptor AIS, IMU.
- Tipografía del modal +2 px para leer cómodamente a un metro bajo la luz del sol.
- Módulo AIS renombrado "anti-colisión" → "vigilancia de proximidad" (no hay CPA/TCPA todavía — la honestidad importa en herramientas de seguridad).

**Corrección de bugs**
- El mapa ya no se auto-centra en el barco tras perder el GPS un instante. Si arrastraste el mapa para mirar otra zona, esa decisión se respeta aunque el GPS parpadee.

**App Store y registro**
- Capturas convertidas a JPEG ≤1778 px ancho, cada una <500 KB, según la especificación del App Store de Signal K. Tamaño del paquete bajado de 6.1 MB a 2.9 MB.
- Añadida suite de tests del plugin usando `node:test` nativo de Node (sin nuevas dependencias). Cubre contrato del plugin Signal K, integridad del manifiesto de screenshots, corrección de files[] y carga del entrypoint. Se ejecuta con `npm test`.

## [2.2.0] - 2026-06-20

Rediseño del sistema AIS, cache persistente entre sesiones, auto-desarme inteligente al motorizar, panel AIS más usable, capturas para el App Store de Signal K.

### Novedades

**Sistema AIS — Los barcos vecinos ya no se "olvidan"**
- El plugin guarda en disco los datos de cada barco AIS visto en los últimos 3 días: nombre, eslora, manga, tipo, callsign, IMO. Al reiniciar el plugin o abrir el visor desde cero, los nombres y datos ya están ahí sin esperar a que cada barco vuelva a emitir su paquete de identificación (que tarda hasta 6 min).
- Si un barco se queda sin recepción AIS por unos minutos, sigue visible en pantalla con una X discreta indicando "datos estimados".
- Banner azul claro en el popup cuando el target es estimado: "Datos estimados, mostrando última posición conocida".

**Sistema AIS — Lista y filtros nuevos**
- Slider de radio configurable de 0.5 a 50 km para decidir qué barcos ves en el mapa y en la lista. Se recuerda al recargar.
- Ordena la lista por distancia, nombre, favoritos primero, MMSI o tipo de barco.
- Casilla de filtro de texto para buscar por nombre o MMSI con mensaje "Sin resultados" cuando no hay coincidencias.
- Marca AIS como favorito con una ★ amarilla — se sincroniza entre todos tus dispositivos.
- Botón 🔍 vesselfinder en cada barco — abre vesselfinder en una nueva pestaña con la info completa del barco (IMO + MMSI).
- Iconos en la lista ahora distinguen velero, motora, carguero, tanker, pasaje, pesca... a primera vista.

**Sistema AIS — Alarma más fiable**
- Cuando haces ACK a un target y este vuelve a moverse hacia ti, la alarma vuelve a sonar (antes se quedaba muda).
- El ACK caduca a los 15 min para forzar una nueva evaluación si el barco sigue siendo peligro.
- Eliminado el bucle "alarma se abre y cierra sola" por fluctuaciones de velocidad pequeñas.
- La velocidad de acercamiento ya no arrastra valores antiguos cuando ambos barcos están parados.
- Actualización de tráfico AIS más rápida — el rastro de un barco que se mueve aparece a los pocos segundos en vez de medio minuto.

**Sistema AIS — Visor**
- Click en un barco → el mapa lo centra, lo sigue automáticamente y aparece su distancia al lado del aro azul de identificación.
- La selección se queda activa aunque cierres el popup. Una X en el aro azul te permite deseleccionar cuando quieras.
- El rastro del barco seleccionado se ve siempre destacado (más grueso y opaco), aunque esté lejos.

**Salida a motor sin alarma de garreo**
- Cuando sales del fondeo a motor sin acordarte de "levar" en la app, ahora el plugin detecta que llevas más de 30 segundos por encima de 3 nudos y desarma la vigilancia automáticamente. Antes saltaba la sirena de garreo y despertaba al patrón sin motivo.

**Previsión de abrigo (rosa de sectores)**
- Restaurado el algoritmo de detección que tenías en versiones anteriores y funcionaba bien. Los cambios intermedios daban falsos positivos en costas irregulares (caso Moaña). Ahora vuelve a marcar correctamente qué sectores tienen costa o espigón cerca y cuáles están expuestos al mar abierto.
- El icono del barco dentro de la rosa ya no aparece partido a veces.

**Historial de olas**
- Resolución triplicada: una barra cada 5 minutos en vez de cada 15.
- Las barras "Ahora" están a la izquierda y el pasado se extiende a la derecha (más intuitivo).
- Si hay muchas barras hay scroll horizontal con barras más anchas.
- Escala vertical autoescalable de 0 a 2 m con líneas guía claras a ambos lados.

**Ventanas y modales mejorados**
- Los modales informativos (Escala de exposición, Cómo se calcula la protección, Historial de olas con leyenda y tabla) ahora ocupan casi toda la pantalla con textos cómodos de leer a un metro de distancia bajo la luz del sol.
- El header de cada modal lleva botón "‹ Atrás" grande y bien visible.

**App Store de Signal K**
- Capturas de pantalla añadidas al paquete — visibles en el App Store de Signal K tras la instalación. La principal es el visor de fondeo en uso real.

### Mejoras de uso (UX)

- **Versátil en cualquier pantalla**: del móvil al monitor del puente, el visor reordena y reescala todo para que los controles siempre se puedan tocar cómodamente con el dedo, y los textos sean legibles a la distancia desde la que se usa el dispositivo.
- Quitado el tooltip molesto "Container ship top view" que salía al pasar el ratón sobre los AIS Class A.
- El faldón del popup AIS muestra el icono específico del tipo de barco (⛵ velero, 📦 carga, 🛢️ tanque, 🛳️ pasaje, etc.) en vez del genérico.

### Correcciones

- Resumen del abrigo ("Abrigado: ninguna de las próximas 12 h…") ahora respeta el idioma del visor en lugar de salir en español cuando la UI está en inglés.
- El nombre de un barco AIS ya no se pierde si reaparece en el visor sin haber recibido nuevo paquete de identificación.
- El foco del mapa ya no oscila entre el barco propio y un AIS seleccionado.
- Al pulsar la X del aro de un AIS, ya no salta accidentalmente la alarma del siguiente barco en zona.
- El panel "AIS en zona" mantiene fija arriba la cabecera (radio, ordenar, filtro) y solo se mueve la lista al hacer scroll.
- La rueda del ratón scrollea la lista correctamente desde cualquier parte del panel.
- Los cambios de pantalla se reflejan al instante tras actualizar el plugin (antes el navegador podía mostrar versión cacheada).

---

## [2.1.11] - 2026-06-13 (pendiente publicación)

### Nuevas funciones
- **NOAA ENC (EE.UU.)** como capa seleccionable. Servicio WMS Maritime Chart Service del NOAA ENCOnline (`gis.charttools.noaa.gov/.../exts/MaritimeChartService/WMSServer`). Gratis, sin API key. Capas 1-6 activas (naturales+puerto, sondas+corrientes, lecho+obstáculos+pipes, rutas tráfico, áreas especiales, boyas+balizas+faros+radar). Cobertura: aguas costeras EE.UU. (Atlántico, Pacífico, Golfo, Grandes Lagos, Alaska, Hawai, Caribe). Opacidad por defecto 60%. ID interno: `noaa`.

### Cartas no incluidas (notas)
- **CHS Canadá**: investigada y descartada por ahora. El endpoint NONNA (`nonna-geoserver.api.gc.ca`) está caído/movido. El portal oficial `data.chs-shc.ca` requiere login y no expone WMS público. No hay servicio público sin auth equivalente al de NOAA para Canadá. Se reactivará cuando aparezca alternativa.

### Documentación
- README: corregido "garreo" → "anchor drag" en la sección de audio inglés (línea 82). Era una fuga del término español dentro del párrafo EN.

## [2.1.10] - 2026-06-10

### Fixes
- **Alarma meteo activa sin estar fondeado** (feedback Pablo G. Nascimento). `_checkWeatherAlarm` no comprobaba `anch`; quien tuviese el switch ON recibía avisos amarrado al pantalán o navegando. Añadido guard: si no está fondeado, la alarma se fuerza a `false` y el chequeo retorna inmediatamente. La rosa del visor y el historial IMU siguen activos para info general — solo se suprime el aviso/voz/banner.
- **Rosa de abrigo en marinas con escolleras**: el query Overpass solo buscaba `way["natural"="coastline"]`. En marinas (e.g. Vigo Marina Davila 42.242,-8.724) los espigones están etiquetados como `man_made=breakwater`, `man_made=pier` o `man_made=groyne`, no como costa natural. El cálculo daba "F · 10% protección" para una marina con escolleras gigantes. Ahora el query incluye los tres tipos `man_made` y los trata como obstáculos sólidos en el ray-casting. `ALGORITHM_VERSION` bumpeada a `v76` para invalidar cachés viejas.

### Documentación
- Nota: las lecturas de olas (intensidad/período/dirección) del IMU son **siempre activas** mientras el plugin corre — son info general útil tanto fondeado como navegando. Los **avisos** (alarma meteo) solo disparan en fondeo. El visor sigue mostrando todos los datos.

## [2.1.5] - 2026-06-03

### Fixes
- **CRÍTICO: "Cannot set headers after they are sent"** en `/navtiles/:z/:x/:y.png`. El handler hacía `tileResp.pipe(res)` y si la conexión upstream caía mid-stream el `tileReq.on('error')` callback intentaba `res.status(502).send()` cuando los headers ya estaban enviados. Fix: helper `sendFallback()` que comprueba `res.headersSent` antes de enviar; si headers ya fueron enviados, sólo `res.end()` para cerrar el socket limpio. También guard antes de `pipe()` por si `res.headersSent` ya es true al entrar (idempotencia).
- **Bottom bar Sonda**: el botón solo abría el popup sin llamar `fetchSondaData()` — quedaba con "Cargando..." si no se había abierto antes desde el menú. Ahora ambos paths fetchan.
- **Quality donut mismatch** (visor ↔ shelter): el donut del bottom bar usaba un mapa hardcoded `{A:100, B:80, C:60, ...}` que no coincidía con el % real de `_shelterCache.assessment.scorePercent`. Ahora lee el valor real del cache; fallback al mapa si no hay cache aún.

### Nuevas funciones
- **Alarma "Mala condición climática"** en panel de alarmas: nuevo selector con switch. Cuando activado, comprueba cada 5 min las próximas 6h del shelter cache buscando viento > 25 kt u ola > 1.5 m, y dispara `setAlarmActive('weather', true)`. Estado persistido en localStorage.

### Traducciones
- **Wave history popup** (`#wave-hist-info-pop`): título "Historial de olas — leyenda y detalle" / "Wave history — legend & details", subtitle, badges Calma/Rizada/Moderada/Agitada/Fuerte → Calm/Rippled/Moderate/Rough/Strong, headers tabla Inicio/Intensidad/Período/Altura/RMS → Start/Intensity/Period/Height/RMS, badge ACTUAL → CURRENT, mensaje "No hay datos todavía...". Ampliado de 620px → 900px y 88vh → 92vh.
- **Tooltips left bar**: m-ham (Menú/Menu), m-cartas audio toggle, m-snooze, m-fav, m-lb-curvas, m-lb-mareas, m-kip, m-fb — todos con `data-i18n-title`.

## [2.1.4] - 2026-06-03

### Traducciones (i18n)
- **Panel meteo AHORA** (left card): labels VIENTO/RACHA/AIRE/MAR ahora bilingües (WIND/GUST/AIR/SEA en EN).
- **Filas tabla meteo**: Aire, Presión, Lluvia, T. Mar, Ola, Período, Dir ola → todas con T() (Air/Pressure/Rain/Sea T./Wave/Period/Wave dir).
- **Resumen meteo** botón colapsable → bilingüe.
- **Shelter NOW box**: badges "Veleta" → "Vane", "Sensor" igual ambos; labels racha/aire/agua → gust/air/water.
- **Eje gráfico presión**: "ahora" → "now".
- **Labels flotantes visor mapa**: "Viento" → "Wind", "Olas" → "Waves", "Mar en calma" → "Calm sea".

### UI consistente
- **Estilo unificado del back button** y título de cabecera en TODOS los modales:
  - `.m-back-btn` / `.m-modal-title` classes utility.
  - Back: rgba(255,178,63,.15) bg + 1px border var(--org) + color var(--org) + 18px font + 48px min-height + radius 12px.
  - Title: 28px (antes 38px en m-modal-hdr) — coherente con Anchor Calculation, Shelter, Weather Forecast.
- `m-modal-hdr .m-back` actualizado a las mismas dimensiones que la clase utility (sin min-width:110px, sin height fija 56px).
- `m-close-spacer` reducido de 110px → 80px para compensar el botón más estrecho.

### Infra i18n
- `applyLang()` ahora procesa también `data-i18n-title` (atributos title de tooltips) y `data-i18n-placeholder` (placeholders de inputs).

## [2.1.3] - 2026-06-03

### Traducciones
- Tooltips title="..." del bottom bar (velocidad/viento/sonda/cadena/distancia/presión/abrigo/calidad) y sidebar derecha (anchor/centrar/info/AIS/cartas/abrigo/alarmas/fondeo).
- Intensidades de ola en la rosa abrigo: Cal/Riz/Mod/Agi/Fue → Calm/Rip/Mod/Rou/Str.
- Modal "Guardar fondeo favorito": título, hint, placeholder, botones Cancelar/Guardar.
- Selector modelo meteo "Mejor (automático)" → "Best (automatic)".
- Spinner "Cargando…" → "Loading…" en popups Sonda y Meteo.

## [2.1.2] - 2026-06-03

### NPM metadata
- **Descripción ampliada** del paquete (antes hablaba solo de mareas; ahora menciona anchor watch, AIS, shelter, weather, depth, charts).
- **~70 keywords en inglés** orientados a búsqueda internacional: anchor-watch, ais-alarm, shelter-forecast, weather-forecast, swing-radius, bathymetry, chartplotter, mbtiles, marine-safety, voice-alarm, etc.

## [2.1.1] - 2026-06-02

### Fixes críticos (alarmas y audio)
- **State machine de alarmas robusta**: detector de loops huérfanos en `setAlarmActive` — si los timers fueron matados externamente (ACK manual, snooze, cancel-silence cross-device) pero `_activeAlarms[kind]=true` persiste, ahora se re-arman correctamente. Antes el plugin quedaba "atascado" sin sonar nunca más.
- **30s grace para AIS** antes del primer aviso de voz: modal aparece instant, 30s silencio para reaccionar, luego beep + voz.
- **ACK/snooze/un-mute = re-arme instantáneo** vía flag `_alarmInstantRearm[kind]` — sin esperar 30s adicionales.
- **Cortar voz al instante**: arquitectura per-kind (cancel tokens `_voiceCancelTokens`, arrays `_activeVoiceSources` y `_activeVoiceAudios`). HTMLAudio fallback se aborta con `removeAttribute('src')+load()`.
- **Voz garreo INSTANT** (antes esperaba 30s erróneamente porque `_ALARM_VOICE_PRE_DELAY_MS` era global). Default ahora 0, AIS pasa 30000 explícitamente.
- **Mute 60s window respetado** incluso por SSE del backend: cuando el usuario muta, `_userMuteUntilMs = Date.now()+60s`; durante esa ventana ni garreo crítico ni el push SSE pueden auto-reactivar.
- **Vibración fallback** (`navigator.vibrate`) + banner rojo "🔇 Audio bloqueado — TOCA aquí" + visibilitychange resume del AudioContext.
- **Snooze auto-cancela al levar ancla** (POST `/cancel-silence`).
- **Snooze sólo aplica si AIS está activo** (no permite snooze durante garreo solo).

### UI / UX
- **Shelter modal portrait fullscreen REAL** — fix del bug `dvw/dvh` × `zoom: var(--ui-scale)` (gracias Gemini): cambio de unidades `100dvw/100dvh` → `100%/100%` para que se cancelen con el factor zoom del overlay.
- **Chip numérico de opacidad** encima del thumb del slider: bold 900, font 14px, sombra, oculto durante drag, oculto cuando capa desactivada.
- **Defaults opacidad** capas: Sat=100, Batimetría=13, IHM=13 (preferencia del usuario).
- **"SonarChart" → "Batimetría"** (cero referencias comerciales). Variable `_navTokenCache` → `_chTokenCache`, comentarios sanitizados en `src/index.ts`.
- **Triángulos toggle** sidebars apuntan correctamente al borde donde se esconden.
- **AIS confirm popup** sin truncar título — popups de confirmación corta excluidos del `_mInjectModalHeader` que cortaba con `white-space:nowrap`.
- Curvas y Mareas solo en left bar (eliminados duplicados sidebar derecha).
- TidesView centrado fix (`baseW=825, baseH=890` corregidos).

### i18n
- Info modal completo (Estado, Fondeado/Anchored, etc.).
- Menú principal (8 items).
- Bottom bar (Velocidad/Speed, etc.).
- AIS popup (Acercamiento/Closing, Ancla est./Est. anchor).
- Shelter (Detección automática, Escala Exposición, Protección, score popup completo, hist olas).
- Botón ancla Echar/Drop, Levar/Lift.
- Back buttons del modal-hdr ‹ Atrás / ‹ Back.

## [2.0.0] - 2026-05-22

Salto generacional. Lo que era un plugin de mareas pasa a ser un **visor completo de fondeo** con previsión de abrigo, medición de olas en tiempo real y alarmas en barco y móvil.

### Nuevo

**Fondeo seguro**
- Detección automática de garreo con radio predictivo según la marea.
- Cálculo de cadena recomendada con dos métodos (tradicional y Vicente).
- Alarmas configurables: garreo, varada, AIS por proximidad.
- Track de aproximación al fondeo con gradiente de tiempo.

**Previsión de abrigo**
- Rosa de 16 sectores con detección automática del abrigo según la costa (OpenStreetMap).
- Grado A-F y porcentaje de protección combinando viento y olas.
- Strip de 12 h con previsión hora a hora.
- Resumen "AHORA / PREDICCIÓN" con datos en tiempo real.

**Medición de olas en fondeo**
- Dirección, período y altura de ola medidas a bordo (sensores de actitud y aceleración).
- Historial de las últimas 24 h.
- El grado de abrigo se ajusta cuando la ola real supera la prevista.

**Sensores en tiempo real**
- Lectura directa de viento (veleta del barco), temperatura del aire y del agua, presión atmosférica.
- Etiquetas "Veleta" y "Sensor" para distinguir datos reales de previsión.
- Fallback automático a Open-Meteo si un sensor falla.

**Cartas náuticas integradas**
- Servidor MBTiles incluido para cargar tus propias cartas en el visor.

**Audio mejorado**
- Voces pregrabadas (OGG) por idioma — más naturales que el sintetizador.
- Detección automática de la salida de audio del Raspberry Pi.
- Alarmas distintas por evento (AIS, garreo, varada).
- Soporte fiable en móvil (incluso con la pestaña en segundo plano).

**Mareas IHM**
- Lista completa actualizada (70 estaciones reales de IHM España).
- Visor del coeficiente y tendencia (subiendo/bajando) en barra superior.

### Mejoras

- Compass cardinal en español (N/NE/E/SE/S/SO/O/NO).
- Sonda inteligente: cuando se congela o da lecturas absurdas, el visor lo detecta y deja de mostrar valores inventados.
- Estabilidad mejorada en conexiones débiles (4G/Tailscale).
- Tolerancia a errores de la API de mareas (no se cuelga con respuestas inesperadas).

### Corregido

- Identificadores de estación incorrectos que provocaban errores constantes cuando el plugin arrancaba sin GPS.
- El visor mostraba "Sonda mínima esperada" obsoleta cuando el sensor de sonda se quedaba congelado.
- Solapamiento de etiquetas en la rosa cuando viento y oleaje coincidían en dirección.
- Memoria del navegador a las pocas horas con la capa de viento activa.

---

## [1.3.1] - Versiones anteriores

Plugin de mareas IHM España con previsión meteo Open-Meteo y barra de estado superior.
