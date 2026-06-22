# Hallazgos consolidados — cross-review GPT + Gemini sobre Rev474

**Status**: 🚫 **PUBLICACIÓN NPM BLOQUEADA** hasta cerrar lista crítica.

**Origen**: Tras encontrar 3 bugs graves en producción, audit propia (`AUDIT_CRITICAL_PATHS.md`) revisada por GPT-5 y Gemini Pro en hilos paralelos. Ambas LLMs convergieron sobre el mismo diagnóstico de **patrón sistémico fail-dangerous**.

---

## Patrón sistémico detectado

```
ausencia de información   → false  (debería ser "unknown")
alarma apagada            → realidad física borrada
sensor perdido            → notificación "normal"  (debería ser "danger-data-lost")
distintas magnitudes      → mismo historial estadístico
varios evaluadores async  → mismo estado sin serialización
inputs sin validar        → -999 m de calado es aceptado
```

Cada uno por separado es manejable. Juntos producen una clase de bug en el que **el sistema confunde "no sé" con "estamos a salvo"**.

---

## Hallazgos críticos bloqueantes (C-XX)

### C-01 🔴 Detector sonda congelada matemáticamente inalcanzable
- `DEPTH_HISTORY_SIZE = 20`, evaluación cada 2s → ventana real ~38s.
- Condición de congelación exige >60s → **JAMÁS dispara** fondeado normal.
- **Impacto**: sensor congelado durante la noche silenciaría una varada.
- **Fix**: ventana TEMPORAL (75s) en lugar de cap por tamaño de array.

### C-02 🔴 Pérdida de sonda limpia alarma de varada ACTIVA
- En el branch "sonda no fiable", se publica `groundingRisk=false`, `physicalRisk=false`, notif `state:"normal"`.
- Si la alarma estaba activa por riesgo real → se cierra.
- **Impacto**: failure mode más peligroso. Sensor falla → silencio.
- **Fix**: transición `danger + sensor_lost` → `danger-data-lost`, NUNCA → `safe`.

### C-03 🔴 Ausencia de datos = "sin riesgo" (fail-dangerous sistémico)
- Comentario explícito: `// If we can't compute, treat as no risk`.
- `physicalRisk = (expectedMinDepth != null && eff != null) ? expectedMinDepth < eff : false`.
- **Impacto**: cualquier dato faltante (extremos marea, sonda, calado, conversión) → false negative.
- **Fix**: tipo `PhysicalState = "safe" | "danger" | "unknown"`. `safe` solo si todos los datos frescos y evaluación demuestra OK.

### C-04 🔴 Apagar la alarma destruye la realidad física
- `POST /api/alarma {enabled:false}` y `/api/alarma/off` ejecutan `ihmCache.set("groundingRisk", {risk:false})`.
- Borra `physicalRisk`, `expectedMinDepth`, `effectiveDraft`, `depthNow`, `depthQuality`, `nextLowTime`.
- **Impacto**: silenciar el zumbador borra el conocimiento físico.
- **Fix**: separar config/notif de física. Apagar alarma solo cambia `notification.state`, no toca `physics`.

### C-05 🔴 `_readDepthValidated` calcula mal `belowTransducer`
- Suma `draft` cuando lo correcto es sumar `surfaceToTransducer` (= draft − transducerToKeel).
- Ejemplo: draft 1.35m, transducerToKeel 0.80m → real surfaceToTransducer = 0.55m. Lectura belowTransducer 2.00m → real 2.55m, código devuelve 3.35m. **Sobreestima 0.80m**.
- **Impacto**: cálculos de aproche, cadena, predictivo. NO limitado a alarma varada.
- **Fix**: usar prioridad `surfaceToTransducer || (draft - transducerToKeel) || unknown`.

### C-06 🔴 Fallback de calibración `transducerToKeel = 0` sin warning
- Si no encuentra path → devuelve 0 → asume transductor al ras de la quilla.
- **Impacto**: usuarios con transductor en el casco (común) pierden la corrección silenciosamente.
- **Fix**: ausencia de calibración → `health: "missing-calibration"`, NO valor numérico arbitrario.

### C-07 🔴 Snooze + `groundingActive` semánticamente incompatibles
- `notifyRisk = enabled && alertCriteriaMet && !isSnoozed` (respeta snooze).
- `groundingActive = enabled && _currentGroundingRisk?.risk` (NO respeta snooze).
- Frontend usa `groundingActive` para audio → durante snooze `risk=true` → audio puede reactivarse.
- **Fix**: publicar 3 flags separados: `physicalDanger`, `alarmCriteriaMet`, `notificationActive`.

### C-08 🔴 "En movimiento" se interpreta como "sin riesgo"
- `isStopped = sogKn < 0.5`. Si no stopped → mismo branch que sonda inválida → `physicalRisk=false` + clear alarm.
- **Escenario fatal**: garreo → barco coge 0.6 kn → acerca a zona somera → grounding desactivado por "EN MOVIMIENTO".
- **Fix**: separar `operationalMode` de `dataHealth`. Movimiento NO es seguridad. Alarma activa no se limpia solo por superar 0.5 kn.

### C-09 🔴 Lecturas sin timestamp se consideran frescas indefinidamente
- `_skVal` y `readDepthBelowTransducer`: si `raw` es número plano (sin `.timestamp`), no aplica filtro stale.
- Una lectura cacheada puede sobrevivir indefinidamente.
- **Fix**: lectura crítica sin timestamp → `quality: "timestamp-missing"`, ventana de arranque controlada, o degradada.

### C-10 🔴 Validación inputs peligrosa
- `Boolean("false") === true`.
- `Number(safetyMargin) || 0.5` → `-999` pasa, `0` cae al default.
- `draftSource` acepta cualquier string.
- `minutesBefore`, `alertMinutes`, `margin`, `draft` sin límites estrictos.
- **Fix**: `finiteInRange(v, min, max)` helper. Nunca `Boolean()` ni `Number(x) || default` en seguridad.

### C-11 🔴 Contrato `groundingAlarm` SSE objetivamente erróneo
- `groundingAlarm: groundingStatus` ← mismo string que `groundingStatus`. NO contiene estado real de alarma (ON/OFF/SNOOZE).
- `groundingDetail` existe pero NO `groundingRisk` → el frontend `if (d.groundingRisk && d.groundingRisk.risk)` es **código muerto**.
- **Fix**: contrato inequívoco con objeto desagregado.

### C-12 🔴 `getAnchorWatchState` no valida timestamp de posición
- `navigation.position` se lee sin chequear `pos.timestamp`.
- Evaluator garreo SÍ rechaza posiciones >30s, pero el SSE puede mandar `gpsLost:true` Y `boatPosition: (vieja)` simultáneamente.
- **Impacto**: el mapa muestra barco "vivo" mientras la alarma dice GPS perdido. Confusión visual peligrosa.
- **Fix**: helper único `readValidatedPosition()` usado en ambos sitios.

### C-13 🔴 Race condition en `evaluateAndPublishGroundingRisk`
- Invocada fire-and-forget cada 2s + await desde update mareas + sin mutex/inFlight/generation.
- Una evaluación lenta puede pisar resultado más reciente.
- **Fix**: `groundingGeneration++` antes de cada cómputo, descartar resultado si generación cambió.

### C-14 🔴 `depthHistory` global mezcla frames
- Recibe sucesivamente belowKeel/belowSurface/belowTransducer porque `isDepthReliable` se llama desde 2 sitios con valores en frames distintos.
- Análisis estadístico de spikes/freeze inválido.
- **Fix**: tipo `CanonicalDepthSample { belowSurfaceM, sourcePath, observedAtMs }`, normalización antes de history.

### C-15 🔴 Criterio para liberar el latch tras recuperar sonda
- El latch C-02 ("danger persistente aunque sensor falle") necesita criterio explícito de liberación.
- Opciones: timeout (peligroso), lift manual (puede olvidarse), N ticks consecutivos `safe` confirmados (recomendado).
- **Fix**: liberar solo tras N=3 ticks consecutivos con `dataHealth=fresh` Y `state=safe`.

### C-16 🟠 Migración versionada del cache `{risk:false}` antiguo
- Caches persistidos pre-refactor tienen forma `{risk: false}` minimalista.
- Al cargar en código nuevo, faltan campos críticos.
- **Fix**: `_schemaVersion` en cache + migrador al arrancar.

### C-17 🔴 Incompatibilidad frontend antiguo + backend nuevo
- Si el usuario tiene visor cacheado en su navegador (PWA, Service Worker) y backend actualiza schema, frontend lee campos viejos.
- Resultado: silencioso fallo de coherencia.
- **Fix**: `schemaVersion` en SSE. Frontend detecta mismatch → banner bloqueante "Recarga la página".

### C-18 🟠 Diferencia clearance físico vs clearance conservador
- "Cuánto agua bajo la quilla AHORA" vs "cuánto agua bajo la quilla EN LA PEOR BAJAMAR" deben explicitarse claramente en contrato y UI.
- Confundir uno con otro lleva al usuario a falsas sensaciones de seguridad.
- **Fix**: campos separados en `physics`: `keelClearanceM` (ahora) vs `expectedMinKeelClearanceM` (peor caso ventana 12h).

### C-19 🟠 Conflicto entre dos fuentes frescas de profundidad
- Si SK publica `belowKeel` Y `belowSurface` simultáneamente (dos sondas o conversión interna), cuál ganar.
- **Fix**: orden de prioridad determinístico documentado + log de fuente usada.

### C-20 🟠 Source prioritario stale vs source alternativo fresco
- Si `belowSurface` es prioritario pero stale (>5s), y `belowKeel` está fresco → usar belowKeel con flag `degraded`.
- **Fix**: implementar fallback con health propagation.

### C-21 🔴 SOG ausente ≠ embarcación parada
- `isStopped = sogKn < 0.5` trata `sogKn == null` (sin GPS o sin SOG) como "parado".
- **Resultado**: si pierdes el GPS, el plugin asume que estás anclado y continúa evaluando varada... pero las posiciones son falsas.
- **Fix**: `operationalMode: "anchored" | "moving" | "unknown"`. Null SOG → `unknown`.

### C-22 🟠 Romper paths públicos SK afecta a consumidores externos
- Cambiar `environment.tide.vessel.groundingRisk` etc. romperá KIP, OpenPlotter Notifications, paneles custom.
- **Fix**: mantener paths legacy publicados como aliases del nuevo contrato durante transición (Rev477-Rev480).

### C-23 🟠 `_readDepthValidated` también alimenta predictiveSwing y chainRecommended
- Al corregir C-05, valores de profundidad cambian → predictivo y cadena recalculan distinto.
- **Riesgo**: regresión en cálculos previamente validados.
- **Fix**: log diff de valores 24h pre/post + comparación con dataset conocido + revertir si saltos absurdos.

### C-24 🔴 `Date.now()` para duraciones se rompe con saltos NTP
- snooze, stale, debounce, history TTL, latch usan `Date.now()`. Una corrección NTP puede mover el reloj hacia atrás → contadores negativos, snoozes eternos.
- **Fix**: usar `performance.now()` (monotónico) para duraciones intra-proceso, UTC ISO para persistencia, detector de saltos al arrancar.

### C-25 🔴 Frontend desconectado conserva último estado verde
- Si UI recibió `safe` y se pierde conexión SSE/REST, la pantalla mantiene verde durante minutos hasta que algo más obvio falle.
- **Fix**: timeout `lastStateReceived > 15-30s` → estado de interfaz = `disconnected/unknown`, nunca verde.

### C-26 🟠 Comandos simultáneos lift/drop sin serialización
- Dos visores pueden mandar `DROP/LIFT/DROP` simultaneamente. Escrituras async de cache pueden interlevarse.
- **Fix**: lock por comando + revision number + respuesta con estado final + rechazar comandos antiguos (idempotencia).

### C-27 🟠 Filesystem readonly o cache corrupto
- Caída de batería en Pi → SD montada read-only → `ihmCache.set()` falla silenciosamente.
- **Fix**: definir comportamiento: seguir en memoria, NO bloquear evaluator, informar al usuario. Imposibilidad de persistir NO debe convertir estado en `safe`.

### C-28 🔴 Forma real del payload SK no verificada
- `_skVal` y similares asumen `{value, timestamp}` o número plano. Si SK devuelve solo el valor (sin timestamp), aplicar literalmente C-09 podría eliminar TODOS los datos válidos.
- **Fix**: cache local de observaciones alimentado por `app.streambundle` deltas (no por `getSelfPath`), conservando value/timestamp/source/path.

### C-29 🟠 Race condition serialización SSE
- Express stringifyea el state mientras otro hilo lo muta → JSON inconsistente.
- **Fix**: deep clone del payload antes de stream.write.

---

## Hallazgos previos corregidos por el cross-review

Estos puntos de mi audit original están MAL formulados o ya resueltos:

### D2 ❌ ACK AIS race condition
- **Realidad**: backend hace merge mediante `includes()/push()` en endpoints individuales `/ais-ack`, no overwrite.
- Sigue válido: normalización MMSI inconsistente, ACK por incidente vs MMSI.

### E1 ❌ `anchoredSinceMs` no se persistía
- **Realidad**: SÍ forma parte de `AnchorWatchState`, sí se persiste.
- Edge case válido: caches antiguos con `anchored:true, anchoredSinceMs:null` necesitan reparación al cargar.

### A5.2 ❌ Notif GPS recovery no se limpia
- **Realidad**: SÍ se limpia con `state:"normal"` + audio off.

### I2 ❌ SSE cleanup ausente
- **Realidad**: SÍ existe (req.close, errors, plugin.stop).
- El problema real es ausencia de `stateVersion`, `serverInstanceId`, `schemaVersion`, `generatedAt`. **Reformular como contract issue, no leak**.

### A1.2 ⚠ Debounce garreo
- Reformulado: 2 ticks × 2s = **4s real** (comentarios decían 10s con tick 5s). Sigue siendo tick-based.

---

## Plan de Revs propuesto (ver `REFACTOR_PLAN_Rev475_Rev480.md`)

```
Rev475: Validación I/O + ventana temporal congelación + helper timestamp
Rev476: Pipeline canónico profundidad (CanonicalDepth con health)
Rev477: Separación Physics/Config/Notification (resuelve C-03, C-04, C-07, C-08, C-11)
Rev478: Serialización evaluator + snapshot timestamps (C-12, C-13)
Rev479: Frontend reescrito sobre nuevo contrato
Rev480: Tests unitarios cubriendo paths críticos + QA final
Candidato publish 2.3.0 SOLO tras Rev480 + QA real en barco
```

Cada Rev se despliega aislada, con QA propio. NO se acumulan cambios estructurales en una sola Rev.

---

## Veredicto

> 🚫 **PUBLICACIÓN BLOQUEADA HASTA Rev480**
>
> La combinación de C-01, C-02, C-03 hace inviable cualquier confianza del usuario en la alarma de varada: un transductor que se cuelga durante la noche silenciaría la alarma sin aviso.
>
> El refactor estructural es **ineludible**. Cada Rev del plan elimina una clase de bug. Tras Rev480 + QA real, se reabre publicación.
