# Prompt para LLM externo — Modal "Wave history – legend & details" no muestra letras grandes

## Contexto del proyecto

- Plugin SignalK (Node 20, TypeScript backend en `src/index.ts`, UI monolítica en `public/mobile.html` con vanilla JS + CSS embebido, ~640 KB).
- Corre en Raspberry Pi (OpenPlotter V4); se sirve por HTTP en `localhost:3000/signalk-mareas-ihm/visorfondeo` y se ve desde el navegador del barco.
- El usuario ha pedido que TODOS los modales informativos tengan textos grandes (40-54 px en títulos, 28-36 px en cuerpos), porque se ve a la luz solar marítima desde ~1 m de distancia.

## El problema concreto

Hay un modal "Wave history – legend & details" (`#wave-hist-info-pop`) que tiene:
1. Header naranja inyectado dinámicamente con título "Wave history – legend & details" (clase `.m-modal-hdr .m-title`).
2. Un subtítulo descriptivo.
3. Una leyenda de 5 colores con labels (Calm, Rippled, Moderate, Rough, Strong) y rangos (<0.5°, 0.5–1.5°…).
4. Una **tabla generada por `_renderWaveHistInfo()`** en `#wave-hist-info-table` que muestra START / INTENSITY / PERIOD / HEIGHT / RMS y filas con horas y datos.

**El usuario reporta que la tabla, después de 4 iteraciones nuestras de subir tamaños, "sigue igual" (enana).**

## Lo que he intentado y NO ha funcionado

### Iteración 1 — Reglas CSS al contenedor
```css
body.mobile-ui #wave-hist-info-pop #wave-hist-info-table{font-size:36px!important;line-height:1.6!important}
body.mobile-ui #wave-hist-info-pop #wave-hist-info-table th,
body.mobile-ui #wave-hist-info-pop #wave-hist-info-table td{font-size:34px!important;padding:10px 14px!important}
```
**Por qué no funcionó:** la tabla NO está hecha con `<table><th><td>`. Está hecha con `<div display:grid>`. Las reglas a `th, td` no apuntan a nada existente. La regla al contenedor `#wave-hist-info-table` aplica solo al elemento padre y los hijos heredan o sobrescriben con su propio inline.

### Iteración 2 — Subir font-sizes INLINE en el JS
En `_renderWaveHistInfo()` cambié:
- Header div: `font-size:16px` → `28px`
- Rows div: `font-size:18px` → `30px`
- Span de RMS: `font-size:16px` → `26px`
- Span badge "CURRENT": `font-size:13px` → `20px`

```js
var rows=['<div style="display:grid;grid-template-columns:160px 1fr 140px 160px 160px;gap:12px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,.22);font-weight:800;color:#9ad;font-size:28px;letter-spacing:.8px;text-transform:uppercase">',
  '<span>'+_hInicio+'</span>',
  '<span>'+_hInten+'</span>',
  '<span style="text-align:right">'+_hPer+'</span>',
  '<span style="text-align:right">'+_hAlt+'</span>',
  '<span style="text-align:right">'+_hRms+'</span>',
  '</div>'];
// ...
for(var i=0;i<sorted.length;i++){
  // ...
  rows.push('<div style="display:grid;grid-template-columns:160px 1fr 140px 160px 160px;gap:12px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);align-items:center;font-size:30px">'+
    '<span style="color:#fff;font-weight:700">'+hhmm+'</span>'+
    '<span><span style="display:inline-block;width:22px;height:22px;border-radius:4px;background:'+color+';margin-right:12px;vertical-align:middle"></span>'+intCap+curBadge+'</span>'+
    '<span style="text-align:right;color:#cfd8dc">'+per+'</span>'+
    '<span style="text-align:right;color:#cfd8dc;font-weight:700">'+alt+'</span>'+
    '<span style="text-align:right;color:#888;font-size:26px">'+rms+'</span>'+
  '</div>');
}
el.innerHTML=rows.join('');
```

**Por qué no funcionó (sospecha):** quizá no funcionó por cache. O quizá sí funcionó y el usuario percibió el cambio como insuficiente.

### Iteración 3 — Limpieza de reglas CSS conflictivas
Encontré una regla **antigua Rev189** en `mobile.html:1344` que decía:
```css
body.mobile-ui #wave-hist-info-pop #wave-hist-info-table{font-size:24px!important}
```
Esta regla aparece DESPUÉS de mi regla nueva en línea 1046 (`font-size:36px!important`). Con misma especificidad y mismo `!important`, **gana la que aparece más tarde** → la 24 px ganaba. La eliminé.

También eliminé otra regla obsoleta:
```css
body.mobile-ui #wave-hist-info-pop #shelter-wave-hist-svg,
body.mobile-ui #wave-hist-info-pop svg{min-height:140px!important;height:140px!important}
```
(no aplicaba a nada porque ya no hay SVG dentro de este modal).

**Por qué no funcionó (sospecha):** porque los font-sizes inline del JS ya ganaban sobre la regla CSS del contenedor (los hijos `<div>` y `<span>` tienen inline propio). El problema central no era el contenedor.

### Iteración 4 — Cache-Control no-cache en mobile.html
Descubrí que `mobile.html` se sirve con `res.sendFile()` SIN headers de cache-control. El propio script de deploy nos avisa: *"For HTML/JS/CSS changes (public/*): just refresh the browser (Ctrl+F5)"*.

Añadí en backend:
```ts
function _setHtmlNoCacheHeaders(res: any) {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}
```

**Por qué quizá no funcione:** este fix solo afecta a futuras peticiones. El browser ya tiene `mobile.html` cacheado de Rev381 y NO consulta al server, sirve del cache. El usuario tendría que hacer Ctrl+F5 al menos UNA VEZ.

## Sospecha actual de la causa raíz

Probablemente UNA o VARIAS de estas:

1. **Browser cache pegado**: el usuario tiene `mobile.html` cacheado desde antes; el deploy llega al Pi pero el browser nunca pide la versión nueva. Mi Rev384 lo arregla A PARTIR DE ahora pero requiere Ctrl+F5 una vez para "purgar" la versión vieja cacheada.

2. **Service Worker zombie**: el código en `mobile.html:2145-2155` intenta desregistrar SWs antiguos:
   ```js
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.getRegistrations().then(function(regs){
       regs.forEach(function(r){
         if (r && r.scope && r.scope.indexOf('/signalk-mareas-ihm') !== -1) {
           r.unregister().catch(function(){});
         }
       });
     });
   }
   ```
   Pero esto solo se ejecuta cuando se carga `mobile.html` nuevo. Si el browser sirve la versión cacheada, el JS nuevo no corre, el SW viejo no se mata, y posiblemente el SW intercepta TODAS las peticiones (incluyendo `mobile.html` fresco).

3. **Tipografía del sistema operativo / DPI**: el usuario está en Mac/Windows con DPI escalado. Los píxeles CSS quizá NO se ven tan grandes como en el HTML.

4. **El font-size inline del `<div id="wave-hist-info-table" style="font-size:24px;...">` (mobile.html línea 1783)** podría estar afectando vía herencia. El `innerHTML` reemplaza el contenido pero el inline del padre permanece. Aunque los hijos generados tienen font-size inline propio (28/30 px), ¿podría haber algún caso edge donde no se apliquen?

## Estructura del HTML real

```html
<!-- mobile.html línea 1773 aprox -->
<div class="popup-overlay" id="wave-hist-info-pop" onclick="closePopup('wave-hist-info-pop')">
  <div class="popup-box" onclick="event.stopPropagation()">
    <h4 data-i18n="sh_wh_title">Historial de olas — leyenda y detalle</h4>
    <div style="font-size:36px;color:#9ad;margin-bottom:28px;line-height:1.4" data-i18n="sh_wh_subtitle">Cada barra resume 5 minutos. Color = ...</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:32px">
      <!-- 5 div con leyenda Calm/Rippled/Moderate/Rough/Strong -->
    </div>
    <div id="wave-hist-info-table" style="font-size:24px;color:#cfd8dc"></div>
  </div>
</div>
```

El `_mInjectModalHeader()` JS añade dinámicamente un header naranja sticky con BACK + título antes del primer hijo del `.popup-box`. Por eso el `<h4>` original se hace `display:none` y el título lo muestra `.m-modal-hdr .m-title`.

## CSS relevante actualmente en mobile.html

```css
/* Línea 840 — TODOS los popup-overlay popup-box en mobile-ui */
body.mobile-ui .popup-overlay .popup-box{
  position:fixed!important;
  inset:0!important;
  width:100%!important;height:100%!important;
  max-width:100%!important;max-height:100%!important;
  padding:104px 24px 32px!important;
  overflow-y:auto!important;
  font-size:24px!important;  /* <-- HEREDA a hijos sin font-size propio */
  color:#fff!important;
}

/* Línea 1014 — específico para los 3 modales info, sobrescribe */
body.mobile-ui #shelter-score-pop .popup-box,
body.mobile-ui #shelter-legend-pop .popup-box,
body.mobile-ui #wave-hist-info-pop .popup-box{
  position:fixed!important;
  inset:1vh 1vw!important;
  top:1vh!important;right:1vw!important;bottom:1vh!important;left:1vw!important;
  transform:none!important;
  width:auto!important;max-width:none!important;
  height:auto!important;max-height:none!important;
  border-radius:26px!important;
  padding:160px 96px 72px!important;
  overflow-y:auto!important;
}

/* Líneas 1031-1042 — el header inyectado naranja */
body.mobile-ui #shelter-score-pop .m-modal-hdr,
body.mobile-ui #shelter-legend-pop .m-modal-hdr,
body.mobile-ui #wave-hist-info-pop .m-modal-hdr{height:128px!important}
body.mobile-ui #shelter-score-pop .m-modal-hdr .m-title,
body.mobile-ui #shelter-legend-pop .m-modal-hdr .m-title,
body.mobile-ui #wave-hist-info-pop .m-modal-hdr .m-title{font-size:54px!important}
body.mobile-ui #shelter-score-pop .m-modal-hdr .m-back,
body.mobile-ui #shelter-legend-pop .m-modal-hdr .m-back,
body.mobile-ui #wave-hist-info-pop .m-modal-hdr .m-back{font-size:32px!important}

/* Subtítulo y contenedor de tabla */
body.mobile-ui #wave-hist-info-pop div[data-i18n="sh_wh_subtitle"]{font-size:36px!important;line-height:1.4!important;margin-bottom:36px!important}
body.mobile-ui #wave-hist-info-pop #wave-hist-info-table{line-height:1.6!important}
```

## Estructura de la tabla generada por el JS

```html
<!-- header -->
<div style="display:grid;grid-template-columns:160px 1fr 140px 160px 160px;gap:12px;padding:16px 0;font-weight:800;color:#9ad;font-size:28px;letter-spacing:.8px;text-transform:uppercase">
  <span>START</span>
  <span>INTENSITY</span>
  <span style="text-align:right">PERIOD</span>
  <span style="text-align:right">HEIGHT</span>
  <span style="text-align:right">RMS</span>
</div>

<!-- fila -->
<div style="display:grid;grid-template-columns:160px 1fr 140px 160px 160px;gap:12px;padding:14px 0;font-size:30px">
  <span style="color:#fff;font-weight:700">23:06</span>
  <span><span style="display:inline-block;width:22px;height:22px;border-radius:4px;background:#3aa856;margin-right:12px"></span>Calm <span style="font-size:20px;color:#ffeb3b;font-weight:900;margin-left:10px;padding:4px 12px;background:rgba(255,235,59,.12);border-radius:6px">CURRENT</span></span>
  <span style="text-align:right;color:#cfd8dc">1.1s</span>
  <span style="text-align:right;color:#cfd8dc;font-weight:700">0,03 m</span>
  <span style="text-align:right;color:#888;font-size:26px">0.18°</span>
</div>
```

## Pregunta concreta

1. **¿Por qué los textos de la tabla siguen viéndose pequeños** pese a que los font-sizes inline en los `<div>` y `<span>` son 28-30 px?
2. **¿Hay una causa real OTRA que el browser cache**? ¿Una regla CSS de herencia agresiva? ¿Un Service Worker que intercepta sin ejecutar el zombie killer?
3. **¿Cuál es el approach más limpio** para garantizar que un modal específico tenga textos grandes que NO falle por ninguna interferencia (cache, SW, herencia CSS, regla huérfana, etc)?
4. **¿Hay algo obvio que el ingeniero está pasando por alto?** El usuario lleva tiempo enfadado y ya ha agotado la paciencia.

## Reglas del proyecto (memoria persistente del agente)

- Una cosa por commit, testable individualmente.
- `PLUGIN_REVISION` se bumpea en cada build.
- Default deploy: `.\deploy.ps1 -Restart` desde el portátil Windows.
- El backend es la única fuente de verdad para estado crítico.
- Tras 3 fallos al mismo bug, NO seguir iterando: preparar este prompt y consultar otro LLM.

---

**Por favor da una respuesta concreta y accionable. Si crees que el problema es trivial (browser cache), dilo. Si crees que hay un bug CSS de cascada/specificity, identifícalo exacto. Si crees que hay un Service Worker zombie, da los pasos para diagnosticarlo desde DevTools.**
