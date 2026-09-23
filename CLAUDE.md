# CLAUDE.md — instrucciones para asistente AI

> **Estado 2026-09-23 — Rev885 / v2.12.0**
>
> QA pendiente en agua real (validar antes del próximo publish):
>  - **Rev883 auto-lift MOTORING fix + ACKs AIS preservados** en re-drop
>    < 5 m / < 2 min (issue #37 side-thread). Trigger primario motor+SOG
>    30 s, fallback SOG-only 60 s (antes 30 s).
>  - **Rev885 perf visor** en tablet real: dedup fetches + `whenVisible`
>    timers. Verificar fluidez pan/zoom + comportamiento al cambiar de app.
>  - Cualquier "retal" listado en `docs/QA_PENDIENTE.md`.
>
> Resueltos recientemente:
>  - ✅ Auto-lift MOTORING duplicado sin `_saveAisAckPending` (Rev883,
>       causa raíz del "anchor reset + ACKs limpias" reportado por
>       @ABS0lute-1 en issue #37).
>  - ✅ Memory leak AIS republish `path:"name"` (Rev861 / v2.11.4).
>  - ✅ aisstream/aishub/aisfriends rate-limit backoff exponencial
>       (Rev865 / v2.11.5, issue #40).
>  - ✅ Heap V8 grow lento en Pi con 23 plugins habilitados — workaround
>       operacional: **cron `/etc/cron.d/signalk-restart` cada 3 días
>       04:00 CEST + toggle icon LXDE** (2026-09-23).
>  - ✅ K-01 smoothing sonda (aprobado agua real 2026-08-02).
>  - ✅ Auto-lift al arrancar motor (Rev751).
>
> Un bug cosmético vigente: **TypeError meta on string** al arrancar SK
> (1 chispazo/restart, sin impacto funcional, ver `docs/KNOWN_BUGS.md`
> B-A1).
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
- **Rev actual**: `Rev885` (en `src/index.ts` const `PLUGIN_REVISION`).
- **Versión paquete**: `2.12.0` (`package.json`).

## Features nuevas 2.10.0 → 2.12.0 (última tanda)
- **2.12.0** (Rev883 → Rev885, 2026-09-23):
  - **Bug fix** — eliminado bloque MOTORING duplicado en el evaluador
    de anchor watch (issue #37 side-thread). El path nuevo unificado
    `_checkIntentionalDeparture` → `_autoLiftAnchorIntentional` es el
    único ahora; siempre llama `_saveAisAckPending()` antes de wipe.
    Umbral SOG-only subido a 60 s (antes 30 s).
  - **Heap diagnostics** — sección `heapAudit` bajo `/api/diagnostic`
    (sizes de estructuras internas del plugin) y endpoint admin
    `POST /api/heap-snapshot` con RAM safety guard.
  - **Perf visor** — `_ihmWhenVisible(fn)` en 8 timers de polling +
    monkey-patch de `window.fetch` que dedupea GETs en vuelo al backend.
- **2.11.0 → 2.11.8** (Rev800 → Rev882, ago-sep 2026): Cartas por
  Países configurables (IHM/IGN/NOAA/Kartverket/Traficom/CHS +
  PT/SHOM restringidos), radar RainViewer con timeline animada,
  buscador mundial de puertos (Nominatim), shelter smart open,
  K-03/K-04 audio Pi + voz cliente. Memory leak fix (2.11.4), aisstream
  backoff (2.11.5), Telegram lang fix (2.11.8, PR @s991116). Migración
  workflow publish OIDC Trusted Publishing (2.11.7-8).
- **2.9.0 y anteriores**: ver `docs/SPRINTS.md` + `git log` + CHANGELOG.
  Highlights: motor AIS online triple (2.9.0), interop canonical SK
  (2.8.0), sensor check wizard (2.7.0).

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
| [docs/KNOWN_BUGS.md](docs/KNOWN_BUGS.md) | Bugs vigentes (B-A1 cosmético) + resueltos recientes 2.11-2.12 |
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
queda abierto:

- **QA agua Rev883** (auto-lift MOTORING fix + ACKs preserved) — cuando
  Carlos salga a navegar.
- **QA tablet real Rev885** (perf visor: dedup fetches + whenVisible).
- **Vigilancia heap V8 post-cron** — verificar en 7 días que el restart
  cada 3 días mantiene RSS estable < 800 MB. Comparar curva de
  `heapAudit` con la de 2026-09-23.
- **Fix TypeError callsign** (B-A1 en KNOWN_BUGS) — bug cosmético
  1/restart, sin urgencia.
- **Feature "llamada Telegram"** en incubación — decidir vía MTProto
  vs alternativa antes de arrancar código.
- **Fase 2 forwarder embebido** de aisfriends/aishub como paused.

## Operacional en la Pi de Carlos (2026-09-23)

- **Cron restart auto**: `/etc/cron.d/signalk-restart` con `0 4 */3 * *
  root systemctl restart signalk`. Log en `/var/log/signalk-restart.log`.
- **Toggle icon LXDE**: `/home/pi/Desktop/Toggle-SignalK-Restart.desktop`.
  Click alterna entre activo (`/etc/cron.d/signalk-restart`) y
  desactivado (`.disabled`). Script: `/home/pi/toggle-signalk-restart.sh`.

## Memory files (persistente entre sesiones)

Hay observaciones del usuario en
`C:\Users\bybek\.claude\projects\c--Users-bybek-Downloads-signalk-mareas-ihm-Beta1-3-1-Rev40-signalk-mareas-ihm\memory\`.
Leerlos al inicio (índice completo en `MEMORY.md`). Los más críticos
para operar hoy:

- `feedback_challenge_carlos_decisions.md` — rebatir cuando técnicamente proceda
- `feedback_no_coauthor_attribution.md` — NO añadir Co-Authored-By en commits
- `feedback_always_restart_deploy.md` — siempre `.\deploy.ps1 -Restart`
- `feedback_deploy_automatically.md` — deploy automático tras batch
- `feedback_no_permission_asks_for_recurrent_actions.md` — no pedir permiso para deploy/commit rutinario
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
- `feedback_batch_trivial_npm_publishes.md` — no publish trivial suelto
- `feedback_less_is_more.md` — recortar antes que añadir
- `feedback_no_heap_snapshot_on_tight_ram.md` — snapshot heap solo si `available >= heap × 5 + 500 MB` (incidente 2026-09-23: colgué la Pi)
- `feedback_mobile_only_no_legacy.md` — mobile.html única, olvida `#panel` desktop
- `project_audio_hardware_ceiling.md` — no más software gain Pi
- `project_pi_connectivity.md` — Pi frágil (4G + EMI)
- `project_pi_ssh_tailscale.md` — SSH via 100.127.222.27
- `project_dev_environment.md` — laptop builds, Pi runs
- `project_npm_2fa_windows_hello.md` — NPM Trusted Publishing OIDC (tag push → CI publica)
- `project_ais_engine_resolved.md` — no re-abrir AIS engine ticket viejo
- `project_bug_imu_60s_clock_glitch.md` — `@signalk/set-system-time` corrompe IMU cada 60 s

Si una observación nueva contradice memoria existente, ACTUALIZAR
memoria.

## Idioma de trabajo

- Español por defecto al hablar con el usuario.
- Código en inglés (identifiers, comments).
- UI strings: ES + EN bilingüe (sistema i18n con `_i18n{}` y `data-i18n=...`).
