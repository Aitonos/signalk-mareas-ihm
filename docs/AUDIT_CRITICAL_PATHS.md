# AUDITORÍA DE PATHS CRÍTICOS — signalk-mareas-ihm Rev474

**Fecha**: 2026-06-21
**Motivo**: Tras encontrar bugs graves (bottom-bar SONDA jamás disparaba alerta visual; modal Cálculo Sonda decía SIN RIESGO con alarma activa), pasada completa para identificar todos los puntos donde la fiabilidad del plugin podría comprometer la seguridad del barco.

**Filosofía**: Failure modes que pueden costar el barco al usuario.

## Leyenda

- 🔴 **CRT** Crítico: silenciar/falsear un riesgo de seguridad real. Puede causar varada, garreo no detectado o colisión.
- 🟠 **GRV** Grave: dato erróneo en pantalla, inconsistencia entre paneles, alarma que no llega a un device.
- 🟡 **MNR** Menor: estético, UX confuso, edge case raro.

---

## A. ALARMAS

### A1 · Garreo (anchor drag)

#### A1.1 🟠 Drag check usa `s.groundingAlarm.risk` en otros sitios?
**Estado**: Verificado. El frontend hace `s.groundingAlarm` como string en bottom-bar (fixed Rev469), pero hay otra ocurrencia en [public/mobile.html:9417](public/mobile.html#L9417):
```js
if(d.groundingRisk&&d.groundingRisk.risk){sSt.textContent=T('riesgo_varada');...}
```
Este `d` es la respuesta de `/api/anchor-watch/state` cuando se llama desde `setRing()`. Comprobar si `d.groundingRisk` existe en el state (¿lo expone?). Si no existe → el chequeo siempre da falso → otro falso negativo.
**Impacto**: posible alarma silenciada en otro panel.
**Fix sugerido**: replicar el patrón `_isRisk` que se usa en bottom-bar (string contains "RIESGO").

#### A1.2 🟠 `_dragCandidateTicks` solo se incrementa por SUBIR el threshold
[src/index.ts:3308](src/index.ts#L3308): debouncing exige 2 ticks consecutivos por encima. Si los ticks llegan irregulares (ej. SK lag), podría perderse el segundo tick consecutivo y no disparar.
**Impacto**: bajo (con tick 5s, lag tiene que ser >5s para fallar).
**Fix**: aceptable como está, pero documentar.

#### A1.3 🔴 Hysteresis `DRAG_HYSTERESIS_M` mezclado con debouncing
[src/index.ts:3265](src/index.ts#L3265):
```ts
if (anchorDragAlarmActive) {
  dragging = dist > alarmRadius - DRAG_HYSTERESIS_M;
} else {
  dragging = dist > alarmRadius + DRAG_HYSTERESIS_M;
}
```
El hysteresis funciona, pero **NO entra al debouncing 2-ticks si ya está activa** (solo el primer tick aplica debouncing). Si la alarma fue cancelada por GPS blip Y debounce no respeta, podría reaparecer en un solo tick fuera.
**Fix**: revisar interacción debounce ↔ hysteresis.

#### A1.4 🟡 Re-emit cadence 60s ignora que el visor cierra modal
Si usuario silencia desde otro device y vuelve a abrir el visor en este, el "RE-EMIT" cada 60s vuelve a publicarse aunque el usuario ya hizo ACK. Verificar que `_isGarreoSilenced()` se respete.
**Estado**: línea 3299 sí lo respeta. OK.

---

### A2 · Varada (grounding)

#### A2.1 🔴 BUG GRAVE FIXED Rev469-474: bottom-bar comparaba `s.groundingAlarm.risk` (string sin .risk → siempre false)
**Documentado**. Causa de la auditoría. Fix en Rev469-470.

#### A2.2 🔴 BUG GRAVE FIXED Rev473: `readDepthBelowTransducer` no convertía belowKeel→belowSurface
**Documentado**. Sonda en belowKeel comparada con effectiveDraft en belowSurface → false positive cuando draft alto, false negative cuando draft bajo.

#### A2.3 🔴 BUG GRAVE FIXED Rev474: modal Cálculo Sonda usaba `risk` (alarma config) vs el resto del UI usa `physicalRisk` (realidad)
**Documentado**. Si la alarma está OFF → el modal decía SIN RIESGO aunque físicamente hubiera riesgo.

#### A2.4 🟠 `_currentGroundingRisk` se setea desde 4 sitios distintos
- [src/index.ts:1340](src/index.ts#L1340) (init from cache)
- [src/index.ts:1924](src/index.ts#L1924) (lift)
- [src/index.ts:1985](src/index.ts#L1985) (otro lift)
- [src/index.ts:9409](src/index.ts#L9409) (sonda no fiable)
- [src/index.ts:9514](src/index.ts#L9514) (evaluación normal)

Cada uno setea un objeto con campos potencialmente distintos. Si una iteración setea `{risk:false}` solo (sin `physicalRisk`), el modal podría leer `undefined` y mostrar gris.
**Fix**: centralizar en `_setGroundingRisk(obj)` que valide siempre todos los campos.

#### A2.5 🟠 `effectiveDraft = (draft + margin) × 1.15` opacidad del 15%
El factor 15% sumado sobre (draft+margin) **infla el threshold de alarma significativamente** y el usuario no lo sabe (no aparece en UI). Con margin=2m y draft=1.35m: threshold real = 3.85m (cuando el usuario cree 3.35m).
**Impacto**: alarmas conservadoras "porque sí" + cm inflados en widget.
**Fix sugerido**: hacer el 15% configurable o desactivable; mostrarlo explícito en modal Cálculo Sonda.

#### A2.6 🔴 `_readDepthValidated` y `readDepthBelowTransducer` son funciones distintas con conversiones diferentes
[src/index.ts:4675](src/index.ts#L4675) `_readDepthValidated` aplica `addDraft:true` para belowKeel y belowTransducer (correcto).
[src/index.ts:9315](src/index.ts#L9315) `readDepthBelowTransducer` antes NO lo hacía (causa del A2.2). Tras Rev473 sí. Pero **hay otros call sites** que pueden usar `app.getSelfPath("environment.depth.belowKeel")` directamente.
**Fix**: grep exhaustivo de `environment.depth.below*` directos y centralizar en una función única `readDepthBelowSurface(draft)`.

#### A2.7 🟠 `expectedMinDepth = depthNow − remainingDrop` asume marea baja linealmente
[src/index.ts:9444](src/index.ts#L9444). La marea no baja lineal — es sinusoidal. La bajada total puede ocurrir a un ritmo distinto en cada momento. Para "expected min" da igual (al final del periodo la cantidad es la misma), pero para `minutesToRisk` interpolar lineal es impreciso.
**Impacto**: tu screenshot mostraba `timeUntilMin: 0` cuando faltaban horas → mala estimación.
**Fix**: usar curva sinusoidal o iteración tabular sobre `extremes`.

---

### A3 · AIS colisión

#### A3.1 🟠 ACKs en localStorage + backend, posible desync
ACK list se mantiene en `anchorWatch.aisAckedMMSIs` (backend) y se cachea en localStorage de cada visor. Si el backend cambia mientras el visor está offline, al volver el visor manda su lista localStorage (vieja).
**Verificar**: que el visor siempre lea backend como SoT en cada poll, no use localStorage para sobrescribir.

#### A3.2 🟡 `_lastAisNotifSig` evita re-emit duplicado
[src/index.ts:7919](src/index.ts#L7919): se resetea en lift. Bien. Pero si SK reinicia, el flag se pierde — primera evaluación post-restart re-emite siempre. Aceptable.

#### A3.3 🔴 `cleanMmsi` normalización inconsistente
`mmsi.replace(/^urn:mrn:imo:mmsi:/, "")` aparece en muchos sitios. Si en algún sitio se compara con el formato urn: → desigualdad → ACK no aplica.
**Fix**: helper `_cleanMmsi(raw)` único.

---

### A4 · Meteo (viento/oleaje extremo)

#### A4.1 🟡 `_checkWeatherAlarm` solo dispara si anchored
[src/index.ts:9330](src/index.ts#L9330) `if (typeof anch === 'undefined' || !anch) return`. Eso es correcto (en navegación no es alarma), pero puede sorprender al usuario que abre Meteo en puerto sin estar anclado.

#### A4.2 🟠 Umbrales hardcoded 25 kt / 1.5 m
[src/index.ts:9342](src/index.ts#L9342) `if (w > 25 || wave > 1.5)`. No configurables. Un barco grande tolera más, uno pequeño menos.
**Fix**: exponer en Configuración.

---

### A5 · GPS perdido

#### A5.1 ✅ TTL implementado correctamente
[src/index.ts:3076-3082](src/index.ts#L3076-L3082): `GPS_STALE_MS = 30_000`. Si `posTimestamp` > 30s viejo → considera GPS perdido. Correcto.

#### A5.2 🟠 Notif "gpsLost" no se limpia siempre
Verificar que cuando GPS vuelve, se publique `state: "normal"` para borrar la notif.

---

## B. LECTURA DE DATOS MULTI-SOURCE

### B1 🔴 Sonda — 3 paths SK distintos, frames diferentes
Ya documentado A2.2 + A2.6. Hay TRES funciones que leen sonda:
- `_skVal("environment.depth.belowKeel")` → raw, sin conversión.
- `_readDepthValidated(draft).vBS` → convertido a belowSurface.
- `readDepthBelowTransducer()` → tras Rev473 también convertido.

**Riesgo**: cualquier nuevo código que use `_skVal` directo y compare con effectiveDraft, repetirá el bug.
**Fix**: deprecar `_skVal` para depth*, forzar uso de un único helper.

### B2 🟡 Calado SK vs manual
[src/index.ts:9352-9357](src/index.ts#L9352-L9357): SK draft prioritario, manual fallback. Auto-repair de legacy inflated (+15% cached). Correcto pero complejo — frágil ante cambios.

### B3 🟡 Heading true vs magnetic
Múltiples call sites con fallback magnetic. Bien, pero **NO se aplica variación**. Si el usuario tiene solo magnetic y el barco navega en zonas con variación grande (>5°), el COG vs heading puede dar gates falsos.
**Fix futuro**: leer `environment.magneticVariation` y aplicar.

### B4 🟡 Wind apparent vs true
Backend usa TWD para desambiguar dirección de ola. Si el usuario solo tiene apparent wind (sin TWD computado por SK), `environment.wind.directionTrue.value` es null → `twdStable: false`. Documentar.

---

## C. CÁLCULOS DERIVADOS

### C1 🟠 `effectiveDraft` opaco al usuario
[src/index.ts:9218-9221](src/index.ts#L9218-L9221):
```ts
function effectiveDraft(draft, margin) {
  const base = draft + margin;
  return base + base * 0.15;
}
```
El 15% es invisible. UI muestra "Calado efectivo (+15%): 3.85 m" pero no explica que de ahí sale el threshold de alarma.
**Fix**: añadir tooltip explicativo o desglose en modal Cálculo Sonda.

### C2 🔴 `expectedMinDepth` se calcula con `depthNow` que ahora es belowSurface (post-Rev473), pero el código asume frame
Sí, fue el bug fixed. Pero **el principio sigue activo**: cualquier futuro cambio en el frame de `depthNow` rompería esto silenciosamente.
**Fix**: tipo `DepthBelowSurface = number & { __brand: 'belowSurface' }` para tipos branded en TS, o al menos comentar fortísimo.

### C3 🟠 `predictiveSwing` opaco
[src/index.ts](src/index.ts) calcula swing máximo en window 12h. Si la sonda falla en el cálculo predictivo (NaN), `_pickFiniteRadius` cae a 30m. Eso es defensivo pero el usuario no sabe que el predictivo se "rindió".
**Fix**: exponer un flag `predictiveDegraded: true` en state.

### C4 🟢 `chainRecommended` parece bien
No detectado bug obvio. Verificar QA con barcos de diferentes calados.

---

## D. MULTI-DEVICE SYNC (R6 / Q-N)

### D1 🟠 State poll cada 3s vs SSE
SSE existe pero algunos polls del visor lo bypasan y hacen GET propio. Si SSE deja de funcionar (network issue) puede pasar tiempo antes de que el visor lo note. **¿Hay heartbeat SSE?**

### D2 🔴 ACKs cross-device en localStorage por device
[public/mobile.html] el visor cachea ACKs en localStorage. Si dos visores hacen ACK simultáneo de targets distintos, hay race condition al POSTear al backend (último wins).
**Fix**: backend debe hacer merge, no overwrite.

### D3 🟠 Snooze 5min coordinado
`_aisSilencedUntil` (backend, ms timestamp) es authoritative. Frontends muestran countdown desde ahí. **¿Qué pasa si el reloj del visor está desincronizado del Pi?** El countdown podría salir negativo o muy positivo.
**Fix**: backend devuelve `secondsRemaining`, no `until_ms`.

### D4 🟠 Audio mute global
`anchorWatch.audioEnabled` controla todo. Bien por SoT. Pero un visor que cierra y abre rápido podría perder el "false" si su poll local cacheó "true" antes de la mutación.
**Fix**: el bootstrap del visor debe SIEMPRE leer audioEnabled del backend.

---

## E. PERSISTENCIA Y REINICIO

### E1 🔴 `anchored` se persiste pero ¿se restaura completo?
[src/index.ts:1335](src/index.ts#L1335) `ihmCache.get("anchorConfig")` carga `anchorWatch`. Pero `_anchoredSinceMs`, `_dragCandidateTicks`, `_intentionalDepartureSinceMs` son in-memory only. Tras restart con barco anclado:
- "H. fondeo" en bottom-bar muestra "—" hasta el siguiente lift.
- Debouncing del garreo se resetea (puede tardar 2 ticks extra en detectar).
- Auto-lift contador resetea (60s adicionales hasta auto-lift).

**Impacto**: pérdida de contexto temporal tras restart, no de funcionalidad.
**Fix**: persistir `_anchoredSinceMs` en cache.

### E2 🟠 AIS ACK pending TTL
`aisAckedPendingExpiresAt` (1h por defecto): si SK reinicia mid-buffer, los ACKs se mantienen pero el TTL se cuenta como fresh — podrían sobrevivir más de lo esperado.
**Fix**: restablecer TTL a min(rest_TTL, 1h) al cargar.

### E3 🟢 Wave history en SQLite
Persistencia robusta. No detectados problemas.

### E4 🟠 `groundingRisk` cache puede quedar stale
Si SK reinicia y la sonda no vuelve inmediatamente, el `groundingRisk` cacheado (del estado pre-reboot) sigue válido hasta el primer eval. El visor podría mostrar info engañosa durante esos primeros segundos.
**Fix**: invalidar `groundingRisk` en plugin.start().

---

## F. EDGE CASES

### F1 🟠 Sin GPS — alarmas dependientes
- Garreo: deshabilitada correctamente.
- Varada: backend marca "SIN SONDA" pero el visor sigue mostrando último `expectedMinDepth`. Confuso.
- AIS: sin GPS no calculamos distancia a targets — ¿se publican "?" o se ocultan?

### F2 🟠 Sin sonda
`_readDepthValidated` rechaza datos no fiables (frozen, spike, absurd). Pero `groundingStatus` publica "SONDA CONGELADA" como string. **El bottom-bar SONDA sigue mostrando el último valor en blanco** porque solo mira `_isRisk` (que será false al haber `"SONDA CONGELADA"` sin "RIESGO" word).
**Fix**: añadir caso en bottom-bar para estado "sonda no fiable".

### F3 🟠 Sin marea
Si la estación IHM no responde, `lastForecast.extremes` queda viejo. `expectedMinDepth` puede mostrar valores incorrectos basados en marea del día anterior.
**Fix**: TTL en `lastForecast` (ej. 6h), después marcar "marea no disponible".

### F4 🟢 Sin IMU
Wave nav engine reporta `rejectionReason: "buffer_warming"` y no publica deltas. Correcto.

### F5 🟠 Network drop (4G Pi)
El bridge pypilot reintenta cada 5s. Bien. El visor con state poll cada 3s puede acumular polls fallidos sin avisar. **No hay indicator visible de "backend desconectado"** en el visor.
**Fix**: badge en visor si último poll exitoso > 30s.

### F6 🟢 SK plugin restart con barco anclado
`anchorWatch` persiste, el estado `anchored: true` se restaura. Pero pierde contexto temporal (E1).

---

## G. FRONTEND ↔ BACKEND COHERENCIA

### G1 🔴 String vs Object (CAUSA DE LA AUDITORÍA)
Caso documentado: `s.groundingAlarm` es string pero el frontend hacía `.risk`. **Es probable que haya más sitios similares** que no hemos descubierto.

**Acción recomendada**: scan TypeScript en el frontend de TODAS las propiedades del state SK que se acceden y validar contra lo que el backend publica.

Por ejemplo, voy a revisar:
- `s.groundingAlarm` → string ✅ fixed
- `s.groundingActive` → boolean ✅
- `s.groundingRisk` → ¿existe? Verificar en línea 9417.
- `s.tideResume` → string ✅
- `s.tideEvents` → array ✅
- `s.bkeelResume` → string ✅
- `s.approach.depth` → number ✅
- `s.approach.sogKt` → number ✅
- `s.predictiveSwing` → object con `.radiusTotalMaxInWindow` ✅
- `s.aisAckedMMSIs` → string[] ✅
- `s.trackPoints` → array ✅

### G2 🟠 Unidades — Backend siempre metros, frontend convierte
Patrón correcto. PERO algunos POSTs del visor envían valores en unidad de display (m o ft). Si el backend espera m y el visor manda ft → bug grave silencioso.
**Fix**: añadir `unit: 'm'|'ft'` explícito en body, o convertir SIEMPRE en frontend antes de POST. Verificar `saveSondaCfg`, sliders chain/swingRadius, etc.

### G3 🟡 Idioma
Backend genera strings localizadas. Si el visor cambia idioma pero el backend no se entera (POST falla), strings vienen en idioma viejo.
**Fix**: ya hay un sync language. Verificar robustez.

### G4 🔴 Misma data en múltiples paneles UI
Bug del modal Cálculo Sonda (A2.3) fue exactamente esto. **Cada panel UI debería leer del MISMO source y aplicar la MISMA lógica**.

**Lista de paneles que muestran "estado varada"**:
- Bottom-bar SONDA ([public/mobile.html:11320](public/mobile.html#L11320))
- Modal Marea y Profundidad `v-galarm` ([public/mobile.html:5768](public/mobile.html#L5768))
- Modal Cálculo Sonda ([public/mobile.html:9700](public/mobile.html#L9700))
- Modal Info `m-fdyn-bkeel` (verificar)
- Curvas overlay (verificar)

**Fix**: helper único `_groundingRiskLevel(s) → 'safe'|'warning'|'alarm'|'unknown'`.

---

## H. CONFIGURACIÓN / INPUTS

### H1 🟠 Validación de inputs en POST endpoints
`/api/calado`, `/api/alarma`, `/api/settings`, `/api/anchor-watch/*` aceptan body JSON sin validación estricta. Un valor extremo (calado = -999, margen = 999999) puede romper cálculos.
**Fix**: zod o validación manual con clamps.

### H2 🟡 Effect immediate
Cambiar margen de seguridad en modal Cálculo Sonda no fuerza re-evaluación inmediata de grounding. Tarda el siguiente ciclo (~5-30s). Acceptable, pero confuso si el usuario está mirando.
**Fix**: trigger inmediato post-save.

---

## I. PERFORMANCE / ROBUSTEZ

### I1 🟢 Memory: Wave buffer, AIS tracks, etc. bien rotados
No detecté leaks obvios.

### I2 🟠 SSE listeners
Cada cliente conectado mantiene un sseClient. Si los clientes se acumulan (visor abre/cierra muchas veces), podría haber lista grande.
**Verificar**: cleanup de sseClients on disconnect.

---

## J. HALLAZGOS TOP PRIORITY + PLAN DE FIX

### Críticos a fixear YA:
1. **Auditoría exhaustiva de `s.*` propiedades en frontend** (G1) — para asegurar que no hay más bugs como el del bottom-bar.
2. **Centralizar lectura sonda** (B1, A2.6) — una sola función helper.
3. **Centralizar lectura "estado varada"** (G4) — un solo helper compartido entre paneles.
4. **Validación inputs POST** (H1) — clamping para evitar corrupción.

### Graves a fixear en próximas Revs:
5. Auto-repair `_currentGroundingRisk` siempre con todos los campos (A2.4).
6. Persistir `_anchoredSinceMs` (E1).
7. Backend ACK merge no overwrite (D2).
8. Snooze countdown server-relative (D3).
9. `_cleanMmsi` helper único (A3.3).

### Mejoras de UX/transparencia:
10. Exponer factor 15% en UI (A2.5, C1).
11. Configurable umbrales meteo (A4.2).
12. Badge "backend offline" en visor (F5).
13. Status "sonda no fiable" en bottom-bar (F2).

### Refactor estructural (recomendado tras Rev publish):
14. Tipos branded TS para depths (C2).
15. Helpers únicos para conversiones de frame (B1).
16. Eliminar `_skVal` directo para paths críticos.

---

## K. PROCESO RECOMENDADO

1. **Revisar este doc con LLM externo** (ver `docs/PROMPT_FOR_LLM_AUDIT_REVIEW.md`).
2. **Priorizar conjuntamente** con el usuario.
3. **Fixear uno a uno** con QA real, no batch.
4. **Tests unitarios** para los puntos críticos (sonda multi-frame, helpers, etc.) — actualmente no hay coverage de estos paths.
5. **No publicar a NPM** hasta que la lista crítica esté completa.

---

**Resumen ejecutivo**: la causa raíz de los bugs encontrados es **mezcla de frames/tipos sin validación** y **misma información calculada en múltiples sitios con criterios distintos**. La solución estructural es **helpers únicos centralizados** y **tipos branded** (TS) o **convención fortísima en cada acceso**. La solución táctica inmediata son los 4 puntos críticos del top priority.
