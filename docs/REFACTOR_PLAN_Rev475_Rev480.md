# Plan de refactor Rev475 → Rev480 (v4 — post 3ª ronda LLM)

> **v4 changelog (post ronda 3 ready-check)**:
> - Gemini: ✅ GO Rev475 v3.
> - GPT: ❌ NO-GO con 6 detalles de implementación bloqueantes (más estricto).
> - **Aplico los 6 de GPT**: C-28 prerequisito formal, latch pseudocódigo corregido (`activatedAtIso` único, async loadLatchFromCache, reloj monotónico), persistencia fail-safe (memoria + notif PRIMERO, persist después), reasonCodes ampliados (TIMESTAMP_INVALID, FORECAST_OBSOLETE, etc.), eliminados tests/asignaciones C-14 de Rev475, transición SSE backward-compat formalmente garantizada hasta Rev479.

> **v3 changelog (post Q1-Q7 cross-review v2)**:
> - Gemini: GO con 3 anomalías menores. GPT: NO-GO con 6 correcciones bloqueantes.
> - Aplicadas las 6 de GPT: latch centralizado+persistido, eliminar canonicalización parcial Rev475, FSM physics.unknown (no .danger) tras pérdida sensor, mapping legacy correcto, schemaVersion en Rev475/476, C-18 implementado.
> - Añadido C-24..C-29 al audit.

**Status**: 🚫 PUBLICACIÓN NPM BLOQUEADA hasta Rev480 + QA real en barco.

**Origen**: cross-review GPT+Gemini de Rev474 (`AUDIT_FINDINGS_CROSS_REVIEW.md`) + cross-review GPT+Gemini del plan v1 → este plan v2 incorpora 5 correcciones críticas.

**Regla cardinal**: Una Rev = un cambio estructural aislado + tests propios + QA propio. **No se acumulan refactors**. Cada Rev debe poder revertirse.

---

## Cambios del plan v1 al v2 (post LLM review)

| Cambio | Razón |
|--------|-------|
| **C-02 movido de Rev477 → Rev475** | LLMs unánimes: "failure mode más peligroso" no puede esperar 2 Revs. Latch quirúrgico ya. |
| **C-14 movido de Rev476 → Rev475 (junto a C-01)** | "No puedes arreglar detector de congelación si el historial mezcla frames". |
| **C-01 movido de Rev475 → Rev476** | Solo tras normalizar el historial canónico. |
| **C-13 movido de Rev478 → Rev475** | "La nueva FSM de Rev477 será inestable si hay races concurrentes." |
| **C-08 movido de Rev477 → Rev476** | Operación-mode pertenece al pipeline de datos, no a la FSM. |
| **Tests en CADA Rev**, no solo en Rev480 | "Rev480 debe descubrir interacciones, no fallos básicos." |
| **Rev479 reestimada 8h → 16h** | "Adaptar JS monolítico 13k LOC al nuevo contrato destapará decenas de call sites." |
| **Rev476 reestimada 8h → 12h** | "Tocar marcos de referencia romperá predictivo y approach colaterales." |
| **Single-flight en lugar de generation counter** | "Efectos laterales ocurren antes del guard final → resultados descartados ya causaron daño." |
| **Backward compat SK paths** | "KIP / OpenPlotter pueden romperse si cambias paths públicos." |

---

## Hallazgos NUEVOS detectados por las LLMs (no estaban en cross-review previa)

Añadir a `AUDIT_FINDINGS_CROSS_REVIEW.md`:

- **C-15** 🔴 Criterio para eliminar latch C-02 tras recuperar sonda — debe ser explícito, no por timeout.
- **C-16** 🟠 Migración versionada del cache `{risk:false}` antiguo — al cargar, normalizar al nuevo schema.
- **C-17** 🔴 Incompatibilidad frontend antiguo + backend nuevo — necesita schema version detection con bloqueo visible.
- **C-18** 🟠 Diferencia clearance físico vs clearance conservador — explicitar en contrato cuál es cuál.
- **C-19** 🟠 Conflicto entre dos fuentes frescas de profundidad — priorización determinística.
- **C-20** 🟠 Source prioritario stale vs source alternativo fresco — preferir fresco aunque sea menor prioridad.
- **C-21** 🔴 SOG ausente ≠ embarcación parada — sin SOG debe ser `operationalMode: "unknown"`, NO assumir anchored.
- **C-22** 🟠 Romper paths públicos SK (`environment.tide.vessel.groundingRisk` etc.) afecta a KIP/OpenPlotter externos.
- **C-23** 🟠 `_readDepthValidated` también alimenta predictiveSwing y chainRecommended — al fixear C-05 hay riesgo de regresión en cálculos predictivos.

---

## Rev475 — Contención inmediata + tests

**Prerequisito (GPT v4 punto #1)**: completar **C-28 (auditoría payload SK)** antes de tocar `_skVal` o aplicar C-09. Endpoint temporal `/api/_skshape` que dumps la forma exacta de cada path crítico durante 1 minuto. Si SK devuelve solo números planos (sin `{value, timestamp}`), refactor a `app.streambundle` deltas en lugar de getSelfPath para garantizar forma.

**Bloqueantes que cierra**: C-02, C-09, C-10, C-13, C-21, C-24, C-27, C-28. (NO C-14 — movido íntegro a Rev476.)

**Riesgo**: medio. Latch crítico + concurrencia + reloj monotónico + payload audit.

### Cambios

#### 1. Latch centralizado y persistido C-02 — CORRECCIÓN GPT v3

**v2 cubría solo**: sonda no fiable, SOG > 0.5kn. Y era variable global en memoria.

**GPT v3 lo bloquea**: latch debe cubrir CUALQUIER indeterminación + persistirse para sobrevivir restart SK/Pi (un fallo eléctrico durante una sonda perdida pierde el latch y reaparece "safe" falsamente).

**v4 implementa transición central (pseudocódigo corregido post GPT ronda 3)**:

```ts
// reasonCodes ampliados (GPT v4: añadidos TIMESTAMP_INVALID, FORECAST_OBSOLETE,
// NEXT_LOW_MISSING, CACHE_READ_FAILURE, CACHE_WRITE_FAILURE)
type IndeterminacyReason =
  | "DEPTH_MISSING" | "DEPTH_STALE" | "DEPTH_FROZEN"
  | "MISSING_CALIBRATION" | "TIDE_MISSING" | "DRAFT_MISSING"
  | "SOURCE_CONFLICT" | "EVALUATION_ERROR" | "MOVEMENT_DETECTED"
  | "TIMESTAMP_INVALID" | "FORECAST_OBSOLETE" | "NEXT_LOW_MISSING"
  | "CACHE_READ_FAILURE" | "CACHE_WRITE_FAILURE";

interface SafetyLatch {
  active: boolean;
  activatedAtIso: string | null;            // único campo timestamp (no más activatedAtMs)
  activatedAtMonotonicMs: number | null;    // para duraciones (no para persistir)
  reasonCode: IndeterminacyReason | null;
  previousState: "danger" | "safe" | null;
  previousEvaluatedAtIso: string | null;
}

// State inicial vacío. La carga async se hace en restoreLatchOnBoot() durante plugin.start().
let _safetyLatch: SafetyLatch = {
  active: false, activatedAtIso: null, activatedAtMonotonicMs: null,
  reasonCode: null, previousState: null, previousEvaluatedAtIso: null,
};
let _safeTickCount = 0;

// Reloj monotónico para duraciones intra-proceso (C-24).
function monotonicNowMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

async function handleGroundingIndeterminate(reason: IndeterminacyReason): Promise<void> {
  const wasInDanger = (lastGroundingNotifState === "alarm") || _safetyLatch.active;
  if (!wasInDanger) return;

  // CORRECCIÓN GPT #3: actualizar MEMORIA y publicar NOTIF antes de persistir.
  // Persistencia es best-effort; un FS readonly NO puede impedir la alerta.
  _safetyLatch = {
    active: true,
    activatedAtIso: new Date().toISOString(),
    activatedAtMonotonicMs: monotonicNowMs(),
    reasonCode: reason,
    previousState: _safetyLatch.previousState ?? "danger",
    previousEvaluatedAtIso: _lastGroundingEvalIso,
  };

  // 1. Publicar notif PRIMERO (no esperamos al disco).
  try {
    await publishNotif({
      state: "alert",
      method: ["visual", "sound"],
      message: `RIESGO RETENIDO - sensor degradado (${reason})`,
    });
  } catch (e) { app.debug(`[IHM-LATCH] publishNotif failed: ${e}`); }

  // 2. Persistir DESPUÉS (best-effort).
  try {
    await persistLatch(_safetyLatch);
  } catch (e) {
    app.debug(`[IHM-LATCH] persist failed (readonly FS?): ${e}. Continuando en memoria.`);
    // No degradar la seguridad. La sesión actual sigue protegida en memoria.
    // Si reinicia el plugin antes de poder persistir, se pierde el latch
    // (degradación aceptable; ya está fuera de nuestro control).
  }
}

// Liberación: 3 ticks consecutivos fresh+safe Y 6s mínimos reloj monotónico.
async function maybeReleaseLatch(freshAndSafe: boolean): Promise<void> {
  if (!_safetyLatch.active) return;
  if (!freshAndSafe) { _safeTickCount = 0; return; }
  _safeTickCount++;
  const enoughTicks = _safeTickCount >= 3;
  const elapsedMs = _safetyLatch.activatedAtMonotonicMs != null
    ? (monotonicNowMs() - _safetyLatch.activatedAtMonotonicMs)
    : (Date.now() - Date.parse(_safetyLatch.activatedAtIso!));  // fallback post-restart
  const enoughTime = elapsedMs >= 6_000;
  if (enoughTicks && enoughTime) {
    _safetyLatch = {
      active: false, activatedAtIso: null, activatedAtMonotonicMs: null,
      reasonCode: null, previousState: null, previousEvaluatedAtIso: null,
    };
    _safeTickCount = 0;
    try { await persistLatch(_safetyLatch); } catch (e) { app.debug(`[IHM-LATCH] persist release failed: ${e}`); }
  }
}

// Llamado UNA vez desde plugin.start() — async correcto, no constructor.
async function restoreLatchOnBoot(): Promise<void> {
  let cached: SafetyLatch | null = null;
  try { cached = await loadLatchFromCache(); }
  catch (e) { app.debug(`[IHM-LATCH] cache read failed: ${e}, asumiendo no-latch`); }
  if (cached?.active) {
    // Restaurar como latch.active (NO como danger fresco).
    // El activatedAtMonotonicMs se pierde; usamos el ISO para cálculo de elapsed.
    _safetyLatch = {
      ...cached,
      activatedAtMonotonicMs: null,  // se recalculará si seguimos latched
    };
    try {
      await publishNotif({
        state: "alert", method: ["visual"],
        message: `RIESGO RETENIDO desde reinicio (${cached.reasonCode})`,
      });
    } catch (e) { app.debug(`[IHM-LATCH] notif restore failed: ${e}`); }
  }
}
```

**Cobertura ampliada** (GPT v4): 14 reasonCodes cubriendo todas las indeterminaciones (sonda, marea, calibración, calado, timestamp, conflicto fuentes, excepción, cache fail, forecast obsoleto, next_low ausente, movimiento).

#### 2. Validación I/O (C-10)

`finiteInRange(v, min, max)` helper + aplicación en TODOS los endpoints POST:
- `/api/calado`: `draft ∈ [0, 30]`, `safetyMargin ∈ [0, 10]`, `draftSource ∈ {"manual","signalk"}`.
- `/api/alarma`: `enabled === true|false` estricto (no `Boolean(string)`), `minutesBefore ∈ [0, 360]`, `safetyMargin ∈ [0, 10]`.
- `/api/settings`, `/api/anchor-watch/*`: clamps razonables.

#### 3. Single-flight evaluator C-13

Patrón GPT (no solo generation counter):

```ts
let _groundingEvalRunning = false;
let _groundingEvalPending = false;

async function requestGroundingEvaluation(): Promise<void> {
  if (_groundingEvalRunning) { _groundingEvalPending = true; return; }
  _groundingEvalRunning = true;
  try {
    do {
      _groundingEvalPending = false;
      const snapshot = await computeGroundingSnapshot();
      await commitGroundingSnapshot(snapshot);  // efectos laterales aquí
    } while (_groundingEvalPending);
  } finally {
    _groundingEvalRunning = false;
  }
}
```

Garantiza serialización Y siempre re-ejecuta si llegó request mientras corría.

#### 4. Historial sonda — CORRECCIÓN GPT v3: NO canonicalizar parcial

**v2 proponía** canonicalizar parcialmente en Rev475 (belowKeel→belowSurface, belowSurface tal cual, belowTransducer descartado).

**GPT v3 lo bloquea**: descartar belowTransducer en Rev475 rompe instalaciones que SOLO publican ese path. El historial queda vacío.

**v3 acepta una de estas tres opciones**:
1. Mover C-14 íntegro a Rev476 (junto a Rev476 canónico). Rev475 deja la lectura tal cual.
2. En Rev475 historiales **separados por sourcePath** (no convertir, no mezclar fuentes). 3 buffers independientes.
3. Feature flag para activar canonicalización solo cuando está disponible.

**v3 elige opción 1**: mover C-14 completo a Rev476. Rev475 mantiene la lectura del helper actual (mejorado por Rev473) sin tocar el history. Es la opción más conservadora.

→ En Rev475 NO se toca `depthHistory`. Eso pasa a Rev476.

#### 5. Lectura con timestamp obligatorio C-09

`_skVal`: si `raw` es número plano sin `.timestamp`, devolver `{value: null, quality: "no-timestamp"}` para paths críticos (depth, position, sog).

#### 6. SOG ausente ≠ stopped C-21

```ts
const sogVal = _skVal("navigation.speedOverGround").v;
const operationalMode = sogVal == null ? "unknown"
                      : sogVal < 0.25 ? "anchored"  // m/s = 0.5 kn
                      : "moving";
// NO asumir anchored si sogVal es null
```

#### 7. schemaVersion en SSE — ADELANTO GPT v3

**v2 dejaba schemaVersion para Rev478**.

**GPT v3 lo bloquea**: cuando Rev477 cambie el contrato, el frontend cacheado (PWA, Service Worker) no podrá detectar el cambio formalmente → C-17 reproduce.

**v3 mete `schemaVersion: 1` ya en Rev475** sin cambiar nada del contrato. Luego Rev477 sube a `schemaVersion: 2` simultáneamente con FSM:

```ts
// En getAnchorWatchState() — añadir desde Rev475:
return {
  schemaVersion: 1,            // bump a 2 en Rev477
  serverInstanceId: SERVER_ID, // generado en plugin.start()
  generatedAt: new Date().toISOString(),
  serverTimeMs: Date.now(),
  // ... resto del state (TODOS los campos legacy IDÉNTICOS)
};
```

#### 8. Contrato de transición backward-compat — CORRECCIÓN GPT v4 punto #6

**v3 no garantizaba explícitamente** que el frontend antiguo seguiría funcionando durante Rev475-478.

**GPT v4 lo bloquea**: `schemaVersion` no protege a un frontend antiguo que no sabe comprobarlo.

**v4 garantiza formalmente**:
- Rev475-478 NO modifican forma ni semántica de NINGÚN campo legacy del SSE:
  - `groundingAlarm` (string)
  - `groundingStatus` (string)
  - `groundingActive` (boolean)
  - `groundingDetail` (objeto si existe)
- SOLO se AÑADEN campos nuevos (`schemaVersion`, `grounding` bloque V2 en Rev477).
- Frontend antiguo sigue leyendo campos viejos sin enterarse de nada.
- Solo Rev479 (cuando se reescribe el frontend) consume el nuevo bloque y se descartan dependencias legacy internas.
- Después de Rev479 estable, en Rev481+ se puede eliminar campos legacy del SSE.

Test obligatorio Rev477: snapshot diff de los campos legacy en 10 escenarios pre/post — deben ser strings/valores byte-idénticos.

### Tests obligatorios Rev475 (`tests/grounding_v475.test.js`)

```js
// C-02 latch
test("Sensor failure mid-danger does NOT clear alarm");
test("Safe sensor → 3 consecutive safe ticks → latch releases");
test("Boat speed > 0.5kn does NOT clear active alarm");

// C-13 single-flight
test("Concurrent evaluator calls do not interleave commit");
test("Pending request always triggers re-eval after current completes");

// C-10 validation
test("safetyMargin=-999 rejected with 400");
test("enabled='false' string rejected (not Boolean coerced)");
test("draft=NaN rejected");

// C-21 SOG ausente
test("null SOG → operationalMode=unknown, not anchored");

// C-24 reloj monotónico
test("NTP backward jump does not break latch elapsed calculation");

// C-27 FS readonly
test("persistLatch failure does NOT prevent notification or memory update");

// C-28 SK payload shape
test("getSelfPath returns {value, timestamp} for navigation.position");
test("If raw is plain number, capture via streambundle delta instead");
```

(Eliminados los tests de `depthHistory` que estaban en v3 — C-14 está íntegro en Rev476.)

### Estimación

~10h código + 3h tests + 2h QA = **15h total**. (v1 decía 6h — irrealmente optimista.)

---

## Rev476 — Pipeline canónico de profundidad + C-01

**Bloqueantes que cierra**: C-05, C-06, C-14 (completo), C-01 (ahora sí), C-19, C-20, C-23 (mitigación).

**Riesgo**: alto. Toca lectura sonda y cálculos colaterales (predictiveSwing, chainRecommended).

### Cambios

#### 1. Tipo único `CanonicalDepth`

```ts
type DepthHealth = "fresh" | "stale" | "frozen" | "missing-calibration" | "no-data";

interface CanonicalDepth {
  belowSurfaceM: number | null;
  belowKeelM: number | null;
  health: DepthHealth;
  observedAtMs: number;
  pathUsed: string | null;
  sourceId: string | null;
}
```

#### 2. Helper único `readCanonicalDepth(draft)`

Prioridad **determinística** (C-19, C-20):
1. `belowSurface` directo si fresco.
2. `belowKeel + draft` si fresco.
3. `belowTransducer + surfaceToTransducer` si surfaceToTransducer disponible.
4. `belowTransducer + (draft - transducerToKeel)` si transducerToKeel disponible.
5. **`missing-calibration`** si no hay calibración para belowTransducer (NUNCA devolver número arbitrario).

Si fuente prioritaria stale pero alternativa fresca → preferir la fresca con flag `degraded`.

#### 3. `_readDepthValidated` delega al nuevo helper (C-23 mitigación)

Audit completo de todos los consumers (`predictiveSwing`, `chainRecommended`, `approach`, etc.). Tras el cambio, log diff de valores producidos en 24h reales → si saltos absurdos → revertir.

#### 4. Detector congelación C-01 (ahora seguro)

Sobre `depthHistory` ya canónico:
```ts
function isFrozen(history: DepthSample[]): boolean {
  if (history.length < 2) return false;
  const span = history[history.length-1].ts - history[0].ts;
  if (span < 60_000) return false; // ventana mínima 60s
  const first = history[0].valueBSm;
  return history.every(s => Math.abs(s.valueBSm - first) < 0.02); // ±2cm
}
```

### Tests obligatorios Rev476

```js
test("readCanonicalDepth: only belowKeel → belowSurface = belowKeel + draft");
test("readCanonicalDepth: only belowSurface → as-is");
test("readCanonicalDepth: belowTransducer + surfaceToTransducer → exact conversion");
test("readCanonicalDepth: belowTransducer + transducerToKeel → exact conversion");
test("readCanonicalDepth: belowTransducer sin calibración → missing-calibration (NO valor arbitrario)");
test("Frozen detection con ventana real 60s");
test("Source priority: belowSurface stale + belowKeel fresh → use belowKeel (degraded)");
test("Regresión predictiveSwing: valores idénticos pre/post para casos conocidos");
```

### Estimación

~12h código + 4h tests + 3h QA = **19h total**. (v1 decía 8h.)

---

## Rev477 — Máquina de estados (FSM Physics/Config/Notification)

**Bloqueantes que cierra**: C-03 completo, C-04, C-07, C-11.

**Riesgo**: alto. Refactor contrato SSE de grounding + introducción FSM.

### Cambios

#### 1. Tipo `GroundingState` (refinado con sugerencias Gemini)

```ts
interface GroundingState {
  physics: {
    state: "safe" | "danger" | "unknown";
    depthBelowSurfaceM: number | null;
    expectedMinDepthM: number | null;
    keelClearanceM: number | null;
    nextLowTimeIso: string | null;
    dataHealth: "fresh" | "stale" | "missing" | "degraded" | "missing-calibration"; // Gemini refinement
    operationalMode: "anchored" | "moving" | "unknown"; // Rev475 setup
  };
  config: {
    alarmEnabled: boolean;
    safetyMarginM: number;
    minutesBefore: number;
  };
  notification: {
    state: "normal" | "active" | "snoozed";
    snoozedUntilMs: number | null;
    audioActive: boolean; // Gemini refinement: estado real zumbador
  };
}
```

#### 2. Reglas inflexibles de la FSM — CORRECCIÓN GPT v3

**v2 decía**: "Pérdida sensor durante danger → physics permanece 'danger' + dataHealth=degraded".

**GPT v3 lo bloquea**: epistemológicamente incorrecto. Tras perder el sensor NO sabes si sigue habiendo peligro. `physics.state` debe describir lo que sabes AHORA, el `safetyLatch` describe el peligro no resuelto.

**v3 reglas correctas**:

```ts
interface GroundingState {
  physics: {
    // Lo que sabes AHORA
    state: "safe" | "danger" | "unknown";
    depthBelowSurfaceM: number | null;
    expectedMinDepthM: number | null;
    currentPhysicalUnderKeelM: number | null;       // C-18: agua bajo quilla AHORA
    expectedMinPhysicalUnderKeelM: number | null;   // C-18: peor caso ventana 12h
    clearanceToEffectiveThresholdM: number | null;  // C-18: diferencia con umbral conservador
    nextLowTimeIso: string | null;
    dataHealth: "fresh" | "stale" | "missing" | "degraded" | "missing-calibration" | "invalid" | "conflict";
    operationalMode: "anchored" | "moving" | "unknown";
  };
  // Lo que pasó antes (peligro no resuelto)
  safetyLatch: {
    active: boolean;
    activatedAtIso: string | null;
    reasonCode: string | null;
    previousState: "danger" | "safe" | null;
  };
  config: {
    alarmEnabled: boolean;
    safetyMarginM: number;
    minutesBefore: number;
  };
  notification: {
    state: "inactive" | "active" | "snoozed" | "latched";   // "latched" = nuevo, GPT v3
    audibleRequested: boolean;                              // backend solicita audio
    snoozedUntilMs: number | null;
  };
}
```

**Reglas inflexibles**:
- `physics.state = "safe"` SOLO si dataHealth=fresh Y evaluación demuestra OK.
- Apagar alarma → solo `config.alarmEnabled = false`. **NO toca physics ni latch**.
- Pérdida sensor durante danger → `physics.state = "unknown"`, `dataHealth = "missing"`, `safetyLatch.active = true`, `notification.state = "latched"`.
- SOG >0.5kn → `operationalMode = "moving"`, NO afecta `physics.state` existente.
- `notification.audibleRequested` reemplaza `audioActive` (backend no puede saber estado real navegador).

#### 3. Eliminar `ihmCache.set("groundingRisk", {risk:false})` C-04

#### 4. Backward compat SK paths C-22 — CORRECCIÓN GPT v3

**v2 proponía**: `legacy.groundingRisk = physics.state === "danger"`.

**GPT v3 lo bloquea**: cambiar la semántica. El path legacy `groundingRisk` originalmente significaba **alarma activa criteria-met**, no peligro físico. Mapearlo a peligro físico romperá KIP/OpenPlotter en silencio.

**v3 mapping correcto**:

```ts
// LEGACY paths con semántica ORIGINAL preservada:
environment.tide.vessel.groundingRisk =
  config.alarmEnabled && policy.alarmCriteriaMet && notification.state !== "snoozed";
  // (riesgo de ALARMA, no físico — comportamiento idéntico a pre-Rev477)

environment.tide.vessel.groundingStatus =
  renderPhysicalStateLegacyString(physics.state);
  // "RIESGO DE VARADA" | "SIN RIESGO" | "EN MOVIMIENTO" | "SONDA CONGELADA" | etc.

// NUEVO contrato V2:
environment.tide.vessel.groundingFSM = full GroundingState (con schemaVersion:2)
```

Equivalencia exacta debe documentarse y testearse antes de Rev477 (test: snapshot 10 escenarios pre-Rev477, comprobar que mapping produce strings idénticos post-Rev477).

### Tests obligatorios Rev477

```js
// C-04
test("Disabling alarm during danger: physics.state stays 'danger'");

// C-07 (Gemini's test)
test("Snooze during danger: physics.state='danger', notification.state='snoozed', audioActive=false");
test("Snooze expires: notification.state returns to 'active' if physics still 'danger'");

// C-03
test("Missing data: physics.state='unknown', not 'safe'");

// C-08 final
test("Moving boat in danger zone: physics.state stays 'danger'");

// Backward compat
test("Legacy path environment.tide.vessel.groundingRisk reflects physics.state==='danger'");
```

### Estimación

~10h código + 4h tests + 3h QA = **17h total**. (v1: 10h.)

---

## Rev478 — Sincronización + persistencia + schema version

**Bloqueantes que cierra**: C-12, C-15, C-16, C-17.

**Riesgo**: medio.

### Cambios

#### 1. Helper único `readValidatedPosition()` C-12

Usado en `evaluateAnchorWatch` Y `getAnchorWatchState`. Si timestamp >30s → null.

#### 2. Migración versionada del cache C-16

```ts
const CACHE_SCHEMA_VERSION = 2;
async function loadGroundingFromCache() {
  const cached = await ihmCache.get("groundingRisk");
  if (!cached) return null;
  if (cached._schemaVersion !== CACHE_SCHEMA_VERSION) {
    // migrar / descartar
    return migrateGroundingCache(cached);
  }
  return cached;
}
```

#### 3. SSE contract version C-17

```ts
{
  stateVersion: number;
  schemaVersion: number;
  serverInstanceId: string;
  generatedAt: ISO;
  serverTime: number;
  // ... resto del state
}
```

Frontend detecta `schemaVersion` incompatible → bloqueo visible "Plugin actualizado, recarga la página".

#### 4. Latch release explícito C-15

El latch de Rev475 solo se libera con 3 ticks consecutivos `safe` confirmados, no por timeout o lift.

### Tests obligatorios Rev478

```js
test("GPS stale: SSE sends boatPosition=null and gpsLost=true coherently");
test("Cache schema v1 migrated to v2 on load");
test("SSE schemaVersion mismatch detected by frontend");
test("Latch C-02 released only after 3 fresh-safe ticks, not by lift");
```

### Estimación

~5h código + 3h tests + 2h QA = **10h total**. (v1: 5h.)

---

## Rev479 — Frontend reescrito (REESTIMADO)

**Bloqueantes que cierra**: dependencias frontend de Rev475-478.

**Riesgo**: alto. 13k LOC mobile.html + React TidesView.

### Cambios

#### 1. Helper único frontend `_groundingDisplay(s.grounding)`

```ts
function _groundingDisplay(g) {
  return {
    color: g.physics.state === "danger" ? "red"
         : g.physics.state === "unknown" ? "amber" : "green",
    audioShouldPlay: g.notification.audioActive === true,  // del backend, no calculado
    ...
  };
}
```

#### 2. Eliminar TODOS los call sites antiguos

Auditoría grep + replace de:
- `s.groundingAlarm` (string) → `s.grounding.physics.state` o helper.
- `s.groundingActive` → `s.grounding.notification.audioActive`.
- `s.groundingRisk` / `.risk` (dead code) → eliminar.
- `al.groundingRisk.risk` (modal Cálculo Sonda) → usar helper.
- `d.groundingRisk` (línea 9417) → usar helper.

#### 3. Audio engine usa `notification.audioActive` directo

#### 4. Schema mismatch banner

Si `s.schemaVersion !== EXPECTED_VERSION_BY_FRONTEND` → mostrar banner rojo bloqueante "Recarga la página".

#### 5. "Unknown" se muestra como **ámbar** (no verde ni rojo)

### Tests obligatorios Rev479

```js
test("All 4 panels show same color simultaneously");
test("Schema mismatch shows blocking banner");
test("audio engine respects notification.audioActive (snooze)");
test("unknown state shows amber, not green");
```

### Estimación

~16h código + 4h tests + 4h QA = **24h total**. (v1: 8h — muy optimista.)

---

## Rev480 — Integración + QA final + candidato publish

**Bloqueantes que cierra**: regresión + integración.

**Riesgo**: bajo si las Revs anteriores hicieron sus tests bien.

### Cambios

1. **Suite integración** (`tests/integration_full.test.js`):
   - Restart con barco anclado.
   - Network drop scenarios.
   - Saltos de reloj sistema (cambio TZ, DST).
   - SK plugin disable/enable.

2. **QA real en barco** (lista completa):
   - Forzar sonda offline → confirmar latch mantiene alarma.
   - Forzar GPS offline → confirmar coherencia mapa + alarma.
   - Apagar alarma durante riesgo → confirmar physics persiste.
   - Snooze durante alarma → confirmar audio para y notif visual queda.
   - Mover barco con alarma activa → confirmar no se limpia.
   - Validar KIP/OpenPlotter externos siguen leyendo paths legacy.

3. **Candidato publish 2.3.0** si todo pasa + OK explícito usuario.

### Estimación

~4h código + 1 día QA barco = **12h total**.

---

## Resumen total v2

| Rev    | Horas est. (v2) | Riesgo | Bloqueantes resueltos |
|--------|-----------------|--------|----------------------|
| Rev475 | 15h             | Medio  | C-02, C-09, C-10, C-13, C-14p, C-21 |
| Rev476 | 19h             | Alto   | C-05, C-06, C-14c, C-01, C-19, C-20, C-23 |
| Rev477 | 17h             | Alto   | C-03, C-04, C-07, C-08, C-11, C-22 |
| Rev478 | 10h             | Medio  | C-12, C-15, C-16, C-17           |
| Rev479 | 24h             | Alto   | Frontend dependiente, C-18       |
| Rev480 | 12h             | Bajo   | Tests integración + publish      |
| **Total** | **~97h** | | **23 bloqueantes críticos** |

(v1 estimaba 41h. v2 = 97h. Sigue siendo conservadora.)

---

## Reglas durante el refactor (sin cambios)

1. **No publish a NPM** hasta Rev480 + QA aprobado.
2. **Cada Rev despliega y se QA antes** de empezar la siguiente.
3. **Tests escritos antes/junto al fix**, no al final (corregido v2).
4. **Bump Rev por cada cambio**, aunque sea pequeño.
5. **Hallazgo nuevo durante refactor** → `AUDIT_FINDINGS_CROSS_REVIEW.md`, no se cuela.
6. **Si una Rev rompe producción** → revertir inmediato.
7. **Backward compat SK paths legacy** durante toda la transición (Rev477-Rev480).
