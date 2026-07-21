# CLAUDE.md — instrucciones para asistente AI

> **Estado 2026-07-21 — Rev761 / v2.9.0**
>
> QA pendiente en agua real (validar antes del próximo publish):
>  - Auto-lift al arrancar motor (Rev751): `propulsion.<name>.state`.
>  - Motor AIS online triple (aisstream + aishub + aisfriends): badges
>    VHF/AS/AH/AF, republish a `vessels.*`, dedupe simétrica.
>  - Smoothing filter sonda (~30 cm de oscilación).
>  - Cualquier "retal" listado en `docs/QA_PENDIENTE.md`.
>
> Resueltos recientemente:
>  - ✅ Alarma ancla al motorizar saliendo (auto-lift Rev751).
>  - ✅ Widget viento lag (2026-07-21).
>  - ✅ Ghost grounding alarm al boot (warmup 20 s + stability 15 s +
>       depth-quality guard).
>  - ✅ Configurator wizard mandatorio primer install (Rev714+).
>  - ✅ Cache HTML Firefox agresivo (safety-net JS Rev761).
>  - ✅ Slider AIS máx 100 km + bbox online 1° (Rev757).
>
> No proponer `npm publish` por iniciativa propia, y NO heredar
> autorización de sesiones anteriores: cada publish requiere OK
> explícito tras el cambio.

**LEE PRIMERO `docs/RULES.md`, `docs/Q_AND_A.md`, `docs/KNOWN_BUGS.md`
y `docs/BOOTSTRAP_PROMPT.md`** antes de tocar nada.

## Quick context

- Plugin SignalK para barco **Tunatunes** (autor Aitonos, NPM `signalk-mareas-ihm`).
- Funcionalidades: mareas IHM/NEAPS/Open-Meteo, fondeo con vigilancia
  garreo, AIS anti-colisión (VHF + 3 motores online aisstream/aishub/aisfriends),
  abrigo, meteo, sonda, wave estimation IMU, log multi-usuario, wizard
  configurator completo, PIN master + invitados.
- **Rev actual**: `Rev761` (en `src/index.ts` const `PLUGIN_REVISION`).
- **Versión paquete**: `2.9.0` (`package.json`).

## Features nuevas 2.7.0 → 2.9.0 (última tanda)
- **2.9.0** (Rev714 → Rev761): motor AIS online **triple** — aisstream.io
  (WS real-time) + aishub.net (peer 1/min) + aisfriends.com (peer 1/min
  con Bearer). Dedupe simétrica VHF ▶ aisstream ▶ aishub/aisfriends,
  republish a `vessels.urn:mrn:imo:mmsi:*`, badge fuente en listado
  (VHF/AS/AH/AF). Auto-lift al arrancar motor (Rev751). Cache HTML
  bust agresivo (safety-net JS Rev761). Feedback modal con estilo
  nativo + "Copiar diagnóstico" integrado. Bbox online reducido a 1°
  para no saturar visor. Log de fondeos multi-user, shy tide provider,
  widgets cadena+temp agua, GPS glitch filter, test alarms endpoint.
- **2.8.0**: interop canonical SK `navigation.anchor.*` + notifications
  espejadas + `method:["push"]` WilhelmSK.
- **2.7.0**: sensor check wizard con 16 tiles, NEAPS LAT datum 365 d,
  popup permisos paths SK.

## Workflow

- Edits y build en **portátil Windows 11** (PowerShell + rsync via
  msys64).
- Deploy a **Pi Tunatunes** con `.\deploy.ps1 -Restart` (build + rsync
  + `sudo systemctl restart signalk`).
- Pi corre OpenPlotter V4 con SignalK. Plugin en
  `/home/pi/signalk-mareas-ihm` con symlink a
  `~/.signalk/node_modules/`.
- URL local visor: `http://localhost:3000/signalk-mareas-ihm/visorfondeo`

## Documentación canónica (LEE ANTES DE TOCAR)

| Archivo | Propósito |
|---|---|
| [docs/RULES.md](docs/RULES.md) | Reglas de comportamiento R1-R10. **Crítico**. |
| [docs/BOOTSTRAP_PROMPT.md](docs/BOOTSTRAP_PROMPT.md) | Prompt para sesiones nuevas |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Infra Pi, comandos, URLs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Backend SoT, mobile.html unificado |
| [docs/AUDIO_FLOW.md](docs/AUDIO_FLOW.md) | Arquitectura audio 2 canales (Pi sink USB + visor navegador) |
| [docs/Q_AND_A.md](docs/Q_AND_A.md) | Decisiones del usuario Q-A a Q-AU (fuente de verdad) |
| [docs/KNOWN_BUGS.md](docs/KNOWN_BUGS.md) | Bugs vigentes + QA pendiente 2.7-2.9 |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Items ACTIVE / PAUSED / DROPPED |
| [docs/SPRINTS.md](docs/SPRINTS.md) | Mapa histórico de trabajo por release (no hay sprints activos) |
| [docs/QA_PENDIENTE.md](docs/QA_PENDIENTE.md) | QA a validar en agua real |
| [docs/archive/](docs/archive/) | Snapshots históricos (Rev190 bugs, prompts LLM ejecutados, propuestas viejas) |

## Reglas duras (resumen de docs/RULES.md)

1. **NO marcar ✓** sin haber abierto el navegador y verificar.
2. **NO decir "done"** en multi-device sin que el state delta llegue al otro device.
3. **Una cosa por commit**, testable individualmente.
4. **Backend = single source of truth** (Q-N). State crítico en backend, no en visor.
5. **"Olvida" = descarte definitivo** — no re-listar items descartados.
6. **NO romper lo que funciona** "por limpiar".
7. **"Como en RevN" = exacto, no aproximado.**
8. **Default deploy**: `.\deploy.ps1 -Restart`.
9. **PowerShell ASCII-only** + check `$LASTEXITCODE`.
10. **Sin emojis** en el chat (sí en la UI del producto cuando proceda).

## Invariantes que NO cambian sin permiso explícito

- Backend authoritative para todo state crítico.
- Mobile.html como UI única (no rama desktop separada).
- Tema dark only.
- Predictive swing ring siempre ON.
- Pi audio: hardware ceiling alcanzado, NO más software gain.
- Branch único `main`.
- Solo `espeak` mandatorio en deps externas.
- Cero referencias comerciales en código/UI (ver memoria
  `feedback_no_commercial_refs`).
- Localhost en ejemplos URL, no `<pi-ip>`.
- NO re-abrir AIS engine (Q-R / B-03 resueltos hace tiempo, memoria
  `project_ais_engine_resolved`).
- NO mencionar "Hoekens" en changelogs/README/PRs/GitHub replies
  (memoria `feedback_no_hoekens_reference`).

## Próximo trabajo

No hay sprint activo. Trabajamos por feature request de Carlos + bug
hunt reactivo. Ver [`docs/BACKLOG.md`](docs/BACKLOG.md) para lo que
queda abierto (K-01 smoothing sonda, QA en agua de features 2.7-2.9,
Fase 2 forwarder embebido de aisfriends/aishub como paused).

## Memory files (persistente entre sesiones)

Hay observaciones del usuario en
`C:\Users\bybek\.claude\projects\c--Users-bybek-Downloads-signalk-mareas-ihm-Beta1-3-1-Rev40-signalk-mareas-ihm\memory\`.
Leerlos al inicio. Los más críticos:

- `feedback_audit_before_action.md` — auditar antes de actuar
- `feedback_always_restart_deploy.md` — siempre `-Restart`
- `feedback_powershell_ascii.md` — ASCII en PS scripts
- `feedback_powershell_exitcode.md` — check `$LASTEXITCODE`
- `feedback_no_commercial_refs.md` — sin referencias comerciales
- `feedback_no_hoekens_reference.md` — no mencionar Hoekens en público
- `feedback_minimal_deps.md` — minimal external deps
- `feedback_use_localhost.md` — localhost en URLs ejemplo
- `feedback_nordvpn_breaks_tailscale.md` — NordVPN rompe deploy
- `feedback_never_publish_without_explicit_ok.md` — publish requiere OK
- `feedback_prepublish_checklist.md` — checklist antes de publish
- `feedback_publish_npm_and_github.md` — publish = NPM + GitHub
- `feedback_confirm_semver_before_publish.md` — confirmar patch/minor/major
- `feedback_revision_bump_each_build.md` — Rev++ en cada build
- `feedback_qa_always_state_version.md` — QA lleva "QA Rev<N>"
- `feedback_qa_numbered.md` — QA numerado 1./2./3.
- `feedback_stay_focused.md` — no iterar sin sentido
- `feedback_3_strikes_then_gemini.md` — tras 3 fallos, prompt para Gemini
- `feedback_backend_is_source_of_truth.md` — todos POSTean al mismo endpoint
- `feedback_backlog_docs_are_stale.md` — advertir staleness antes de quotear
- `project_audio_hardware_ceiling.md` — no más software gain Pi
- `project_pi_connectivity.md` — Pi frágil (4G + EMI)
- `project_dev_environment.md` — laptop builds, Pi runs
- `project_ais_engine_resolved.md` — no re-abrir AIS engine ticket viejo
- `project_bug_imu_60s_clock_glitch.md` — `@signalk/set-system-time`
  corrompe IMU cada 60 s (fix: desactivar plugin)

Si una observación nueva contradice memoria existente, ACTUALIZAR
memoria.

## Idioma de trabajo

- Español por defecto al hablar con el usuario.
- Código en inglés (identifiers, comments).
- UI strings: ES + EN bilingüe (sistema i18n con `_i18n{}` y `data-i18n=...`).
