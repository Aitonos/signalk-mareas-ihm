# SPRINTS — mapa histórico de trabajo por versión

Estado: **2026-07-21** — reescrito desde cero. El plan de sprints 1-6
original (mayo 2026, período B-01…B-22) está archivado en
[`archive/SPRINTS_Rev190_snapshot.md`](archive/SPRINTS_Rev190_snapshot.md).

**No hay sprints estructurados activos ahora.** Trabajamos por feature
request de Carlos + bug hunt reactivo. Este documento sirve como mapa
histórico de qué se hizo en cada release para orientar sesiones nuevas.

Para el trabajo pendiente ver [`BACKLOG.md`](BACKLOG.md).

---

## Timeline de releases (Rev / npm version)

| Release | Ventana Rev | Highlights |
|---|---|---|
| **v2.9.0** | Rev714 → Rev761 | Motor AIS online (aisstream + aishub + aisfriends) con dedupe simétrica y republish a `vessels.*`. Wizard "AIS por internet" con 3 tarjetas. Cache HTML busting agresivo. Auto-lift al arrancar motor (Rev751). Feedback modal con estilo nativo + botón "Copiar diagnóstico" integrado. |
| **v2.8.0** | Rev720 → Rev722 | Interop canonical SK `navigation.anchor.*` + notifications espejadas + `method:["push"]` WilhelmSK. Crédito @jeyrb. |
| **v2.7.0** | Rev710 → Rev719 | Sensor check wizard con 16 tiles, NEAPS LAT datum 365d, popup permisos paths SK, botón feedback. Renumerado desde 2.6.1 tras confusión SemVer. |
| **v2.6.0** | Rev690 → Rev713 | Sprint J — wizard instalador completo (locale UTF-8, IMU probe, mareas/meteo, mbtiles, PIN master). Worldwide tides. |
| **v2.5.x** | Rev660 → Rev689 | Sprint I quick wins (fallback IHM stations, Windy multi-fuente, debug 1-botón, req. mínimos). Sprint K polish fondeo/sonda. Sprint H wave estimation en navegación (Rev660+). |
| **v2.4.x y anteriores** | Rev190 → Rev659 | Sprints 1-6 originales del snapshot Rev190: backend SoT, multi-device sync (mute/snooze/AIS ACK/lift cross-device), meteo transpose fix, Cálc Fondeo, i18n exhaustivo, Push (sustituido por Telegram bot), Instrucciones expandidas. Todos completados y validados por Carlos. |

Para el detalle de qué Rev introdujo qué, ver `git log` y `CHANGELOG.md`.

---

## Snapshots de sprints ejecutados (viven en memoria persistente)

Los sprints "temáticos" I / J / K se planificaron y ejecutaron entre
v2.5.x y v2.9.0. Sus decisiones arquitectónicas viven en las memorias
persistentes:

| Sprint | Memoria | Estado |
|---|---|---|
| Sprint H — wave estimation navegación (IMU spectral) | `project_wave_navigation_plan.md` | ✅ Ejecutado en v2.5+ (motor `wave.nav.*` operativo). |
| Sprint I — quick wins v2.5.x | `project_sprint_i_quick_wins.md` | ✅ Ejecutado en v2.5.x. |
| Sprint J — wizard instalador completo | `project_sprint_j_wizard_installer.md` | ✅ Ejecutado en v2.6.0 (Rev690+). Wizard mandatorio primer install. |
| Sprint K — UX polish fondeo/sonda + control usuarios | `project_sprint_k_polish.md` | ✅ Mayoritariamente ejecutado (control usuarios PIN, log multi-usuario, etc.). |

---

## Reglas de ejecución vigentes

Estas reglas siguen aplicando aunque no haya estructura de sprints:

1. **Una cosa por commit**. Si un commit toca dos features, partirlo.
2. **QA verificable** por cada commit — abrir el navegador y probar
   antes de marcar ✓. Ver [`RULES.md`](RULES.md).
3. **Bump `PLUGIN_REVISION`** en cada build (memoria
   `feedback_revision_bump_each_build`).
4. **`.\deploy.ps1 -Restart`** al final de cada commit que toque
   `src/` (memoria `feedback_always_restart_deploy`).
5. **QA con "QA Rev<N>"** cuando pases guiones al usuario (memoria
   `feedback_qa_always_state_version`).
6. NPM publish: SOLO cuando Carlos lo pida explícitamente (memoria
   `feedback_never_publish_without_explicit_ok`) y con pre-publish
   checklist (memoria `feedback_prepublish_checklist`).
7. Publish = NPM Y GitHub siempre (memoria `feedback_publish_npm_and_github`).
