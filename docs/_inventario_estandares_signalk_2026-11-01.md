# Inventario: qué de mareas-ihm merece ir a Signal K como estándar o plugin aparte

Fecha: 2026-11-01. Idea de Carlos: "las buenas ideas hay que intentar
estandarizarlas en la medida de lo posible para construir un Signal K más
rico y modular". Para cada pieza: qué hace en mareas, qué hay hoy en el
ecosistema (búsqueda en NPM del 2026-11-01) y la vía propuesta.

## Resumen por prioridad

| # | Pieza | Hueco en Signal K | Vía | Esfuerzo |
|---|---|---|---|---|
| 1 | Audio de alarmas en el altavoz del barco | Grande: nadie lo hace | Plugin nuevo, separado de mareas | Medio |
| 2 | AIS dentro del círculo de borneo | Medio: collision-alerts no sabe de fondeo | PR a collision-alerts | Bajo |
| 3 | Zonas de puerto (`zoneType`) | En marcha | signalk-server#3271 + collision-alerts#47 | Hecho, en revisión |
| 4 | Tablas oficiales IHM como fuente de mareas | Medio: signalk-tides usa Neaps | Aportar fuente a signalk-tides / Neaps | Medio |
| 5 | Oleaje estimado con la IMU | Grande: no hay rutas estándar ni plugin | Propuesta de rutas + plugin | Medio-alto |
| 6 | Nombres AIS en el árbol para todas las apps | Pequeño | Aportar a signalk-target-fusion | Bajo |
| 7 | Catálogo de cartas oficiales por país | Pequeño | Lista de fuentes para Freeboard / charts-provider | Bajo |
| 8 | Abrigo (costa y viento) | Grande, pero muy nuestro | Plugin aparte más adelante | Alto |

## 1. Audio de alarmas en el altavoz del barco (el más claro)

**En mareas:** canal de audio propio en la Pi: sirena + voz (OGG grabadas o
espeak) por PulseAudio hacia una salida fija (el DAC USB), en bucle mientras
dura la alarma, con prioridad por gravedad y anulación del silencio en el
garreo. Suena con el monitor apagado y sin ningún navegador abierto
(`docs/AUDIO_FLOW.md`).

**En Signal K hoy:** las notificaciones llevan `method: ["sound"]`, pero
ningún componente del servidor las hace sonar: cada app (Freeboard, KIP,
nuestros visores) suena solo en su navegador, y el navegador exige que el
usuario toque la pantalla antes. Lo más parecido: un plugin que activa un
avisador de hardware de una marca concreta y un motor de notificaciones con
Node-RED. Ninguno saca sonido y voz por un altavoz elegido.

**Propuesta:** plugin aparte, por ejemplo "notification sounder":

- escucha **todas** las notificaciones con `method` sonoro (de collision-alerts,
  pypilot, fondeo, motor, baterías…);
- las reproduce en la salida que elija el usuario (lista de salidas de
  PulseAudio/ALSA), con sonido según el estado (`alert`, `warn`, `alarm`,
  `emergency`) y la voz leyendo el `message` (espeak, sin dependencias de
  pago);
- respeta ACK y silencio de la API de notificaciones, así que callarla desde
  Freeboard la calla en el altavoz;
- opción de "no silenciable" para estados `emergency`.

mareas pasaría a solo emitir notificaciones y el audio lo haría ese plugin,
igual para cualquier otro. Es la pieza con más valor para todos.

## 2. AIS dentro del círculo de borneo (fondeo)

**En mareas:** con el ancla echada, avisa si un barco AIS entra en el círculo
de borneo (radio + margen + eslora del otro, 10 m si no la emite), con un
tiempo de confirmación y ACK por barco. No mira la velocidad, así que el
vecino que garrea y emite 0 kn avisa, y el fondeado lejano que bornea no.

**En Signal K hoy:** collision-alerts calcula CPA/TCPA, que es lo correcto
navegando; al fondeo detecta el garreo del otro por su movimiento, pero no
usa tu círculo de borneo. Las rutas estándar `navigation.anchor.position` y
`navigation.anchor.maxRadius` existen y las publican mareas y otros plugins
de fondeo.

**Propuesta:** después de collision-alerts#47, una PR que, con el ancla
echada (esas rutas presentes), avise de cualquier barco que entre en el
círculo de borneo, se mueva o no. Pequeña y útil para todos los plugins de
fondeo.

## 3. Zonas de puerto (`zoneType`)

En marcha: propuesta del estándar en signalk-server#3271 y la parte de
collision-alerts en la PR #47 (barcos parados dentro de zonas de puerto,
atraque o campo de boyas no dan alarma).

## 4. Tablas oficiales IHM como fuente de mareas

**En mareas:** mareas oficiales del IHM (España) con varios respaldos
(Neaps, Open-Meteo, signalk-tides).

**En Signal K hoy:** signalk-tides (predicción con Neaps) y signalk-tides-api.

**Propuesta:** aportar el IHM como fuente a signalk-tides (o los datos de
estaciones a Neaps), para que cualquiera en España tenga la marea oficial.
Hay que revisar antes las condiciones de uso de los datos del IHM.

## 5. Oleaje estimado con la IMU

**En mareas:** estimación de altura y periodo de ola a partir de la IMU
(motores v1 para fondeo y v2 para navegación).

**En Signal K hoy:** no hay plugin que lo haga, y hay que comprobar en la
especificación si existen rutas para oleaje observado a bordo.

**Propuesta:** primero acordar rutas (altura significativa, periodo,
dirección) en la especificación; después, un plugin que las calcule con
cualquier IMU que publique `navigation.attitude` y aceleraciones. Más
trabajo, pero no existe nada parecido.

## 6. Nombres AIS en el árbol para todas las apps

**En mareas:** completa el nombre de los barcos AIS en el árbol de Signal K
(forma canónica `path: ""` con objeto) a partir de las fuentes online, para
que Freeboard, KIP y el resto muestren nombre y no solo el MMSI.

**En Signal K hoy:** signalk-target-fusion une objetivos de varios sensores.

**Propuesta:** proponerlo a target-fusion como enriquecimiento de identidad,
o como plugin mínimo aparte.

## 7. Catálogo de cartas oficiales por país

**En mareas:** cartas por país configurables (IHM, IGN, NOAA, Kartverket,
Traficom, CHS…).

**Propuesta:** aportar la lista de fuentes (WMS/WMTS con sus condiciones de
uso) a la documentación de Freeboard-SK o a charts-provider-simple como
catálogo, para no tener que buscar cada URL.

## 8. Abrigo

**En mareas:** cálculo de abrigo según la costa y el viento previsto.
Valioso pero muy ligado a mareas; plugin aparte más adelante si hay interés.

## Lo que no merece la pena llevar

- Motores AIS online (aisstream, aishub, aisfriends): ya existen
  signalk-aisstream y signalk-aishub-ws. Como mucho, aportar a esos plugins
  la gestión de límites de peticiones (reintentos con espera creciente).
- PIN maestro / invitados: Signal K ya tiene su seguridad de usuarios.
- Diagnóstico de memoria: lo cubre signalk-performance-monitor.
- Telegram: integración nuestra, sin necesidad de estándar.

## Orden recomendado

1. Esperar respuesta a #3271 y #47.
2. PR de fondeo (2), que reutiliza lo aprendido con #47.
3. Plugin de audio (1), sacándolo de mareas sin romper lo que funciona: mareas
   lo usa si está instalado y si no, sigue con su canal propio.
4. Fuente IHM (4) tras revisar las condiciones de uso.
5. Oleaje (5) cuando haya datos de mar suficientes para validarlo.
