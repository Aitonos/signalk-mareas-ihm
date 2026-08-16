# QA_PENDIENTE — validaciones en agua real antes del próximo publish

Estado: **2026-08-16** (Rev866 / v2.11.5). Snapshots históricos:
- 2026-06-24 (bugs B-23 a B-26, wizard mandatorio M-02) → resuelto,
  archivo en [`archive/QA_PENDIENTE_2026-06-24_snapshot.md`](archive/QA_PENDIENTE_2026-06-24_snapshot.md).
- 2026-07-21 (features 2.7 → 2.9 QA + auto-lift + AIS triple online +
  bottom-bar widgets) → **todo aprobado en agua real por Carlos
  (2026-08-02)**. Snapshot no archivado — el histórico vive en
  git log.

---

## 🌊 QA abierto — features 2.11.x publicadas

Todas están **implementadas, desplegadas y publicadas en NPM 2.11.3**.
Carlos ya validó lo esencial durante el ciclo; queda validación en
navegación real de:

### v2.11.0 — Cartas por Países
- Activar cada carta preconfigurada en zona real: 🇪🇸 IHM ENC, 🇫🇷 IGN
  Cartes littorales, 🇺🇸 NOAA ENC, 🇳🇴 Kartverket, 🇫🇮 Traficom, 🇨🇦
  CHS NONNA. Comprobar que las teselas cargan y el proxy cachea.
- Servicios restringidos (🇵🇹 IH-PT, 🇫🇷 SHOM RASTER): pista del modal
  ⚙ enlaza al portal correcto y URL/clave pegadas funcionan.

### v2.11.0 — Radar RainViewer con timeline animada
- ▶/⏸ + slider + botón "Ahora" en varias localizaciones.
- Al activar el radar el mapa se aleja hasta ver ~2000 km sin romperse.

### v2.11.0 — 🔍 Buscador mundial de puertos
- Nominatim devuelve resultados razonables para puertos conocidos y
  desconocidos.
- El auto-follow se desactiva al volar al puerto (cámara no rebota).

### v2.11.2 — Shelter smart open + reset por movimiento
- Al abrir la ventana Abrigo con >10 min de antigüedad → auto-detect
  fresco automático.
- Editar sectores manual → label pasa a "Marcados N", cerrar/abrir
  respeta manual.
- Barco navega >300 m del origen → manual descartado + re-detect auto.

### v2.11.2 — AIS filtro propio barco
- Con motor online (aisstream/aishub/aisfriends) activo Y VHF, el
  propio Tunatunes NUNCA aparece en la lista de blancos ni pide ACK
  ni dispara alarma de colisión.

### v2.11.2 — Vessel Base Data desde el wizard
- Cambiar un campo en el wizard → SK admin UI lo refleja sin restart.
- Reiniciar SK server → los valores persisten (viven en
  `~/.signalk/baseDeltas.json`).

---

## 🌊 QA abierto — features 2.11.3 (K-03 + K-04)

### K-03 Fase 2 — Panel de Alarmas → widget audio-health
- Abrir 🔔 → verificar que el widget de "Salud del audio" muestra los
  últimos intentos y el sink en uso.
- Test manual del sink (botón "Probar audio del Pi") reproduce
  fanfarria corta por el USB.
- Fallo forzado (desenchufar DAC USB) → widget refleja fallos
  consecutivos y notification SK degradada.

### K-03 Fase 3 — Sirena pre-renderizada
- Reset del Pi → comprobar que la primera sirena AIS/garreo empieza
  limpia (sin recorte al inicio, gracias a los 250 ms de silencio).
- Cambiar el volumen desde el visor → el gain pre-computado se
  actualiza en background (revisar `/api/audio-health` `lastPrecomputeMs`).

### K-04 — Voz "Ancla fondeada" del cliente
- Portátil Firefox: 3 drops separados >5 s → los 3 suenan.
- Portátil Firefox: 2 drops muy rápidos <5 s → el segundo se dedupea.
- Móvil: idem (verificar AudioContext resume con user gesture).
- Cross-device: drop en móvil con visor abierto en portátil → suena
  también en el portátil (path SSE L8296).

## 🐛 Bugs vigentes a arreglar (fuera de agua)

_(vacío en 2026-08-04 — K-02 UTF-8 verificado no reproducible hoy en el
Pi de Tunatunes; los favoritos con acentos ("Moaña") persisten
correctamente en UTF-8.)_

---

## 🔧 Sistema externo — bloqueante para IMU (no arreglable desde aquí)

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
- **Publish incluye deploy al Pi** (memoria
  `feedback_publish_also_deploys_pi`) — no cuenta como publicado
  hasta que `deploy.ps1 -Restart` haya corrido.
