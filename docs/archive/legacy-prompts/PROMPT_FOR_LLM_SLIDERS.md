# Prompt para Gemini / ChatGPT — Sliders transparencia + persistencia

> **Cómo usar**: copia este prompt entero al chat de Gemini o ChatGPT, y
> adjunta los archivos listados al final. Gemini soporta archivos grandes;
> ChatGPT puede pedir trozos por separado.

---

## Contexto

Plugin SignalK para vigilancia de fondeo (`signalk-mareas-ihm`, Node.js +
TypeScript + Express + vanilla JS frontend + Leaflet). UI mobile-first
servida desde `public/mobile.html`. Una sola UI viva (mobile), la versión
legacy desktop está obsoleta.

**Rev actual**: `Rev268`.

**Arquitectura relevante para este bug**:

1. Backend en `src/index.ts` mantiene `anchorWatch.chainDeployed` y
   `anchorWatch.swingRadiusOverride`. Los expone vía SSE/poll y endpoints
   REST.
2. Frontend `public/mobile.html` tiene:
   - Mapa Leaflet en `<div id="map">` con `position:fixed; inset:0; z-index:1`.
   - Panel lateral `<div id="panel">` que en mobile cubre toda la pantalla
     cuando tiene clase `.m-open` (Cartas y Capas), con `z-index:1500`.
   - Modal "Info fondeo" creado dinámicamente: `<div class="popup-overlay"
     id="m-info-overlay"><div class="popup-box">…</div></div>`.
   - Sliders relevantes:
     - `sl-sw` y `sl-al`: cadena y alarma en el panel.
     - `m-modal-chain-sld` y `m-modal-alarm-sld`: cadena y alarma dentro
       del modal Info (creados dinámicamente por `m_refreshInfoModal`).
     - `lyr-opa`: opacidad de cada capa en Cartas y Capas.
     - `alarm-vol-slider`: volumen alarmas (no debe activar transparencia).

## Los dos problemas que necesito resolver

### Problema A — Slider de cadena del modal Info "no graba bien"

**Síntoma**: el usuario ajusta el slider de cadena del modal Info (id
`m-modal-chain-sld`) a un valor X (e.g. 50 m). Al soltar, el valor queda
en algo distinto (no el valor anterior, sino otro distinto — sugiere
cálculo en algún sitio).

**Flujo actual** (`public/mobile.html`):

1. `<input id="m-modal-chain-sld" oninput="m_modalChainSlider(this.value)">`
2. `m_modalChainSlider(v)` → actualiza label, preview en mapa, sincroniza
   `sl-sw.value`, llama `onChainSlider(v)`.
3. `onChainSlider(v)`:
   - `var chain=parseInt(v); chainDep=chain;` (var global frontend).
   - 80 ms debounce → POST a `/anchor-watch/chain-deployed` con
     `{meters:chain}`.
   - En el `.then`, recibe `{swingRadiusOverride, radiusBowNow}` y
     actualiza `swMax`.
4. Backend `/anchor-watch/chain-deployed` (`src/index.ts:6497`):
   - `anchorWatch.chainDeployed = meters;`
   - Recalcula radio: `rBow = sqrt(chain² - vertical²)`, `rTotal = rBow + LOA`.
   - `anchorWatch.swingRadiusOverride = round(rTotal*10)/10;`
   - Persiste y emite `broadcastSSE("chain")`.
5. Visor recibe SSE → `processPollData` actualiza state:
   - `chainDep = s.chainDeployed || null;` (línea ~2745).
   - `swMax = s.swingRadiusOverride;` si el override > 0.

**Comportamiento esperado**: el slider debe quedarse en X y persistir.

**Comportamiento real**: queda en otro valor distinto, no en el que el
usuario soltó ni en el anterior.

**Lo que ya verifiqué**:
- `m_refreshInfoModal()` re-renderiza el modal cada 2.5 s. Tiene un
  guard `if (window._userInteractingSlider) return;` que evita rebuild
  durante el drag, pero al soltar el flag se quita y el siguiente refresh
  pone `value=chainNow` (chainNow leído de `chainDep`).
- Hay 5 sitios que escriben a `chainDep`:
  - `onChainSlider` (línea 2466): cuando el usuario mueve cualquier slider
    de cadena.
  - `processPollData` (línea 2745): cada SSE/poll lo sobrescribe con
    `s.chainDeployed`.
  - Auto-calc al startup (líneas 2553, 2863): set a chainL inicial.
  - Cuando se levanta ancla (2880): `chainDep=null`.
  - Cuando se ejecuta cálculo de fondeo desde popup (línea 6170):
    `chainDep=r.chainL`.

## Pregunta concreta

¿Por qué el slider de cadena del modal Info acaba en un valor distinto al
que el usuario suelta? Hipótesis a verificar/descartar:

1. **Race condition** entre el POST del slider (delay 80 ms) y el SSE/poll
   que sobrescribe `chainDep` con el valor antiguo del backend. Cuando se
   re-renderiza el modal después de soltar, lee `chainDep` con el valor
   "intermedio".
2. **Algún otro endpoint backend** está re-calculando `chainDeployed`
   automáticamente — por ejemplo `/anchor/calc` que se llama internamente
   y siempre actualiza `chainDeployed = result.chainL`.
3. **El backend recibe `meters` correctamente** pero al recalcular
   `swingRadiusOverride` el siguiente delta SSE lleva un `chainDeployed`
   distinto por algún recálculo.

Audita el flujo COMPLETO (frontend `m_modalChainSlider` →
`onChainSlider` → POST → backend `/anchor-watch/chain-deployed` →
broadcastSSE → `processPollData` → `m_refreshInfoModal`) y dime DÓNDE
está el valor cambiando.

### Problema B — Cartas y Capas no se transparenta al pulsar slider

**Síntoma**: cuando el usuario pulsa un slider de opacidad de capa
(`<input type="range" class="lyr-opa">`) en el panel Cartas y Capas
(`#panel.m-open`), el panel se mantiene visualmente OPACO o se queda
con fondo oscuro `#0a1929`. No se ve el mapa detrás.

**Estado actual del código** (Rev268):

CSS:
```css
body.mobile-ui #panel.slider-active,
body.mobile-ui #panel.m-open.slider-active,
body.mobile-ui .popup-box.slider-active,
body.mobile-ui .popup-overlay.slider-active{
  background:transparent!important;
  backdrop-filter:none!important;
  box-shadow:none!important;
  border-color:transparent!important;
}
body.mobile-ui #panel.slider-active *,
body.mobile-ui #panel.m-open.slider-active *,
body.mobile-ui .popup-box.slider-active *{
  visibility:hidden!important;
  transition:none!important;
}
body.mobile-ui #panel.slider-active input[type=range]._sl-target-active,
body.mobile-ui #panel.m-open.slider-active input[type=range]._sl-target-active,
body.mobile-ui .popup-box.slider-active input[type=range]._sl-target-active{
  visibility:visible!important;
}
```

JS (extracto):
```js
function activate(slider){
  if (!shouldTransparent(slider)) return;
  if (activeSlider === slider) return;
  if (activeSlider && activeSlider !== slider) deactivate();
  activeSlider = slider;
  activeContainer = findContainer(slider);  // .closest('.popup-box, #panel')
  window._userInteractingSlider = true;
  if (activeContainer) activeContainer.classList.add('slider-active');
  if (activeContainer && activeContainer.classList.contains('popup-box')) {
    activeOverlay = activeContainer.closest('.popup-overlay');
    if (activeOverlay) activeOverlay.classList.add('slider-active');
  }
  slider.classList.add('_sl-target-active');
  if (activeContainer && activeContainer.id === 'panel') {
    setTimeout(function(){
      try {
        if (typeof map !== 'undefined' && map) {
          map.invalidateSize(true);
          var z = map.getZoom();
          map.setZoom(z, { animate: false });
        }
      } catch(_){}
    }, 30);
  }
}
```

**Lo que funciona vs lo que no**:

| Caso | Funciona | Por qué |
|---|---|---|
| Modal Info (popup-overlay > popup-box) | SÍ | Al transparentar, el mapa Leaflet detrás sigue renderizado |
| Panel Cartas (#panel.m-open) | NO | Aunque transparenta, el mapa queda oscuro |

**Hipótesis**:
- Cuando `#panel.m-open` cubre el `#map` al 100%, Leaflet descarta tiles
  porque el container está visualmente tapado.
- `invalidateSize` + `setZoom(getZoom())` deberían trigger re-render
  pero parece no bastar.
- Posible: el `.leaflet-container` tiene `background:#0a1929!important`
  (línea 37 de mobile.html). Si las tiles no se renderizan, se ve ese
  fondo oscuro.

**Pregunta**:

1. ¿Realmente Leaflet descarta tiles cuando el container está 100% tapado
   por otro elemento HTML (no descargado del DOM)? ¿O sigue manteniéndolas?
2. Si no las descarta, ¿por qué no se ven al transparentar el panel?
   ¿Tendrá z-index el `.leaflet-container`'s tiles que las pone debajo?
3. ¿Cuál es el truco correcto para forzar a Leaflet a repintar las tiles
   tras un cambio visual del contenedor que las cubría?
4. ¿Por qué el modal Info SÍ funciona (overlay z-index:2000, popup-box
   inset:0 también cubre el viewport)? ¿Qué hace diferente?

## Lo que NO quiero

- Mover el slider al `<body>` durante el drag: lo intenté, rompe el
  pointer event y el slider deja de ser interactivo. Solución NO válida.
- `display:none` al panel durante drag: rompe el drag igualmente.
- Cualquier solución que toque el DOM del slider mientras está siendo
  arrastrado.

## Lo que sí puedo aceptar

- CSS-only.
- Forzar Leaflet a refresh con métodos públicos (`invalidateSize`, `setZoom`,
  `eachLayer.redraw()`, `flyTo`, etc.).
- Cambios al z-index, position, visibility.
- Reordenar elementos en el DOM **antes** de la interacción (e.g. al abrir
  Cartas y Capas).

## Archivos a adjuntar al chat de la LLM

1. `public/mobile.html` — frontend completo (~8800 líneas, HTML+JS+CSS
   vanilla). El bloque del IIFE de transparencia está cerca del final.
   Las funciones relevantes están en:
   - `m_modalChainSlider`, `m_modalAlarmSlider` (sliders del modal Info).
   - `onChainSlider`, `onAlSlider` (handlers principales).
   - `m_openInfo`, `m_refreshInfoModal` (modal Info dinámico).
   - `m_togglePanel` (Cartas y Capas).
   - `processPollData` (lectura del state SSE/poll).
   - El IIFE de `slider-active` (cerca de `fixBrowserZoom`).
2. `src/index.ts` — backend (~8000 líneas). Endpoints relevantes:
   - `/api/anchor-watch/chain-deployed` (línea ~6497).
   - `/api/anchor-watch/swing-radius` (línea ~6488).
   - `/api/anchor-watch/alarm-extra` (línea ~6488).
   - `/api/anchor/calc` (línea ~1900).
   - `broadcastSSE`.
3. `docs/RULES.md` — reglas del proyecto.

Si la LLM no acepta tantos archivos, prioriza `public/mobile.html`
porque ahí están AMBOS bugs (frontend slider + CSS transparencia).
