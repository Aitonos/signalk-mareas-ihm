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
- 🌅 **Official IHM Spain tides** (>70 stations) + worldwide FES2014 fallback.
- 🌤️ **Weather forecast** via Open-Meteo (ICON, GFS, ECMWF, Arome, GEM, JMA).
- 🌀 **Built-in shortcuts** to Windy, Windregatta.com, KIP, SK Freeboard.
- 📱 **Works on any screen** — from a phone in hand to the big bridge monitor. The viewer reorders itself and buttons stay the right size for finger-touch use.
- 🇬🇧 🇪🇸 **Fully bilingual UI** (English / Spanish) — switch live from the menu.

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
- **Official IHM Spain predictions** for >70 stations with annual HAT/LAT and constituent coefficients.
- **Worldwide fallback** via Open-Meteo / FES2014 (USA, UK, Australia, Japan, etc.).
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

- Raspberry Pi 4 (OpenPlotter V4) — primary target.
- Linux x64, macOS, Windows 11.
- Firefox, Chrome, Safari on iOS / Android.

### Disclaimer

This is a navigation aid, **not** a replacement for proper anchor watch with eyes on the boat. The author takes no responsibility for dragging, collision, grounding or any other incident. Use at your own risk.

### Contributing & support

Issues, PRs and feature requests welcome at the [GitHub repo](https://github.com/Aitonos/signalk-mareas-ihm).

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
- 🌅 **Mareas oficiales IHM España** (>70 estaciones) + fallback global FES2014.
- 🌤️ **Previsión meteo** Open-Meteo (ICON, GFS, ECMWF, Arome, GEM, JMA).
- 🌀 **Atajos integrados** a Windy, Windregatta.com, KIP, SK Freeboard.
- 📱 **Versátil en cualquier pantalla** — desde el móvil en mano hasta el monitor grande del puente. El visor se reordena solo y los botones se mantienen del tamaño adecuado para tocar sin equivocarte.
- 🇬🇧 🇪🇸 **UI bilingüe** con cambio en vivo desde el menú.

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
- **Predicciones oficiales IHM España** para >70 estaciones con HAT/LAT anual y coeficientes de constituyentes.
- **Fallback mundial** vía Open-Meteo / FES2014 (USA, UK, Australia, Japón, etc.).
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

- Raspberry Pi 4 (OpenPlotter V4) — objetivo principal.
- Linux x64, macOS, Windows 11.
- Firefox, Chrome, Safari en iOS / Android.

### Aviso legal

Es una **ayuda a la navegación**, NO un sustituto del anchor watch con vigilancia humana. El autor no se responsabiliza de garreos, colisiones, varadas ni ningún otro incidente. Uso bajo tu propia responsabilidad.

### Contribuir y soporte

Issues, PRs y peticiones de funcionalidad en el [repo de GitHub](https://github.com/Aitonos/signalk-mareas-ihm).

### Licencia

Apache 2.0. Derivado de `signalk-tides` (Brandon Keepers, Joachim Bakke, Scott Bender y contribuidores).
