# QA_PENDIENTE — validaciones en agua real antes del próximo publish

Estado: **2026-09-23** (Rev885 / v2.12.0). Snapshots históricos:
- 2026-06-24 (bugs B-23 a B-26, wizard mandatorio M-02) → resuelto,
  archivo en [`archive/QA_PENDIENTE_2026-06-24_snapshot.md`](archive/QA_PENDIENTE_2026-06-24_snapshot.md).
- 2026-07-21 (features 2.7 → 2.9 QA + auto-lift + AIS triple online +
  bottom-bar widgets) → **todo aprobado en agua real por Carlos
  (2026-08-02)**. Snapshot no archivado — el histórico vive en
  git log.

---

## 🌊 QA abierto — features 2.12.0 publicadas (2026-09-23)

### Rev883 — Auto-lift MOTORING fix + ACKs preserved (issue [#37](https://github.com/Aitonos/signalk-mareas-ihm/issues/37))
**En agua real**:
1. Fondear + darle ACK a 1-2 vessels AIS cercanos.
2. Motorizar saliendo: arrancar motor, SOG > 0.5 kn sostenido 30 s.
3. Verificar en `activityLog` una entrada `auto-lift` con `trigger=motor`.
4. Verificar notification `notifications.signalk-mareas-ihm.autoLift` con `state:"alert"` y mensaje explicando trigger.
5. Volver al mismo sitio (< 5 m) en < 2 min y re-fondear.
6. Los ACKs AIS deben restaurarse automáticamente (verificar en modal AIS que los vessels acked previamente aparecen ya con ACK).
7. Repetir (2)-(6) pero con SOG-only (barco a vela, sin motor). Debe disparar al minuto (60 s), no a los 30 s como antes.

### Rev885 — Perf visor en tablet real
**En la tablet física (no laptop)**:
1. Abrir visor. Pan/zoom del mapa con 100+ vessels AIS visibles — verificar que se siente fluido.
2. Abrir modales varios (fondeo, mareas, AIS, meteo, wave, config) rápidamente. Sin lag notable.
3. **Test del `_ihmWhenVisible`**: cambia a otra app de la tablet, espera 30-60 s, vuelve al visor. Al volver, verifica que el estado sigue coherente y no hubo "acumulación de trabajo" al reactivar. En DevTools remoto (si tienes), la Network debería mostrar hueco durante la ausencia.
4. **Test del `_ihmDedupFetch`**: no se puede validar visualmente sin DevTools. Ya validado 12/12 unit tests aislados en Node local.

### Rev884 — Endpoint `/api/heap-snapshot` (validado en localhost 2026-09-23)
- **Ya probado**: POST devolvió 200 con RAM disponible × factor OK, generó `.heapsnapshot` en `/tmp` de 450 MB. Descargado a portátil por SCP, analizado con scripts Node aislados.
- Aprendizaje: **el snapshot infla RSS a ~5× el heap durante el dump** (no 1.5× como asumí inicialmente). Guard actualizado a `available >= heapUsed × 1.5` es conservador — considerar subir a × 3 si algún día tumba al hacerlo con margen "aparente".

### Cron restart auto (operacional, sin release)
- Instalado 2026-09-23: `/etc/cron.d/signalk-restart` con `0 4 */3 * *`. Toggle en `~/Desktop/Toggle-SignalK-Restart.desktop`.
- **Primera QA operacional**: mañana jueves 2026-09-24 04:00 CEST → verificar `sudo cat /var/log/signalk-restart.log` y que SK reinició sin problema.
- **Vigilancia**: en 7 días revisar que el patrón "3 días up + restart limpio" mantiene RSS estable < 800 MB. Confirmar con `heapAudit` de `/api/diagnostic`.

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
