# Prompt para LLM (Gemini Pro 2.5 / GPT-5) — Unificación de headers de modales

## Cómo usar este prompt

Copia TODO el contenido entre las líneas `=== INICIO PROMPT ===` y `=== FIN PROMPT ===` (más abajo) y pégalo en un hilo NUEVO de Gemini Pro 2.5 y en otro hilo NUEVO de GPT-5, sin condicionar previamente. Espera ambas respuestas y compárame las.

---

## === INICIO PROMPT ===

# Contexto

Soy desarrollador del plugin Signal K **`signalk-mareas-ihm`** v2.3.1 — un visor móvil para navegación con marea, fondeo, AIS y meteo. Todo el frontend está en un único archivo HTML monolítico de ~15000 líneas:

- `public/mobile.html` — HTML + CSS + JS inline. **No hay archivos CSS externos**.

Está en producción real en un barco (Tunatunes, Vigo) y el armador (navegante experimentado, no técnico) me da feedback iterativo. Llevo ~5 iteraciones intentando unificar el tamaño de los headers de todos los modales y NO consigo que el resultado sea homogéneo. Los cambios CSS no parecen tener efecto visible. Necesito un análisis externo para identificar qué overrides ocultos o JS inline están pisando mis cambios.

---

# Estructura de modales

El plugin tiene ~17 modales que reciben un **header inyectado** común (`.m-modal-hdr`) con:
- Botón "‹ Atrás" (clase `.m-back`) — naranja outline, lleva back al estado anterior.
- Título central (clase `.m-title`) — texto del modal.
- Spacer derecho (`.m-close-spacer`).

La inyección la hace una función JS:

```js
function _mInjectModalHeader(overlay){
  var box = overlay.querySelector('.popup-box');
  if (!box || box.querySelector('.m-modal-hdr')) return;
  var noHeaderIds = ['levar-confirm-pop','ais-noanchor-pop','ais-confirm','ais-pop'];
  if (noHeaderIds.indexOf(overlay.id) >= 0) return;
  var titleEl = box.querySelector('h4,h3,h5');
  var titleText = titleEl ? titleEl.textContent.trim() : '';
  var hdr = document.createElement('div');
  hdr.className = 'm-modal-hdr';
  hdr.innerHTML =
    '<button class="m-back">‹ Atrás</button>' +
    '<div class="m-title">' + titleText + '</div>' +
    '<div class="m-close-spacer"></div>';
  if (titleEl) titleEl.style.display = 'none';  // oculta el h4 original
  box.insertBefore(hdr, box.firstChild);
}
```

También hay 3 paneles NO-overlay (paneles fixed que no son `.popup-overlay`) que **inyectan su propio `.m-modal-hdr` manualmente** desde funciones distintas: `#ais-alarm-panel` (panel AIS), `#panel` (panel desktop legacy), y el modal de Info Fondeo. Todos usan la misma clase `.m-modal-hdr`.

---

# Regla del usuario (CRÍTICA)

> **TODOS los headers de todos los modales deben tener tamaño IDÉNTICO** (mismo `font-size` del `.m-title`, mismo `font-size` del `.m-back`, misma altura del `.m-modal-hdr`).
> **Única excepción justificada**: el modal de Meteo (`meteo-pop`) por la complejidad y densidad de datos que muestra.
> Cualquier override CSS o JS inline que rompa esta regla debe eliminarse o anularse.

Mi referencia visual aceptada es el modal **Cálculo de Sonda** (`sonda-pop`):
- `.m-title` font-size = **32 px**
- `.m-back` font-size = **24 px**
- `.m-modal-hdr` height = **88 px**

Estos son los tamaños default actuales en mi CSS para `body.mobile-ui .m-modal-hdr`.

---

# Problema concreto

A pesar de haber:
1. Establecido el default `.m-modal-hdr .m-title { font-size: 32px }` (línea 1169).
2. Establecido el default `.m-modal-hdr .m-back { font-size: 24px; padding: 14px 22px; min-height: 54px }` (línea 1162-1167).
3. ELIMINADO todos los overrides específicos por modal (shelter-pop, ais-alarm-panel, shelter-score-pop, shelter-legend-pop, wave-hist-info-pop).
4. Mantenido sólo el override de `ais-pop` (es ventana flotante pequeña, NO inyecta `.m-modal-hdr` porque está en `noHeaderIds`).

**El usuario reporta**: "los botones BACK siguen sin ser homogéneos. Sonda y Fondeo siguen idénticos (no veo cambios). Popup AIS sigue igual. Los 3 botones (toggles AIS) son muy largos y siguen el scroll (scroll solo para datos, no cabeceras)."

---

# CSS relevante actual

```css
/* Default header inyectado (línea 1152) */
body.mobile-ui .m-modal-hdr{
  position:fixed;top:0;left:0;right:0;height:88px;z-index:10;
  background:rgba(10,30,50,.98);
  backdrop-filter:blur(14px);
  border-bottom:2px solid rgba(255,178,63,.3);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 12px;
}

body.mobile-ui .m-modal-hdr .m-back{
  background:rgba(255,178,63,.15);
  border:1px solid var(--org);
  color:var(--org);
  font-size:24px;font-weight:800;cursor:pointer;
  padding:14px 22px;
  display:flex;align-items:center;gap:4px;min-height:54px;
  border-radius:12px;letter-spacing:-.2px;
}

body.mobile-ui .m-modal-hdr .m-title{
  flex:1;text-align:center;
  font-size:32px;font-weight:900;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  padding:0 8px;letter-spacing:-.3px;
}

body.mobile-ui .m-modal-hdr .m-close-spacer{ min-width:80px }

/* Variante Pi-browser (Raspberry Pi kiosk del barco) — DEBE coincidir con móvil */
body.m-pi-browser .m-modal-hdr .m-title{font-size:32px!important}
body.m-pi-browser .m-modal-hdr .m-back{font-size:24px!important}
```

Overrides actuales que SÍ pueden estar pisando (los he encontrado tras buscar):

```css
/* Cursor para drag del ais-pop (línea 1441-1449) */
body.mobile-ui #ais-pop .m-modal-hdr,
body.mobile-ui #ais-pop #ais-pop-title{ cursor:move; user-select:none; touch-action:none; }
body.mobile-ui #ais-pop .m-modal-hdr .m-back,
body.mobile-ui #ais-pop .m-modal-hdr button{ cursor:pointer; }

/* Override solo para portrait — ais-pop (línea 1490-1494) */
@media (orientation: portrait){
  body.mobile-ui #ais-pop .m-modal-hdr .m-title{
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    font-size:18px!important;line-height:1.2!important;
  }
}
```

---

# Estructura del panel AIS (el del problema del scroll)

```html
<div id="ais-alarm-panel">
  <div class="ais-panel-header">         <!-- flex:0 0 auto -->
    <h5 onclick="...">
      <span>⚠ AIS en zona</span> (<span id="ais-total-count">0</span>)
      <span id="ais-borneo-badge">| 🔴 Colisión: <span id="ais-borneo-count">0</span></span>
      <!-- 3 toggles AIS/Tracks/Alarma -->
      <span class="ais-hdr-toggles">
        <label><input type="checkbox" id="ais-hdr-icons-chk"><span>AIS</span></label>
        <label><input type="checkbox" id="ais-hdr-tracks-chk"><span>Tracks</span></label>
        <label><input type="checkbox" id="ais-hdr-alarm-chk"><span>Alarma</span></label>
      </span>
    </h5>
    <div><span>Radio:</span><input type="range" id="ais-radius-slider"><span>5 km</span></div>
    <div><span>Ordenar:</span><select id="ais-sort-by">...</select><input type="text" id="ais-filter-txt"></div>
  </div>
  <div id="ais-alarm-list">             <!-- flex:1 1 auto; overflow-y:auto -->
    <!-- aquí van los targets, scrolea -->
  </div>
</div>
```

CSS aplicable:
```css
#ais-alarm-panel{
  position:fixed;top:229px;left:10px;
  width:321px;max-height:240px;
  display:none;overflow:hidden;flex-direction:column;
}
#ais-alarm-panel.open{display:flex}
#ais-alarm-panel #ais-alarm-list{flex:1 1 auto;overflow-y:auto;min-height:0}
#ais-alarm-panel .ais-panel-header{flex:0 0 auto}
```

Cuando se abre (clase `.open` o `.m-open`), una función JS inyecta también el `.m-modal-hdr` (con back + título "🚢 AIS en zona") encima:

```js
function m_toggleAisList(){
  ...
  panel.classList.add('m-open');
  if (!panel.querySelector('.m-modal-hdr')) {
    var hdr = document.createElement('div');
    hdr.className = 'm-modal-hdr';
    hdr.innerHTML = '<button class="m-back">‹ Atrás</button>' +
                    '<div class="m-title">🚢 AIS en zona</div>' +
                    '<div class="m-close-spacer"></div>';
    panel.insertBefore(hdr, panel.firstChild);
  }
}
```

El `.m-modal-hdr` tiene `position:fixed; top:0; left:0; right:0` → se va al borde superior de la pantalla, FUERA del panel `#ais-alarm-panel` (que está `top:229px`). Es decir: el header inyectado y el panel original NO comparten contenedor visual.

El usuario reporta: "los 3 botones (toggles AIS) son muy largos y siguen el scroll (scroll solo para datos, no cabeceras)". Es decir, al scrolear la lista de targets dentro del panel, los toggles y el slider de radio SE MUEVEN con el scroll, cuando deberían estar fijos arriba.

---

# Lo que necesito de ti

1. **Diagnóstico — ¿por qué mis cambios no son visibles?**
   - ¿Los `!important` están mal colocados o falta cascada?
   - ¿Hay browser cache / service worker que esté sirviendo CSS antiguo?
   - ¿Los selectores `body.mobile-ui` requieren que body tenga esa clase y quizá no la tiene en el momento del primer render?
   - ¿Hay alguna regla `inline style` en el JS de inyección (`hdr.innerHTML = '<button class="m-back">‹ Atrás</button>...'`) que esté metiendo style inline que tenga prioridad sobre mi CSS?
   - Cualquier otra causa común.

2. **Plan paso a paso para que TODOS los headers sean idénticos**:
   - ¿Debo usar custom properties (`var(--header-title-size)`) en lugar de valores hardcoded?
   - ¿Tengo que añadir `!important` a las defaults para protegerme de overrides futuros?
   - ¿Cómo verificar EN VIVO (DevTools) que la regla CSS aplicada al `.m-title` de un modal específico es la del default y no un override escondido?

3. **Fix del scroll del panel AIS**:
   - El `.ais-panel-header` debería quedarse fijo arriba mientras el `.ais-alarm-list` scrolea.
   - Actualmente lo intento con `flex:0 0 auto` pero el usuario reporta que sí scrolea.
   - Sospecho problema de `position:sticky` o que el contenedor padre tiene `overflow:hidden` que rompe el sticky.
   - Dame solución concreta (CSS).

4. **Fix del título del `ais-pop` (ventana flotante target)**:
   - Es la única ventana que NO usa el header inyectado (está en `noHeaderIds`).
   - Tiene su propio `<h4 id="ais-pop-title">🚢 Target AIS</h4>` que muestra el nombre del barco.
   - El usuario dice "el nombre del barco es ultra grande, no se ve entero".
   - Mi override actual (sólo portrait): `font-size:18px !important; ellipsis`. Pero el usuario dice "sigue igual" tras este cambio.
   - ¿Por qué no se aplica? ¿Hay un style inline en el h4 que esté pisando?

5. **Cómo evitar que esto vuelva a pasar**:
   - Recomienda una estrategia de design system (custom properties + linter / convención de nombres) para evitar override hell.
   - ¿Qué herramienta puedo usar (sin reescribir todo el proyecto) para auditar conflictos CSS automáticamente?

---

# Información extra que puedo aportar

- Archivo `public/mobile.html` completo si lo necesitas.
- Captura de la consola del navegador (computed styles) si me dices qué buscar.
- Pi del barco con Tailscale para inspección remota si haces falta.

Da una respuesta concreta, accionable, ordenada en pasos. No me digas teoría general — explica EXACTAMENTE qué cambio hago línea por línea.

## === FIN PROMPT ===

---

## Notas para Aitonos (el usuario / armador)

- **Pega este prompt en Gemini Pro 2.5 y en GPT-5 en hilos separados**. No condiciones nada, no añadas "haz esto rápido" ni similares.
- Espera ambas respuestas. Pásamelas a mí cuando las tengas y comparamos:
  - **Convergencias** = me indica que voy bien por ese camino → aplicar.
  - **Divergencias** = revelan decisiones que tomamos por instinto, las discutimos contigo.
- Mientras tanto NO toco más código de UI para evitar más rabbit holes.
- El backup `pre-ui-unify-2026-06-23` (commit `9a1ad26`) sigue intacto. Si todo lo posterior no convence, podemos volver con `git reset --hard pre-ui-unify-2026-06-23` y empezar el plan de los LLMs sobre limpio.
