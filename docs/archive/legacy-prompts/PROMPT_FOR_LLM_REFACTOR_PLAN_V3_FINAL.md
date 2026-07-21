# Prompt para GPT-5 / Gemini Pro — Validación FINAL del plan v3

## Contexto

Ronda 2 dejó:
- **Gemini**: GO.
- **GPT**: NO-GO con 6 correcciones bloqueantes + 6 blind spots.

He aplicado **las 6 correcciones de GPT** al plan v3 (`docs/REFACTOR_PLAN_Rev475_Rev480.md` actualizado) más añadido los 6 blind spots como nuevos hallazgos C-24..C-29 (`docs/AUDIT_FINDINGS_CROSS_REVIEW.md` actualizado).

Necesito **GO/NO-GO definitivo** antes de programar. Sin re-discusión del diagnóstico — ese está cerrado. Solo verificación de que v3 incorpora correctamente las correcciones.

## Lo que cambió de v2 a v3

| Corrección GPT (NO-GO ronda 2) | Aplicada en v3 |
|--------------------------------|----------------|
| **#1 Latch centralizado + persistido** | `SafetyLatch` interface con persistencia ihmCache, cubre 9 reasonCodes, liberación 3 ticks + 6s min, `restoreLatchOnBoot()` no restaura como danger fresco |
| **#2 Eliminar canonicalización parcial Rev475** | C-14 movido íntegro a Rev476. Rev475 NO toca depthHistory. |
| **#3 FSM: pérdida sensor = physics.unknown, NO physics.danger** | `physics.state = "unknown"` + `safetyLatch.active = true` + `notification.state = "latched"`. Distingue "lo que sé ahora" de "lo que pasó". |
| **#4 Mapping legacy correcto** | `legacy.groundingRisk = config.alarmEnabled && policy.alarmCriteriaMet && notification.state !== "snoozed"` (semántica original "alarma criteria-met"). NO `physics.state === "danger"`. |
| **#5 schemaVersion adelantado** | `schemaVersion: 1` desde Rev475 sin cambiar contrato. Rev477 sube a `2` simultáneo con FSM. |
| **#6 C-18 implementado** | 3 campos en `physics`: `currentPhysicalUnderKeelM`, `expectedMinPhysicalUnderKeelM`, `clearanceToEffectiveThresholdM`. |

Refinamientos adicionales en v3:
- `audioActive` → `audibleRequested` (backend solicita, no afirma).
- `notification.state` añade `"latched"` como nuevo estado.
- `dataHealth` enum ampliado: añade `"invalid"`, `"conflict"`.
- C-24..C-29 añadidos al audit como hallazgos nuevos.

## Lo que os pido AHORA (muy concreto, no re-abrir debates)

### Q1 — ¿Las 6 correcciones están bien aplicadas?
Para cada una, dictamen binario: ✅ aplicada correctamente, ⚠ aplicada con matices, ❌ mal aplicada.

### Q2 — ¿Hay alguna contradicción interna en v3?
Por ejemplo: ¿`safetyLatch` y `notification.state = "latched"` son redundantes o complementarios? ¿`audibleRequested` interactúa bien con el snooze? ¿Mapping legacy puede generar deltas SK falsos si schemaVersion=1 pero la lógica ya cambió?

### Q3 — Blind spots C-24..C-29: ¿están bien asignados a alguna Rev?
- C-24 (reloj monotónico): ¿Rev475? ¿Rev478?
- C-25 (frontend disconnect timeout): ¿Rev479?
- C-26 (lift/drop lock): ¿Rev478?
- C-27 (FS readonly): ¿Rev475 dentro del wrapper persistLatch?
- C-28 (SK payload shape audit): ¿Rev475? **¿Es prerequisito de TODO el resto?**
- C-29 (SSE deep clone): ¿Rev478?

### Q4 — GO / NO-GO definitivo

**Solo dos opciones**:
- ✅ **GO Rev475 v3** — el plan está listo, programar.
- ❌ **NO-GO Rev475 v3** — listad EXACTAMENTE los puntos remanentes que faltan corregir (sin re-debatir cosas ya cerradas).

Si dais GO con matices, separad claramente "hace falta antes de Rev475" vs "se puede hacer después".

## Output esperado

Markdown muy corto y directo. Q1: tabla 6 filas ✅/⚠/❌. Q2: lista de contradicciones (o "ninguna"). Q3: una recomendación por blind spot. Q4: una palabra GO o NO-GO + bullets si NO-GO.

**Máximo 800 palabras**. La auditoría de fondo ya está cerrada. Esto es solo "ready check" antes de empezar.

---

## Anexo: documentos completos

(Pegar:)
- `AUDIT_FINDINGS_CROSS_REVIEW.md` (con C-15..C-29)
- `REFACTOR_PLAN_Rev475_Rev480.md` v3

Gracias.
