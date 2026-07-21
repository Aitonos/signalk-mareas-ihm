# Estado Rev486 — punto estable post QA real en barco

> **Fecha**: 2026-06-22
> **Status**: ESTABLE en barco Tunatunes (validado en agua, fondeo real con riesgo de varada activo)
> **NPM**: bloqueado — no publicar sin más sesiones de QA acumuladas

## Resumen ejecutivo

Tras un refactor de seguridad ambicioso (Rev475-483) que introdujo regresiones graves al desplegar en barco, se hizo rollback parcial vía hotfixes Rev484-486 que devolvieron coherencia a la UI sin desmontar la arquitectura nueva del backend (FSM Physics/Config/Notification).

## Qué funciona AHORA

### Backend (`src/index.ts`)
- FSM grounding con 4 dimensiones: `physics`, `config`, `notification`, `safetyLatch` (expuesta en `state.grounding`).
- Snooze grounding aplicable vía `POST /api/anchor-watch/silence-alarm {kind:"grounding"}`.
- `groundingActive` legacy ahora respeta `_isGroundingSilenced()` → suprime sirena visor durante snooze.
- `groundingStatus` legacy se sintetiza desde `_currentGroundingRisk` cuando SK no publica el path (fallback "RIESGO DE VARADA"/"NO RISK"/"ALARMA OFF"/"RIESGO DE VARADA (LATCH)").
- `groundingSilencedUntil` expuesto en state para que el visor sincronice countdown.
- `cancel-silence {kind:"all"}` cancela AIS + garreo + grounding.
- Schema bump `SSE_SCHEMA_VERSION=2`, `serverInstanceId` único por boot, `gpsAgeMs` expuesto, `_readValidatedPosition` con timestamp <60s.
- Single-flight lock para drop/lift/toggle (10s recovery).
- Cache migration al cargar `groundingRisk` antiguo.
- `_safetyLatch` persistido cross-restart (Rev475 C-02).
- Tests integración `tests/*_v47[5-8].test.js` (37 tests passing al deployed cuando el state es coherente).

### Frontend (`public/mobile.html`)
- Helper `_groundingDisplay(s)` unificado: lee FSM V2 con fallback a legacy. `isRisk` acepta tanto `physics.state==="danger"` como `groundingDetail.physicalRisk===true` o `groundingActive===true` (cubre divergencias).
- Bottom-bar SONDA muestra `⚠ RIESGO DE VARADA` en rojo cuando hay riesgo físico.
- Botón ⚓ sidebar + ⚓ del mapa Leaflet hacen glow rojo pulsante (animación `m-grounding-glow` + `m-grounding-icon-pulse`).
- Snooze 😴 del bottom-bar silencia AIS + grounding (garreo intocable por safety).
- Countdown del snooze sincronizado desde `MAX(aisSilencedUntil, groundingSilencedUntil)`.
- Cancel snooze usa `kind:"all"` → garantía de cancelación aunque `_activeAlarms` esté en false.
- Banner overlay para detect schemaVersion mismatch + server restart (auto-reload).
- Watchdog `_ihmWatchdogTick` cada 2s; banner desconexión sólo si plugin offline >15s (PENDIENTE validar en barco con plugin realmente parado).

## QA validado en barco (Tunatunes, 2026-06-22)

| Test | Resultado |
|---|---|
| Bottom-bar muestra "RIESGO DE VARADA" en rojo | ✅ |
| Icono ⚓ glow rojo (sidebar + mapa) | ✅ |
| Snooze 😴 calla sirena de grounding | ✅ |
| Snooze muestra countdown (queda 4m 59s, etc.) | ✅ |
| Cancel snooze (pulsar 😴 otra vez) revierte y vuelve sirena instantáneamente | ✅ |
| Backend cancel kind=all limpia aisSilencedUntil + groundingSilencedUntil | ✅ |
| Modal Cálculo Sonda muestra cifras coherentes con bottom-bar | ✅ |

## QA pendiente (sin validar en barco real)

- Banner desconexión cuando plugin offline >15s desde SK admin.
- Banner restart auto-reload tras cambio de `serverInstanceId`.
- Lift/drop/toggle concurrente (lock devuelve 409).
- Endpoint `/api/alarma/off` preserva `groundingRisk.depthNow`.
- Comportamiento del FSM al recuperar sonda tras congelación (safety latch release).

## Bloqueantes del refactor original (Rev475-483) — estado

De los 29 hallazgos críticos C-01..C-29 identificados:

- **Cerrados en código + validados en barco**: C-04 (apagar alarma preserva physics), C-07 (snooze cancela audible), C-11 (contrato grounding objetivado), C-22 (legacy paths preservados).
- **Cerrados en código sin validar barco**: C-01..C-03, C-05..C-10, C-12..C-21, C-23, C-24, C-26..C-29.
- **Pendientes**: C-25 (frontend reescrito completo). Aparcado tras decisión usuario "no más refactor por hoy".

## Decisiones tomadas

- **No hacer rollback total a Rev419** (commit base): habría perdido ~55 revisiones de trabajo Rev420-474 que estaban sin commit.
- **No hacer rollback quirúrgico del refactor**: demasiado laborioso (4500 líneas dispersas, 30 edits, sin commits intermedios para revertir limpio).
- **Sí hacer hotfixes Rev484-486**: tapar agujeros del refactor con cambios mínimos validables uno a uno.
- **No publicar npm 2.3.0**: la regla `feedback_never_publish_without_explicit_ok` aplica; falta más QA acumulado real, no solo lo del 2026-06-22.

## Próximos pasos sugeridos

1. **Cementar Rev486** con git commit (este commit).
2. **Dejar reposar** en barco al menos 1-2 sesiones reales de fondeo más para confirmar estabilidad.
3. Decidir entonces:
   - a) Publicar 2.3.0 si todo OK acumulado (con OK explícito del usuario).
   - b) Continuar fix-por-fix de los QA pendientes (banner desconexión, etc.) uno por vez con QA real entre cada uno.
   - c) Aparcar definitivamente el refactor restante y esperar siguiente sprint.

## Lecciones aprendidas

- **Refactor de 29 bloques en 9 rev consecutivas SIN QA real intermedio = receta de regresión**. El plan original (Rev475-480) tenía 1 sola validación de barco al final (Rev480). Resultado: cuando se validó, había docenas de regresiones interdependientes imposibles de aislar.
- **El backend FSM era teóricamente correcto pero el frontend antiguo seguía leyendo `s.groundingAlarm` (string legacy)**. La divergencia entre `physics.state="unknown"` (FSM conservador, requiere fresh data) y `groundingAlarm=""` (vacío porque SK no publica path cuando latch activo) dejaba la UI sin info.
- **El helper `_groundingDisplay` inicial era demasiado estricto** (`isRisk: ps==="danger"`). Hubo que aflojarlo para aceptar legacy `physicalRisk:true` también — sin esto, todo el visor perdía el indicador visual aunque la sirena sonara.
- **Validar siempre cada cambio en barco real ANTES de añadir el siguiente** — la regla `feedback_audit_before_action` y `feedback_3_strikes_then_gemini` no se respetaron por presión de cerrar 29 hallazgos en una tanda.
