# Prompt para Gemini / GPT — los 3 modos del modal Instrucciones no aumentan el texto aunque le ponga `!important`

## Contexto del proyecto

Plugin SignalK con UI híbrida:
- **TidesView.tsx** (React, vive en `app/views/TidesView.tsx`) → app de mareas. Compilada con Vite a `public/assets/index-XXX.js`. Se sirve en `/signalk-mareas-ihm/mareas` y como root `/signalk-mareas-ihm/`.
- **mobile.html** (vanilla, vive en `public/mobile.html`) → visor de fondeo (anchor watch).
- Stack: Vite 7 + React 19 + TypeScript. CSS en `app/App.css`.

El modal de Instrucciones del visor móvil ABRE TidesView **en un iframe** con
`?embed=1&showInstructions=1`. Dentro de TidesView hay 3 vistas que comparten
el mismo `<div className="instrucciones-body instrucciones-scroll">`:

1. **INSTRUCCIONES** — manual ES/EN.
2. **VERSIONES** (CHANGELOG) — render markdown de CHANGELOG.md servido por el plugin.
3. **AVISO LEGAL** — disclaimer.

## El problema (afecta a los TRES)

Carlos pide aumentar el tamaño del texto en los 3 modos del modal. He estado
subiendo font-size con `!important` en inline styles y **NO crece visualmente**.
Las tres vistas se ven con el mismo tamaño (~24px) aunque las inline digan
28px, 34px, 38px, etc.

Como afecta a los 3, no es problema del renderer markdown del CHANGELOG ni del
JSX de INSTRUCCIONES — es algo común a todo lo que se pinta dentro del modal.

## Lo que YA he probado (solo en el CHANGELOG, antes de saber que afectaba a los 3)

| Rev | Cambio | Resultado |
|---|---|---|
| 528 | body 19px, h2 24, h3 20 (sin !important) | "muy chico" |
| 529 | body 23, h1 32, h2 28, h3 24, h4 22 (sin !important) | "no crece" |
| 530 | body 28, h1 38, h2 34, h3 28, h4 26 + `!important` en TODO inline | "no crece, algo pisa" |

Estructura del JSX del CHANGELOG:

```jsx
<div
  className="changelog-md"
  style={{ fontSize: 28, lineHeight: 1.6, color: '#cfd8dc' }}
  dangerouslySetInnerHTML={{ __html: `
    <h2 style="color:#ffb23f;font-size:34px !important;...;font-weight:800">[2.3.2] - 2026-06-24</h2>
    <p style="margin:8px 0;font-size:28px !important">UI polish — modal headers...</p>
    <ul><li style="margin:5px 0;font-size:28px !important">...</li></ul>
  ` }}
/>
```

## Reglas CSS externas que tocan el modal

`app/App.css`:

```css
.modal-content { background: #0a4a5a; border-radius: 16px; padding: 24px 32px; max-width: 600px; width: 100%; display: flex; flex-direction: column; overflow: hidden; }
.modal-content h2 { font-size: 24px; color: #ffb23f; }
.modal-content h3 { font-size: 16px; color: #49f6a4; }
.modal-content p { font-size: 15px; line-height: 1.6; }
.modal-content li { font-size: 15px; line-height: 1.5; }
.modal-content code { font-size: 12px; }

.instrucciones-modal h2 { font-size: 34px; }
.instrucciones-modal h3 { font-size: 28px; }
.instrucciones-modal h4 { font-size: 24px; }
.instrucciones-modal p, .instrucciones-modal li { font-size: 24px; line-height: 1.5; }
.instrucciones-modal strong { font-size: inherit; }
.instrucciones-modal table { font-size: 24px; line-height: 1.4; }
.instrucciones-modal th, .instrucciones-modal td, .instrucciones-modal code { font-size: 24px; }

.modal-buttons-fixed button { font-size: 16px !important; }
```

**Solo `.modal-buttons-fixed button` tiene `!important`** (no aplica al texto).
Mis inline con `!important` deberían ganar siempre. Pero no se ve.

## Estructura DOM real cuando el modal está abierto desde el visor móvil

```html
<!-- mobile.html (visor de fondeo) -->
<body class="mobile-ui">
  <div id="m-instructions-overlay" class="popup-overlay open">
    <div class="popup-box">
      <div class="m-modal-hdr">
        <button class="m-back">‹ Atrás</button>
        <div class="m-title">📖 Instrucciones · 2.3.2</div>
        <div class="m-close-spacer"></div>
      </div>
      <h4 id="m-instructions-title" style="display:none">📖 Instrucciones · 2.3.2</h4>
      <iframe id="m-instructions-iframe"
              src="/signalk-mareas-ihm/mareas?embed=1&showInstructions=1&lang=es&t=..."
              style="width:100%;border:none;display:block;touch-action:pan-y;flex:1 1 auto;min-height:0">

        <!-- DENTRO DEL IFRAME — documento independiente (index.html + TidesView React) -->
        <html>
          <head>...</head>
          <body>
            <div class="modal-overlay">
              <div class="modal-content modal-fullscreen instrucciones-modal">
                <h2>AnchorWatch Pro: Smart Anchoring, AIS & Tides – v2.3.2</h2>
                <div class="instrucciones-body instrucciones-scroll">
                  <div class="changelog-md" style="font-size:28px;...">
                    <h2 style="font-size:34px !important">...</h2>
                    <p style="font-size:28px !important">...</p>
                  </div>
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

## Lección clave aprendida ayer (memoria)

Ayer (2026-06-23) resolvimos un caso casi idéntico con sub-modales shelter del
visor móvil:

> `.popup-overlay { zoom: var(--ui-scale) }` (línea 38 de `mobile.html`,
> dentro de un selector multi-línea que se me escapó al greppear).
> `--ui-scale` se calcula con JS = `min(w/1920, h/1080)` clamp [0.6, 1.0].
> En mobile vertical sale 0.6.
>
> Los sub-modales shelter estaban anidados DENTRO de `#shelter-pop` que era
> otro `.popup-overlay` → zoom se componía (0.6 × 0.6 = 0.36).

Fix: mover sub-modales fuera del padre. Diagnóstico convergente GPT + Gemini.

**Lección**: cuando computed dice X pero visual es menor, sospechar `zoom` o
`transform: scale()` en algún ancestro. `getBoundingClientRect()` revela el
tamaño pintado; comparar con `offsetHeight` da el factor.

## Hipótesis CLAVE actual

El **iframe `#m-instructions-iframe`** se renderiza dentro del `#m-instructions-overlay`
que es `.popup-overlay`. La regla L38 de `mobile.html`:

```css
:root{--ui-scale:1}
.btn-float,.btn-tc,.lang-flags,.popup-overlay,#btn-top-row,
#panel,#shelter-tooltip,#nivel-zoom-display,#bottom-info,
.bottom-info,.audio-unlock-tap{zoom:var(--ui-scale)}
```

En mobile vertical `--ui-scale = 0.6`. Eso aplica `zoom: 0.6` al
`.popup-overlay` que contiene el iframe.

**¿`zoom` se hereda al contenido del iframe?**

En Chrome/Blink: `zoom` aplicado al iframe HOST escala visualmente el contenido
del iframe como parte del rasterizado. El contenido del iframe NO sabe que está
escalado (su `getComputedStyle` reporta los CSS pixels nominales), pero PINTA
al 60%. Resultado: subir font-size dentro del iframe NO cambia el tamaño
visual porque el zoom externo lo divide.

Esto explica TODO:
- Mis 24px hereditados de `.instrucciones-modal p` se ven como 24×0.6=14.4px.
- Mis 28px !important del CHANGELOG se ven como 28×0.6=16.8px.
- Mis 38px del h1 se ven como 38×0.6=22.8px.
- Carlos percibe que "no crecen" porque siguen siendo POR DEBAJO de lo que
  espera para un texto legible en su iPad.

## Pregunta concreta

1. ¿Confirmas que `zoom: var(--ui-scale) = 0.6` en el `.popup-overlay` del
   visor móvil ESCALA el iframe `#m-instructions-iframe` y por tanto TODO
   su contenido renderizado al 60% visual?

2. Si sí, ¿cuál es el fix más limpio?
   - (a) Cancelar el zoom del iframe específicamente con
     `#m-instructions-iframe { zoom: calc(1 / var(--ui-scale)) }` (frágil,
     posibles diferencias entre navegadores).
   - (b) Quitar `.popup-overlay` de la lista de zoom de la L38 de mobile.html
     y aplicar zoom solo a los elementos que de verdad lo necesitaban
     (`.btn-float`, sidebars, etc.).
   - (c) Sacar el modal de Instrucciones del `.popup-overlay` (anidarlo
     directamente bajo `<body>` como overlay propio sin zoom).
   - (d) Cambiar el sistema de iframe por incrustar TidesView vía componente
     directo (sin iframe).
   - (e) Algo más limpio que se me escape.

3. Comando JS para verificarlo OBJETIVAMENTE (ejecutar en la consola del
   navegador con el modal abierto):

```js
const iframe = document.getElementById('m-instructions-iframe');
const overlay = iframe?.closest('.popup-overlay');
console.log({
  overlayZoom: overlay ? getComputedStyle(overlay).zoom : 'no-overlay',
  uiScale: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'),
  iframeRect: iframe?.getBoundingClientRect(),
  iframeOffset: { w: iframe?.offsetWidth, h: iframe?.offsetHeight },
  // Acceder al contenido del iframe (same-origin):
  innerBody: iframe?.contentDocument?.body,
  innerP: iframe?.contentDocument?.querySelector('.changelog-md p'),
  innerPComputed: iframe?.contentDocument ? getComputedStyle(iframe.contentDocument.querySelector('.changelog-md p')).fontSize : 'no-doc',
  innerPRect: iframe?.contentDocument?.querySelector('.changelog-md p')?.getBoundingClientRect(),
});
```

## Stack técnico (referencia)

- mobile.html sirve `/signalk-mareas-ihm/visorfondeo` y carga el iframe
  TidesView (React + Vite) en `/signalk-mareas-ihm/mareas?embed=1&showInstructions=1`.
- TidesView vive en `app/views/TidesView.tsx`, CSS en `app/App.css`.
- `--ui-scale` se calcula y se setea en JS:
  ```js
  function _applyUiScale(){
    var w=window.innerWidth||1920, h=window.innerHeight||1080;
    var s=Math.min(w/1920, h/1080);
    if(s>1)s=1; if(s<0.6)s=0.6;
    document.documentElement.style.setProperty('--ui-scale', String(s.toFixed(3)));
  }
  ```
- Regla zoom (line 38 mobile.html):
  ```css
  .btn-float,.btn-tc,.lang-flags,.popup-overlay,#btn-top-row,
  #panel,#shelter-tooltip,#nivel-zoom-display,#bottom-info,
  .bottom-info,.audio-unlock-tap{zoom:var(--ui-scale)}
  ```

Necesito diagnóstico de primeros principios. Y si el fix correcto es eliminar
el zoom heredado al iframe, dime cuál de las opciones (a)-(e) es más robusta
sin romper el visor móvil entero (que SÍ depende del zoom para que los botones
flotantes encajen).
