# Backlog técnico — cambios de CÓDIGO derivados de la revisión externa

> Generado tras la revisión profesional recibida el 2026-06-20. Aquí se recogen únicamente
> las correcciones que requieren modificar el código, NO el manual de usuario.
>
> Las correcciones puramente editoriales se aplican en `INSTRUCCIONES_MODAL_v3.html`.

## Pendientes que requieren decisión de producto

| ID | Asunto | Estado actual | Propuesta revisión | Decisión |
|---|---|---|---|---|
| FONDEO-01 | Auto-desarme por SOG | Activo por defecto, umbral 3 kt × 30 s. | Hacerlo opt-in (desactivado por defecto) o exigir confirmación adicional. | Pendiente |
| FONDEO-02 | Fallback a Vigo sin GPS | Selecciona Vigo silenciosamente si no hay GPS dentro del radio. | Mostrar "sin estación validada" y exigir selección manual en lugar de fallback silencioso. | Pendiente |
| FONDEO-03 | Mareas sintéticas pueden alimentar alarma de varada | Si el usuario selecciona Mediterráneo M2 o "Sin marea" en MANUAL, la alarma de varada usa esa curva. | Bloquear que estaciones sintéticas (`mediterraneo`, `sin-marea`, `openmeteo-global`) alimenten la alarma de varada. Si están activas, deshabilitar la alarma con aviso visible. | Pendiente |
| FONDEO-04 | Open-Meteo "rebajado al cero del puerto" | El código aplica un offset para alinear con bajamar semanal y lo presenta como compatible con IHM. | No nombrarlo "Cero Hidrográfico". Etiquetar el datum real (MSL ajustado a bajamar semanal). Considerar deshabilitar para alarma de varada o exigir calibración local. | Pendiente |
| FONDEO-05 | AIS sin CPA/TCPA | El módulo detecta proximidad geométrica (distancia al ancla < radio rojo + eslora del target). No hay CPA ni TCPA reales. | Renombrar internamente paths SK de `aisAlarm*` a `aisProximity*` (no urgente). Considerar añadir CPA/TCPA en sprint futuro. | Pendiente |

## Verificaciones técnicas pendientes (cuando haya tiempo)

| ID | Asunto | Acción |
|---|---|---|
| VAL-01 | Geometría rojo vs garreo | Confirmar si la comparación `dist > alarmRadius` con `dist = ancla→GPS_proa` y `alarmRadius = rBow+LOA+extra` es la intención correcta. El umbral efectivo de garreo permite que la proa derive `LOA+extra` más allá del catenario máximo — generoso pero defendible. Documentar la elección. |
| VAL-02 | Comportamiento de la cache fantasma AIS | Confirmar si la cache de 5 minutos extrapola posición o solo muestra la última conocida, y si el frontend marca claramente la antigüedad. |
| VAL-03 | Datum del transductor de sonda | El código suma `draft` cuando lee `depth.belowKeel` o `depth.belowTransducer`. Verificar que el offset de transductor del usuario está bien tomado en cuenta. |

## Lo que la revisión externa propuso pero NO procede

| Asunto | Por qué se descarta |
|---|---|
| Doble cómputo de LOA en azul/rojo | El código no duplica LOA. Está incluida una sola vez en `radiusTotal = rBow + LOA`. El rojo solo añade `alarmRadiusExtra`. |
| Sonda congelada solo por igualdad numérica | El código usa `TTL_DEPTH_FRESH_MS = 5000` (timestamps) + `isDepthReliable()` (frozen ±2cm/60s, spike, absurd). La detección es multifactor. |
| "Catenaria" — el código no usa peso lineal | Correcto, no es modelo físico de catenaria. En el manual lo renombramos a "cálculo geométrico de fondeo" / "modelo de scope náutico". |
