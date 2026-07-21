# Gemini prompt — shelter popup no llena pantalla en portrait

## Contexto

SignalK plugin `signalk-mareas-ihm` (Tunatunes). UI mobile en
`public/mobile.html` (vanilla JS + HTML monolítico, ~9300 líneas). Cuando el
usuario abre el popup "Abrigo" (botón 🏔️ → `openShelterConfig()` →
`openPopup('shelter-pop')`) en un teléfono **en orientación vertical**, el
modal aparece a "media ventana" en ancho **y** alto — NO cubre la pantalla
entera. En orientación horizontal funciona bien.

He intentado 4 iteraciones añadiendo reglas CSS con `!important` y selectores
más específicos. Ninguna ha funcionado. El usuario me ha pedido pedirle ayuda
a otra LLM con todo el contexto.

## Estructura DOM

```html
<div class="popup-overlay" id="shelter-pop" onclick="closePopup('shelter-pop')">
  <div class="popup-box shelter-popup-box"
       onclick="event.stopPropagation()"
       style="background:#0a1e32;backdrop-filter:none;-webkit-backdrop-filter:none">
    <!-- contenido: rosa, donut, infobox, strip horas, gráfica olas -->
  </div>
</div>
```

`<body class="mobile-ui ...">`.

## CSS relevante (orden de declaración en `mobile.html`)

```css
/* Línea 127 — overlay base */
.popup-overlay{
  display:none;position:fixed;inset:0;z-index:2000;
  background:rgba(0,0,0,.5);
  align-items:center;justify-content:center
}
.popup-overlay.open{display:flex}

/* Línea 129 — popup-box base */
.popup-box{
  background:var(--bg);border:1px solid var(--brd);border-radius:12px;
  padding:16px;min-width:300px;max-width:94vw;max-height:85vh;
  overflow-y:auto;backdrop-filter:blur(10px);
  box-shadow:0 8px 40px rgba(0,0,0,.7)
}

/* Línea 252 — sólo @media(max-height:600px), no aplica en portrait normal */
@media(max-height:600px){
  .shelter-popup-box{padding:10px 18px 10px!important}
}

/* Línea 345 — sólo @media(max-width:600px) */
@media(max-width:600px){
  .popup-box{max-width:96vw!important;max-height:80vh!important;overflow-y:auto!important}
}

/* Línea 733 — overlay mobile-ui (stretch flex) */
body.mobile-ui .popup-overlay{
  align-items:stretch!important;justify-content:stretch!important;
  padding:0!important;background:rgba(10,30,50,.6)!important;
  touch-action:pan-y!important;-ms-touch-action:pan-y!important
}

/* Línea 739 — popup-box genérico mobile-ui (debería bastar para fullscreen!) */
body.mobile-ui .popup-overlay .popup-box{
  position:fixed!important;
  inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;
  width:100%!important;height:100%!important;
  max-width:100%!important;max-height:100%!important;
  min-width:0!important;margin:0!important;
  border-radius:0!important;
  padding:96px 24px 32px!important;
  overflow-y:auto!important;overflow-x:hidden!important;
  animation:m-slide-up .26s cubic-bezier(.2,.9,.3,1);
  display:flex!important;flex-direction:column!important;
  font-size:20px!important;
  color:#fff!important;
  touch-action:pan-y!important
}

/* Línea 1062-1090 — reglas hijos shelter (no afectan al popup-box en sí) */
body.mobile-ui #shelter-pop .popup-box span,
body.mobile-ui #shelter-pop .popup-box div{font-size:22px}
body.mobile-ui #shelter-pop #shelter-summary-text{order:2}
body.mobile-ui #shelter-pop #shelter-hours-row{order:3}
body.mobile-ui #shelter-pop #shelter-rose-wrap{order:4}
body.mobile-ui #shelter-pop #shelter-wave-hist-wrap{order:5}

/* Línea 1147 — MI ÚLTIMA REGLA tras consolidar duplicados.
   Specificity (0,4,1) — debería ganar a (0,3,1) de L739. */
body.mobile-ui #shelter-pop .popup-box.shelter-popup-box{
  position:fixed!important;
  top:0!important;left:0!important;right:0!important;bottom:0!important;
  inset:0!important;
  width:100dvw!important;max-width:100dvw!important;min-width:100dvw!important;
  height:100dvh!important;max-height:100dvh!important;min-height:100dvh!important;
  margin:0!important;
  padding:88px 12px 24px!important;
  border-radius:0!important;
  transform:none!important;
  display:flex!important;flex-direction:column!important;
  box-sizing:border-box!important;
  overflow-y:auto!important
}
```

## Lo que esperaría

La regla L1147 (`body.mobile-ui #shelter-pop .popup-box.shelter-popup-box`,
specificity ID:1 / Class:3 / Element:1) gana a L739
(`body.mobile-ui .popup-overlay .popup-box`, ID:0 / Class:3 / Element:1) y a
todas las demás. Con `position:fixed; inset:0; width:100dvw; height:100dvh`
todo `!important` el popup-box debería cubrir el viewport entero. **Y en
LANDSCAPE funciona** — exactamente este mismo CSS aplica y el modal sí es
fullscreen.

## Lo que ocurre

En **portrait sólo** el modal se ve aproximadamente a 50% × 50% del viewport
centrado, como si las reglas L1147 no se aplicaran y aplicara alguna regla
con `max-width: 50vw / max-height: 50vh`. No he encontrado tal regla.

## Hipótesis ya descartadas

1. **Inline styles ganando** — los limpié de `style="..."` del HTML. Sólo
   quedan `background` y `backdrop-filter:none`. Ningún width/height/padding
   en inline.
2. **Otra hoja CSS sobreescribiendo** — el plugin sólo tiene `mobile.html`
   con CSS inline + `public/assets/index-*.css` (que es el bundle de React
   para `TidesView`, NO afecta a mobile.html). Confirmado con grep.
3. **JS modificando style.width/height** — grep `popBox.style`,
   `shelter-pop.*style.` → 0 matches.
4. **Containing-block creado por transform en algún ancestro** — popup-box
   tiene `transform:none!important`. `.popup-overlay` no tiene transform.
   `body.mobile-ui` no tiene transform. `html` no tiene transform.
5. **Animation m-slide-up dejando transform** — el keyframe acaba en
   `translateY(0)` pero `transform:none!important` debería borrarlo.

## Lo que necesito de ti

1. **¿Hay alguna razón POR LA QUE `position:fixed; inset:0; width:100dvw;
   height:100dvh; !important` en una hoja autor NO se aplique** a un
   `<div class="popup-box shelter-popup-box">` cuando la orientación es
   portrait, pero SÍ se aplique en landscape?
2. ¿Existe algún caso conocido de Chromium/WebKit móvil donde `100dvh` se
   reporte mal en portrait? (No uso `100vh` por la barra de URL móvil.)
3. ¿Podría una regla `@media (orientation: landscape)` o similar estar
   anulando mi regla en portrait? (no encuentro ninguna sobre el popup-box,
   pero quizá hay un edge case.)
4. ¿Hay alguna manera de **forzar desde JavaScript** que el popup-box ocupe
   el viewport entero (`element.style.cssText = '...'` con todas las
   propiedades + `!important`)? Si la respuesta es "sí", muéstrame el código
   exacto (incluyendo cómo limpiar el style al cerrar el popup).

## Archivo completo de referencia

`public/mobile.html` líneas 127-1200 (CSS del popup) y 1422-1700 (HTML del
shelter-pop). Si necesitas más contexto, puedo pegar bloques específicos.

## Repro

1. Build (`npm run build`) y deploy al Pi (`./deploy.ps1 -Restart`).
2. Abrir `http://pi:3000/signalk-mareas-ihm/mobile` en un teléfono Android
   en orientación vertical (~400×800 viewport).
3. Click en botón 🏔️ Abrigo de la sidebar derecha.
4. Observar: modal ocupa ~50%×50% en lugar de pantalla completa.
5. Rotar a horizontal — el modal pasa a ser fullscreen correcto.

¿Qué falta?
