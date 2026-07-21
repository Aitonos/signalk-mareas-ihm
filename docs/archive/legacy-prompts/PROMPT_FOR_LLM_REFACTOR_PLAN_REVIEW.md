# Prompt para GPT-5 / Gemini Pro — Revisión cruzada del PLAN DE REFACTOR Rev475-Rev480

## Contexto

Vuestra revisión previa de Rev474 (cross-review GPT+Gemini) detectó 14 bugs críticos de seguridad. Ahora tengo un plan de 6 Revs para corregirlos sin acumular cambios estructurales. **Antes de tocar código, quiero vuestra revisión del plan**.

Documentos relevantes (pegados abajo o disponibles en el repo):
- `docs/AUDIT_FINDINGS_CROSS_REVIEW.md` — los 14 hallazgos críticos consolidados.
- `docs/REFACTOR_PLAN_Rev475_Rev480.md` — el plan completo a revisar.

## Lo que os pido revisar

### Q1 — Orden de las Revs
El plan propone:

| Rev    | Resuelve críticos |
|--------|------------------|
| Rev475 | C-01 (congelación inalcanzable), C-09 (timestamps), C-10 (validación inputs) |
| Rev476 | C-05 (`_readDepthValidated` mal calcula belowTransducer), C-06 (fallback transducerToKeel=0), C-14 (history mixto frames) |
| Rev477 | C-03 (ausencia datos=safe), C-04 (apagar alarma borra física), C-07 (snooze+groundingActive incompatibles), C-08 ("en movimiento"=safe), C-11 (contrato groundingAlarm erróneo) |
| Rev478 | C-12 (posición sin validar timestamp), C-13 (race condition evaluator) |
| Rev479 | Frontend reescrito sobre nuevo contrato |
| Rev480 | Tests unitarios + QA real + candidato publish 2.3.0 |

**Preguntas**:
- ¿Hay dependencias mal puestas? (¿Rev477 requiere algo de Rev478 o viceversa?)
- ¿Algún crítico debería resolverse ANTES por más peligroso? (mi candidato más peligroso para empezar es C-02 "perder sonda limpia alarma activa" — está implícito en C-03/C-04/C-08 que se resuelven en Rev477, pero tarda 3 Revs en llegar).
- ¿Vale la pena un hot-fix muy quirúrgico de C-02 en Rev475 antes del refactor estructural? (vivir con bandera de "no limpiar notif si physicalRisk era true en tick anterior" mientras se prepara Rev477).

### Q2 — Cobertura de los hallazgos
¿Hay algún crítico de vuestra lista que NO está claramente asignado a una Rev? Si veis alguno huérfano, decidlo.

### Q3 — Tests propuestos para Rev480
Estos son los tests críticos propuestos (`tests/grounding.test.js`):
- `readCanonicalDepth` con cada combinación SK (solo belowKeel / solo belowSurface / solo belowTransducer con/sin transducerToKeel).
- Detector congelación con sample rate variable (1Hz, 0.5Hz, 0.2Hz).
- Transición `danger + sensor_lost` → `danger-data-lost` (NO `safe`).
- Validación inputs: -999, NaN, "false", overflow.
- Serialización evaluator con concurrent calls.
- SSE contract: no enviar `boatPosition` válida si `gpsLost: true`.

¿Faltan tests para failure modes que detectasteis pero no están cubiertos? ¿Qué tests añadiríais para C-07 (snooze) y C-08 (en movimiento)?

### Q4 — Refactor a Physics/Config/Notification (Rev477)
Propongo este contrato:

```ts
interface GroundingState {
  physics: {
    state: "safe" | "danger" | "unknown";
    depthBelowSurfaceM: number | null;
    expectedMinDepthM: number | null;
    keelClearanceM: number | null;
    nextLowTimeIso: string | null;
    dataHealth: "fresh" | "stale" | "missing" | "degraded";
    operationalMode: "anchored" | "moving" | "unknown";
  };
  config: {
    alarmEnabled: boolean;
    safetyMarginM: number;
    minutesBefore: number;
  };
  notification: {
    state: "normal" | "active" | "snoozed";
    snoozedUntilMs: number | null;
  };
}
```

¿Es robusto? ¿Falta algún estado? ¿Algo redundante? ¿Cómo lo refinaríais antes de implementarlo?

### Q5 — Riesgos del plan no contemplados
- **Backwards compatibility**: el SSE mantiene `groundingAlarm`/`groundingStatus` legacy durante transición. ¿Hay riesgo de que otros consumidores SK (KIP, OpenPlotter) se confundan con dos APIs paralelas?
- **QA imposible sin barco**: el usuario está convaleciente. ¿Algunos cambios estructurales se pueden testar bien en seco (mocks)? ¿Cuáles requieren obligatoriamente barco real para validar?
- **Riesgo de regresión**: ¿qué partes funcionan bien hoy (garreo, predictive swing, AIS) que el refactor podría romper sin querer?

### Q6 — Estimaciones
| Rev | Estimación | ¿Realista? |
|-----|-----------|------------|
| 475 | 6h | |
| 476 | 8h | |
| 477 | 10h | |
| 478 | 5h | |
| 479 | 8h | |
| 480 | 4h + QA barco | |

Si son optimistas, decidlo (mi experiencia es que suelo subestimar refactors estructurales).

### Q7 — Alternativa más quirúrgica
Si en lugar de Rev475-480 hicieras solo **hot-fixes mínimos** (Rev475 hot-fix de los 3-4 más peligrosos con bandera + deuda técnica), ¿cuáles serían los hot-fixes mínimos y cuáles posponer al refactor estructural?

## Output esperado

Markdown estructurado con secciones Q1-Q7. Ejemplos de código cuando aplique. Si véis hallazgos NUEVOS que se nos hayan escapado (de la cross-review previa o de este plan), añadidlos al final como "Nuevos hallazgos".

---

## Anexo: Documentos completos

(Pegar aquí el contenido íntegro de `AUDIT_FINDINGS_CROSS_REVIEW.md` y `REFACTOR_PLAN_Rev475_Rev480.md` antes de mandar.)

Gracias.
