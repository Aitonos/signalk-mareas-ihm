# Prompt para GPT-5 / Gemini Pro — Tiles del mapa lentas SOLO en Firefox del Raspberry Pi

> Pegar este archivo entero en hilos SEPARADOS en GPT-5 y en Gemini Pro 2.5.
> NO condicionar a ningún LLM con la respuesta del otro. Después comparo
> respuestas: convergencias = validan; divergencias = revelan decisiones.

## Lo que quiero del LLM

1. **Diagnóstico** de las hipótesis más probables (ordenadas), con
   justificación desde RFC 7234 / RFC 8246 y comportamiento real de cada motor.
2. **Experimentos discriminatorios concretos** (qué medir, qué umbral indica
   qué hipótesis).
3. **Plan de fix** priorizado por impact/esfuerzo, con código TypeScript de
   ejemplo si aplica.

No me deis "best practices generales de caché". Quiero diagnóstico **específico
para esta combinación**: Firefox ESR 128 en aarch64 + Raspberry Pi + tiles
proxeadas vía Express + handler concreto que pego abajo.

---

## Síntoma observado

**El HTML, JS, iconos AIS y toda la UI cargan al instante.** Lo único que tarda
son **las cartas náuticas (tiles)**. Aparecen 20-25 s después de la UI.

| Reload | Resultado |
|---|---|
| `Ctrl+Shift+R` (hard refresh, bypass cache) | **Rápido** (~3-5 s) |
| `F5` / `Ctrl+R` (soft reload, revalidate) | **Lento** (~25 s) |
| Primera carga "en frío" sin caché | Lento |

Es decir: el hard refresh es MÁS RÁPIDO que el soft reload, lo opuesto a lo
intuitivo.

**Y además — usabilidad continua afectada**: pan y zoom del mapa también van
lentos en Firefox-on-Pi. Cuando el usuario arrastra el mapa o cambia el zoom,
las tiles nuevas que entran en el viewport tardan visiblemente, en algunos
casos 2-5 s para que aparezcan. Esto descarta que el problema sea
exclusivamente la revalidación HTTP del soft reload: incluso con cache
saliente, las tiles **nuevas** (coordenadas que aún no estaban en cache) se
piden lentas. Pasa SOLO en Firefox-on-Pi; en Chromium-on-Pi pan/zoom va fluido.

Otros clientes en la misma red:

| Cliente | Tiles |
|---|---|
| **Chromium en la MISMA Pi** (mismo hardware, misma red, mismo handler) | Perfecto, ambos modos rápidos |
| Firefox en Windows 11 via Tailscale hacia la Pi | Perfecto |
| Opera Mobile (Android) via Tailscale | Perfecto |
| **Firefox ESR 128 en la Pi** (OpenPlotter V4, Wayland, aarch64) | **LENTO en soft reload** |

Hace meses no pasaba. Algún cambio reciente lo introdujo; no tenemos commit
identificado.

---

## Handler de tiles relevante

`src/index.ts`, líneas 3611-3648:

```typescript
expressApp.get("/signalk-mareas-ihm/navtiles/:z/:x/:y.png", async (req, res) => {
  const sendFallback = () => {
    if (res.headersSent) { try { res.end(); } catch {} return; }
    try { res.status(502).set("Content-Type","image/png").send(TRANSPARENT_PNG); } catch {}
  };
  try {
    const { token, bearer } = await fetchChartTokens();
    const z = req.params.z, x = req.params.x, y = req.params.y;
    const layer = req.query.layer || "1";
    const tileUrl = `https://tile1.navionics.com/viewer/api/v1/tile/${z}/${x}/${y}?config=${token}&transparent=true&ugc=true&layer=${layer}&du=1&sd=2&sa=false`;
    const tileReq = https.get(tileUrl, {
      headers: {
        "Authorization": `Bearer ${bearer}`,
        "Referer": "https://maps.garmin.com/",
        "Origin": "https://maps.garmin.com"
      }
    }, (tileResp) => {
      if (res.headersSent) { try { tileResp.destroy(); } catch{} return; }
      const ct = tileResp.headers["content-type"] || "image/png";
      res.set("Content-Type", ct);
      res.set("Cache-Control", "public, max-age=15552000, immutable");
      tileResp.on("error", sendFallback);
      tileResp.pipe(res);
    });
    tileReq.on("error", sendFallback);
    tileReq.end();
  } catch {
    sendFallback();
  }
});
```

**Observaciones del handler:**
- Setea `Cache-Control: public, max-age=15552000, immutable` (180 días + immutable).
- **NO emite `ETag`** propio.
- **NO emite `Last-Modified`** propio.
- **NO lee `If-Modified-Since` ni `If-None-Match`** del request → nunca responde 304.
- Siempre proxea fresco a Navionics y devuelve 200 con el cuerpo completo.
- Los headers que vienen de Navionics se pipean tal cual al cliente (los headers de Navionics no los conocemos sin trazar; podemos asumir que sí emite ETag).

---

## Tiles renderizadas con Leaflet

`mobile.html` línea 2706:
```javascript
map=L.map('map',{zoomControl:true,attributionControl:true,minZoom:12,maxZoom:22,zoomSnap:1,zoomDelta:1,wheelPxPerZoomLevel:120}).setView([42.24,-8.72],16);
```

Capas tile principales:
```javascript
osmL=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:22,maxNativeZoom:19,subdomains:'abc'});
seaL=L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{maxZoom:22,maxNativeZoom:18,opacity:.8});
satL=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:22,maxNativeZoom:19,crossOrigin:true});
navL=L.tileLayer(B+'/navtiles/{z}/{x}/{y}.png?layer=1',{maxZoom:22,opacity:.13});
// MBTiles charts (custom GridLayer canvas-fallback):
new MBLayer({
  maxZoom:22, opacity:.9,
  updateWhenIdle:false,        // ← tiles se piden DURANTE el pan, no al final
  updateWhenZooming:true,      // ← idem durante zoom
  keepBuffer:4,                // ← mantiene 4 tiles fuera de viewport en cada lado
  tileSize:256
});
// SignalK charts plugin (chart plotter tiles):
L.tileLayer(url,{
  maxZoom:22,
  keepBuffer:4,
  updateWhenIdle:false,
  updateWhenZooming:true
});
```

**Detalle clave**: `updateWhenIdle:false` + `keepBuffer:4` significa que cada
movimiento de pan dispara docenas de requests HTTP simultáneas, y el zoom
también. Por viewport típico (Pi 4 con monitor 1080p) + buffer: **~60-120
tiles totales** entre OSM + Sea + Sat + Nav + MBTiles + Charts (sumando
varias capas activas a la vez).

---

## Sospechas que YO tengo (esto es lo que quiero que validéis)

### Hipótesis A — Firefox revalidates sub-resources en soft reload pese a `immutable`

RFC 8246 ("HTTP Immutable Responses") dice que `Cache-Control: immutable` debe
inhibir revalidation en soft reload. Chromium lo respeta de toque desde 2018
(incluso para sub-resources tipo `<img>`).

Firefox tardó más en adoptarlo, y hay reportes de que Firefox ESR (que usa
OpenPlotter) sigue revalidando sub-resources en soft reload aunque la
respuesta original tuviera `immutable`. En soft reload Firefox manda
`Cache-Control: max-age=0` al servidor → el handler proxea a Navionics →
devuelve cuerpo completo → 200, no 304 → re-descarga.

50-100 tiles × ~300 ms / tile (Navionics + red 4G/EMI del Pi) = 25 s.

Test rápido: forzar el navegador a NO revalidar y ver si Firefox-Pi soft reload
acelera.

### Hipótesis B — Disk cache en la SD card del Pi

`/home/pi/.cache/mozilla/firefox/.default/cache2/entries/`. La SD card del Pi
4 tiene IO random catastrófico (~5-10 IOPS sostenidos). Chromium quizá usa
memory cache más agresiva por defecto; Firefox spillea a disk.

En soft reload Firefox tendría que abrir cada entry del disk cache → SD lenta
→ + ya revalida (hipótesis A) → 25 s.

Counter: Chromium también escribe a SD. Pero su política de cache puede ser
diferente (más en RAM, menos en disk; lazy-write).

### Hipótesis C — Falta de ETag/Last-Modified rompe la heurística freshness

Sin `ETag` ni `Last-Modified`, Firefox puede no aplicar la heurística de
freshness HTTP/1.1 sec 4.2.2 correctamente, decidiendo "no sé cuándo cambió
→ revalido por si acaso", aunque haya `max-age=15552000`.

Chromium puede confiar más en `max-age` cuando hay `immutable` aunque falten
los validators. Firefox-ESR antiguo puede ser más conservador.

### Hipótesis D — Sin keep-alive / sin HTTP/2 en el upstream a Navionics

El handler hace `https.get()` con cada petición → handshake TLS nuevo al
upstream Navionics por cada tile cuando Firefox revalida. 50 tiles × ~500 ms
de handshake TLS = se va a varios segundos.

Si añadiéramos un agente HTTP/2 reutilizado, o caché local en disco del Pi (no
SD del browser sino del backend), el revalidate sería de Pi → Pi (ms), no
Pi → Atlántico → Pi.

### Hipótesis E — Algo en SignalK reverse-proxy delante de Express

SignalK server expone el plugin bajo `/signalk-mareas-ihm/...`. Si el reverse
proxy interno del SignalK añade `Cache-Control: no-cache` u otra cabecera, la
`immutable` que setea el handler puede quedar pisada en el response que ve
Firefox. Chromium y Firefox pueden interpretar el conjunto de cabeceras
distinto.

Test: mirar response headers reales en Firefox DevTools Network.

### Hipótesis F — Pool HTTP/1.1 por host limitado en Firefox vs Chromium

`network.http.max-persistent-connections-per-server` default en Firefox = **6**.
Chromium = **6** también, peeero Chromium prioriza HTTP/2 multiplexing cuando
está disponible y abre H2 a TODOS los hosts compatibles agresivamente. Firefox
hace H2 también pero su pool de TCP previo + DNS sobre Wayland puede
serializar más.

Con `updateWhenIdle:false` + 5-6 capas tile activas, un pan dispara **80-120
requests simultáneas** repartidas entre ~5 hosts (unpkg, tiles.openstreetmap,
arcgis, tiles.openseamap, localhost). Al backend local se mandan 30-50 tiles.
Si el backend Node responde con HTTP/1.1 (sin keep-alive bien configurado o
sin H2), Firefox abre 6 sockets paralelos y serializa el resto en colas.

Chromium hace **prefetch/preconnect** más agresivo y reutiliza sockets mejor
cuando el host es localhost. Firefox ESR puede ser más conservador.

### Hipótesis G — Disk-cache write back-pressure en SD card

Firefox cache2/ guarda CADA tile descargada en disco. SD card random write =
5-10 MB/s sostenido, peor con kingston/sandisk baratos. Cada tile ~10-30 KB.
Pan que pide 80 tiles = ~2 MB de write → 200-400 ms de IO bloqueante. Pero
PEOR: Firefox aarch64 puede bloquear el render thread cuando la cola de write
está llena (back-pressure).

Chromium puede tener cache config distinto (RAM-first más agresivo) y/o write
asíncrono con menor back-pressure observable.

Test: deshabilitar el disk cache de Firefox en `about:config`
(`browser.cache.disk.enable = false`, `browser.cache.memory.enable = true`,
`browser.cache.memory.capacity = 524288`) y reproducir pan/zoom. Si pasa de
lento a fluido, esta es la causa.

### Hipótesis H — Handler no reusa `https.Agent` para upstream Navionics

```typescript
const tileReq = https.get(tileUrl, { headers: {...} }, ...);
```

Sin pasar un `agent` con `keepAlive:true`, cada tile abre nueva conexión TCP+TLS
a Navionics (~150-400 ms handshake). Con 30 tiles pedidas en ráfaga al hacer
pan, el upstream stalls. Pero esto afectaría también a Chromium (que pide al
mismo backend). Salvo que el backend ya tenga keep-alive y Firefox dispare
más requests por ser más agresivo invalidando cache (combinación con A/G).

---

## Lo que NECESITO del LLM

### Bloque A — Diagnóstico priorizado (con RFC en mano)

Ordenad las 8 hipótesis (o añadid otras) por probabilidad de ser la causa
dominante del delta Firefox-Pi vs Chromium-Pi en **dos escenarios distintos**:

1. **Soft reload** (carga lenta inicial 25 s).
2. **Pan/zoom continuo** (cada nuevo viewport tarda 2-5 s).

Algunas hipótesis explican uno pero no el otro. Quiero saber cuáles cubren
ambos (probables culpables principales) y cuáles explican solo uno (factores
secundarios).

Razonad con:
- Comportamiento documentado de Firefox ESR 128 ante `Cache-Control: immutable`
  en **sub-resources** (no top-level navigation).
- Diferencias del HTTP cache de Gecko vs Blink en aarch64 sin WebRender.
- Política de conexiones HTTP/1.1 y promoción a H2 por host en cada motor.
- Cost del disk-cache en SD card.
- Lo que el handler **emite** y lo que **falta** (ETag, Last-Modified, soporte
  a If-Modified-Since/If-None-Match, keep-alive al upstream).
- Cómo se traduce "soft reload" en cada browser para sub-resources de
  `<img>` cargados por Leaflet (Leaflet usa elementos `<img>`).
- Impacto de `updateWhenIdle:false` durante pan/zoom continuo.

### Bloque B — Experimentos discriminatorios

Dame 3-5 experimentos que pueda correr SIN reescribir nada. Cada uno con:

1. **Qué hacer** (línea concreta a editar o `curl` a lanzar).
2. **Qué medir** (Network tab, columna concreta).
3. **Qué umbral indica qué hipótesis**.

Ejemplos del nivel que quiero:

> "En el handler, añadid `res.set('ETag', \`tile-${z}-${x}-${y}\`);` antes
> del pipe. Recargad Firefox-Pi con F5 dos veces seguidas. Si el segundo F5
> baja de 25 s a < 5 s y el Network panel muestra 304s, la causa es la
> hipótesis C (falta de validators). Si sigue tardando, es A o B."

### Bloque C — Plan de fix priorizado

Asumid que confirmamos las 1-2 hipótesis dominantes. Dadme el fix MÍNIMO en
TypeScript para el handler `expressApp.get("/signalk-mareas-ihm/navtiles/...`,
y/o cambios de cabeceras, ordenados por relación impact / esfuerzo. Predecid
en segundos cuánto debería bajar el tiempo de soft reload tras cada fix.

Quiero que penséis si:

- Hace falta **maneja 304** dentro del handler (cómo, con qué validator).
- Hace falta **caché en disco local del Pi** del lado backend (TTL? path?
  qué pasa si Navionics caduca el token).
- Hace falta **trucar a Firefox** mandando `Last-Modified: 2000-01-01` y
  respondiendo 304 incondicional a `If-Modified-Since` posteriores.

---

## Restricciones de la solución

- **NO service worker**. Riesgo de PWA zombie en cache vieja, hemos sufrido.
- **NO migrar a bundler / React** el mobile.html.
- **NO romper el caso bueno** de Chromium-on-Pi y Firefox-Windows.
- **Sí acepto** añadir validators, manejar 304, cachear tiles en disco del
  Pi (con eviction LRU), reutilizar `https.Agent`, o cualquier combinación
  de las tres.
- **Tiles de carta no cambian** salvo que Navionics empuje una actualización,
  algo MUY infrecuente. Aceptamos que un cambio se vea con un retraso de
  días tras un reload bypass-cache manual del usuario.

---

## Datos adicionales que puedo aportar si los pedís

- Response headers exactos que ve Firefox-Pi (Network tab) — los capturo y os los paso.
- Versión exacta de Firefox ESR del OpenPlotter.
- Versión de Node y de Express.
- Si hay un reverse-proxy delante del plugin (creo que SignalK monta los
  plugins en su propio router; no nginx adicional).
- UA exacto de Firefox-on-Pi vs Chromium-on-Pi.

Decid qué necesitáis y os lo paso.

---

Fin del prompt. Responder en español técnico (o inglés si lo preferís — el
usuario es bilingüe).
