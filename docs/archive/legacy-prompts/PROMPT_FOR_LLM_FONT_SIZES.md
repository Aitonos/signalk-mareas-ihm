# Prompt para Gemini — Tamaños de letra ilegibles en mobile.html y app/

## Contexto

Plugin SignalK `signalk-mareas-ihm` (Rev323, v2.1.5). UI repartida
entre dos archivos enormes:

- **public/mobile.html** (~9500 líneas) — visor de fondeo + popups +
  modales. Estilo "vanilla" con CSS en `<style>` global + estilos
  inline.
- **app/views/TidesView.tsx** + `app/App.css` — vista de mareas
  React, embebida como iframe.

## El bug repetido

El usuario reporta que **sigo usando tamaños de letra ILEGIBLES
incluso en un portátil** en varios sitios. Cita literal:

> "y otro [prompt para Gemini] para revisar porque sigues sin darte
> cuenta que a veces usas tamaños de letra ilegibles incluso en un
> portátil."

Casos donde se ha quejado explícitamente en las últimas iteraciones:

- **Modal "Posiciones del ancla" (`#hist-pop`)** — fuentes pequeñas
  hasta Rev323 (que las puso a 20px y añadió back button).
- **Modal "Wave history info" (`#wave-hist-info-pop`)** — tabla a
  17px, el usuario la veía como "no se lee".
- **Modal Info** — `pv` (valores) a 22-28px, labels a 22px en Rev293.
- **TidesView**: `.header-title` a 28px… pero escalado por
  `transform:scale(0.5)` queda visualmente a 14px.
- **Botones del bottom bar** mobile.html — texto descriptivo añadido en
  Rev292 pequeño.

## Variables que complican el tamaño REAL

1. **`zoom: var(--ui-scale)`** en `.popup-overlay`, `.btn-float`,
   `#panel`, `#bottom-info`, etc. de mobile.html. `--ui-scale` se
   ajusta por JS según el ancho de pantalla:
   - Pi 7" (1024×600): `--ui-scale: 0.55`
   - Portátil (1920×1080): `--ui-scale: 0.6`
   - Móvil pequeño: hasta 0.5

   Resultado: una fuente declarada como 20px se ve a 11-12px reales.

2. **`transform: scale(var(--viewport-scale))`** en `.tide-page` del
   TidesView. En portrait `s = vw/baseW = 412/825 ≈ 0.5`. Texto de
   28px → 14px real.

3. **`--zoom-fix`** otra variable que también compensa por
   `devicePixelRatio / browser zoom`:
   ```js
   var d = window.devicePixelRatio || 1;
   var bz = d / bd;
   var c = (Math.abs(bz-1)>0.05) ? 1/bz : 1;
   document.documentElement.style.setProperty('--zoom-fix', c);
   ```
   Se aplica vía `zoom: var(--zoom-fix, 1)` a `.modal-overlay`.

4. **Cascada de `!important`** y declaraciones inline. Muchas reglas
   se sobrescriben entre sí, perdiendo control del tamaño final.

5. **Convención dispar**: no hay un "design system" — cada autor
   eligió a ojo el font-size. Hay desde 12px (rara vez) hasta 36px
   (`.tide-station`).

## Lo que necesito de Gemini

**No me digas "pon todo a 16px".** Necesito una ESTRATEGIA
sistemática:

### Pregunta 1: cuál es el mínimo aceptable

¿Cuál es el tamaño mínimo razonable para texto técnico en:

- a) Modal informativo (texto secundario, etiquetas)?
- b) Modal informativo (valor numérico, dato principal)?
- c) Botón de acción (texto del CTA)?
- d) Header / título de modal?
- e) Texto inline del bottom bar (etiquetas debajo de números)?

Considerando que TODO el contenido va a ser visto en:
- Portátil 1080p a 50-80cm de distancia.
- Móvil 6" a 30cm.
- Pi 7" a 50cm-2m (montado en cuadro del barco).

Y considerando que el `zoom: 0.6` y `transform: scale(0.5)` aplican
internamente, **¿qué font-size SOURCE necesito** para que el
resultado visual cumpla mínimo aceptable?

### Pregunta 2: cómo neutralizar el zoom

¿Cuál es la mejor forma de evitar que el sistema de `zoom` y
`transform` esconda problemas de tamaño?

- a) ¿Definir un **token CSS** `--font-base: 20px` y derivar todos
  los demás con `calc(...)`?
- b) ¿Usar `vmin` o `clamp(16px, 2.2vmin, 28px)` para que la fuente
  escale con el viewport y no necesite zoom?
- c) ¿Aplicar `font-size-adjust` para compensar?
- d) ¿Sacar los elementos críticos (títulos, valores) FUERA del
  contenedor con zoom?

### Pregunta 3: auditoría sistemática

¿Cómo puedo hacer una **auditoría automatizada** de tamaños
"resultantes" en una página? Necesito un script o herramienta que:

1. Recorra el DOM cargado.
2. Calcule el **font-size resultante en pixels reales** de cada
   nodo de texto, teniendo en cuenta:
   - `getComputedStyle(el).fontSize`.
   - Todos los `zoom` ancestros (CSS zoom no aparece en
     getComputedStyle, hay que recorrerlos manualmente y
     multiplicar).
   - Todos los `transform: scale(...)` ancestros.
   - `--zoom-fix` aplicado.
3. Liste los que queden < N px reales para revisarlos.

### Pregunta 4: estructura para no volver a romper

Una vez auditado, ¿qué patrón aplico para que **futuras ediciones
no rompan** la legibilidad?

- a) Variables CSS `--font-xs/sm/md/lg/xl` y prohibido inline px.
- b) ESLint custom rule que bloquee `font-size: 12px` o menor en
  hex literal.
- c) Test de regresión visual.
- d) Ninguno de los anteriores — otro patrón mejor.

## Ejemplos concretos del proyecto

### mobile.html — popup info

```css
body.mobile-ui .popup-overlay {
  zoom: var(--ui-scale);  /* 0.55-0.6 */
}
.popup-box {
  background: rgba(10,30,50,.95);
  border-radius: 14px;
  padding: 18px;
}
.popup-box h4 {
  font-size: 22px;
  font-weight: 900;
  color: #fff;
}
.pr {
  display: flex;
  justify-content: space-between;
  font-size: 20px;
  padding: 8px 4px;
}
.pv {
  font-size: 28px;
  font-weight: 900;
}
```

Resultado real con `--ui-scale: 0.6`:
- h4: 22 × 0.6 = **13.2px** real.
- pr label: 20 × 0.6 = **12px** real.
- pv value: 28 × 0.6 = **16.8px** real.

El usuario percibe **todo ilegible** salvo el pv.

### app/App.css — TidesView title

```css
.tide-page {
  transform: scale(var(--viewport-scale));  /* 0.5 portrait */
}
.header-title {
  font-size: 28px;  /* → 14px real */
}
.tide-station {
  font-size: 36px;  /* → 18px real */
}
```

### Bottom bar de mobile.html

```html
<div class="m-bb-it">
  <div class="vl" style="font-size:20px">12.5 kts</div>  <!-- 12px real -->
  <div class="vd" style="font-size:13px">VIENTO</div>     <!-- 7.8px real -->
</div>
```

`m-bb-it` es hijo de `#bottom-info` que tiene `zoom: var(--ui-scale)`.

## Restricciones del proyecto

- **No cambiar el layout** — el zoom permite que TODO encaje en
  pantallas pequeñas (Pi 7"). Subir font-size sin más rompe el
  layout.
- El usuario ya rechazó `zoom: 1` global (rompe el cuadro).
- Hay que mantener el sistema bilingüe (ES/EN) — textos en español
  son ~30% más largos.
- Build es Vite + TypeScript. CSS sin preprocesador.

## Resultado esperado

Una **respuesta estructurada** con:

1. Tabla de "tamaño mínimo SOURCE → resultado real" para los
   contextos a-e de la pregunta 1.
2. Decisión sobre la mejor estrategia (variables, clamp, vmin…)
   con justificación.
3. Script de auditoría DOM concreto que pueda pegar en la
   consola del browser.
4. Plan de migración por fases (qué tocar primero para máximo
   impacto sin romper).

## Lo que NO quiero

- "Pon font-size 20px en todo." — Demasiado simplista.
- "Usa rem." — Ya entiendo qué es rem, dime qué patrón usar EN
  ESTE proyecto con su zoom existente.
- Cambios cosméticos sin pensar en el zoom.
