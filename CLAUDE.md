# CLAUDE.md — instrucciones para asistente AI

**LEE PRIMERO `docs/RULES.md` y `docs/Q_AND_A.md`** antes de tocar nada.

## Quick context

- Plugin SignalK para barco **Tunatunes** (autor Aitonos, NPM `signalk-mareas-ihm`).
- Funcionalidades: mareas IHM España, fondeo con vigilancia garreo, AIS anti-colisión, abrigo, meteo, sonda.
- **Rev actual**: `Rev190` (en `src/index.ts` const `PLUGIN_REVISION`).
- **Versión paquete**: 2.0.3 (`package.json`).

## Workflow

- Edits y build en **portátil Windows 11**.
- Deploy a **Pi <PI_TAILSCALE_IP>** con `.\deploy.ps1 -Restart` (incluye build + rsync + restart SK).
- Pi corre OpenPlotter V4 con SignalK. Plugin en `/home/pi/signalk-mareas-ihm` con symlink a `~/.signalk/node_modules/`.

## Documentación canónica (LEE ANTES DE TOCAR)

| Archivo | Propósito |
|---|---|
| [docs/RULES.md](docs/RULES.md) | Reglas de comportamiento R1-R10. **Crítico**. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Infra Pi, comandos, URLs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Principio backend SoT, mobile.html unificado |
| [docs/Q_AND_A.md](docs/Q_AND_A.md) | Decisiones del usuario Q-A a Q-AU (fuente de verdad) |
| [docs/KNOWN_BUGS.md](docs/KNOWN_BUGS.md) | Bugs B-01 a B-22 con repro + fix |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Items activos / pausados / descartados |
| [docs/SPRINTS.md](docs/SPRINTS.md) | Plan de trabajo Sprints 1-6 |
| [docs/BOOTSTRAP_PROMPT.md](docs/BOOTSTRAP_PROMPT.md) | Prompt para sesiones nuevas |

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
- Cero referencias comerciales (acción pendiente: quitar "Sonarchart" → "Batimetría").

## Próximo trabajo

Estamos en **Sprint 1** de [docs/SPRINTS.md](docs/SPRINTS.md). Empezar por commit 1: mute audio cross-device.

## Memory files (persistente entre sesiones)

Hay observaciones del usuario en `C:\Users\bybek\.claude\projects\c--Users-bybek-Downloads-signalk-mareas-ihm-Beta1-3-1-Rev40-signalk-mareas-ihm\memory\`. Leerlos al inicio. Los más críticos:

- `feedback_audit_before_action.md` — auditar antes de actuar
- `feedback_always_restart_deploy.md` — siempre `-Restart`
- `feedback_powershell_ascii.md` — ASCII en PS scripts
- `feedback_powershell_exitcode.md` — check `$LASTEXITCODE`
- `feedback_no_commercial_refs.md` — sin referencias comerciales
- `feedback_minimal_deps.md` — minimal external deps
- `feedback_use_localhost.md` — localhost en URLs ejemplo
- `feedback_nordvpn_breaks_tailscale.md` — NordVPN rompe deploy
- `project_audio_hardware_ceiling.md` — no más software gain Pi
- `project_pi_connectivity.md` — Pi fragil (4G + EMI)
- `project_dev_environment.md` — laptop builds, Pi runs

Si una observación nueva contradice memoria existente, ACTUALIZAR memoria.

## Idioma de trabajo

- Español por defecto al hablar con el usuario.
- Código en inglés (identifiers, comments).
- UI strings: ES + EN bilingüe (sistema i18n con `_i18n{}` y `data-i18n=...`).
