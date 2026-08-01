# QA_PENDIENTE — validaciones en agua real antes del próximo publish

Estado: **2026-08-02** (Rev843 / v2.11.2). Snapshots históricos:
- 2026-06-24 (bugs B-23 a B-26, wizard mandatorio M-02) → resuelto,
  archivo en [`archive/QA_PENDIENTE_2026-06-24_snapshot.md`](archive/QA_PENDIENTE_2026-06-24_snapshot.md).
- 2026-07-21 (features 2.7 → 2.9 QA + auto-lift + AIS triple online +
  bottom-bar widgets) → **todo aprobado en agua real por Carlos
  (2026-08-02)**. Snapshot no archivado — el histórico vive en
  git log.

---

## 🌊 QA abierto — features 2.11.x publicadas

Todas están **implementadas, desplegadas y publicadas en NPM 2.11.2**.
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

## 🐛 Bugs vigentes a arreglar (fuera de agua)

### UTF-8 doble-codificación en logs / activity log
**Síntoma**: "Moaña" aparece como "MoaÃ±a" en algunos textos que pasan
por un pipeline con codificación mixta.

**Prioridad**: media — es visual pero desmerece la UX.

### Audio Pi — reproducción intermitente
**Síntoma**: alarmas del Pi (sirena, voz OGG) fallan con más
frecuencia de lo aceptable para una capa de seguridad.

**Hipótesis en investigación**: relación con VPN (Tailscale) — quizás
el pipeline de audio queda afectado por el stack de red o por
dependencias del backend que se cuelgan cuando la ruta cambia.
Confirmar con:
- ¿Falla con VPN off?
- ¿Falla más cuando el 4G se degrada?
- ¿Correlación con log de systemd (`journalctl -u signalk`) alrededor
  del fallo?

**Prioridad**: **alta** — es capa de seguridad; si falla, la vigilancia
efectiva se degrada al audio cliente que ya es complementario.

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
