# Diagnóstico: barra de escala Leaflet en top-center no aparece

## Contexto
Plugin SignalK web (Leaflet 1.9.4 vendored, vanilla JS).  
Página `mobile.html` ~13k líneas. Sidebar izq (#m-leftbar) y der (#m-sidebar) con botones touch en ambos lados del mapa Leaflet (#map).

Quiero **una barra de escala adicional** centrada arriba del mapa, discreta y dinámica al zoom — complementa la que ya existe abajo a la izquierda.

## Qué he hecho (no funciona — el elemento NO se ve en pantalla)

### CSS (dentro de `<style>` global de mobile.html)

```css
.m-scale-top-center{
  position:fixed!important;
  top:10px!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  z-index:1200!important;
  pointer-events:none!important;
  margin:0!important;
  float:none!important;
}
.m-scale-top-center .leaflet-control-scale-line{
  background:rgba(10,30,50,.78)!important;
  border:1.5px solid rgba(255,255,255,.7)!important;
  color:#fff!important;
  font-weight:700!important;
  font-size:13px!important;
  text-shadow:0 1px 1px rgba(0,0,0,.7)!important;
  width:auto!important;min-width:80px!important;padding:0 8px!important;
  height:22px!important;line-height:20px!important;
}
```

### JS (dentro de la función que inicializa el mapa, después de `var map = L.map(...)`)

```js
m_scaleTopCtrl = null;
window.m_initScaleTop = function(){
  try {
    if (typeof map === 'undefined' || !map) return;
    if (m_scaleTopCtrl) { try{ map.removeControl(m_scaleTopCtrl); }catch(_){}; m_scaleTopCtrl = null; }
    try { document.querySelectorAll('body > .leaflet-control-scale.m-scale-top-center').forEach(n => n.remove()); } catch(_){}
    var isImp = (typeof unitFmt !== 'undefined' && unitFmt.system && unitFmt.system().indexOf('imperial') === 0);
    m_scaleTopCtrl = L.control.scale({metric:!isImp, imperial:isImp, maxWidth:180, position:'topleft', updateWhenIdle:false}).addTo(map);
    var c = m_scaleTopCtrl.getContainer();
    if (c) {
      c.classList.add('m-scale-top-center');
      // Movido al body para escapar del .leaflet-top.leaflet-left que rompe position:fixed por contexto de stacking
      try { document.body.appendChild(c); } catch(_){}
    }
  } catch(_){}
};
window.m_initScaleTop();
```

Existe ya OTRA escala (la "normal" Leaflet) en `bottomleft` con `L.control.scale({position:'bottomleft'})` y FUNCIONA correctamente.

## Estructura DOM relevante

```
<body class="mobile-ui">
  <div id="map">  <!-- 100% width/height, position:absolute, top/left/right/bottom:0, z-index sin definir (auto) -->
    <!-- Leaflet inyecta aquí varios divs .leaflet-* -->
    <div class="leaflet-pane leaflet-map-pane">...</div>
    <div class="leaflet-top leaflet-left">
      <div class="leaflet-control-zoom leaflet-bar leaflet-control">...</div>
    </div>
    <div class="leaflet-top leaflet-right"></div>
    <div class="leaflet-bottom leaflet-left">
      <div class="leaflet-control-scale leaflet-control">...</div>   <!-- la que SÍ funciona -->
    </div>
    <div class="leaflet-bottom leaflet-right"></div>
  </div>
  <div id="m-leftbar">...</div>      <!-- position:fixed, top:8px, left:8px, z-index:1100 -->
  <div id="m-sidebar">...</div>      <!-- position:fixed, top:8px, right:8px, z-index:1100 -->
  <div id="m-bottom-bar">...</div>   <!-- position:fixed, bottom:0 -->
  <!-- aquí debería aparecer el .leaflet-control-scale.m-scale-top-center movido por appendChild -->
</body>
```

## Síntomas

- Usuario reporta: "Sigue sin salir escala".
- No es problema de Z-index visualmente: 1200 > 1100 sidebars.
- Tampoco es JS error fatal (otros bloques funcionan).
- La OTRA escala (bottomleft) sí aparece.

## Hipótesis que ya he descartado o probado

1. **position:absolute dentro de .leaflet-top.leaflet-left** — descartado, ahora uso `position:fixed!important`.
2. **z-index** — subido a 1200.
3. **Cache del navegador** — el usuario hace Ctrl+F5.
4. **Tipografía / color invisible** — backround dark con border blanco; debería verse en cualquier capa.
5. **El elemento se mueve OK al body** — código `document.body.appendChild(c)` ejecuta sin throw.

## Lo que NO he comprobado

- Si Leaflet añade `display:none` o lo elimina cuando lo movemos fuera de su container.
- Si hay alguna media query / `@supports` que oculte `.leaflet-control-scale` no descendiente de `.leaflet-control-container`.
- Si el `pointer-events:none` interfiere con el render (no debería, pero...).
- Si `position:fixed` queda anulado por algún ancestor con `transform`/`will-change`/`filter`/`perspective`. Aunque ahora está como hijo del `<body>`, posiblemente alguna regla CSS `@media body.mobile-ui *` añada algo.

## Lo que se necesita

**Diagnóstico definitivo** de por qué no se ve el elemento `.m-scale-top-center` aunque se crea, se mueve al `<body>` y tiene `position:fixed; top:10px; left:50%; z-index:1200`.

Y la **solución correcta** para tener una barra de escala náutica:
- Posicionada arriba al centro del mapa (no en las esquinas).
- Discreta (background semi-opaco oscuro, texto blanco).
- Dinámica: se actualiza con el zoom (lo que hace L.control.scale por defecto).
- Respetando metric/imperial según el sistema de unidades configurado por el usuario.

Si la respuesta es "no uses L.control.scale, crea un L.Control.extend con la lógica de cálculo nautical-miles/kilometers en `_onZoomEnd` y posiciónalo via DOM normal con position:fixed", está bien — dame el código completo.

Lo más simple que funcione. No más de ~30 líneas de JS + CSS si es posible.
