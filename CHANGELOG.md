# Changelog

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
