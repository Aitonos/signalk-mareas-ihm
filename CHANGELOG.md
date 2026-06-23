# Changelog

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
