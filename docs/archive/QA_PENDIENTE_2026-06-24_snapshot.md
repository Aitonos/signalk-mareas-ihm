# QA_PENDIENTE.md

Estado a fecha 2026-06-24. Carlos confirmó que los bloqueantes NPM 2.3.x del
CLAUDE.md ya están superados (banner desconexión, lift/drop concurrente,
alarma OFF preserva physics, safety latch sonda).

Este documento lista lo que QUEDA por validar en puerto/agua antes de
considerar 2.3.2+ listo para `npm publish`.

---

## 🐛 Bugs pendientes (a corregir antes de QA)

### B-23 — Alarma ancla salta al motorizar saliendo
- **Síntoma**: al levantar ancla y motorizar fuera del fondeadero, la
  vigilancia de garreo dispara alarma falsa porque la distancia al ancla
  crece rápidamente.
- **Fix propuesto**: a >3 kn SOG sostenidos durante >N segundos, asumir
  salida intencional y auto-desarmar `anchorWatch.enabled` (o silenciar la
  alarma sin desarmar el sistema).
- **Memoria**: `project_bug_anchor_alarm_motoring`.

### B-25 — Bottom-bar widgets: ajustes del usuario se pisan en cada deploy/restart
- **Síntoma** (reportado Carlos 2026-06-24): después de cada `.\deploy.ps1
  -Restart`, las celdas activas y el orden del bottom-bar vuelven a los
  defaults, pisando lo que Carlos había configurado.
- **Fix esperado**:
  - Defaults nuevos: lo que Carlos tiene actualmente activo + en el orden
    actual debe pasar a ser el default del plugin (snapshot).
  - Lo que el usuario seleccione/reordene debe persistir en cache/storage
    y sobrevivir restarts y deploys.
- **Investigar**: dónde se guardan los settings del bottom-bar (probable
  `ihmCache` o plugin options), y por qué se sobrescriben.

### B-26 — Botón "Versiones" del modal Instrucciones está vinculado a texto huérfano
- **Síntoma** (reportado Carlos 2026-06-24): dentro del modal Instrucciones
  (iframe TidesView) hay un botón "Versiones" / "Changelog" cuyo contenido
  está hardcoded en TidesView y solo llega a v2.2.0. Los releases 2.3.x
  no se reflejan ahí.
- **Fix esperado**: vincular ese botón a un texto NUEVO actualizado que
  viva en el plugin actual y NO en TidesView, para que cada release lo
  arrastre.
- **Pendiente investigar**: cómo TidesView resuelve el contenido del
  botón Versiones (URL parametrizable? texto hardcoded en el bundle?
  ¿podemos cambiar la fuente sin tocar TidesView?). Si TidesView necesita
  ser tocado, anotar en su repo aparte.

### B-24 — Bottom-bar widget viento lleva lag respecto a las flechas
- **Síntoma**: el valor numérico del viento en la bottom-bar se actualiza
  más tarde que las flechas/vectores del mapa.
- **Investigar**: fuente de datos del widget vs fuente de las flechas; ver
  si se lee del SSE consolidado o de path SK independiente.

---

## ⚙️ Mejoras pendientes (HACER)

### M-01 — Smoothing filter sonda
- Las medidas crudas de la sonda oscilan ~30cm entre lecturas → ruido visual
  en `belowKeel` y disparos espurios de FSM grounding.
- **Fix**: filtro IIR (EMA) o media móvil en el backend, antes de publicar
  `environment.depth.belowKeel` al SSE.
- Tunable: time constant ~3-5s, configurable en ajustes avanzados.

### M-03 — CHANGELOG dentro del modal Instrucciones sin perder el CSS de TidesView
- El manual del modal carga vía iframe el componente externo **TidesView**.
  El CSS y la maquetación están bien, pero el CHANGELOG dentro de TidesView
  queda **huérfano**: se desfasa entre publishes porque vive en otro repo.
- Intento Rev518 (sustituir iframe por HTML local) rompió el CSS visual →
  revertido en Rev519.
- **Fix sin romper CSS**: opciones a evaluar:
  1. Publicar CHANGELOG.md desde el plugin y usar `postMessage` desde el
     iframe TidesView para que se auto-actualice.
  2. Mostrar el CHANGELOG en un panel **paralelo** dentro del mismo modal
     (debajo o tab adyacente al iframe).
  3. Cambiar TidesView para que lea CHANGELOG.md del plugin que está
     corriendo (modificación en el repo externo de TidesView).
- Prioridad: media. No bloquea publish 2.3.2.

### M-02 — Configurator wizard mandatorio primer install
- En el primer arranque (sin config previa), modal bloqueante que obliga a:
  1. Elegir referencia de sonda: `belowKeel` vs `belowTransducer`.
  2. Calado del barco + margen de seguridad.
  3. ¿Otros parámetros críticos? (Carlos confirmar.)
- Cada paso queda "tickeable" — los configurables aparecen en
  `menú hamburguesa → Configuración inicial` con su tick verde cuando OK.
- Renombrar el menú actual **`Configuración` → `AJUSTES`**.
- El submenú `Configuración inicial` queda visible siempre como referencia
  rápida del estado del setup.

---

## ✅ QA visual a validar en uso real (cambios Rev503-Rev515 sin commitear)

Cambios de UI no commiteados desde `9a1ad26` (Rev493-502). Carlos ya validó
algunos verbalmente; los demás están en agua de prueba pendiente.

| Rev | Cambio | Estado QA |
|---|---|---|
| 503 | Jerarquía UI unificada (feedback navegante amigo) | ⬜ pendiente |
| 504 | Ajuste headers idénticos | ⬜ pendiente |
| 505 | Cache-bust serverInstanceId + `.m-modal-hdr` unificación + `#ais-pop-title` fix | ⬜ pendiente |
| 506 | `:not(.m-back)` en reglas `#fondeo/score/legend-pop button` | ⬜ pendiente |
| 507 | Eliminado override CSS sub-modales shelter | ⬜ pendiente |
| 508 | Limpieza inline styles HTML sub-modales | ⬜ pendiente |
| 509 | Sub-modales shelter movidos fuera de `#shelter-pop` (zoom anidado) | ✅ **OK** ("Hombre por fin") |
| 510 | Restaurar header `.m-back`/`.m-title` en `#panel` y `#ais-alarm-panel` | ⬜ pendiente — Cartas estaba OK pero AIS necesitaba más |
| 511 | Herencia `.m-title *` forzada (fix span dentro de h4) | ⬜ pendiente |
| 514 | Zoom `var(--ui-scale)` al `.m-modal-hdr` del `#ais-alarm-panel` | ⬜ pendiente confirmar |
| 515 | Quitada flecha huerfana `▼` del header AIS | ⬜ pendiente confirmar |

### Pendiente DB AIS
- Tras los restarts de hoy, la DB de nombres tardó en repoblarse (cada
  barco retransmite Type 5 cada ~6 min). Verificar en próxima sesión que
  la DB persiste correctamente entre restarts y no se está corrompiendo.

---

## 🌊 Funcionalidad nueva — QA cuando se implemente

### Sprint H — Wave estimation espectral en navegación
- Estado: planificado, no arrancado.
- Plan validado con GPT+Gemini (memoria `project_wave_navigation_plan`).
- QA: validar en puerto las estimaciones de Hs/Tp/dirección con el barco
  amarrado (líneas tensas → wave residual debería ser bajo, ruido IMU
  controlado). Después validar en navegación con mar conocido.

---

## Notas

- Cada commit debe ser **una cosa testable individualmente** (R3).
- "Como en RevN" significa exacto, no aproximado (R7).
- Mantener invariantes de CLAUDE.md: backend = SoT, mobile.html única,
  tema dark, predictive swing ring ON, sin emojis en chat, etc.
