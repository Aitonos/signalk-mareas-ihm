# AnchorWatch Pro: Smart Anchoring, AIS & Tides

**A complete anchor watch and marine safety webapp for Signal K.**
Intelligent anchor monitoring, voice alarms, AIS anti-collision with cross-session cache, shelter forecast, on-board wave measurement and IHM Spain tides — running on your OpenPlotter / Raspberry Pi.

**User-friendly UI designed for fingers in sunlight** — from the bridge Pi to the phone in the cockpit, the whole viewer adapts to your screen, keeping comfortable controls and readable text.

🇬🇧 [English](#english) · 🇪🇸 [Español](#espanol)

---

## English

### What you get

A single Signal K plugin that turns your boat computer into a serious **anchor watch manager** with everything a cruiser actually needs:

- ⚓ **Smart anchor watch** with predictive swing radius (tide + weather over the next 12 h) and automatic disarm when you leave under engine.
- 🚢 **AIS anti-collision system** with cross-session cache, list filterable by name/MMSI, configurable radius slider, cross-device favorites, vesselfinder integration and drag detection on neighbouring boats.
- 🌐 **Real-time multi-device sync** via SSE — phone, tablet and chartplotter all show the same state.
- 🎙️ **Voice alarms** for drift, AIS collision and grounding (natural OGG voices, not synth).
- 🏔️ **Shelter forecast** — 16-sector wind rose with automatic detection from OSM coastline + breakwaters, A-F grade + 0-100% protection score, 12 h strip, real-time downgrade from on-board vane/IMU.
- 🌊 **On-board wave measurement** — 24 h history from your IMU (intensity, period, height by 5-minute bins).
- 📊 **Anchoring calculator** — chain, scope, depth, swing prediction.
- 🗺️ **Multi-layer chart viewer** — world bathymetry + Esri Satellite + IHM ENC S-52 + NOAA ENC (USA) + offline MBTiles + OpenStreetMap + OpenSeaMap + SK Charts integration, all with adjustable transparency.
- 🌅 **Multi-source worldwide tides** with automatic engine selection by proximity: IHM Spain official (>70 stations) → [`signalk-tides`](https://github.com/openwatersio/signalk-tides) if installed → **NEAPS** harmonic-constants engine embedded (~7600 stations NOAA + TICON-4) → Open-Meteo as last resort.
- 🌤️ **Weather forecast** via Open-Meteo (ICON, GFS, ECMWF, Arome, GEM, JMA).
- 🌀 **Built-in shortcuts** to Windy, Windregatta.com, KIP, SK Freeboard.
- 📱 **Works on any screen** — from a phone in hand to the big bridge monitor. The viewer reorders itself and buttons stay the right size for finger-touch use.
- 🇬🇧 🇪🇸 **Fully bilingual UI** (English / Spanish) — switch live from the menu.
- 👥 **Multi-user PIN control** — protect boat actions (drop/lift anchor, alarms, settings) with a master PIN + optional guest PINs (charter crew, family, etc.) with per-user notes and optional expiry. Read stays open.
- 🔗 **Standard SignalK vocabulary** — publishes canonical `navigation.anchor.*` and `notifications.navigation.anchor` in parallel to our own paths, so any anchor watch app in your SK environment sees and reacts to our anchor state. WilhelmSK iOS/iPadOS push works out of the box (all critical alarms carry `method:["push"]`).
- 🚢 **Online AIS engine** (aisstream.io) — optional free crowd-sourced AIS feed for boats without a VHF AIS receiver, or to extend VHF coverage. Auto-dedup: your VHF always takes priority; the online feed only fills gaps. Republished to the SignalK `vessels.*` tree so any consumer in your environment sees the targets.
- 🌊 **Shy tide provider** — auto-yields the `/signalk/v2/api/resources/tides` path if another tide plugin (opentide, signalk-tides, tidal-currents) is enabled on your server, so you can install this alongside them without conflicts. Configurable per user preference (auto / always publish / never publish).

Runs on **Raspberry Pi** (OpenPlotter), **any Linux box** or **macOS / Windows** with Signal K Server.

### ⭐ Why this plugin

Most anchor watch apps are paid, closed source, single-device and tied to a vendor's hardware. This one:

- Is **free and open source** (Apache 2.0).
- Runs **on your existing Signal K server** — no extra hardware.
- Shows the **same alarm on every device** (phone, tablet, chartplotter, Pi screen).
- Uses your **boat's real sensors** (anemometer, depth, IMU) when available; falls back to forecast when not.
- Has a **user-friendly UI** that scales from the phone to a 4K bridge monitor — readable text, finger-sized controls, no clutter.
- Handles **edge cases** real cruisers hit: cross-session AIS data loss, anchor drag false positives when motoring out, GPS dropout, audio autoplay blocks, multiple AIS targets in zone, snooze + un-snooze, etc.

### Key features in detail

#### Anchor watch
- **Predictive swing radius** combining depth, chain deployed and tide cycle for the actual swing area over the next 12 h — not a static circle.
- **Two chain calculation methods**: classic ratio and the Vicente method (15 + 2 × depth).
- **Drag detection** with audible siren that bypasses user mute for safety.
- **Auto-disarm when leaving under engine**: if SOG stays above 3 kt for 30 s the watch disarms automatically. No more sirens when you forgot to lift in the app.
- **GPS track** with time-gradient colouring so you can see exactly where the boat has been.
- **Favourite anchorages** saved with a custom name (or auto-named from geolocation), synced across all your devices via the backend.

#### AIS anti-collision system
- **Persistent vessel database** for the last 72 h — name, length, beam, type, callsign, IMO. Boats appearing in the viewer already have their data filled in, no waiting for the next AIS static packet (which can take up to 6 minutes).
- **5-minute ghost cache** — when a target loses VHF reception briefly, it stays visible on the map with a discrete X mark indicating "estimated data".
- **Configurable radius slider** (0.5–50 km) controls what you see on the map and in the list.
- **5-criteria sorting**: by distance, name, favourites first, MMSI or vessel type.
- **Filter box** by name/MMSI with "no results" feedback.
- **★ Favourites** persisted in the backend, synced across devices.
- **🔍 vesselfinder button** per row — opens vesselfinder.com in a new tab with IMO + MMSI.
- **Voice alarm** when a target enters your swing zone; 30 s grace before voice starts.
- **Per-target ACK** with timestamp; silencing one boat doesn't disable the alarm for others.
- **Drag detection on neighbours** — if an ACKed boat resumes motion towards you (>0.5 kn + closing >5 m/min), the alarm re-engages.
- **Click-to-focus**: click any target → the map centres on it, auto-follows it and displays its distance next to the blue selection ring. Click the X on the ring to release.
- **Vessel-type emoji**: list and popup show ⛵ sailing / 📦 cargo / 🛢️ tanker / 🛳️ passenger etc. at a glance.
- **Anchor estimation** for other boats via track centroid analysis.

#### Shelter forecasting
- **16-sector wind rose** with automatic open/sheltered detection from OpenStreetMap coastline + man-made breakwaters/piers/groynes.
- **A–F grade** + **0–100 % protection score** computed from forecast wind in exposed sectors.
- **12 h strip** with per-hour grade and peak wind.
- **24 h wave history** from on-board IMU (5-minute bins, autoscaling vertical axis up to 2 m).
- **Real-time downgrade**: if the measured wind on the anemometer is higher than the forecast in an exposed sector, the grade is downgraded automatically.

#### Tides
- **Automatic multi-source engine** chosen by proximity to the boat, with graceful fallback:
  1. **IHM Spain official** (>70 harbours) — highest priority when within Spanish waters.
  2. **[`signalk-tides`](https://github.com/openwatersio/signalk-tides)** — if the openwatersio plugin is installed we call it as a bridge, so its own datum and station catalogue win.
  3. **NEAPS harmonic-constants engine** *(embedded, ~7 600 stations)* — [openwatersio/neaps](https://github.com/openwatersio/neaps) + `@neaps/tide-database` (NOAA ~3 400 US + TICON-4 ~4 200 worldwide). Sub-minute time resolution, mm-level height accuracy, all computed locally (no network needed). Extremes are rebased to LAT (Lowest Astronomical Tide) computed over 365 d so heights match the harbour's "zero" as published by IHM/NOAA.
  4. **Open-Meteo global** (FES2014) — last-resort fallback when no NEAPS station is within 80 km.
- **Setup wizard** with Auto / Manual mode picker and **city-search** station selector: type "Sydney" or "San Francisco" and the wizard geocodes it, finds the nearest predictable NEAPS station and shows the distance; if no station is within 100 km it offers Open-Meteo automatically.
- **Manual station override** persists across restarts; the backend serves as the single source of truth.
- **Interactive tide curve** with cursor, peaks and 2-month offline cache.
- **No API key required** for any tide source.

#### Weather forecast
- **Open-Meteo** integrated (free, no API key, no rate limit issues).
- **Multiple models**: ICON (DWD), GFS (NOAA), ECMWF, Météo-France Arome, GEM, JMA.
- **Sea temperature, wave height, period and direction** when available.
- **48 h hourly table** + collapsible plain-language summary.

#### Audio & alarms
- **Per-language voice clips (OGG)** — natural, no robotic synth.
- **Snooze 5 min** for AIS (anchor drag is never snoozable for safety).
- **60 s user-mute window** — if you mute manually, even anchor drag cannot override for 60 s.
- **Visibility-aware**: when phone screen wakes from sleep, the audio context resumes automatically.
- **Vibration fallback** on Android when autoplay policy blocks audio.

#### Charts & layers
- **Esri Satellite**, **IHM ENC S-52** (Spain official charts), **NOAA ENC** (USA official charts), **Bathymetry overlay**, **OpenStreetMap**, **OpenSeaMap** seamarks, **Bing Hybrid**, **Esri Clarity**, **Google Satellite**.
- **MBTiles offline** — drop your `.mbtiles` files in a folder and they show up automatically.
- **Signal K registered charts** — any chart you've registered with Signal K appears as a layer.
- **Per-layer opacity slider** with default values you can tweak.

#### Home Automation / KIP / Freeboard
- **KIP buttons** for drop/lift and toggle alarms — open Freeboard-SK with one tap from the side bar.
- **REST endpoints** for Alexa, Google Home, Node-RED, MQTT bridges, custom dashboards.
- **`/toggle` endpoint** for single-button remote controls.

#### User control (multi-user PIN, new in 2.4.0)
- **Master + Guests** model. First PIN created becomes the master (manages the layer + everyday use). The master can add guest PINs at any time.
- **Public read stays open**. Only mutating actions (drop/lift anchor, alarms, settings, PIN management) require a valid PIN. Anyone browsing the map or tides sees the same data as before.
- **Optional expiry per guest** with quick-buttons: no expiry, +1 day, +7, +30, +90, +1 year. Charter crew gets a PIN that dies on Sunday, family gets a permanent one.
- **Notes** and **PIN visible to master** — the master opens the guest card and sees their current PIN in plain text (the file lives on the owner's Pi, treated as boat-local).
- **Active users list** shows each open session with device (OS · browser), IP and remaining minutes/hours/days. The master can revoke any guest session remotely.
- **Master session persistent** (1 year cookie TTL) — the owner does not have to re-enter PIN every 30 minutes. Guest sessions match the PIN's expiry.
- **Zero Signal K account setup required**. No `/admin/#/security` fiddling; everything is inside the plugin.

### URLs

| URL | What it does |
|-----|----------|
| `/signalk-mareas-ihm/` | Landing — choose Tides or Anchor Watch |
| `/signalk-mareas-ihm/mareas` | Tides view (direct) |
| `/signalk-mareas-ihm/visorfondeo` | Anchor Watch viewer (direct) |
| `/signalk-mareas-ihm/mobile` | Mobile-first viewer (recommended on phones) |

### Home Automation — REST endpoints

```bash
# One-button drop or lift (auto detects current anchor state)
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/toggle

# Drop anchor at current GPS
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/drop

# Lift anchor
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/lift

# Simple JSON status (for monitoring / dashboards)
curl http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/simple
```

### Minimum requirements

The plugin is ESM-only and uses modern features. Older stacks will not load it (`ERR_REQUIRE_ESM`).

| Component | Minimum | Notes |
|---|---|---|
| **OpenPlotter** | **V4** | V3 ships SK 1.x, which cannot load ESM plugins. |
| **Signal K Server** | **≥ 2.0** | 1.x uses `require()` for plugins → `ERR_REQUIRE_ESM`. |
| **Node.js** | **≥ 20** | LTS. |
| **System locale** | **UTF-8 (e.g. `es_ES.UTF-8`)** | A non-UTF-8 locale causes RTIMULib/pypilot to misparse gyro values and returns spurious 10-15° roll noise (breaks wave engine). Verify with `locale`. |
| Emoji font (opt.) | `fonts-noto-color-emoji` | Without it, buttons show empty squares on Chromium/Pi. `sudo apt install fonts-noto-color-emoji`. |
| Voice engine | `espeak` | Mandatory for voice alarms. Usually already installed on OpenPlotter. |

⚠ **Do NOT enable `@signalk/set-system-time`** (ships with Signal K, sometimes on by default in OpenPlotter with internet). It runs `date -u -s` every 60 s with 1 s resolution and corrupts the IMU Kalman filter → phantom "strong" waves in port and jerky attitude. Disable in **SK → Server → Plugin Config → Set System Time → OFF**.

### Quick install

From the **Signal K Appstore**: search `signalk-mareas-ihm` and click install.

Or from the command line:

```bash
cd ~/.signalk
npm install signalk-mareas-ihm@latest --save
sudo systemctl restart signalk
```

Then open: `http://your-pi.local:3000/signalk-mareas-ihm/`

### Tested on

- Raspberry Pi 4 / 5 with OpenPlotter V4 — primary target.
- Linux x64, macOS, Windows 11.
- Firefox, Chrome, Safari on iOS / Android.

### Disclaimer

This is a navigation aid, **not** a replacement for proper anchor watch with eyes on the boat. The author takes no responsibility for dragging, collision, grounding or any other incident. Use at your own risk.

### Contributing & support

Issues, PRs and feature requests welcome at the [GitHub repo](https://github.com/Aitonos/signalk-mareas-ihm).

### Acknowledgements

- **[@jeyrb](https://github.com/jeyrb)** — reported that other anchor watch apps in the SignalK ecosystem share the canonical vocabulary `navigation.anchor.*` and `notifications.navigation.anchor`, and that this plugin was living in its own custom namespace. That report drove the 2.8.0 interop work: canonical anchor paths are now published in parallel, notifications are auto-mirrored to standard SK paths, and every critical alarm carries `method:["push"]` for WilhelmSK iOS/iPadOS push. Thank you.
- **[@andmayfi92](https://github.com/andmayfi92)** — reported that when running outside our tide coverage area we were silently overwriting the `/signalk/v2/api/resources/tides` output of other tide plugins (opentide etc.) with our own empty response. That drove the 2.9.0 "shy provider" behaviour: we now detect other tide providers on the server and yield by default. Thank you.

### License

Apache 2.0. Derived from `signalk-tides` (Brandon Keepers, Joachim Bakke, Scott Bender and contributors).

---

<a id="espanol"></a>

## Español

Plugin de Signal K que convierte tu OpenPlotter / Raspberry Pi en un **gestor avanzado de fondeo y seguridad marina**: vigilancia inteligente del ancla, alarmas de voz, sistema AIS anti-colisión con cache persistente entre sesiones, previsión de abrigo, medición de olas a bordo y mareas oficiales del IHM de España.

**Interfaz user-friendly diseñada para usar con dedos a la luz del sol** — del Pi del puente al móvil en la bañera, todo el visor se adapta a tu pantalla manteniendo controles cómodos y textos legibles.

### Qué te llevas

Un único plugin de Signal K que convierte el ordenador del barco en un **gestor avanzado de fondeo** con todo lo que un navegante de verdad necesita:

- ⚓ **Vigilancia inteligente del ancla** con radio de borneo predictivo (marea + meteo en próximas 12 h) y auto-desarme al salir a motor.
- 🚢 **Sistema AIS anti-colisión** con cache persistente entre sesiones, lista filtrable por nombre/MMSI, slider de radio configurable, favoritos cross-device, integración vesselfinder y detección de garreo en barcos vecinos.
- 🌐 **Sincronización multi-dispositivo en tiempo real** vía SSE — móvil, tablet y chartplotter muestran el mismo estado.
- 🎙️ **Alarmas de voz** para garreo, colisión AIS y varada (voces naturales OGG, no sintéticas).
- 🏔️ **Previsión de abrigo** — rosa de 16 sectores con auto-detección desde costa OSM + escolleras, grado A-F + 0-100% protección, strip 12 h, degradación en tiempo real por veleta/IMU.
- 🌊 **Medición de olas a bordo** — historial 24 h desde el IMU (intensidad/período/altura por bin de 5 min).
- 📊 **Calculadora de fondeo** — cadena, scope, sonda, predicción de borneo.
- 🗺️ **Visor de cartas multicapa** — Batimetría mundial + Esri Satélite + IHM ENC S-52 + NOAA ENC (EE.UU.) + MBTiles offline + OpenStreetMap + OpenSeaMap + SK Charts, con transparencias ajustables.
- 🌅 **Mareas mundiales multi-fuente** con selección automática de motor por proximidad: IHM España oficial (>70 estaciones) → [`signalk-tides`](https://github.com/openwatersio/signalk-tides) si está instalado → motor de **NEAPS** por constantes armónicas embebido (~7600 estaciones NOAA + TICON-4) → Open-Meteo como último recurso.
- 🌤️ **Previsión meteo** Open-Meteo (ICON, GFS, ECMWF, Arome, GEM, JMA).
- 🌀 **Atajos integrados** a Windy, Windregatta.com, KIP, SK Freeboard.
- 📱 **Versátil en cualquier pantalla** — desde el móvil en mano hasta el monitor grande del puente. El visor se reordena solo y los botones se mantienen del tamaño adecuado para tocar sin equivocarte.
- 🇬🇧 🇪🇸 **UI bilingüe** con cambio en vivo desde el menú.
- 👥 **Control de usuarios por PIN** — protege las acciones del barco (echar/levar, alarmas, configuración) con un PIN maestro + PINs de invitado opcionales (tripulación de charter, familia, etc.) con notas y caducidad opcional. La lectura queda abierta.
- 🔗 **Vocabulario estándar de SignalK** — publica los paths canónicos `navigation.anchor.*` y `notifications.navigation.anchor` en paralelo a los nuestros propios, para que cualquier app de anchor watch de tu entorno SK vea y reaccione a nuestro estado de fondeo. El push nativo iOS/iPadOS de WilhelmSK funciona directamente (todas las alarmas críticas llevan `method:["push"]`).
- 🚢 **Motor AIS online** (aisstream.io) — feed AIS opcional gratuito crowd-sourced para barcos sin receptor AIS por VHF o para extender la cobertura del VHF. Auto-dedupe: tu VHF siempre prevalece; el feed online sólo rellena huecos. Republicado al árbol `vessels.*` de SignalK para que cualquier consumidor de tu entorno vea los targets.
- 🌊 **Proveedor de mareas "tímido"** — cede automáticamente el path `/signalk/v2/api/resources/tides` si hay otro plugin de mareas (opentide, signalk-tides, tidal-currents) activo en tu server, para que puedas instalarlo junto a ellos sin conflictos. Configurable por preferencia del usuario (auto / siempre publicar / nunca publicar).

Funciona en **Raspberry Pi** (OpenPlotter), **cualquier Linux** o **macOS / Windows** con Signal K Server.

### ⭐ Por qué este plugin

La mayoría de apps de anchor watch son de pago, código cerrado, un solo dispositivo y atadas al hardware del fabricante. Esta:

- Es **libre y open source** (Apache 2.0).
- Corre en tu **Signal K Server existente** — sin hardware extra.
- Muestra la **misma alarma en todos los dispositivos** (móvil, tablet, plotter, pantalla del Pi).
- Usa los **sensores reales del barco** (veleta, sonda, IMU) cuando están; cae a previsión si no.
- Tiene **UI user-friendly** que escala del móvil al monitor 4K del puente — textos legibles, controles del tamaño del dedo, sin desorden visual.
- Maneja los **casos límite** que sufre el navegante real: pérdida de datos AIS entre sesiones, falso positivo de garreo al salir motorizado, caída de GPS, bloqueo de autoplay del navegador, múltiples targets AIS en zona, snooze + un-snooze, etc.

### Funcionalidades en detalle

#### Vigilancia de fondeo
- **Radio de borneo predictivo**: combina sonda, cadena largada y ciclo de marea para predecir el área real de borneo en las próximas 12 h — no un círculo estático.
- **Dos métodos de cálculo de cadena**: ratio clásico y método Vicente (15 + 2 × sonda).
- **Detección de garreo** con sirena audible que bypassa el mute del usuario por seguridad.
- **Auto-desarme al salir a motor**: si el SOG se mantiene >3 kn durante 30 s, la vigilancia se desarma sola. No más sirenas cuando olvidas "levar" en la app.
- **Track GPS** con coloreado por gradiente temporal para ver exactamente por dónde ha pasado el barco.
- **Fondeos favoritos** guardados con nombre personalizado (o auto-nombrados por geolocalización), sincronizados entre todos tus dispositivos vía backend.

#### Sistema AIS anti-colisión
- **Base de datos persistente de barcos** durante las últimas 72 h — nombre, eslora, manga, tipo, callsign, IMO. Los barcos aparecen ya con sus datos sin esperar al próximo paquete AIS estático (que tarda hasta 6 minutos).
- **Cache fantasma de 5 minutos** — cuando un target pierde recepción VHF brevemente, sigue visible en el mapa con una X discreta indicando "datos estimados".
- **Slider de radio configurable** (0.5–50 km) controla qué barcos ves en mapa y en lista.
- **5 criterios de ordenación**: distancia, nombre, favoritos primero, MMSI o tipo de barco.
- **Caja de filtro** por nombre/MMSI con feedback "Sin resultados".
- **★ Favoritos** persistidos en el backend, sincronizados entre dispositivos.
- **🔍 Botón vesselfinder** por fila — abre vesselfinder.com en una pestaña nueva con IMO + MMSI.
- **Alarma de voz** cuando un target entra en tu zona de borneo; 30 s de gracia antes de que arranque la voz.
- **ACK por target** con timestamp; silenciar un barco no desactiva la alarma para otros.
- **Detección de garreo en vecinos** — si un barco ya ACKeado reanuda movimiento hacia ti (>0.5 kn + acercamiento >5 m/min), la alarma se reactiva.
- **Click-to-focus**: click en cualquier target → el mapa lo centra, lo sigue y muestra su distancia junto al aro azul de selección. Click en la X del aro para soltar.
- **Emoji por tipo**: lista y popup muestran ⛵ velero / 📦 carga / 🛢️ tanque / 🛳️ pasaje, etc. a primera vista.
- **Estimación del ancla** de otros barcos vía análisis de centroide del track.

#### Previsión de abrigo
- **Rosa de 16 sectores** con detección automática abierto/abrigado desde la línea de costa de OpenStreetMap + escolleras/muelles man-made.
- **Grado A-F** + **% de protección 0-100** calculado desde el viento previsto en sectores expuestos.
- **Strip de 12 h** con grado por hora y viento pico.
- **Historial de olas 24 h** desde el IMU a bordo (bins de 5 minutos, eje vertical autoescalable hasta 2 m).
- **Degradación en tiempo real**: si el viento medido por la veleta es mayor que el previsto en un sector expuesto, el grado baja automáticamente.

#### Mareas
- **Motor multi-fuente automático** elegido por proximidad al barco, con degradado limpio:
  1. **IHM España oficial** (>70 puertos) — máxima prioridad dentro de aguas españolas.
  2. **[`signalk-tides`](https://github.com/openwatersio/signalk-tides)** — si el plugin de openwatersio está instalado lo llamamos como puente, respetando su datum y su catálogo de estaciones.
  3. **Motor NEAPS por constantes armónicas** *(embebido, ~7 600 estaciones)* — [openwatersio/neaps](https://github.com/openwatersio/neaps) + `@neaps/tide-database` (NOAA ~3 400 EE.UU. + TICON-4 ~4 200 mundiales). Resolución sub-minuto en tiempo, precisión milimétrica en altura, todo local (sin red). Los extremos se referencian al LAT (Lowest Astronomical Tide) calculado sobre 365 d, así las alturas coinciden con el "cero" del puerto que publica IHM/NOAA.
  4. **Open-Meteo global** (FES2014) — último recurso cuando no hay estación NEAPS a menos de 80 km.
- **Wizard de configuración** con selector Auto/Manual y **búsqueda por ciudad** para la estación: escribe "Sídney" o "San Francisco" y el asistente geocodifica, busca la estación NEAPS predecible más cercana y muestra la distancia; si ninguna está a menos de 100 km ofrece Open-Meteo automáticamente.
- **Override manual de estación** persistente entre reinicios; el backend es la fuente de verdad.
- **Curva de marea interactiva** con cursor, picos y caché offline de 2 meses.
- **Sin API key** para ninguna fuente de mareas.

#### Previsión meteo
- **Open-Meteo** integrado (gratis, sin API key, sin problemas de rate limit).
- **Múltiples modelos**: ICON (DWD), GFS (NOAA), ECMWF, Météo-France Arome, GEM, JMA.
- **Temperatura del mar, altura, período y dirección de ola** cuando están disponibles.
- **Tabla horaria 48 h** + resumen colapsable en lenguaje claro.

#### Audio y alarmas
- **Clips de voz por idioma (OGG)** — naturales, no síntesis robótica.
- **Snooze 5 min** para AIS (garreo nunca es snoozable por seguridad).
- **Ventana mute-usuario 60 s** — si silencias manualmente, ni el garreo crítico puede reactivar el audio durante 60 s.
- **Consciente de visibilidad**: cuando la pantalla del móvil despierta, el audio se reanuda automáticamente.
- **Vibración fallback** en Android cuando la política de autoplay bloquea el audio.

#### Cartas y capas
- **Satélite Esri**, **IHM ENC S-52** (cartas oficiales España), **NOAA ENC** (cartas oficiales EE.UU.), **Batimetría**, **OpenStreetMap**, **OpenSeaMap** señalización marítima, **Bing Hybrid**, **Esri Clarity**, **Google Satélite**.
- **MBTiles offline** — pon tus archivos `.mbtiles` en una carpeta y aparecen automáticamente.
- **Cartas registradas en Signal K** — cualquier carta registrada con Signal K aparece como capa.
- **Slider de opacidad por capa** con valores por defecto editables.

#### Domótica / KIP / Freeboard
- **Botones KIP** para echar/levar y conmutar alarmas — abre Freeboard-SK con un toque desde la sidebar.
- **Endpoints REST** para Alexa, Google Home, Node-RED, puentes MQTT, dashboards a medida.
- **Endpoint `/toggle`** para mandos remotos de un solo botón.

#### Control de usuarios (multi-PIN, nuevo en 2.4.0)
- Modelo **Maestro + Invitados**. El primer PIN creado es el maestro (gestiona el control + uso normal). El maestro puede añadir PINs de invitado en cualquier momento.
- **La lectura pública sigue abierta**. Sólo las acciones que mutan estado (echar/levar, alarmas, configuración, gestión de PINs) requieren PIN válido. Quien sólo mira el mapa o las mareas ve los mismos datos que antes.
- **Caducidad opcional por invitado** con botones rápidos: sin caducidad, +1 día, +7, +30, +90, +1 año. A la tripulación del charter le pones un PIN que caduca el domingo; a la familia uno permanente.
- **Notas** y **PIN visible al maestro** — el maestro abre la ficha del invitado y ve su PIN en claro (el fichero vive en la Pi del propio armador, tratado como local del barco).
- **Lista de usuarios activos** muestra cada sesión con dispositivo (OS · navegador), IP y minutos/horas/días restantes. El maestro puede revocar cualquier sesión de invitado desde su terminal.
- **Sesión del maestro persistente** (cookie TTL 1 año) — el armador no re-introduce PIN cada 30 minutos. Las sesiones de invitado se ajustan a la caducidad de su PIN.
- **Cero setup de cuentas Signal K**. No hay que tocar `/admin/#/security`; todo vive dentro del plugin.

### URLs

| URL | Función |
|-----|---------|
| `/signalk-mareas-ihm/` | Landing — Mareas o Anchor Watch |
| `/signalk-mareas-ihm/mareas` | Vista mareas (directo) |
| `/signalk-mareas-ihm/visorfondeo` | Anchor Watch viewer (directo) |
| `/signalk-mareas-ihm/mobile` | Vista mobile-first (recomendada en móviles) |

### Domótica — endpoints REST

```bash
# Echar o levar con un botón (auto-detecta el estado actual)
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/toggle

# Echar ancla en GPS actual
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/drop

# Levar ancla
curl -X POST http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/lift

# Estado JSON simple (para monitorización / dashboards)
curl http://openplotter.local:3000/signalk-mareas-ihm/api/anchor-watch/simple
```

### Requisitos mínimos

El plugin es ESM puro y usa features modernas. Stacks antiguos no lo cargarán (`ERR_REQUIRE_ESM`).

| Componente | Mínimo | Notas |
|---|---|---|
| **OpenPlotter** | **V4** | V3 viene con SK 1.x que no puede cargar plugins ESM. |
| **Signal K Server** | **≥ 2.0** | 1.x usa `require()` para plugins → `ERR_REQUIRE_ESM`. |
| **Node.js** | **≥ 20** | LTS. |
| **Locale del sistema** | **UTF-8 (p. ej. `es_ES.UTF-8`)** | Un locale no-UTF-8 hace que RTIMULib/pypilot parseen mal los valores del giróscopo y devuelvan ruido de 10-15° en el roll (rompe el motor de olas). Comprueba con `locale`. |
| Fuente emoji (opc.) | `fonts-noto-color-emoji` | Sin ella, los botones salen como cuadrados vacíos en Chromium/Pi. `sudo apt install fonts-noto-color-emoji`. |
| Motor de voz | `espeak` | Obligatorio para las alarmas de voz. Suele estar ya instalado en OpenPlotter. |

⚠ **NO actives `@signalk/set-system-time`** (viene con Signal K, a veces activado por defecto en OpenPlotter con internet). Ejecuta `date -u -s` cada 60 s con resolución de 1 s y corrompe el filtro de Kalman del IMU → "olas fuertes" fantasma en puerto y saltos de attitude. Desactívalo en **SK → Server → Plugin Config → Set System Time → OFF**.

### Instalación rápida

Desde el **Appstore de Signal K**: busca `signalk-mareas-ihm` y pulsa instalar.

O desde la línea de comandos:

```bash
cd ~/.signalk
npm install signalk-mareas-ihm@latest --save
sudo systemctl restart signalk
```

Después abre: `http://tu-pi.local:3000/signalk-mareas-ihm/`

### Probado en

- Raspberry Pi 4 / 5 con OpenPlotter V4 — objetivo principal.
- Linux x64, macOS, Windows 11.
- Firefox, Chrome, Safari en iOS / Android.

### Aviso legal

Es una **ayuda a la navegación**, NO un sustituto del anchor watch con vigilancia humana. El autor no se responsabiliza de garreos, colisiones, varadas ni ningún otro incidente. Uso bajo tu propia responsabilidad.

### Contribuir y soporte

Issues, PRs y peticiones de funcionalidad en el [repo de GitHub](https://github.com/Aitonos/signalk-mareas-ihm).

### Agradecimientos

- **[@jeyrb](https://github.com/jeyrb)** — reportó que otras apps de anchor watch del ecosistema SignalK comparten el vocabulario canónico `navigation.anchor.*` y `notifications.navigation.anchor`, y que este plugin vivía en su propio namespace. Ese reporte fue el que dio pie al trabajo de interop de la 2.8.0: los paths canónicos de fondeo se publican en paralelo, las notificaciones se espejan automáticamente a los paths estándar SK, y toda alarma crítica lleva `method:["push"]` para el push nativo iOS/iPadOS de WilhelmSK. Gracias.
- **[@andmayfi92](https://github.com/andmayfi92)** — reportó que al ejecutarse fuera de nuestra área de cobertura de mareas estábamos sobreescribiendo silenciosamente el output de `/signalk/v2/api/resources/tides` de otros plugins (opentide etc.) con nuestra respuesta vacía. Eso dio pie al comportamiento "proveedor tímido" de la 2.9.0: ahora detectamos otros proveedores de mareas en el server y cedemos por defecto. Gracias.

### Licencia

Apache 2.0. Derivado de `signalk-tides` (Brandon Keepers, Joachim Bakke, Scott Bender y contribuidores).
