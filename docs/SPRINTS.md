# SPRINTS — plan de trabajo

Cada sprint = un dominio cerrado. Commits pequeños y testables individuales. **Ningún sprint termina sin que el usuario confirme el QA correspondiente en su iPad/iPhone/portátil/Pi**.

---

## SPRINT 1 — Backend Source of Truth + Multi-device Sync (CRÍTICO)

Bugs cubiertos: B-01 a B-13 (excepto los media-baja).

### Objetivo

Que **cualquier acción** (drop, lift, ACK, snooze, mute, drag bolita, slider) que ocurra en un device se refleje EN EL ACTO en todos los demás devices.

### Commits planificados

1. **`feat(backend): mute audio cross-device`**
   - Nuevo endpoint `POST /api/audio-enable {enabled}`
   - Persiste en `anchorWatch.audioEnabled` (nuevo campo)
   - Broadcast SSE `audio`
   - Visores escuchan SSE → actualizan `_audioEnabled` local
   - QA: tablet muta, otra ventana muta también, Pi audio se calla
   
2. **`fix(backend): snooze cross-device verificado`**
   - Confirmar `emitNotificationClear()` llega a visor B
   - Hacer que `_silenceGarreo()` y `_silenceAis()` emitan TAMBIÉN `notifications.signalk-mareas-ihm.snoozeStatus` con el `silencedUntil` para que visores sincronicen su `_snoozedUntilMs`
   - Pi audio: matar `paplay` y `espeak` PID en silencio inmediato, no esperar fin del burst actual
   - QA: snooze en tablet, otra ventana ve countdown, Pi callado

3. **`fix(backend): lift propaga limpiezas completas`**
   - En `/api/anchor-watch/lift`: además de clear notifications garreo+ais+grounding, emit explícito `notifications.signalk-mareas-ihm.aisAnchorAlarm` con state:normal
   - Visor on SSE 'lift': close popup AIS, clear `_aisAckedMMSIs` local mirror, remove ancla del mapa
   - QA: lift en device A → device B sin alarmas residuales

4. **`feat(backend): AIS schema viejo restaurado`**
   - Reusar el motor completo de `mapafondeo.html` para AIS:
     - Status bar superior con conteos cercanos/riesgo/ACK
     - Popup individual con ACK + datos completos
     - Anillos rojos persistentes alrededor de targets en zona
     - Botón "Quitar ACK" en targets ACKeados
   - Endpoints ya existentes `/anchor-watch/ais-ack` + `/ais-unack` con broadcast SSE
   - QA: ACK desde tablet, otra ventana lo refleja sin latencia >1s

5. **`fix(backend): anchor_down voice solo si /drop request fresco`**
   - `_piAnchorDropConfirm()` requiere `lastDropRequestId` que se setea en `/api/anchor-watch/drop`
   - Dedupe robusto por request-id, no por timestamp
   - SSE event 'drop' incluye el request-id
   - Visor solo dispara `_speakAlarm('anchor_down')` si recibió SSE 'drop' con request-id nuevo
   - QA: tablet 24h sin echar → no dice "Ancla fondeada"

6. **`fix(frontend): preview slider modal sin saltos (requestAnimationFrame)`**
   - Reescribir `m_modalChainSlider` con `requestAnimationFrame`
   - Fórmula directa: el slider va de 5 a 100, el `swingC` se setea con el valor del slider × constante simple, no dependiente de `chainDep` runtime
   - QA: arrastrar slider azul → círculo se mueve continuo sin saltos

7. **`fix(backend): swingRadiusOverride no se pisa en evaluate`**
   - Auditar TODAS las escrituras a `anchorWatch.swingRadiusOverride`
   - Solo se actualiza desde `/api/anchor-watch/swing-radius` o `/api/anchoring/calc` con autoPublish
   - `evaluateAnchorWatch()` debe READ-ONLY usar el override, no pisarlo
   - QA: drag bolita, esperar 5 min, el radio persiste

8. **`fix(frontend): meteo REVERTIR transpose Rev190`**
   - Borrar `m_transposeMeteoTable()` invocación
   - Layout final: rows = métricas, cols = horas, scroll-X horizontal
   - Es exactamente lo que estaba en Rev188 (cabecera = horas, una fila por métrica)
   - QA: en tablet portrait, scroll horizontal avanza horas, sin scroll vertical para avanzar tiempo

9. **`fix(frontend): Previsión Abrigo ventana 100vw`**
   - `body.mobile-ui #shelter-pop .popup-box`: width 100vw, max-width 100vw, padding 64px 8px 16px
   - Strip horas: `overflow-x:auto`, flex con `flex:0 0 auto` para cada `.shelter-hour`
   - Rosa + donut + infobox usan flex-wrap para respirar
   - QA: abrir Abrigo en tablet portrait, ventana llena ancho, strip scrollea horizontal

10. **`fix(frontend): TidesView embed fit pantalla + centrado`**
    - En `index.html` (TidesView root) cuando `?embed=1`: padding-top:64px ya está, pero también body height 100vh + flex layout para que el contenido use TODO el alto
    - Centrar contenido principal con max-width adecuado
    - QA: TidesView embebido llena pantalla, contenido centrado, sin scroll inesperado

11. **`fix(frontend): TidesView embed solo botón Curvas`**
    - En `?embed=1`: ocultar row2 (idiomas, VISOR DE FONDEO, INSTRUCCIONES, buscador estación)
    - Mover esos contenidos al hamburger del visor mobile
    - Botón Curvas SÍ visible (ya en header iOS Rev188v2)
    - Cross-link en Curvas popup → botón "🌊 Mareas" (ya hecho Rev188v2, verificar)
    - QA: TidesView embebido solo muestra Curvas + barra atrás

12. **`feat(backend): logging avisos fantasmas`**
    - Loggar cada emit de notification con timestamp + kind + razón
    - Endpoint debug `/api/events-log?last=50` para inspección
    - Visor logea cada audio play con timestamp en console
    - Pedir al usuario timestamps reales cuando ocurra y cazar repro

### Criterio de aceptación

- Usuario hace QA en 2 devices simultáneos (tablet + ventana navegador)
- Cada commit testable individualmente vía QA list
- ZERO `mensajes fantasma` en otros devices tras cancelar fondeo

---

## SPRINT 2 — Cálc Fondeo + Batimetría

Bugs: B-15a, B-15b, B-15c, B-22.

### Commits

1. **`fix(frontend): Cálc Fondeo horizonte arriba`**
   - Reordenar HTML del popup `fondeo-pop`
   - Días/Horas extra al inicio del formulario
   - QA: abrir Cálc Fondeo, horizonte visible arriba

2. **`fix(frontend): Cálc Fondeo inputs auto-calc`**
   - Verificar `m_wireFondeoAutoCalc()` se engancha
   - Asegurar `MutationObserver` detecta open
   - Debounce 250ms en `input` event dispara `calcFondeo()`
   - QA: cambiar cualquier input → resultado se recalcula sin pulsar botón

3. **`fix(css): Cálc Fondeo selector legible`**
   - Override CSS: selectors/inputs en mobile-ui con background:rgba(255,255,255,.08), color:#fff
   - QA: textos legibles en cualquier selector

4. **`chore(content): renombrar Sonarchart → Batimetría`**
   - `grep -rn "Sonarchart\|sonarchart\|SonarChart"`
   - Sustituir en strings, labels, comentarios, commits
   - QA: visual check de la UI

### Criterio de aceptación

Cálc Fondeo recalcula on input + visible + sin referencias comerciales.

---

## SPRINT 3 — i18n exhaustivo

Bugs: B-16, B-17.

### Commits

1. **`feat(i18n): inventario completo de strings hardcodeados`**
   - Script `node scripts/find-hardcoded-strings.mjs` que escanea `public/mobile.html` y lista strings ES sin `data-i18n`
   - Añadir traducción EN en `_i18n{}` y `data-i18n="..."` en HTML
   
2. **`fix(i18n): popups dinámicos renderizados por JS`**
   - `m_renderMeteoWindy`: títulos columnas, label "Hora"
   - `m_renderShelterStrip`: leyendas
   - `m_renderInfoModal`: títulos secciones
   - Cálc Fondeo: labels generadas
   - AIS popup: ya usa `T()`, verificar coverage
   - Reemplazar literales por `T('key', 'Fallback ES')`
   
3. **`fix(i18n): reemplazar alert()/confirm() por modal i18n-aware`**
   - Crear helper `m_alert(messageKey, fallback)` y `m_confirm(messageKey, fallback, callback)`
   - Sustituir todos los `alert(...)` y `confirm(...)` en mobile.html
   
4. **`fix(i18n): bottom-bar + wx-bar labels`**
   - Añadir `data-i18n` a tooltips (`title="..."` en .it y .wx-cell)
   - applyLang también actualiza `title` cuando data-i18n
   
5. **`feat(backend): Pi voces cambio inmediato con lang`**
   - Listener en `app.streambundle.getSelfBus("environment.anchor.mareasIhm.lang")` o suscripción a settings
   - Si lang cambia: matar paplay/espeak en curso (`_piAlarmStop(kind)` for all kinds), re-emit en siguiente ciclo con nuevo lang
   
6. **`fix(audio): visor local usa _lang sin esperar backend`**
   - `_speakAlarm(kind)` ya usa `_lang` — verificar OGG paths existen para EN
   - Si OGG EN no existe, fallback TTS en EN

### Criterio de aceptación

Pulsar 🇬🇧 → CADA texto visible cambia + voz Pi en EN en próxima alarma.

---

## SPRINT 4 — UI lite

Bugs: B-20, B-21, Centrar zoom-fit, Q-AA.

### Commits

1. **`feat(css): clase única .m-back-btn-unified`**
   - Definir clase con padding, font-size, color, posición (top-left), backdrop-filter
   - Aplicar a TODOS los m-back / botones Atrás
   - Title centrado en header con esta clase para padding-right balanceado
   - QA: navegar todos los modales, Atrás idéntico
   
2. **`feat(css): subir font-size +2-4px en mobile-ui`**
   - Auditar `body.mobile-ui` font-size base
   - Subir a 18px base (de 16px), h1/h2/h3 proporcional
   - Botones a 18px+
   - Modal headers 24px+
   - QA: visualizar en tablet, todo más legible
   
3. **`fix(frontend): Centrar zoom-fit fiable`**
   - Investigar por qué a veces no aplica zoom
   - Forzar `map.invalidateSize()` antes de `flyToBounds`
   - QA: centrar 10 veces seguidas en condiciones distintas

4. **`fix(css): modales full screen, textos solo izquierda`**
   - `body.mobile-ui .popup-box`: text-align:left
   - Quitar `text-align:justify` o `text-align:center` en bloques de texto
   - Mantener centrado SOLO en botones y elementos icono
   - QA: visual

### Criterio de aceptación

Textos legibles en móvil + Atrás idéntico en todos modales + centrar siempre fit.

---

## SPRINT 5 — Push y background (Service Worker)

Bugs: B-18, Wake lock móvil (Q-Z).

### Commits

1. **`feat(sw): registrar Service Worker en mobile.html`**
   - Crear `public/sw.js` con lifecycle install/activate/fetch
   - Cache estático del visor para offline
   - Registro en mobile.html: `navigator.serviceWorker.register('/signalk-mareas-ihm/sw.js')`
   
2. **`feat(push): Web Push API suscripción`**
   - Helper `m_subscribePush()` que pide permiso (NOTIFICATIONS) primer click usuario
   - Generar VAPID keys backend (`web-push` package)
   - Endpoint `POST /api/push/subscribe {subscription}` persiste suscripciones
   - Endpoint `POST /api/push/unsubscribe {endpoint}`
   
3. **`feat(backend): push trigger en alarmas`**
   - En `evaluateAnchorWatch` cuando dispara garreo o ais alarm: `webpush.sendNotification(sub, payload)` a todos los suscriptores
   - Payload garreo: `{title:"ALARMA ANCLA", body:..., requireInteraction:true, vibrate:[300,100,300], silent:false}`
   - Payload ais: `{title:"Posible colisión", body:..., requireInteraction:false, vibrate:[200,100,200,100,200], silent:false}`
   
4. **`feat(sw): handler push event con audio + vibración`**
   - SW handler `self.addEventListener('push', event => ...)`
   - Show notification con icon, badge, sound, vibrate según payload
   - Click en notification → focus tab del visor
   
5. **`feat(frontend): Wake Lock con alarma activa`**
   - En `_startAlarmLoop`: pedir `navigator.wakeLock.request('screen')`
   - En `_stopAllAlarmLoops`: release wake lock
   - Verificar en tablet/móvil (Pi ya OK)

### Criterio de aceptación

Cerrar pestaña del navegador en móvil → llega alarma como push con sonido + vibración.

---

## SPRINT 6 — Instrucciones + Histórico debug

Bugs: B-19, Q-AS.

### Commits

1. **`feat(content): copiar instrucciones de TidesView a mobile`**
   - Identificar el componente de instrucciones en `app/views/TidesView.tsx`
   - Copy-paste estructura completa (buscador, aviso legal, créditos) a un nuevo componente reutilizable o portarlo a `m_openInstructions()` en mobile.html
   - Estructura HTML + CSS + buscador funcional
   - Actualizar contenido de la info (correcciones que diga el usuario)
   
2. **`feat(backend): eventos persistentes en sqlite`**
   - Tabla `events_log` en ihmCache: `id, ts, kind, device_id, payload`
   - Loggear: drop, lift, ACK, snooze, mute, AIS target aparece, AIS target desaparece, garreo activo/inactivo, etc.
   - TTL 30 días (rotación)
   
3. **`feat(frontend): vista debug interna`**
   - Nuevo modal `m-debug-overlay` accesible vía hamburger (al final, "🔧 Debug")
   - Tabs: Eventos / Estado actual / Logs SSE / Network
   - Tab Eventos: tabla con timestamp + kind + device + payload, filtrable
   - Tab Estado actual: dump JSON del state
   - Tab Logs SSE: últimos 100 SSE events recibidos
   - Tab Network: últimas 50 requests al backend
   
4. **`feat(frontend): AIS targets aparecen/desaparecen logged`**
   - Diff entre snapshots de `aisTargets` → event "ais.appear" / "ais.disappear"

### Criterio de aceptación

Usuario puede ver TODO lo que el programa hace en una pantalla, y abrir las instrucciones se ve igual de bien que las de TidesView.

---

## Reglas de ejecución de sprints

1. **Una cosa por commit**. Si un commit toca dos features, partirlo.
2. **QA verifiable** por cada commit. Ningún commit cierra sin que el usuario diga "OK" en el dispositivo específico.
3. **No saltar entre sprints**. Sprint 1 cerrado al 100% antes de empezar Sprint 2.
4. **`.\deploy.ps1 -Restart`** al final de cada commit que toque `src/`. Para `public/*` puede ser `-SkipBuild`.
5. Para cada feature: **abrir el navegador y probar antes de marcar ✓**.
6. Estado: dejar commits en `main` directamente (no hay develop).
7. NPM publish: SOLO cuando el usuario lo pida explícitamente, después de un sprint completo.

## Estimación grosera

| Sprint | Esfuerzo | Días iter laptop |
|---|---|---|
| Sprint 1 | Alto | 3-5 |
| Sprint 2 | Bajo-medio | 1-2 |
| Sprint 3 | Medio | 2-3 |
| Sprint 4 | Bajo | 1 |
| Sprint 5 | Alto | 3-4 |
| Sprint 6 | Medio | 2 |

Total grosero: 12-17 días de iter activa con QA del usuario entre commits.
