# Prompt para LLM externo — Panel AIS: scroll afecta al panel entero en vez de solo a la lista interna

## Contexto del proyecto
- Plugin SignalK (TypeScript backend + UI monolítica `public/mobile.html`, ~640 KB vanilla JS+CSS).
- Frontend marítimo a pantalla completa que renderiza un panel flotante `#ais-alarm-panel` (posición fija top-left) con la lista de AIS targets.
- El usuario navega por touchscreen en una Raspberry Pi conectada a un monitor del barco; necesita que el slider de radio + dropdown ordenar + caja filtro queden SIEMPRE visibles arriba del panel, y que solo la lista de targets scrolee.

## El problema

El `#ais-alarm-panel` tiene `max-height:240px`. Cuando hay muchos AIS targets, debería:
- **Header (slider Radio + select Ordenar + input Filtro)** permanecer FIJO arriba.
- **Solo la lista** `#ais-alarm-list` scrolear verticalmente.

Lo que pasa actualmente: **el scroll afecta al panel ENTERO** — el header se sube al scrollear y desaparece. El usuario ya ha reportado 2 veces el bug y sigue mal pese a mis intentos.

## Estructura HTML actual (línea 1962-1973 de mobile.html)

```html
<div id="ais-alarm-panel">
  <div class="ais-panel-header">
    <h5 onclick="..." style="cursor:pointer;margin:0">
      <span data-i18n="ais_zona">⚠ AIS en zona</span> (<span id="ais-total-count">0</span>)
      <span id="ais-borneo-badge">…</span>
    </h5>
    <!-- subfila 1: slider de radio -->
    <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cfd8dc">
      <span data-i18n="ais_radio_lbl">Radio:</span>
      <input type="range" id="ais-radius-slider" min="0.5" max="50" step="0.5" value="5" style="flex:1" oninput="_setAisRadius(this.value)">
      <span id="ais-radius-val" style="min-width:60px;text-align:right;font-weight:700;color:#fff">5 km</span>
    </div>
    <!-- subfila 2: ordenar + filtro 50%/50% -->
    <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cfd8dc">
      <span data-i18n="ais_sort_lbl">Ordenar:</span>
      <select id="ais-sort-by" onchange="_setAisSort(this.value)" style="flex:1 1 50%;min-width:0;background:rgba(20,40,60,.85);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 8px;font-size:14px">
        <option value="dist">Distancia</option>
        <option value="name">Nombre</option>
        …
      </select>
      <input type="text" id="ais-filter-txt" placeholder="🔎" oninput="_setAisFilter(this.value)" style="flex:1 1 50%;min-width:0;background:rgba(20,40,60,.85);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 8px;font-size:14px">
    </div>
  </div>
  <div id="ais-alarm-list">
    <!-- items dinámicos generados por checkAisBorneoAlarm() -->
  </div>
</div>
```

## Todas las reglas CSS conocidas que tocan `#ais-alarm-panel`

### Default (línea 334-340 del archivo)
```css
#ais-alarm-panel{
  position:fixed;
  top:229px; left:10px; z-index:1002;
  background:var(--bg);
  border:2px solid rgba(255,255,255,.3);
  border-radius:10px;
  padding:8px;
  width:321px;
  max-height:240px;
  backdrop-filter:blur(10px);
  display:none;
  overflow:hidden;          /* mi intento */
  box-sizing:border-box;
  flex-direction:column;    /* mi intento */
}
#ais-alarm-panel.open{display:flex}                                    /* mi intento */
#ais-alarm-panel #ais-alarm-list{flex:1 1 auto;overflow-y:auto;min-height:0}  /* mi intento */
#ais-alarm-panel .ais-panel-header{flex:0 0 auto}                      /* mi intento */
#ais-alarm-panel.borneo-alert{border-color:var(--red)}
#ais-alarm-panel h5{color:#fff;margin-bottom:4px;font-size:14px}
```

### Media query <600px (línea 373)
```css
@media(max-width:600px){
  #ais-alarm-panel{top:168px!important;width:200px!important;max-height:120px!important}
}
```

### Backdrop-filter override (línea 411-423) — no relevante para scroll
```css
#wx-bar, #shelter-tooltip, #ais-alarm-panel, .lang-flags button, .popup-overlay, .m-modal-hdr, #m-bottom-bar, #m-sidebar, #m-leftbar, #m-menu, #m-tv-header{
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
```

### Mobile-ui: ocultarlo por defecto (línea 519-535)
```css
body.mobile-ui #ais-alarm-panel{display:none!important;visibility:hidden!important}

/* AIS panel: cuando es modal abierto SÍ debe verse */
body.mobile-ui #ais-alarm-panel.m-open{display:block!important;visibility:visible!important}
```

### Mi intento de Rev400 (línea 553-577, justo después de la 535)
```css
body.mobile-ui #ais-alarm-panel.m-open{
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
}
body.mobile-ui #ais-alarm-panel.m-open .ais-panel-header{flex:0 0 auto!important;padding:6px 4px 14px!important}
body.mobile-ui #ais-alarm-panel.m-open #ais-alarm-list{flex:1 1 auto!important;overflow-y:auto!important;min-height:0!important;padding-top:8px!important}
body.mobile-ui #ais-alarm-panel.m-open .ais-panel-header span,
body.mobile-ui #ais-alarm-panel.m-open .ais-panel-header label{font-size:20px!important;font-weight:700!important}
body.mobile-ui #ais-alarm-panel.m-open #ais-radius-slider{height:36px!important}
body.mobile-ui #ais-alarm-panel.m-open #ais-radius-val{font-size:20px!important;min-width:80px!important}
body.mobile-ui #ais-alarm-panel.m-open #ais-sort-by{font-size:20px!important;height:48px!important;padding:6px 10px!important}
body.mobile-ui #ais-alarm-panel.m-open #ais-filter-txt{font-size:20px!important;height:48px!important;padding:6px 10px!important}
body.mobile-ui #ais-alarm-panel.m-open .ais-panel-header > div{padding:10px 0!important;margin:6px 0!important;border-bottom:1px solid rgba(255,255,255,.06)}
body.mobile-ui #ais-alarm-panel.m-open .ais-panel-header > div:last-child{border-bottom:none!important}
```

### Tipografía gigante del panel (línea 608-624)
```css
/* Forzar tamaños grandes en CUALQUIER #panel.m-open o #ais-alarm-panel.m-open */
body.mobile-ui #panel.m-open *,
body.mobile-ui #ais-alarm-panel.m-open *{font-size:inherit}
body.mobile-ui #panel.m-open h1, body.mobile-ui #ais-alarm-panel.m-open h1{font-size:32px!important}
body.mobile-ui #panel.m-open h2, body.mobile-ui #ais-alarm-panel.m-open h2{font-size:28px!important}
body.mobile-ui #panel.m-open h3, body.mobile-ui #ais-alarm-panel.m-open h3{font-size:24px!important}
body.mobile-ui #panel.m-open h4, body.mobile-ui #ais-alarm-panel.m-open h4{font-size:22px!important}
body.mobile-ui #panel.m-open h5, body.mobile-ui #ais-alarm-panel.m-open h5{font-size:20px!important}
body.mobile-ui #ais-alarm-panel.m-open button{ /* ... */ }
body.mobile-ui #ais-alarm-panel.m-open input[type=range]{height:44px!important}
```

## Comportamiento JavaScript

El JS añade DOS clases distintas al panel según contexto:
- `panel.classList.add('open')` — para desktop/uso normal (línea 7771).
- `panel.classList.add('m-open')` — adicional cuando se abre como modal en mobile-ui (línea 9900, llamada desde `_mTogglePanel` que detecta touch device).

En el browser real (Pi conectado a monitor con touch), el body tiene clase `mobile-ui` Y `m-pi-browser`, y el panel recibe AMBAS clases simultáneamente: `.open .m-open`.

```js
// Snippet relevante del JS:
panel.classList.add('open');        // línea 7771 en checkAisBorneoAlarm()
panel.classList.add('m-open');      // línea 9900 cuando _mTogglePanel detecta touch
```

## Lo que YO he intentado (3 iteraciones)

**Iteración 1**: cambié `#ais-alarm-panel{overflow-y:auto}` → `overflow:hidden` y añadí `display:flex;flex-direction:column` con `#ais-alarm-list{flex:1;overflow-y:auto}`. No funcionó porque mi `display:flex` lo machacaba `body.mobile-ui #ais-alarm-panel.m-open{display:block!important}` (línea 535).

**Iteración 2**: añadí debajo de la 535 una regla con `display:flex!important; flex-direction:column!important; overflow:hidden!important`. Por orden de cascada con misma specificity y misma !important, MI regla debería ganar (aparece después en el archivo). Sin embargo, el usuario sigue reportando que el scroll afecta a todo el panel.

**Iteración 3**: añadí `body.mobile-ui #ais-alarm-panel.m-open #ais-alarm-list{flex:1 1 auto!important; overflow-y:auto!important; min-height:0!important}`. Tampoco.

## Sospechas pendientes de verificar

1. ¿Hay una regla CSS con `m-pi-browser` que tenga mayor specificity y aplique `overflow-y:auto` al panel? No la he encontrado pero el archivo tiene 13000 líneas.
2. ¿El JavaScript aplica style inline al panel con `style.overflow` o `style.overflowY`? Hay un `_mTogglePanel` que setea cssText.
3. ¿El `flex-direction:column` requiere también que el contenedor padre tenga altura definida explícita (en lugar de `max-height`)?
4. ¿Hay alguna interacción rara con `padding:8px` + `box-sizing:border-box` + `max-height:240px` que cause que el contenido total exceda y se scrolea el padre antes de que el child con overflow-y:auto tome el control?

## Estructura del DOM real (orden de hijos directos de `#ais-alarm-panel`)

```
#ais-alarm-panel.open.m-open  (display:flex column, max-height:240, overflow:hidden)
├── div.ais-panel-header       (flex:0 0 auto)
│   ├── h5                     (título + contador)
│   ├── div                    (Radio: + slider + valor)
│   └── div                    (Ordenar: + select + input filtro)
└── div#ais-alarm-list         (flex:1 1 auto; overflow-y:auto; min-height:0)
    ├── div.ais-alert-item     (cada fila)
    ├── div.ais-alert-item
    └── ...
```

## Pregunta concreta al LLM

1. **¿Por qué mi `flex-direction:column` con `#ais-alarm-list{flex:1; overflow-y:auto}` NO está aislando el scroll al hijo y sigue scrolleando el panel entero?**

2. **¿Qué auditoría debería hacer en DevTools (qué selectores inspeccionar, qué propiedades computed) para confirmar la causa raíz?** El usuario está en Raspberry Pi con Chromium kiosk, puedo decirle qué pegue en consola.

3. **¿Hay un approach alternativo más robusto que no dependa de flex (e.g. position:sticky en el header, grid con `1fr` en la lista, etc) que sea inmune a esta sobreescritura `!important`?**

4. **¿Algún error obvio que esté pasando por alto en la estructura HTML, el orden de las reglas, o la interacción `max-height` + `overflow:hidden` + `flex column`?**

## Reglas del proyecto (memoria persistente)
- Una cosa por commit, testable.
- `PLUGIN_REVISION` bumpea en cada build.
- Deploy: `.\deploy.ps1 -Restart` desde portátil Windows.
- Cache-Control `no-cache` en `mobile.html` (Rev384) → cambios CSS se reflejan en cada navegación + Ctrl+F5 una vez para purgar el primer cache.
- Memoria `feedback-inline-styles-lose-to-external-css.md`: inline styles en padre NO protegen a hijos en CSS (specificity 0 en herencia).

---

**Necesito una respuesta accionable: si el problema es trivial (regla CSS específica que estoy ignorando), apuntar a la línea concreta. Si es de strategy (flex no es el approach adecuado), proponer la alternativa. Si requiere DevTools para diagnosticar, dar el snippet exacto.**
