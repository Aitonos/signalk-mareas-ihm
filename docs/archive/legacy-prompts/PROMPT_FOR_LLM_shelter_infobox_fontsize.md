# Prompt para LLM — Shelter infobox: subo font-size en CSS y NO se ve mayor

## Contexto del proyecto

- Plugin SignalK `signalk-mareas-ihm` (mobile-only UI, monolito `public/mobile.html` ~15k líneas).
- Rev actual: Rev549 (en `src/index.ts` const `PLUGIN_REVISION`).
- Mobile-only: `<body class="mobile-ui">` desde el primer parse. La UI desktop legacy NO se usa.
- Hay zoom anidado: TODOS los `.popup-overlay` heredan `zoom: var(--ui-scale)` (típicamente 0.6 en portrait).
- Ya tenemos memoria pasada de que **el zoom escala VISUALMENTE aunque `getComputedStyle().fontSize` siga siendo el valor original** (paintedHeight/offsetHeight ≠ 1 ⇒ hay zoom/transform en ancestro).

## Síntoma

Carlos pide subir +2px el "infobox" del shelter (modal de previsión de abrigo). He bumpeado los font-size en la cascada CSS:

```css
/* Rev547 (feedback Carlos): infobox shelter +2px en datos. */
body.mobile-ui #shelter-status-label{font-size:26px!important;padding:18px 20px!important}   /* antes 24 */
body.mobile-ui #shelter-status-body{font-size:24px!important;padding:18px 20px 14px!important;line-height:1.4!important}  /* antes 22 */
body.mobile-ui #shelter-summary-text{font-size:28px!important;font-weight:800;padding:16px;border-radius:12px;background:rgba(255,255,255,.06);margin:14px auto!important;max-width:760px;align-self:center!important;text-align:center!important}  /* antes 26 */
body.mobile-ui #shelter-auto-prompt{font-size:22px!important;text-align:center!important;display:block!important;width:100%!important}  /* antes 20 */
body.mobile-ui #shelter-auto-status{font-size:24px!important;font-weight:800}                  /* antes 22 */
```

**Carlos dice que NO sube visualmente.** Sospecha que hay una regla que pisa.

## HTML del infobox (líneas 2331-2398 de `public/mobile.html`)

```html
<div class="popup-overlay" id="shelter-pop" onclick="closePopup('shelter-pop')">
  <div class="popup-box shelter-popup-box" onclick="event.stopPropagation()" style="background:#0a1e32;backdrop-filter:none;-webkit-backdrop-filter:none">
    <button onclick="closePopup('shelter-pop')" style="position:absolute;top:8px;right:12px;background:none;border:none;color:#aaa;font-size:24px;cursor:pointer;line-height:1">✕</button>
    <div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:12px;flex:0 0 auto;line-height:1.2;margin:0;position:relative;z-index:1">
      <h4 style="margin:0;font-size:26px;line-height:1.2"><span data-i18n="shelter_title">⚓ Previsión de Abrigo</span></h4>
      <div style="font-size:18px;color:#cfd8dc;line-height:1.2" id="shelter-auto-prompt">
        <span style="color:#666;margin-right:8px">·</span>
        <a href="#" id="shelter-auto-status" style="color:#3aa856;font-weight:800;cursor:pointer;text-decoration:underline" data-i18n="sh_auto_detect">Detección automática</a>
        <span>:&nbsp;</span>
        <span data-i18n="sh_franja_hint">pulsa una franja horaria para ver su previsión.</span>
        <span id="shelter-auto-meta" style="color:#888;font-size:14px;margin-left:6px"></span>
      </div>
    </div>
    <div id="shelter-rose-wrap" class="shelter-rose-wrap" style="display:flex;justify-content:space-between;align-items:center;gap:0;margin:0;padding:0;flex:0 0 auto;position:relative;top:-20px">
      <svg id="shelter-rose" .../>
      <div class="shelter-grade-col" ...>...</div>
      <div id="shelter-status" class="shelter-status-box" style="flex:0 0 467px;width:467px;height:395px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:0;display:flex;flex-direction:column;overflow:hidden">
        <div id="shelter-status-label" style="font-size:21px;color:#fff;font-weight:900;letter-spacing:.5px;padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);text-transform:uppercase" data-i18n="sh_prediccion_ahora">PREDICCIÓN · AHORA</div>
        <div id="shelter-status-body" style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:14px 20px 12px;color:#fff;font-size:19px;line-height:1.25">—</div>
      </div>
    </div>
    <!-- shelter-summary-text vive aquí abajo -->
    <div id="shelter-summary-text" style="font-size:19px;color:#fff;font-weight:700;text-align:center;margin:2px 0 2px;line-height:1.2;flex:0 0 auto;text-shadow:0 1px 2px rgba(0,0,0,.4);position:relative;top:-44px"></div>
  </div>
</div>
```

Atención: cada elemento del infobox tiene **inline style con font-size** (`style="font-size:21px"` para label, `style="font-size:19px"` para body, `style="font-size:19px"` para summary, `style="font-size:18px"` para auto-prompt). El inline gana al CSS NO !important pero pierde al `!important` (CSS-spec normal).

## TODAS las reglas CSS que tocan los 5 selectores

```css
/* Línea ~57 — zoom heredado en todo .popup-overlay */
.popup-overlay{display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.5);align-items:center;justify-content:center}
/* Línea ~649 (Rev514): zoom var(--ui-scale) — escala visualmente todo el overlay */
.popup-overlay{zoom:var(--ui-scale)}
/* Línea 64: el modal Instrucciones EXCLUYE zoom; los demás overlays NO */

/* Línea 551-560 — Pi browser específico (clase body.m-pi-browser) */
body.m-pi-browser .popup-overlay .popup-box{font-size:24px!important}     /* aplica a la BOX padre */
body.m-pi-browser .popup-overlay .popup-box h4{font-size:28px!important}
body.m-pi-browser .popup-overlay .popup-box p,
body.m-pi-browser .popup-overlay .popup-box label,
body.m-pi-browser .popup-overlay .popup-box li,
body.m-pi-browser .popup-overlay .popup-box td,
body.m-pi-browser .popup-overlay .popup-box th{font-size:24px!important}

/* Línea 1754-1755 — texto genérico dentro del shelter-pop (sin !important) */
body.mobile-ui #shelter-pop .popup-box span,
body.mobile-ui #shelter-pop .popup-box div{font-size:22px}

/* Líneas 1757-1761 — mis subidas Rev547 (las que Carlos dice que no surten efecto) */
body.mobile-ui #shelter-status-label{font-size:26px!important;padding:18px 20px!important}
body.mobile-ui #shelter-status-body{font-size:24px!important;padding:18px 20px 14px!important;line-height:1.4!important}
body.mobile-ui #shelter-summary-text{font-size:28px!important;font-weight:800;padding:16px;border-radius:12px;background:rgba(255,255,255,.06);margin:14px auto!important;max-width:760px;align-self:center!important;text-align:center!important}
body.mobile-ui #shelter-auto-prompt{font-size:22px!important;text-align:center!important;display:block!important;width:100%!important}
body.mobile-ui #shelter-auto-status{font-size:24px!important;font-weight:800}

/* Línea 1799 — segunda regla para shelter-summary-text (potencial duplicado) */
body.mobile-ui #shelter-summary-text{
  position:static!important;top:0!important;
  font-size:22px!important;line-height:1.35;padding:14px 0;
  background:rgba(255,255,255,.05);border-radius:10px;margin:14px 0!important;
}

/* Línea 1850 — fullscreen del shelter-pop */
body.mobile-ui #shelter-pop .popup-box.shelter-popup-box{
  position:fixed!important;
  top:0!important;left:0!important;right:0!important;bottom:0!important;
  /* ... no font-size ... */
}

/* Línea 1883 — z-index del shelter-summary-text */
body.mobile-ui #shelter-pop #shelter-summary-text{z-index:1!important;position:relative!important}
```

## Específico — `#shelter-summary-text`

Hay **DOS reglas** con `!important` en `body.mobile-ui #shelter-summary-text`:

1. Línea 1759 (Rev547): `font-size:28px!important` (mi subida).
2. Línea 1799 (más antigua): `font-size:22px!important`.

Misma specificity (`body.mobile-ui` + 1 id = 0,2,1). En cascada, **gana la ÚLTIMA declarada** → línea 1799 con 22px gana sobre línea 1759 con 28px. **Esto explicaría perfectamente que Rev547 no haga nada en `#shelter-summary-text`.**

## Preguntas concretas

1. **¿Es correcta mi sospecha de que el duplicado en línea 1799 está pisando línea 1759 en `#shelter-summary-text` por orden de cascada?** Si sí, ¿la solución es eliminar la regla vieja de línea 1799 y consolidar todo el `#shelter-summary-text` en una sola declaración?
2. Para los otros 4 selectores (`#shelter-status-label`, `#shelter-status-body`, `#shelter-auto-prompt`, `#shelter-auto-status`):
   - ¿Hay alguna regla que esté pisándolos que no estoy viendo? (no encuentro duplicado para estos en mi grep — pero he tenido falsos negativos antes con selectores multi-línea separados por comas).
   - ¿El `zoom: var(--ui-scale)` en `.popup-overlay` puede estar haciendo que la subida de +2px nominal se vea sólo como +1.2px visual (zoom 0.6) y por eso Carlos lo percibe como "no sube"?
3. ¿Hay otra regla en `body.m-pi-browser ...` u otro contexto que aplique `font-size: …!important` en descendientes y herede a estos elementos, ganándole al mío por specificity (3 clases > 1 class + 1 id)?
4. **¿Cuál es la solución más limpia?**
   - (a) eliminar el duplicado y consolidar.
   - (b) subir el font-size MUCHO MÁS (e.g. de 24px → 40px) para compensar zoom 0.6.
   - (c) excluir `#shelter-pop` del zoom heredado (`#shelter-pop{zoom:1}` o similar) y rebajar los font-size al tamaño "real" deseado.
   - (d) usar `clamp(...)` o `vw/dvh` para que el tamaño escale con viewport en lugar de depender de zoom.

## Restricciones / Reglas duras del proyecto

- Backend = single source of truth (R6/Q-N).
- NO romper lo que funciona "por limpiar" (R6).
- Consolidar reglas CSS duplicadas en vez de añadir nuevas con más `!important` (memoria `feedback_consolidate_dont_duplicate.md`).
- Tema dark only.
- Sin emojis en chat con dev (sí en UI del producto).

Espero diagnóstico forense + solución única recomendada (no menú de opciones).
