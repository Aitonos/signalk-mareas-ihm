# Prompt para Gemini / GPT — versión antigua del visor sigue cargando + frame negro del modal Instrucciones

## Contexto del proyecto

Plugin SignalK con UI híbrida:
- **mobile.html** (vanilla JS, `public/mobile.html`, ~15.000 líneas) → visor actual (anchor watch). Servido en `/signalk-mareas-ihm/visorfondeo` y `/signalk-mareas-ihm/mobile`.
- **mapafondeo.html** (vanilla JS, `public/mapafondeo.html`, ~357 KB) → visor desktop LEGACY del Rev168 que el plugin NO QUIERE servir más. Servido en `/signalk-mareas-ihm/mapafondeo` y en `/signalk-mareas-ihm/visorfondeo?desktop=1`.
- **TidesView.tsx** (React+Vite, `app/views/TidesView.tsx`) → app de mareas (modal). Servida en `/signalk-mareas-ihm/mareas` y antes en `/signalk-mareas-ihm/` (raíz). Desde Rev523 la raíz redirige a `/visorfondeo`.
- Modal Instrucciones del visor móvil: abre TidesView en un iframe (`?embed=1&showInstructions=1`).

## Problema 1 — Sigue cargando la "versión antigua" al arrancar el plugin en el visor

Carlos abre el visor (URL `http://100.127.222.27:3000/signalk-mareas-ihm/viso...` — probablemente `/visorfondeo`) y ve **brevemente la versión antigua** (botones grandes "Previsión Meteo / Calc. Sonda / Calc. Fondeo / Curvas / Previsión Abrigo / Echar / Central / Favorito / Cartas / AIS / Abrigo / Meteo / Alarmas" + panel lateral izquierdo "SOG / Sonda / Marea / Dif. Bajamar / Prof. mín. / Cadena rec. / Dist. ancla / H. fondeo / Presión / Abrigo / Calidad / Nivel de Zoom 16") **antes de que cargue la actual** (mobile.html).

Visualmente, la "versión antigua" claramente es `mapafondeo.html` (visor desktop legacy). Los elementos del layout (botones flotantes grandes + panel left con valores) son lo que tiene mapafondeo.html.

Lo que YA he intentado:
- **Rev523**: redirect en `index.html` (template Vite) — si URL es `/signalk-mareas-ihm/` y NO está embed/mareas, hace `window.location.replace('/signalk-mareas-ihm/visorfondeo')`. Funciona para entrada raíz.
- **Rev540**: pre-flight build-info check en `mobile.html` — script inline en `<head>` que oculta el documento, hace fetch a `/api/build-info`, compara con `sessionStorage`. Si distinto → `window.location.replace(... + '?v=<id>')`. Resuelve doble carga DENTRO de mobile.html pero no entre archivos distintos.

Backend (`src/index.ts`):
```ts
expressApp.get("/signalk-mareas-ihm/visorfondeo", (req, res) => {
  const forceLegacy = String(req?.query?.desktop || "") === "1";
  const target = forceLegacy ? "mapafondeo.html" : "mobile.html";
  const file = _resolveFile(target);
  if (file) { _setHtmlNoCacheHeaders(res); return res.sendFile(file); }
  res.status(404).send(`${target} not found`);
});

expressApp.get("/signalk-mareas-ihm/mapafondeo", (_req, res) => {
  const file = _resolveFile("mapafondeo.html");
  if (file) { _setHtmlNoCacheHeaders(res); return res.sendFile(file); }
  res.status(404).send("mapafondeo.html not found");
});

expressApp.get("/signalk-mareas-ihm/mobile", (_req, res) => {
  const file = _resolveFile("mobile.html");
  if (file) { _setHtmlNoCacheHeaders(res); return res.sendFile(file); }
  res.status(404).send("mobile.html not found");
});
```

Carlos pide: **eliminar TODA dependencia de la versión antigua. Solo mobile, no dependiente de UA ni de query strings. mapafondeo.html debe desaparecer del flujo**.

### Hipótesis a investigar (no des por buena ninguna sin verificar)

1. **Cache del navegador**: el browser tiene cacheado `mapafondeo.html` de cuando era la entrada por defecto. Aunque ahora pidamos `mobile.html`, el browser sirve el cached. Headers `_setHtmlNoCacheHeaders` deberían prevenirlo pero algunos navegadores móviles ignoran.

2. **Bookmark/PWA**: el manifiest dice `start_url: /signalk-mareas-ihm/visorfondeo`. Si el usuario instaló como PWA antes, el SW podría cachear la antigua.

3. **`webapp` config en package.json**: `"webapp": "./public"`. Signal K monta `./public/` en `/signalk-mareas-ihm/` por static-file serving. Eso incluye `mapafondeo.html`, `mobile.html`, `index.html`, `wave-debug.html`, etc. Posiblemente SK sirve uno por defecto.

4. **JS de mobile.html que abre un iframe con mapafondeo.html temporalmente** — improbable, no encontré refs.

5. **`window.location.href` o algún `<a href>` en mobile.html que apunte a mapafondeo.html en alguna ruta**:
```bash
grep -rn 'mapafondeo' public/mobile.html src/index.ts
```

### Pregunta concreta 1

¿Por qué Carlos sigue viendo el layout viejo de `mapafondeo.html` durante el arranque del visor a pesar de Rev523+Rev540? Y ¿cuál es el fix arquitectónico correcto para que `mapafondeo.html` NO se sirva nunca más, sin romper la URL `/visorfondeo` ni el bookmark de Carlos?

Opciones a evaluar (prioridad y trade-offs):
- (a) **Eliminar `public/mapafondeo.html`** del repo y dejar el handler `/visorfondeo` que solo sirva `mobile.html`.
- (b) Reemplazar el contenido de `mapafondeo.html` con un redirect HTML inline: `<meta http-equiv="refresh" content="0;url=/signalk-mareas-ihm/visorfondeo">`.
- (c) Modificar el handler de `/visorfondeo` para ignorar `?desktop=1` y siempre servir `mobile.html`.
- (d) Añadir Service Worker que invalide cualquier cache de `mapafondeo.html`.
- (e) Algo más limpio que se me escape.

---

## Problema 2 — Modal Instrucciones sigue con "cuadro negro de fondo" y barra scroll distinta

El modal de Instrucciones del visor (que abre TidesView en iframe) muestra **un marco negro alrededor del contenido** y la **barra de scroll** del iframe NO coincide con el estilo del resto del visor.

### Estructura DOM real

```html
<!-- mobile.html (visor móvil) -->
<body class="mobile-ui">
  <div id="m-instructions-overlay" class="popup-overlay open">
    <!-- popup-overlay con zoom:1 (Rev531 exempt) -->
    <div class="popup-box" style="overflow:hidden!important">
      <!-- padding original era 104px 24px 32px (regla L1135 mobile.html);
           Rev537 override: padding: calc(88px * var(--ui-scale)) 0 0 0 !important -->
      <div class="m-modal-hdr">
        <!-- header naranja inyectado, zoom: var(--ui-scale) -->
        <button class="m-back">‹ Atrás</button>
        <div class="m-title">📖 Instrucciones · 2.3.2</div>
      </div>
      <h4 id="m-instructions-title" style="display:none">📖 Instrucciones · 2.3.2</h4>
      <iframe id="m-instructions-iframe"
              src="/signalk-mareas-ihm/mareas?embed=1&showInstructions=1&lang=es"
              style="width:100%;border:none;display:block;touch-action:pan-y;flex:1 1 auto;min-height:0">
        <!-- DENTRO DEL IFRAME: TidesView -->
        <html>
          <body>
            <div class="modal-overlay">
              <div class="modal-content modal-fullscreen instrucciones-modal">
                <!-- Rev536: padding 0, border-radius 0, border none, box-shadow none -->
                <div class="instrucciones-body instrucciones-scroll">
                  <!-- Rev536: padding 0 22px -->
                  <h2>AnchorWatch Pro: Smart Anchoring, AIS & Tides – v2.3.2</h2>
                  <!-- contenido -->
                </div>
                <div class="modal-buttons-fixed">
                  <!-- botones VERSIONES/AVISO LEGAL/Buscar -->
                </div>
              </div>
            </div>
          </body>
        </html>
      </iframe>
    </div>
  </div>
</body>
```

### CSS relevante

`mobile.html` (L1135 — regla DEFAULT del popup-box):
```css
body.mobile-ui .popup-overlay .popup-box{
  position:fixed!important;
  inset:0!important;
  width:100%!important;height:100%!important;
  padding:104px 24px 32px!important;
  display:flex!important;flex-direction:column!important;
  font-size:24px!important;
  color:#fff!important;
}
```

`mobile.html` Rev537 override (L58):
```css
#m-instructions-overlay .popup-box{
  padding: calc(88px * var(--ui-scale)) 0 0 0 !important;
}
```

`app/App.css` (interior iframe TidesView):
```css
.modal-overlay { /* … z-index, background, position fixed inset 0, etc. */ }
.modal-content {
  background: #0a4a5a;
  border-radius: 16px;
  padding: 24px 32px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.15);
  max-height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.modal-fullscreen {
  max-width: none; width: 100%; height: 100%;
  padding: 0; border-radius: 0; border: none; box-shadow: none;
}
.instrucciones-body {
  text-align: left;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 0 22px;
}
```

### Pregunta concreta 2

Carlos describe:
> "El frame de texto de instrucciones/versiones etc sigue con el cuadro negro de fondo y barra scroll distinta al CSS de lo demás"

¿Qué CSS o estructura DOM causa que se vea un "cuadro negro de fondo" alrededor del contenido del iframe? Opciones a evaluar:

1. **El `.popup-box` del visor móvil** mantiene background del default `.popup-overlay .popup-box` (que en mobile.html L1131 es `background:rgba(10,30,50,.6)`). Rev537 le puse padding pero NO background → debería heredar transparente del overlay. ¿Hay otro background pisando?

2. **El `.modal-overlay` dentro de TidesView** (en App.css) puede tener un background semi-transparente que se ve encima del iframe.

3. **El iframe mismo** tiene `background` default del navegador (blanco/transparent) — si el documento iframe carga lento, se ve blanco antes de pintar el CSS.

4. **La barra de scroll del iframe** usa estilos default del navegador (gris) en lugar del estilo dark del visor.

Comando JS para verificar (consola del documento PADRE, mobile.html):
```js
const overlay = document.getElementById('m-instructions-overlay');
const popupBox = overlay?.querySelector('.popup-box');
const iframe = document.getElementById('m-instructions-iframe');
console.log({
  overlayBg: getComputedStyle(overlay).backgroundColor,
  popupBoxBg: getComputedStyle(popupBox).backgroundColor,
  popupBoxPadding: getComputedStyle(popupBox).padding,
  iframeRect: iframe?.getBoundingClientRect(),
  iframeOffsetParent: iframe?.offsetParent?.outerHTML?.substring(0, 200),
});
// Dentro del iframe:
const innerOverlay = iframe?.contentDocument?.querySelector('.modal-overlay');
const innerContent = iframe?.contentDocument?.querySelector('.modal-content');
console.log({
  innerOverlayBg: innerOverlay ? getComputedStyle(innerOverlay).backgroundColor : 'no-doc',
  innerContentBg: innerContent ? getComputedStyle(innerContent).backgroundColor : 'no-doc',
  innerContentPad: innerContent ? getComputedStyle(innerContent).padding : 'no-doc',
});
```

Diagnostica:
- ¿De dónde viene el "cuadro negro"?
- ¿Cómo dar a la scrollbar del iframe el estilo dark coherente con el visor (custom scrollbar webkit/firefox)?
- ¿Hay forma de quitar el background del `.modal-content` cuando es `.modal-fullscreen` para que herede transparente y muestre el del visor por debajo?

---

## Aprendizaje previo aplicable

Ayer (2026-06-23) GPT+Gemini diagnosticaron que `.popup-overlay { zoom: var(--ui-scale) }` escalaba el iframe entero al 60%. Fix: `#m-instructions-overlay { zoom: 1 }`. Lección: cuando algo está "raro" en el modal de Instrucciones, sospechar de reglas globales del visor (mobile.html) que afectan al overlay sin tener en cuenta el iframe.

Stack: SignalK plugin, Vite 7 + React 19 + TS, visor monolítico vanilla JS, iframe cross-document mismo-origin.

Necesito tu análisis de primeros principios para los 2 problemas. Da fixes concretos y robustos (no parches con `!important` extra — busca la causa).
