# QA_PENDIENTE — validaciones en agua real antes del próximo publish

Estado: **2026-07-21** (Rev761 / v2.9.0). El snapshot 2026-06-24 con
bugs B-23 a B-26 y wizard mandatorio M-02 vive en
[`archive/QA_PENDIENTE_2026-06-24_snapshot.md`](archive/QA_PENDIENTE_2026-06-24_snapshot.md).
Todo lo que estaba ahí ya está resuelto o desplegado a Rev761.

Aquí solo QA **abierto** para validar en agua real antes del próximo
`npm publish`.

---

## 🌊 Features 2.7.0 → 2.9.0 pendientes de validación en navegación

Ya están **implementadas y desplegadas en el Pi de Carlos**. Falta el
test real:

### Auto-lift al arrancar motor (Rev751)
- Levar y salir a motor. Debe:
  1. Detectar `propulsion.<name>.state="started"` o `revolutions>0`.
  2. Con SOG >0.5 kn sostenidos 30 s → auto-lift.
  3. Sin path de motor → fallback SOG >3 kn / 60 s.
- Activity log debe registrar `trigger=motor` o `trigger=sog`.

### AIS por internet — 3 motores (Rev738/754/756)
- **aisstream.io** (WebSocket real-time).
- **aishub.net** (polling 1/min).
- **aisfriends.com** (polling 1/min con Bearer token; requiere 7d de
  contribución en buena calidad antes de que el token funcione).
- Verificar en panel AIS del visor los badges **VHF / AS / AH / AF**
  detrás del nombre según dedupe. Cuando el VHF cubre 100% del bbox,
  todos deben salir VHF (correcto).
- Republish a `vessels.urn:mrn:imo:mmsi:*`: Freeboard-SK / KIP /
  WilhelmSK deben ver los targets online junto a los del VHF.
- Panel diagnóstico wizard: `Comprobar estado` de cada motor con
  dedupVhf / dedupAisstream / dedupAishub / adopted.

### Bottom-bar widgets nuevos (Rev734+)
- `cad_larg` (cadena largada estimada por geometría).
- `temp_agua` (temperatura agua).
- Verificar que sobreviven a `.\deploy.ps1 -Restart` (bug B-25 del
  snapshot anterior — se pisaban los defaults).

### Wizard configurator (Rev714+)
- Primer install: debe arrancar el wizard automático (`wizardCompleted
  !== true`).
- 16 steps con sensor check, IMU, tides, mbtiles, PIN master, etc.
- Botón 📋 Home visible en footer del wizard.

---

## 🐛 Bugs vivos (ver también KNOWN_BUGS.md)

### K-01 — Smoothing filter sonda
- Oscilación ~30 cm entre lecturas con sonda quieta.
- Fix esperado: EMA / media móvil corta en `environment.depth.belowKeel`
  antes del SSE.
- Prioridad: baja (no dispara alarma, solo ruido visual en widget).

---

## 🔧 Sistema externo — bloqueante para IMU

### `@signalk/set-system-time` corrompe IMU cada 60 s
- CONFIRMADO por Pablo + ChatGPT (2026-07-05).
- Fix operacional: **desactivar el plugin en admin de SK**.
- El wizard J-2 lo advierte al usuario.

---

## Recordatorio operativo

- **NUNCA `npm publish` sin OK explícito de Carlos** (memoria
  `feedback_never_publish_without_explicit_ok`).
- Antes de proponer publish, pasar el **pre-publish checklist**
  (memoria `feedback_prepublish_checklist`): auditar versiones,
  README, CHANGELOG, description, modal Instrucciones, docs, build,
  deploy QA. Reportar estado de cada punto.
- **Publish = NPM Y GitHub siempre** (memoria
  `feedback_publish_npm_and_github`).
- **Confirmar SemVer** (patch/minor/major) antes de bumpear
  (memoria `feedback_confirm_semver_before_publish`).
