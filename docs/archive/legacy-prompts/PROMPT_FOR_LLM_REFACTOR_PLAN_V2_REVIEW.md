# Prompt para GPT-5 / Gemini Pro — Revisión del PLAN V2 (post incorporación de feedback)

## Contexto

He incorporado vuestro feedback de la revisión del plan v1 al plan v2 (`docs/REFACTOR_PLAN_Rev475_Rev480.md` actualizado). Antes de tocar código, **última verificación**.

## Cambios aplicados v1 → v2

| Cambio | Aportado por |
|--------|--------------|
| C-02 movido de Rev477 a Rev475 (latch quirúrgico) | GPT+Gemini |
| C-14 movido de Rev476 a Rev475 (junto a normalización history) | Gemini |
| C-01 movido de Rev475 a Rev476 (después de canonicalizar) | GPT |
| C-13 movido de Rev478 a Rev475 (concurrency antes que FSM) | GPT |
| C-08 movido de Rev477 a Rev476 (pertenece al pipeline datos) | GPT |
| Tests en cada Rev, no solo Rev480 | GPT |
| Single-flight (no generation counter) en Rev475 | GPT |
| Backward compat SK paths legacy durante transición | Gemini |
| Hallazgos nuevos C-15..C-23 añadidos al audit | Ambos |
| Rev479 reestimada 8h → 24h (call sites destapados) | Gemini |
| Rev476 reestimada 8h → 19h (regresiones colaterales) | Gemini |
| Total 41h → 97h | Ambos |

## Lo que os pido revisar AHORA

### Q1 — ¿Vuestro feedback se aplicó correctamente?
Para cada uno de los 11 cambios de la tabla, confirmad si está bien incorporado o necesita ajuste. Mirad especialmente:
- Single-flight Rev475 (sección "Single-flight evaluator C-13"). ¿Es correcto el patrón?
- Latch C-02 Rev475 (sección "Hot-fix latch C-02"). ¿Cubre todos los branches problemáticos?
- Tests de cada Rev. ¿Cubren los failure modes prioritarios?

### Q2 — ¿v2 introduce NUEVOS errores?
A veces incorporar correcciones genera nuevas inconsistencias. ¿Detectáis algún conflicto interno en v2? Especialmente:
- ¿Hay solapamiento entre Rev475 latch y Rev477 FSM? (¿Cómo migra el latch interim al estado nativo?)
- ¿Backward compat de SK paths (C-22) en Rev477 puede colisionar con el schema v2 de Rev478?
- ¿La normalización parcial de history en Rev475 (sin belowTransducer) puede romper algo que sí funcionaba antes?

### Q3 — Blind spots restantes
A pesar de dos rondas de revisión, ¿qué categorías de bug NO hemos cubierto todavía? Pensad en:
- Reloj del sistema (timezone changes, DST, NTP jumps).
- Memoria persistente del Pi (SD card corruption, FS readonly).
- Race conditions FUERA del evaluator (e.g. SSE write + state mutation).
- Casos donde el usuario edita config mientras hay alarma activa.
- Casos donde dos visores hacen ACK / lift / drop simultáneo.
- Versión SK incompatible (cambia formato de un path entre v1.x y v2.x).

### Q4 — Estimaciones v2
v1=41h, v2=97h. ¿Sigue siendo optimista o pasáis a "razonable"? Si es alto:
- ¿Qué Rev tiene aún más holgura oculta?
- ¿Hay algún paso del plan que se puede paralelizar (e.g. tests de Rev476 mientras se programa Rev475)?

### Q5 — Criterios de "DONE" por Rev
Cada Rev necesita criterios objetivos para considerarla cerrada. Proponed los 5 criterios mínimos de DONE para cada una:
- Rev475 DONE: ¿cuándo?
- Rev476 DONE: ¿cuándo?
- ...

### Q6 — Roll-back plan
Si una Rev sale a producción y rompe algo crítico, ¿cuál es el rollback más rápido?
- ¿Reverse cherry-pick?
- ¿Tag SK App Store anterior?
- ¿Feature flag?

### Q7 — Comunicación con el usuario
El usuario está convaleciente, no puede ir al barco. Algunos cambios requieren validación con datos reales (Rev476 regresión predictiveSwing, Rev479 paneles UI). ¿Cómo le pedís que valide sin barco?
- ¿Mocks / simuladores? ¿Vale la pena construirlos?
- ¿Logs de comparación que puede revisar visualmente?
- ¿Esperar a su vuelta al barco para esas Revs específicas?

## Output esperado

Markdown estructurado con Q1-Q7. Si veis algo que sigue mal aunque incorporé vuestro feedback, decidlo CLARAMENTE. Si está OK, decidlo también — necesito una luz verde explícita antes de tocar código.

Si en algún punto pensáis "esto se puede ya programar", decid GO. Si pensáis "esto necesita aún otra ronda", decid NO-GO.

---

## Anexo: documentos completos

(Pegar aquí íntegros:)
- `AUDIT_FINDINGS_CROSS_REVIEW.md` (con C-15..C-23 añadidos)
- `REFACTOR_PLAN_Rev475_Rev480.md` v2

Gracias.
