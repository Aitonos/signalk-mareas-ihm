# Prompt para Gemini — TidesView: el título no se ve

## Contexto

Plugin SignalK del barco Tunatunes (`signalk-mareas-ihm`, Rev323, v2.1.5).

Hay dos UIs principales:

1. **mobile.html** (vanilla JS, ~9500 líneas) — Visor de fondeo principal.
2. **TidesView.tsx** (React) — Componente embebido como iframe dentro
   de mobile.html cuando el usuario abre la vista de mareas, o
   accesible directamente vía URL `/signalk-mareas-ihm/visorfondeo`.

El iframe se monta dentro de `index.html`, que tiene un **header iOS
fijo** (`#m-tv-header`, 64px de alto, position:fixed, z-index 9999) con
botón Atrás + título "🌊 Tides / 🌊 Mareas" + botón Curvas.

## El bug — repetido en Rev319, Rev320, Rev321, Rev322

El usuario reporta UNA Y OTRA VEZ que **el título del TidesView NO se
ve** (o se ve mal, o queda oculto detrás del header, o se ve cortado).
Ya he intentado:

- **Rev319**: Subir font-size del `.header-title` de 20 → 28px,
  font-weight 900, color #fff. **Resultado:** el usuario sigue
  reportando que no se ve.
- **Rev320**: i18n del header `#m-tv-header` para que muestre
  "🌊 Mareas" (ES) o "🌊 Tides" (EN). **Resultado:** sigue reportando
  mal.
- **Rev321**: En `TidesView.tsx` añadí offset top = `m-tv-header.offsetHeight`
  para que `.tide-page` no quede oculta bajo el header.
  **Resultado:** sigue reportando mal.
- **Rev322**: Cambié título a "Tides (IHM Spain)" / "Mareas (IHM)".
  **Resultado:** sigue reportando mal.

El usuario me ha pedido literalmente:

> "DADO QUE TIDES VIEW SIEMPRE ME DICES QUE LO ARREGLAS Y SIEMPRE ESTÁ
> IGUAL, HAZME UN PROMPT PARA que pregunte a Gemini porque no te
> enteras de nada."

## Lo que necesito que me digas

**No me digas qué línea cambiar.** Necesito que me digas QUÉ ESTÁ MAL
de raíz. Posibilidades que sospecho pero no he confirmado:

1. ¿Hay un **conflicto de capas Z** entre el `#m-tv-header` (z-index 9999,
   fixed) y el `.tide-page` (absolute, transform scale)?
2. ¿El `transform: scale(var(--viewport-scale))` está escalando también
   el header del componente React (`.tide-header` con `.header-title`
   dentro), y queda DEBAJO del header iOS de 64px o ESCALADO A 0?
3. ¿Hay dos "títulos" compitiendo — el de `#m-tv-header` (en index.html)
   y el `<div className="header-title">` (en TidesView.tsx) — y el
   usuario realmente quiere uno SOLO y se queja porque hay redundancia
   visual?
4. ¿El cálculo `el.style.top = ${hdrH}px` está aplicándose tras el
   primer render, pero el header iOS se renderiza DESPUÉS y el offset
   queda mal (race condition)?
5. ¿La fuente 28px se ve "ilegible" porque está dentro de un transform
   scale 0.5? (En portrait `s = vw/baseW = 412/825 = 0.50`. El texto
   queda visual ~14px en pantalla.)

## Archivos relevantes (te paso las partes esenciales)

### 1) `index.html` — wrapper del iframe del TidesView

```html
<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Mareas (IHM)</title>
</head>
<body>
  <!-- Header iOS-style con back+título centrado para TidesView embebido -->
  <div id="m-tv-header" style="display:none;position:fixed;top:0;left:0;right:0;height:64px;z-index:9999;background:rgba(10,30,50,.97);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,178,63,.3);align-items:center;justify-content:space-between;padding:0 12px">
    <button id="m-tv-back" onclick="history.back()" style="...">‹ Back</button>
    <div id="m-tv-title-txt" style="flex:1;text-align:center;font-size:22px;font-weight:900;color:#fff">🌊 Tides</div>
    <button id="m-tv-curvas" onclick="..." style="...">📈 Curves</button>
  </div>
  <script>
    // Detecta si viene de mobile o es mobile UA → muestra el header
    var fromMobile = (document.referrer || '').indexOf('/signalk-mareas-ihm/mobile') >= 0;
    var fromVisor = (document.referrer || '').indexOf('/signalk-mareas-ihm/') >= 0;
    if (isMobile || fromMobile || fromVisor) {
      document.getElementById('m-tv-header').style.display = 'flex';
      document.documentElement.style.paddingTop = '64px';
    }
    // i18n ES/EN del header según ?lang=es o localStorage 'ihm-visor-lang'
  </script>
  <div id="app"></div>
  <script type="module" src="/app/main.tsx"></script>
</body>
</html>
```

Nota: el header iOS está en index.html, NO dentro del componente React.
El paddingTop:64px del `<html>` empuja todo el contenido React hacia
abajo.

### 2) `app/views/TidesView.tsx` — componente React

Cálculo del scale y posición de `.tide-page`:

```tsx
useLayoutEffect(() => {
  const updateScale = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const baseW = 825;
    const baseH = 890;
    const isPortrait = vh > vw;
    const s = isPortrait ? (vw / baseW) : Math.min(vw / baseW, vh / baseH);
    document.documentElement.style.setProperty('--viewport-scale', String(s));
    const el = document.querySelector('.tide-page') as HTMLElement;
    const tvHdr = document.getElementById('m-tv-header');
    const hdrH = tvHdr && tvHdr.offsetParent !== null ? tvHdr.offsetHeight : 0;
    if (el) {
      el.style.left = `${Math.max(0, (vw - baseW * s) / 2)}px`;
      el.style.top = isPortrait
        ? `${hdrH}px`
        : `${Math.max(hdrH, (vh - baseH * s) / 2)}px`;
    }
  };
  updateScale();
  window.addEventListener('resize', updateScale);
  return () => window.removeEventListener('resize', updateScale);
}, []);
```

JSX del header del componente:

```tsx
<header className="tide-header">
  <div className="header-lines">
    <div className="header-title">
      {tr("Tides (IHM Spain)", "Tides (IHM Spain)")}
    </div>
  </div>
</header>
<main className="tide-main">
  <div className={`tide-station ${isRefreshing ? 'refreshing' : ''}`}>{displayStationName}</div>
  ...
</main>
```

### 3) `app/App.css` — estilos relevantes

```css
:root { color-scheme: dark; --viewport-scale: 1; }
body { margin: 0; background: #04384a; overflow: hidden; }

/* Escenario fijo: 825x890 escalado uniforme */
.tide-page {
  position: absolute;
  width: 825px;
  height: 890px;
  background: #04384a;
  color: white;
  transform-origin: top left;
  transform: scale(var(--viewport-scale));   /* <-- ESCALA TODO */
  display: flex;
  flex-direction: column;
  padding: 8px 18px;
}

.tide-header {
  display: flex; justify-content: center; align-items: center;
  gap: 12px; padding: 14px 0 10px;
  position: relative; z-index: 100;
}

.header-lines {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}

/* Rev319: título 28px bold blanco */
.header-title {
  font-size: 28px; font-weight: 900; color: #fff;
  letter-spacing: -.3px; opacity: 1;
}

.tide-station {
  text-align: center; font-size: 36px; font-weight: 900;
  color: #ffb23f; padding: 2px 0 6px 0;
}
```

### Dimensiones del problema

- En **portrait** mobile (412px × 915px típico iPhone 12):
  - `s = 412 / 825 = 0.499`.
  - `.tide-page` está a `top: 64px` (offset del header iOS).
  - Como `transform-origin: top left`, el contenido visual del
    `.tide-page` va desde Y=64px hasta Y=64+890·0.5=509px.
  - El `.header-title` tiene font-size 28px **antes** del scale →
    14px **después** del scale.
  - El header iOS de index.html mide 22px → texto se ve a 22px (no
    está dentro del scale).

## Preguntas concretas

1. ¿El `.header-title` (28px) escalado a 0.5 queda visualmente a 14px
   y el usuario lo percibe como "no se ve" porque es demasiado pequeño
   frente al título iOS de 22px (que SÍ está sin escalar)?

2. ¿Es mejor **eliminar** el `.header-title` del componente React y
   dejar solo el header iOS de `index.html`? El header iOS ya muestra
   "🌊 Tides" / "🌊 Mareas" — el `header-title` del componente sería
   redundante.

3. Si mantengo ambos, ¿cómo hago que el `.header-title` del componente
   React NO se escale junto con `.tide-page` (sacarlo fuera del
   contenedor transformado)?

4. ¿Hay algún problema sutil con `position: absolute` + `transform:
   scale` que pueda hacer que un hijo (header) salga del viewport
   cuando se aplica el offset top=64px? (P.ej., el bounding box
   transformado deja el header arriba del top:64px y queda oculto bajo
   el header iOS de index.html.)

5. ¿Mi cálculo de offset `top = hdrH` es correcto cuando `transform-origin:
   top left` ya hace que el contenido se "ancle" en (left, top)? ¿O
   necesito sumar también algún padding de la `.tide-page`?

## Lo que NO quiero que me digas

- "Aumenta el font-size." — Ya está en 28px y sigue mal.
- "Pon z-index." — Ya está en 100.
- "Mira la consola." — No hay error.
- Cambios incrementales triviales.

Quiero saber **la causa estructural** y la solución correcta de una
vez.

## Información adicional

- El usuario prueba en **portátil** (Firefox/Chrome desktop) y en
  móvil. Reporta el problema en AMBOS contextos.
- "Ilegible" para él significa visualmente ~12-14px o menos.
- El header iOS de index.html y el `<header className="tide-header">`
  del componente coexisten — ambos visibles a la vez.
- Cuando dice "el título no se ve", puede referirse al
  `.header-title` del componente o al `#m-tv-title-txt` del header
  iOS; no me ha aclarado cuál.
