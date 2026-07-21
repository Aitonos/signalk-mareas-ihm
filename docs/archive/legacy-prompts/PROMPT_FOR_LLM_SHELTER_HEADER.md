# Prompt para Gemini / GPT — header pequeño en sub-modales shelter

## Problema

En un plugin SignalK con UI HTML monolítica (mobile.html ~15.000 líneas), tengo
una familia de modales `.popup-overlay > .popup-box` con un header inyectado
dinámicamente vía JS (`<div class="m-modal-hdr"><button class="m-back">‹ Atrás
</button><div class="m-title">...</div><div class="m-close-spacer"></div></div>`).

**Modal de referencia (Sonda)**: header se renderiza GRANDE — botón `‹ Atrás`
naranja claro con padding generoso, título "Cálculo de Sonda" blanco grande.

**Modales hijo (shelter-legend-pop, shelter-score-pop, wave-hist-info-pop)**:
header se renderiza ENANO — botón `< Atrás` mucho más pequeño, título más pequeño.
La franja del header completa parece más compacta verticalmente.

Los dos modales se sirven en el mismo navegador, mismo dispositivo, mismo
viewport, mismo zoom de navegador. El usuario ha mandado capturas pantalla
completa de ambos lado a lado y la diferencia es OBVIA.

## Lo paradójico

Inspecté con DevTools el `.m-back` y el `.m-modal-hdr` de un sub-modal
(shelter-score-pop) y el computed style es **IDÉNTICO** al esperado:

`.m-back` computed:
- `background-color: rgba(255, 178, 63, 0.15)` ✓ origen línea 1169
- `border-color: rgb(255, 178, 63)` ✓
- `border-radius: 12px` ✓
- `color: var(--org)` ✓ (computed: rgb(255, 178, 63))
- `font-size: 24px !important` ✓ origen `body.mobile-ui .m-modal-hdr .m-back` línea 1169
- `height: 61.3137px` ✓
- `min-height: 54px` ✓
- `padding: 14px 22px` ✓
- (NO hay regla pisándolo en DevTools — la regla winner es la `.m-modal-hdr .m-back`)

`.m-modal-hdr` computed:
- `background-color: rgba(10, 30, 50, 0.98)` ✓ origen línea 1157
- `background-image: none`
- `height: 87.9919px !important` ✓ (var(--modal-hdr-h)=88px)
- `position: fixed` ✓

Si computed dice IDÉNTICO en sub-modales shelter y en Sonda usa el mismo selector
sin overrides, ¿por qué visualmente uno se ve grande y el otro pequeño?

## CSS relevante (mobile.html)

```css
/* Línea 14-25: variables */
:root{
  --modal-hdr-h: 88px;
  --modal-title-sz: 32px;
  --modal-back-sz: 24px;
  --org: rgb(255,178,63);
  --ui-scale: 1;
}

/* Línea 37, 40: zoom solo a algunos elementos NO modal */
:root{--ui-scale:1}
#panel,#shelter-tooltip,#nivel-zoom-display,#bottom-info,
.bottom-info,.audio-unlock-tap{zoom:var(--ui-scale)}

/* Línea 1129: popup overlay (NO zoom) */
body.mobile-ui .popup-overlay{
  align-items:stretch!important;justify-content:stretch!important;
  padding:0!important;background:rgba(10,30,50,.6)!important;
  touch-action:pan-y!important;
}

/* Línea 1135: popup-box fullscreen */
body.mobile-ui .popup-overlay .popup-box{
  position:fixed!important;
  inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;
  width:100%!important;height:100%!important;
  max-width:100%!important;max-height:100%!important;
  min-width:0!important;margin:0!important;
  border-radius:0!important;
  padding:104px 24px 32px!important;
  overflow-y:auto!important;overflow-x:hidden!important;
  animation:m-slide-up .26s cubic-bezier(.2,.9,.3,1);
  display:flex!important;flex-direction:column!important;
  font-size:24px!important;
  color:#fff!important;
  touch-action:pan-y!important;
}

/* Línea 1157: header sticky */
body.mobile-ui .m-modal-hdr{
  position:fixed;top:0;left:0;right:0;
  height:var(--modal-hdr-h)!important;
  z-index:10;
  background:rgba(10,30,50,.98);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-bottom:2px solid rgba(255,178,63,.3);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 12px;
}

/* Línea 1169: botón back */
body.mobile-ui .m-modal-hdr .m-back{
  background:rgba(255,178,63,.15);border:1px solid var(--org);color:var(--org);
  font-size:var(--modal-back-sz)!important;
  font-weight:800;cursor:pointer;padding:14px 22px;
  display:flex;align-items:center;gap:4px;min-height:54px;
  border-radius:12px;letter-spacing:-.2px;
}

/* Línea 1177: título */
body.mobile-ui .m-modal-hdr .m-title{
  flex:1;text-align:center;
  font-size:var(--modal-title-sz)!important;
  font-weight:900;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  padding:0 8px;letter-spacing:-.3px;
}

/* NO hay reglas específicas #sonda-pop. Sonda usa solo defaults arriba. */
/* Reglas específicas shelter (líneas 1395-1398) afectan a .shelter-legend-row
   y descendientes, NO al header. */
```

## JS de inyección (línea 11649)

```js
function _mInjectModalHeader(overlay){
  var box = overlay.querySelector('.popup-box');
  if (!box || box.querySelector('.m-modal-hdr')) return;
  var noHeaderIds = ['levar-confirm-pop','ais-noanchor-pop','ais-confirm','ais-pop'];
  if (noHeaderIds.indexOf(overlay.id) >= 0) return;
  var titleEl = box.querySelector('h4,h3,h5');
  var titleText = titleEl ? titleEl.textContent.trim() : '';
  if (titleEl) titleEl.style.display = 'none';
  var hdr = document.createElement('div');
  hdr.className = 'm-modal-hdr';
  var titleHTML = titleEl ? titleEl.innerHTML : '';
  var _backTxt = (typeof T==='function') ? T('m_atras','‹ Atrás') : '‹ Atrás';
  hdr.innerHTML =
    '<button class="m-back" type="button">'+_backTxt+'</button>' +
    '<div class="m-title">' + titleHTML + '</div>' +
    '<div class="m-close-spacer"></div>';
  // ... handlers ...
  box.insertBefore(hdr, box.firstChild);
}
/* MutationObserver dispara _mInjectModalHeader en cada `class` change que
   añada 'open' al .popup-overlay */
```

## Sub-modales: HTML (DESPUÉS de Rev508 — inline styles eliminados)

```html
<div class="popup-overlay" id="shelter-legend-pop" onclick="closePopup('shelter-legend-pop')">
  <div class="popup-box" onclick="event.stopPropagation()">
    <h4><span data-i18n="shelter_legend_title">Escala de exposición</span></h4>
    <div class="shelter-legend-row"><span class="shelter-legend-grade" style="color:#3aa856">A</span><span class="shelter-legend-swatch" style="background:#3aa856"></span><span class="shelter-legend-desc">Abrigado · &lt;5 kt</span></div>
    ...
  </div>
</div>

<div class="popup-overlay" id="shelter-score-pop" onclick="closePopup('shelter-score-pop')">
  <div class="popup-box" onclick="event.stopPropagation()">
    <h4 data-i18n="sh_score_title">¿Cómo se calcula el % de protección?</h4>
    <div style="font-size:19px;color:#cfd8dc;line-height:1.4">
      <p style="margin:10px 0">El porcentaje representa <b>cuánta protección...</b></p>
      ...
    </div>
  </div>
</div>
```

Sonda (referencia que sí se ve bien):

```html
<div class="popup-overlay" id="sonda-pop" onclick="closePopup('sonda-pop')">
  <div class="popup-box" onclick="event.stopPropagation()">
    <h4>🔻 Cálculo de Sonda</h4>
    <!-- ... contenido ... -->
  </div>
</div>
```

## Intentos previos fallidos

- **Rev506**: añadí `:not(.m-back)` a las reglas `#shelter-*-pop button` para
  excluir el .m-back. (Era correcto, pero no fue la causa raíz visual).
- **Rev507**: eliminé override CSS para sub-modales (que tenía
  `inset:1vh 1vw; padding:100px 24px 24px` y rompía fullscreen).
- **Rev508**: limpié los inline styles del HTML del popup-box
  (`width:420px; padding:18px 22px`) y botones X redundantes.

Ninguno resolvió el problema visual. Usuario confirma "sigue igual" tras cada deploy.

## Lo único que noté distinto

El comentario línea 1735 dice:
> "FIX descubierto por Gemini: .popup-overlay tiene `zoom: var(--ui-scale)`
> (L33) que en portrait vale 0.6."

Pero la regla L40 actual solo aplica zoom a `#panel,#shelter-tooltip,
#nivel-zoom-display,#bottom-info,.bottom-info,.audio-unlock-tap` — NO a
`.popup-overlay`. ¿Será que el sub-modal hereda algún zoom de ancestor?

`--ui-scale` se calcula JS en `_applyUiScale()` como
`min(w/1920, h/1080)` clamp [0.6, 1.0]. En mobile vertical (~375x800) sale 0.6.

## Pregunta concreta

¿Por qué visualmente el header del modal `shelter-legend-pop` se renderiza más
pequeño que el del modal `sonda-pop` SI:

1. Ambos son `.popup-overlay > .popup-box`.
2. Ambos reciben el mismo `.m-modal-hdr` inyectado por la misma función JS.
3. El computed style del `.m-back` y `.m-modal-hdr` es IDÉNTICO en ambos
   (font-size 24px, height 88px, padding 14/22, naranja, etc.).
4. NO hay reglas CSS específicas para `#sonda-pop` ni para `#shelter-legend-pop
   .m-modal-hdr/.m-back/.m-title`.
5. NO hay `zoom`/`transform` aplicado a `.popup-overlay`.

**Diagnostica la causa raíz exacta**. Devuelve el selector CSS o el flujo JS que
hace que el header de los sub-modales shelter sea visualmente más pequeño que el
de Sonda, aunque computed style sea el mismo.

Hipótesis razonables a investigar (pero no des por buena ninguna sin verificar):

- ¿Hay algún `transform`/`scale`/`zoom` en un ancestro del sub-modal pero no del
  Sonda?
- ¿El MutationObserver inyecta el header DOS VECES en shelter (uno con tamaño
  default y otro reducido)?
- ¿`backdrop-filter:blur(14px)` interactúa diferente cuando el contenedor padre
  tiene cierto contexto de stacking?
- ¿El `font-size:24px!important` del `.popup-box` (línea 1147) hereda de manera
  distinta al hijo `.m-back` y eso anula el `font-size:var(--modal-back-sz)`
  del `.m-back`? (computed dice 24px en ambos pero conceptualmente la regla
  `.popup-box{font-size:24px}` con same specificity podría ganar source-order).
- ¿El sub-modal se abre desde DENTRO de otro modal padre (`#shelter-pop`) y
  hereda un contexto que escala el contenido?

**Sí, lo último es interesante**: shelter-legend-pop y shelter-score-pop se
abren CLICANDO en elementos DENTRO de shelter-pop (que está open). ¿Podría ser
que la pila de modales overlay-on-overlay genere algún contexto de stacking o
escala distinto?

## Stack técnico

- Plugin SignalK Node.js TypeScript.
- Frontend monolítico HTML+CSS+JS en `public/mobile.html` (15k líneas).
- Sin framework UI (vanilla JS).
- Navegadores objetivo: Chrome/Firefox mobile en tablet/phone iOS+Android.
- El visor corre en pestaña incrustada de OpenPlotter (Raspberry Pi) y en
  navegadores externos via Tailscale.

Necesito que diagnostiques con razonamiento de PRIMEROS PRINCIPIOS qué causa la
diferencia visual entre headers que tienen computed style idéntico.
